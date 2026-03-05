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
if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8000"
set "FRONTEND_PORT=%~2"
if "%FRONTEND_PORT%"=="" set "FRONTEND_PORT=5173"

echo Starting WebRSSReader backend and frontend...
echo Backend:  http://127.0.0.1:%BACKEND_PORT%
echo Frontend: http://localhost:%FRONTEND_PORT%
echo.
echo Close the two console windows to stop the services.
echo.

start "WebRSSReader Backend" cmd /k "cd /d ""%ROOT%\backend"" && .venv\Scripts\activate.bat && uvicorn app.main:app --reload --host 127.0.0.1 --port %BACKEND_PORT%"
start "WebRSSReader Frontend" cmd /k "set BACKEND_PORT=%BACKEND_PORT% && set FRONTEND_PORT=%FRONTEND_PORT% && cd /d ""%ROOT%\frontend"" && npm run dev -- --port %FRONTEND_PORT%"

echo Both processes started. Open http://localhost:%FRONTEND_PORT% in your browser.
exit /b 0
