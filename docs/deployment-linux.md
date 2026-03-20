# Linux deployment guide

Production deployment instructions for running RSSight on Linux servers.

## Goals

- Run backend and frontend reliably on Linux servers.
- Ensure the `data/` directory is persistent and backup-friendly.
- Provide systemd service management for reliability.
- Support reverse proxy setup with nginx for production traffic.

## Recommended architecture

```
                    +-----------------+
                    |     nginx       |
                    |   (reverse      |
                    |    proxy)       |
                    +--------+--------+
                             |
              +--------------+--------------+
              |                             |
      +-------v-------+            +--------v--------+
      |   Backend     |            |    Frontend     |
      |  (uvicorn)    |            |   (static or    |
      |  port 8173    |            |    dev server)  |
      +---------------+            +-----------------+
              |
      +-------v-------+
      |    data/      |
      |  (persistent) |
      +---------------+
```

### Backend options

1. **Systemd + uvicorn** (recommended for single server): Run uvicorn directly as a systemd service.
2. **Systemd + Gunicorn + uvicorn workers** (recommended for production): Use Gunicorn as process manager with uvicorn workers.

### Frontend options

1. **Static hosting via nginx** (recommended for production): Build the frontend (`npm run build`) and serve the `dist/` directory via nginx.
2. **Separate dev server** (development only): Run `npm run dev` on a separate port.

## Prerequisites

- **Python 3.12+** installed
- **Node.js 20+** installed (for frontend build, optional in production if serving pre-built static files)
- **nginx** (for reverse proxy)
- **systemd** (for service management)

## Step 1: Prepare the application

### Clone and setup

```bash
# Clone the repository
git clone <repository-url> /opt/rssight
cd /opt/rssight

# Create Python virtual environment
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .[dev]

# Install frontend dependencies (if building on server)
cd ../frontend
npm install
```

### Verify installation

Run the quality gate to ensure everything is working:

```bash
cd /opt/rssight
./scripts/ci-check.sh
```

## Step 2: Configure environment variables

Create environment configuration for the backend:

```bash
# Create environment file (do not commit this)
sudo mkdir -p /etc/rssight
sudo tee /etc/rssight/backend.env <<EOF
# OpenAI-compatible API configuration
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# Debug mode (set to 0 in production)
WEBRSS_DEBUG=0
EOF

# Secure the file
sudo chmod 600 /etc/rssight/backend.env
```

## Step 3: Set up data directory permissions

```bash
# Create data directory with proper ownership
sudo mkdir -p /opt/rssight/data
sudo chown -R rssight:rssight /opt/rssight/data
sudo chmod 755 /opt/rssight/data
```

Create a dedicated user for running the service:

```bash
sudo useradd -r -s /bin/false rssight
sudo chown -R rssight:rssight /opt/rssight
```

## Step 4: Install systemd service files

RSSight provides ready-to-use systemd unit files in `scripts/systemd/`.

### Copy service files

```bash
# Copy the provided service files to systemd directory
sudo cp scripts/systemd/rssight-backend.service /etc/systemd/system/

# Optional: Copy frontend dev server service (development only)
sudo cp scripts/systemd/rssight-frontend.service /etc/systemd/system/
```

### Backend service

The backend service file (`rssight-backend.service`) runs uvicorn with:

- **User/Group**: `rssight` (create this user first, see Step 3)
- **WorkingDirectory**: `/opt/rssight/backend`
- **EnvironmentFile**: `/etc/rssight/backend.env` (see Step 2)
- **ExecStart**: Uses venv uvicorn at `/opt/rssight/backend/.venv/bin/uvicorn`
- **Restart**: `on-failure` with 5-second delay
- **Security**: `NoNewPrivileges=true`, `PrivateTmp=true`

### Optional: Frontend dev server service

For development or if running the Vite dev server, use `rssight-frontend.service`:

- **WorkingDirectory**: `/opt/rssight/frontend`
- **ExecStart**: `npm run dev -- --host 127.0.0.1 --port 5173`
- **Requires**: `rssight-backend.service`

> **Note**: For production, use static hosting (build + nginx) instead of the dev server.

### Enable and start services

```bash
# Reload systemd to pick up new units
sudo systemctl daemon-reload

# Enable services to start on boot
sudo systemctl enable rssight-backend

# Start the backend
sudo systemctl start rssight-backend

# Check status
sudo systemctl status rssight-backend
```

## Step 5: Configure nginx reverse proxy

### Install nginx

```bash
sudo apt update
sudo apt install nginx
```

### Create nginx configuration

RSSight provides a ready-to-use nginx configuration template in `scripts/nginx/rssight.conf`.

#### Using the template

