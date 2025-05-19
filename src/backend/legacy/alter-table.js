import { config } from 'dotenv';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Get directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
config({ path: path.join(__dirname, '.env.local') });

// Create pool with SSL config for Render.com
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function alterTable() {
  try {
    const client = await pool.connect();
    console.log('Connected to database');
    
    // Alter the table to increase field size
    await client.query('ALTER TABLE wallet_addresses ALTER COLUMN address TYPE VARCHAR(100);');
    console.log('Successfully altered wallet_addresses table');
    
    client.release();
    process.exit(0);
  } catch (err) {
    console.error('Error altering table:', err);
    process.exit(1);
  }
}

alterTable(); 