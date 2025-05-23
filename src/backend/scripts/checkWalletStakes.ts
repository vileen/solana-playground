/**
 * Script to check stake details for a specific wallet
 * This is useful for verifying that a wallet has the correct stakes and unlock dates
 */
import { config as dotenvConfig } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { loadStakingSnapshot } from '../services/stakingService.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');

// Load environment variables from .env.local
console.log('Loading environment variables from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

// Default wallet address to check
const DEFAULT_WALLET = 'F5Vw7k9rwy9QFtbjJdvnyJiA6Hs3bfxszeuYMDQXHQtd';

/**
 * Check the staking details for a specific wallet
 */
async function checkWalletStakes(walletAddress: string) {
  try {
    console.log(`Checking stake details for wallet: ${walletAddress}`);

    // Load the latest staking snapshot
    console.log('Loading latest staking snapshot...');
    const snapshot = await loadStakingSnapshot();

    if (!snapshot) {
      console.error('No staking snapshot found');
      return;
    }

    console.log(
      `Found snapshot with ID: ${snapshot.id} from ${new Date(snapshot.timestamp).toLocaleString()}`
    );

    // Find the wallet in the snapshot
    const walletData = snapshot.stakingData.find(data => data.walletAddress === walletAddress);

    if (!walletData) {
      console.log(`Wallet ${walletAddress} not found in snapshot`);
      return;
    }

    // Display wallet summary
    console.log('\n=== WALLET STAKING SUMMARY ===');
    console.log(`Wallet Address: ${walletData.walletAddress}`);
    console.log(`Total Staked: ${walletData.totalStaked.toLocaleString()} tokens`);
    console.log(`Total Locked: ${walletData.totalLocked.toLocaleString()} tokens`);
    console.log(`Total Unlocked: ${walletData.totalUnlocked.toLocaleString()} tokens`);
    console.log(`Number of Stakes: ${walletData.stakes.length}`);

    // Display individual stakes
    console.log('\n=== INDIVIDUAL STAKES ===');
    console.log('Amount\t\tStake Date\t\tUnlock Date\t\tStatus');
    console.log('------\t\t----------\t\t-----------\t\t------');

    // Sort stakes by unlock date (ascending)
    const sortedStakes = [...walletData.stakes].sort(
      (a, b) => new Date(a.unlockDate).getTime() - new Date(b.unlockDate).getTime()
    );

    for (const stake of sortedStakes) {
      const stakeDate = new Date(stake.stakeDate);
      const unlockDate = new Date(stake.unlockDate);
      const now = new Date();

      // Calculate days until unlock
      const daysUntilUnlock = Math.ceil(
        (unlockDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      console.log(
        `${stake.amount.toLocaleString()}\t\t` +
          `${stakeDate.toLocaleDateString()}\t\t` +
          `${unlockDate.toLocaleDateString()}\t\t` +
          `${stake.isLocked ? 'LOCKED' : 'UNLOCKED'} ${daysUntilUnlock > 0 ? `(${daysUntilUnlock} days)` : ''}`
      );
    }

    // Calculate unlock schedule
    console.log('\n=== UNLOCK SCHEDULE ===');

    // Group stakes by unlock date
    const unlockSchedule = new Map<string, number>();
    for (const stake of walletData.stakes) {
      const unlockDate = new Date(stake.unlockDate).toLocaleDateString();
      unlockSchedule.set(unlockDate, (unlockSchedule.get(unlockDate) || 0) + stake.amount);
    }

    // Sort by unlock date
    const sortedSchedule = Array.from(unlockSchedule.entries()).sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
    );

    console.log('Date\t\tAmount\t\tPercentage');
    console.log('----\t\t------\t\t----------');

    for (const [date, amount] of sortedSchedule) {
      const percentage = ((amount / walletData.totalStaked) * 100).toFixed(2);
      console.log(`${date}\t\t${amount.toLocaleString()}\t\t${percentage}%`);
    }
  } catch (error) {
    console.error('Error checking wallet stakes:', error);
  }
}

// Get wallet address from command line arguments or use default
const walletAddress = process.argv[2] || DEFAULT_WALLET;

// Run the script
checkWalletStakes(walletAddress)
  .then(() => {
    console.log('\nCheck completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
