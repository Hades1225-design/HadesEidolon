// /site/PlansHub/plans.js
const WORKER_READ = "https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/read";
const INDEX_PATH  = "public/plans/index.json";

const $list  = document.getElementById('list');
const $meta  = document.getElementById('meta');
const $reload = document.getElementById('reload');
const $status = document.getElementById('filter-status');
const $area   = document.getElementById('filter-area');

let items = [];   // index.json → items
let allAreas = [];

init();
$reload.addEventListener('click', () => init(true));
$status.addEventListener('change', render);
$area.addEventListener('change', render);

async function init(manual=false){
  try{
    const url = `${WORKER_READ}?path=${encodeURIComponent(INDEX_PATH)}&ts=${Date.now()}`;
    const r = await fetch(url, { cache:'no-store' });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    items = Array.isArray(data.items) ? data.items : [];
    allAreas = [...new Set(items.map(x=>x.area).filter(Boolean))].sort();

    // 填充領域篩選清單
    fillAreas();

    render();
    const count = items.length;
    const genAt = data.generated_at ? new Date(data.generated_at).toLocaleString() : '—';
    $meta.textContent = `共 ${count} 筆 · 生成時間：${genAt}`;
  }catch(e){
    items = [];
    render();
    $meta.textContent = `讀取失敗：${e.message}`;
    if(manual) alert(`讀取失敗：${e.message}`);
    console.error(e);
  }
}

function fillAreas(){
  // 清空保留第一個選項
  for(let i=$area.options.length-1;i>=1;i--) $area.remove(i);
  allAreas.forEach(a=>{
    const opt = document.createElement('option');
    opt.value = a; opt.textContent = a;
    $area.appendChild(opt);
  });
}

function render(){
  const s = $status.value.trim();
  const a = $area.value.trim();

  const filtered = items.filter(it=>{
    const okS = !s || String(it.status||'') === s;
    const okA = !a || String(it.area||'') === a;
    return okS && okA;
  });

  filtered.sort((x,y)=>{
    const ux = x.updated || ''; const uy = y.updated || '';
    if(ux !== uy) return (uy > ux ? 1 : -1);
    const px = x.priority || ''; const py = y.priority || '';
    if(px !== py) return (px > py ? 1 : -1);
    return (x.title||'').localeCompare(y.title||'');
  });

  $list.innerHTML = '';
  filtered.forEach(it=>{
    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = it.title || it.id || '(未命名)';

    const row1 = document.createElement('div');
    row1.className = 'row';
    if(it.priority) addPill(row1, `優先：${it.priority}`);
    if(it.status)   addPill(row1, `狀態：${it.status}`);
    if(it.area)     addPill(row1, `領域：${it.area}`);
    if(typeof it.progress === 'number') addPill(row1, `進度：${it.progress}%`);

    const row2 = document.createElement('div');
    row2.className = 'row muted';
    row2.textContent = [
      it.updated ? `更新：${it.updated}` : null,
      it.created ? `建立：${it.created}` : null,
      it.owner   ? `負責：${it.owner}`   : null
    ].filter(Boolean).join('　');

    const linksRow = document.createElement('div');
    linksRow.className = 'row';
    const view = document.createElement('a');
    view.className = 'btn';
    view.textContent = '檔案';
    view.href = `https://github.com/Hades1225-design/HadesEidolon/blob/main/${it.path}`;
    view.target = '_blank';
    linksRow.appendChild(view);

    card.append(title, row1, row2, linksRow);
    $list.appendChild(card);
  });
}

function addPill(row, text){
  const span = document.createElement('span');
  span.className = 'pill';
  span.textContent = text;
  row.appendChild(span);
}