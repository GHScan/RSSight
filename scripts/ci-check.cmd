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

npm run lint
if errorlevel 1 goto :error

npm run typecheck
if errorlevel 1 goto :error

npm run test -- --run
if errorlevel 1 goto :error

popd

echo All baseline checks passed.
exit /b 0

:error
echo CI checks failed.
exit /b 1

