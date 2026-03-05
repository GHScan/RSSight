param()

$ErrorActionPreference = "Stop"

Write-Host "==> Backend checks"
Push-Location "backend"
try {
  python -m ruff check app tests
  python -m black --check app tests
  python -m mypy app
  python -m pytest -q
}
finally {
  Pop-Location
}

Write-Host "==> Frontend checks"
Push-Location "frontend"
try {
  npm run lint
  npm run typecheck
  npm run test -- --run
}
finally {
  Pop-Location
}

Write-Host "All baseline checks passed."
