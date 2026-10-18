@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  FUTURUM — сбор данных и заливка на GitHub
echo  Лог будет подробный: что делает / что собрал / что заливает
echo.
py -3 -u update_and_push.py %*
echo.
pause
