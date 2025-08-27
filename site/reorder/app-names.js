import { fetchDataJSON, saveDataJSON } from './common.js';

const $list = document.getElementById('list');
const $meta = document.getElementById('meta');
const $reload = document.getElementById('reload');
const $save = document.getElementById('save');

let items = []; // [[name, hhmm|null], ...]

init(false);

$reload.onclick = () => init(true);
$save.onclick = saveChanges;

async function init(manual){
  try{
    const arr = await fetchDataJSON();
    items = normalize(arr);
    render();
    $meta.textContent = `讀取成功，共 ${items.length} 筆`;
  }catch(e){
    items = [];
    render();
    $meta.textContent = `讀取失敗：${e.message}`;
    if(manual) alert(e.message);
  }
}

function normalize(arr){
  if(!Array.isArray(arr)) return [];
  return arr.map(item => {
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

function render(){
  $list.innerHTML = '';

  items.forEach(([name], idx) => {
    const row = document.createElement('div');
    row.className = 'row';

    // 編號
    const idxCell = document.createElement('div');
    idxCell.className = 'idx';
    idxCell.textContent = idx + 1;

    // 名字（可編輯）
    const nameInput = document.createElement('input');
    nameInput.className = 'name-input';
    nameInput.type = 'text';
    nameInput.value = name;
    nameInput.addEventListener('input', e => {
      items[idx][0] = e.target.value.trim();
    });

    // 時間欄位占位，已由 name.html 隱藏
    const hiddenTime = document.createElement('div');

    row.append(idxCell, nameInput, hiddenTime);
    $list.appendChild(row);
  });
}

async function saveChanges(){
  try{
    await saveDataJSON(items);
    $meta.textContent = `儲存成功 (${new Date().toLocaleTimeString()})`;
    alert('已成功儲存到伺服器！');
  }catch(e){
    alert(`儲存失敗：${e.message}`);
  }
}