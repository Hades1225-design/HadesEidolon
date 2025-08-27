// site/reorder/common.js
// ---- GitHub 讀檔設定 ----
export const GH_OWNER  = "Hades1225-design";
export const GH_REPO   = "HadesEidolon";
export const GH_BRANCH = "main";

// 你的寫入 API（Worker）
export const WORKER_ENDPOINT = "https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/save"; // ←換成你的實際 URL

// （可選）DEMO 模式：?demo=1 時不寫遠端
export const DEMO_MODE = (() => {
  try{ return new URL(location.href).searchParams.has('demo'); }catch{ return false; }
})();

/* ---------------------------------------------
 *  檔案目標解析
 *  優先序：URL ?file=xxx.json  >  window.DATA_FILE  > 預設 public/data.json
 *  限制：只允許 public/ 之下的 .json；字元白名單（避免路徑跳脫）
 * --------------------------------------------*/
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
  // 規範化
  file = String(file || '').trim();
  if(!file.startsWith('public/')) file = 'public/' + file.replace(/^\/+/, '');
  if(!file.endsWith('.json')) file = file + '.json';
  if(!SAFE_NAME_RE.test(file)) throw new Error('檔名含非法字元');
  return file;
}

export function currentFileLabel(){
  try{
    const p = resolveDataPath();
    return p.replace(/^public\//,'');
  }catch{ return 'data.json'; }
}

/* ------------------- 讀取（GitHub Contents API） ------------------- */
export async function fetchDataJSON(){
  const path = resolveDataPath();
  const url  = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURIComponent(path)}?ref=${GH_BRANCH}&ts=${Date.now()}`;

  const res = await fetch(url, {
    headers: { "Accept": "application/vnd.github.v3.raw" },
    cache: "no-store"
  });
  if(!res.ok) throw new Error(`HTTP ${res.status}（讀取 ${path} 失敗）`);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch(e){ console.error(`${path} 內容：`, text); throw new Error("JSON 解析失敗"); }
}

/* ------------------- 儲存（呼叫你的 Worker） ------------------- */
export async function saveDataJSON(data, commitMsg = "update data.json [skip ci]"){
  const path = resolveDataPath();

  if (DEMO_MODE){
    console.warn(`[DEMO] 攔截儲存到 ${path}：`, data);
    alert(`DEMO 模式：不會真的寫入遠端。\n目標檔案：${path}`);
    return { ok:true, demo:true };
  }

  // 乾淨輸出：陣列/物件 → pretty JSON；字串就原樣
  const content = (typeof data === 'string') ? data : JSON.stringify(data, null, 2);

  const r = await fetch(WORKER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // 若你的 Worker 有用 Cookie 驗證，建議開啟：
    credentials: 'include',
    body: JSON.stringify({
      path,                 // ← 這裡就把正確檔案帶給 Worker
      content,
      message: commitMsg.includes('[skip ci]') ? commitMsg : (commitMsg + ' [skip ci]')
    })
  });

  if(!r.ok){
    const t = await r.text().catch(()=> '');
    throw new Error(`寫入失敗：HTTP ${r.status} ${t||''}`);
  }
  return r.json();
}

/* ------------------- 讀取最後更新時間（Commit） ------------------- */
export async function fetchLastCommitTime(){
  const path = resolveDataPath();
  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/commits?path=${encodeURIComponent(path)}&page=1&per_page=1`;
  const r = await fetch(url, { cache:'no-store' });
  if(!r.ok) throw new Error(`HTTP ${r.status}（讀取 commit 失敗）`);
  const commits = await r.json();
  return Array.isArray(commits) && commits.length ? commits[0].commit.committer.date : null;
}
