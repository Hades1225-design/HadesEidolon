/**
 * Cloudflare Worker：寫入 GitHub 檔案（支援多 JSON）+ 偵錯端點
 *
 * 需要的環境變數（Secrets / Vars）：
 *  - GH_TOKEN        : GitHub PAT（classic：勾 repo；fine-grained：對 HadesEidolon 設 Contents=Read/Write）
 *  - GH_OWNER        : Hades1225-design
 *  - GH_REPO         : HadesEidolon
 *  - GH_BRANCH       : main
 *  - ALLOWED_ORIGIN  : 例如 "https://hades1225-design.github.io,https://*.pages.dev"
 */

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      // CORS preflight
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors(env, request) });
      }

      // ---- 偵錯端點 ----
      if (request.method === "GET" && url.pathname === "/api/health") {
        return json({
          ok: true,
          owner: !!env.GH_OWNER,
          repo: !!env.GH_REPO,
          branch: !!env.GH_BRANCH,
          token_present: !!(env.GH_TOKEN && String(env.GH_TOKEN).length > 10)
        }, 200, env, request);
      }

      if (request.method === "GET" && url.pathname === "/api/check-auth") {
        const r = await fetch("https://api.github.com/rate_limit", { headers: ghHeaders(env) });
        let body = await safeText(r);
        body = tryParse(body);
        return json({ upstream: r.status, body }, r.ok ? 200 : 502, env, request);
      }

      // ---- 讀檔：GET /api/read?path=public/xxx.json ----
      if (request.method === "GET" && url.pathname === "/api/read") {
        const path = (url.searchParams.get("path") || "").trim();

        // 僅允許 public/*.json；若沒符合就拒絕
        if (!/^public\/[A-Za-z0-9._\-\/]+\.json$/.test(path)) {
          return json({ error: "Path not allowed", path }, 403, env, request);
        }

        // 檢查必要環境變數
        const miss = [];
        if (!env.GH_TOKEN)  miss.push("GH_TOKEN");
        if (!env.GH_OWNER)  miss.push("GH_OWNER");
        if (!env.GH_REPO)   miss.push("GH_REPO");
        if (!env.GH_BRANCH) miss.push("GH_BRANCH");
        if (miss.length) {
          return json({ error: "Missing env", missing: miss }, 500, env, request);
        }

        // 打 GitHub Contents API 拿 raw 內容（用 Token → 不會有前端 403）
        const ghURL = `https://api.github.com/repos/${env.GH_OWNER}/${env.GH_REPO}/contents/${encodeURIComponent(path)}?ref=${env.GH_BRANCH}`;
        const ghRes = await fetch(ghURL, {
          headers: {
            ...ghHeaders(env),
            "Accept": "application/vnd.github.v3.raw" // 直接取純文字
          }
        });

        const bodyText = await safeText(ghRes);
        if (!ghRes.ok) {
          return json({ step: "READ", error: `GitHub GET ${ghRes.status}`, body: tryParse(bodyText) }, 502, env, request);
        }

        // 直接把 JSON 文字回給前端（保留 CORS）
        return new Response(bodyText, {
          status: 200,
          headers: {
            ...cors(env, request),
            "content-type": "application/json; charset=utf-8",
            // 為了即時性先不要快取；要省流量可改成 Cache-Control: public, max-age=30
            "cache-control": "no-store"
          }
        });
      }

      // ---- 主功能：儲存 ----
      if (request.method === "POST" && url.pathname === "/api/save") {
        let body;
        try { body = await request.json(); }
        catch { return json({ error: "Invalid JSON body" }, 400, env, request); }

        // 解析 path/content/message
        let path = String(body.path || "public/data.json").trim();
        const message = String(body.message || "update data [skip ci]");
        const content = typeof body.content === "string"
          ? body.content
          : JSON.stringify(body.content ?? "", null, 2);

        // 只允許 public/*.json；若只給 xxx.json 幫補 public/
        if (!/^public\/[A-Za-z0-9._\-\/]+\.json$/.test(path)) {
          if (/^[A-Za-z0-9._\-\/]+\.json$/.test(path)) {
            path = "public/" + path.replace(/^\/+/, "");
          } else {
            return json({ error: "Path not allowed", path }, 403, env, request);
          }
        }

        // 檢查必要環境變數
        const miss = [];
        if (!env.GH_TOKEN)  miss.push("GH_TOKEN");
        if (!env.GH_OWNER)  miss.push("GH_OWNER");
        if (!env.GH_REPO)   miss.push("GH_REPO");
        if (!env.GH_BRANCH) miss.push("GH_BRANCH");
        if (miss.length) {
          return json({ error: "Missing env", missing: miss }, 500, env, request);
        }

        const base = `https://api.github.com/repos/${env.GH_OWNER}/${env.GH_REPO}/contents/${encodeURIComponent(path)}`;

        // 1) 取得 sha
        const getRes = await fetch(`${base}?ref=${env.GH_BRANCH}`, { headers: ghHeaders(env) });
        let sha;
        if (getRes.ok) {
          const meta = tryParse(await safeText(getRes));
          sha = meta?.sha;
        } else if (getRes.status !== 404) {
          const t = tryParse(await safeText(getRes));
          console.error("GET meta failed:", getRes.status, t);
          return json({ step: "GET meta", error: `GitHub GET ${getRes.status}`, body: t }, 502, env, request);
        }

        // 2) PUT 寫入
        const putRes = await fetch(base, {
          method: "PUT",
          headers: { ...ghHeaders(env), "content-type": "application/json" },
          body: JSON.stringify({
            message: /\[skip ci\]/i.test(message) ? message : `${message} [skip ci]`,
            content: b64(content),
            branch: env.GH_BRANCH,
            ...(sha ? { sha } : {})
          })
        });

        const putTxt = tryParse(await safeText(putRes));
        if (!putRes.ok) {
          console.error("PUT content failed:", putRes.status, putTxt);
          return json({ step: "PUT content", error: `GitHub PUT ${putRes.status}`, body: putTxt }, 502, env, request);
        }

        return json({ ok: true, path, result: putTxt }, 200, env, request);
      }

      return json({ error: "Not found" }, 404, env, request);
    } catch (e) {
      // 把 Worker 崩潰也轉成 500，避免平台 502
      console.error("Worker crashed:", e.stack || e.message || e);
      return new Response(JSON.stringify({ error: "Worker crashed", message: e.message, stack: e.stack }), {
        status: 500,
        headers: { "content-type": "application/json", ...cors(env, request) }
      });
    }
  }
};

/* ===== helpers ===== */
function ghHeaders(env) {
  const t = (env.GH_TOKEN || "").trim();
  const scheme = t.startsWith("github_pat_") ? "Bearer" : "token"; // fine-grained 建議 Bearer；classic 常見 token
  return {
    "Authorization": `${scheme} ${t}`,
    "User-Agent": "cf-worker-hades",
    "Accept": "application/vnd.github+json"
  };
}

function b64(s) { return btoa(unescape(encodeURIComponent(s))); }
async function safeText(r) { try { return await r.text(); } catch { return ""; } }
function tryParse(t) { try { return JSON.parse(t); } catch { return t; } }

function cors(env, req) {
  const origin = req.headers.get("Origin") || "";
  const list = (env.ALLOWED_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
  const allow = list.length === 0 ? "*" : (list.includes(origin) ? origin : list[0]);
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin"
  };
}

function json(obj, status, env, req) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...cors(env, req) }
  });
}
