# Deployment Guide

## Architecture Overview

This project uses a **hybrid deployment model**:

- **Frontend**: Deployed to GitHub Pages (static hosting)
- **Backend + Database**: Running locally on your machine

This gives you:
- ✅ Free frontend hosting via GitHub Pages
- ✅ Full control over your data (local PostgreSQL)
- ✅ No server costs for the frontend
- ⚠️ Your machine needs to be on for the backend to work (or use a VPS)

---

## Quick Start

### 1. Setup Local Backend

```bash
# 1. Install dependencies
yarn install

# 2. Setup PostgreSQL locally
# macOS: brew install postgresql@16
# Then create database:
createdb solana_playground

# 3. Configure environment
cp .env .env.local
# Edit .env.local with your settings

# 4. Initialize database
yarn db:init

# 5. Start backend
yarn start
```

Backend will run on `http://localhost:3001`

### 2. Deploy Frontend to GitHub Pages

```bash
# Build for production
GITHUB_PAGES=true yarn build

# Or push to main branch - GitHub Actions will deploy automatically
```

---

## Configuration

### Backend (.env.local)

```bash
# Database (local)
DATABASE_URL=postgresql://localhost:5432/solana_playground
PGHOST=localhost
PGPORT=5432
PGDATABASE=solana_playground

# Solana RPC
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
# Or use Helius for better rate limits:
# SOLANA_RPC_URL=https://mainnet.helius-rpc.com/
# SOLANA_API_KEY=your_helius_api_key

# CORS - Add your GitHub Pages URL
ALLOWED_ORIGINS=https://yourusername.github.io,http://localhost:5173,http://localhost:3005

NODE_ENV=production
PORT=3001
```

### Frontend (GitHub Secrets)

In your GitHub repository, go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value | Example |
|--------|-------|---------|
| `VITE_API_URL` | Your backend URL | `https://your-tunnel.trycloudflare.com/api` |

**For local backend with public access, use Cloudflare Tunnel (recommended):**

```bash
# Install cloudflared
brew install cloudflared

# Start tunnel to your local backend
cloudflared tunnel --url http://localhost:3001

# Copy the https URL (e.g., https://something.trycloudflare.com)
# Add /api to it and set as VITE_API_URL in GitHub Secrets
# Example: https://something.trycloudflare.com/api
```

**Alternative: ngrok**
```bash
ngrok http 3001
# Then set VITE_API_URL to the https URL provided by ngrok + /api
```

---

## GitHub Pages Setup

1. Go to **Settings → Pages** in your GitHub repository
2. Set **Source** to "GitHub Actions"
3. Push to `main` branch - the workflow will automatically deploy

Your site will be available at: `https://yourusername.github.io/solana-playground/`

---

## Development Mode

For local development with both frontend and backend:

```bash
# Terminal 1 - Backend
yarn start

# Terminal 2 - Frontend
yarn dev
```

Frontend will proxy API calls to `localhost:3001` automatically.

---

## Alternative: Full Local Setup

If you want everything local (no GitHub Pages):

```bash
# Build frontend
yarn build

# Start backend (serves both API and frontend static files)
yarn start
# Open http://localhost:3001
```

---

## Troubleshooting

### CORS Errors
Make sure `ALLOWED_ORIGINS` in your backend `.env.local` includes your GitHub Pages URL.

### API Not Connecting
- Check that backend is running: `curl http://localhost:3001/api/holders`
- Verify `VITE_API_URL` secret in GitHub is set correctly
- Check browser console for detailed error messages

### Database Connection Issues
```bash
# Verify PostgreSQL is running
brew services list | grep postgresql

# Check database exists
psql -l | grep solana_playground
```

---

## Security Considerations

- **Never commit `.env.local`** - it contains your API keys and database credentials
- **Keep your backend local** or use a VPN if exposing to internet
- **Rotate API keys regularly** (Helius, BitQuery, etc.)
- **Use strong PostgreSQL passwords** if exposing database externally
