# Deploying on a Mac mini (Secure Setup)

This guide helps you run the app on a personal Mac mini with a safer production baseline and lower monthly cost than managed hosting.

## 1) Recommended architecture

- Mac mini runs:
  - PostgreSQL (local only)
  - Node app (`yarn start` after build)
  - Reverse proxy (Caddy recommended)
- Public internet hits only ports `80/443` on Caddy
- Node app (`3001`) and Postgres (`5432`) stay private (loopback/LAN only)

## 2) Prerequisites

- Static public IP or Dynamic DNS
- A domain (for TLS)
- macOS auto updates enabled
- Xcode command line tools installed

## 3) Create least-privilege app user

Create a dedicated non-admin macOS account for running services and app files.

## 4) Install dependencies

```bash
brew update
brew install node@20 yarn postgresql@16 caddy
```

Ensure Node 20 is used in your runtime shell.

## 5) Configure environment

Copy `env.production.example` to your real environment file (do not commit secrets):

```bash
cp env.production.example .env
```

Set at minimum:

- `DATABASE_URL`
- `SOLANA_RPC_URL`
- `SOLANA_API_KEY`
- `BITQUERY_API_KEY`
- `BITQUERY_TOKEN`
- `ALLOWED_ORIGINS` (your exact frontend origin)

## 6) Build and run app

```bash
yarn install --frozen-lockfile
yarn build
yarn build:backend
NODE_ENV=production yarn start
```

The API and SPA should be reachable on `http://127.0.0.1:3001`.

## 7) Reverse proxy with Caddy

Use Caddy to terminate TLS and forward requests to the Node app:

```caddyfile
app.example.com {
  encode gzip zstd
  reverse_proxy 127.0.0.1:3001
}
```

Then run:

```bash
sudo caddy validate --config /opt/homebrew/etc/Caddyfile
sudo brew services start caddy
```

## 8) Firewall and exposure

- Allow inbound only `80` and `443` on your router to the Mac mini
- Do not expose `3001` or `5432` externally
- In macOS firewall settings, allow only Caddy and required system services
- Prefer VPN-only admin access (Tailscale/WireGuard) instead of open SSH

## 9) PostgreSQL hardening

- Bind PostgreSQL to localhost unless remote DB access is required
- Create a dedicated DB user with only required privileges
- Use strong random passwords
- Keep periodic vacuum/analyze jobs enabled

Example local-only DSN:

`postgresql://app_user:strong_password@127.0.0.1:5432/solana_playground`

## 10) Process supervision

Use one of:

- `pm2` with startup integration, or
- `launchd` plist service

Goal: auto-start on reboot and restart on crash.

If using PM2:

```bash
yarn global add pm2
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

## 11) Backups (critical)

Set automated backups with rotation:

```bash
pg_dump -Fc -d solana_playground > /path/to/backups/solana_playground_$(date +%F).dump
```

Also back up:

- `.env` (encrypted)
- any local data files in `data/`

Keep at least one off-machine copy.

## 12) Ongoing security checklist

- Keep macOS, Homebrew packages, Node dependencies updated
- Rotate API keys regularly
- Monitor logs for repeated 4xx/5xx spikes
- Verify backup restore monthly
- Consider Cloudflare in front of Caddy for additional DDoS/rate controls

## 13) Cutover from Render

1. Deploy and verify on Mac mini behind your domain
2. Restore/import latest Render Postgres data
3. Smoke test all tabs and snapshot endpoints
4. Switch DNS to Mac mini
5. Keep Render service running for 24-48h rollback window, then decommission

## 14) Auto-deploy on push to main (GitHub Actions)

This repo includes:

- Workflow: `.github/workflows/deploy-main.yml`
- Remote deploy script: `scripts/deploy/deploy-main.sh`
- PM2 config: `ecosystem.config.cjs`

One-time setup on Mac mini:

1. Clone repo to `/opt/solana-playground` (or your chosen path)
2. Ensure `.env` exists with production values
3. Install runtime deps (`node`, `yarn`, `pm2`)
4. Confirm manual deploy works once:

```bash
APP_DIR=/opt/solana-playground BRANCH=main bash /opt/solana-playground/scripts/deploy/deploy-main.sh
```

Then add GitHub repository secrets:

- `MAC_MINI_HOST` - public host/IP
- `MAC_MINI_USER` - SSH user
- `MAC_MINI_SSH_KEY` - private key (ed25519 recommended)
- `MAC_MINI_APP_DIR` - e.g. `/opt/solana-playground`

After that, every push to `main` triggers:

- SSH to Mac mini
- `git fetch/reset` to latest `main`
- `yarn install`
- `yarn build` + `yarn build:backend`
- PM2 reload
