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

/* ========== 常數（移除清晨跨日規則） ========== */
const CARD_W = 185;                // 匯出版卡片寬（需和 CSS 相同）
const CARD_H = 40;                 // 匯出版卡片高（需和 CSS 相同）
const GAP    = 6;                  // 匯出版卡片間距（與 .list gap 近似）
const PER_COL = 16;                // 每欄 16 張（由上至下、再往右）

/* ========== 狀態 ========== */
let items = []; // [[name, time], ...]  time: null | "YYYY-MM-DD HHmm"

/* ========== 初始化 ========== */
init(false);
$reload?.addEventListener('click', () => init(true));
$btnDownload?.addEventListener('click', onDownloadCards);
wireEditorLinks(); // 工具列超連結帶上 file 參數

async function init(manual){
  try{
    const arr = await fetchDataJSON();
    items = normalize(arr);

    // 由舊到新排序；null 視為最舊（顯示為「存活」）
    items.sort((a, b) => {
      const ta = (a[1] == null) ? Number.NEGATIVE_INFINITY : epochMsFromAbsolute(a[1]);
      const tb = (b[1] == null) ? Number.NEGATIVE_INFINITY : epochMsFromAbsolute(b[1]);

      if (ta !== tb) return ta - tb;                  // 舊 → 新
      const na = (a[0] ?? '').toString();
      const nb = (b[0] ?? '').toString();
      return na.localeCompare(nb, 'zh-Hant');         // 穩定排序
    });

    render();

    // 顯示檔名與最後更新時間
    const iso = await fetchLastCommitTime().catch(()=>null);
    const when = iso ? new Date(iso).toLocaleString() : '未知';
    if ($meta) $meta.textContent = `檔案：${currentFileLabel()}　最後更新：${when}`;
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

// 僅接受絕對日期時間 "YYYY-MM-DD HHmm"，其他一律轉為 null
function unifyTime(t){
  if(t == null) return null;
  if(typeof t !== 'string') return null;
  const s = t.trim();
  return /^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(s) ? s : null;
}

// 由絕對時間字串取毫秒值（假設已通過 unifyTime）
function epochMsFromAbsolute(timeStr){
  const yyyy = +timeStr.slice(0, 4);
  const mm   = +timeStr.slice(5, 7);
  const dd   = +timeStr.slice(8, 10);
  const HH   = +timeStr.slice(11, 13);
  const MM   = +timeStr.slice(13, 15);
  return new Date(yyyy, mm - 1, dd, HH, MM, 0, 0).getTime();
}

// 找出「未來中最接近現在」的 index（用於標記黃色）
function findNextClosestIndex(arr){
  const nowMs = Date.now();
  let bestIdx = -1, bestTs = Infinity;

  arr.forEach(([_, time], idx)=>{
    if(time == null) return;                      // 存活不計入未來判定
    const ts = epochMsFromAbsolute(time);
    if (ts >= nowMs && ts < bestTs) {
      bestTs = ts;
      bestIdx = idx;
    }
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
      elTime.textContent = '存活';               // NULL → 存活（綠）
      card.classList.add('status-green');
    }else{
      // 顯示 HH:mm
      const hhmm = time.slice(11);
      elTime.textContent = hhmm.slice(0,2) + ':' + hhmm.slice(2,4);

      const ts = epochMsFromAbsolute(time);
      if (ts < nowMs) {
        card.classList.add('status-red');        // 過去 → 淡紅
      } else if (idx === nextIdx) {
        card.classList.add('status-yellow');     // 未來最近 → 淡黃
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
    padding: '6',
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
