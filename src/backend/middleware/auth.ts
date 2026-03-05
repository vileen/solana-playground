import type { NextFunction, Request, Response } from 'express';

// Simple in-memory session store for manually set cookies
const sessions = new Map<string, { isAuthenticated: boolean; createdAt: number }>();

// Clean up old sessions every hour (30 day expiry)
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > 30 * 24 * 60 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 60 * 60 * 1000);

// Extend Express Request to include session
declare module 'express-session' {
  interface SessionData {
    isAuthenticated?: boolean;
  }
}

// Get session from custom cookie
function getSession(req: Request) {
  const sessionId = req.cookies?.['solana-playground.sid'];
  if (!sessionId) return null;
  return sessions.get(sessionId);
}

// Set session in store
export function setSession(sessionId: string, data: { isAuthenticated: boolean }) {
  sessions.set(sessionId, { ...data, createdAt: Date.now() });
}

// Middleware to check if user is authenticated
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const session = getSession(req);
  if (session?.isAuthenticated) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Middleware to check auth status (returns 200 with status, doesn't block)
export function checkAuthStatus(req: Request, res: Response): void {
  const session = getSession(req);
  res.json({ isAuthenticated: !!session?.isAuthenticated });
}
