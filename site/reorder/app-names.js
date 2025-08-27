// site/reorder/app-names.js
import { fetchDataJSON, saveDataJSON } from './common.js';

const $list   = document.getElementById('list');
const $meta   = document.getElementById('meta');
const $reload = document.getElementById('reload');
const $save   = document.getElementById('save');

let items = [];            // [[name, time], ...] (工作用，含排序/新增/刪除後的狀態)
let original = [];         // [[name, time], ...] (載入時的原始快照，用來保留時間)
let dragIndex = null;

init(false);

$reload.onclick = () => init(true);
$save.onclick   = onSave;

async function init(manual){
  try{
    const arr = await fetchDataJSON();
    items    = normalize(arr);
    original = items.map(([n,t]) => [n, t]);   // 深拷貝一份原始資料
    render();
    $meta.textContent = `讀取成功，共 ${items.length} 筆`;
  }catch(e){
    items = []; original = [];
    render();
    const msg = `讀取失敗：${e.message}`;
    $meta.textContent = msg;
    if(manual) alert(msg);
    console.error(e);
  }
}

/* ---------- 資料正規化（保留時間） ---------- */
function normalize(arr){
  if(!Array.isArray(arr)) return [];
  return arr.map(item=>{
    if(Array.isArray(item)){
      const name = String(item[0] ?? '');
      const t = item[1];
      const time = (typeof t === 'string' ? t : (t==null ? null : String(t)));
      return [name, time ?? null];
    }
    if(typeof item === 'string') return [item, null];
    if(item && typeof item === 'object'){
      const name = String(item.名字 ?? item.name ?? '');
      const t = item.時間 ?? item.time;
      const time = (typeof t === 'string' ? t : (t==null ? null : String(t)));
      return [name, time ?? null];
    }
    return ['', null];
  });
}

/* ---------- 畫面 ---------- */
function render(){
  $list.innerHTML = '';
  items.forEach(([name, time], idx)=>{
    const row = document.createElement('div');
    row.className = 'row';
    row.draggable = true;
    row.dataset.index = String(idx);

    const idxCell = document.createElement('div');
    idxCell.className = 'idx';
    idxCell.textContent = idx + 1;

    const nameInput = document.createElement('input');
    nameInput.className = 'name-input';
    nameInput.type = 'text';
    nameInput.value = name;
    nameInput.placeholder = '輸入名字';
    nameInput.addEventListener('input', e=>{
      // 只改名字，不動時間
      items[idx][0] = e.target.value;
    });

    // 右側動作：每列「新增 / 刪除」
    const actions = document.createElement('div');
    actions.className = 'actions';
    const btnAddBelow = document.createElement('button');
    btnAddBelow.type = 'button';
    btnAddBelow.textContent = '新增';
    btnAddBelow.addEventListener('click', ()=> addRow(idx+1));
    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.textContent = '刪除';
    btnDelete.addEventListener('click', ()=> deleteRow(idx));
    actions.append(btnAddBelow, btnDelete);

    // 第四欄：時間佔位（name.html 用 CSS 隱藏），不寫回 items，避免覆蓋
    const timePlaceholder = document.createElement('div');
    timePlaceholder.textContent = (time ?? '');

    // 拖曳事件
    row.addEventListener('dragstart', onDragStart);
    row.addEventListener('dragover',  onDragOver);
    row.addEventListener('drop',      onDrop);
    row.addEventListener('dragend',   onDragEnd);

    row.append(idxCell, nameInput, actions, timePlaceholder);
    $list.appendChild(row);
  });
}

/* ---------- 拖曳排序 ---------- */
function onDragStart(e){
  dragIndex = Number(e.currentTarget.dataset.index);
  e.dataTransfer.effectAllowed = 'move';
  try{ e.dataTransfer.setData('text/plain', String(dragIndex)); }catch{}
  e.currentTarget.style.opacity = '0.6';
}
function onDragOver(e){
  e.preventDefault();
  e.currentTarget.style.background = '#f9fafb';
}
function onDrop(e){
  e.preventDefault();
  const toIdx = Number(e.currentTarget.dataset.index);
  if (dragIndex === null || toIdx === dragIndex) return;

  // 同步調整 items（名字+時間一起移動）
  const moved = items.splice(dragIndex, 1)[0];
  items.splice(toIdx, 0, moved);

  // 也同步調整 original（保持同順序，方便儲存時保留時間）
  const movedOrig = original.splice(dragIndex, 1)[0];
  original.splice(toIdx, 0, movedOrig);

  dragIndex = null;
  render();
}
function onDragEnd(e){
  e.currentTarget.style.opacity = '';
  Array.from(document.querySelectorAll('.row')).forEach(r=> r.style.background = '');
}

/* ---------- 每列新增 / 刪除 ---------- */
function addRow(insertAt){
  const at = Math.max(0, Math.min(insertAt, items.length));
  items.splice(at, 0, ['', null]);     // 新增空白名字，預設時間 null
  original.splice(at, 0, ['', null]);  // 同步在原始快照放一列（時間預設 null）
  render();
  const input = $list.querySelector(`.row:nth-child(${at+1}) .name-input`);
  if(input) input.focus();
}
function deleteRow(idx){
  if (idx < 0 || idx >= items.length) return;
  items.splice(idx, 1);
  original.splice(idx, 1); // 同步刪除快照中的對應列
  render();
}

/* ---------- 儲存：保留時間，不清空 ---------- */
let saving = false;
async function onSave(){
  if(saving) return;
  saving = true;
  $save.disabled = true;

  try{
    // 以目前 items 的「順序與名字」為準，但時間來自 original 的對位時間
    // （因為我們在拖曳/新增/刪除時，都同步維護了 original 的順序）
    const out = items.map(([name, _], i)=>{
      const time = original[i]?.[1] ?? null; // 保留原本時間（可為 "HHmm" 或 "YYYY-MM-DD HHmm" 或 null）
      const cleanName = (name ?? '').trim();
      return [cleanName, time];
    });

    // 防呆：不允許空白名字（可依需求放寬）
    for(let i=0;i<out.length;i++){
      if(!out[i][0]){
        alert(`第 ${i+1} 列名字是空的，請填寫`);
        saving = false; $save.disabled = false;
        return;
      }
    }

    await saveDataJSON(out);
    const t = new Date().toLocaleTimeString();
    $meta.textContent = `儲存成功（${t}）`;
  }catch(e){
    alert(`儲存失敗：${e.message}`);
  }finally{
    saving = false;
    $save.disabled = false;
  }
}