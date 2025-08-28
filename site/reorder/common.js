// ===== site/reorder/common.js =====
// 共用：讀寫 GitHub JSON（支援多檔）、保留 ?file 參數、回首頁工具。

const GH_OWNER  = "Hades1225-design";
const GH_REPO   = "HadesEidolon";
const GH_BRANCH = "main";

// 你的 Cloudflare Worker「儲存 API」端點（POST）
export const WORKER_ENDPOINT =
  "https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/save";

/** 讀目前網址上的 ?file 參數（回傳檔名，預設 public/data.json） */
export function getFileParam() {
  const qs = new URLSearchParams(location.search);
  let f = qs.get("file") || "public/data.json";
  // 若只給 xxx.json，幫補上 public/
  if (/^[A-Za-z0-9._\-\/]+\.json$/.test(f) && !/^public\//.test(f)) {
    f = "public/" + f.replace(/^\/+/, "");
  }
  // 僅允許 public/*.json
  if (!/^public\/[A-Za-z0-9._\-\/]+\.json$/.test(f)) {
    f = "public/data.json";
  }
  return f;
}

/** 目前檔名（顯示用 Label） */
export function currentFileLabel() {
  const p = getFileParam();
  return p.replace(/^public\//, "");
}

/** 讀取 JSON（先走 GitHub Contents API；失敗再抓 Pages 的 /public/xxx.json） */
export async function fetchDataJSON() {
  const path = getFileParam();

  // 方案 A：GitHub Contents API（最即時，已加 ts 防 cache）
  const ghUrl =
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURIComponent(path)}?ref=${GH_BRANCH}&ts=${Date.now()}`;

  try {
    const res = await fetch(ghUrl, {
      headers: { "Accept": "application/vnd.github.v3.raw" },
      cache: "no-store"
    });
    if (res.ok) {
      const text = await res.text();
      return JSON.parse(text);
    }
    // 對於 403/404，嘗試方案 B
    if (res.status !== 403 && res.status !== 404) {
      throw new Error(`HTTP ${res.status}（讀取 ${path} 失敗）`);
    }
  } catch (e) {
    // 繼續 fallback
    console.warn("GitHub API 讀取失敗，改用 Pages 檔案：", e);
  }

  // 方案 B：直接抓 Pages 上的 /public/xxx.json
  const pagesUrl = `/${path}?ts=${Date.now()}`;
  const r = await fetch(pagesUrl, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}（讀取 ${path} 失敗）`);
  const t = await r.text();
  try { return JSON.parse(t); }
  catch {
    console.error("JSON 原文：", t);
    throw new Error("JSON 解析失敗：請檢查檔案格式");
  }
}

/** 存檔到 GitHub（透過 Cloudflare Worker） */
export async function saveDataJSON(data, message = "update via web [skip ci]") {
  const path = getFileParam();
  const payload = { path, content: JSON.stringify(data, null, 2), message };

  let res;
  try {
    res = await fetch(WORKER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    throw new Error(`Load failed（無法連線儲存伺服器）：${e.message}`);
  }

  const text = await res.text();
  if (!res.ok) {
    let detail = text; try { detail = JSON.parse(text); } catch {}
    throw new Error(`Load failed（HTTP ${res.status}） ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
}

/** 取得目前檔案在 GitHub 的最後 commit 時間（ISO字串或 null） */
export async function fetchLastCommitTime() {
  const path = getFileParam();
  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/commits?path=${encodeURIComponent(path)}&page=1&per_page=1`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return null;
  const commits = await r.json();
  return Array.isArray(commits) && commits.length
    ? commits[0].commit.committer.date
    : null;
}

/** 依目前的 ?file 參數產生某頁連結（會自動帶上 file） */
export function urlWithFile(relativeHref) {
  const file = getFileParam();
  const u = new URL(relativeHref, location.href);
  u.searchParams.set("file", file.replace(/^public\//, ""));
  return u.toString();
}

/** 儲存成功後導回頁面（預設回 /site/reorder/index.html），保留 ?file 參數 */
export function goHomeAfterSave(target = "./index.html") {
  location.href = urlWithFile(target);
}

/** 工具：僅保留數字 */
export function onlyDigits(str) {
  return String(str || "").replace(/\D+/g, "");
}