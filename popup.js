// popup.js — 状态与开关
const st = document.getElementById('st');

chrome.storage.sync.get({ enabled: true, blocked: 0 }, ({ enabled, blocked }) => {
  st.textContent = enabled ? 'RUNNING' : 'PAUSED';
  st.className = 'badge ' + (enabled ? 'on' : 'off');
  document.getElementById('cnt').textContent = blocked;
});

st.addEventListener('click', async () => {
  const { enabled } = await chrome.storage.sync.get({ enabled: true });
  await chrome.storage.sync.set({ enabled: !enabled });
  st.textContent = !enabled ? 'RUNNING' : 'PAUSED';
  st.className = 'badge ' + (!enabled ? 'on' : 'off');
});

// 引擎状态：端侧 Nano 是否可用
(async () => {
  let engine = '端侧（正则）';
  try {
    if (self.LanguageModel) {
      const a = await LanguageModel.availability();
      if (a === 'available') engine = '端侧（Gemini Nano ✅）';
      else if (a === 'downloadable') engine = '端侧（Nano 可下载）';
    }
  } catch {}
  document.getElementById('engine').textContent = engine;
})();
