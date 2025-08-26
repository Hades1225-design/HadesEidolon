/* ================== 設定（請改這一行） ================== */
const API_URL   = "https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/save"; // 例：https://hades-json-saver.xxxxx.workers.dev/api/save
const TARGET_PATH = "public/data.json";                                  // 寫回 GitHub 的檔案路徑
const LOCAL_URL   = "../../public/data.json";                            // 直接抓本專案 data.json

/* ================== 狀態 ================== */
let MODE = 'txt';              
let ITEMS = [];                
let RAW_JSON = [];             
let JSON_KEY = '';             
let FILTER = '';               

/* ================== DOM ================== */
const $file   = document.getElementById('file');
const $list   = document.getElementById('list');
const $mode   = document.getElementById('mode');
const $jsonKey= document.getElementById('json-key');
const $q      = document.getElementById('q');
const $meta   = document.getElementById('meta');

/* ================== 事件 ================== */
document.getElementById('add').onclick            = () => addItem();
document.getElementById('alphasort').onclick      = () => { alphaSort(); render(); };
document.getElementById('download-json').onclick  = () => downloadJSON();
document.getElementById('download-txt').onclick   = () => downloadTXT();
document.getElementById('save-remote').onclick    = () => saveRemote();

if (document.getElementById('reload-remote')) {
  document.getElementById('reload-remote').onclick = () => initLoad(true);
}

$file.onchange  = (e) => handleFile(e.target.files?.[0]);
$mode.onchange  = () => switchMode($mode.value);
$jsonKey.onchange = () => { JSON_KEY = $jsonKey.value; rebuildFromRaw(); render(); };
$q.oninput      = () => { FILTER = $q.value.trim().toLowerCase(); render(); };

/* ================== 啟動 ================== */
switchMode(MODE);
render();
initLoad(false); // 開啟頁面時，直接讀本地 data.json

