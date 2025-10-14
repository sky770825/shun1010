@echo off
chcp 65001 >nul
echo ==========================================
echo    常順地產系統 - 快速上傳到GitHub
echo ==========================================
echo.

:: 顯示目前狀態
echo 📋 檢查更改的檔案...
git status -s
echo.

:: 詢問提交訊息
set /p commit_msg="💬 請輸入更新說明（直接Enter使用預設訊息）: "

:: 如果沒有輸入，使用預設訊息
if "%commit_msg%"=="" set commit_msg=更新系統代碼

echo.
echo 🔄 正在上傳...
echo.

:: 添加所有變更
git add .

:: 提交
git commit -m "%commit_msg%"

:: 推送到GitHub
git push origin main

echo.
if %errorlevel% equ 0 (
    echo ✅ 上傳成功！
    echo 🔗 https://github.com/sky770825/shun1010
) else (
    echo ❌ 上傳失敗，請檢查錯誤訊息
)

echo.
pause

