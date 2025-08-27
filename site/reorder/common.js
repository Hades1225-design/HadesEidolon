// ===== site/reorder/common.js =====
// 共用：讀寫 GitHub JSON（支援多檔）、保留 ?file 參數、回首頁工具。
// 以 ES Module 匯出，請用 <script type="module"> 載入使用。

/* ----------------- 可調整區 ----------------- */
// 你的 Cloudflare Worker「儲存 API」端點（POST）
export const WORKER_ENDPOINT =
  "https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/save";

// GitHub 讀檔（用 Contents API 直接取 raw）
const GH_OWNER  = "Hades1225-design";
const GH_REPO   = "HadesEidolon";
const GH_BRANCH = "main";

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

/** 讀取 data.json（或 ?file 指定的檔案）→ 回傳 JS 資料 */
export async function fetchDataJSON() {
  const path = getFileParam();
  const url =
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURIComponent(path)}?ref=${GH_BRANCH}&ts=${Date.now()}`;

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
    console.error("JSON 原文：", text);
    throw new Error("JSON 解析失敗");
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
    path,                                // 例如 public/data.json 或 public/mikey465.json
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
    // Worker 會把 GitHub 的錯誤包成 JSON 回來
    let detail = text;
    try { detail = JSON.parse(text); } catch {}
    const msg = typeof detail === "string" ? detail : JSON.stringify(detail);
    throw new Error(`Load failed（HTTP ${res.status}） ${msg}`);
  }

  // optional：回傳結果需要的人可在這裡 parse
  // const result = JSON.parse(text);
}

/** 取得目前檔案在 GitHub 的最後 commit 時間（ISO字串或 null） */
export async function fetchLastCommitTime() {
  const path = getFileParam();
  const url =
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/commits?path=${encodeURIComponent(path)}&page=1&per_page=1`;
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
export function goHomeAfterSave(target = "../../index.html") {
  location.href = urlWithFile(target);
}

/** 工具：限制輸入為 0-9（可搭配 time 編輯器） */
export function onlyDigits(str) {
  return String(str || "").replace(/\D+/g, "");
}