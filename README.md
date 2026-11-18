# Loose Lips Filter — #BuildHybridAI 2026

> **In one sentence**: An on-device AI privacy gate for your browser — it catches sensitive content in any input box before you hit send. Detection runs fully offline; your data never leaves your laptop unless you explicitly opt into cloud processing for long documents.

**Contest**: #BuildHybridAI (Google Firebase) — $30,000 in prizes
**Track**: Best Web/Chrome App | **License**: MIT | **Status**: submitted solo on Devpost

## The Problem (30-second pitch)

You paste an expense report into an AI chat window without noticing your phone number and national ID in the corner — and the cloud keeps a copy forever. Loose Lips Filter watches every input box in real time, flags sensitive content before you press Enter, and rewrites it with one click. Detection runs on-device with Gemini Nano, so your privacy never leaves the machine in the first place.

## Features (3 core, mapped to the hybrid-inference scoring criteria)

1. **Real-time on-device detection** — Chrome Prompt API (Gemini Nano) + regex dual engine scans every input field for phone numbers / national IDs / bank cards / emails / street addresses, with instant inline flagging.
2. **One-click redaction** — the on-device model produces a sanitized rewrite (semantics preserved, sensitive entities masked). Nothing is replaced until you confirm.
3. **Honest cloud fallback** — for long documents (>8K chars) or when the on-device model is unavailable, the request routes through a Cloudflare Worker relay to Gemini via Firebase AI Logic, and the UI explicitly tells you "this scan ran in the cloud." The hybrid decision is always visible — that's the point.

## Architecture

```
                 ┌────────────────────────────────────────────┐
 input field ──▶ │ content.js  (every page, real-time scan)   │
                 └──────────────────┬─────────────────────────┘
                                    ▼
                 ┌────────────────────────────────────────────┐
                 │ bg.js — hybrid dispatcher (MV3 worker)     │
                 └──┬──────────────┬──────────────┬───────────┘
        short text  │   long doc / │  relay down  │  all clouds down
        no Nano     │   no Nano    │              │
                    ▼              ▼              ▼
        ┌───────────────┐  ┌─────────────┐  ┌──────────────┐
        │ Gemini Nano   │  │ CF Worker   │  │ local regex  │
        │ (on-device)   │  │ relay ──▶   │  │ (on-device)  │
        │ 100% offline  │  │ Gemini API  │  │ 100% offline │
        └───────────────┘  └─────────────┘  └──────────────┘
```

- `manifest.json` — MV3 extension manifest
- `content.js` — input-box scanner + floating detection panel + one-click redaction
- `bg.js` → `bg.bundle.js` — hybrid dispatcher: on-device Nano → Cloudflare Worker relay (key held server-side) → Firebase AI Logic → local regex
- `worker-relay.js` — the Cloudflare Worker that proxies Gemini API calls and injects the API key server-side (deployed with `wrangler deploy`)
- `firebase-config.js` — Firebase project config (App Check enforced)

## Install (3 steps)

1. **Get the code**
   ```bash
   git clone https://github.com/qq-exe/privacy-guard.git
   ```
2. **Load it into Chrome/Edge**
   - Open `chrome://extensions` (or `edge://extensions`)
   - Turn on **Developer mode** (top-right toggle)
   - Click **Load unpacked** and select the cloned `privacy-guard/` folder
3. **Try it**
   - Open `demo.html` (or any page with an input box)
   - Paste text containing an ID/phone/bank-card number — a panel appears within ~0.6 s
   - Click **Redact** to replace sensitive spans with masked versions

> **Cloud fallback note**: the bundled relay endpoint has a free-tier daily quota (20 requests/day). When it's exhausted, the extension transparently falls back to on-device regex detection — the panel keeps working either way.

## Development

```bash
npm install        # install esbuild
npm run build      # bundle bg.js → bg.bundle.js
```

After editing source files, rebuild and hit "Reload" on the extension card in `chrome://extensions`.

## Privacy statement

- On-device scans (Nano / regex) never transmit data.
- Cloud scans are opt-out (toggle in the popup) and are always labeled in the UI.
- The relay holds the Gemini API key server-side; the client ships no credentials.

## License

MIT — see [LICENSE](LICENSE).
