import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

// Get the root directory
const rootDir = process.cwd();

// Define environment file paths
const envLocalPath = join(rootDir, '.env.local');
const envPath = join(rootDir, '.env');

// Load environment variables with preference for .env.local (development)
// This ensures consistent environment loading across all services
export function loadEnvironmentVariables() {
  if (existsSync(envLocalPath)) {
    console.log('[Environment] Loading environment from .env.local');
    dotenv.config({ path: envLocalPath });
  } else if (existsSync(envPath)) {
    console.log('[Environment] Loading environment from .env');
    dotenv.config({ path: envPath });
  } else {
    console.log('[Environment] No .env file found, using process environment');
  }
}

// Load environment variables immediately when this module is imported
loadEnvironmentVariables();

// Construct RPC URL with API key if available
const getRpcUrlWithApiKey = () => {
  const rpcUrl = process.env.FULL_RPC_URL || process.env.SOLANA_RPC_URL;
  const apiKey = process.env.SOLANA_API_KEY;

  if (!rpcUrl) return undefined;

  // If API key exists and URL doesn't already contain it
  if (apiKey && !rpcUrl.includes('api-key=') && !rpcUrl.includes('@')) {
    // Append API key as query parameter if not already in URL
    return rpcUrl.includes('?') ? `${rpcUrl}&api-key=${apiKey}` : `${rpcUrl}?api-key=${apiKey}`;
  }

  return rpcUrl;
};

// Export commonly used environment variables with proper typing
export const ENV = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL,

  // RPC - handle both variable names and include API key
  FULL_RPC_URL: getRpcUrlWithApiKey(),
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL,
  SOLANA_API_KEY: process.env.SOLANA_API_KEY,

  // BitQuery API
  BITQUERY_API_KEY: process.env.BITQUERY_API_KEY,
  BITQUERY_TOKEN: process.env.BITQUERY_TOKEN,

  // Development flags
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '3000',
} as const;

// Helper to check if we're in development
export const isDevelopment = ENV.NODE_ENV === 'development';
export const isProduction = ENV.NODE_ENV === 'production';

// Log environment status
console.log(`[Environment] Running in ${ENV.NODE_ENV} mode`);
console.log(`[Environment] RPC URL: ${ENV.FULL_RPC_URL ? '✅ Found' : '❌ Not found'}`);
if (ENV.FULL_RPC_URL && ENV.SOLANA_API_KEY) {
  const hasApiKey = ENV.FULL_RPC_URL.includes('api-key=');
  console.log(`[Environment] RPC API Key: ${hasApiKey ? '✅ Included' : '❌ Not included'}`);
} else if (!ENV.SOLANA_API_KEY) {
  console.log(`[Environment] RPC API Key: ❌ Not found in environment`);
}

// Debug BitQuery credentials
console.log(
  `[Environment] BitQuery API Key: ${ENV.BITQUERY_API_KEY ? '✅ Found' : '❌ Not found'}`
);
console.log(`[Environment] BitQuery Token: ${ENV.BITQUERY_TOKEN ? '✅ Found' : '❌ Not found'}`);

if (ENV.BITQUERY_API_KEY && ENV.BITQUERY_TOKEN) {
  console.log('[Environment] ✅ BitQuery API credentials loaded');
} else {
  console.log('[Environment] ⚠️  BitQuery API credentials not found');
  console.log('[Environment] Make sure to set BITQUERY_API_KEY and BITQUERY_TOKEN in .env.local');
}
