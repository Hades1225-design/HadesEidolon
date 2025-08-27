import { fetchDataJSON, saveDataJSON } from './common.js';

const $list   = document.getElementById('list');
const $meta   = document.getElementById('meta');
const $reload = document.getElementById('reload');
const $save   = document.getElementById('save');

let items = [];            // [[name, hhmm|null], ...]
let dragIndex = null;      // 目前拖曳中的起始索引

init(false);

// 工具列事件
$reload.onclick = () => init(true);
$save.onclick   = onSave;

// 初始化載入
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

// 正規化資料
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

// 重新渲染清單
function render(){
  $list.innerHTML = '';
  items.forEach(([name, time], idx)=>{
    const row = document.createElement('div');
    row.className = 'row';
    row.draggable = true;
    row.dataset.index = String(idx);

    // 編號
    const idxCell = document.createElement('div');
    idxCell.className = 'idx';
    idxCell.textContent = idx + 1;

    // 名字（可編輯）
    const nameInput = document.createElement('input');
    nameInput.className = 'name-input';
    nameInput.type = 'text';
    nameInput.value = name;
    nameInput.placeholder = '輸入名字';
    nameInput.addEventListener('input', e=>{
      items[idx][0] = e.target.value;
    });

    // 動作（每列：新增 / 刪除）
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

    // 時間佔位（name.html 會用 CSS 隱藏）
    const timePlaceholder = document.createElement('div');
    timePlaceholder.textContent = time ?? '';

    // 拖曳事件
    row.addEventListener('dragstart', onDragStart);
    row.addEventListener('dragover',  onDragOver);
    row.addEventListener('drop',       onDrop);
    row.addEventListener('dragend',    onDragEnd);

    row.append(idxCell, nameInput, actions, timePlaceholder);
    $list.appendChild(row);
  });
}

// 拖曳事件
function onDragStart(e){
  const idx = Number(e.currentTarget.dataset.index);
  dragIndex = idx;
  e.dataTransfer.effectAllowed = 'move';
  try{ e.dataTransfer.setData('text/plain', String(idx)); }catch{}
  e.currentTarget.style.opacity = '0.6';
}
function onDragOver(e){
  e.preventDefault();
  const overRow = e.currentTarget;
  overRow.style.background = '#f9fafb';
}
function onDrop(e){
  e.preventDefault();
  const toIdx = Number(e.currentTarget.dataset.index);
  if (dragIndex === null || toIdx === dragIndex) return;

  const moved = items.splice(dragIndex, 1)[0];
  items.splice(toIdx, 0, moved);
  dragIndex = null;
  render();
}
function onDragEnd(e){
  e.currentTarget.style.opacity = '';
  Array.from(document.querySelectorAll('.row')).forEach(r=> r.style.background = '');
}

// 每列 新增 / 刪除
function addRow(insertAt){
  const at = Math.max(0, Math.min(insertAt, items.length));
  items.splice(at, 0, ['', null]);
  render();
  const input = $list.querySelector(`.row:nth-child(${at+1}) .name-input`);
  if(input) input.focus();
}
function deleteRow(idx){
  if (idx < 0 || idx >= items.length) return;
  items.splice(idx, 1);
  render();
}

// 儲存
let saving = false;
async function onSave(){
  if(saving) return;
  saving = true;
  $save.disabled = true;
  try{
    await saveDataJSON(items);
    const t = new Date().toLocaleTimeString();
    $meta.textContent = `儲存成功（${t}）`;
  }catch(e){
    alert(`儲存失敗：${e.message}`);
  }finally{
    saving = false;
    $save.disabled = false;
  }
}