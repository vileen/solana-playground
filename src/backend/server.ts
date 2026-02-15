import cors from 'cors';
import express from 'express';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { DATA_DIR, PORT } from './config/config.js';
import apiRoutes from './routes/api.js';
import eventsRoutes from './routes/events.js';
import stakingRoutes from './routes/stakingRoutes.js';

// Get the directory name for the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Express app
const app = express();

app.disable('x-powered-by');

const trustProxyEnabled = process.env.TRUST_PROXY === 'true';
if (trustProxyEnabled) {
  app.set('trust proxy', 1);
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Non-browser clients can send no Origin header.
    if (!origin) {
      callback(null, true);
      return;
    }

    // If ALLOWED_ORIGINS is set, use it as the source of truth.
    if (allowedOrigins.length > 0) {
      callback(null, allowedOrigins.includes(origin));
      return;
    }

    // Backward-compatible fallback for existing Render deployments.
    if (process.env.NODE_ENV === 'production') {
      if (!origin || origin === process.env.RENDER_EXTERNAL_URL) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    } else {
      // In development, allow all origins
      callback(null, true);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// Apply middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.ENFORCE_HTTPS === 'true') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Create data directory if it doesn't exist
mkdir(DATA_DIR, { recursive: true }).catch(console.error);

// Set up API routes
app.use('/api', apiRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api', stakingRoutes);

// Serve static files from 'dist' directory
let distPath;
if (process.env.NODE_ENV === 'production') {
  // In production (Render), check multiple possible paths
  const possiblePaths = [
    join(__dirname, '../../../dist'), // Default path
    join(__dirname, '../../dist'), // Shorter path if backend is at different location
    join(process.cwd(), 'dist'), // Root-relative path
    '/opt/render/project/src/dist', // Absolute path for Render
  ];

  // Find the first path that exists
  distPath = possiblePaths.find(path => existsSync(path)) || possiblePaths[0];
  console.log(`Using static files from: ${distPath}`);
} else {
  // In development, use the usual path
  distPath = join(__dirname, '../../../dist');
}

app.use(express.static(distPath));

// Catch-all route for SPA
app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  console.log(`Serving SPA from: ${indexPath}`);
  res.sendFile(indexPath);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
