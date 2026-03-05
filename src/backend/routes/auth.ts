import { Router } from 'express';
import { checkAuthStatus, requireAuth, setSession } from '../middleware/auth.js';

const router = Router();

// Get auth status (public endpoint)
router.get('/auth/status', checkAuthStatus);

// Login endpoint
router.post('/auth/login', (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.APP_PASSWORD || 'f09e8b8a8fc1';

  if (password === correctPassword) {
    // Generate session ID
    const sessionId = req.sessionID || Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    // Store session in our custom store
    setSession(sessionId, { isAuthenticated: true });
    
    // Manually set the session cookie
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
    res.cookie('solana-playground.sid', sessionId, cookieOptions);
    
    console.log('[Auth] Login successful, session:', sessionId);
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Logout endpoint
router.post('/auth/logout', (req, res) => {
  const sessionId = req.cookies?.['solana-playground.sid'];
  if (sessionId) {
    // Remove from our custom store (we'll need to export sessions or add a delete function)
    res.clearCookie('solana-playground.sid');
  }
  res.json({ success: true });
});

// Protected test endpoint
router.get('/auth/verify', requireAuth, (_req, res) => {
  res.json({ valid: true });
});

export default router;
