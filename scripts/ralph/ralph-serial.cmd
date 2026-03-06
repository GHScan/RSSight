@echo off
setlocal
cd /d "%~dp0..\.."

set ITERATION=0

:loop
REM Check for any story with passes=false (with or without space after colon)
findstr /C:"\"passes\": false" prd.json >nul 2>&1
if errorlevel 1 (
  findstr /C:"\"passes\":false" prd.json >nul 2>&1
)
if errorlevel 1 goto done

set /a ITERATION+=1
echo [ralph-serial] iteration %ITERATION%
python "%~dp0stream-progress.py" "Complete one story from prd.json and commit"
set AGENT_EXIT=%errorlevel%
if %AGENT_EXIT% equ 0 goto loop
echo [ralph-serial] agent exited with code %AGENT_EXIT%
exit /b %AGENT_EXIT%

:done
echo [ralph-serial] all stories pass; done.
exit /b 0
