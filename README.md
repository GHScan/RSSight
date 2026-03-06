# RSSight

RSSight is a Windows-oriented web service for RSS reading and AI summary generation.
It provides a browser UI to manage feeds, browse articles, configure summary profiles, and generate Markdown summaries.

## What you can do

- Manage RSS subscriptions (add, edit, delete).
- Fetch and store feed articles, then browse article lists by feed.
- Configure multiple AI summary profiles (OpenAI-compatible API).
- Generate article summaries on demand and view existing summaries.
- Keep summary content as Markdown files in `data/` for easy backup and manual editing.

## Quick start (for service users)

### Prerequisites

- Windows 10/11 or Windows Server
- Python 3.12+
- Node.js 20+

### First-time setup

1. Open `cmd` in the repository root.
2. Prepare backend dependencies:

   ```bat
   cd backend
   python -m venv .venv
   .venv\Scripts\activate.bat
   pip install -e .[dev]
   ```

3. Prepare frontend dependencies:

   ```bat
   cd ..\frontend
   npm install
   ```

### Start the service

From repository root:

```bat
scripts\start.cmd
```

Optional custom ports:

```bat
scripts\start.cmd [backend_port] [frontend_port]
```

Default ports are `8000` (backend) and `5173` (frontend).
After startup, open <http://localhost:5173>.

## User flow

1. Open the home page and go to **订阅管理**.
2. Add one or more RSS feed URLs.
3. Open a feed and browse its articles.
4. Go to **摘要配置** and create a summary profile.
5. In an article page, select a profile and trigger summary generation.

## Data and backup notes

- Runtime data is stored only under `data/`.
- AI summary body files are Markdown, recommended path:
  - `data/feeds/{feedId}/articles/{articleId}/summaries/{profileName}.md`
- Deleting a feed removes its full data subtree.
- Deleting or renaming a summary profile removes summaries and metadata with that profile name across all feeds.

## Deployment

For production deployment on Windows (reverse proxy, static assets, process supervision), see:

- `docs/deployment-windows.md`

## If you are developing this project

Developer workflow entry content lives in:

- `AGENTS.md` (authoritative engineering rules and navigation)
- `docs/developer-guide.md`
- `docs/README.md`
