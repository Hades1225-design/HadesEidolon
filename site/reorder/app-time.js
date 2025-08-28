// site/reorder/app-time.js
import { fetchDataJSON, saveDataJSON, currentFileLabel,
         fetchLastCommitTime, urlWithFile, goHomeAfterSave } from './common.js';

const $goHome = document.getElementById('goHomeAfterSave');
if ($goHome) {
  const homeURL = urlWithFile('./index.html');
  $goHome.setAttribute('href', homeURL);
  $goHome.addEventListener('click', (e) => { e.preventDefault(); location.href = homeURL; });
}

const $list = document.getElementById('list');
const $meta = document.getElementById('meta');
const $reload = document.getElementById('reload');
const $save = document.getElementById('save');

let items = []; // [[name, time], ...] time: null | "HHmm" | "YYYY-MM-DD HHmm"

init(false);
$reload?.addEventListener('click', () => init(true));
$save?.addEventListener('click', onSave);

async function init(manual){
  try{
    const arr = await fetchDataJSON();
    items = normalize(arr);
    render();
    const iso = await fetchLastCommitTime().catch(()=>null);
    const when = iso ? new Date(iso).toLocaleString() : '未知';
    $meta.textContent = `檔案：${currentFileLabel()} · 共 ${items.length} 筆 · 最後更新：${when}`;
  }catch(e){
    items = []; render();
    const msg = `讀取失敗：${e.message}`;
    $meta.textContent = msg;
    if(manual) alert(msg);
  }
}

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
  if(/^\d{4}$/.test(s)) return s;
  if(/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(s)) return s;
  return null;
}

function render(){
  $list.innerHTML = '';
  items.forEach(([name, time], i)=>{
    const row = document.createElement('div'); row.className = 'row';

    const idx = document.createElement('div'); idx.className='idx'; idx.textContent=i+1;

    const nameCell = document.createElement('div'); nameCell.className='name-cell'; nameCell.textContent = name;

    const input = document.createElement('input');
    input.className='time-input'; input.placeholder='HHmm';
    input.value = extractHHmm(time) ?? '';
    updateInputTitleWithAutoDate(input);

    input.addEventListener('input', e=>{
      e.target.value = applyDigitCapsStrict24(e.target.value);
      updateInputTitleWithAutoDate(e.target);
      if(e.target.value.length === 4) jumpNext(e.target);
      items[i][1] = e.target.value || null;
    });
    input.addEventListener('keydown', e=>{
      if(e.key === 'Enter'){
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

/* 嚴格 24h（第2位在第1位為2時最多 3；第3位最多 5） */
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

/* 儲存：HHmm → 決定日期（-12h 規則）→ 存 "YYYY-MM-DD HHmm" */
async function onSave(){
  try{
    const out = items.map(([name, t])=>{
      if(!t) return [name, null];
      if(/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(t)) return [name, t];
      const hhmm = applyDigitCapsStrict24(pad4(t));
      const date = resolveNextDate(hhmm);              // -12h 規則
      return [name, `${date} ${hhmm}`];
    });
    await saveDataJSON(out, "update times");
    goHomeAfterSave('./index.html');                   // 保留 ?file
  }catch(e){
    alert(`儲存失敗：${e.message}`);
  }
}

/* -12h 規則：若 HHmm 晚現在超過 12 小時才視為明天，否則當今天 */
function resolveNextDate(hhmm){
  const now = new Date();
  const h = +hhmm.slice(0,2), m = +hhmm.slice(2,4);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  const diffMin = (today - now)/60000;
  if (diffMin >= 0) return toYMD(today);          // 今天未來
  if (Math.abs(diffMin) <= 720) return toYMD(today); // 今天過去但在 12 小時內，仍算今天
  return toYMD(new Date(today.getTime()+86400000));  // 超過 12 小時 → 明天
}
function toYMD(d){ const z=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; }
function extractHHmm(t){ if(!t) return null; return /^\d{4}$/.test(t)?t : (/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(t)? t.slice(11): null); }
function updateInputTitleWithAutoDate(input){
  const v = applyDigitCapsStrict24(input.value||'');
  input.title = /^\d{4}$/.test(v) ? `將套用日期：${resolveNextDate(v)}` : '';
}