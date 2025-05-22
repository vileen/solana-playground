/**
 * Script to take an incremental staking snapshot
 */
import { config as dotenvConfig } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { createStakingSnapshot, loadStakingSnapshot } from '../services/stakingService.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');

// Load environment variables from .env.local
console.log('Loading environment from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

/**
 * Take an incremental staking snapshot
 */
async function takeIncrementalSnapshot() {
  try {
    // First, get the current latest snapshot
    console.log('Loading current latest snapshot...');
    const currentSnapshot = await loadStakingSnapshot();

    if (currentSnapshot) {
      console.log(`Current snapshot ID: ${currentSnapshot.id}`);
      console.log(`Current snapshot timestamp: ${currentSnapshot.timestamp}`);
      console.log(`Current snapshot total staked: ${currentSnapshot.totalStaked}`);
      console.log(`Current snapshot wallet count: ${currentSnapshot.stakingData.length}`);
      console.log(
        `Current snapshot is incremental: ${currentSnapshot.isIncremental ? 'Yes' : 'No'}`
      );
      console.log(`Current snapshot last signature: ${currentSnapshot.lastSignature || 'None'}`);
    } else {
      console.log('No current snapshot found, will create a new full snapshot');
    }

    // Take a new incremental snapshot
    console.log('\nCreating incremental snapshot...');
    const useIncremental = true;
    const snapshot = await createStakingSnapshot(useIncremental);

    console.log(`\nSuccessfully created staking snapshot with ID: ${snapshot.id}`);
    console.log(`Is incremental: ${snapshot.isIncremental ? 'Yes' : 'No'}`);
    console.log(`Last signature: ${snapshot.lastSignature || 'None'}`);
    console.log(`Total staked: ${snapshot.totalStaked}`);
    console.log(`Total locked: ${snapshot.totalLocked}`);
    console.log(`Total unlocked: ${snapshot.totalUnlocked}`);
    console.log(`Number of wallets: ${snapshot.stakingData.length}`);

    // Calculate changes from previous snapshot
    if (currentSnapshot) {
      const stakedDifference = snapshot.totalStaked - currentSnapshot.totalStaked;
      const walletDifference = snapshot.stakingData.length - currentSnapshot.stakingData.length;

      console.log(`\nChanges since last snapshot:`);
      console.log(
        `Staked tokens change: ${stakedDifference > 0 ? '+' : ''}${stakedDifference.toFixed(2)}`
      );
      console.log(`Wallet count change: ${walletDifference > 0 ? '+' : ''}${walletDifference}`);
    }

    return snapshot;
  } catch (error) {
    console.error('Error taking incremental snapshot:', error);
    throw error;
  }
}

// Run the script
takeIncrementalSnapshot()
  .then(() => {
    console.log('Incremental snapshot completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
