@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  FUTURUM — ЗАПУСК мониторинга каталога
echo  Новые предметы + цены пачками + заливка на GitHub
echo  Подробный лог: data\watch_catalog.log
echo  Остановка: Ctrl+C
echo.
py -3 -u "ЗАПУСК_мониторинг_каталога.py" --workers 2 --batch 10 --ahead 40 --sleep 0 %*
echo.
pause
