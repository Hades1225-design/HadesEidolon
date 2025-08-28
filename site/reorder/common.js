// ===== site/reorder/common.js =====
// 共用：讀寫 GitHub JSON（支援多檔）、保留 ?file 參數、回首頁工具。
// 支援：路徑式/參數式 指定 JSON；優先走 Worker 讀取即時資料。

/* ----------------- 可調整區 ----------------- */
// Cloudflare Worker 端點
export const WORKER_ENDPOINT      = "https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/save";
export const WORKER_READ_ENDPOINT = "https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/read";

//（備援）GitHub Repo 設定：只在 Worker 失敗時用
const GH_OWNER  = "Hades1225-design";
const GH_REPO   = "HadesEidolon";
const GH_BRANCH = "main";
/* ------------------------------------------- */

/** 讀目前網址上的 JSON 路徑（回傳形如 "public/reorder/mikey465.json"） */
export function getFileParam() {
  const qs = new URLSearchParams(location.search);
  let f = (qs.get("file") || "").trim();

  // 依目前所在路徑 /site/<slug>/ 推斷預設 JSON：
  // 例：/site/reorder/... → 預設 public/reorder/data.json
  const parts   = location.pathname.split("/").filter(Boolean);
  const idxSite = parts.findIndex(p => p === "site");
  const slug    = (idxSite >= 0 && parts[idxSite + 1]) ? parts[idxSite + 1] : null;
  const DEFAULT_PATH = slug ? `public/${slug}/data.json` : "public/data.json";

  // 1) 若帶 ?file= 優先使用它
  if (f) {
    // 僅檔名：mikey465 / mikey465.json
    if (/^[A-Za-z0-9._\-]+(?:\.json)?$/.test(f)) {
      if (!f.endsWith(".json")) f += ".json";
      return slug ? `public/${slug}/${f}` : `public/${f}`;
    }
    // 含子路徑：reorder/mikey465.json 或 public/reorder/mikey465.json
    if (/^(?:public\/)?[A-Za-z0-9._\-\/]+\.json$/.test(f)) {
      return f.startsWith("public/") ? f : `public/${f}`;
    }
    // 非法 → 退回預設
    return DEFAULT_PATH;
  }

  // 2) 無 ?file= → 看路徑最後一段（支援省略 .json）
  //   /site/reorder/mikey465        → public/reorder/mikey465.json
  //   /site/reorder/mikey465.json   → public/reorder/mikey465.json
  //   /site/reorder/ 或 /site/reorder/index.html → public/reorder/data.json
  const last = parts[parts.length - 1] || "";
  const isIndex = last === "" || last === "index.html";
  if (isIndex) return DEFAULT_PATH;

  if (/^[A-Za-z0-9._\-]+(?:\.json)?$/.test(last)) {
    const name = last.endsWith(".json") ? last : `${last}.json`;
    return slug ? `public/${slug}/${name}` : `public/${name}`;
  }

  // 其餘不認 → 預設
  return DEFAULT_PATH;
}

/** 目前檔名（顯示用）："public/xxx/yyy.json" → "xxx/yyy.json" */
export function currentFileLabel() {
  return getFileParam().replace(/^public\//, "");
}

/** 讀取 JSON（優先 Worker /api/read，其次 GitHub Contents API raw） */
export async function fetchDataJSON() {
  const path = getFileParam();

  // 1) 走 Worker（即時、不受前端匿名 rate limit）
  try {
    const url = `${WORKER_READ_ENDPOINT}?path=${encodeURIComponent(path)}&ts=${Date.now()}`;
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) return await r.json();
  } catch (e) {
    console.warn("Worker read failed:", e);
  }

  // 2) 備援：GitHub Contents API raw
  const api = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURIComponent(path)}?ref=${GH_BRANCH}&ts=${Date.now()}`;
  const res = await fetch(api, {
    headers: { "Accept": "application/vnd.github.v3.raw" },
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}（API 讀取 ${path} 失敗）`);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch {
    console.error("API JSON 原文：", text);
    throw new Error("API JSON 解析失敗");
  }
}

/** 存檔到 GitHub（透過 Worker /api/save） */
export async function saveDataJSON(data, message = "update via web [skip ci]") {
  const path = getFileParam();
  let res;
  try {
    res = await fetch(WORKER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path,
        content: JSON.stringify(data, null, 2),
        message
      })
    });
  } catch (e) {
    throw new Error(`Load failed（無法連線儲存伺服器）：${e.message}`);
  }

  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try { detail = JSON.parse(text); } catch {}
    const msg = typeof detail === "string" ? detail : JSON.stringify(detail);
    throw new Error(`Load failed（HTTP ${res.status}） ${msg}`);
  }
}

/** 取得目前檔案的最後 commit 時間（GitHub API） */
export async function fetchLastCommitTime() {
  const path = getFileParam();
  const url  = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/commits?path=${encodeURIComponent(path)}&page=1&per_page=1`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return null;
  const commits = await r.json();
  return Array.isArray(commits) && commits.length ? commits[0].commit.committer.date : null;
}

/** 依目前 JSON 產生某頁連結（自動帶上 file，確保相容舊模式） */
export function urlWithFile(relativeHref) {
  const file = getFileParam(); // e.g. public/reorder/mikey465.json
  const u = new URL(relativeHref, location.href);
  u.searchParams.set("file", file.replace(/^public\//, "")); // e.g. reorder/mikey465.json
  return u.toString();
}

/** 儲存成功後導回首頁（或指定頁），保留目前檔案 */
export function goHomeAfterSave(target = "./index.html") {
  location.href = urlWithFile(target);
}

/** 限制輸入為 0-9（time 編輯器可用） */
export function onlyDigits(str) {
  return String(str || "").replace(/\D+/g, "");
}