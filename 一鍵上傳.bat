@echo off
chcp 65001 >nul
echo 🚀 快速上傳中...
git add .
git commit -m "更新系統 - %date% %time:~0,5%"
git push origin main
if %errorlevel% equ 0 (
    echo ✅ 上傳完成！
) else (
    echo ❌ 上傳失敗
)
pause

