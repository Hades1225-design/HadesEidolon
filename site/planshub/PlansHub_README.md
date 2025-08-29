# 🗂 PlansHub — 計劃管理系統

PlansHub 是一個集中管理計劃的子站，負責維護 **計劃 Markdown 檔案**、自動生成 **索引 JSON**，  
並為前端或 API 提供統一資料來源，方便在網站、工具或 ChatGPT 中同步管理。

---

## 📁 專案目錄結構

```
/site/PlansHub/
├── plans/                    # 📝 計劃 Markdown 檔案
│   ├── hackintosh-stability.md
│   ├── dialogue-journal-cadence.md
│   ├── ios18-voice-explore.md
│   ├── daily-planning.md
│   ├── Project-NyxStream.md
│   ├── planning-hub-meta.md
│   ├── Lineage-Boss-Time.md
│   └── hp800g5dm-thermal-vents.md
│
├── README.md                 # 📖 本說明文件
├── index.html                # PlansHub 主頁
│
├── assets/                   # 🌐 PlansHub 前端資源
│   ├── index.js              # PlansHub 前端控制邏輯
│   └── style.css             # UI 樣式設定
│
/public/
└── planshub/
    └── index.json            # ⛓ 計劃總覽 JSON，由 CI 自動生成
```

---

## 🧩 系統運作流程

### 1. 計劃維護
- 所有計劃都以 Markdown (`.md`) 格式放在 `/site/PlansHub/plans/`
- 檔案命名格式：
  ```
  YYYY-MM-DD-plan-title.md
  ```
- 每個計劃 Markdown 包含：
  - **Meta 區塊**（YAML frontmatter）
  - **內容區塊**（目標、任務、進度、風險、下一步等）

---

### 2. JSON 匯總檔
系統會自動掃描 `/site/PlansHub/plans/` 下的所有 Markdown 檔案，  
解析 Meta 資料並匯總到 `./public/planshub/index.json`。

**範例：`index.json`**
```json
{
  "version": "2.0.0",
  "generated_at": "2025-08-29T03:25:34.916423Z",
  "items": [
    {
      "id": "plan-2025-08-28-lineage-boss-time",
      "title": "天堂 BOSS 時間管理系統",
      "area": "web",
      "priority": "P1",
      "status": "ongoing",
      "owner": "Hades",
      "progress": 70,
      "risk": "medium",
      "due": null,
      "path": "plans/Lineage-Boss-Time.md",
      "created": "2025-08-26",
      "updated": "2025-08-28",
      "preview": "## 目標",
      "headings": ["目標", "任務", "風險", "下一步"]
    }
  ],
  "areas": ["hackintosh", "infra", "ios", "web", "writing"]
}
```

---

### 3. API 設計

> **Cloudflare Worker** 提供安全、即時、免 GitHub API 流量限制的讀取與寫入。

#### **讀取 JSON**
```bash
GET https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/read?path=public/planshub/index.json
```

#### **寫入 JSON**
```bash
POST https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/save
Content-Type: application/json

{
  "path": "public/planshub/index.json",
  "content": { ...JSON 內容... },
  "message": "update plans index [skip ci]"
}
```

> **建議**：前端讀檔統一走 Worker API，避免 GitHub API 的流量限制。

---

### 4. CI 自動化
- 當計劃 Markdown 檔案有新增或修改時，  
  GitHub Actions 會自動：
  1. 掃描 `/site/PlansHub/plans/`
  2. 重新生成 `./public/planshub/index.json`
  3. 部署到 GitHub Pages

---

### 5. 前端讀檔邏輯

**`/site/PlansHub/assets/index.js`**
```js
export async function fetchPlans() {
  const url = `https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/read?path=public/planshub/index.json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`讀取失敗：HTTP ${res.status}`);
  return await res.json();
}
```

---

## 🔧 後續優化方向
- [ ] 計劃搜尋功能
- [ ] 計劃標籤系統
- [ ] 多子站計劃匯總
- [ ] 計劃依進度或優先度自動排序
- [ ] 前端圖表視覺化計劃進度

---

## 👨‍💻 作者
**Hades** — 系統設計、架構與計劃管理  
**Nyx** — AI 協作助理、資料處理與流程優化

---

## 🏷️ 版本
**v2.0.0** · 更新於 **2025-08-29**