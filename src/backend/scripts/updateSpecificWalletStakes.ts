/**
 * Script to update specific wallet stakes with multiple unlock dates
 * This script fixes the issue with F5Vw7k9rwy9QFtbjJdvnyJiA6Hs3bfxszeuYMDQXHQtd wallet having multiple stakes
 * with different unlock dates
 */
import { config as dotenvConfig } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { withTransaction } from '../db/index.js';
import { loadStakingSnapshot } from '../services/stakingService.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');

// Load environment variables from .env.local
console.log('Loading environment variables from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

// The wallet address with multiple stakes
const TARGET_WALLET = 'F5Vw7k9rwy9QFtbjJdvnyJiA6Hs3bfxszeuYMDQXHQtd';
const TOKEN_MINT_ADDRESS = '31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk';

/**
 * Multiple stakes data for the wallet
 * These represent the correct stakes with their respective unlock dates
 */
const WALLET_STAKES = [
  {
    amount: 42491,
    stakeDaysAgo: 70, // 90 days total - 20 days remaining = staked 70 days ago
    unlockDaysFromNow: 20,
  },
  {
    amount: 3461,
    stakeDaysAgo: 50, // 90 days total - 40 days remaining = staked 50 days ago
    unlockDaysFromNow: 40,
  },
  {
    amount: 17164,
    stakeDaysAgo: 43, // 90 days total - 47 days remaining = staked 43 days ago
    unlockDaysFromNow: 47,
  },
  {
    amount: 1,
    stakeDaysAgo: 9, // 90 days total - 81 days remaining = staked 9 days ago
    unlockDaysFromNow: 81,
  },
];

/**
 * Update the specific wallet's stakes
 */
async function updateWalletStakes() {
  try {
    // First, load the latest snapshot to get its ID
    console.log(`Loading latest staking snapshot...`);
    const snapshot = await loadStakingSnapshot();

    if (!snapshot) {
      console.error('No staking snapshot found in database');
      return;
    }

    console.log(
      `Found snapshot with ID: ${snapshot.id} from ${new Date(snapshot.timestamp).toLocaleString()}`
    );

    // Find the wallet in the snapshot
    const walletData = snapshot.stakingData.find(data => data.walletAddress === TARGET_WALLET);

    if (!walletData) {
      console.error(`Wallet ${TARGET_WALLET} not found in snapshot`);
      return;
    }

    console.log(
      `Found wallet ${TARGET_WALLET} in snapshot with total staked: ${walletData.totalStaked}`
    );
    console.log(`Current stakes: ${JSON.stringify(walletData.stakes, null, 2)}`);

    // Calculate total from our new stakes
    const totalStaked = WALLET_STAKES.reduce((sum, stake) => sum + stake.amount, 0);
    console.log(`Total from new stakes configuration: ${totalStaked}`);

    // Verify total matches expected amount
    if (Math.abs(totalStaked - walletData.totalStaked) > 0.01) {
      console.error(
        `ERROR: Total from new stakes (${totalStaked}) doesn't match expected total (${walletData.totalStaked})`
      );
      return;
    }

    // Calculate total locked/unlocked based on current date
    const now = new Date();
    const newStakes = WALLET_STAKES.map(stake => {
      // Calculate stake date (X days ago)
      const stakeDate = new Date(now);
      stakeDate.setDate(stakeDate.getDate() - stake.stakeDaysAgo);

      // Calculate unlock date (X days from now)
      const unlockDate = new Date(now);
      unlockDate.setDate(unlockDate.getDate() + stake.unlockDaysFromNow);

      // Determine if stake is locked
      const isLocked = unlockDate > now;

      return {
        amount: stake.amount,
        stakeDate: stakeDate.toISOString(),
        unlockDate: unlockDate.toISOString(),
        isLocked,
        mintAddress: TOKEN_MINT_ADDRESS,
      };
    });

    // Calculate new locked/unlocked totals
    const totalLocked = newStakes
      .filter(stake => stake.isLocked)
      .reduce((sum, stake) => sum + stake.amount, 0);

    const totalUnlocked = newStakes
      .filter(stake => !stake.isLocked)
      .reduce((sum, stake) => sum + stake.amount, 0);

    console.log(`New locked total: ${totalLocked}`);
    console.log(`New unlocked total: ${totalUnlocked}`);

    // Update the database with transaction
    await withTransaction(async client => {
      console.log(`Updating database...`);

      // First update the wallet_data record
      await client.query(
        `UPDATE staking_wallet_data
         SET total_locked = $1, total_unlocked = $2
         WHERE snapshot_id = $3 AND wallet_address = $4`,
        [totalLocked, totalUnlocked, snapshot.id, TARGET_WALLET]
      );

      console.log(`Updated staking_wallet_data for wallet ${TARGET_WALLET}`);

      // Delete existing stakes
      await client.query(
        `DELETE FROM staking_stakes
         WHERE snapshot_id = $1 AND wallet_address = $2`,
        [snapshot.id, TARGET_WALLET]
      );

      console.log(`Deleted existing stakes for wallet ${TARGET_WALLET}`);

      // Insert new stakes
      for (const stake of newStakes) {
        await client.query(
          `INSERT INTO staking_stakes
           (snapshot_id, wallet_address, mint_address, amount, stake_date, unlock_date, is_locked)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            snapshot.id,
            TARGET_WALLET,
            stake.mintAddress,
            stake.amount,
            stake.stakeDate,
            stake.unlockDate,
            stake.isLocked,
          ]
        );
      }

      console.log(`Inserted ${newStakes.length} new stakes for wallet ${TARGET_WALLET}`);
    });

    console.log(`Successfully updated stakes for wallet ${TARGET_WALLET}`);
    console.log(`New stakes configuration:`);

    for (const stake of newStakes) {
      console.log(
        `- ${stake.amount} tokens: staked on ${new Date(stake.stakeDate).toLocaleDateString()}, unlocks on ${new Date(stake.unlockDate).toLocaleDateString()} (${stake.isLocked ? 'LOCKED' : 'UNLOCKED'})`
      );
    }
  } catch (error) {
    console.error('Error updating wallet stakes:', error);
  }
}

// Run the script
updateWalletStakes()
  .then(() => {
    console.log('Wallet stakes update completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
