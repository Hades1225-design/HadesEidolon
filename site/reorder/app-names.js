/* ===== 設定 ===== */
/* === GitHub 讀檔設定（方案2：Contents API 直讀） === */
const GH_OWNER  = "Hades1225-design";
const GH_REPO   = "HadesEidolon";
const GH_BRANCH = "main";

async function fetchDataJSON(){
  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/public/data.json?ref=${GH_BRANCH}&ts=${Date.now()}`;
  const res = await fetch(url, {
    headers: { "Accept": "application/vnd.github.v3.raw" }, // 直接拿純文字
    cache: "no-store"
});
if(!res.ok) throw new Error(`HTTP ${res.status}（讀取 GitHub Contents 失敗）`);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch(e){ console.error("data.json 內容：", text); throw new Error("JSON 解析失敗"); }
}

const API_URL     = "https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/save"; // ← 換成你的 Worker URL
const TARGET_PATH = "public/data.json";
const DATA_URL    = "/HadesEidolon/public/data.json"; // 固定 GitHub Pages 路徑
const GITHUB_API  = "https://api.github.com/repos/Hades1225-design/HadesEidolon/commits?path=public/data.json&page=1&per_page=1";

/* ===== 狀態：rows = [ [name, hhmm|null], ... ] ===== */
let rows = [];

/* ===== DOM ===== */
const $list = document.getElementById('list');
const $meta = document.getElementById('meta');

document.getElementById('reload').onclick = () => init(true);
document.getElementById('save').onclick   = saveRemote;

/* ===== 啟動 ===== */
init(false);

/* ------------------ 載入 ------------------ */
async function init(manual){
  try{
    const res = await fetch(DATA_URL + "?t=" + Date.now(), { cache: "no-store" });
    if(!res.ok) throw new Error(`HTTP ${res.status}（讀取 ${DATA_URL} 失敗）`);
    const text = await res.text();
    let arr;
    try { arr = JSON.parse(text); }
    catch (e) {
      console.error("JSON 解析失敗：原始內容：", text);
      throw new Error("JSON 解析失敗：請檢查 public/data.json 是否為有效 JSON 陣列");
    }
    rows = normalize(arr);
    render();
    await updateMetaTime();
  }catch(e){
    rows = [];
    render();
    if(manual) alert("讀取失敗：" + e.message);
    $meta.textContent = `讀取失敗：${e.message}`;
    console.error("載入錯誤：", e);
  }
}

/* 從 GitHub 取得 data.json 的最後修改時間 */
async function updateMetaTime(){
  try {
    const res = await fetch(GITHUB_API, { cache: "no-store" });
    if(!res.ok) throw new Error(`HTTP ${res.status}（讀取 GitHub commit 失敗）`);
    const commits = await res.json();
    if (Array.isArray(commits) && commits.length > 0) {
      const date = commits[0].commit.committer.date;
      const local = new Date(date).toLocaleString();
      $meta.textContent = `最後更新：${local}`;
    } else {
      $meta.textContent = `最後更新時間未知`;
    }
  } catch(e) {
    console.error("讀取最後更新時間失敗：", e);
    $meta.textContent = `最後更新時間讀取失敗`;
  }
}

/* 舊格式 → 轉成 [name, hhmm|null] */
function normalize(arr){
  if(!Array.isArray(arr)) return [];
  return arr.map(item=>{
    if (Array.isArray(item)) {
      const name = String(item[0] ?? '');
      const time = validHHmm(item[1]) ? String(item[1]) : null;
      return [name, time];
    }
    if (typeof item === 'string') return [item, null];
    if (item && typeof item === 'object') {
      const name = String(item.名字 ?? item.name ?? '');
      const t = item.時間 ?? item.time;
      const time = validHHmm(t) ? String(t) : null;
      return [name, time];
    }
    return ['', null];
  });
}

/* ------------------ 介面 ------------------ */
function render(){
  $list.innerHTML = '';

  rows.forEach((row, i)=>{
    const div = document.createElement('div');
    div.className = 'row';
    div.draggable = true;

    // 拖曳排序
    div.addEventListener('dragstart', (e)=>{ e.dataTransfer.setData('text/plain', String(i)); div._ghost = mkGhost(div); });
    div.addEventListener('dragend', ()=>{ div._ghost?.remove(); });
    div.addEventListener('dragover', (e)=>{
      e.preventDefault();
      const ghost = document.querySelector('.ghost');
      const before = (e.clientY - div.getBoundingClientRect().top) < div.offsetHeight/2;
      if(ghost){ before? div.parentNode.insertBefore(ghost, div) : div.parentNode.insertBefore(ghost, div.nextSibling); }
    });
    div.addEventListener('drop', (e)=>{
      e.preventDefault();
      const from = Number(e.dataTransfer.getData('text/plain'));
      const ghost = document.querySelector('.ghost');
      const to = Array.from($list.children).indexOf(ghost);
      const [m] = rows.splice(from,1); rows.splice(to,0,m); render();
    });

    // 編號
    const idx  = document.createElement('span');
    idx.className='idx';
    idx.textContent = i+1;

    // 名字（可編輯）
    const name = document.createElement('input');
    name.className='name';
    name.value = row[0];
    name.oninput = () => { row[0] = name.value; };

    // 新增（在此列下方插入空白項）
    const addBtn = document.createElement('button');
    addBtn.textContent = '新增';
    addBtn.onclick = () => {
      const newRow = ["", null];
      rows.splice(i+1, 0, newRow);
      render();
      // 自動聚焦剛插入的那一列名字
      const inputs = $list.querySelectorAll('.name');
      const target = inputs[i+1];
      target?.focus();
    };

    // 刪除
    const del  = document.createElement('button');
    del.className='del';
    del.textContent='刪除';
    del.onclick = () => { rows.splice(i,1); render(); };

    // 顯示順序：編號 → 名字 → 新增 → 刪除
    div.append(idx, name, addBtn, del);
    $list.appendChild(div);
  });
}

function mkGhost(el){
  const g=document.createElement('div');
  g.className='ghost';
  el.parentNode.insertBefore(g, el.nextSibling);
  return g;
}

/* ------------------ 驗證 ------------------ */
function validHHmm(v){
  if(typeof v !== 'string') return false;
  if(!/^\d{4}$/.test(v)) return false;
  const hh = +v.slice(0,2), mm = +v.slice(2,4);
  return hh>=0 && hh<=23 && mm>=0 && mm<=59;
}

/* ------------------ 儲存 ------------------ */
async function saveRemote(){
  const payload = {
    path: TARGET_PATH,
    content: JSON.stringify(rows, null, 2),
    message: "chore: update data.json (names editor show last modified)"
  };
  try{
    const res = await fetch(API_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const out = await res.json().catch(()=> ({}));
    if(!res.ok) throw new Error(out.github_raw || out.error || out.detail || 'unknown');
    alert("✅ 已儲存成功！");
    await updateMetaTime(); // 儲存後重新讀取最後更新時間
  }catch(e){
    alert("❌ 儲存失敗：" + e.message);
  }
}
