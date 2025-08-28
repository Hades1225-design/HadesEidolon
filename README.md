# HadesEidolon

> **HadesEidolon** 是一個以 **GitHub Pages** + **Cloudflare Workers**
> 為基礎的個人化計劃管理系統，專注於 **Boss 時間表** 與 **計劃管理**。
> 核心功能包括即時 JSON 管理、可視化排序工具、跨子站共用架構。

------------------------------------------------------------------------

## 🌐 專案架構

``` bash
HadesEidolon/
├── site/                     # 所有子站 (GitHub Pages)
│   ├── reorder/              # Boss 時間 / 名字排序子站
│   │   ├── index.html        # 主頁
│   │   ├── app-names.js      # 名字編輯器
│   │   ├── app-time.js       # 時間編輯器
│   │   ├── common.js         # 共用工具 (讀寫 JSON, URL 推斷, Worker API)
│   │   ├── editor.css        # 編輯器樣式
│   │   └── index.js          # 主頁邏輯
│   └── ...                  # 未來子站放這裡
├── public/
│   ├── reorder/              # Boss 時間相關 JSON 檔案
│   │   ├── data.json         # 預設檔案
│   │   ├── mikey465.json     # 自訂 JSON 範例
│   │   └── ...              
│   └── ...                  # 其他子站 JSON 資料
└── README.md
```

------------------------------------------------------------------------

## 🚀 功能特色

### 1. 即時資料讀寫

-   所有資料透過 **Cloudflare Worker** API 寫入 GitHub
-   讀檔預設走 Worker `/api/read` → 確保即時顯示更新結果
-   Worker 掛了會自動備援 GitHub Contents API

### 2. 多模式網址存取

#### **同一份 JSON 可用以下網址打開**

-   `/site/reorder/` → `public/reorder/data.json`
-   `/site/reorder/data` → `public/reorder/data.json`
-   `/site/reorder/mikey465` → `public/reorder/mikey465.json`
-   `/site/reorder/mikey465.json` → 同上
-   `/site/reorder/?file=mikey465` → 同上
-   `/site/reorder/index.html?file=mikey465.json` → 同上

> 無論是否帶 `.json`，都會自動解析為正確路徑。

------------------------------------------------------------------------

## 🛠️ Worker API

### 1. 讀檔 `GET /api/read`

``` bash
https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/read?path=public/reorder/data.json
```

**參數** - `path`: 必填，目標 JSON 路徑 - 回傳：即時 JSON 內容

### 2. 寫檔 `POST /api/save`

``` bash
https://hadeseidolon-json-saver.b5cp686csv.workers.dev/api/save
```

**Body**

``` json
{
  "path": "public/reorder/data.json",
  "content": [ ["名字", "2025-08-28 0530"], ... ],
  "message": "update via web [skip ci]"
}
```

------------------------------------------------------------------------

## 🧩 前端共用邏輯 (`common.js`)

-   **自動推斷 JSON 路徑**
    -   依 `/site/<slug>/` → 預設對應 `public/<slug>/data.json`
    -   支援 `.json` 省略
-   **即時讀取 JSON**（優先 Worker，備援 GitHub API）
-   **寫入 JSON**（Cloudflare Worker → GitHub Commit）
-   **最後更新時間**：會直接查 GitHub Commit API

------------------------------------------------------------------------

## 🗺 未來規劃

-   [ ] `/site/plan/`：計劃清單管理
-   [ ] `/site/dashboard/`：跨子站總覽視覺化
-   [ ] `/site/settings/`：全域設定管理

------------------------------------------------------------------------

## 📎 範例

打開 **Boss 時間表** 預設資料：

    https://hades1225-design.github.io/HadesEidolon/site/reorder/

切換到 `mikey465.json`：

    https://hades1225-design.github.io/HadesEidolon/site/reorder/mikey465

------------------------------------------------------------------------

## 🧑‍💻 作者

-   **Hades** --- 系統設計 / 架構 / 視覺規劃\
-   **Nyx** --- AI 協作夥伴，負責代碼優化、架構設計與自動化流程

GitHub: [Hades1225-design](https://github.com/Hades1225-design)