/* ================== 初始化載入 ================== */
async function initLoad(manual=false) {
  try {
    const res = await fetch(LOCAL_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    let arr = JSON.parse(text);
    if (!Array.isArray(arr)) throw new Error("檔案格式錯誤：不是陣列");

    if (arr.length && typeof arr[0] === 'string') {
      arr = arr.map(v => ({ text: String(v) }));
    }

    MODE = 'json';
    $mode.value = 'json';
    RAW_JSON = arr;

    const guess = guessJsonKey(arr);
    JSON_KEY = guess || 'text';
    updateJsonKeyOptions(Object.keys(arr[0] || { text: '' }));

    rebuildFromRaw();
    $meta.textContent = `已載入：${TARGET_PATH} · ${new Date().toLocaleTimeString()}`;
    render();
  } catch (e) {
    if (manual) alert('讀取 data.json 失敗：' + e.message);
    RAW_JSON = [];
    if (MODE === 'json') rebuildFromRaw();
    $meta.textContent = `遠端未載入（顯示空白） · ${new Date().toLocaleTimeString()}`;
    render();
  }
}

/* ================== 模式與資料 ================== */
function switchMode(m){
  MODE = m;
  if(MODE === 'txt'){
    $jsonKey.disabled = true;
    if (RAW_JSON.length && JSON_KEY) {
      ITEMS = RAW_JSON.map(o => String(o?.[JSON_KEY] ?? ''));
    }
  } else {
    $jsonKey.disabled = false;
    if (!RAW_JSON.length) {
      RAW_JSON = ITEMS.map(v => ({ text: String(v) }));
      JSON_KEY = 'text';
      updateJsonKeyOptions(['text']);
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

function guessJsonKey(arr){
  const first = arr.find(v => v && typeof v === 'object') || {};
  const prefer = ['title','name','text','label'];
  for(const k of prefer){ if(k in first) return k; }
  const stringKeys = Object.keys(first).filter(k => typeof first[k] === 'string');
  return stringKeys[0] || Object.keys(first)[0] || 'text';
}

function rebuildFromRaw(){
  ITEMS = RAW_JSON.map(o => String(o?.[JSON_KEY] ?? ''));
}

/* ================== 新增 / 刪除 / 排序 ================== */
function addItem(value=''){
  if(MODE === 'json'){
    if(!RAW_JSON.length && !JSON_KEY){
      JSON_KEY = 'text';
      updateJsonKeyOptions(['text']);
    }
    RAW_JSON.push({ [JSON_KEY]: value });
    rebuildFromRaw();
  }else{
    ITEMS.push(value);
  }
  render(true);
}

function deleteIndex(i){
  if(MODE === 'json'){
    RAW_JSON.splice(i,1);
    rebuildFromRaw();
  }else{
    ITEMS.splice(i,1);
  }
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

/* ================== 匯出 ================== */
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

/* ================== 儲存到遠端（GitHub via Worker） ================== */
async function saveRemote(){
  const data = (MODE === 'json') ? RAW_JSON : ITEMS.map(v => ({ text: v }));
  const payload = {
    path: TARGET_PATH,
    content: JSON.stringify(data, null, 2),
    message: "chore: update data.json via reorder web ui"
  };

  if (!/^https?:\/\//.test(API_URL)) {
    alert('❌ 儲存失敗：API_URL 無效（需要含 https://）');
    return;
  }

  try{
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });

    const outText = await res.text();
    let out; try { out = JSON.parse(outText); } catch { out = { raw: outText }; }

    if(!res.ok){
      const detail = out.github_raw ? stringifyMaybeJSON(out.github_raw) : (out.error || out.detail || out.raw || 'unknown');
      alert(`❌ 儲存失敗\nstatus: ${res.status}\n${detail}`);
      return;
    }

    if (out.commit) {
      const now = new Date();
      $meta.textContent = `已儲存：${now.toLocaleString()} · commit ${String(out.commit).slice(0,7)}`;
    }
    alert(`✅ 已儲存成功！${out.commit ? 'commit: '+out.commit : ''}`);
  }catch(e){
    alert("❌ 連線失敗：" + e.message);
  }
}

function stringifyMaybeJSON(v){
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

/* ================== 渲染 + 拖曳（含手機 ▲▼） ================== */
function render(focusLast=false){
  const data = getFiltered();
  $list.innerHTML = '';
  data.forEach((val, i) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.draggable = true;

    // 拖曳（桌機）
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

    // 句柄（觸控拖曳）
    const handle = document.createElement('span');
    handle.className = 'handle';
    handle.textContent = '≡';
    handle.style.touchAction = 'none';
    handle.onpointerdown = (e) => {
      e.preventDefault();
      const origIndex = i;
      item.classList.add('dragging');
      const ghost = document.createElement('div');
      ghost.className = 'ghost';
      item.parentNode.insertBefore(ghost, item.nextSibling);

      const move = (evt) => {
        const y = evt.clientY || 0;
        const siblings = Array.from($list.children).filter(el => el !== item);
        for (const s of siblings) {
          const r = s.getBoundingClientRect();
          const before = y < r.top + r.height / 2;
          if (before) { $list.insertBefore(ghost, s); break; }
          if (s === siblings[siblings.length-1]) { $list.appendChild(ghost); }
        }
      };
      const up = () => {
        item.classList.remove('dragging');
        const toViewIdx = Array.from($list.children).indexOf(ghost);
        ghost.remove();
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        applyReorder(origIndex, toViewIdx);
        render();
      };
      window.addEventListener('pointermove', move, { passive:false });
      window.addEventListener('pointerup', up, { passive:false });
    };

    const idxEl = document.createElement('span');
    idxEl.className = 'idx';
    idxEl.textContent = i+1;

    const input = document.createElement('input');
    input.className = 'grow';
    input.value = String(val);
    input.oninput = () => updateValueAtViewIndex(i, input.value);
    input.onfocus = () => { try { input.scrollIntoView({ block: 'center' }); } catch {} };

    // ▲▼（手機保底）
    const up = document.createElement('button');
    up.textContent = '▲';
    up.onclick = () => { applyReorder(i, Math.max(0, i-1)); render(); };

    const down = document.createElement('button');
    down.textContent = '▼';
    down.onclick = () => { applyReorder(i, Math.min(getCurrentTexts().length-1, i+1)); render(); };

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '刪除';
    del.onclick = () => deleteIndex(viewToDataIndex(i));

    item.appendChild(handle);
    item.appendChild(idxEl);
    item.appendChild(input);
    item.appendChild(up);
    item.appendChild(down);
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
  if(from === to || from < 0 || to < 0) return;
  if(MODE === 'json'){
    const [moved] = RAW_JSON.splice(from,1);
    RAW_JSON.splice(to,0,moved);
    rebuildFromRaw();
  }else{
    const [moved] = ITEMS.splice(from,1);
    ITEMS.splice(to,0,moved);
  }
}