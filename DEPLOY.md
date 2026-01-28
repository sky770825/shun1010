# 部署說明

## Cloudflare Pages 部署

### ⚠️ 當前問題
訪問 `https://shun1010.pages.dev/常順班表/index.html` 顯示的是**舊版本**，因為部署了整個專案根目錄。

### ✅ 正確的部署方式

#### 方法 1：使用 Cloudflare Dashboard 直接上傳（最簡單）

1. **建置專案**
   ```bash
   cd 常順班表
   npm run build
   ```

2. **在 Cloudflare Pages Dashboard**
   - 進入專案 `shun1010`
   - 選擇「直接上傳」或「Upload assets」
   - **上傳 `常順班表/dist/` 資料夾的「所有內容」**
   - 確保上傳後，根目錄是 `dist/` 的內容（不是 `dist/` 資料夾本身）

3. **訪問網站**
   - 正確的 URL：`https://shun1010.pages.dev/`（根目錄）
   - ❌ 錯誤的 URL：`https://shun1010.pages.dev/常順班表/index.html`（這是舊版本）

#### 方法 2：使用 wrangler CLI（推薦）

```bash
cd 常順班表
npm run build
npx wrangler pages deploy dist --project-name=shun1010
```

#### 方法 3：使用 Git 自動部署（需要設定）

1. **在 Cloudflare Pages 設定**
   - **建置命令**：`cd 常順班表 && npm ci && npm run build`
   - **建置輸出目錄**：`常順班表/dist`
   - **根目錄**：留空或設為專案根目錄

2. **或者使用 GitHub Actions**（已提供 `.github/workflows/deploy.yml`）
   - 需要設定 Secrets：
     - `CLOUDFLARE_API_TOKEN`
     - `CLOUDFLARE_ACCOUNT_ID`

### 重要提醒

⚠️ **不要部署外層的 `index.html`**，那是舊版本！

✅ **正確的部署路徑**：`常順班表/dist/` 資料夾

### 驗證部署

部署完成後，訪問網站應該看到：
- ✅ 底部導航有三個按鈕：排班、值班台、工具
- ✅ 預設顯示排班頁面
- ✅ 沒有 MIME type 錯誤
