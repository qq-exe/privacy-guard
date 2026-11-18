// popup.js — 状态、开关与语言切换
const st = document.getElementById('st');

const I18N = {
  zh: {
    title: '守口如瓶过滤器',
    sub: '发送前拦截敏感信息 · 端侧 AI · 数据不出本机',
    protect: '实时保护',
    engine: '检测引擎',
    engineRegex: '端侧（正则）',
    engineNano: '端侧（Gemini Nano ✅）',
    engineDl: '端侧（Nano 可下载）',
    stat: '本次会话拦截的敏感内容条数',
    foot: 'hybrid inference：短文本端侧 Gemini Nano；长文档走云端并明示。',
    foot2: 'Open source · #BuildHybridAI 2026',
  },
  en: {
    title: 'Loose Lips Filter',
    sub: 'Catch sensitive info before you hit send · on-device AI · data stays local',
    protect: 'Live protection',
    engine: 'Detection engine',
    engineRegex: 'On-device (regex)',
    engineNano: 'On-device (Gemini Nano ✅)',
    engineDl: 'On-device (Nano downloadable)',
    stat: 'Sensitive items caught this session',
    foot: 'Hybrid inference: short text on-device via Gemini Nano; long documents go to the cloud — always labeled.',
    foot2: 'Open source · #BuildHybridAI 2026',
  },
};

let lang = 'zh';

function applyLang() {
  const t = I18N[lang];
  document.getElementById('t_title').textContent = t.title;
  document.getElementById('t_sub').textContent = t.sub;
  document.getElementById('t_protect').textContent = t.protect;
  document.getElementById('t_engine').textContent = t.engine;
  document.getElementById('t_stat').textContent = t.stat;
  document.getElementById('t_foot').innerHTML = t.foot + '<br>' + t.foot2;
  document.getElementById('langBtn').textContent = lang === 'zh' ? 'EN' : '中文';
  document.getElementById('engine').textContent = engineText();
}

let engineText = () => I18N[lang].engineRegex;

chrome.storage.sync.get({ enabled: true, blocked: 0, lang: 'zh' }, ({ enabled, blocked, lang: l }) => {
  lang = l || 'zh';
  st.textContent = enabled ? 'RUNNING' : 'PAUSED';
  st.className = 'badge ' + (enabled ? 'on' : 'off');
  document.getElementById('cnt').textContent = blocked;
  (async () => {
    try {
      if (self.LanguageModel) {
        const a = await LanguageModel.availability();
        if (a === 'available') engineText = () => I18N[lang].engineNano;
        else if (a === 'downloadable') engineText = () => I18N[lang].engineDl;
      }
    } catch {}
    applyLang();
  })();
});

st.addEventListener('click', async () => {
  const { enabled } = await chrome.storage.sync.get({ enabled: true });
  await chrome.storage.sync.set({ enabled: !enabled });
  st.textContent = !enabled ? 'RUNNING' : 'PAUSED';
  st.className = 'badge ' + (!enabled ? 'on' : 'off');
});

document.getElementById('langBtn').addEventListener('click', async () => {
  lang = lang === 'zh' ? 'en' : 'zh';
  await chrome.storage.sync.set({ lang });
  applyLang();
});
