@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  FUTURUM — постоянный мониторинг каталога
echo  Новые предметы + цены пачками + заливка на GitHub
echo  Подробный лог: data\watch_catalog.log
echo  Остановка: Ctrl+C
echo.
REM Мягкий режим: 2 потока, маленькие пачки, пауза 3 мин
py -3 -u watch_catalog.py --workers 2 --batch 10 --ahead 40 --sleep 180 %*
echo.
pause
