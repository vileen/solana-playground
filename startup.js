// Special startup script for Render deployment
import { spawn } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== SERVER STARTUP SCRIPT ===');
console.log('Current directory:', process.cwd());
console.log('__dirname:', __dirname);
console.log('Node version:', process.version);

// List of possible server file locations to try
const possiblePaths = [
  // Relative paths
  './dist/backend/server.js',
  'dist/backend/server.js',
  // Absolute paths based on current directory
  join(process.cwd(), 'dist/backend/server.js'),
  // Render specific paths
  '/opt/render/project/src/dist/backend/server.js',
  // Path based on __dirname
  join(__dirname, 'dist/backend/server.js'),
];

let serverPath = null;

// Find the first path that exists
for (const path of possiblePaths) {
  console.log(`Checking path: ${path}`);
  if (existsSync(path)) {
    serverPath = path;
    console.log(`Found server at: ${path}`);
    break;
  }
}

if (!serverPath) {
  console.error('Could not find server.js in any of the expected locations');
  console.log('Listing directory contents:');
  
  try {
    const rootContents = readdirSync(process.cwd());
    console.log('Root directory:', rootContents);
    
    if (rootContents.includes('dist')) {
      const distContents = readdirSync(join(process.cwd(), 'dist'));
      console.log('Dist directory:', distContents);
      
      if (distContents.includes('backend')) {
        const backendContents = readdirSync(join(process.cwd(), 'dist/backend'));
        console.log('Backend directory:', backendContents);
      }
    }
  } catch (err) {
    console.error('Error listing directories:', err);
  }
  
  process.exit(1);
}

// Use spawn to run the server with the experimental flag
console.log(`Starting server from: ${serverPath}`);
const server = spawn('node', ['--experimental-specifier-resolution=node', serverPath], {
  stdio: 'inherit'
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code, signal) => {
  if (code !== 0) {
    console.error(`Server exited with code ${code} and signal ${signal}`);
    process.exit(code || 1);
  }
}); 