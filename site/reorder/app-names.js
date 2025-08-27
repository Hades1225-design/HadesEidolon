// site/reorder/app-names.js
import {
  fetchDataJSON, saveDataJSON, currentFileLabel,
  fetchLastCommitTime, urlWithFile, goHomeAfterSave
} from './common.js';

const $list   = document.getElementById('list');
const $meta   = document.getElementById('meta');
const $reload = document.getElementById('reload');
const $save   = document.getElementById('save');

let items = []; // [[name, time|null], ...]

init(false);
$reload?.addEventListener('click', () => init(true));
$save?.addEventListener('click', onSave);

async function init(manual){
  try{
    const arr = await fetchDataJSON();
    items = normalize(arr);
    render();

    // 顯示檔名 + 筆數 + 最後更新
    const iso  = await fetchLastCommitTime().catch(()=>null);
    const when = iso ? new Date(iso).toLocaleString() : '未知';
    $meta.textContent = `檔案：${currentFileLabel()} · 共 ${items.length} 筆 · 最後更新：${when}`;
  }catch(e){
    items = [];
    render();
    const msg = `讀取失敗：${e.message}`;
    $meta.textContent = msg;
    if(manual) alert(msg);
    console.error(e);
  }
}

function normalize(arr){
  if(!Array.isArray(arr)) return [];
  return arr.map(item=>{
    if(Array.isArray(item)) return [String(item[0] ?? ''), normTime(item[1])];
    if(typeof item === 'string') return [item, null];
    if(item && typeof item === 'object'){
      const name = String(item.名字 ?? item.name ?? '');
      const t = item.時間 ?? item.time ?? null;
      return [name, normTime(t)];
    }
    return ['', null];
  });
}
function normTime(t){
  if(t == null || t === '') return null;
  if(typeof t !== 'string') return null;
  const s = t.trim();
  if(/^\d{4}$/.test(s)) return s;                         // HHmm
  if(/^\d{4}-\d{2}-\d{2}\s\d{4}$/.test(s)) return s;      // YYYY-MM-DD HHmm
  return null;
}

/* ---------------- 渲染（含新增 / 刪除 / 拖曳） ---------------- */
function render(){
  $list.innerHTML = '';

  items.forEach(([name, t], i)=>{
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.index = String(i);

    // 編號
    const idx = document.createElement('div');
    idx.className = 'idx';
    idx.textContent = String(i+1);

    // 名字輸入
    const input = document.createElement('input');
    input.className = 'name-input';
    input.type = 'text';
    input.placeholder = '輸入名字…';
    input.value = name;
    input.addEventListener('input', e=>{
      items[i][0] = e.target.value;
    });

    // 新增（在此列下方插入一筆；時間沿用本列時間）
    const btnAdd = document.createElement('button');
    btnAdd.textContent = '新增';
    btnAdd.className = 'btn-add';
    btnAdd.addEventListener('click', ()=>{
      items.splice(i+1, 0, ['', t ?? null]);
      render();
      // 聚焦新列
      const el = $list.querySelector(`.row:nth-child(${i+2}) .name-input`);
      el?.focus();
    });

    // 刪除
    const btnDel = document.createElement('button');
    btnDel.textContent = '刪除';
    btnDel.className = 'btn-del';
    btnDel.addEventListener('click', ()=>{
      items.splice(i, 1);
      render();
    });

    row.append(idx, input, btnAdd, btnDel);
    $list.appendChild(row);
  });

  // 綁拖曳
  bindDragSort();
}

/* ---------------- 拖曳排序（以滑鼠 Y 位置決定插入點） ---------------- */
function bindDragSort(){
  let draggingEl = null;
  let fromIndex = -1;

  $list.querySelectorAll('.row').forEach(row=>{
    row.draggable = true;

    row.addEventListener('dragstart', (e)=>{
      draggingEl = row;
      fromIndex = +row.dataset.index;
      row.classList.add('ghost');
      e.dataTransfer?.setData('text/plain', String(fromIndex));
    });

    row.addEventListener('dragend', ()=>{
      draggingEl?.classList.remove('ghost');
      draggingEl = null;
      fromIndex = -1;
    });

    row.addEventListener('dragover', (e)=>{
      e.preventDefault();
      const over = e.currentTarget;
      if(!draggingEl || over === draggingEl) return;
      const rect = over.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      // 視覺上先移動
      if(before) {
        $list.insertBefore(draggingEl, over);
      } else {
        $list.insertBefore(draggingEl, over.nextSibling);
      }
    });

    row.addEventListener('drop', (e)=>{
      e.preventDefault();
      const children = Array.from($list.children);
      const newIndex = children.indexOf(draggingEl);
      if(fromIndex === -1 || newIndex === -1 || newIndex === fromIndex) return;

      const [moved] = items.splice(fromIndex, 1);
      items.splice(newIndex, 0, moved);
      render();
    });
  });
}

/* ---------------- 儲存 ---------------- */
async function onSave(){
  try{
    await saveDataJSON(items, "update names");
    // 儲存成功後回首頁（保留 ?file）
    goHomeAfterSave('./index.html');
  }catch(e){
    alert(`儲存失敗：${e.message}`);
    console.error(e);
  }
}