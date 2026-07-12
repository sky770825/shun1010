# Google Apps Script 後端

`常順班表-WebApp.gs` 是此網站的 Google Sheets 後端程式，對應前端
`script.js` 中設定的試算表與 Web App URL。

## 維護規則

1. 先在此檔修改、測試並 commit，再同步到 Apps Script；不要只在網頁編輯器修改。
2. 首次以本檔覆蓋線上 Apps Script 前，先在 Apps Script 編輯器建立備份。線上服務仍可讀寫，但其完整原始碼曾未納入 Git；本檔是從最後受版控的完整版本找回並改為 `openById` 的維護基準。
3. 在 Google Sheet 選擇「擴充功能 → Apps Script」，貼上 `常順班表-WebApp.gs` 後儲存。
4. 使用「部署 → 管理部署作業 → 編輯」建立新版本，保留既有 Web App 部署，才能維持前端目前使用的 `/exec` URL。

## 驗證

部署後，以瀏覽器或終端機讀取：

```text
<Web App URL>?action=getSchedule&yearMonth=2026-06
```

應回傳 `status: "success"` 與班表資料。前端現在會在每次排班寫入後讀回同月資料；只有讀回內容與本機資料相符時，才顯示已同步成功。

本機可執行：

```bash
node --test tests/*.test.js
```
