export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env, request) });
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/save")
      return new Response("Not found", { status: 404 });

    let body; try{ body = await request.json(); } catch{ return json({error:"Invalid JSON"}, 400, env, request); }

    const path = String(body.path||"");
    const content = typeof body.content === "string" ? body.content : JSON.stringify(body.content);
    const message = (body.message||"update data [skip ci]").toString();

    // 白名單：只允許 public/ 下的 .json
    if (!/^public\/[A-Za-z0-9._\-\/]+\.json$/.test(path))
      return json({error:"Path not allowed"}, 403, env, request);

    // （可選）Cookie 或 Bearer 驗證：視你的設定開關
    // if (!authorized(request, env)) return json({error:"Unauthorized"}, 401, env, request);

    const base = `https://api.github.com/repos/${env.GH_OWNER}/${env.GH_REPO}/contents/${encodeURIComponent(path)}`;

    // 取 sha
    let sha;
    const get = await fetch(`${base}?ref=${env.GH_BRANCH}`, { headers: ghHdr(env) });
    if (get.ok) { sha = (await get.json()).sha; }
    else if (get.status !== 404) return json({error:`GitHub GET ${get.status}`}, 502, env, request);

    // PUT
    const put = await fetch(base, {
      method: "PUT",
      headers: { ...ghHdr(env), "content-type":"application/json" },
      body: JSON.stringify({
        message: /\[skip ci\]/i.test(message) ? message : (message + " [skip ci]"),
        content: b64(content),
        branch: env.GH_BRANCH,
        ...(sha ? { sha } : {})
      })
    });
    const ok = put.ok;
    const txt = await put.text();
    if (!ok) return json({error:`GitHub PUT ${put.status}`, body: tryParse(txt)}, 502, env, request);
    return json({ok:true, body: tryParse(txt)}, 200, env, request);
  }
};

const b64 = s => btoa(unescape(encodeURIComponent(s)));
const ghHdr = env => ({ Authorization:`Bearer ${env.GH_TOKEN}`, "User-Agent":"cf-worker" });
const tryParse = t => { try{return JSON.parse(t);}catch{return t;} };
const cors = (env, req) => {
  const origin = req.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGIN||"*");
  return {
    "Access-Control-Allow-Origin": allowed==="*" ? "*" : origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin"
  };
};
function json(obj, status, env, req){ return new Response(JSON.stringify(obj), { status, headers: { "content-type":"application/json", ...cors(env, req) } }); }
// function authorized(req, env){ /* 如需驗證再開 */ return true; }