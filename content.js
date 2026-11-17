// content.js — 守口如瓶过滤器：输入框实时扫描 + 脱敏
const PANEL_ID = '__llf_panel__';
let debounceTimer = null;
let enabled = true;

chrome.storage.sync.get({ enabled: true }, (cfg) => { enabled = cfg.enabled; });
chrome.storage.onChanged.addListener((ch) => { if (ch.enabled) enabled = ch.enabled.newValue; });

const PATTERNS = [
  { type: '身份证', re: /\b[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g },
  { type: '手机号', re: /\b1[3-9]\d{9}\b/g },
  { type: '银行卡', re: /\b(?:62|60|48|45)\d{11,17}\b/g },
  { type: '邮箱', re: /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g },
];

function localScan(text) {
  const hits = [];
  for (const { type, re } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) hits.push({ type, span: m[0], index: m.index, source: 'regex' });
  }
  return hits;
}

function maskSpan(s) {
  if (s.length <= 4) return '****';
  return s.slice(0, 2) + '*'.repeat(Math.max(2, s.length - 4)) + s.slice(-2);
}

function redact(text, hits) {
  let out = text;
  for (const h of hits.sort((a, b) => b.index - a.index)) {
    out = out.slice(0, h.index) + maskSpan(h.span) + out.slice(h.index + h.span.length);
  }
  return out;
}

function panelFor(field) {
  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style.cssText = 'position:absolute;z-index:2147483647;background:#1a1a2e;color:#eee;font:12px/1.5 system-ui;border-radius:10px;padding:10px 12px;box-shadow:0 6px 24px rgba(0,0,0,.35);max-width:320px;display:none';
    document.documentElement.appendChild(panel);
  }
  const r = field.getBoundingClientRect();
  panel.style.left = Math.max(8, r.left + scrollX) + 'px';
  panel.style.top = r.bottom + scrollY + 6 + 'px';
  return panel;
}

function hidePanel() {
  const p = document.getElementById(PANEL_ID);
  if (p) p.style.display = 'none';
}

function showPanel(field, result, text) {
  if (!enabled) return hidePanel();
  const hits = result.sensitive || [];
  if (!hits.length && !result.cloud_used) return hidePanel();
  const panel = panelFor(field);
  const tag = result.cloud_used
    ? '<div style="color:#ffb86b">☁ 本次检测在云端进行（长文档/端侧不可用）</div>'
    : '<div style="color:#50fa7b">🔒 端侧检测 · 数据未离开本机</div>';
  const list = hits.map(h => `<div>• <b style="color:#ff5555">${h.type}</b> <code style="background:#333;padding:1px 5px;border-radius:4px">${maskSpan(h.span)}</code></div>`).join('');
  panel.innerHTML =
    `<div style="font-weight:700;margin-bottom:4px">守口如瓶过滤器</div>${tag}` +
    (list || '<div>未发现敏感信息</div>') +
    (hits.length && result.redacted ? '<button id="__llf_fix__" style="margin-top:8px;background:#ff5555;border:0;color:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;font-weight:700">一键脱敏替换</button>' : '');
  panel.style.display = 'block';
  const btn = panel.querySelector('#__llf_fix__');
  if (btn) btn.onclick = () => {
    field.focus();
    field.value = result.redacted;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    hidePanel();
  };
}

async function askBg(text) {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'llf-scan', text });
    return res || { sensitive: [], cloud_used: false };
  } catch { return { sensitive: localScan(text), cloud_used: false }; }
}

function hook(field) {
  if (field.dataset.llfHooked) return;
  field.dataset.llfHooked = '1';
  field.addEventListener('input', () => {
    if (!enabled) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const text = field.value || field.innerText || '';
      if (!text.trim()) return hidePanel();
      const result = await askBg(text.slice(0, 20000));
      showPanel(field, result, text);
    }, 600);
  });
  field.addEventListener('blur', () => setTimeout(hidePanel, 300));
}

const observer = new MutationObserver(() => {
  document.querySelectorAll('input[type=text],input[type=email],input[type=search],input:not([type]),textarea').forEach(hook);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
document.querySelectorAll('input[type=text],input[type=email],input[type=search],input:not([type]),textarea').forEach(hook);
