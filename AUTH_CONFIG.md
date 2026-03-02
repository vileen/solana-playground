# Solana Playground Auth Config

## Password
**f09e8b8a8fc1** (12 characters, hex)

## How it works
- Password is hardcoded in `src/frontend/hooks/useAuth.ts`
- On successful login, stored in localStorage as `solana-playground-auth`
- AuthGuard component blocks access until correct password entered
- Logout button in header clears localStorage

## To change password
1. Edit `CORRECT_PASSWORD` in `src/frontend/hooks/useAuth.ts`
2. Rebuild and redeploy
