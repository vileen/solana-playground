import { config as dotenvConfig } from 'dotenv';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../..');

// Load environment variables from .env.local
console.log('Loading environment variables from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

// Create a new pool just for migration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : { rejectUnauthorized: false }, // Allow SSL connections with self-signed certificates
});

// Debug: Log connection details
console.log(
  'Database connection string:',
  process.env.DATABASE_URL?.replace(/\/\/.*:.*@/, '//***:***@')
); // Hide credentials

async function applyMigration() {
  console.log('Starting incremental snapshot migration...');

  let client;
  try {
    // Get a client from the pool
    client = await pool.connect();
    console.log('Connected to PostgreSQL database');

    // Read and execute the migration SQL file
    const migrationPath = join(__dirname, 'incrementalSnapshotMigration.sql');
    console.log(`Reading migration file from ${migrationPath}`);
    const migrationSql = await readFile(migrationPath, 'utf-8');

    console.log('Executing migration SQL...');
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
