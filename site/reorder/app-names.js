// site/reorder/app-names.js
import {
  fetchDataJSON, saveDataJSON, currentFileLabel,
  fetchLastCommitTime, urlWithFile, goHomeAfterSave
} from './common.js';

const $list = document.getElementById('list');
const $meta = document.getElementById('meta');
const $reload = document.getElementById('reload');
const $save = document.getElementById('save');

let items = []; // [[name, time|null], ...]

init(false);
$reload.onclick = () => init(true);
$save.onclick   = onSave;

async function init(manual){
  try{
    const arr = await fetchDataJSON();
    items = normalize(arr);
    render();
    $meta.textContent = `檔案：${currentFileLabel()} · 共 ${items.length} 筆`;
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
    if(Array.isArray(item)) return [String(item[0] ?? ''), item[1] ?? null];
    if(typeof item === 'string') return [item, null];
    if(item && typeof item === 'object'){
      const name = String(item.名字 ?? item.name ?? '');
      const t = item.時間 ?? item.time ?? null;
      return [name, t];
    }
    return ['', null];
  });
}

function render(){
  $list.innerHTML = '';
  items.forEach(([name, t], i)=>{
    const row = document.createElement('div');
    row.className = 'row';

    const idx = document.createElement('div');
    idx.className = 'idx';
    idx.textContent = i+1;

    const nameIn = document.createElement('input');
    nameIn.className = 'name-input';
    nameIn.value = name;
    nameIn.oninput = e => items[i][0] = e.target.value.trim();

    // 右側按鈕：新增、刪除（按你之前的 UI）
    const addBtn = document.createElement('button');
    addBtn.textContent = '新增';
    addBtn.onclick = () => { items.splice(i+1,0,["", t??null]); render(); };

    const delBtn = document.createElement('button');
    delBtn.textContent = '刪除';
    delBtn.onclick = () => { items.splice(i,1); render(); };

    row.append(idx, nameIn, addBtn, delBtn);
    $list.appendChild(row);

    // 支援拖曳（簡易）
    row.draggable = true;
    row.ondragstart = ev => ev.dataTransfer.setData('text/plain', i.toString());
    row.ondragover  = ev => ev.preventDefault();
    row.ondrop = ev => {
      ev.preventDefault();
      const from = +ev.dataTransfer.getData('text/plain');
      const [moved] = items.splice(from,1);
      const to = i + (from < i ? 0 : 0);
      items.splice(to,0,moved);
      render();
    };
  });
}

async function onSave(){
  try{
    await saveDataJSON(items, "update times");
    alert('儲存成功！');
    
    // 回首頁並保留 file 參數
    const qs = new URLSearchParams(location.search);
    const file = qs.get('file');
    const url = new URL("./index.html", location.href);
    if (file) url.searchParams.set('file', file);
    location.href = url.toString();

  }catch(e){
    alert(`儲存失敗：${e.message}`);
  }
}

