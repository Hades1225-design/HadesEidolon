// === 設定 ===
const API_URL = "https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/save"; // ← 換成實際 Worker URL
const TARGET_PATH = "public/data.json"; // 寫回 HadesEidolon 專案內的檔案

// 狀態
let MODE = 'json';              // 'txt' | 'json'
let ITEMS = [];                // 目前顯示用的陣列（TXT 模式）
let RAW_JSON = [];             // JSON 模式下的原始陣列（保留其他欄位）
let JSON_KEY = '';             // JSON 顯示欄位 key
let FILTER = '';

const $file = document.getElementById('file');
const $list = document.getElementById('list');
const $mode = document.getElementById('mode');
const $jsonKey = document.getElementById('json-key');
const $q = document.getElementById('q');
const $meta = document.getElementById('meta');

document.getElementById('add').onclick = () => addItem();
document.getElementById('alphasort').onclick = () => { alphaSort(); render(); };
document.getElementById('download-json').onclick = () => downloadJSON();
document.getElementById('download-txt').onclick = () => downloadTXT();
document.getElementById('save-remote').onclick = () => saveRemote();
$file.onchange = (e) => handleFile(e.target.files?.[0]);
$mode.onchange = () => switchMode($mode.value);
$jsonKey.onchange = () => { JSON_KEY = $jsonKey.value; rebuildFromRaw(); render(); };
$q.oninput = () => { FILTER = $q.value.trim().toLowerCase(); render(); };

// 初始
switchMode(MODE);
render();

// ====== 模式切換與 UI ======
function switchMode(m){
  MODE = m;
  if(MODE === 'txt'){
    $jsonKey.disabled = true;
    if (Array.isArray(ITEMS) && ITEMS.length && typeof ITEMS[0] === 'object') {
      ITEMS = RAW_JSON.map(obj => String(obj[JSON_KEY] ?? ''));
    }
  }else{
    $jsonKey.disabled = false;
    if (!RAW_JSON.length) {
      RAW_JSON = ITEMS.map(v => ({ text: String(v) }));
      JSON_KEY = 'text';
      updateJsonKeyOptions(Object.keys(RAW_JSON[0] || {text:''}));
    }
  }
  render();
}

function updateJsonKeyOptions(keys){
  $jsonKey.innerHTML = '';
  for(const k of keys){
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = k;
    if(!JSON_KEY) JSON_KEY = k;
    if(JSON_KEY === k) opt.selected = true;
    $jsonKey.appendChild(opt);
  }
}

// ====== 讀檔 ======
async function handleFile(file){
  if(!file) return;
  const text = await file.text();
  try {
    if(file.name.endsWith('.json') || isLikelyJSON(text)){
      const arr = JSON.parse(text);
      if(!Array.isArray(arr)) throw new Error('JSON 應為陣列');
      MODE = 'json'; $mode.value = 'json';
      RAW_JSON = arr;
      const guess = guessJsonKey(arr);
      JSON_KEY = guess || JSON_KEY || '';
      updateJsonKeyOptions(Object.keys(arr[0] || {text:''}));
      rebuildFromRaw();
    }else{
      MODE = 'txt'; $mode.value = 'txt';
      ITEMS = text.split(/\r?\n/).filter(Boolean);
    }
    $meta.textContent = `已載入：${file.name} · ${new Date().toLocaleTimeString()}`;
    render();
  } catch (e) {
    alert('讀取失敗：' + e.message);
  }
}

function isLikelyJSON(s){
  const t = s.trim();
  return t.startsWith('[') && (t.endsWith(']') || t.endsWith(']\n'));
}
function guessJsonKey(arr){
  const first = arr.find(v => v && typeof v === 'object') || {};
  const prefer = ['title','name','text','label'];
  for(const k of prefer){ if(k in first) return k; }
  const stringKeys = Object.keys(first).filter(k => typeof first[k] === 'string');
  return stringKeys[0] || Object.keys(first)[0];
}
function rebuildFromRaw(){ ITEMS = RAW_JSON.map(o => String(o?.[JSON_KEY] ?? '')); }

// ====== 新增/刪除/排序 ======
function addItem(value=''){
  if(MODE === 'json'){
    if(!RAW_JSON.length && !JSON_KEY){ JSON_KEY = 'text'; RAW_JSON = []; updateJsonKeyOptions(['text']); }
    RAW_JSON.push({ [JSON_KEY]: value });
    rebuildFromRaw();
  }else{
    ITEMS.push(value);
  }
  render(true);
}
function deleteIndex(i){
  if(MODE === 'json'){ RAW_JSON.splice(i,1); rebuildFromRaw(); }
  else{ ITEMS.splice(i,1); }
  render();
}
function alphaSort(){
  if(MODE === 'json'){
    RAW_JSON.sort((a,b) => String(a?.[JSON_KEY] ?? '').localeCompare(String(b?.[JSON_KEY] ?? '')));
    rebuildFromRaw();
  }else{
    ITEMS.sort((a,b) => String(a).localeCompare(String(b)));
  }
}

