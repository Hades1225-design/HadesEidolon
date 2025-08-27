// site/reorder/common.js
// === GitHub 讀檔設定 ===
export const GH_OWNER  = "Hades1225-design";
export const GH_REPO   = "HadesEidolon";
export const GH_BRANCH = "main";

// 你的寫入 API（Cloudflare Worker /save）
export const WORKER_ENDPOINT = "https://green-hat-b921.b5cp686csv.workers.dev/api/save"; // ←換成實際 URL

// DEMO：網址帶 ?demo=1 時，不寫遠端
export const DEMO_MODE = (() => {
  try{ return new URL(location.href).searchParams.has('demo'); }catch{ return false; }
})();

/* ---------- 目標檔案解析 ----------
 * 優先：URL ?file=xxx.json > window.DATA_FILE > public/data.json
 * 只允許 public/ 之下 .json，限制字元避免跳脫
 -----------------------------------*/
const SAFE_NAME_RE = /^[A-Za-z0-9._\-\/]+$/;
export function resolveDataPath(){
  let file = "public/data.json";
  try{
    const u = new URL(location.href);
    const q = u.searchParams.get('file');
    if(q) file = q;
    else if(typeof window !== 'undefined' && typeof window.DATA_FILE === 'string'){
      file = window.DATA_FILE;
    }
  }catch{}
  file = String(file || '').trim();
  if(!file.startsWith('public/')) file = 'public/' + file.replace(/^\/+/, '');
  if(!file.endsWith('.json')) file = file + '.json';
  if(!SAFE_NAME_RE.test(file)) throw new Error('檔名含非法字元');
  return file;
}
export function currentFileLabel(){
  try{ return resolveDataPath().replace(/^public\//,''); }
  catch{ return 'data.json'; }
}

/* ---------- 讀取（GitHub Contents API） ---------- */
export async function fetchDataJSON(){
  const path = resolveDataPath();
  const url  = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURIComponent(path)}?ref=${GH_BRANCH}&ts=${Date.now()}`;
  const r = await fetch(url, { headers:{ "Accept":"application/vnd.github.v3.raw" }, cache:"no-store" });
  if(!r.ok) throw new Error(`HTTP ${r.status}（讀取 ${path} 失敗）`);
  const txt = await r.text();
  try { return JSON.parse(txt); }
  catch(e){ console.error(`${path} 內容：`, txt); throw new Error("JSON 解析失敗"); }
}

/* ---------- 儲存（呼叫 Worker） ---------- */
export async function saveDataJSON(data, commitMsg = "update data [skip ci]"){
  const path = resolveDataPath();
  if (DEMO_MODE){
    console.warn(`[DEMO] 攔截儲存到 ${path}`, data);
    alert(`DEMO 模式：不寫入遠端\n檔案：${path}`);
    return { ok:true, demo:true };
  }
  const content = (typeof data === 'string') ? data : JSON.stringify(data, null, 2);
  const res = await fetch(WORKER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',                // 若 Worker 用 Cookie 驗證，務必帶上
    body: JSON.stringify({
      path,                                // ★ 告訴 Worker 要寫哪個檔
      content,
      message: /\[skip ci\]/i.test(commitMsg) ? commitMsg : (commitMsg + ' [skip ci]')
    })
  });
  if(!res.ok){
    const t = await res.text().catch(()=> '');
    throw new Error(`Load failed（HTTP ${res.status}） ${t}`);
  }
  return res.json();
}

/* ---------- 最後更新時間（commit） ---------- */
export async function fetchLastCommitTime(){
  const path = resolveDataPath();
  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/commits?path=${encodeURIComponent(path)}&page=1&per_page=1`;
  const r = await fetch(url, { cache:'no-store' });
  if(!r.ok) throw new Error(`HTTP ${r.status}（讀取 commit 失敗）`);
  const commits = await r.json();
  return Array.isArray(commits) && commits.length ? commits[0].commit.committer.date : null;
}