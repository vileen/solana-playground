import { Router } from 'express';
import { checkAuthStatus, requireAuth } from '../middleware/auth.js';

const router = Router();

// Get auth status (public endpoint)
router.get('/auth/status', checkAuthStatus);

// Login endpoint
router.post('/auth/login', (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.APP_PASSWORD || 'f09e8b8a8fc1';

  if (password === correctPassword) {
    req.session.isAuthenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Logout endpoint (protected, but we'll allow it even if not fully authed)
router.post('/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Failed to logout' });
    } else {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    }
  });
});

// Protected test endpoint
router.get('/auth/verify', requireAuth, (_req, res) => {
  res.json({ valid: true });
});

export default router;
