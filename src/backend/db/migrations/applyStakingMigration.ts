import { config as dotenvConfig } from 'dotenv';
import { readFile } from 'fs/promises';
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

// Always use SSL for this Render.com PostgreSQL database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Debug: Log connection details (hiding sensitive parts)
console.log(
  'Database connection string:',
  process.env.DATABASE_URL?.replace(/\/\/.*:.*@/, '//***:***@')
);

async function applyStakingMigration() {
  console.log('Starting staking tables migration...');

  let client;
  try {
    // Get a client from the pool
    client = await pool.connect();
    console.log('Connected to PostgreSQL database');

    // Read and execute the staking tables SQL file
    const migrationPath = join(__dirname, 'staking_tables.sql');
    console.log(`Reading migration file from ${migrationPath}`);
    const migrationSql = await readFile(migrationPath, 'utf-8');

    console.log('Executing staking tables migration SQL...');
    await client.query(migrationSql);

    console.log('Staking tables migration completed successfully!');
  } catch (error) {
    console.error('Error applying staking tables migration:', error);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Run the migration
applyStakingMigration().catch(err => {
  console.error('Unhandled error during staking tables migration:', err);
  process.exit(1);
});
