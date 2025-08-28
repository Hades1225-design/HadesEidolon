// ===== site/reorder/common.js =====
// 共用：讀寫 GitHub JSON（支援多檔）、保留 ?file 參數、回首頁工具。
// 已改為：直接從 /public/*.json 讀取檔案，不再走 GitHub API。
// ===== site/reorder/common.js =====
const GH_OWNER = "Hades1225-design";
const GH_REPO = "HadesEidolon";
const GH_BRANCH = "main";
/* ----------------- 可調整區 ----------------- */
// 你的 Cloudflare Worker「儲存 API」端點（POST）
export const WORKER_ENDPOINT =
  "https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/save";

/* ------------------------------------------- */

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

// GitHub Contents API 讀取最新檔案
export async function fetchDataJSON() {
  const path = getFileParam();
  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURIComponent(path)}?ref=${GH_BRANCH}&ts=${Date.now()}`;
  const res = await fetch(url, {
    headers: { "Accept": "application/vnd.github.v3.raw" },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}（讀取 ${path} 失敗）`);
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("data.json 原文：", text);
    throw new Error("JSON 解析失敗：請檢查 data.json");
  }
}

/**
 * 存檔到 GitHub（透過 Cloudflare Worker）
 * @param {any} data - 會自動 JSON.stringify(, null, 2)
 * @param {string} message - commit 訊息
 * @returns {Promise<void>}
 */
export async function saveDataJSON(data, message = "update via web [skip ci]") {
  const path = getFileParam();

  const payload = {
    path,                                // 例如 public/data.json 或 public/bosslist.json
    content: JSON.stringify(data, null, 2),
    message
  };

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
    let detail = text;
    try { detail = JSON.parse(text); } catch {}
    const msg = typeof detail === "string" ? detail : JSON.stringify(detail);
    throw new Error(`Load failed（HTTP ${res.status}） ${msg}`);
  }
}

/** 取得目前檔案在 GitHub 的最後 commit 時間（ISO字串或 null） */
export async function fetchLastCommitTime() {
  // 改用 Worker 直接更新的結果，資料會即時反映在 Pages
  // 因為走 /public/*.json，這裡還是透過 GitHub API 查最後更新時間
  const path = getFileParam();
  const url =
    `https://api.github.com/repos/Hades1225-design/HadesEidolon/commits?path=${encodeURIComponent(path)}&page=1&per_page=1`;
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

/** 儲存成功後導回首頁（或你指定的頁面），保留 ?file 參數 */
export function goHomeAfterSave(target = "./index.html") {
  location.href = urlWithFile(target);
}

/** 工具：限制輸入為 0-9（可搭配 time 編輯器） */
export function onlyDigits(str) {
  return String(str || "").replace(/\D+/g, "");
}