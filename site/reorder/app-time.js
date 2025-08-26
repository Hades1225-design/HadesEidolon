/* ===== 設定 ===== */
const API_URL     = "https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/save"; // ← 換成你的 Worker URL
const TARGET_PATH = "public/data.json";
const DATA_URL    = "/HadesEidolon/public/data.json"; // 寫死 GitHub Pages 路徑

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

  const inputs = []; // 收集所有時間輸入框

  rows.forEach((row, i)=>{
    const tr = document.createElement('tr');

    // index
    const tdIdx = document.createElement('td');
    tdIdx.textContent = i+1;

    // name (readonly)
    const tdName = document.createElement('td');
    const name = document.createElement('input');
    name.type = 'text';
    name.className='w-name';
    name.value = row[0];
    name.readOnly = true;
    name.style.background = '#f8fafc';
    tdName.appendChild(name);

    // time (HHmm)
    const tdTime = document.createElement('td');
    const time = document.createElement('input');
    time.type = 'tel';
    time.inputMode = 'numeric';
    time.maxLength = 4;
    time.placeholder = 'HHmm';
    time.className='w-time';
    time.value = row[1] || '';

    // 更新時間資料 & 自動跳下一格
    time.addEventListener('input', () => {
      const v = time.value.replace(/\D/g,'');
      time.value = v;

      if (v.length === 4 && validHHmm(v)) {
        rows[i][1] = v;
        // 自動跳到下一個時間欄位
        const nextInput = inputs[i + 1];
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      } else if (v === '') {
        rows[i][1] = null;
      }
    });

    // 允許使用 Enter 跳下一格
    time.addEventListener('keydown', (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const nextInput = inputs[i + 1];
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
    });

    tdTime.appendChild(time);

    // 無 actions（刪掉「現在」與「清空」）
    const tdEmpty = document.createElement('td');
    tr.append(tdIdx, tdName, tdTime, tdEmpty);

    $tbody.appendChild(tr);
    inputs.push(time);
  });
}

/* ------------------ 工具 ------------------ */
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
    message: "chore: update data.json (time editor, auto-jump enabled)"
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

