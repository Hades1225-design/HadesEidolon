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

  items.forEach(([name, t], idx) => {
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

    // 時間輸入框
    const input = document.createElement('input');
    input.className = 'time-input';
    input.type = 'text';
    input.value = t ?? '';
    input.placeholder = 'HHmm';

    // 僅允許 4 位數字，自動補 0
    input.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g,'').slice(0,4);
      e.target.value = v;
    });

    // Enter → 跳到下一欄
    input.addEventListener('keydown', e => {
      if(e.key === 'Enter'){
        const inputs = [...document.querySelectorAll('.time-input')];
        const next = inputs[inputs.indexOf(e.target) + 1];
        if(next) next.focus();
      }
    });

    // 更新資料
    input.addEventListener('change', e => {
      items[idx][1] = e.target.value || null;
    });

    row.append(idxCell, nameCell, input);
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