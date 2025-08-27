/* === GitHub 讀檔設定（Contents API 直讀） === */
const GH_OWNER  = "Hades1225-design";
const GH_REPO   = "HadesEidolon";
const GH_BRANCH = "main";

const GITHUB_CONTENTS =
  `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/public/data.json?ref=${GH_BRANCH}`;
const GITHUB_COMMITS =
  `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/commits?path=public/data.json&page=1&per_page=1`;

/* === DOM === */
const $list = document.getElementById('list');
const $meta = document.getElementById('meta');
document.getElementById('reload').onclick = () => init(true);
document.getElementById('download-cards').onclick = downloadPNG;

let items = []; // [ [name, time], ... ] time: null | "HHmm" | "YYYY-MM-DD HHmm"

init(false);

/* ================= 讀取與初始化 ================= */
async function fetchDataJSON(){
  const url = `${GITHUB_CONTENTS}&ts=${Date.now()}`; // 防快取
  const res = await fetch(url, {
    headers: { "Accept": "application/vnd.github.v3.raw" },
    cache: "no-store"
  });
  if(!res.ok) throw new Error(`HTTP ${res.status}（讀取 data.json 失敗）`);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch(e){ console.error("data.json 內容：", text); throw new Error("JSON 解析失敗"); }
}

async function init(manual){
  try{
    const arr = await fetchDataJSON();
    items = normalize(arr);

    // 依「離現在的分鐘差」排序（null 最前，之後由近到遠）
    items.sort((a,b)=>{
      const da = diffFromNowAbs(a[1]);
      const db = diffFromNowAbs(b[1]);
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
      return [name, unifyTime(t)];
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

/* ================= 時間工具（含 -12 小時規則） ================= */
// 將 "YYYY-MM-DD HHmm" 轉為 epoch 分鐘（本地時區）
function absToMinutes(isoHM){ // e.g. "2025-08-28 0055"
  const [d, hm] = isoHM.split(' ');
  const [y,m,day] = d.split('-').map(n=>+n);
  const h = +hm.slice(0,2), mi = +hm.slice(2,4);
  const dt = new Date(y, m-1, day, h, mi, 0, 0);
  return Math.floor(dt.getTime()/60000);
}
// 只給 HHmm → 依規則決定今天/明天，回傳 "YYYY-MM-DD"
function resolveNextDate(hhmm){
  const now = new Date();
  const h = +hhmm.slice(0,2), m = +hhmm.slice(2,4);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);

  const nowMin = Math.floor(now.getTime()/60000);
  const tgtMin = Math.floor(today.getTime()/60000);
  const diff   = tgtMin - nowMin;

  // 規則：
  // 1) 未來 → 今天
  // 2) 已過去但 |diff| <= 12 小時（720 分）→ 今天
  // 3) 已過去且 |diff| > 12 小時 → 明天
  if (diff >= 0 || Math.abs(diff) <= 720) {
    return toYMD(today);
  } else {
    const tomorrow = new Date(today.getTime() + 86400000);
    return toYMD(tomorrow);
  }
}
function toYMD(d){
  const z = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
}

// 取得「離現在的分鐘差」：null 最前；絕對時間直接比；HHmm 會先套日期
function diffFromNowAbs(t){
  if(t === null) return -1e9; // null 最前
  const nowM = Math.floor(Date.now()/60000);
  if(/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(t)){
    return absToMinutes(t) - nowM;
  }
  if(/^\d{4}$/.test(t)){
    const date = resolveNextDate(t);
    return absToMinutes(`${date} ${t}`) - nowM;
  }
  return 1e9;
}

// 找出「下一個即將到來」的索引（>=0 最小差值）
function findNextClosestIndex(arr){
  const nowM = Math.floor(Date.now()/60000);
  let bestIdx = -1, bestDelta = Infinity;
  arr.forEach(([_, t], idx)=>{
    if(!t) return;
    let tgtM = null;
    if(/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(t)) tgtM = absToMinutes(t);
    else if(/^\d{4}$/.test(t)) tgtM = absToMinutes(`${resolveNextDate(t)} ${t}`);
    if(tgtM !== null){
      const delta = tgtM - nowM;
      if(delta >= 0 && delta < bestDelta){
        bestDelta = delta; bestIdx = idx;
      }
    }
  });
  return bestIdx;
}

/* ================= 畫面渲染 ================= */
function render(){
  $list.innerHTML = '';
  const nextIdx = findNextClosestIndex(items);
  const nowM = Math.floor(Date.now()/60000);

  items.forEach(([name, t], idx)=>{
    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('div');
    title.className = 'name';
    title.textContent = name || '—';

    const timeEl = document.createElement('div');
    timeEl.className = 'time';

    if(t === null){
      timeEl.textContent = '存活';
      card.classList.add('status-green');
    }else{
      // 不論是否包含日期，統一只顯示 HH:mm
      const hhmm = /^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(t) ? t.slice(11,15) : t;
      timeEl.textContent = `${hhmm.slice(0,2)}:${hhmm.slice(2,4)}`;

      // 顏色：過去=紅；其餘正常；「未來最近」=黃
      let tgtM = null;
      if(/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(t)) tgtM = absToMinutes(t);
      else if(/^\d{4}$/.test(t)) tgtM = absToMinutes(`${resolveNextDate(t)} ${t}`);

      if(tgtM !== null){
        if(tgtM < nowM){
          card.classList.add('status-red');
        }else if(idx === nextIdx){
          card.classList.add('status-yellow');
        }
      }
    }

    card.append(title, timeEl);
    $list.appendChild(card);
  });
}

/* ================= 匯出 PNG（直向排序、每欄 20 張） ================= */
async function downloadPNG(){
  if (!window.html2canvas) { alert("圖片匯出工具載入中，請再試一次。"); return; }

  const cards = Array.from(document.querySelectorAll('#list .card'));
  if (!cards.length) return;

  // 與 CSS 尺寸一致（你現在 index.html 卡片 185×35、gap 8）
  const CARD_W = 185;
  const CARD_H = 35;
  const GAP    = 8;
  const perCol = 20; // 每欄固定 20 張
  const totalCols = Math.ceil(cards.length / perCol);

  // 建立螢幕外容器
  const wrap = document.createElement('div');
  wrap.className = 'export-grid-dynamic';
  wrap.style.gridTemplateColumns = `repeat(${totalCols}, ${CARD_W}px)`;
  wrap.style.gridAutoRows = `${CARD_H}px`;
  wrap.style.gap = `${GAP}px`;
  document.body.appendChild(wrap);

  // 依「直向優先」放入 clone
  cards.forEach((card, i) => {
    const clone = card.cloneNode(true);
    const col = Math.floor(i / perCol);
    const row = (i % perCol) + 1; // grid-row 從 1 起算
    clone.style.gridColumn = String(col + 1);
    clone.style.gridRow = String(row);
    clone.style.margin = '0';
    clone.style.width  = `${CARD_W}px`;
    clone.style.height = `${CARD_H}px`;
    wrap.appendChild(clone);
  });

  document.body.classList.add('exporting');
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch {} }

  const canvas = await html2canvas(wrap, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    windowWidth: wrap.scrollWidth,
    windowHeight: wrap.scrollHeight
  });

  triggerDownload(canvas.toDataURL('image/png'), `cards_${stamp()}.png`);

  document.body.removeChild(wrap);
  document.body.classList.remove('exporting');
}

/* ================= 其他工具 ================= */
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
    const r = await fetch(GITHUB_COMMITS, { cache:"no-store" });
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
