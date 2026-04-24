@echo off
setlocal
rem One-click dependency setup for backend + frontend. Run from anywhere; script resolves repo root from its own path.

set "ROOT=%~dp0.."
cd /d "%ROOT%"
if errorlevel 1 (
  echo Failed to change to repo root: %ROOT%
  exit /b 1
)

echo Setting up RSSight dependencies...
echo.

echo [1/2] Backend setup
cd /d "%ROOT%\backend"
if not exist "%ROOT%\backend\.venv\Scripts\activate.bat" (
  echo [INFO] Creating backend virtual environment (.venv)
  python -m venv .venv
  if errorlevel 1 exit /b 1
)

echo [INFO] Installing backend dependencies (editable + dev extras)
call "%ROOT%\backend\.venv\Scripts\activate.bat"
if errorlevel 1 exit /b 1
python -m pip install --upgrade pip
if errorlevel 1 exit /b 1
pip install -e .[dev]
if errorlevel 1 exit /b 1

echo.
echo [2/2] Frontend setup
cd /d "%ROOT%\frontend"
echo [INFO] Installing frontend dependencies from lock file (including devDependencies)
npm ci --include=dev
if errorlevel 1 exit /b 1

echo.
echo Setup complete.
echo Next step:
echo   scripts\start.cmd
exit /b 0
