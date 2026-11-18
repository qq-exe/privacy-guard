// bg.js — 混合推理调度器（MV3 service worker）
// 决策树：端侧 Gemini Nano 可用 → 端侧检测（免费/隐私）
//         长文档或端侧不可用 → Firebase AI Logic 云端 + 明示用户
const SHORT_LIMIT = 8000; // chars；超过视为长文档走云端

// ---- 端侧引擎：Chrome Prompt API (Gemini Nano) ----
let nanoSession = null;
async function getNano() {
  if (nanoSession) return nanoSession;
  if (!self.LanguageModel) return null;
  try {
    const avail = await LanguageModel.availability();
    if (avail === 'unavailable') return null;
    nanoSession = await LanguageModel.create({
      initialPrompts: [{
        role: 'system',
        content: '你是隐私审查器。只输出 JSON：{"sensitive":[{"type":"身份证|手机号|银行卡|邮箱|地址","span":"原文片段"}],"redacted":"把敏感片段用**掩码**替换后的全文"}。不确定的不算敏感。'
      }]
    });
    return nanoSession;
  } catch { return null; }
}

// ---- 本地正则引擎（永远可用的保底，仍是端侧） ----
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
    while ((m = re.exec(text))) hits.push({ type, span: m[0] });
  }
  return hits;
}
function localRedact(text, hits) {
  let out = text;
  for (const h of [...hits].sort((a, b) => b.span.length - a.span.length)) {
    out = out.replaceAll(h.span, h.span.length <= 4 ? '****' : h.span.slice(0, 2) + '*'.repeat(Math.max(2, h.span.length - 4)) + h.span.slice(-2));
  }
  return out;
}

// ---- 云端引擎：CF Worker 中转（首选，密钥在服务端）→ Gemini 直连 → Firebase AI Logic ----
import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel } from 'firebase/ai';
import { firebaseConfig, geminiDirectKey, geminiDirectModel } from './firebase-config.js';

const RELAY_BASE = 'https://hello-world-fragrant-voice-cc89.wqq2207.workers.dev';

const CLOUD_PROMPT =
  '你是隐私审查器。只输出 JSON：{"sensitive":[{"type":"身份证|手机号|银行卡|邮箱|地址","span":"原文片段"}],"redacted":"把敏感片段用**掩码**替换后的全文"}。不确定的不算敏感。\n\n';

function parseGeminiJson(data) {
  const out = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  return JSON.parse(out.match(/\{[\s\S]*\}/)[0]);
}

async function relayScan(text) {
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: CLOUD_PROMPT + text.slice(0, 30000) }] }],
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
  });
  let lastErr = null;
  for (let i = 0; i < 3; i++) { // 503 高需求瞬时重试
    if (i > 0) await new Promise(r => setTimeout(r, 3000 * i));
    const res = await fetch(`${RELAY_BASE}/gemini/v1beta/models/${geminiDirectModel}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (res.status === 503) { lastErr = new Error('relay 503'); continue; }
    if (!res.ok) throw new Error('relay ' + res.status);
    return parseGeminiJson(await res.json());
  }
  throw lastErr || new Error('relay failed');
}

async function geminiDirectScan(text) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiDirectModel}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': geminiDirectKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: CLOUD_PROMPT + text.slice(0, 30000) }] }],
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } }, // 关闭思考，秒级响应
      }),
    }
  );
  if (!res.ok) throw new Error('gemini-direct ' + res.status);
  return parseGeminiJson(await res.json());
}

let cloudModel = null;
async function firebaseScan(text) {
  if (!cloudModel) {
    const app = initializeApp(firebaseConfig);
    const ai = getAI(app);
    cloudModel = getGenerativeModel(ai, { model: 'gemini-2.5-flash' });
  }
  const res = await cloudModel.generateContent(CLOUD_PROMPT + text.slice(0, 30000));
  const out = res.response.text();
  return JSON.parse(out.match(/\{[\s\S]*\}/)[0]);
}

async function cloudScan(text) {
  const attempts = [
    ['relay', relayScan],
    ['direct', geminiDirectScan],
    ['firebase', firebaseScan],
  ];
  const errs = [];
  for (const [name, fn] of attempts) {
    try {
      return await fn(text);
    } catch (e) {
      errs.push(name + '=' + (e.message || '').slice(0, 60));
    }
  }
  throw new Error('cloud failed: ' + errs.join(' | '));
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'llf-scan') return;
  (async () => {
    const { text } = msg;
    const nano = await getNano();
    const useCloud = text.length > SHORT_LIMIT || !nano;
    if (useCloud) {
      const cloud = await cloudScan(text).catch(() => null);
      if (cloud) { sendResponse({ ...cloud, cloud_used: true, reason: text.length > SHORT_LIMIT ? 'long-doc' : 'nano-unavailable' }); return; }
      // 云端未配置：诚实降级为端侧正则，并告知原因
      const hits = localScan(text);
      sendResponse({ sensitive: hits, redacted: localRedact(text, hits), cloud_used: false, fallback_reason: useCloud ? 'cloud-not-configured' : null });
      return;
    }
    try {
      const out = await nano.prompt(text.slice(0, 16000));
      const parsed = JSON.parse(out.match(/\{[\s\S]*\}/)[0]);
      sendResponse({ ...parsed, cloud_used: false });
    } catch {
      const hits = localScan(text);
      sendResponse({ sensitive: hits, redacted: localRedact(text, hits), cloud_used: false, nano_error: true });
    }
  })();
  return true; // async response
});