```bash
# Copy the provided nginx configuration
sudo cp scripts/nginx/rssight.conf /etc/nginx/sites-available/

# Create symlink to enable the site
sudo ln -s /etc/nginx/sites-available/rssight.conf /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

#### Template contents

The template (`scripts/nginx/rssight.conf`) includes:

- **Upstream block** for backend API (127.0.0.1:8173)
- **Location blocks** for `/api/` proxy and static frontend
- **WebSocket support** for future real-time features
- **Security headers** (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy)
- **Gzip compression** for text-based assets
- **Static asset caching** (30-day expiry for js, css, images, fonts)
- **Health check endpoint** without access logging
- **Optional HTTPS block** (commented out, ready for SSL setup)

#### Customization

Before enabling, edit the configuration to match your setup:

```bash
sudo nano /etc/nginx/sites-available/rssight.conf
```

Key settings to update:

- `server_name your-domain.com;` — Replace with your domain or server IP
- `root /opt/rssight/frontend/dist;` — Adjust if frontend is built elsewhere
- Upstream port `127.0.0.1:8173` — Adjust if backend runs on different port

#### Manual configuration (alternative)

If you prefer to create the configuration manually, use this minimal example:

```nginx
# Upstream for backend API
upstream rssight_backend {
    server 127.0.0.1:8173;
    keepalive 32;
}

