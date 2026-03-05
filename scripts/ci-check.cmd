@echo off
setlocal enabledelayedexpansion

echo ==> Backend checks
pushd backend
if errorlevel 1 goto :error

python -m ruff check app tests
if errorlevel 1 goto :error

python -m black --check app tests
if errorlevel 1 goto :error

python -m mypy app
if errorlevel 1 goto :error

python -m pytest -q
if errorlevel 1 goto :error

popd

echo ==> Frontend checks
pushd frontend
if errorlevel 1 goto :error

rem Lint all frontend code (including components)
npm run lint
if errorlevel 1 goto :error

rem Typecheck all frontend TypeScript
npm run typecheck
if errorlevel 1 goto :error

rem Run UI component/page tests under src/__tests__
npm run test:ui
if errorlevel 1 goto :error

popd

echo All baseline checks passed.
exit /b 0

:error
echo CI checks failed.
exit /b 1

