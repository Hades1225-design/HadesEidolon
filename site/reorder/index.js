/* === GitHub 讀檔設定（方案2：Contents API 直讀） === */
const GH_OWNER  = "Hades1225-design";
const GH_REPO   = "HadesEidolon";
const GH_BRANCH = "main";

async function fetchDataJSON(){
  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/public/data.json?ref=${GH_BRANCH}&ts=${Date.now()}`;
  const res = await fetch(url, {
    headers: { "Accept": "application/vnd.github.v3.raw" },
    cache: "no-store"
  });
  if(!res.ok) throw new Error(`HTTP ${res.status}（讀取 GitHub Contents 失敗）`);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch(e){ console.error("data.json 內容：", text); throw new Error("JSON 解析失敗"); }
}

const GITHUB_API = "https://api.github.com/repos/Hades1225-design/HadesEidolon/commits?path=public/data.json&page=1&per_page=1";
const WRAP_CUTOFF = "0559"; // 00:00–05:59 視為隔日清晨

const $list = document.getElementById('list');
const $meta = document.getElementById('meta');
document.getElementById('reload').onclick = () => init(true);
document.getElementById('download-cards').onclick = downloadPNG;
document.getElementById('download-table').onclick = downloadPNG_Table;

let items = []; // [ [name, hhmm|null], ... ]

init(false);

async function init(manual){
  try{
    const arr = await fetchDataJSON();
    items = normalize(arr);

    // 以距離現在分鐘差排序
    items.sort((a,b)=>{
      const da = diffFromNow(a[1]);
      const db = diffFromNow(b[1]);
      if(a[1] === null && b[1] === null) return 0;
      if(a[1] === null) return -1;
      if(b[1] === null) return 1;
      return da - db;
    });

    render();
    await updateMetaTime();
  }catch(e){
    items = [];
    render();
    if(manual) alert("讀取失敗：" + e.message);
    $meta.textContent = `讀取失敗：${e.message}`;
    console.error(e);
  }
}

function normalize(arr){
  if(!Array.isArray(arr)) return [];
  return arr.map(item=>{
    if(Array.isArray(item)){
      const name = String(item[0] ?? '');
      const t = item[1];
      const time = (typeof t === 'string' && /^\d{4}$/.test(t)) ? t : null;
      return [name, time];
    }
    if(typeof item === 'string') return [item, null];
    if(item && typeof item === 'object'){
      const name = String(item.名字 ?? item.name ?? '');
      const t = item.時間 ?? item.time;
      const time = (typeof t === 'string' && /^\d{4}$/.test(t)) ? t : null;
      return [name, time];
    }
    return ['', null];
  });
}

function diffFromNow(hhmm){
  if(hhmm === null) return -1e9;
  const now = nowMinutes();
  const tm  = HHmmToMinutes(hhmm);
  const raw = tm - now;
  const isEarlyMorning = hhmm <= WRAP_CUTOFF;
  if(raw < 0 && isEarlyMorning){
    return raw + 1440;
  }
  return raw;
}

function render(){
  $list.innerHTML = '';
  const nowHHmm = hhmmNow();
  const nextIdx = findNextClosestIndex(items, nowHHmm);

  items.forEach(([name, t], idx)=>{
    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('div');
    title.className = 'name';
    title.textContent = name || '—';

    const sub = document.createElement('div');
    sub.className = 'time';

    if(t === null){
      sub.textContent = '已重生';
      card.classList.add('status-green');
    }else{
      sub.textContent = toDisplay(t);
      const raw = HHmmToMinutes(t) - nowMinutes();
      const isEarlyMorning = t <= WRAP_CUTOFF;
      if(raw < 0 && !isEarlyMorning){
        card.classList.add('status-red');
      }else if(idx === nextIdx){
        card.classList.add('status-yellow');
      }
    }

    card.append(title, sub);
    $list.appendChild(card);
  });
}

function hhmmNow(){
  const d = new Date();
  return String(d.getHours()).padStart(2,'0') + String(d.getMinutes()).padStart(2,'0');
}
function nowMinutes(){
  const d = new Date();
  return d.getHours()*60 + d.getMinutes();
}
function HHmmToMinutes(hhmm){
  const h = +hhmm.slice(0,2), m = +hhmm.slice(2,4);
  return h*60 + m;
}
function toDisplay(hhmm){
  return hhmm.slice(0,2) + ':' + hhmm.slice(2,4);
}
function findNextClosestIndex(arr, nowHHmm){
  const now = HHmmToMinutes(nowHHmm);
  let bestIdx = -1, bestDelta = Infinity;
  arr.forEach(([_, t], idx)=>{
    if(typeof t === 'string' && /^\d{4}$/.test(t)){
      const tm = HHmmToMinutes(t);
      const delta = (tm - now + 1440) % 1440;
      if (delta > 0 && delta < bestDelta){
        bestDelta = delta;
        bestIdx = idx;
      }
    }
  });
  return bestIdx;
}

/* ========= 匯出 PNG（卡片：單欄直向顯示） ========= */
/* ========= 匯出 PNG（卡片：直向排序 + 高度限制） ========= */
/* ========= 匯出 PNG（卡片：直向排序，限制高度，超過往右側） ========= */
async function downloadPNG(){
  if (!window.html2canvas) {
    alert("圖片匯出工具載入中，請再試一次。");
    return;
  }

  // 1) 準備資料與尺寸
  const cards = Array.from(document.querySelectorAll('#list .card'));
  if (!cards.length) return;

  const CARD_W = 185;
  const CARD_H = 30;
  const GAP    = 5;
  const MAX_HEIGHT = 400;               // ← 想要的最大欄高（px）可自行調整

  // 一欄可以放幾張（直向）
  const perCol = Math.max(1, Math.floor((MAX_HEIGHT + GAP) / (CARD_H + GAP)));
  const totalCols = Math.ceil(cards.length / perCol);

  // 2) 建立螢幕外容器，用 grid 直向擺放
  const wrap = document.createElement('div');
  wrap.className = 'export-grid-dynamic';
  wrap.style.gridTemplateColumns = `repeat(${totalCols}, ${CARD_W}px)`;
  wrap.style.gridAutoRows = `${CARD_H}px`;
  document.body.appendChild(wrap);

  // 3) 依「直向優先」把卡片 clone 進容器，並指定 row/col
  cards.forEach((card, i) => {
    const clone = card.cloneNode(true);
    const col = Math.floor(i / perCol);       // 第幾欄（0-based）
    const row = (i % perCol) + 1;             // 第幾列（1-based，grid-row 需要從 1 開始）
    clone.style.gridColumn = (col + 1);
    clone.style.gridRow = row;
    wrap.appendChild(clone);
  });

  // 4) 等字型就緒、截圖
  document.body.classList.add('exporting');   // 白底
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch {} }

  const canvas = await html2canvas(wrap, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    windowWidth: wrap.scrollWidth,
    windowHeight: wrap.scrollHeight
  });

  triggerDownload(canvas.toDataURL('image/png'), `cards_vertical_${stamp()}.png`);

  // 5) 清理
  document.body.removeChild(wrap);
  document.body.classList.remove('exporting');
}

/* ========= 匯出 PNG（表格） ========= */
async function downloadPNG_Table(){
  if (!window.html2canvas){ alert("圖片匯出工具載入中，請再試一次。"); return; }

  const nowHHmm = hhmmNow();
  const nextIdx = findNextClosestIndex(items, nowHHmm);

  const wrap = document.createElement('div');
  wrap.className = 'export-table-wrap';
  const table = document.createElement('table');
  table.className = 'export-table';

  const perRow = 5;
  const rowsCount = Math.ceil(items.length / perRow);

  for(let r=0; r<rowsCount; r++){
    const tr = document.createElement('tr');
    for(let c=0; c<perRow; c++){
      const idx = r*perRow + c;
      const td  = document.createElement('td');

      if(idx < items.length){
        const [name, t] = items[idx] || ["", null];

        const nSpan = document.createElement('span');
        nSpan.className = 'cell-name';
        nSpan.textContent = name || '—';

        const tSpan = document.createElement('span');
        tSpan.className = 'cell-time';
        if(t === null){
          tSpan.textContent = '已重生';
          td.classList.add('export-green');
        }else{
          tSpan.textContent = toDisplay(t);
          const raw = HHmmToMinutes(t) - nowMinutes();
          const isEarlyMorning = t <= WRAP_CUTOFF;

          if(raw < 0 && !isEarlyMorning){
            td.classList.add('export-red');
          }else if(idx === nextIdx){
            td.classList.add('export-yellow');
          }
        }

        td.append(nSpan, tSpan);
      }else{
        td.innerHTML = '&nbsp;';
      }
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  wrap.appendChild(table);
  document.body.appendChild(wrap);

  document.body.classList.add('exporting');
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch{} }

  const canvas = await html2canvas(wrap, {
    backgroundColor:'#ffffff', scale:2, useCORS:true,
    windowWidth: wrap.scrollWidth, windowHeight: wrap.scrollHeight
  });

  triggerDownload(canvas.toDataURL('image/png'), `table_${stamp()}.png`);

  document.body.removeChild(wrap);
  document.body.classList.remove('exporting');
}

function triggerDownload(url, filename){
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}
function stamp(){
  const d = new Date(), z = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}${z(d.getMonth()+1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
}

async function updateMetaTime(){
  try{
    const r = await fetch(GITHUB_API, { cache:"no-store" });
    if(!r.ok) throw new Error(`HTTP ${r.status}（讀取 GitHub commit 失敗）`);
    const commits = await r.json();
    if(Array.isArray(commits) && commits.length){
      const iso = commits[0].commit.committer.date;
      $meta.textContent = `最後更新：${new Date(iso).toLocaleString()}`;
    }else{
      $meta.textContent = `最後更新時間未知`;
    }
  }catch(e){
    $meta.textContent = `最後更新時間讀取失敗`;
    console.error(e);
  }
}
