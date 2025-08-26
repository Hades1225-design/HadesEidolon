/* ===== 設定 ===== */
const API_URL     = "https://<你的-worker>.workers.dev/api/save"; // ← 換成你的 Worker URL
const TARGET_PATH = "public/data.json";
const DATA_URL    = "../../public/data.json";

/* ===== 狀態：rows = [ [name, hhmm|null], ... ] ===== */
let rows = [];

/* ===== DOM ===== */
const $tbody = document.getElementById('tbody');
const $meta  = document.getElementById('meta');

document.getElementById('set-all-now').onclick = ()=>{ const now = hhmmNow(); rows.forEach(r=> r[1] = now); render(); };
document.getElementById('clear-all').onclick   = ()=>{ rows.forEach(r=> r[1] = null); render(); };
document.getElementById('sort-asc').onclick    = ()=>{ rows.sort(byTime(true)); render(); };
document.getElementById('sort-desc').onclick   = ()=>{ rows.sort(byTime(false)); render(); };
document.getElementById('reload').onclick      = ()=> init(true);
document.getElementById('save').onclick        = saveRemote;

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

function render(){
  $tbody.innerHTML = '';
  rows.forEach((row, i)=>{
    const tr = document.createElement('tr');

    const tdIdx = document.createElement('td'); tdIdx.textContent = i+1;

    const tdName = document.createElement('td');
    const name = document.createElement('input');
    name.type = 'text'; name.className='w-name'; name.value = row[0];
    name.readOnly = true; name.style.background = '#f8fafc';
    tdName.appendChild(name);

    const tdTime = document.createElement('td');
    const time = document.createElement('input');
    time.type = 'tel';
    time.inputMode = 'numeric';
    time.maxLength = 4;
    time.placeholder = 'HHmm';
    time.className='w-time';
    time.value = row[1] || '';
    time.oninput = () => {
      const v = time.value.replace(/\D/g,'');
      time.value = v;
      if (v.length === 4 && validHHmm(v))      rows[i][1] = v;
      else if (v === '')                        rows[i][1] = null;
    };
    tdTime.appendChild(time);

    const tdAct = document.createElement('td'); tdAct.className='actions';
    const btnNow = document.createElement('button'); btnNow.textContent='現在'; btnNow.onclick=()=>{ rows[i][1] = hhmmNow(); render(); };
    const btnClear = document.createElement('button'); btnClear.textContent='清空'; btnClear.onclick=()=>{ rows[i][1] = null; render(); };
    tdAct.append(btnNow, btnClear);

    tr.append(tdIdx, tdName, tdTime, tdAct);
    $tbody.appendChild(tr);
  });
}

/* 工具 */
function hhmmNow(){
  const d = new Date();
  return String(d.getHours()).padStart(2,'0') + String(d.getMinutes()).padStart(2,'0');
}
function validHHmm(v){
  if(typeof v !== 'string') return false;
  if(!/^\d{4}$/.test(v)) return false;
  const hh = +v.slice(0,2), mm = +v.slice(2,4);
  return hh>=0 && hh<=23 && mm>=0 && mm<=59;
}
function byTime(asc=true){
  return (a,b)=>{
    const va = a[1], vb = b[1];
    if (!va && !vb) return 0;
    if (!va) return  1;
    if (!vb) return -1;
    return asc ? va.localeCompare(vb) : vb.localeCompare(va);
  };
}

async function saveRemote(){
  const payload = {
    path: TARGET_PATH,
    content: JSON.stringify(rows, null, 2),
    message: "chore: update data.json (times HHmm)"
  };
  try{
    const res = await fetch(API_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
    const outText = await res.text();
    let out; try { out = JSON.parse(outText); } catch { out = { raw: outText }; }
    if(!res.ok) throw new Error(out.github_raw || out.error || out.detail || 'unknown');
    alert(`✅ 已儲存成功！${out.commit ? 'commit: '+out.commit : ''}`);
    $meta.textContent = `已儲存（${new Date().toLocaleString()}）`;
  }catch(e){ alert("❌ 儲存失敗：" + e.message); }
}
