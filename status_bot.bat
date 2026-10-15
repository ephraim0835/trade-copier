@echo off
title Trade Copier - Status
color 0a

echo ============================================================
echo           TRADE COPIER - LOCAL BOT STATUS
echo ============================================================
echo.

cd /d "%~dp0"
"apps\vps-manager\.venv\Scripts\python.exe" status.py

echo.
pause
