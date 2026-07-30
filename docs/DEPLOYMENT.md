# Deployment

Production target: Contabo VPS, Ubuntu, serving `https://sales.clixworks.co.tz`. This document is written for whoever runs the actual deployment — per this project's constraint, that's the user, not this build process. Nothing in this document requires or references real credentials; every command below uses placeholders you fill in on the server itself.

## 1. Server prerequisites

On a fresh Ubuntu 22.04+ VPS:

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# MySQL 8
sudo apt install -y mysql-server
sudo mysql_secure_installation

# Nginx
sudo apt install -y nginx

# PM2 (process manager for the Node backend)
sudo npm install -g pm2

# Certbot (Let's Encrypt SSL)
sudo apt install -y certbot python3-certbot-nginx

# mysqldump is included with mysql-server above — required for the
# in-app "Run Backup Now" feature and the daily scheduled backup job
# (backend/jobs/backupJob.js) to work. Confirm it's on PATH:
which mysqldump
```

## 2. Database setup

```bash
sudo mysql -u root -p
```

```sql
CREATE DATABASE sales CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'clix_app'@'localhost' IDENTIFIED BY 'CHOOSE_A_STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON sales.* TO 'clix_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Apply the schema (idempotent — safe to re-run, every `CREATE TABLE` is `IF NOT EXISTS`):

```bash
mysql -u clix_app -p sales < backend/database/schema.sql
```

Seed reference data (roles, permissions, expense categories — **not** demo business data):

```bash
mysql -u clix_app -p sales < backend/database/seeders/001_seed_roles_permissions.sql
mysql -u clix_app -p sales < backend/database/seeders/002_seed_reference_data.sql
```

Create the first Super Administrator account:

```bash
cd backend
npm run seed:admin
```

## 3. Application deployment

```bash
sudo mkdir -p /var/www/clix-sales-system
sudo chown $USER:$USER /var/www/clix-sales-system
git clone <your-repo-url> /var/www/clix-sales-system
cd /var/www/clix-sales-system

# Frontend — build the static bundle Nginx will serve
npm install
npm run build   # outputs to dist/

# Backend
cd backend
npm install --omit=dev
```

## 4. Production `.env`

**Never commit this file.** Copy the example and fill in real values on the server only:

```bash
cd /var/www/clix-sales-system/backend
cp .env.example .env
nano .env
```

Required variables (see `.env.example` for the full list): `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (the credentials created in step 2), `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (generate two long random strings — `openssl rand -hex 64` is a good source), `FRONTEND_URL=https://sales.clixworks.co.tz`, `NODE_ENV=production`, `PORT=4000`, and the `SMTP_*` variables if password-reset emails should actually send (leave blank in early testing — `email.service.js` logs a failure to `email_logs` and doesn't crash the app if SMTP isn't configured).

Set the file permissions so it's readable only by the app's user:

```bash
chmod 600 .env
```

## 5. Start the backend with PM2

A PM2 process definition already exists at `backend/ecosystem.config.cjs`:

```bash
cd /var/www/clix-sales-system/backend
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup   # follow the printed instructions to persist PM2 across reboots
```

Confirm it's up:

```bash
pm2 status
curl http://127.0.0.1:4000/api/v1/health
```

## 6. Nginx reverse proxy

A template exists at `deploy/nginx.conf.template`. It serves the frontend's `dist/` build as static files, proxies `/api/` and `/uploads/` to the PM2-managed backend on port 4000, and deliberately does **not** expose `backend/backups/` (see [SECURITY.md](SECURITY.md) — a full database dump must never be reachable at a public URL).

```bash
sudo cp deploy/nginx.conf.template /etc/nginx/sites-available/sales.clixworks.co.tz
sudo ln -s /etc/nginx/sites-available/sales.clixworks.co.tz /etc/nginx/sites-enabled/
sudo nginx -t   # validate config syntax before reloading
sudo systemctl reload nginx
```

## 7. SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d sales.clixworks.co.tz
```

Certbot edits the Nginx config in place to add the SSL block and redirect HTTP → HTTPS, and sets up automatic renewal (`certbot renew` via a systemd timer, installed automatically). Verify renewal works without actually renewing:

```bash
sudo certbot renew --dry-run
```

## 8. Backup & restore

**Backup** is already built into the application — no separate cron setup needed:
- **Manual**: Settings → Backups → "Run Backup Now" (requires `settings.manage`), or `POST /api/v1/settings/backups`.
- **Scheduled**: `backend/jobs/backupJob.js` runs automatically once the backend starts (registered in `server.js`), daily at 02:00 server time. Both paths call the same `backup.service.createBackup()`, writing to `backend/backups/` (outside the publicly-served `uploads/` directory) and recording a row in `system_backups` with `trigger_type` distinguishing manual from scheduled.
- Verify the scheduled job is actually running: `pm2 logs clix-sales-api | grep -i backup`, or check Settings → Backups for a `scheduled`-triggered row appearing daily.

**Restore** (manual — there is no restore endpoint in the application, deliberately: restoring a database is a rare, high-consequence operation that should require direct server access, not be reachable over HTTP):

```bash
# 1. Stop the backend so nothing writes during restore
pm2 stop clix-sales-api

# 2. Restore from a backup file (either downloaded via Settings > Backups,
#    or found directly in backend/backups/ on the server)
mysql -u clix_app -p sales < backend/backups/backup-sales-<timestamp>.sql

# 3. Restart
pm2 start clix-sales-api
```

Test this procedure against a **non-production** database before you ever need it against production — the first time you run a restore should not be during an actual incident.

## 9. Go-live smoke test

Before announcing the system is live, verify manually:

- [ ] `https://sales.clixworks.co.tz` loads over HTTPS with a valid certificate (padlock, no browser warning).
- [ ] Login with the Super Administrator account created in step 2 succeeds.
- [ ] Company Settings (logo upload, business info) saves correctly.
- [ ] Create at least one Branch, Category, Brand, Product — confirm each appears in its list.
- [ ] Record one Purchase — confirm inventory increases (Inventory Overview) and the purchase's stock movements appear (Inventory → Stock Movements).
- [ ] Complete one POS sale — confirm inventory decreases correctly and a receipt PDF opens.
- [ ] Confirm a `sale_completed` notification appears in the bell icon.
- [ ] Check the Reports Center renders real (correctly non-zero, since real data now exists) figures for Sales and Profit.
- [ ] Trigger a manual backup from Settings → Backups and confirm it downloads.
- [ ] Confirm `pm2 status` shows the process as `online` with a stable (not repeatedly restarting) uptime after 10+ minutes.

## 10. Ongoing maintenance

- **Logs**: `pm2 logs clix-sales-api` for live tailing; `backend/logs/` for Winston's file output (rotate with `logrotate` if disk usage becomes a concern — not configured by default).
- **Updates**: `git pull`, `npm install` (both `/` and `backend/`), `npm run build` (frontend), `mysql ... < backend/database/schema.sql` (safe to re-run — every table is `CREATE TABLE IF NOT EXISTS`; new migrations from a future change would need to be applied individually), `pm2 restart clix-sales-api`.
- **Scaling**: the current PM2 config runs a single backend instance (`exec_mode: 'fork'`). The `authorize()` middleware's permission cache is in-process memory — moving to PM2 cluster mode (multiple Node processes) is possible since all persistent state lives in MySQL, but be aware each worker would keep its own permission cache, so a role-permission change could take up to 60 seconds to reflect on a worker that didn't handle the request that changed it. Not a correctness issue, just a note if cluster mode is adopted later.
