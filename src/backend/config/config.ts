import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables with preference for .env.local
const rootDir = process.cwd();
const envLocalPath = join(rootDir, '.env.local');
const envPath = join(rootDir, '.env');

// First try .env.local, then fall back to .env
if (existsSync(envLocalPath)) {
  console.log('Loading environment from .env.local');
  dotenv.config({ path: envLocalPath });
} else {
  console.log('Loading environment from .env');
  dotenv.config({ path: envPath });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Token address to track
export const TOKEN_ADDRESS = '31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk';

// Collection addresses
export const COLLECTION_ADDRESSES = [
  'HJx4HRAT3RiFq7cy9fSrvP92usAmJ7bJgPccQTyroT2r',
  'EN4u2jn6YHfhbDWvpF5nNcDwn3qdCZQTLJTURbZs6kWw', // base58 c68d8890fb88bd37e0ed9fcd03e60bee08c140394fb8f8f35825ad2876486b3c
];

// Initialize RPC connection
export const RPC_URL = process.env.SOLANA_RPC_URL;
console.log('Using RPC URL:', RPC_URL?.replace(/\/.*@/, '/***@')); // Hide sensitive parts of URL for logging

if (!RPC_URL) {
  throw new Error('SOLANA_RPC_URL environment variable is required');
}

// Check for API key
export const API_KEY = process.env.SOLANA_API_KEY;
if (!API_KEY) {
  console.warn('Warning: SOLANA_API_KEY environment variable is not set. RPC calls will fail.');
} else {
  console.log('API key is set');
}

// Debug environment variables
console.log(
  'Available environment variables:',
  Object.keys(process.env)
    .filter(key => key.includes('SOLANA') || key.includes('NODE_ENV') || key.includes('PORT'))
    .join(', ')
);

// Construct RPC URL with API key if not already included
export let FULL_RPC_URL = RPC_URL;
if (API_KEY && !RPC_URL.includes('api-key=') && !RPC_URL.includes('@')) {
  // Append API key as query parameter if not already in URL
  FULL_RPC_URL = RPC_URL.includes('?')
    ? `${RPC_URL}&api-key=${API_KEY}`
    : `${RPC_URL}?api-key=${API_KEY}`;
  console.log('Added API key to RPC URL');
}

// Create a data directory in the project root
const DATA_DIR = join(rootDir, 'data');
console.log(`Using data directory: ${DATA_DIR}`);

// Create the directory if it doesn't exist
try {
  if (!existsSync(DATA_DIR)) {
    mkdir(DATA_DIR, { recursive: true });
    console.log(`Created data directory: ${DATA_DIR}`);
  } else {
    console.log(`Using existing data directory: ${DATA_DIR}`);
  }
} catch (error: any) {
  console.error(`Error creating data directory: ${error.message}`);
}

export { DATA_DIR };

// Path for social profiles storage
export const SOCIAL_PROFILES_FILE = join(DATA_DIR, 'social_profiles.json');

// Server port
export const PORT = process.env.PORT || 3001;
