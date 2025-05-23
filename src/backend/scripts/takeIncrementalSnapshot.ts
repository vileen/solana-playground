/**
 * Script to take an incremental staking snapshot
 * This builds on previous snapshots to minimize processing time
 */
import { config as dotenvConfig } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { createStakingSnapshot } from '../services/stakingService.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');

// Load environment variables from .env.local
console.log('Loading environment variables from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

async function main() {
  try {
    console.log('Starting incremental staking snapshot...');

    // Get command line arguments
    const args = process.argv.slice(2);
    const fullRefreshArg = args.find(arg => arg === '--full-refresh');
    const useIncremental = !fullRefreshArg;

    if (!useIncremental) {
      console.log(
        'WARNING: --full-refresh flag detected. Will perform a full staking snapshot instead of incremental!'
      );
    }

    // Set a longer timeout for larger snapshots (30 minutes)
    const timeout = setTimeout(
      () => {
        console.error('Snapshot timed out after 30 minutes');
        process.exit(1);
      },
      30 * 60 * 1000
    );

    // Take the snapshot
    const snapshot = await createStakingSnapshot(useIncremental);

    // Clear the timeout
    clearTimeout(timeout);

    console.log(`Successfully created staking snapshot with ID: ${snapshot.id}`);
    console.log(`Total staked: ${snapshot.totalStaked}`);
    console.log(`Total locked: ${snapshot.totalLocked}`);
    console.log(`Total unlocked: ${snapshot.totalUnlocked}`);
    console.log(`Number of wallets: ${snapshot.stakingData.length}`);
    console.log(`Is incremental: ${snapshot.isIncremental}`);
    console.log(`Last signature: ${snapshot.lastSignature || 'None'}`);

    // Exit gracefully
    process.exit(0);
  } catch (error) {
    console.error('Error taking incremental staking snapshot:', error);
    process.exit(1);
  }
}

main();
