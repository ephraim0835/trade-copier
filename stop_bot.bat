@echo off
title Trade Copier - Stop Bot Host
color 0c

echo ============================================================
echo           TRADE COPIER - STOPPING BOT HOST
echo ============================================================
echo Stopping MT5 Manager and running terminals...
echo.

powershell -Command "Get-Process -Name 'terminal64' -ErrorAction SilentlyContinue | Stop-Process -Force; Get-Process | Where-Object { $_.CommandLine -like '*manager.py*' } | Stop-Process -Force"

echo [OK] All trade copier bot processes have been stopped.
ping 127.0.0.1 -n 3 >nul
