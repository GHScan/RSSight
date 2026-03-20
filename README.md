# RSSight

> **AI-powered RSS reader**: summarization and translation for your feeds. Plug in any OpenAI-compatible AI (OpenAI, Azure, local models, etc.), use multiple profiles at once, and run on Windows, macOS, or Linux.

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![Node 20+](https://img.shields.io/badge/node-20+-green.svg)](https://nodejs.org/)

## Features

- **AI summarization & translation** — Generate article summaries and translate titles on demand; custom prompts and multiple profiles (e.g. “brief”, “Chinese”, “translation”).
- **Multiple AI providers** — Works with any OpenAI-compatible API: OpenAI, Azure OpenAI, local LLMs (Ollama, LM Studio, etc.). One app, swap providers via config.
- **Cross-platform** — Backend (Python/FastAPI) and frontend (React/Vite) run on **Windows**, **macOS**, and **Linux**. Develop and self-host wherever you prefer.
- **RSS + browser UI** — Manage feeds, browse articles, trigger summaries and translations from a simple web interface.
- **Markdown-first** — Summaries and metadata live under `data/` as Markdown and JSON for easy backup, versioning, and manual editing.

## Requirements

- Windows 10/11, macOS, or Linux
- Python 3.12+
- Node.js 20+

## Installation

**Windows (cmd):**

```bat
cd backend
python -m venv .venv
.venv\Scripts\activate.bat
pip install -e .[dev]
cd ..\frontend
npm install
```

**macOS / Linux (bash):**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
cd ../frontend
npm install
```

## Quick start

**Windows** — From the repository root:

```bat
scripts\start.cmd
```

**macOS / Linux** — From the repository root:

```bash
./scripts/start.sh
```

Optional ports: `scripts\start.cmd [backend_port] [frontend_port]` (Windows) or `./scripts/start.sh [backend_port] [frontend_port]` (Unix). Defaults: backend `8173`, frontend `5173`.

Then open the frontend in your browser (default port 5173; use `http://127.0.0.1:5173` if needed).

### Manual start

If you prefer to start services manually (e.g., for debugging):

**Windows (cmd) — two terminals:**

```bat
:: Terminal 1 (backend)
cd backend
.venv\Scripts\activate.bat
set WEBRSS_DEBUG=1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8173

:: Terminal 2 (frontend)
cd frontend
npm run dev -- --port 5173 --host
```

**macOS / Linux (bash) — two terminals:**

```bash
# Terminal 1 (backend)
cd backend
source .venv/bin/activate
WEBRSS_DEBUG=1 uvicorn app.main:app --reload --host 0.0.0.0 --port 8173

# Terminal 2 (frontend)
cd frontend
npm run dev -- --port 5173 --host
```

## Usage

1. Open the app and go to **RSS 订阅** (Feed management). Add one or more RSS feed URLs, or click **文章收藏** to create a virtual feed (article favorites collection).
2. Open a feed and browse its articles.
3. Go to **摘要配置** (Summary config) and create a summary profile.
4. On an article page, select a profile and trigger summary generation.

## Data and backup

- Runtime data lives only under `data/`.
- Summary body path: `data/feeds/{feedId}/articles/{articleId}/summaries/{profileName}.md`
- Deleting a feed removes its full data subtree.
- Deleting or renaming a summary profile removes all summaries and metadata for that profile across feeds.

## Documentation

| Topic | Doc |
|-------|-----|
| Production deployment | [docs/deployment-windows.md](docs/deployment-windows.md) |
| Engineering rules | [AGENTS.md](AGENTS.md) |
| Developer guide | [docs/developer-guide.md](docs/developer-guide.md) |
| Docs index | [docs/README.md](docs/README.md) |

## Contributing

Read [AGENTS.md](AGENTS.md) and [docs/developer-guide.md](docs/developer-guide.md) for rules, local run, and quality gates.

**Quality gate:**
- Windows: `scripts\ci-check.cmd`
- macOS / Linux: `./scripts/ci-check.sh`
