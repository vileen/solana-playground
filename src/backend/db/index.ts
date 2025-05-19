import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

// Load environment variables from .env.local
const rootDir = process.cwd();
const envLocalPath = join(rootDir, '.env.local');
const envPath = join(rootDir, '.env');

// First try .env.local, then fall back to .env
if (existsSync(envLocalPath)) {
  console.log('Loading environment from .env.local');
  dotenvConfig({ path: envLocalPath });
} else {
  console.log('Loading environment from .env');
  dotenvConfig({ path: envPath });
}

// Force SSL for Render.com's PostgreSQL which requires it
const sslConfig = { rejectUnauthorized: false };

// Create database pool configuration from environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig, // Always use SSL with rejectUnauthorized: false for Render.com
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection not established
});

// Debug: Log connection details (hiding sensitive parts)
console.log('Database connection string:', process.env.DATABASE_URL?.replace(/\/\/.*:.*@/, '//***:***@'));

// Verify we can connect to the database on startup
pool.connect()
  .then(client => {
    console.log('Successfully connected to PostgreSQL database');
    client.release();
  })
  .catch(err => {
    console.error('Error connecting to PostgreSQL database:', err);
  });

// Export simple query method
export const query = (text: string, params?: any[]) => pool.query(text, params);

// Export transaction helper
export const withTransaction = async (callback: (client: any) => Promise<any>) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// Export the pool for direct access
export default pool; 