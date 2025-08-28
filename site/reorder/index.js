/* ========== 注入 ./common.js ========== */
import {
  fetchDataJSON, currentFileLabel, fetchLastCommitTime
} from './common.js';

/* ========== DOM 取得 ========== */
const $list  = document.getElementById('list');
const $meta  = document.getElementById('meta');
const $reload = document.getElementById('reload');
const $btnDownload = document.getElementById('download-cards');
const $linkName = document.getElementById('link-name');
const $linkTime = document.getElementById('link-time');

/* ========== 常數 ========== */
const CARD_W = 185, CARD_H = 35, GAP = 8, PER_COL = 20;

/* ========== 狀態 ========== */
let items = []; // [[name, time], ...]  time: null | "YYYY-MM-DD HHmm"

/* ========== 初始化 ========== */
init(false);
$reload?.addEventListener('click', () => init(true));
$btnDownload?.addEventListener('click', onDownloadCards);
wireEditorLinks();

async function init(manual){
  try{
    const arr = await fetchDataJSON();
    items = normalize(arr);

    // 舊→新（null 視為最舊）
    items.sort((a, b) => {
      const ta = (a[1] == null) ? Number.NEGATIVE_INFINITY : epochMsFromAbsolute(a[1]);
      const tb = (b[1] == null) ? Number.NEGATIVE_INFINITY : epochMsFromAbsolute(b[1]);
      if (ta !== tb) return ta - tb;
      return (a[0] ?? '').toString().localeCompare((b[0] ?? '').toString(), 'zh-Hant');
    });

    render();

    const iso = await fetchLastCommitTime().catch(()=>null);
    const when = iso ? new Date(iso).toLocaleString() : '未知';
    if ($meta) $meta.innerHTML = `檔案：${currentFileLabel()}<br>最後更新：${when}`;
  }catch(e){
    items = [];
    render();
    if ($meta) $meta.textContent = `讀取失敗：${e.message}`;
    if(manual) alert(`讀取失敗：${e.message}`);
    console.error(e);
  }
}

/* ========== 共用工具 ========== */
function normalize(arr){
  if(!Array.isArray(arr)) return [];
  return arr.map(item=>{
    if(Array.isArray(item)) return [String(item[0] ?? ''), unifyTime(item[1])];
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
  if(t == null) return null;
  if(typeof t !== 'string') return null;
  const s = t.trim();
  return /^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(s) ? s : null;
}
function epochMsFromAbsolute(timeStr){
  const yyyy = +timeStr.slice(0, 4);
  const mm   = +timeStr.slice(5, 7);
  const dd   = +timeStr.slice(8, 10);
  const HH   = +timeStr.slice(11, 13);
  const MM   = +timeStr.slice(13, 15);
  return new Date(yyyy, mm - 1, dd, HH, MM).getTime();
}
function findNextClosestIndex(arr){
  const nowMs = Date.now();
  let bestIdx = -1, bestTs = Infinity;
  arr.forEach(([_, time], idx)=>{
    if(time == null) return;
    const ts = epochMsFromAbsolute(time);
    if (ts >= nowMs && ts < bestTs) { bestTs = ts; bestIdx = idx; }
  });
  return bestIdx;
}

/* ========== 畫面渲染 ========== */
function render(){
  if (!$list) return;
  $list.innerHTML = '';
  const nextIdx = findNextClosestIndex(items);
  const nowMs = Date.now();

  items.forEach(([name, time], idx)=>{
    const card = document.createElement('div');
    card.className = 'card';

    const elName = document.createElement('div');
    elName.className = 'name';
    elName.textContent = name || '—';

    const elTime = document.createElement('div');
    elTime.className = 'time';

    if(time === null){
      elTime.textContent = '存活';
      card.classList.add('status-green');
    }else{
      const hhmm = time.slice(11);
      elTime.textContent = hhmm.slice(0,2) + ':' + hhmm.slice(2,4);
      const ts = epochMsFromAbsolute(time);
      if (ts < nowMs) card.classList.add('status-red');
      else if (idx === nextIdx) card.classList.add('status-yellow');
    }

    card.append(elName, elTime);
    $list.appendChild(card);
  });
}

/* ========== 匯出 PNG（卡片，直向 20/欄，超過往右） ========== */
async function onDownloadCards(){
  if(!window.html2canvas){ alert('圖片匯出工具尚未載入，請稍後再試。'); return; }
  const cards = Array.from($list.querySelectorAll('.card'));
  if(!cards.length){ alert('沒有可匯出的卡片。'); return; }

  const wrap = document.createElement('div');
  wrap.className = 'export-grid-dynamic';
  Object.assign(wrap.style, {
    position: 'fixed', left: '-200vw', top: '0', background: '#fff',
    display: 'grid', gap: `${GAP}px`, gridAutoRows: `${CARD_H}px`,
    gridTemplateColumns: `repeat(${Math.ceil(cards.length / PER_COL)}, ${CARD_W}px)`
  });
  document.body.appendChild(wrap);
  document.body.classList.add('exporting');

  cards.forEach((card, i)=>{
    const clone = card.cloneNode(true);
    const col = Math.floor(i / PER_COL) + 1;
    const row = (i % PER_COL) + 1;
    clone.style.margin = '0';
    clone.style.width = `${CARD_W}px`;
    clone.style.height = `${CARD_H}px`;
    clone.style.gridColumn = String(col);
    clone.style.gridRow = String(row);
    wrap.appendChild(clone);
  });

  if(document.fonts?.ready){ try{ await document.fonts.ready; }catch{} }

  const canvas = await html2canvas(wrap, {
    backgroundColor:'#ffffff', scale: 2, useCORS: true,
    windowWidth: wrap.scrollWidth, windowHeight: wrap.scrollHeight
  });
  const url = canvas.toDataURL('image/png');
  triggerDownload(url, `cards_${stamp()}.png`);
  document.body.removeChild(wrap);
  document.body.classList.remove('exporting');
}
function triggerDownload(url, filename){ const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); }
function stamp(){ const d=new Date(),z=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}${z(d.getMonth()+1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`; }

/* ========== 工具列：連結保留 ?file= 參數 ========== */
function wireEditorLinks(){
  const qs = new URLSearchParams(location.search);
  const file = qs.get('file');
  const addParam = file ? `?file=${encodeURIComponent(file)}` : '';
  if($linkName) $linkName.href = `./name.html${addParam}`;
  if($linkTime) $linkTime.href = `./time.html${addParam}`;
}