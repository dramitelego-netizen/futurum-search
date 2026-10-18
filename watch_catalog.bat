@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  FUTURUM — постоянный мониторинг каталога
echo  Новые предметы + цены пачками + заливка на GitHub
echo  Остановка: Ctrl+C
echo.
py -3 -u watch_catalog.py %*
echo.
pause
