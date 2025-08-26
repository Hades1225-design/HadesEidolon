export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), env);

    if (url.pathname === '/api/save' && req.method === 'POST') {
      try {
        const origin = req.headers.get('origin') || '';
        if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) {
          return cors(json({ error: 'origin not allowed' }, 403), env);
        }

        const { path, content, message } = await req.json();
        if (!path || typeof content !== 'string') {
          return cors(json({ error: 'bad payload' }, 400), env);
        }
        if (!/^[\w\-./]+$/.test(path) || path.includes('..')) {
          return cors(json({ error: 'bad path' }, 400), env);
        }

        const sha = await getSha(env, path);
        const b64 = btoaUnicode(content);
        const body = {
          message: message || `update ${path}`,
          content: b64,
          branch: env.REPO_BRANCH || 'main',
          ...(sha ? { sha } : {})
        };

        const gh = await fetch(
          `https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/contents/${encodeURIComponent(path)}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github+json',
              'User-Agent': 'cf-worker-json-saver'
            },
            body: JSON.stringify(body)
          }
        );

        if (!gh.ok) {
          const text = await gh.text();
          return cors(json({ error: 'github error', detail: text }, gh.status), env);
        }

        const data = await gh.json();
        return cors(json({ ok: true, path, commit: data.commit?.sha }), env);

      } catch (e) {
        return cors(json({ error: e.message || 'server error' }, 500), env);
      }
    }

    return cors(new Response('Not found', { status: 404 }), env);
  }
};

function cors(resp, env) {
  resp.headers.set('Access-Control-Allow-Origin', env.ALLOWED_ORIGIN || '*');
  resp.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  resp.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  resp.headers.set('Access-Control-Max-Age', '86400');
  return resp;
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
async function getSha(env, path) {
  const r = await fetch(
    `https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/contents/${encodeURIComponent(path)}?ref=${env.REPO_BRANCH || 'main'}`,
    { headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'cf-worker-json-saver'
      }
    }
  );
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`github get sha failed: ${r.status}`);
  const j = await r.json();
  return j.sha || null;
}
function btoaUnicode(str) { return btoa(unescape(encodeURIComponent(str))); }
