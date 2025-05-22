/**
 * Script to directly query staking snapshots from the database
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

async function getDetailedSnapshots() {
  try {
    console.log('Querying snapshots directly from database...');

    // Get the latest snapshots with additional counts and sums
    const snapshots = await query(`
      SELECT 
        s.id, 
        s.contract_address, 
        s.timestamp, 
        s.total_staked, 
        s.total_locked, 
        s.total_unlocked,
        COUNT(DISTINCT w.wallet_address) as wallet_count,
        SUM(w.total_staked) as aggregated_staked,
        SUM(w.total_locked) as aggregated_locked,
        SUM(w.total_unlocked) as aggregated_unlocked
      FROM 
        staking_snapshots s
      LEFT JOIN 
        staking_wallet_data w ON s.id = w.snapshot_id
      GROUP BY 
        s.id, s.contract_address, s.timestamp, s.total_staked, s.total_locked, s.total_unlocked
      ORDER BY 
        s.id DESC
      LIMIT 5
    `);

    console.log('Latest snapshots with wallet counts:');
    console.table(snapshots.rows);

    // Get distribution of staked amounts for the latest snapshot
    const latestSnapshotId = snapshots.rows[0]?.id;

    if (latestSnapshotId) {
      // Get wallet distribution
      const distribution = await query(
        `
        SELECT 
          CASE 
            WHEN total_staked < 100 THEN '0-100'
            WHEN total_staked < 1000 THEN '100-1,000'
            WHEN total_staked < 10000 THEN '1,000-10,000'
            WHEN total_staked < 100000 THEN '10,000-100,000'
            ELSE '100,000+'
          END as stake_range,
          COUNT(*) as wallet_count,
          SUM(total_staked) as total_staked_in_range
        FROM 
          staking_wallet_data
        WHERE 
          snapshot_id = $1
        GROUP BY 
          stake_range
        ORDER BY 
          MIN(total_staked)
      `,
        [latestSnapshotId]
      );

      console.log(`\nWallet distribution for snapshot ID ${latestSnapshotId}:`);
      console.table(distribution.rows);

      // Get top 20 wallets by staked amount
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
        LIMIT 20
      `,
        [latestSnapshotId]
      );

      console.log(`\nTop 20 wallets by staked amount for snapshot ID ${latestSnapshotId}:`);
      console.table(topWallets.rows);
    }
  } catch (error) {
    console.error('Error querying snapshots:', error);
  }
}

// Run the function
getDetailedSnapshots();
