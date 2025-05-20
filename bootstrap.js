// Bootstrap script to copy files and ensure everything is in the right place
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== BOOTSTRAP SCRIPT ===');
console.log('Current directory:', process.cwd());

// Create dist/backend if it doesn't exist
const distBackendDir = path.join(process.cwd(), 'dist/backend');
if (!fs.existsSync(distBackendDir)) {
  console.log('Creating dist/backend directory');
  fs.mkdirSync(distBackendDir, { recursive: true });
}

// Check if server.ts exists
const serverTsPath = path.join(process.cwd(), 'src/backend/server.ts');
if (fs.existsSync(serverTsPath)) {
  console.log('Found server.ts at', serverTsPath);
  
  // Patch the server.ts file to use dynamic port and environment variables
  try {
    console.log('Patching server.ts for dynamic port...');
    let serverContent = fs.readFileSync(serverTsPath, 'utf8');
    
    // Check if the file contains port = 3001 declaration
    if (serverContent.includes('const port = 3001;')) {
      console.log('Patching hardcoded port to use environment variable');
      serverContent = serverContent.replace(
        'const port = 3001;', 
        'const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;'
      );
      fs.writeFileSync(serverTsPath, serverContent);
      console.log('Server file patched for dynamic port binding');
    }
    
    // Check if environment variable fallbacks are needed
    if (serverContent.includes('if (!RPC_URL)')) {
      console.log('Adding VITE_ prefixed variable fallback');
      const fallbackCode = `if (!RPC_URL && process.env.VITE_SOLANA_RPC_URL) {
  console.log('Using VITE_SOLANA_RPC_URL as fallback');
  RPC_URL = process.env.VITE_SOLANA_RPC_URL;
}`;
      
      serverContent = serverContent.replace(
        'if (!RPC_URL) {',
        fallbackCode
      );
      fs.writeFileSync(serverTsPath, serverContent);
      console.log('Server file patched with environment variable fallbacks');
    }
  } catch (error) {
    console.error('Error patching server.ts:', error.message);
  }
  
  // Try to compile it directly
  try {
    console.log('Attempting to compile server.ts directly');
    execSync('npx tsc src/backend/server.ts --outDir dist/backend --esModuleInterop --target ES2022 --module NodeNext --moduleResolution NodeNext', { stdio: 'inherit' });
  } catch (error) {
    console.error('Error compiling server.ts:', error.message);
  }
  
  // Check if server.js was created
  const serverJsPath = path.join(process.cwd(), 'dist/backend/server.js');
  if (fs.existsSync(serverJsPath)) {
    console.log('Successfully compiled server.js to', serverJsPath);
    
    // Patch the compiled JS file as well
    try {
      console.log('Patching compiled server.js for environment compatibility...');
      let jsContent = fs.readFileSync(serverJsPath, 'utf8');
      
      // Add port environment variable support
      if (jsContent.includes('const port = 3001;')) {
        jsContent = jsContent.replace(
          'const port = 3001;', 
          'const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;'
        );
        fs.writeFileSync(serverJsPath, jsContent);
        console.log('Compiled server.js patched for dynamic port binding');
      }
      
      // Add environment variable fallbacks
      if (jsContent.includes('if (!RPC_URL)')) {
        const fallbackCode = `if (!RPC_URL && process.env.VITE_SOLANA_RPC_URL) {
    console.log('Using VITE_SOLANA_RPC_URL as fallback');
    RPC_URL = process.env.VITE_SOLANA_RPC_URL;
}`;
        
        jsContent = jsContent.replace(
          'if (!RPC_URL) {',
          fallbackCode
        );
        fs.writeFileSync(serverJsPath, jsContent);
        console.log('Compiled server.js patched with environment variable fallbacks');
      }
    } catch (error) {
      console.error('Error patching compiled server.js:', error.message);
    }
  } else {
    console.log('Compilation failed, copying TypeScript file');
    
    // Copy the TypeScript file to the dist/backend directory
    try {
      fs.copyFileSync(serverTsPath, path.join(distBackendDir, 'server.ts'));
      console.log('Copied server.ts to dist/backend');
      
      // Try to compile it in place
      try {
        console.log('Attempting to compile in place');
        process.chdir(distBackendDir);
        execSync('npx tsc server.ts --esModuleInterop --target ES2022 --module NodeNext --moduleResolution NodeNext', { stdio: 'inherit' });
        process.chdir(process.cwd());
      } catch (error) {
        console.error('Error compiling in place:', error.message);
      }
    } catch (error) {
      console.error('Error copying file:', error.message);
    }
  }
} else {
  console.error('server.ts not found at', serverTsPath);
}

// Also check for any other TypeScript files in the src/backend directory
const srcBackendDir = path.join(process.cwd(), 'src/backend');
if (fs.existsSync(srcBackendDir)) {
  console.log('Checking for other TypeScript files in src/backend');
  
  try {
    const files = fs.readdirSync(srcBackendDir);
    const tsFiles = files.filter(file => file.endsWith('.ts'));
    
    console.log('Found TypeScript files:', tsFiles);
    
    // Copy all TypeScript files to dist/backend
    for (const file of tsFiles) {
      const srcPath = path.join(srcBackendDir, file);
      const destPath = path.join(distBackendDir, file);
      
      fs.copyFileSync(srcPath, destPath);
      console.log('Copied', file, 'to dist/backend');
    }
  } catch (error) {
    console.error('Error processing src/backend directory:', error.message);
  }
} 