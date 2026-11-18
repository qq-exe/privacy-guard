// Gemini relay for Loose Lips Filter (hackathon demo)
// POST https://<worker>/gemini/v1beta/models/{model}:generateContent
// Key is provisioned server-side: npx wrangler secret put GEMINI_KEY
// (no credentials in source)

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-goog-api-key',
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/gemini/')) {
      return new Response(JSON.stringify({ ok: true, service: 'loose-lips-gemini-relay' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
    const target = 'https://generativelanguage.googleapis.com' + url.pathname.slice('/gemini'.length) + url.search;
    const headers = new Headers();
    const ct = request.headers.get('Content-Type');
    if (ct) headers.set('Content-Type', ct);
    headers.set('X-goog-api-key', env.GEMINI_KEY);
    try {
      const resp = await fetch(target, {
        method: request.method,
        headers,
        body: request.method === 'POST' || request.method === 'PUT' ? request.body : undefined,
      });
      const outHeaders = new Headers(corsHeaders());
      for (const [k, v] of resp.headers) {
        if (!k.toLowerCase().startsWith('access-control-') && k.toLowerCase() !== 'content-type') continue;
        outHeaders.set(k, v);
      }
      return new Response(resp.body, { status: resp.status, headers: outHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
  },
};
