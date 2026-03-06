@echo off
setlocal
cd /d "%~dp0..\.."
python scripts\ralph\ralph_serial.py
exit /b %errorlevel%
