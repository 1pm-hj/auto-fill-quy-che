(() => {
  const QA_DATA = window.QC_DATA || [];

  const norm = (s) => (s || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  function similarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    let score = 0;
    const short = a.length < b.length ? a : b;
    const long = a.length < b.length ? b : a;
    
    // Nâng cấp: Nếu từ khóa nằm trọn vẹn trong câu hỏi trên form và đủ dài, 
    // lập tức chấm 0.95 (95% khớp) để bù trừ cho việc câu bị rút gọn.
    if (short.length >= 10 && long.includes(short)) {
        return 0.95; 
    } else if (short.length >= 4 && long.includes(short)) {
        score = 0.85 * (short.length / long.length) + 0.12;
    }
    
    if (a.length < 2 || b.length < 2) return score;
    const map = new Map();
    for (let i = 0; i < a.length - 1; i++) {
      const g = a.substr(i, 2);
      map.set(g, (map.get(g) || 0) + 1);
    }
    let inter = 0;
    for (let i = 0; i < b.length - 1; i++) {
      const g = b.substr(i, 2);
      const c = map.get(g) || 0;
      if (c > 0) { inter++; map.set(g, c - 1); }
    }
    return Math.max(score, (2 * inter) / (a.length - 1 + b.length - 1));
  }

  function getQuestionItems() {
    let items = Array.from(document.querySelectorAll('[data-automation-id="questionItem"]'));
    if (items.length) return items;
    const titles = document.querySelectorAll('[data-automation-id="questionTitle"]');
    return Array.from(titles).map((t) => t.closest('[data-automation-id="questionItem"]') || t.parentElement?.parentElement).filter(Boolean);
  }

  function getChoices(item) {
    const radios = Array.from(item.querySelectorAll('input[type="radio"], [role="radio"]'));
    return radios.map((r) => {
      const box = r.closest('[data-automation-id="choiceItem"]') || r.closest('label') || r.parentElement?.parentElement || r;
      return { radio: r, box, text: (box.innerText || box.textContent || '').trim() };
    });
  }

  function isChecked(r) {
    return r.checked === true || r.getAttribute('aria-checked') === 'true';
  }

  function select(choice) {
    if (isChecked(choice.radio)) return true;
    choice.radio.click();
    if (isChecked(choice.radio)) return true;
    choice.box.click();
    return isChecked(choice.radio);
  }

  function fillAll() {
    if (!QA_DATA.length) {
        console.error("Không tải được mảng dữ liệu window.QC_DATA");
        return { total: 0, filled: 0, skipped: [] };
    }

    const items = getQuestionItems();
    const result = { total: items.length, filled: 0, skipped: [] };
    
    items.forEach((item, idx) => {
      const qTitleEl = item.querySelector('[data-automation-id="questionTitle"]');
      let qFormText = qTitleEl ? qTitleEl.innerText : '';
      qFormText = qFormText.replace(/^\d+[\.\)]\s*/, ''); 
      qFormText = norm(qFormText);

      let bestMatchedData = null;
      let highestQScore = 0;

      QA_DATA.forEach(data => {
          const qScore = similarity(qFormText, norm(data.q));
          if (qScore > highestQScore) {
              highestQScore = qScore;
              bestMatchedData = data;
          }
      });

      if (bestMatchedData && highestQScore > 0.65) {
          let bestChoice = null;
          let highestAScore = 0;
          const expectedAns = norm(bestMatchedData.a);

          getChoices(item).forEach((choice) => {
            const choiceText = norm(choice.text);
            const aScore = similarity(choiceText, expectedAns);
            if (aScore > highestAScore) {
                highestAScore = aScore;
                bestChoice = choice;
            }
          });

          if (bestChoice && highestAScore >= 0.75 && select(bestChoice)) {
            result.filled++;
          } else {
            result.skipped.push(idx + 1); 
          }
      } else {
          result.skipped.push(idx + 1); 
      }
    });
    
    return result;
  }

  async function waitForQuestions(timeout = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (getQuestionItems().length) return;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.action === 'fill') {
      waitForQuestions().then(() => sendResponse(fillAll()));
      return true; 
    }
  });
})();
