/**
 * Script to create a new staking snapshot
 */
import { config as dotenvConfig } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Import the staking service
import { createStakingSnapshot } from '../services/stakingService.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');

// Load environment variables from .env.local
console.log('Loading environment variables from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

async function takeSnapshot() {
  try {
    console.log('Creating new staking snapshot...');
    const snapshot = await createStakingSnapshot();
    console.log(`Successfully created staking snapshot with ID: ${snapshot.id}`);
    console.log(`Total staked: ${snapshot.totalStaked}`);
    console.log(`Total locked: ${snapshot.totalLocked}`);
    console.log(`Total unlocked: ${snapshot.totalUnlocked}`);
    console.log(`Number of wallets: ${snapshot.stakingData.length}`);
  } catch (error) {
    console.error('Error creating staking snapshot:', error);
  }
}

// Run the snapshot creation
takeSnapshot();
