import { config as dotenvConfig } from 'dotenv';
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
  console.log('Starting migration...');
  
  let client;
  try {
    // Get a client from the pool
    client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    
    // Add social_id column to token_events table if it doesn't exist
    console.log('Adding social_id column to token_events table...');
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name='token_events' AND column_name='social_id'
        ) THEN 
          ALTER TABLE token_events ADD COLUMN social_id VARCHAR(50);
          ALTER TABLE token_events 
            ADD CONSTRAINT fk_token_events_social_profile 
            FOREIGN KEY (social_id) REFERENCES social_profiles(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    
    // Add social_id column to nft_events table if it doesn't exist
    console.log('Adding social_id column to nft_events table...');
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name='nft_events' AND column_name='social_id'
        ) THEN 
          ALTER TABLE nft_events ADD COLUMN social_id VARCHAR(50);
          ALTER TABLE nft_events 
            ADD CONSTRAINT fk_nft_events_social_profile 
            FOREIGN KEY (social_id) REFERENCES social_profiles(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    
    // Create indexes for the new columns
    console.log('Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_token_events_social_id ON token_events(social_id);
      CREATE INDEX IF NOT EXISTS idx_nft_events_social_id ON nft_events(social_id);
    `);
    
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