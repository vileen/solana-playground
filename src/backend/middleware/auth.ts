import type { NextFunction, Request, Response } from 'express';

// Extend Express Request to include session
declare module 'express-session' {
  interface SessionData {
    isAuthenticated?: boolean;
  }
}

// Middleware to check if user is authenticated
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.isAuthenticated) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Middleware to check auth status (returns 200 with status, doesn't block)
export function checkAuthStatus(req: Request, res: Response): void {
  res.json({ isAuthenticated: !!req.session?.isAuthenticated });
}
