# Solana Playground Auth Config

## How it works (NEW - Backend Auth)

The app now uses **proper server-side session authentication**:

1. Password is stored only on the server in `APP_PASSWORD` env var
2. On successful login, server creates a signed session cookie
3. All API routes are protected - no session = 401 Unauthorized
4. Password is never exposed to the client

## Environment Variables

```bash
# Required: Session secret (generate a strong random string)
SESSION_SECRET=your-super-secret-random-string

# Required: App password for login
APP_PASSWORD=your-secure-password

# Development: Frontend API URL
VITE_API_URL=http://localhost:3002
```

## To change password

1. Update `APP_PASSWORD` in your `.env` file
2. Restart the backend server
3. Users will need to re-login with the new password

## Security Notes

- Password is **server-side only** - not in frontend code
- Sessions use signed cookies with httpOnly flag
- In production, cookies are secure (HTTPS only)
- All API routes require valid session
- Session expires after 24 hours of inactivity

## Production Deployment

On Render/VPS:
1. Set `SESSION_SECRET` to a cryptographically secure random string
2. Set `APP_PASSWORD` to your desired access password
3. Set `NODE_ENV=production` (enables secure cookies)
4. Ensure HTTPS is enabled (cookies won't work over HTTP in production)
