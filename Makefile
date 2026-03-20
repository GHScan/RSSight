# RSSight Makefile
# Cross-platform development commands for Linux/macOS.
# Usage: make <target>   (run from repository root)

.PHONY: install dev test lint build clean help

# Default target
.DEFAULT_GOAL := help

# Detect OS for conditional behavior
UNAME_S := $(shell uname -s 2>/dev/null || echo "Linux")

# Port configuration (can be overridden: make dev BACKEND_PORT=9000)
BACKEND_PORT ?= 8173
FRONTEND_PORT ?= 5173

## install: Install all dependencies (backend + frontend)
install:
	@echo "==> Installing backend dependencies..."
	cd backend && \
		if [ ! -d .venv ]; then \
			python -m venv .venv; \
		fi && \
		. .venv/bin/activate && \
		pip install -e .[dev]
	@echo "==> Installing frontend dependencies..."
	cd frontend && npm install
	@echo "==> Installation complete."

## dev: Start development servers (backend + frontend)
dev:
	@echo "Starting development servers..."
	@./scripts/start.sh $(BACKEND_PORT) $(FRONTEND_PORT)

## test: Run all tests (backend + frontend)
test:
	@echo "==> Running backend tests..."
	cd backend && \
		if [ -d .venv/bin ]; then . .venv/bin/activate; fi && \
		python -m pytest -q
	@echo "==> Running frontend tests..."
	cd frontend && npm run test:ui
	@echo "==> All tests passed."

## lint: Run all linters (backend + frontend)
lint:
	@echo "==> Running backend linters..."
	cd backend && \
		if [ -d .venv/bin ]; then . .venv/bin/activate; fi && \
		python -m ruff check app tests && \
		python -m black --check app tests && \
		python -m mypy app
	@echo "==> Running frontend linters..."
	cd frontend && npm run lint && npm run typecheck
	@echo "==> All linters passed."

## build: Build frontend for production
build:
	@echo "==> Building frontend for production..."
	cd frontend && npm run build
	@echo "==> Build complete. Output: frontend/dist/"

## clean: Remove generated files and caches
clean:
	@echo "==> Cleaning backend..."
	cd backend && \
		rm -rf .pytest_cache .mypy_cache .ruff_cache __pycache__ && \
		rm -rf .venv && \
		find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@echo "==> Cleaning frontend..."
	cd frontend && \
		rm -rf dist node_modules/.vite node_modules/.cache
	@echo "==> Cleaning root..."
	rm -rf .pytest_cache .mypy_cache .ruff_cache
	@echo "==> Clean complete."

## ci: Run full CI quality gate (lint + test + e2e)
ci:
	@./scripts/ci-check.sh

## format: Auto-format code (black for backend, prettier for frontend)
format:
	@echo "==> Formatting backend code..."
	cd backend && \
		if [ -d .venv/bin ]; then . .venv/bin/activate; fi && \
		python -m black app tests
	@echo "==> Formatting frontend code..."
	cd frontend && npx prettier --write "src/**/*.{ts,tsx,js,jsx,json,css,md}"
	@echo "==> Format complete."

## help: Show this help message
help:
	@echo "RSSight Makefile"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@sed -n 's/^## //p' $(MAKEFILE_LIST) | column -t -s ':'
	@echo ""
	@echo "Variables:"
	@echo "  BACKEND_PORT   Backend server port (default: 8173)"
	@echo "  FRONTEND_PORT  Frontend dev server port (default: 5173)"
	@echo ""
	@echo "Examples:"
	@echo "  make install                    # Install all dependencies"
	@echo "  make dev                        # Start dev servers on default ports"
	@echo "  make dev BACKEND_PORT=9000      # Start with custom backend port"
	@echo "  make test                       # Run all tests"
	@echo "  make lint                       # Run all linters"
	@echo "  make build                      # Build for production"
	@echo "  make clean                      # Remove generated files"
	@echo "  make ci                         # Run full CI quality gate"
