@echo off
cd /d "%~dp0"
call npm run build
if errorlevel 1 goto failed
call npm run desktop
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo Khong mo duoc ChisikiRoom. Chay npm install neu chua cai thu vien.
pause
exit /b 1
