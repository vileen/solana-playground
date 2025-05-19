import { config as dotenvConfig } from 'dotenv';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../..');

// Load environment variables from .env.local
console.log('Loading environment variables from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

// Create a new pool just for initialization
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

// Debug: Log connection details
console.log('Database connection string:', process.env.DATABASE_URL?.replace(/\/\/.*:.*@/, '//***:***@')); // Hide credentials

async function initializeDatabase() {
  console.log('Starting database initialization...');
  
  let client;
  try {
    // Get a client from the pool
    client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    
    // Read and execute the schema SQL file
    const schemaPath = join(__dirname, 'schema.sql');
    console.log(`Reading schema file from ${schemaPath}`);
    const schemaSql = await readFile(schemaPath, 'utf-8');
    
    console.log('Executing schema SQL...');
    await client.query(schemaSql);
    
    console.log('Database initialization completed successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Run the initialization
initializeDatabase().catch(err => {
  console.error('Unhandled error during database initialization:', err);
  process.exit(1);
}); 