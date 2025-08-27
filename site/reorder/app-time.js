import { fetchDataJSON, saveDataJSON } from './common.js';

const $list  = document.getElementById('list');
const $meta  = document.getElementById('meta');
const $reload= document.getElementById('reload');
const $save  = document.getElementById('save');

let items = []; // [[name, time], ...]  time: null | "HHmm" | "YYYY-MM-DD HHmm"

init(false);
$reload.onclick = () => init(true);
$save.onclick   = onSave;

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

// 將來源資料統一成 [name, timeString|null]；time 允許 "HHmm" 或 "YYYY-MM-DD HHmm"
function normalize(arr){
  if(!Array.isArray(arr)) return [];
  return arr.map(item=>{
    if(Array.isArray(item)){
      const name = String(item[0] ?? '');
      const t = item[1];
      return [name, toUnifiedTime(t)];
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
  if (/^\d{4}$/.test(s)) return s; // HHmm
  if (/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(s)) return s; // YYYY-MM-DD HHmm
  return null;
}

function render(){
  $list.innerHTML = '';
  items.forEach(([name, time], idx)=>{
    const row = document.createElement('div');
    row.className = 'row';

    // 編號
    const idxCell = document.createElement('div');
    idxCell.className = 'idx';
    idxCell.textContent = idx + 1;

    // 名字（純文字，不可編輯）
    const nameCell = document.createElement('div');
    nameCell.className = 'name-cell';
    nameCell.textContent = name;

    // 時間輸入框（僅顯示 HHmm，不讓輸入日期）
    const input = document.createElement('input');
    input.className = 'time-input';
    input.type = 'text';
    input.placeholder = 'HHmm';
    input.value = extractHHmm(time) ?? '';

    // 顯示 hover 提示：自動推算的日期
    updateInputTitleWithAutoDate(input);

    // 僅允許 4 位數字
    input.addEventListener('input', e=>{
      let v = e.target.value.replace(/\D/g,'').slice(0,4);
      e.target.value = v;
      updateInputTitleWithAutoDate(e.target);
    });

    // Enter → 跳下一格
    input.addEventListener('keydown', e=>{
      if(e.key === 'Enter'){
        e.target.value = (e.target.value || '').replace(/\D/g,'').padStart(4,'0').slice(0,4);
        items[idx][1] = e.target.value || null;
        updateInputTitleWithAutoDate(e.target);

        const inputs = [...document.querySelectorAll('.time-input')];
        const next = inputs[inputs.indexOf(e.target) + 1];
        if(next) next.focus();
      }
    });

    // 變更時先暫存 HHmm（儲存時才加日期）
    input.addEventListener('change', e=>{
      items[idx][1] = e.target.value || null;
      updateInputTitleWithAutoDate(e.target);
    });

    row.append(idxCell, nameCell, input);
    $list.appendChild(row);
  });
}

/* ====== 儲存：把每一筆 HHmm 轉成「下一次發生」的 YYYY-MM-DD HHmm ====== */
async function onSave(){
  try{
    const transformed = items.map(([name, t])=>{
      if(t == null || t === '') return [name, null];
      if(/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(t)) return [name, t]; // 已是絕對時間
      if(/^\d{4}$/.test(t)){
        const hhmm = t;
        const date = resolveNextDate(hhmm);
        return [name, `${date} ${hhmm}`];
      }
      return [name, null];
    });

    await saveDataJSON(transformed);
    $meta.textContent = `儲存成功（${new Date().toLocaleTimeString()}）`;
    alert('已成功儲存到伺服器！');
  }catch(e){
    alert(`儲存失敗：${e.message}`);
  }
}

/* ====== 工具：決定「下一次發生」的日期 ====== */
function resolveNextDate(hhmm){
  const now = new Date();
  const h = +hhmm.slice(0,2);
  const m = +hhmm.slice(2,4);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);

  const nowMinutes = Math.floor(now.getTime() / 60000);
  const targetMinutes = Math.floor(today.getTime() / 60000);
  const diffMinutes = targetMinutes - nowMinutes;

  // 規則：
  // 1. 若時間在未來 → 今天
  // 2. 若時間已過去但距離現在 <= 12 小時 → 今天
  // 3. 若時間已過去且距離現在 > 12 小時 → 明天
  if (diffMinutes >= 0) {
    return toYMD(today);
  } else if (Math.abs(diffMinutes) <= 720) { // 12 小時 = 720 分鐘
    return toYMD(today);
  } else {
    // 明天
    const tomorrow = new Date(today.getTime() + 86400000);
    return toYMD(tomorrow);
  }
}

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

/* 更新 hover 提示：顯示自動推算日期 */
function updateInputTitleWithAutoDate(input){
  const v = (input.value || '').replace(/\D/g,'');
  if(/^\d{4}$/.test(v)){
    input.title = `將套用日期：${resolveNextDate(v)}`;
  }else{
    input.title = '';
  }
}