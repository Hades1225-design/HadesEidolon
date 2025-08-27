// site/reorder/app-time.js
import { fetchDataJSON, saveDataJSON } from './common.js';
import { currentFileLabel } from './common.js';
document.getElementById('fileBadge')?.replaceChildren(document.createTextNode(`檔案：${currentFileLabel()}`));

const $list   = document.getElementById('list');
const $meta   = document.getElementById('meta');
const $reload = document.getElementById('reload');
const $save   = document.getElementById('save');

let items = []; // [[name, time], ...]  time: null | "HHmm" | "YYYY-MM-DD HHmm"

init(false);
$reload.onclick = () => init(true);
$save.onclick   = onSave;

/* ================= 初始化 ================= */
async function init(manual){
  try{
    const arr = await fetchDataJSON();
    items = normalize(arr);
    render();
    $meta.textContent = `讀取成功，共 ${items.length} 筆`;
  }catch(e){
    items = [];
    render();
    const msg = `讀取失敗：${e.message}`;
    $meta.textContent = msg;
    if(manual) alert(msg);
    console.error(e);
  }
}

/* ================= 正規化 ================= */
function normalize(arr){
  if(!Array.isArray(arr)) return [];
  return arr.map(item=>{
    if(Array.isArray(item)){
      const name = String(item[0] ?? '');
      return [name, toUnifiedTime(item[1])];
    }
    if(typeof item === 'string') return [item, null];
    if(item && typeof item === 'object'){
      const name = String(item.名字 ?? item.name ?? '');
      const t = item.時間 ?? item.time;
      return [name, toUnifiedTime(t)];
    }
    return ['', null];
  });
}
function toUnifiedTime(t){
  if(t == null || t === '') return null;
  if(typeof t !== 'string') return null;
  const s = t.trim();
  if (/^\d{4}$/.test(s)) return s;                         // HHmm
  if (/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(s)) return s;      // YYYY-MM-DD HHmm
  return null;
}

/* ================= 畫面渲染 ================= */
function render(){
  $list.innerHTML = '';

  items.forEach(([name, time], idx)=>{
    const row = document.createElement('div');
    row.className = 'row';

    // 編號
    const idxCell = document.createElement('div');
    idxCell.className = 'idx';
    idxCell.textContent = idx + 1;

    // 名字（純文字）
    const nameCell = document.createElement('div');
    nameCell.className = 'name-cell';
    nameCell.textContent = name;

    // 時間輸入（只輸入 HHmm）
    const input = document.createElement('input');
    input.className = 'time-input';
    input.type = 'text';
    input.placeholder = 'HHmm';
    input.value = extractHHmm(time) ?? '';

    // hover 顯示「將自動套用的日期」
    updateInputTitleWithAutoDate(input);

    // 輸入時：即時套用「嚴格 24h 位數規則」
    input.addEventListener('input', e=>{
      e.target.value = applyDigitCapsStrict24(e.target.value);
      updateInputTitleWithAutoDate(e.target);

      // 【新功能】輸入滿 4 位數 → 自動跳下一格並選取內容
      if (e.target.value.length === 4) {
        jumpToNextInput(e.target);
      }
    });

    // Enter：補零→套嚴格位數上限→跳下一格
    input.addEventListener('keydown', e=>{
      if(e.key === 'Enter'){
        const filled = applyDigitCapsStrict24(pad4(e.target.value));
        e.target.value = filled;
        items[idx][1] = filled || null;
        updateInputTitleWithAutoDate(e.target);
        jumpToNextInput(e.target);
      }
    });

    // onChange：暫存（儲存時才補日期）
    input.addEventListener('change', e=>{
      const v = applyDigitCapsStrict24(e.target.value);
      e.target.value = v;
      items[idx][1] = v || null;
      updateInputTitleWithAutoDate(e.target);
    });

    row.append(idxCell, nameCell, input);
    $list.appendChild(row);
  });
}

/* ================= 嚴格 24 小時制位數上限 ================= */
/**
 * 規則（嚴格 24h）：
 *  - 第1位（H十位）最大 2
 *  - 第2位（H個位）若第1位為 2，最大 3；否則最大 9
 *  - 第3位（M十位）最大 5
 *  - 第4位（M個位）不限制
 */
function applyDigitCapsStrict24(raw){
  const s = String(raw||'').replace(/\D/g,'').slice(0,4);
  const d = s.split('');

  if (d.length >= 1) d[0] = String(Math.min(+d[0], 2));
  if (d.length >= 2) {
    const max2 = (d[0] === '2') ? 3 : 9;
    d[1] = String(Math.min(+d[1], max2));
  }
  if (d.length >= 3) d[2] = String(Math.min(+d[2], 5));
  // 第4位不限制
  return d.join('');
}
function pad4(v){
  return String((v||'').replace(/\D/g,'')).padStart(4,'0').slice(0,4);
}

/* ================= 自動跳下一格 ================= */
function jumpToNextInput(currentInput){
  const inputs = [...document.querySelectorAll('.time-input')];
  const next = inputs[inputs.indexOf(currentInput) + 1];
  if(next){
    next.focus();
    next.select(); // 自動全選，方便覆蓋輸入
  }
}

/* ================= 儲存：將 HHmm 轉成「下一次發生」YYYY-MM-DD HHmm ================= */
async function onSave(){
  try{
    const transformed = items.map(([name, t])=>{
      if(t == null || t === '') return [name, null];

      // 已是絕對時間 → 原樣保留
      if(/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(t)) return [name, t];

      // 只有 HHmm → 先做嚴格位數上限，再決定日期
      if(/^\d{4}$/.test(t) || /^\d+$/.test(t)){
        const hhmm = applyDigitCapsStrict24(pad4(t));
        const date = resolveNextDate(hhmm);
        return [name, `${date} ${hhmm}`];
      }

      return [name, null];
    });

    await saveDataJSON(transformed);
    $meta.textContent = `儲存成功（${new Date().toLocaleTimeString()}）`;
    alert('已成功儲存到伺服器！');

    // 【新功能】儲存完成 → 自動回到 index.html
    window.location.href = "./index.html";
  }catch(e){
    alert(`儲存失敗：${e.message}`);
  }
}

/* ================= 規則核心：-12 小時邏輯 ================= */
function resolveNextDate(hhmm){
  const now = new Date();
  const h = +hhmm.slice(0,2);
  const m = +hhmm.slice(2,4);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);

  const nowMin = Math.floor(now.getTime() / 60000);
  const tgtMin = Math.floor(today.getTime() / 60000);
  const diff   = tgtMin - nowMin;

  if (diff >= 0) return toYMD(today);
  if (Math.abs(diff) <= 720) return toYMD(today);
  const tomorrow = new Date(today.getTime() + 86400000);
  return toYMD(tomorrow);
}

/* ================= 小工具 ================= */
function toYMD(d){
  const z = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
}
function extractHHmm(t){
  if(!t) return null;
  if(/^\d{4}$/.test(t)) return t;
  if(/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(t)) return t.slice(11, 15);
  return null;
}
function updateInputTitleWithAutoDate(input){
  const v = applyDigitCapsStrict24(input.value);
  if(/^\d{4}$/.test(v)){
    input.title = `將套用日期：${resolveNextDate(v)}`;
  }else{
    input.title = '';
  }
}