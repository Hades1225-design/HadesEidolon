// ====== 基本設定 ======
export const GH_OWNER  = "Hades1225-design";
export const GH_REPO   = "HadesEidolon";
export const GH_BRANCH = "main";

// 讀檔（Contents API，永遠最新）
const CONTENTS_URL =
  `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/public/data.json?ref=${GH_BRANCH}`;

// 取得最後一次修改這個檔的 commit（顯示在 meta）
export const COMMITS_API =
  `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/commits?path=public/data.json&page=1&per_page=1`;

// ⚠️ 這裡換成你自己的 Cloudflare Worker（或其他 API）URL：
// 需支援 POST，並在後端用 GitHub Token 寫入 repo。
export const WORKER_ENDPOINT = "https://YOUR-WORKER.example.workers.dev/save";

// ====== 讀取 data.json ======
export async function fetchDataJSON() {
  const url = CONTENTS_URL + `&ts=${Date.now()}`; // 防瀏覽器快取
  const res = await fetch(url, {
    headers: { "Accept": "application/vnd.github.v3.raw" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}（讀取 data.json 失敗）`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("data.json 內容：", text);
    throw new Error("JSON 解析失敗：請檢查 data.json 格式");
  }
}

// ====== 儲存 data.json ======
// items：例如 [ ["依佛","2231"], ["Tdfhu","0930"], ... ]
export async function saveDataJSON(items) {
  // 前端無法直接寫 GitHub，需透過你的 Worker 代寫入。
  // Worker 建議接受以下 JSON payload：
  // { path: "public/data.json", content: "<檔案文字>", message: "chore: update data.json [skip ci]" }
  const payload = {
    path: "public/data.json",
    content: JSON.stringify(items, null, 2),
    message: "chore: update data.json [skip ci]", // 不觸發 CI/Pages
  };

  const res = await fetch(WORKER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}（儲存失敗）`;
    try {
      const t = await res.text();
      if (t) msg += `：${t}`;
    } catch {}
    throw new Error(msg);
  }

  // Worker 可回傳 { ok: true, commitSha: "..." } 等資訊
  try {
    return await res.json();
  } catch {
    return { ok: true };
  }
}

// ====== 讀取最後更新時間（ISO） ======
export async function fetchLastCommitISO() {
  const r = await fetch(COMMITS_API, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}（讀取 commit 失敗）`);
  const commits = await r.json();
  if (Array.isArray(commits) && commits.length) {
    return commits[0].commit?.committer?.date || null;
  }
  return null;
}
