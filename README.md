# 常順地產值班表系統

排班、值班台、Key 借還、工具與管理。

## 📌 版本說明

本專案包含**兩個完全獨立的版本**：

### 🔵 舊版本（傳統 HTML/JS）
- **檔案**：`index.html`（21,319 bytes）
- **訪問**：`https://shun1010.pages.dev/` 或 `https://shun1010.pages.dev/index.html`
- **技術**：純 HTML + JavaScript + CSS
- **依賴檔案**：`script.js`、`styles.css`、`排班條件設定.js`
- **特點**：
  - 單一 HTML 檔案包含所有功能
  - 支援 Google Sheets 同步
  - 完整的排班表和鑰匙管理功能

### 🟢 新版本（React/Vite）
- **源檔案**：`index1.html`（677 bytes）
- **建置後**：`dist/index1.html`
- **訪問**：`https://shun1010.pages.dev/index1.html` 或 `https://shun1010.pages.dev/index1`
- **技術**：React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **源碼目錄**：`src/`
- **特點**：
  - 現代化 React 應用
  - 組件化架構
  - 整合 Supabase 資料持久化
  - 優化的排班演算法
  - 內嵌式表單（無需彈窗）
  - 底部導航：排班、值班台、工具

## 🗂️ 檔案結構

```
常順班表/
├── index.html          # 🔵 舊版本入口（傳統 HTML）
├── index1.html         # 🟢 React 版本入口（開發用）
├── script.js           # 舊版本 JavaScript
├── styles.css          # 舊版本樣式
├── 排班條件設定.js      # 舊版本排班設定
│
├── src/                # 🟢 React 版本源碼
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/     # React 組件
│   ├── services/       # 資料服務
│   └── ...
│
├── dist/               # 🟢 React 版本建置輸出
│   ├── index.html      # 🔵 舊版本（部署用）
│   ├── index1.html     # 🟢 React 版本（部署用）
│   └── assets/         # React 版本資源
│
└── vite.config.ts      # Vite 配置（使用 index1.html 作為入口）
```

## 🚀 本地開發

### 舊版本
直接打開 `index.html` 即可使用，無需建置。

### React 版本
```bash
cd 常順班表
npm install
npm run dev
```
訪問：`http://localhost:8080/index1.html`

## 📦 建置與部署

### 建置 React 版本
```bash
cd 常順班表
npm run build
```

建置後，`dist/` 資料夾包含：
- `index.html` - 舊版本（從源檔案複製）
- `index1.html` - React 版本（建置產物）
- `assets/` - React 版本資源

### 部署到 Cloudflare Pages
```bash
npx wrangler pages deploy dist --project-name=shun1010
```

部署後：
- 舊版本：`https://shun1010.pages.dev/`
- React 版本：`https://shun1010.pages.dev/index1.html`

## 📝 詳細說明

更多資訊請參考 [VERSION_INFO.md](./VERSION_INFO.md)

## 🔧 技術

### 舊版本
- HTML、JavaScript、CSS
- Google Sheets API

### 新版本
- Vite、TypeScript、React
- shadcn/ui、Tailwind CSS
- Supabase（資料持久化）
- @tanstack/react-query
