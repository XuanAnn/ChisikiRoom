@echo off
cd /d "%~dp0"
call npm run db
if errorlevel 1 goto failed
call npm run backend
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo Khong khoi dong duoc may chu. Xem thong bao phia tren.
pause
exit /b 1
