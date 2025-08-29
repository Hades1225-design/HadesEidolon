---
id: plan-2025-08-24-daily-planning
title: "每日計劃"
area: infra
priority: P2
status: inbox
owner: Hades
progress: 0
risk: medium
created: 2025-08-24
updated: 2025-08-24
tags: [daily, calendar, today-view, automation]
links:
  - scripts: scripts/ingest_calendar.py
  - scripts: scripts/build_daily.py
  - site: site/today.html
  - json: public/calendar/day/
---

## 目標
- 以**行事曆為基礎**，每天自動產出「Today 視圖」與「每日日誌」。
- 不改動既有「計劃 → 索引 → 可視化」流程，只**串接**事件與計劃。
- 每天 00:05（台北）產出：
  1) `/public/calendar/day/YYYY-MM-DD.json`（行程＋容量摘要＋今日任務）
  2) `/daily/YYYY/YYYY-MM-DD.md`（日誌模板）

## 架構與資料流
1) **來源**：ICS 訂閱（Google/Apple/Outlook 皆可）。
2) **擷取**：`scripts/ingest_calendar.py` 下載並解析多個 ICS → 統一欄位。
3) **彙整**：`scripts/build_daily.py` 依 *Asia/Taipei* 切日 → 輸出 `day.json` 與每日 Markdown。
4) **索引**：沿用 `build_index.py`，把 `daily/**/*.md` 收錄為 `type: daily`（可在索引內標記）。
5) **前端**：新增 `site/today.html` + `site/today.js`：
   - 左側**時間軸**顯示今日行程（meeting/focus 配色）。
   - 右側**今日任務**：讀 `day.json.tasks`；支援從計劃卡片「➕到今天」。

## 檔案結構（新增）
```
/public/calendar/day/2025-08-24.json
/daily/2025/2025-08-24.md
/scripts/ingest_calendar.py
/scripts/build_daily.py
/site/today.html
/site/today.js
```

## JSON Schema（草案）
```json
{
  "date": "YYYY-MM-DD",
  "tz": "Asia/Taipei",
  "summary": {
    "events": 0,
    "meeting_min": 0,
    "focus_min": 0,
    "first_start": "09:00",
    "last_end": "18:00"
  },
  "events": [
    {
      "id": "gcal:xxxx",
      "title": "Infra 周會 [#plan:planning-hub]",
      "start": "YYYY-MM-DDTHH:mm:ss+08:00",
      "end": "YYYY-MM-DDTHH:mm:ss+08:00",
      "allDay": false,
      "location": "",
      "source": "work",
      "attendees": 0,
      "planRefs": ["plan-xxxx"]
    }
  ],
  "tasks": [
    { "title": "修 Today 視圖 loading", "planId": "plan-xxxx", "estMin": 30, "status": "todo" }
  ]
}
```

## 每日 Markdown 模板
```markdown
---
type: daily
date: YYYY-MM-DD
tz: Asia/Taipei
events: <number>
meeting_min: <minutes>
focus_min: <minutes>
links:
  - calendar: public/calendar/day/YYYY-MM-DD.json
---

## 今日目標（Top 3）
- [ ] ...

## 今日任務（連結計劃）
- [ ] 任務A (#plan:xxx)
- [ ] 任務B (#plan:yyy)

## 行程摘要
- 09:30–10:00 會議A
- 14:00–15:30 Review

## 備忘 / 收件匣
- ...
```

## 里程碑
- **M1｜擷取與產物**（~ 3 天）
  - 建立 `ingest_calendar.py`、`build_daily.py`；輸出 `public/calendar/day/<today>.json` 與 `daily/<year>/<today>.md`。
- **M2｜Today 視圖（最小可用）**（~ 2 天）
  - `site/today.html/js`：時間軸＋今日任務清單；支援 `?date=YYYY-MM-DD`。
- **M3｜索引整合**（~ 1 天）
  - 更新 `build_index.py`：收錄 daily；首頁連到 Today 視圖。
- **M4｜互動**（可選，~ 2 天）
  - 計劃卡片「➕到今天」（先寫 localStorage；之後改為產生 PR）。

## 下一步（Next Actions）
- [ ] 初始化 `config/calendar.yml`（多個 ICS URL；標記來源名稱 work/personal）。
- [ ] 寫 `ingest_calendar.py`：下載、解析 ICS、標準化欄位。
- [ ] 寫 `build_daily.py`：Asia/Taipei 切日；輸出 `day.json` 與每日 MD。
- [ ] 新增 `site/today.html`、`site/today.js`（時間軸＋今日任務）。
- [ ] CI：每天 **00:05 台北** 觸發（UTC cron `5 16 * * *`）→ 產出並提交。
- [ ] 在首頁 toolbar 放「Today」連結。

## 風險與緩解
- **ICS 更新延遲**：以快取/上次戳記避免重覆提交；允許手動重建。
- **多行事曆衝突**：以 `source` 區分，並在前端提供過濾。
- **時區切日誤差**：統一以 Asia/Taipei 處理，並在 JSON 記錄 `tz`。
