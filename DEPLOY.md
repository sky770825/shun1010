# 部署說明

## Cloudflare Pages 部署

### 問題
目前部署的是外層的舊版本 `index.html`，導致 MIME type 錯誤。

### 解決方案

#### 方法 1：直接上傳 dist 資料夾（推薦）

1. **建置專案**
   ```bash
   cd 常順班表
   npm run build
   ```

2. **上傳 dist 資料夾**
   - 在 Cloudflare Pages 中，選擇「直接上傳」
   - 上傳 `常順班表/dist/` 資料夾的內容
   - 或使用 Cloudflare Pages CLI

#### 方法 2：使用 Git 自動部署

1. **確保 dist 資料夾已建置並提交**
   ```bash
   cd 常順班表
   npm run build
   git add dist/
   git commit -m "build: 更新建置檔案"
   git push
   ```

2. **在 Cloudflare Pages 設定**
   - **建置命令**：`npm run build`
   - **建置輸出目錄**：`dist`
   - **根目錄**：`常順班表`（如果從根目錄部署）

#### 方法 3：使用 wrangler CLI

```bash
cd 常順班表
npm run build
npx wrangler pages deploy dist --project-name=shun1010
```

### 重要提醒

⚠️ **不要部署外層的 `index.html`**，那是舊版本！

✅ **正確的部署路徑**：`常順班表/dist/` 資料夾

### 驗證部署

部署完成後，訪問網站應該看到：
- ✅ 底部導航有三個按鈕：排班、值班台、工具
- ✅ 預設顯示排班頁面
- ✅ 沒有 MIME type 錯誤
