# Developer guide

Practical guide for setting up, running, and testing RSSight locally.
For engineering rules and agent policy, see `AGENTS.md`.

## Local setup

### Windows (cmd)

```bat
cd backend
python -m venv .venv
.venv\Scripts\activate.bat
pip install -e .[dev]

cd ..\frontend
npm install
```

### macOS/Linux (bash)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]

cd ../frontend
npm install
```

## Local run

### Windows

```bat
scripts\start.cmd
```

### macOS/Linux

```bash
scripts/start.sh
```

Both backend (port 8173 default) and frontend (port 5173 default) must be running. The frontend proxies `/api` to the backend.

### Manual start (without scripts)

If you prefer to start backend and frontend manually in separate terminals:

**Windows (two separate terminals):**

Terminal 1 (backend):
```bat
cd backend
.venv\Scripts\activate.bat
set WEBRSS_DEBUG=1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8173
```

Terminal 2 (frontend):
```bat
cd frontend
set BACKEND_PORT=8173
set FRONTEND_PORT=5173
npm run dev -- --port 5173 --host
```

**macOS/Linux (two separate terminals):**

Terminal 1 (backend):
```bash
cd backend
source .venv/bin/activate
WEBRSS_DEBUG=1 uvicorn app.main:app --reload --host 0.0.0.0 --port 8173
```

Terminal 2 (frontend):
```bash
cd frontend
BACKEND_PORT=8173 FRONTEND_PORT=5173 npm run dev -- --port 5173 --host
```

## Debugging

To get tracebacks in API error responses (500), set `WEBRSS_DEBUG=1` before starting the backend.

## Data repository synchronization

RSSight can automatically synchronize the `data/` directory with a git remote repository. This enables backup, versioning, and multi-instance synchronization of your feeds and summaries.

### How it works

The backend runs two sync triggers:

1. **Startup sync**: Executed once during FastAPI app startup, before background jobs start.
2. **Recurring sync**: Runs every 30 minutes via the internal scheduler.

Both triggers use the same sync logic in `DataRepoSyncService` (`backend/app/services/data_sync.py`).

### Sync flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Data Sync Cycle                         │
├─────────────────────────────────────────────────────────────┤
│  1. Resolve symlink target (if data/ is a symlink)          │
│  2. Verify directory is a git repository                    │
│  3. Verify remote 'origin' is configured                    │
│  4. Pull with rebase from origin                            │
│  5. If local changes: stage → commit → push                 │
└─────────────────────────────────────────────────────────────┘
```

### Prerequisites

To enable data sync:

1. **Initialize git repository** in `data/`:
   ```bash
   cd data
   git init
   ```

2. **Configure remote origin**:
   ```bash
   git remote add origin <your-repo-url>
   ```

3. **Configure git credentials** for non-interactive authentication:

   **SSH (recommended):**
   ```bash
   # Ensure SSH agent is running and key is loaded
   ssh-add ~/.ssh/id_ed25519  # or id_rsa

   # Use SSH URL for remote
   git remote set-url origin git@github.com:user/rssight-data.git
   ```

   **HTTPS with credential helper:**
   ```bash
   # Cache credentials
   git config --global credential.helper cache

   # Or use a personal access token
   git remote set-url origin https://<token>@github.com/user/rssight-data.git
   ```

4. **Initial push** (first time only):
   ```bash
   git add -A
   git commit -m "Initial data"
   git push -u origin HEAD
   ```

### Symlink support

You can replace `data/` with a symlink to another location (e.g., a cloud-synced folder or separate disk):

```bash
# Example: Move data to external drive and symlink
mv data /external/rssight-data
ln -s /external/rssight-data data
```

The sync service automatically resolves symlink targets before running git commands.

### Failure handling

- **Non-fatal**: Sync failures are logged but do not crash the application.
- **Startup resilience**: If startup sync fails, the backend still starts normally.
- **Recurring resilience**: If a scheduled sync fails, subsequent cycles continue.

### Monitoring sync status

Check backend logs for sync activity:

```bash
# View sync logs
grep -i "data sync" /var/log/rssight/backend.log

# Or with systemd
journalctl -u rssight-backend | grep -i "data sync"
```

### Troubleshooting

| Error message | Cause | Solution |
|---------------|-------|----------|
| `Not a git repository` | `data/` is not initialized as git repo | Run `git init` in `data/` directory |
| `No remote 'origin' configured` | Missing remote | Run `git remote add origin <url>` |
| `Pull/rebase failed` + auth error | Credentials not configured | Set up SSH keys or credential helper |
| `Pull/rebase failed` + conflict | Diverged branches | Manually resolve conflicts in `data/`, then commit |
| `Push failed` | No push access or diverged history | Check permissions; pull/rebase first |
| Sync silently skipped | Not a git repo or no remote | Check logs for specific reason |

### Manual sync

To manually trigger a sync cycle:

```bash
cd /path/to/rssight/data
git pull --rebase origin
git add -A
git commit -m "Manual sync" || true  # Skip if nothing to commit
git push origin
```

### Disabling sync

Data sync is automatically skipped if:
- `data/` is not a git repository
- No `origin` remote is configured

No configuration is needed to disable sync — simply don't initialize git in `data/`.

## Local quality gate

### Windows

```bat
scripts\ci-check.cmd
```

### macOS/Linux

```bash
scripts/ci-check.sh
```

The quality gate runs:
- Backend: ruff (lint), black (format check), mypy (type check), pytest
- Frontend: lint, typecheck, test:ui (vitest), test:e2e (Playwright)

## Key documents

| Document | Purpose |
|----------|---------|
| `AGENTS.md` | Engineering rules and policy |
| `docs/architecture.md` | System design and file layout |
| `docs/testing-strategy.md` | Test scope and commands |
| `docs/api-contract.md` | Backend API contract |
| `docs/adr/` | Architecture Decision Records |

## Makefile (Linux/macOS)

For convenience on Linux and macOS, a `Makefile` provides common development commands:

```bash
make install     # Install all dependencies (backend + frontend)
make dev         # Start development servers
make test        # Run all tests
make lint        # Run all linters
make build       # Build frontend for production
make clean       # Remove generated files and caches
make ci          # Run full CI quality gate
make format      # Auto-format code
make help        # Show all available targets
```

### Port configuration

Override default ports with environment variables:

```bash
make dev BACKEND_PORT=9000 FRONTEND_PORT=3000
```

### Notes

- The Makefile requires `make` (standard on Linux/macOS).
- For Windows, use the `scripts/*.cmd` files directly or run in WSL.
- `make clean` removes `.venv` - reinstall with `make install` after cleaning.
