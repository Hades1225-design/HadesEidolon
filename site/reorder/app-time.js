// site/reorder/app-time.js
import {
  fetchDataJSON, saveDataJSON, currentFileLabel,
  fetchLastCommitTime, urlWithFile, goHomeAfterSave
} from './common.js';

/* ========== 回首頁按鈕（自動帶 ?file） ========== */
const $goHome = document.getElementById('goHomeAfterSave');
if ($goHome) {
  const homeURL = urlWithFile('../../index.html');    // 從 /site/reorder/ 回到 /site/index.html
  $goHome.href = homeURL;
  $goHome.addEventListener('click', (e) => {
    e.preventDefault();
    location.href = homeURL;
  });
}

/* ========== DOM ========== */
const $list   = document.getElementById('list');
const $meta   = document.getElementById('meta');
const $reload = document.getElementById('reload');
const $save   = document.getElementById('save');

/* ========== 狀態 ========== */
let items = []; // [[name, time], ...] time: null | "HHmm" | "YYYY-MM-DD HHmm"

/* ========== 初始化 ========== */
init(false);
$reload?.addEventListener('click', () => init(true));
$save?.addEventListener('click', onSave);

async function init(manual){
  try{
    const arr = await fetchDataJSON();
    items = normalize(arr);
    render();

    const iso  = await fetchLastCommitTime().catch(()=>null);
    const when = iso ? new Date(iso).toLocaleString() : '未知';
    $meta.textContent = `檔案：${currentFileLabel()} · 共 ${items.length} 筆 · 最後更新：${when}`;
  }catch(e){
    items = []; render();
    const msg = `讀取失敗：${e.message}`;
    $meta.textContent = msg;
    if(manual) alert(msg);
    console.error(e);
  }
}

/* ========== 轉換 / 正規化 ========== */
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
function extractHHmm(t){
  if(!t) return null;
  if(/^\d{4}$/.test(t)) return t;
  if(/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(t)) return t.slice(11);
  return null;
}

/* ========== 畫面 ========== */
function render(){
  $list.innerHTML = '';
  items.forEach(([name, time], i)=>{
    const row = document.createElement('div'); row.className = 'row';

    const idx = document.createElement('div'); idx.className='idx'; idx.textContent=i+1;

    const nameCell = document.createElement('div');
    nameCell.className='name-cell';
    nameCell.textContent = name;

    const input = document.createElement('input');
    input.className='time-input';
    input.placeholder='HHmm';
    input.inputMode = 'numeric';      // 行動裝置數字鍵盤
    input.maxLength = 4;
    input.value = extractHHmm(time) ?? '';

    updateInputTitleWithAutoDate(input);

    input.addEventListener('input', e=>{
      e.target.value = applyDigitCapsStrict24(e.target.value);
      updateInputTitleWithAutoDate(e.target);
      if(e.target.value.length === 4) jumpNext(e.target);
      items[i][1] = e.target.value || null;   // 暫存 HHmm（儲存時再帶日期）
    });

    input.addEventListener('keydown', e=>{
      if(e.key === 'Enter'){
        e.preventDefault();
        e.target.value = applyDigitCapsStrict24(pad4(e.target.value));
        items[i][1] = e.target.value || null;
        updateInputTitleWithAutoDate(e.target);
        jumpNext(e.target);
      }
    });

    row.append(idx, nameCell, input);
    $list.appendChild(row);
  });
}

/* ========== 輸入規則 ========== */
// 嚴格 24 小時制：第2位在第1位為2時最多到3；第3位最多5
function applyDigitCapsStrict24(raw){
  const s = String(raw||'').replace(/\D/g,'').slice(0,4);
  const d = s.split('');
  if(d.length>=1) d[0]=String(Math.min(+d[0],2));
  if(d.length>=2) d[1]=String(Math.min(+d[1], d[0]==='2'?3:9));
  if(d.length>=3) d[2]=String(Math.min(+d[2],5));
  return d.join('');
}
function pad4(v){ return String((v||'').replace(/\D/g,'')).padStart(4,'0').slice(0,4); }
function jumpNext(cur){
  const all=[...document.querySelectorAll('.time-input')];
  const next=all[all.indexOf(cur)+1];
  if(next){ next.focus(); next.select(); }
}

/* ========== 儲存：HHmm → 自動決定日期（-12h 規則） ========== */
async function onSave(){
  try{
    const out = items.map(([name, t])=>{
      if(!t) return [name, null];
      if(/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(t)) return [name, t];   // 已含日期
      const hhmm = applyDigitCapsStrict24(pad4(t));
      const date = resolveNextDate(hhmm);                          // -12h 規則
      return [name, `${date} ${hhmm}`];
    });

    await saveDataJSON(out, "update times");
    alert('儲存成功！');
    // 保留 ?file 參數回首頁（只呼叫一次）
    goHomeAfterSave('./index.html');

  }catch(e){
    alert(`儲存失敗：${e.message}`);
    console.error(e);
  }
}

/* -12h 規則：若 HHmm 早於現在超過 12 小時 → 視為明天；否則視為今天 */
function resolveNextDate(hhmm){
  const now = new Date();
  const h = +hhmm.slice(0,2), m = +hhmm.slice(2,4);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  const diffMin = (today - now)/60000;
  if (diffMin >= 0) return toYMD(today);           // 之後 → 今天
  if (Math.abs(diffMin) <= 720) return toYMD(today); // 已過去但在 12 小時內 → 今天
  return toYMD(new Date(today.getTime()+86400000));  // 超過 12 小時 → 明天
}
function toYMD(d){
  const z=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
}
function updateInputTitleWithAutoDate(input){
  const v = applyDigitCapsStrict24(input.value||'');
  input.title = /^\d{4}$/.test(v) ? `將套用日期：${resolveNextDate(v)}` : '';
}