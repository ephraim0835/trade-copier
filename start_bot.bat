@echo off
title Trade Copier - Local Bot Host
color 0b

echo ============================================================
echo           TRADE COPIER - LOCAL BOT HOST (PC)
echo ============================================================
echo Starting MT5 Manager with full broker catalog support...
echo.

cd /d "%~dp0apps\vps-manager"

:: Ensure virtualenv python exists
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found at apps\vps-manager\.venv!
    pause
    exit /b 1
)

:RUN_LOOP
echo [%DATE% %TIME%] Starting manager.py...
.venv\Scripts\python.exe manager.py

echo.
echo ============================================================
echo [WARNING] Bot manager stopped or exited!
echo Restarting in 5 seconds... (Press Ctrl+C to stop)
echo ============================================================
timeout /t 5 /nobreak >nul
goto RUN_LOOP

