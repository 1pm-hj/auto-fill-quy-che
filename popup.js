const status = document.getElementById('status');
const fillBtn = document.getElementById('fill');

fillBtn.addEventListener('click', async () => {
  fillBtn.disabled = true;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!/^https:\/\/(forms\.office\.com|forms\.cloud\.microsoft|forms\.microsoft\.com)\//.test(tab?.url || '')) {
    status.textContent = 'Hãy mở bài thi bằng link ở Bước 1 rồi bấm lại.';
    fillBtn.disabled = false;
    return;
  }

  status.textContent = 'Đang điền...';
  chrome.tabs.sendMessage(tab.id, { action: 'fill' }, (res) => {
    fillBtn.disabled = false;
    if (chrome.runtime.lastError || !res) {
      status.textContent = 'Không kết nối được với trang. Hãy tải lại (F5) rồi thử lại.';
      return;
    }
    let msg = `Đã chọn: ${res.filled}/${res.total} câu`;
    if (res.skipped.length) msg += `\nKhông khớp được (tự làm): ${res.skipped.join(', ')}`;
    status.textContent = msg;
  });
});
