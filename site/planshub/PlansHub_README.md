# PlansHub 使用說明書

集中管理所有計劃的清單與內容，支援多計劃管理、索引自動化、Markdown 詳細內容查看。

---

## 📂 目錄結構

```bash
/site/PlansHub/
├─ index.html                # 計劃清單（可篩選/排序/搜尋）
├─ plan.html                 # 單一計劃閱讀頁（用 ?path=plans/xxx.md）
├─ assets/
│  ├─ planshub.css           # 共用樣式
│  ├─ planshub.js            # 清單頁 JS（讀 index.json、渲染卡片）
│  ├─ plan-viewer.js         # 詳細頁 JS（抓 md → 轉 HTML）
│  └─ vendor/
│     ├─ marked.min.js       # Markdown 轉 HTML（前端）
│     └─ dayjs.min.js        # 時間處理（可選）
├─ templates/
│  └─ plan-template.md       # 新計劃模板（複製後填寫）
└─ README.md                 # 子站說明（本文件）

/public/plans/
├─ index.json                # 計劃索引（Worker 產生/覆寫）
└─ plans/
   ├─ Lineage-Boss-Time.md
   ├─ ... 其他 MD
   └─ _archive/              # 歷史/封存（選用）
```

> `index.json` 是 PlansHub 前端讀取的唯一入口，所有計劃會從這裡載入。

---

## 🧩 index.json 結構

```json
{
  "version": "2.0.0",
  "generated_at": "2025-08-29T03:25:34.916Z",
  "items": [
    {
      "id": "plan-YYYY-MM-DD-slug",
      "title": "人類可讀的計劃名稱",
      "area": "infra|web|ios|writing|hackintosh|other",
      "priority": "P0|P1|P2|P3",
      "status": "inbox|ongoing|paused|blocked|done",
      "owner": "Hades",
      "progress": 0,
      "risk": "low|medium|high",
      "due": "YYYY-MM-DD|null",
      "tags": ["string", "..."],
      "links": ["URL", "..."],
      "path": "plans/xxx.md",
      "created": "YYYY-MM-DD",
      "updated": "YYYY-MM-DD",
      "preview": "（擷取第一個章節的前幾行文字）",
      "headings": ["目標","里程碑","下一步"]
    }
  ],
  "areas": ["infra","web","ios","writing","hackintosh"]
}
```

---

## 📝 計劃 Markdown 模板

檔案：`/site/PlansHub/templates/plan-template.md`

```md
# ${TITLE}

- ID: plan-${DATE}-${SLUG}
- Area: ${AREA}
- Priority: P2
- Status: inbox
- Owner: Hades
- Created: ${DATE}
- Updated: ${DATE}
- Tags: tag1, tag2
- Due: (optional)

## 目標
- …

## 里程碑
- [ ] M1 — …
- [ ] M2 — …

## 下一步
- [ ] N1 — …
- [ ] N2 — …

## 風險
- 風險A：緩解措施…
```

> 新增計劃時，複製模板 → 放入 `/public/plans/plans/xxx.md` → 觸發 Worker 或 Actions 更新 `index.json`。

---

## 🖥️ 前端頁面

### **1. index.html**（清單頁）
- 自動讀取 `/public/plans/index.json`
- 功能：
  - 搜尋（title/tags）
  - 篩選（area/status/priority）
  - 排序（預設：updated desc）
- 點卡片 → 跳轉 `plan.html?path=plans/xxx.md`

### **2. plan.html**（詳細頁）
- 讀取 `?path` 參數
- 優先走 Worker `/api/read`
- 用 `marked.js` 將 Markdown 轉 HTML

---

## ⚡ 資料流設計

### **A. Worker 即時模式（推薦 ✅）**
1. 前端新增或修改計劃 → **直接呼叫 Worker** → 寫入 `.md`
2. Worker 提供 `/api/rebuild-index` 端點
3. Worker 重新掃描 `/public/plans/plans/*.md` → 更新 `/public/plans/index.json`
4. 前端即時可讀，不需等 GitHub Actions

### **B. GitHub Actions 模式（備用）**
1. push `.md` → 觸發 Actions
2. Node 腳本生成 `index.json`
3. commit 回 repo

---

## 🏷️ 命名與欄位規範

| 欄位     | 說明 |
|----------|---------------------------|
| **id**      | `plan-YYYY-MM-DD-slug` |
| **area**    | `infra / web / ios / writing / hackintosh / other` |
| **priority**| `P0 / P1 / P2 / P3` |
| **status**  | `inbox / ongoing / paused / blocked / done` |
| **path**    | `plans/xxx.md` |
| **progress**| 0–100 |
| **tags**    | 自由標籤 |
| **preview** | 由 Worker 自動抓取文件開頭內容 |

---

## 🚀 工作流程

1. **新增計劃**
   - 複製模板 → 放入 `/public/plans/plans/xxx.md`
2. **更新索引**
   - 呼叫 Worker `/api/rebuild-index`
3. **前端顯示**
   - `index.html` → 最新 `index.json`
   - `plan.html` → Markdown 詳細內容

---

## 📌 註記

- **作者**：Hades ＆ Nyx
- 所有計劃統一管理，未來可以自動生成 Dashboard、統計報告
- Worker + index.json 設計支援即時性，不需等 GitHub Pages 部署
