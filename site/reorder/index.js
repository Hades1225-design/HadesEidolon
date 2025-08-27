/* ========== 注入 ./common.js ========== */
import {
  fetchDataJSON, saveDataJSON, currentFileLabel,
  fetchLastCommitTime, urlWithFile, goHomeAfterSave
} from './common.js';

/* ========== DOM 取得 ========== */
const $list  = document.getElementById('list');
const $meta  = document.getElementById('meta');
const $reload = document.getElementById('reload');
const $btnDownload = document.getElementById('download-cards');
const $linkName = document.getElementById('link-name');
const $linkTime = document.getElementById('link-time');

/* ========== 常數 ========== */
const WRAP_CUTOFF = "0559";        // 00:00–05:59 視為隔日清晨（排序時往明天包）
const CARD_W = 185;                // 匯出版卡片寬（需和 CSS 相同）
const CARD_H = 35;                 // 匯出版卡片高（需和 CSS 相同）
const GAP    = 8;                  // 匯出版卡片間距（與 .list gap 近似）
const PER_COL = 20;                // 每欄 20 張（由上至下、再往右）

/* ========== 狀態 ========== */
let items = []; // [[name, time], ...]  time: null | "HHmm" | "YYYY-MM-DD HHmm"

/* ========== 初始化 ========== */
init(false);
$reload?.addEventListener('click', () => init(true));
$btnDownload?.addEventListener('click', onDownloadCards);
wireEditorLinks(); // 工具列超連結帶上 file 參數

async function init(manual){
  try{
    const arr = await fetchDataJSON();
    items = normalize(arr);

    // 以「距離現在的分鐘差（循環 24h）」排序：
    // null（已重生）最前 → 其他依 diffFromNow 由小到大
    items.sort((a,b)=>{
      const da = diffFromNow(a[1]);
      const db = diffFromNow(b[1]);
      if(a[1] === null && b[1] === null) return 0;
      if(a[1] === null) return -1;
      if(b[1] === null) return 1;
      return da - db;
    });

    render();

    // 顯示檔名與最後更新時間
    const iso = await fetchLastCommitTime().catch(()=>null);
    const when = iso ? new Date(iso).toLocaleString() : '未知';
    $meta.textContent = `檔案：${currentFileLabel()}　最後更新：${when}`;
  }catch(e){
    items = [];
    render();
    $meta.textContent = `讀取失敗：${e.message}`;
    if(manual) alert(`讀取失敗：${e.message}`);
    console.error(e);
  }
}

/* ========== 共用工具 ========== */
function normalize(arr){
  if(!Array.isArray(arr)) return [];
  return arr.map(item=>{
    if(Array.isArray(item)){
      const name = String(item[0] ?? '');
      return [name, unifyTime(item[1])];
    }
    if(typeof item === 'string') return [item, null];
    if(item && typeof item === 'object'){
      const name = String(item.名字 ?? item.name ?? '');
      const t = item.時間 ?? item.time;
      return [name, unifyTime(t)];
    }
    return ['', null];
  });
}
function unifyTime(t){
  if(t == null || t === '') return null;
  if(typeof t !== 'string') return null;
  const s = t.trim();
  if(/^\d{4}$/.test(s)) return s;                         // HHmm
  if(/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(s)) return s;      // YYYY-MM-DD HHmm
  return null;
}

// 現在 HHmm / 分鐘
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
function toDisplay(hhmm){ return hhmm.slice(0,2) + ':' + hhmm.slice(2,4); }

// 排序用：回傳相對現在的分鐘差（循環 24h）；null 放到最前
function diffFromNow(time){
  if(time === null) return -1e9;

  // 支援 "YYYY-MM-DD HHmm"
  let hhmm = time;
  if(/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(time)) hhmm = time.slice(11);

  const now = nowMinutes();
  const tm  = HHmmToMinutes(hhmm);
  const raw = tm - now;
  const isEarlyMorning = hhmm <= WRAP_CUTOFF;
  if(raw < 0 && isEarlyMorning){
    // 清晨（<= 05:59），若已過去，視為明天清晨
    return raw + 1440;
  }
  return raw;
}

