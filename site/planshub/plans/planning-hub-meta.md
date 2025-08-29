---
id: plan-2025-08-24-planning-hub
title: HadesEidolon-Planning-hub 專案建置與自動化
area: infra
priority: P0
status: ongoing
owner: Hades
progress: 60
risk: medium
tags: [meta, infra, automation, github, planning-hub]
links:
  - https://github.com/Hades1225-design/HadesEidolon-Planning-hub
  - https://Hades1225-design.github.io/HadesEidolon-Planning-hub/site/
created: 2025-08-24
updated: 2025-08-25
---

## 目標
打造一個以 Markdown 為核心的計劃中樞，支援：
- 自動索引 (`plans/*` → `public/index.json`)
- GitHub Actions 部署
- 可視化計劃網站
- 後續可擴充 ADR、進度分析、搜尋與詳情頁

## 里程碑
- ✅ 建立專案骨架、基本資料夾結構
- ✅ 設定 GitHub Actions，自動更新 `public/index.json`
- ✅ GitHub Pages 自動部署
- 🔄 計劃詳情頁 (即將開發)
- 🔲 進度分析 Dashboard
- 🔲 ADR 可視化整合

## 近期完成（Done）— 2025-08-25
- [x] **首頁顯示索引時間**
  - 工具列顯示 `generated_at`（來源：`public/index.json`）

## 下一步（Next Actions）— 2025-08-25
- [ ] **Split View（同時顯示清單＋看板）**
  - 新增 `VIEW='both'`，同時渲染 #list 與 #board；窄螢幕自動堆疊。
- [ ] **卡片強化（狀態色條、D-Day 徽章、進度條）**
  - 卡片左側加入狀態色條；顯示 `D-n / D+n`；進度條含百分比文字。
- [ ] **詳情頁 v2（相對連結/圖片修正、程式碼高亮、TOC）**
  - 改寫相對連結與圖片為 RAW；導入 highlight.js；依 h2/h3 產生 TOC。
- [ ] **部署工作流統一（只用官方 Pages，併發自動取消舊 run）**
  - 單一路徑：`upload-pages-artifact` → `deploy-pages`；`concurrency: { group: pages, cancel-in-progress: true }`。



