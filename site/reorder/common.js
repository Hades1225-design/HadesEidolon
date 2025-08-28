// ===== site/reorder/common.js =====
// 共用：讀寫 GitHub JSON（支援多檔）、保留 ?file 參數、回首頁工具。
// 已優化：會依子站自動推斷預設 JSON 路徑。

/* ----------------- 可調整區 ----------------- */
// 你的 Cloudflare Worker「儲存 API」端點（POST）
export const WORKER_ENDPOINT =
  "https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/save";

/* ------------------------------------------- */

/** 讀目前網址上的 ?file 參數（動態依子站推斷預設路徑） */
export function getFileParam() {
  const qs = new URLSearchParams(location.search);
  let f = (qs.get("file") || "").trim();

  // 依目前所在路徑 /site/<slug>/ 推斷預設 JSON
  // 例：/site/reorder/... → 預設 public/reorder/data.json
  const pathParts = location.pathname.split("/").filter(Boolean);
  const siteIdx = pathParts.findIndex(p => p === "site");
  const slug = (siteIdx >= 0 && pathParts[siteIdx + 1]) ? pathParts[siteIdx + 1] : null;
  const DEFAULT_PATH = slug ? `public/${slug}/data.json` : "public/data.json";

  // 沒帶 ?file → 用預設
  if (!f) return DEFAULT_PATH;

  // 1) 僅檔名（?file=data.json）
  //    → 映射到 public/<slug>/<檔名>；若無 slug 則 public/<檔名>
  if (/^[A-Za-z0-9._\-]+\.json$/.test(f)) {
    f = slug ? `public/${slug}/${f.replace(/^\/+/, "")}` : `public/${f.replace(/^\/+/, "")}`;
  }
  // 2) 含子路徑但沒有 public/ 前綴（例：?file=reorder/bosslist.json）
  else if (/^[A-Za-z0-9._\-\/]+\.json$/.test(f) && !/^public\//.test(f)) {
    f = "public/" + f.replace(/^\/+/, "");
  }

  // 最終安全檢查（僅允許 public/ 下的 .json）
  if (!/^public\/[A-Za-z0-9._\-\/]+\.json$/.test(f)) {
    f = DEFAULT_PATH;
  }
  return f;
}

/** 目前檔名（顯示用 Label） */
export function currentFileLabel() {
  const p = getFileParam();
  return p.replace(/^public\//, "");
}

  /** 讀取 JSON（或 ?file 指定的檔案）→ 回傳 JS 資料 */
  export async function fetchDataJSON() {
    const path = getFileParam();
    // 依目前路徑自動推斷 repo base（/HadesEidolon/ 或 /）
    const parts = location.pathname.split('/').filter(Boolean);
    const repoBase = parts.length > 0 ? `/${parts[0]}/` : '/';
    const url = `${repoBase}${path}?ts=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    const res = await fetch(url, { cache: "no-store" });
  
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
    path,                                // 例如 public/reorder/data.json
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