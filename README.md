# 常順地產值班表系統

排班、值班台、Key 借還、工具與管理。

## 📌 技術

- **傳統 HTML + JavaScript + CSS**
- 依賴檔案：`index.html`、`script.js`、`styles.css`、`排班條件設定.js`（皆在本資料夾）
- **Google Apps Script**：後端原始碼位於 [google-apps-script/常順班表-WebApp.gs](google-apps-script/常順班表-WebApp.gs)，部署與版本同步方式見 [google-apps-script/README.md](google-apps-script/README.md)。
- 支援 Google Sheets 同步
- 完整排班表與鑰匙管理功能

## 🚀 本地使用

直接以瀏覽器開啟 `index.html`，或使用本機伺服器：

```bash
# 例如用 Python
python3 -m http.server 8888
# 開啟 http://localhost:8888
```

## 📦 部署（Cloudflare Pages）

Git push 到 `main` 後，若已設定 GitHub Secrets（`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`），會自動部署。

- 線上網址：`https://shun1010.pages.dev/`

## 🔧 其他檔案

- `google-apps-script/`：Google Sheets／Apps Script 後端原始碼與部署說明
- `supabase/`：資料庫 migrations（若使用 Supabase）
- `generate_roster_2026_01_sql.js`：排班 CSV 轉 SQL 工具
