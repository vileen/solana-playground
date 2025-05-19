#!/usr/bin/env node

// Simple script to start the server from the project root
// This ensures environment variables from .env.local are loaded correctly

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Force NODE_ENV to be production for SSL config
process.env.NODE_ENV = 'production';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Launch the server
const server = spawn('node', [
  '--loader', 
  'ts-node/esm',
  join(__dirname, 'src', 'backend', 'server.ts')
], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

// Handle process exit
server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
}); 