// 找出「未來中最接近現在」的 index（用於標記黃色）
function findNextClosestIndex(arr){
  const now = nowMinutes();
  let bestIdx = -1, bestDelta = Infinity;

  arr.forEach(([_, time], idx)=>{
    if(time === null) return;
    let hhmm = time;
    if(/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(time)) hhmm = time.slice(11);
    if(!/^\d{4}$/.test(hhmm)) return;

    const tm = HHmmToMinutes(hhmm);
    const delta = (tm - now + 1440) % 1440; // 0..1439
    if(delta > 0 && delta < bestDelta){
      bestDelta = delta;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

/* ========== 畫面渲染 ========== */
function render(){
  $list.innerHTML = '';
  const nowHHmm = hhmmNow();
  const nextIdx = findNextClosestIndex(items);

  items.forEach(([name, time], idx)=>{
    const card = document.createElement('div');
    card.className = 'card';

    const elName = document.createElement('div');
    elName.className = 'name';
    elName.textContent = name || '—';

    const elTime = document.createElement('div');
    elTime.className = 'time';

    if(time === null){
      elTime.textContent = '已重生';
      card.classList.add('status-green');
    }else{
      let hhmm = time;
      if(/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(time)) hhmm = time.slice(11);
      elTime.textContent = toDisplay(hhmm);

      const raw = HHmmToMinutes(hhmm) - nowMinutes();
      const isEarlyMorning = hhmm <= WRAP_CUTOFF;
      if(raw < 0 && !isEarlyMorning){
        card.classList.add('status-red');       // 今天已過去
      }else if(idx === nextIdx){
        card.classList.add('status-yellow');    // 未來中最近
      }
    }

    card.append(elName, elTime);
    $list.appendChild(card);
  });
}

/* ========== 匯出 PNG（卡片，直向 20/欄，超過往右） ========== */
async function onDownloadCards(){
  if(!window.html2canvas){
    alert('圖片匯出工具尚未載入，請稍後再試。');
    return;
  }

  // 1) 先就地抓現有卡片
  const cards = Array.from($list.querySelectorAll('.card'));
  if(!cards.length){
    alert('沒有可匯出的卡片。');
    return;
  }

  // 2) 建立螢幕外容器（純匯出排版，不動原 DOM）
  const wrap = document.createElement('div');
  wrap.className = 'export-grid-dynamic';
  Object.assign(wrap.style, {
    position: 'fixed',
    left: '-200vw', top: '0',
    background: '#fff',
    display: 'grid',
    gap: `${GAP}px`,
    gridAutoRows: `${CARD_H}px`,
    gridTemplateColumns: `repeat(${Math.ceil(cards.length / PER_COL)}, ${CARD_W}px)`
  });
  document.body.appendChild(wrap);
  document.body.classList.add('exporting'); // 全頁白底

  // 3) 依「直向優先」的順序 clone 卡片進匯出容器
  //    第 0 欄：row 1..20；第 1 欄：row 1..20；以此類推
  cards.forEach((card, i)=>{
    const clone = card.cloneNode(true);
    const col = Math.floor(i / PER_COL) + 1;  // grid-column 從 1 開始
    const row = (i % PER_COL) + 1;            // grid-row    從 1 開始
    clone.style.margin = '0';
    clone.style.width = `${CARD_W}px`;
    clone.style.height = `${CARD_H}px`;
    clone.style.gridColumn = String(col);
    clone.style.gridRow = String(row);
    wrap.appendChild(clone);
  });

  // 4) 等字型穩定再截圖
  if(document.fonts?.ready){ try{ await document.fonts.ready; }catch{} }

  const canvas = await html2canvas(wrap, {
    backgroundColor:'#ffffff',
    scale: 2,
    useCORS: true,
    windowWidth: wrap.scrollWidth,
    windowHeight: wrap.scrollHeight
  });

  const url = canvas.toDataURL('image/png');
  triggerDownload(url, `cards_${stamp()}.png`);

  // 5) 清理
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

/* ========== 工具列：連結保留 ?file= 參數 ========== */
function wireEditorLinks(){
  const qs = new URLSearchParams(location.search);
  const file = qs.get('file');
  const addParam = file ? `?file=${encodeURIComponent(file)}` : '';

  if($linkName) $linkName.href = `./name.html${addParam}`;
  if($linkTime) $linkTime.href = `./time.html${addParam}`;
}