server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain or IP

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API proxy
    location /api/ {
        proxy_pass http://rssight_backend/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /healthz {
        proxy_pass http://rssight_backend/healthz;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Static frontend (production)
    root /opt/rssight/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### Enable the site

```bash
# Create symlink to enable the site
sudo ln -s /etc/nginx/sites-available/rssight.conf /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Step 6: Build frontend for production

```bash
cd /opt/rssight/frontend

# Set the backend URL for production
VITE_API_BASE_URL=https://your-domain.com/api npm run build

# The output will be in frontend/dist/
# nginx serves these static files
```

## Step 7: SSL/TLS configuration (recommended)

Use Let's Encrypt for free SSL certificates:

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain and install certificate
sudo certbot --nginx -d your-domain.com

# This will automatically modify nginx config for HTTPS
# and set up auto-renewal
```

## Pre-run checklist

Before going live, verify:

- [ ] `scripts/ci-check.sh` passes completely
- [ ] `GET /healthz` returns `ok`:
  ```bash
  curl http://127.0.0.1:8173/healthz
  ```
- [ ] Data directory is writable by the `rssight` user:
  ```bash
  sudo -u rssight touch /opt/rssight/data/test.txt && sudo -u rssight rm /opt/rssight/data/test.txt
  ```
- [ ] Logs are accessible:
  ```bash
  sudo journalctl -u rssight-backend -f
  ```
- [ ] nginx is properly proxying requests:
  ```bash
  curl http://your-domain.com/healthz
  ```
- [ ] SSL certificate is valid (if using HTTPS)

## Log management

### Viewing logs

```bash
# Backend service logs
sudo journalctl -u rssight-backend -f

# View last 100 lines
sudo journalctl -u rssight-backend -n 100

# nginx access/error logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Log rotation

systemd journals are automatically rotated by the system. For nginx, logs are typically rotated via `/etc/logrotate.d/nginx`.

## Service management commands

```bash
# Start services
sudo systemctl start rssight-backend

# Stop services
sudo systemctl stop rssight-backend

# Restart services
sudo systemctl restart rssight-backend

# View status
sudo systemctl status rssight-backend

# Enable on boot
sudo systemctl enable rssight-backend

# Disable on boot
sudo systemctl disable rssight-backend
```

## Updating the application

```bash
# Stop services
sudo systemctl stop rssight-backend

# Pull latest changes
cd /opt/rssight
git pull

# Update backend dependencies
cd backend
source .venv/bin/activate
pip install -e .[dev]

# Rebuild frontend (if needed)
cd ../frontend
npm install
npm run build

# Start services
sudo systemctl start rssight-backend
```

## Troubleshooting

### Backend won't start

1. Check logs: `sudo journalctl -u rssight-backend -n 50`
2. Verify Python environment: `/opt/rssight/backend/.venv/bin/python --version`
3. Check environment file: `sudo cat /etc/rssight/backend.env`
4. Verify permissions: `ls -la /opt/rssight/data`

### 502 Bad Gateway

1. Verify backend is running: `sudo systemctl status rssight-backend`
2. Check if backend responds directly: `curl http://127.0.0.1:8173/healthz`
3. Check nginx error log: `sudo tail -f /var/log/nginx/error.log`

### Permission denied errors

1. Verify ownership: `ls -la /opt/rssight`
2. Fix ownership: `sudo chown -R rssight:rssight /opt/rssight`
3. Check file permissions: `sudo chmod 755 /opt/rssight/data`

### Frontend not loading

1. Verify build exists: `ls -la /opt/rssight/frontend/dist/`
2. Check nginx configuration: `sudo nginx -t`
3. Verify nginx is serving: `sudo systemctl status nginx`

## Production hardening recommendations

1. **Firewall**: Use `ufw` to restrict ports
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 22/tcp
   sudo ufw enable
   ```

2. **Fail2ban**: Protect against brute force attacks
   ```bash
   sudo apt install fail2ban
   ```

3. **Regular backups**: Backup the `data/` directory regularly
   ```bash
   # Example backup command
   tar -czf rssight-backup-$(date +%Y%m%d).tar.gz /opt/rssight/data
   ```

4. **Monitoring**: Consider adding monitoring (Prometheus, Grafana, or similar)

5. **Rate limiting**: Configure nginx rate limiting for the API

## Docker Deployment

RSSight provides Docker support for containerized deployment. This is an alternative to the systemd + nginx approach described above.

### Prerequisites

- **Docker** 20.10+ installed
- **Docker Compose** v2.0+ installed

### Quick Start with Docker Compose

1. **Clone the repository**
   ```bash
   git clone <repository-url> /opt/rssight
   cd /opt/rssight
   ```

2. **Create environment file**
   ```bash
   cat > .env <<EOF
   OPENAI_API_KEY=your-api-key-here
   OPENAI_BASE_URL=https://api.openai.com/v1
   OPENAI_MODEL=gpt-4o-mini
   WEBRSS_DEBUG=0
   EOF
   ```

3. **Build and start containers**
   ```bash
   docker compose up -d
   ```

4. **Verify containers are running**
   ```bash
   docker compose ps
   ```

5. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8173
   - Health check: http://localhost:8173/healthz

### Docker Files

| File | Description |
|------|-------------|
| `Dockerfile` | Multi-stage build for backend (Python 3.12-slim) |
| `Dockerfile.frontend` | Multi-stage build for frontend (Node 20 + nginx) |
| `docker-compose.yml` | Orchestrates backend and frontend services |
| `.dockerignore` | Excludes unnecessary files from build context |

### Data Persistence

The `rssight-data` Docker volume is used to persist the `data/` directory:

```bash
# List volumes
docker volume ls | grep rssight

# Inspect volume
docker volume inspect rssight_rssight-data

# Backup data
docker run --rm -v rssight_rssight-data:/data -v $(pwd):/backup alpine tar -czf /backup/rssight-backup-$(date +%Y%m%d).tar.gz /data
```

### Docker Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# View backend logs only
docker compose logs -f backend

# Rebuild images
docker compose build --no-cache

# Restart services
docker compose restart

# Stop and remove containers, networks, volumes
docker compose down -v
```

### Environment Variables

Configure these in `.env` file or pass them directly:

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | (required) |
| `OPENAI_BASE_URL` | OpenAI API base URL | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Model to use for summarization | `gpt-4o-mini` |
| `WEBRSS_DEBUG` | Enable debug mode | `0` |

### Health Checks

Both containers include health checks:

- **Backend**: Checks `/healthz` endpoint every 30 seconds
- **Frontend**: Checks nginx is responding every 30 seconds

```bash
# Check container health
docker compose ps
docker inspect --format='{{.State.Health.Status}}' rssight-backend
docker inspect --format='{{.State.Health.Status}}' rssight-frontend
```

### Custom Ports

To use different ports, modify `docker-compose.yml` or use environment variables:

```bash
# Run backend on port 9000, frontend on port 3000
BACKEND_PORT=9000 FRONTEND_PORT=3000 docker compose up -d
```

Or update the ports section in `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "9000:8000"
  frontend:
    ports:
      - "3000:80"
```

### Production Considerations

1. **Use a reverse proxy** (nginx, Traefik, Caddy) in front of Docker containers for:
   - SSL/TLS termination
   - Domain-based routing
   - Rate limiting

2. **Resource limits**: Add resource constraints to `docker-compose.yml`:
   ```yaml
   services:
     backend:
       deploy:
         resources:
           limits:
             cpus: '1'
             memory: 512M
   ```

3. **Logging**: Configure Docker logging driver:
   ```yaml
   services:
     backend:
       logging:
         driver: "json-file"
         options:
           max-size: "10m"
           max-file: "3"
   ```

4. **Network security**: Place containers behind a reverse proxy and don't expose ports directly to the internet.

### Updating Docker Deployment

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose up -d --build

# Or step by step
docker compose build
docker compose down
docker compose up -d
```

### Troubleshooting Docker

**Backend won't start**
```bash
# Check logs
docker compose logs backend

# Check if environment variables are set
docker compose exec backend env | grep OPENAI

# Test health check manually
docker compose exec backend python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/healthz').read())"
```

**Frontend not loading**
```bash
# Check if nginx is serving files
docker compose exec frontend ls /usr/share/nginx/html

# Check nginx logs
docker compose logs frontend

# Test nginx config
docker compose exec frontend nginx -t
```

**API proxy not working**
```bash
# Verify backend is reachable from frontend container
docker compose exec frontend wget -qO- http://backend:8000/healthz

# Check network connectivity
docker network inspect rssight_rssight-network
```

**Volume issues**
```bash
# Check volume contents
docker run --rm -v rssight_rssight-data:/data alpine ls -la /data

# Fix permissions
docker run --rm -v rssight_rssight-data:/data alpine chown -R 1000:1000 /data
```
