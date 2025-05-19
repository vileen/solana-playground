import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { Pool } from 'pg';

import { SOCIAL_PROFILES_FILE } from '../../config/config.js';

// Load environment variables
dotenvConfig();

// Interface definitions
interface SocialData {
  twitter?: string | null;
  discord?: string | null;
  comment?: string | null;
  id?: string;
  wallets?: Array<{ address: string }>;
  updatedAt?: string;
}

interface ProfileStore {
  byWallet: Record<string, { socialId: string }>;
  profiles: Record<string, SocialData>;
}

// Create a new pool specifically for the migration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

async function main() {
  console.log('Starting migration to PostgreSQL database...');
  
  try {
    // Check database connection
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    
    // Start a transaction for all migration operations
    await client.query('BEGIN');
    
    try {
      // Verify tables exist
      await client.query(`
        SELECT to_regclass('social_profiles') as profiles,
               to_regclass('wallet_addresses') as wallets
      `);
      
      console.log('Verified database tables exist');
      
      // Migrate social profiles
      if (existsSync(SOCIAL_PROFILES_FILE)) {
        console.log(`Migrating social profiles from ${SOCIAL_PROFILES_FILE}`);
        const content = await readFile(SOCIAL_PROFILES_FILE, 'utf-8');
        const data = JSON.parse(content);
        
        if (data.byWallet && data.profiles) {
          // New format with byWallet and profiles
          console.log(`Found ${Object.keys(data.profiles).length} profiles and ${Object.keys(data.byWallet).length} wallet mappings`);
          
          // Migrate profiles first
          for (const [socialId, profile] of Object.entries(data.profiles)) {
            await client.query(
              `INSERT INTO social_profiles (id, twitter, discord, comment, updated_at)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (id) DO UPDATE 
               SET twitter = $2, discord = $3, comment = $4, updated_at = $5`,
              [
                socialId, 
                profile.twitter || null, 
                profile.discord || null, 
                profile.comment || null,
                profile.updatedAt ? new Date(profile.updatedAt) : new Date()
              ]
            );
          }
          
          console.log('Social profiles migrated successfully');
          
          // Then migrate wallet mappings
          for (const [address, data] of Object.entries(data.byWallet)) {
            try {
              await client.query(
                `INSERT INTO wallet_addresses (address, social_id)
                 VALUES ($1, $2)
                 ON CONFLICT (address) DO UPDATE
                 SET social_id = $2`,
                [address, data.socialId]
              );
            } catch (err) {
              console.error(`Error migrating wallet mapping for ${address}:`, err);
            }
          }
          
          console.log('Wallet mappings migrated successfully');
        } else {
          // Old format - direct wallet-to-profile mapping
          console.log(`Found ${Object.keys(data).length} wallet-to-profile mappings in old format`);
          
          // Convert old format to new format
          for (const [address, profileData] of Object.entries(data)) {
            try {
              // Check if profile already exists
              const profile = profileData as any;
              let socialId = profile.id;
              
              if (!socialId) {
                socialId = `social_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
              }
              
              // Insert the profile
              await client.query(
                `INSERT INTO social_profiles (id, twitter, discord, comment)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (id) DO UPDATE 
                 SET twitter = $2, discord = $3, comment = $4`,
                [socialId, profile.twitter || null, profile.discord || null, profile.comment || null]
              );
              
              // Insert the wallet mapping
              await client.query(
                `INSERT INTO wallet_addresses (address, social_id)
                 VALUES ($1, $2)
                 ON CONFLICT (address) DO UPDATE
                 SET social_id = $2`,
                [address, socialId]
              );
            } catch (err) {
              console.error(`Error migrating profile for wallet ${address}:`, err);
            }
          }
          
          console.log('Legacy wallet-to-profile mappings migrated successfully');
        }
      } else {
        console.log(`Social profiles file not found at ${SOCIAL_PROFILES_FILE}`);
      }
      
      // TODO: Add migration for NFT snapshots here
      
      // TODO: Add migration for token snapshots here
      
      // Commit the transaction
      await client.query('COMMIT');
      console.log('Migration completed successfully!');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Migration failed, transaction rolled back:', error);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error connecting to database:', error);
  } finally {
    await pool.end();
  }
}

// Run the migration
main().catch(err => {
  console.error('Unhandled error during migration:', err);
  process.exit(1);
}); 