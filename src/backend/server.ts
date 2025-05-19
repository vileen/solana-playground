import express from 'express';
import cors from 'cors';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import apiRoutes from './routes/api.js';
import { PORT, DATA_DIR } from './config/config.js';

// Get the directory name for the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Express app
const app = express();

// CORS configuration
const corsOptions = {
  origin: function(origin, callback) {
    // In production, only allow same-origin requests or no origin (like mobile apps)
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
  optionsSuccessStatus: 200
};

// Apply middleware
app.use(cors(corsOptions));
app.use(express.json());

// Create data directory if it doesn't exist
mkdir(DATA_DIR, { recursive: true }).catch(console.error);

// Set up API routes
app.use('/api', apiRoutes);

// Serve static files from 'dist' directory
app.use(express.static(join(__dirname, '../../../dist')));

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../../../dist/index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 