// /site/PlansHub/assets/index.js
// PlansHub：讀取 public/planshub/index.json 並渲染清單
// 讀檔策略：先走 Cloudflare Worker（即時），失敗則退回 GitHub Pages 靜態檔

const WORKER_READ =
  "https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/read?path=public/planshub/index.json";

const STATIC_JSON = (() => {
  // 依倉庫根路徑自動推斷，避免子路徑出錯
  const parts = location.pathname.split("/").filter(Boolean);
  const repoBase = parts.length > 0 ? `/${parts[0]}/` : "/";
  return `${repoBase}public/planshub/index.json`;
})();

/* ---------- DOM ---------- */
const $list = document.getElementById("plans");
const $meta = document.getElementById("meta");
const $reload = document.getElementById("reload");

/* ---------- 事件 ---------- */
$reload?.addEventListener("click", () => init(true));

/* ---------- 進入點 ---------- */
init(false);

async function init(manual) {
  setMeta("讀取中…");
  try {
    const data = await loadIndexJSON();
    render(data);
    setMeta(
      `來源：${data.__source}　版本：${data.version || "—"}　生成：${
        data.generated_at ? new Date(data.generated_at).toLocaleString() : "—"
      }　共 ${Array.isArray(data.items) ? data.items.length : 0} 筆`
    );
  } catch (e) {
    console.error(e);
    setMeta(`讀取失敗：${e.message}`);
    if (manual) alert(`讀取失敗：${e.message}`);
    $list.innerHTML = "";
  }
}

/* ---------- 讀檔：Worker → 靜態備援 ---------- */
async function loadIndexJSON() {
  // 1) Worker（即時）
  try {
    const r = await fetch(`${WORKER_READ}&ts=${Date.now()}`, { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      j.__source = "Worker";
      return j;
    }
    console.warn("Worker read failed:", r.status);
  } catch (e) {
    console.warn("Worker read error:", e);
  }

  // 2) 靜態（GitHub Pages）
  const r2 = await fetch(`${STATIC_JSON}?ts=${Date.now()}`, { cache: "no-store" });
  if (!r2.ok) {
    throw new Error(`HTTP ${r2.status}（靜態讀取失敗）`);
  }
  const j2 = await r2.json();
  j2.__source = "Static";
  return j2;
}

/* ---------- 畫面 ---------- */
function render(data) {
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) {
    $list.innerHTML = `<li class="empty">目前沒有計劃</li>`;
    return;
  }

  // 依優先度與狀態排序：P0→P1→P2…，ongoing→inbox→done
  const prioRank = v => (String(v || "").toUpperCase().match(/^P(\d+)/)?.[1] ?? 9) | 0;
  const statusRankMap = { ongoing: 0, inbox: 1, done: 2 };
  const statusRank = v => statusRankMap[String(v || "").toLowerCase()] ?? 9;

  const sorted = [...items].sort((a, b) => {
    const pa = prioRank(a.priority), pb = prioRank(b.priority);
    if (pa !== pb) return pa - pb;
    const sa = statusRank(a.status), sb = statusRank(b.status);
    if (sa !== sb) return sa - sb;
    // 次排序：updated 新→舊
    return (new Date(b.updated || 0)) - (new Date(a.updated || 0));
  });

  $list.innerHTML = sorted.map(it => toItemHTML(it)).join("");
}

function toItemHTML(it) {
  const title = escapeHTML(it.title || "(未命名)");
  const area = escapeHTML(it.area || "-");
  const prio = escapeHTML(it.priority || "-");
  const status = escapeHTML(it.status || "-");
  const progress = Number.isFinite(it.progress) ? `${it.progress}%` : "-";
  const updated = it.updated ? new Date(it.updated).toLocaleDateString() : "-";

  // 連到原 Markdown（以 repo 根推斷）
  const mdHref = toRepoHref(it.path);

  return `
    <li class="plan">
      <div class="plan-title">
        <a href="${mdHref}" target="_blank" rel="noopener">${title}</a>
      </div>
      <div class="plan-meta">
        <span class="tag">Area: ${area}</span>
        <span class="tag">Priority: ${prio}</span>
        <span class="tag">Status: ${status}</span>
        <span class="tag">Progress: ${progress}</span>
        <span class="tag">Updated: ${updated}</span>
      </div>
    </li>
  `;
}

/* ---------- 小工具 ---------- */
function setMeta(text) {
  if ($meta) $meta.textContent = text;
}

function toRepoHref(relPath) {
  // 將 site/PlansHub/ 作為根，指到同 repo 的原始檔
  // 例：plans/xxx.md → /HadesEidolon/site/PlansHub/plans/xxx.md
  const parts = location.pathname.split("/").filter(Boolean);
  const repoBase = parts.length > 0 ? `/${parts[0]}/` : "/";
  const base = `${repoBase}site/PlansHub/`;
  const safe = String(relPath || "").replace(/^\/+/, "");
  return base + safe;
}

function escapeHTML(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}