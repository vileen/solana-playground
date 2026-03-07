# Service Ports

## Solana Playground

| Service | Port | Description |
|---------|------|-------------|
| Backend API | **3002** | Express.js server |
| Frontend Dev | 5173 | Vite dev server (development only) |

### Cloudflare Tunnel

- **Public URL:** https://solana.vileen.pl
- **Local Backend:** http://localhost:3002
- **Config:** `~/.cloudflared/solana-playground.yml`

### Environment Variables

```bash
# .env.local
PORT=3002
```

### Port Allocation

This project uses port 3002 to avoid conflicts with:
- Speech Practice (port 3001)
- Other local services

Do not change without updating cloudflared config.