// ====== 匯出 ======
function downloadJSON(){
  const data = (MODE === 'json') ? RAW_JSON : ITEMS.map(v => ({ text: v }));
  downloadBlob(JSON.stringify(data, null, 2), 'data.json', 'application/json');
}
function downloadTXT(){
  const lines = (MODE === 'json') ? RAW_JSON.map(o => String(o?.[JSON_KEY] ?? '')) : ITEMS.slice();
  downloadBlob(lines.join('\n'), 'data.txt', 'text/plain');
}
function downloadBlob(content, filename, type){
  const blob = new Blob([content], {type});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ====== 儲存到遠端（GitHub via Worker） ======
async function saveRemote(){
  const data = (MODE === 'json') ? RAW_JSON : ITEMS.map(v => ({ text: v }));
  const payload = {
    path: TARGET_PATH,
    content: JSON.stringify(data, null, 2),
    message: "chore: update data.json via reorder web ui"
  };
  try{
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const out = await res.json();
    if(!res.ok) throw new Error(out.error || out.detail || 'unknown error');
    alert("✅ 已儲存成功！Commit: " + out.commit);
  }catch(e){
    alert("❌ 儲存失敗：" + e.message);
  }
}

// ====== 渲染 + 拖曳 ======
function render(focusLast=false){
  const data = getFiltered();
  const $list = document.getElementById('list');
  $list.innerHTML = '';
  data.forEach((val, i) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.draggable = true;

    item.addEventListener('dragstart', (e) => {
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(i));
      item._ghost = document.createElement('div');
      item._ghost.className = 'ghost';
      item.parentNode.insertBefore(item._ghost, item.nextSibling);
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      if(item._ghost){ item._ghost.remove(); item._ghost = null; }
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      const rect = item.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height/2;
      const ghost = document.querySelector('.ghost');
      if(ghost){
        if(before) item.parentNode.insertBefore(ghost, item);
        else item.parentNode.insertBefore(ghost, item.nextSibling);
      }
    });
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromViewIdx = Number(e.dataTransfer.getData('text/plain'));
      const ghost = document.querySelector('.ghost');
      const toViewIdx = Array.from($list.children).indexOf(ghost);
      applyReorder(fromViewIdx, toViewIdx);
      render();
    });

    const handle = document.createElement('span');
    handle.className = 'handle';
    handle.textContent = '≡';

    const idxEl = document.createElement('span');
    idxEl.className = 'idx';
    idxEl.textContent = i+1;

    const input = document.createElement('input');
    input.className = 'grow';
    input.value = String(val);
    input.oninput = () => updateValueAtViewIndex(i, input.value);

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '刪除';
    del.onclick = () => deleteIndex(viewToDataIndex(i));

    item.appendChild(handle);
    item.appendChild(idxEl);
    item.appendChild(input);
    item.appendChild(del);
    $list.appendChild(item);
  });

  if(focusLast && $list.lastElementChild){
    const lastInput = $list.lastElementChild.querySelector('input');
    lastInput?.focus();
  }
}

function getFiltered(){
  if(!FILTER) return getCurrentTexts();
  return getCurrentTexts().filter(v => String(v).toLowerCase().includes(FILTER));
}
function getCurrentTexts(){
  return (MODE === 'json') ? RAW_JSON.map(o => String(o?.[JSON_KEY] ?? '')) : ITEMS.slice();
}
function viewToDataIndex(viewIdx){
  if(!FILTER) return viewIdx;
  const texts = getCurrentTexts();
  const filtered = texts.map((t,i)=>({t,i})).filter(x => x.t.toLowerCase().includes(FILTER));
  return filtered[viewIdx]?.i ?? viewIdx;
}
function updateValueAtViewIndex(viewIdx, newVal){
  const dataIdx = viewToDataIndex(viewIdx);
  if(MODE === 'json'){ RAW_JSON[dataIdx][JSON_KEY] = newVal; rebuildFromRaw(); }
  else{ ITEMS[dataIdx] = newVal; }
}
function applyReorder(fromViewIdx, toViewIdx){
  const from = viewToDataIndex(fromViewIdx);
  const to = viewToDataIndex(toViewIdx);
  if(from === to) return;
  if(MODE === 'json'){
    const [moved] = RAW_JSON.splice(from,1);
    RAW_JSON.splice(to,0,moved);
    rebuildFromRaw();
  }else{
    const [moved] = ITEMS.splice(from,1);
    ITEMS.splice(to,0,moved);
  }
}
