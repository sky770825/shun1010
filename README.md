# 常順地產值班表

排班、值班台、Key 借還、工具與管理。

## 本地開發

```sh
npm i
npm run dev
```

## 建置

```sh
npm run build
```

## 技術

- Vite、TypeScript、React
- shadcn/ui、Tailwind CSS
- Supabase（資料持久化）

## 功能特色

### 排班管理
- ✅ 自動排班演算法（公平分配、隨機機制）
- ✅ 手動調整排班
- ✅ 規則庫設定（每週、日期、區間、同天搭檔）
- ✅ 特殊日期不排班（如春節）
- ✅ 排班統計報表
- ✅ CSV 匯入/匯出

### 值班台
- ✅ 鑰匙借出登記（成員/同業）
- ✅ 內嵌式表單，無需彈窗
- ✅ 常用鑰匙快速選擇
- ✅ 歸還確認功能
- ✅ 歷史記錄查詢

### 資料管理
- ✅ Supabase 雲端同步
- ✅ localStorage 本地快取
- ✅ 資料匯入/匯出

## 環境變數

複製 `.env.example` 為 `.env` 並填入：

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_USE_SUPABASE=true
```

## 版本歷史

### v3.0 (2026-01)
- ✅ 移除彈窗，改為內嵌式表單
- ✅ 整合 Supabase 資料持久化
- ✅ 優化排班演算法（隨機機制、班別間隔控制）
- ✅ 新增特殊春節不排班條件

### v2.0 (2025-10)
- ✅ 舊版 HTML/JS 系統（見 `版本2.0/` 資料夾）
