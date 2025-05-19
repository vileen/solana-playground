import { existsSync, readdirSync, readFileSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { config as dotenvConfig } from 'dotenv';
import { Pool } from 'pg';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../..');
const dataDir = join(rootDir, 'data');

// Load environment variables from .env.local
console.log('Loading environment variables from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

// File patterns and paths
const NFT_SNAPSHOT_PATTERN = /^snapshot_\d+\.json$/;
const TOKEN_SNAPSHOT_PATTERN = /^token_snapshot_\d+\.json$/;
const SOCIAL_PROFILES_FILE = join(dataDir, 'social_profiles.json');

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

/**
 * Migrate social profiles from file to database
 */
async function migrateSocialProfiles(): Promise<boolean> {
  try {
    if (!existsSync(SOCIAL_PROFILES_FILE)) {
      console.log('Social profiles file not found, skipping migration.');
      return true;
    }

    console.log(`Found social profiles file at ${SOCIAL_PROFILES_FILE}`);
    const data = readFileSync(SOCIAL_PROFILES_FILE, 'utf-8');
    const jsonData = JSON.parse(data);

    if (!jsonData || typeof jsonData !== 'object') {
      console.log('Invalid social profiles data, skipping migration.');
      return true;
    }

    // Check if we're using the new format with byWallet and profiles
    if (jsonData.byWallet && jsonData.profiles) {
      console.log('Found social profiles in new format with byWallet and profiles structure.');
      const byWallet = jsonData.byWallet;
      const profiles = jsonData.profiles;
      
      // Count the profiles for verification
      const profileCount = Object.keys(profiles).length;
      const walletCount = Object.keys(byWallet).length;
      console.log(`Found ${profileCount} social profiles and ${walletCount} wallet addresses to migrate.`);

      // Begin transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        let profilesAdded = 0;
        let walletsAdded = 0;

        // First, insert all profiles
        for (const [socialId, profileData] of Object.entries(profiles)) {
          if (!profileData) continue;

          // Insert profile
          const { twitter, discord, comment, updatedAt } = profileData as any;
          const profileResult = await client.query(
            `INSERT INTO social_profiles (id, twitter, discord, comment, updated_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO UPDATE SET
               twitter = EXCLUDED.twitter,
               discord = EXCLUDED.discord,
               comment = EXCLUDED.comment,
               updated_at = EXCLUDED.updated_at
             RETURNING id`,
            [socialId, twitter, discord, comment, updatedAt || new Date().toISOString()]
          );

          if (profileResult.rowCount && profileResult.rowCount > 0) {
            profilesAdded++;
          }
        }

        // Then, insert all wallet connections
        for (const [address, walletData] of Object.entries(byWallet)) {
          if (!walletData || !(walletData as { socialId?: string }).socialId) continue;

          // Add wallet address
          const walletResult = await client.query(
            `INSERT INTO wallet_addresses (address, social_id)
             VALUES ($1, $2)
             ON CONFLICT (address) DO UPDATE SET
               social_id = EXCLUDED.social_id
             RETURNING address`,
            [address, (walletData as { socialId: string }).socialId]
          );

          if (walletResult.rowCount && walletResult.rowCount > 0) {
            walletsAdded++;
          }
        }

        await client.query('COMMIT');

        console.log(`Successfully migrated ${profilesAdded}/${profileCount} social profiles and ${walletsAdded}/${walletCount} wallet addresses.`);
        
        // Verify migration
        if (profilesAdded >= profileCount && walletsAdded >= walletCount) {
          console.log('Social profiles migration verified. Deleting file...');
          unlinkSync(SOCIAL_PROFILES_FILE);
          console.log('Social profiles file deleted.');
          return true;
        } else {
          console.warn(`Migration verification failed: Only ${profilesAdded}/${profileCount} profiles and ${walletsAdded}/${walletCount} wallet addresses were migrated.`);
          return false;
        }
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error migrating social profiles:', error);
        return false;
      } finally {
        client.release();
      }
    } else {
      // Old format (direct wallet-to-profile mapping)
      const profiles = jsonData;

      // Count the profiles for verification
      const profileCount = Object.keys(profiles).length;
      console.log(`Found ${profileCount} social profiles to migrate (old format).`);

      // Begin transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        let profilesAdded = 0;
        let walletsAdded = 0;

        // Process each profile
        for (const [address, profileData] of Object.entries(profiles)) {
          if (!profileData) continue;

          // Insert profile
          const { id, twitter, discord, comment } = profileData as any;
          const profileResult = await client.query(
            `INSERT INTO social_profiles (id, twitter, discord, comment, updated_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET
               twitter = EXCLUDED.twitter,
               discord = EXCLUDED.discord,
               comment = EXCLUDED.comment,
               updated_at = CURRENT_TIMESTAMP
             RETURNING id`,
            [id || `profile_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`, twitter, discord, comment]
          );

          if (profileResult.rowCount && profileResult.rowCount > 0) {
            profilesAdded++;
            const profileId = profileResult.rows[0].id;

            // Add wallet address
            const walletResult = await client.query(
              `INSERT INTO wallet_addresses (address, social_id)
               VALUES ($1, $2)
               ON CONFLICT (address) DO UPDATE SET
                 social_id = EXCLUDED.social_id
               RETURNING address`,
              [address, profileId]
            );

            if (walletResult.rowCount && walletResult.rowCount > 0) {
              walletsAdded++;
            }
          }
        }

        await client.query('COMMIT');

        console.log(`Successfully migrated ${profilesAdded} social profiles and ${walletsAdded} wallet addresses.`);
        
        // Verify migration
        if (profilesAdded >= profileCount) {
          console.log('Social profiles migration verified. Deleting file...');
          unlinkSync(SOCIAL_PROFILES_FILE);
          console.log('Social profiles file deleted.');
          return true;
        } else {
          console.warn(`Migration verification failed: Only ${profilesAdded}/${profileCount} profiles were migrated.`);
          return false;
        }
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error migrating social profiles:', error);
        return false;
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.error('Error in social profiles migration:', error);
    return false;
  }
}

/**
 * Migrate the latest NFT snapshot to database
 */
async function migrateLatestNftSnapshot(): Promise<boolean> {
  try {
    // Find latest NFT snapshot file
    const files = readdirSync(dataDir);
    const snapshotFiles = files.filter(f => NFT_SNAPSHOT_PATTERN.test(f));

    if (snapshotFiles.length === 0) {
      console.log('No NFT snapshot files found, skipping migration.');
      return true;
    }

    // Sort by timestamp (newest first)
    snapshotFiles.sort().reverse();
    const latestFile = snapshotFiles[0];
    if (!latestFile) {
      console.log('Error getting latest NFT snapshot filename');
      return false;
    }
    const filePath = join(dataDir, latestFile);

    console.log(`Found latest NFT snapshot file: ${latestFile}`);
    const data = readFileSync(filePath, 'utf-8');
    const snapshot = JSON.parse(data);

    if (!snapshot || !snapshot.holders || !Array.isArray(snapshot.holders)) {
      console.log('Invalid NFT snapshot data, skipping migration.');
      return true;
    }

    const holderCount = snapshot.holders.length;
    console.log(`Found ${holderCount} NFT holders to migrate.`);

    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create snapshot
      const snapshotResult = await client.query(
        `INSERT INTO nft_snapshots (timestamp, total_count)
         VALUES ($1, $2)
         RETURNING id`,
        [new Date(snapshot.timestamp), snapshot.total || holderCount]
      );

      if (snapshotResult.rowCount === 0) {
        throw new Error('Failed to create NFT snapshot record');
      }

      const snapshotId = snapshotResult.rows[0].id;
      let holdersAdded = 0;
      let nftsAdded = 0;
      let ownershipsAdded = 0;

      // Add NFT holders
      for (const holder of snapshot.holders) {
        if (!holder.address) continue;

        // Add holder
        const holderResult = await client.query(
          `INSERT INTO nft_holders (snapshot_id, address, nft_count, gen1_count, infant_count)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (snapshot_id, address) DO UPDATE SET
             nft_count = EXCLUDED.nft_count,
             gen1_count = EXCLUDED.gen1_count,
             infant_count = EXCLUDED.infant_count
           RETURNING address`,
          [
            snapshotId,
            holder.address,
            holder.count || 0,
            holder.gen1Count || 0,
            holder.infantCount || 0
          ]
        );

        if (holderResult.rowCount && holderResult.rowCount > 0) {
          holdersAdded++;
        }

        // Add NFTs and ownership if available
        if (holder.nfts && Array.isArray(holder.nfts)) {
          for (const nft of holder.nfts) {
            if (!nft.mint) continue;

            // Add NFT if it doesn't exist
            const nftResult = await client.query(
              `INSERT INTO nfts (mint, name, type)
               VALUES ($1, $2, $3)
               ON CONFLICT (mint) DO UPDATE SET
                 name = EXCLUDED.name,
                 type = EXCLUDED.type
               RETURNING mint`,
              [nft.mint, nft.name || 'Unknown', nft.type || 'Gen1']
            );

            if (nftResult.rowCount && nftResult.rowCount > 0) {
              nftsAdded++;
            }

            // Add ownership record
            const ownershipResult = await client.query(
              `INSERT INTO nft_ownership (snapshot_id, mint, owner_address)
               VALUES ($1, $2, $3)
               ON CONFLICT (snapshot_id, mint) DO UPDATE SET
                 owner_address = EXCLUDED.owner_address
               RETURNING mint`,
              [snapshotId, nft.mint, holder.address]
            );

            if (ownershipResult.rowCount && ownershipResult.rowCount > 0) {
              ownershipsAdded++;
            }
          }
        }
      }

      await client.query('COMMIT');

      console.log(`Successfully migrated NFT snapshot with ${holdersAdded} holders, ${nftsAdded} NFTs, and ${ownershipsAdded} ownership records.`);
      
      // Verify migration
      if (holdersAdded >= holderCount) {
        console.log('NFT snapshot migration verified. Deleting files...');
        // Delete all NFT snapshot files
        for (const file of snapshotFiles) {
          unlinkSync(join(dataDir, file));
          console.log(`Deleted NFT snapshot file: ${file}`);
        }
        return true;
      } else {
        console.warn(`Migration verification failed: Only ${holdersAdded}/${holderCount} NFT holders were migrated.`);
        return false;
      }
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error migrating NFT snapshot:', error);
      return false;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in NFT snapshot migration:', error);
    return false;
  }
}

/**
 * Migrate the latest token snapshot to database
 */
async function migrateLatestTokenSnapshot(): Promise<boolean> {
  try {
    // Find latest token snapshot file
    const files = readdirSync(dataDir);
    const snapshotFiles = files.filter(f => TOKEN_SNAPSHOT_PATTERN.test(f));

    if (snapshotFiles.length === 0) {
      console.log('No token snapshot files found, skipping migration.');
      return true;
    }

    // Sort by timestamp (newest first)
    snapshotFiles.sort().reverse();
    const latestFile = snapshotFiles[0];
    if (!latestFile) {
      console.log('Error getting latest token snapshot filename');
      return false;
    }
    const filePath = join(dataDir, latestFile);

    console.log(`Found latest token snapshot file: ${latestFile}`);
    const data = readFileSync(filePath, 'utf-8');
    const snapshot = JSON.parse(data);

    if (!snapshot || !snapshot.holders || !Array.isArray(snapshot.holders)) {
      console.log('Invalid token snapshot data, skipping migration.');
      return true;
    }

    const holderCount = snapshot.holders.length;
    console.log(`Found ${holderCount} token holders to migrate.`);

    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create snapshot
      const snapshotResult = await client.query(
        `INSERT INTO token_snapshots (timestamp, token_address, total_supply)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [new Date(snapshot.timestamp), snapshot.tokenAddress, snapshot.totalSupply]
      );

      if (snapshotResult.rowCount === 0) {
        throw new Error('Failed to create token snapshot record');
      }

      const snapshotId = snapshotResult.rows[0].id;
      let holdersAdded = 0;

      // Add token holders
      for (const holder of snapshot.holders) {
        if (!holder.address || holder.balance === undefined) continue;

        // Add holder
        const holderResult = await client.query(
          `INSERT INTO token_holders (snapshot_id, address, balance, is_lp_pool, is_treasury)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (snapshot_id, address) DO UPDATE SET
             balance = EXCLUDED.balance,
             is_lp_pool = EXCLUDED.is_lp_pool,
             is_treasury = EXCLUDED.is_treasury
           RETURNING address`,
          [
            snapshotId,
            holder.address,
            holder.balance,
            holder.isLpPool || false,
            holder.isTreasury || false
          ]
        );

        if (holderResult.rowCount && holderResult.rowCount > 0) {
          holdersAdded++;
        }
      }

      await client.query('COMMIT');

      console.log(`Successfully migrated token snapshot with ${holdersAdded} holders.`);
      
      // Verify migration
      if (holdersAdded >= holderCount) {
        console.log('Token snapshot migration verified. Deleting files...');
        // Delete all token snapshot files
        for (const file of snapshotFiles) {
          unlinkSync(join(dataDir, file));
          console.log(`Deleted token snapshot file: ${file}`);
        }
        return true;
      } else {
        console.warn(`Migration verification failed: Only ${holdersAdded}/${holderCount} token holders were migrated.`);
        return false;
      }
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error migrating token snapshot:', error);
      return false;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in token snapshot migration:', error);
    return false;
  }
}

/**
 * Run the migration process
 */
async function runMigration() {
  console.log('Starting file-to-database migration...');
  
  try {
    // First, check if we have the data directory
    if (!existsSync(dataDir)) {
      console.log(`Data directory not found at ${dataDir}, no migration needed.`);
      process.exit(0);
    }

    // Verify database connection
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL database.');
    client.release();

    // Run migrations
    const socialProfilesResult = await migrateSocialProfiles();
    const nftSnapshotResult = await migrateLatestNftSnapshot();
    const tokenSnapshotResult = await migrateLatestTokenSnapshot();

    if (socialProfilesResult && nftSnapshotResult && tokenSnapshotResult) {
      console.log('All migrations completed successfully!');
      process.exit(0);
    } else {
      console.warn('Migration completed with some issues. Check the logs for details.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed with error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration(); 