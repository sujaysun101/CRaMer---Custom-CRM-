# CRaMer Self-Hosting Guide (Zero Supabase, Zero Vercel)

This guide walks you through hosting CRaMer entirely on your own infrastructure with standard PostgreSQL and a standalone Next.js server.

---

## Architecture

* **Database**: Native PostgreSQL 16 (persistent volume on your own disk/server)
* **Application**: Next.js 14 Production Server (`standalone` mode, ~120MB container)
* **Scheduler**: Built-in daily sync worker (replaces Vercel Cron)
* **SSL / Networking**: Cloudflare Tunnel (recommended, 0 open ports) or Caddy / Nginx

---

## Option 1: Turnkey Docker Compose (Recommended)

Everything runs in one command. PostgreSQL, the web application, and the daily sync worker will start together with automatic persistent storage.

### 1. Requirements
* Docker & Docker Compose (`docker compose version`)

### 2. Configure Environment (Optional)
Create or edit `.env` in the root directory:
```env
# Database Credentials
POSTGRES_USER=cramer
POSTGRES_PASSWORD=your_super_secret_password_here
POSTGRES_DB=cramer_db

# Web App Security
CRM_PASSWORD_HASH=7d92562b5bdc34fdeb08649404642ebb8ef50beae57ce667adf5784e8c9ea96a
CRON_SECRET=cramer_internal_cron_secret_2026
PORT=3000
```

### 3. Launch
```bash
docker compose up -d --build
```
That's it!
* PostgreSQL starts on port `5432` with automatic database initialization.
* The Next.js CRM starts on `http://localhost:3000`.
* The background worker triggers `/api/sync` every day at midnight (UTC).

### 4. Stop or Restart
```bash
docker compose down          # Stop containers (database volume preserved)
docker compose logs -f app   # View live application logs
```

---

## Option 2: Running Directly on a VPS / Linux Server (No Docker)

If you prefer running natively on Ubuntu/Debian/Fedora:

### 1. Install PostgreSQL & Node.js
```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y postgresql postgresql-contrib nodejs npm

# Create user & database
sudo -u postgres psql -c "CREATE USER cramer WITH ENCRYPTED PASSWORD 'your_password';"
sudo -u postgres psql -c "CREATE DATABASE cramer_db OWNER cramer;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cramer_db TO cramer;"
```

### 2. Initialize Database & Migrate Data
In the repository folder:
```bash
export DATABASE_URL="postgresql://cramer:your_password@localhost:5432/cramer_db"
node migrate-to-pg.js
```
This applies `schema.sql` and loads all existing contacts, meetings, and email history from `data/seed.json`.

### 3. Run with systemd / PM2
Install PM2 to keep the server running 24/7:
```bash
npm install -g pm2
npm run build
pm2 start npm --name "cramer-crm" -- start
pm2 save
pm2 startup
```

### 4. Native Daily Sync Cron
Add a line to your system crontab (`crontab -e`):
```bash
0 0 * * * curl -s -X POST http://localhost:3000/api/sync -H "Authorization: Bearer cramer_internal_cron_secret_2026"
```

---

## Exposing to the Internet Securely (Free HTTPS)

### Recommended: Cloudflare Tunnel (Zero Port Forwarding)
You don't need a static IP, you don't need to open port 80/443, and your server's IP remains 100% hidden behind Cloudflare:
1. Install `cloudflared` on your server.
2. Run:
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create cramer
   cloudflared tunnel route dns cramer crm.yourdomain.com
   cloudflared tunnel run --url http://localhost:3000 cramer
   ```
Cloudflare automatically manages the SSL certificate and DDoS protection for free.

### Alternative: Caddy Reverse Proxy
If hosting on a VPS with a public IP, install Caddy (`sudo apt install caddy`) and add to `/etc/caddy/Caddyfile`:
```caddy
crm.yourdomain.com {
    reverse_proxy localhost:3000
}
```
Caddy automatically provisions and renews Let's Encrypt SSL certificates.

---

## Backups

To back up your self-hosted PostgreSQL database anytime:
```bash
# Docker Compose
docker exec -t cramer_postgres pg_dump -U cramer cramer_db | gzip > backup_$(date +%F).sql.gz

# Native
pg_dump -U cramer cramer_db | gzip > backup_$(date +%F).sql.gz
```
