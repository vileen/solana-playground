import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Get base URL for GitHub Pages
const base = process.env.GITHUB_PAGES === 'true' ? '/solana-playground/' : '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 3005,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== 'production',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    }
  },
  // Environment variables that will be statically replaced during build
  define: {
    'process.env.VITE_PRODUCTION': JSON.stringify(process.env.NODE_ENV === 'production'),
    'process.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'http://localhost:3001/api')
  }
}); 