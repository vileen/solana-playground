// Simple diagnostic script to check file paths and environment
import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve();

console.log('=== DIAGNOSTIC INFORMATION ===');
console.log('Current directory:', __dirname);
console.log('Process cwd:', process.cwd());
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV);

// Check for dist directory
console.log('\n=== CHECKING DIST DIRECTORY ===');
const distPath = join(__dirname, 'dist');
console.log('Dist path:', distPath);
console.log('Dist exists:', existsSync(distPath));

if (existsSync(distPath)) {
  console.log('\nDist directory contents:');
  const distContents = readdirSync(distPath, { withFileTypes: true });
  distContents.forEach(entry => {
    console.log(`- ${entry.name} ${entry.isDirectory() ? '(directory)' : '(file)'}`);
  });
  
  // Check backend directory
  const backendPath = join(distPath, 'backend');
  console.log('\nBackend path:', backendPath);
  console.log('Backend exists:', existsSync(backendPath));
  
  if (existsSync(backendPath)) {
    console.log('\nBackend directory contents:');
    const backendContents = readdirSync(backendPath, { withFileTypes: true });
    backendContents.forEach(entry => {
      console.log(`- ${entry.name} ${entry.isDirectory() ? '(directory)' : '(file)'}`);
    });
    
    // Check server.js specifically
    const serverPath = join(backendPath, 'server.js');
    console.log('\nServer.js path:', serverPath);
    console.log('Server.js exists:', existsSync(serverPath));
  }
}

// List all root directory contents for reference
console.log('\n=== ROOT DIRECTORY CONTENTS ===');
const rootContents = readdirSync(__dirname, { withFileTypes: true });
rootContents.forEach(entry => {
  console.log(`- ${entry.name} ${entry.isDirectory() ? '(directory)' : '(file)'}`);
}); 