/* ===== 設定 ===== */
const API_URL     = "https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/save"; // ← 換成你的 Worker URL
const TARGET_PATH = "public/data.json";
const DATA_URL    = "/HadesEidolon/public/data.json"; // 固定 GitHub Pages 路徑

/* ===== 狀態：rows = [ [name, hhmm|null], ... ] ===== */
let rows = [];

/* ===== DOM ===== */
const $tbody = document.getElementById('tbody');
const $meta  = document.getElementById('meta');

document.getElementById('reload').onclick = ()=> init(true);
document.getElementById('save').onclick   = saveRemote;

/* ===== 啟動 ===== */
init(false);

/* ------------------ 載入 ------------------ */
async function init(manual){
  try{
    const r = await fetch(DATA_URL + "?t=" + Date.now(), { cache: "no-store" });
    if(!r.ok) throw new Error(`HTTP ${r.status}（讀取 ${DATA_URL} 失敗）`);
    const arr = JSON.parse(await r.text());
    rows = normalize(arr);
    render();
    $meta.textContent = `已載入（${new Date().toLocaleString()}）`;
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

/* ------------------ Render ------------------ */
function render(){
  $tbody.innerHTML = '';
  const inputs = [];

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
    time.maxLength = 5;           // 顯示含冒號要最多 5
    time.placeholder = 'HHmm';
    time.className='w-time';
    time.value = row[1] ? toDisplay(row[1]) : '';

    // 即時輸入：逐位限制 + 顯示冒號
    time.addEventListener('input', () => {
      let digits = onlyDigits(time.value);
      digits = clampPerDigit(digits).slice(0,4); // 逐位限制 + 最多4位
      time.value = toDisplay(digits);            // 顯示成 HH:mm 或部分顯示

      if (digits.length === 4 && validHHmm(digits)) {
        rows[i][1] = digits;
        // 自動跳到下一格
        const next = inputs[i + 1];
        if (next) { next.focus(); next.select(); }
      } else if (digits === '') {
        rows[i][1] = null;
      }
    });

    // 失焦：往前補 0 到4位，再顯示 HH:mm
    const finalize = () => {
      let digits = onlyDigits(time.value);
      if (digits.length > 0 && digits.length < 4) {
        digits = digits.padStart(4, '0'); // 往前補 0
      }
      digits = clampPerDigit(digits).slice(0,4);
      time.value = toDisplay(digits);

      if (validHHmm(digits)) {
        rows[i][1] = digits;
      } else if (digits === '') {
        rows[i][1] = null;
        time.value = '';
      }
    };

    time.addEventListener('blur', finalize);

    // Enter：finalize 並跳下一格
    time.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finalize();
        const next = inputs[i + 1];
        if (next) { next.focus(); next.select(); }
      }
    });

    tdTime.appendChild(time);

    // 空白（已移除現在/清空）
    const tdEmpty = document.createElement('td');

    tr.append(tdIdx, tdName, tdTime, tdEmpty);
    $tbody.appendChild(tr);
    inputs.push(time);
  });
}

/* ------------------ 工具 ------------------ */
function onlyDigits(s){ return String(s ?? '').replace(/\D/g,''); }

/* 顯示用：把 "HHmm" → "HH:mm"；輸入中（<3位）則部分顯示 */
function toDisplay(digits){
  const d = onlyDigits(digits);
  if (d.length <= 2) return d;            // H / HH
  return d.slice(0,2) + ':' + d.slice(2); // HH:mm（或 HH:m）
}

/* 逐位限制：
   d0: 0-2
   d1: 若 d0=2 → 0-3，否則 0-9
   d2: 0-5
   d3: 0-9
*/
function clampPerDigit(v){
  const d = onlyDigits(v).split('');
  if (d[0]) d[0] = String(Math.min(+d[0], 2));
  if (d[1]) d[1] = String(Math.min(+d[1], (d[0] === '2' ? 3 : 9)));
  if (d[2]) d[2] = String(Math.min(+d[2], 5));
  if (d[3]) d[3] = String(Math.min(+d[3], 9));
  return d.join('');
}

function validHHmm(v){
  if(typeof v !== 'string') return false;
  const d = onlyDigits(v);
  if(!/^\d{4}$/.test(d)) return false;
  const hh = +d.slice(0,2), mm = +d.slice(2,4);
  return hh>=0 && hh<=23 && mm>=0 && mm<=59;
}

/* ------------------ 儲存 ------------------ */
async function saveRemote(){
  const payload = {
    path: TARGET_PATH,
    content: JSON.stringify(rows, null, 2),
    message: "chore: update data.json (time editor, display HH:mm but store HHmm)"
  };
  try{
    const res = await fetch(API_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const outText = await res.text();
    let out; try { out = JSON.parse(outText); } catch { out = { raw: outText }; }
    if(!res.ok) throw new Error(out.github_raw || out.error || out.detail || 'unknown');
    alert(`✅ 已儲存成功！${out.commit ? ' commit: '+out.commit : ''}`);
    $meta.textContent = `已儲存（${new Date().toLocaleString()}）`;
  }catch(e){
    alert("❌ 儲存失敗：" + e.message);
  }
}


