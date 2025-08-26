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
/* ===== 設定 ===== */
const API_URL     = "https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/save"; // ← 換成你的 Worker URL
const TARGET_PATH = "public/data.json";
const DATA_URL    = "/HadesEidolon/public/data.json"; // 固定 GitHub Pages 路徑
const GITHUB_API  = "https://api.github.com/repos/Hades1225-design/HadesEidolon/commits?path=public/data.json&page=1&per_page=1";

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
    const arr = await fetchDataJSON(); // ← 改這行
    rows = normalize(arr);
    render();
    await updateMetaTime();
  }catch(e){
    rows = [];
    render();
    if(manual) alert("讀取失敗：" + e.message);
    $meta.textContent = `讀取失敗：${e.message}`;
    console.error(e);
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
    time.maxLength = 5;           // 顯示含冒號最多 5
    time.placeholder = 'HH:mm';
    time.className='w-time';
    time.value = row[1] ? toDisplay(row[1]) : '';

    // 即時輸入：逐位限制 + 顯示冒號 + 4碼自動跳下一格
    time.addEventListener('input', () => {
      let digits = onlyDigits(time.value);
      digits = clampPerDigit(digits).slice(0,4);
      time.value = toDisplay(digits);

      if (digits.length === 4 && validHHmm(digits)) {
        rows[i][1] = digits;
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
        digits = digits.padStart(4, '0'); // 往前補0
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
    message: "chore: update data.json (time editor shows last modified)"
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
    alert("✅ 已儲存成功！");
    await updateMetaTime(); // 儲存後重新取得最後更新時間
  }catch(e){
    alert("❌ 儲存失敗：" + e.message);
  }
}
