/* ===== 設定 ===== */
const API_URL     = "https://<你的-worker>.workers.dev/api/save"; // ← 換成你的 Worker URL
const TARGET_PATH = "public/data.json";
const DATA_URL    = "../../public/data.json"; // 與 index.html 的相對路徑

/* ===== 狀態：rows = [ [name, hhmm|null], ... ] ===== */
let rows = [];

/* ===== DOM ===== */
const $list = document.getElementById('list');
const $meta = document.getElementById('meta');

document.getElementById('add').onclick       = () => { rows.push(["", null]); render(true); };
document.getElementById('alphasort').onclick = () => { rows.sort((a,b)=>String(a[0]).localeCompare(String(b[0]))); render(); };
document.getElementById('reload').onclick    = () => init(true);
document.getElementById('save').onclick      = saveRemote;

/* ===== 啟動 ===== */
init(false);

async function init(manual){
  try{
    const r = await fetch(DATA_URL + "?t=" + Date.now(), { cache: "no-store" });
    if(!r.ok) throw new Error("HTTP " + r.status);
    const arr = JSON.parse(await r.text());
    rows = normalize(arr);
    render();
    $meta.textContent = `已載入（${new Date().toLocaleString()}）`;
  }catch(e){
    rows = [];
    render();
    if(manual) alert("讀取失敗：" + e.message);
    $meta.textContent = `尚未載入 · ${new Date().toLocaleTimeString()}`;
  }
}

/* 任何舊格式 → 轉成 [name, hhmm|null] */
function normalize(arr){
  if(!Array.isArray(arr)) return [];
  return arr.map(item=>{
    if (Array.isArray(item)) {
      const name = String(item[0] ?? '');
      const time = validHHmm(item[1]) ? item[1] : null;
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

function render(focusLast=false){
  $list.innerHTML = '';
  rows.forEach((row, i)=>{
    const div = document.createElement('div');
    div.className = 'row'; 
    div.draggable = true;

    // drag reorder
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

    const idx  = document.createElement('span'); idx.className='idx';  idx.textContent = i+1;

    const name = document.createElement('input'); name.className='name'; name.value = row[0];
    name.oninput = () => { row[0] = name.value; }; // 只改名字

    const del  = document.createElement('button'); del.className='del'; del.textContent='刪除';
    del.onclick = () => { rows.splice(i,1); render(); };

    div.append(idx, name, del);
    $list.appendChild(div);
  });

  if(focusLast && $list.lastElementChild){
    $list.lastElementChild.querySelector('.name')?.focus();
  }
}

function mkGhost(el){ const g=document.createElement('div'); g.className='ghost'; el.parentNode.insertBefore(g, el.nextSibling); return g; }

function validHHmm(v){
  if(typeof v !== 'string') return false;
  if(!/^\d{4}$/.test(v)) return false;
  const hh = +v.slice(0,2), mm = +v.slice(2,4);
  return hh>=0 && hh<=23 && mm>=0 && mm<=59;
}

async function saveRemote(){
  const payload = {
    path: TARGET_PATH,
    content: JSON.stringify(rows, null, 2),
    message: "chore: update data.json (names only)"
  };
  try{
    const res = await fetch(API_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
    const out = await res.json().catch(()=> ({}));
    if(!res.ok) throw new Error(out.github_raw || out.error || out.detail || 'unknown');
    alert("✅ 已儲存！" + (out.commit? " commit: "+out.commit:""));
  }catch(e){ alert("❌ 儲存失敗：" + e.message); }
}
