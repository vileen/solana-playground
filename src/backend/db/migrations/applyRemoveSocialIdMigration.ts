import { config as dotenvConfig } from 'dotenv';
import fs from 'fs';
import { dirname, join } from 'path';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../../');

// Load environment variables from .env.local
console.log('Loading environment variables from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

// Force SSL for Render.com's PostgreSQL which requires it
const sslConfig = { rejectUnauthorized: false };

// Create a new pool for the migration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig // Always use SSL with rejectUnauthorized: false
});

// Debug: Log connection details (hiding sensitive parts)
console.log('Database connection string:', process.env.DATABASE_URL?.replace(/\/\/.*:.*@/, '//***:***@'));

async function applyMigration() {
  console.log('Starting migration to remove social_id columns...');
  
  let client;
  try {
    // Get a client from the pool
    client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    
    // Read the migration file
    const migrationPath = join(__dirname, 'remove_social_id_from_events.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Applying migration from:', migrationPath);
    
    // Execute the migration script
    await client.query(migrationSql);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Run the migration
applyMigration().catch(err => {
  console.error('Unhandled error during migration:', err);
  process.exit(1);
}); 