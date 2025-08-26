/* ===== 設定 ===== */
const API_URL     = "https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/save"; // ← 換成你的 Worker URL
const TARGET_PATH = "public/data.json";
const DATA_URL    = "/HadesEidolon/public/data.json"; // 固定 GitHub Pages 路徑

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
    $meta.textContent = `已載入（${new Date().toLocaleString()}） · ${DATA_URL}`;
  }catch(e){
    rows = [];
    render();
    if(manual) alert("讀取失敗：" + e.message);
    $meta.textContent = `讀取失敗：${e.message}`;
    console.error("載入錯誤：", e);
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

    // 因為隱藏時間，順序改為：編號 → 名字 → 新增 → 刪除
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
    message: "chore: update data.json (names editor hide time)"
  };
  try{
    const res = await fetch(API_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const out = await res.json().catch(()=> ({}));
    if(!res.ok) throw new Error(out.github_raw || out.error || out.detail || 'unknown');
    alert("✅ 已儲存！" + (out.commit? " commit: "+out.commit:""));
    $meta.textContent = `已儲存（${new Date().toLocaleString()}）`;
  }catch(e){
    alert("❌ 儲存失敗：" + e.message);
  }
}
