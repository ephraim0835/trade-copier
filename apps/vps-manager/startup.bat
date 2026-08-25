@echo off
echo Starting Trade Copier VPS Manager...
cd /d "%~dp0"
call .venv\Scripts\activate.bat
python manager.py
pause
