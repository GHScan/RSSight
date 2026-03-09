@echo off
setlocal
rem One-click start of backend + frontend. Run from anywhere; script resolves repo root from its own path.
rem Usage: start.cmd [backend_port] [frontend_port]   (defaults: 8000 5173)

set "ROOT=%~dp0.."
cd /d "%ROOT%"
if errorlevel 1 (
  echo Failed to change to repo root: %ROOT%
  exit /b 1
)

set "BACKEND_PORT=%~1"
if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8173"
set "FRONTEND_PORT=%~2"
if "%FRONTEND_PORT%"=="" set "FRONTEND_PORT=5173"

echo Starting RSSight backend and frontend (bound to all interfaces, LAN accessible)...
echo Backend:  http://0.0.0.0:%BACKEND_PORT%  (e.g. http://YOUR_IP:%BACKEND_PORT%)
echo Frontend: http://0.0.0.0:%FRONTEND_PORT% (e.g. http://YOUR_IP:%FRONTEND_PORT%)
echo.
echo Close the two console windows to stop the services.
echo.

set "BACKEND_CMD="
if exist "%ROOT%\backend\.venv\Scripts\activate.bat" (
  set "BACKEND_CMD=cd /d ""%ROOT%\backend"" && .venv\Scripts\activate.bat && set WEBRSS_DEBUG=1 && uvicorn app.main:app --reload --host 0.0.0.0 --port %BACKEND_PORT%"
) else (
  echo [INFO] No backend\.venv found; using current Python. To use a venv: cd backend ^&^& python -m venv .venv ^&^& .venv\Scripts\activate.bat ^&^& pip install -e .[dev]
  set "BACKEND_CMD=cd /d ""%ROOT%\backend"" && set WEBRSS_DEBUG=1 && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port %BACKEND_PORT%"
)

start "RSSight Backend" cmd /k "%BACKEND_CMD%"
start "RSSight Frontend" cmd /k "set BACKEND_PORT=%BACKEND_PORT% && set FRONTEND_PORT=%FRONTEND_PORT% && cd /d ""%ROOT%\frontend"" && npm run dev -- --port %FRONTEND_PORT% --host"

echo Both processes started. Open http://127.0.0.1:%FRONTEND_PORT% (or http://YOUR_IP:%FRONTEND_PORT% from other devices) in your browser.
exit /b 0
