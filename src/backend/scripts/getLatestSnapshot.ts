/**
 * Script to query the latest staking snapshots
 */
import { config as dotenvConfig } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { query } from '../db/index.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');

// Load environment variables from .env.local
console.log('Loading environment variables from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

async function getLatestSnapshots() {
  try {
    console.log('Querying the latest staking snapshots...');

    // Get the latest snapshots
    const snapshots = await query(`
      SELECT 
        id, 
        contract_address, 
        timestamp, 
        total_staked, 
        total_locked, 
        total_unlocked 
      FROM 
        staking_snapshots 
      ORDER BY 
        id DESC 
      LIMIT 5
    `);

    if (snapshots.rows.length === 0) {
      console.log('No snapshots found in the database.');
      return;
    }

    // Display the snapshots
    console.log('Latest snapshots:');
    console.table(snapshots.rows);

    // Get details for the latest snapshot
    const latestSnapshotId = snapshots.rows[0].id;

    // Count wallets in the latest snapshot
    const walletCount = await query(
      `
      SELECT 
        COUNT(DISTINCT wallet_address) as wallet_count
      FROM 
        staking_wallet_data
      WHERE 
        snapshot_id = $1
    `,
      [latestSnapshotId]
    );

    console.log(`Wallet count in latest snapshot: ${walletCount.rows[0].wallet_count}`);

    // Get top 5 wallets by total_staked
    const topWallets = await query(
      `
      SELECT 
        wallet_address, 
        total_staked, 
        total_locked, 
        total_unlocked
      FROM 
        staking_wallet_data
      WHERE 
        snapshot_id = $1
      ORDER BY 
        total_staked DESC
      LIMIT 5
    `,
      [latestSnapshotId]
    );

    console.log('Top 5 wallets:');
    console.table(topWallets.rows);
  } catch (error) {
    console.error('Error fetching snapshots:', error);
  }
}

// Run the function
getLatestSnapshots();
