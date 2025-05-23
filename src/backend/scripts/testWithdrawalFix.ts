import { config as dotenvConfig } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Import the staking service functions
import { fetchStakingData } from '../services/stakingService.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');

// Load environment variables
dotenvConfig({ path: join(rootDir, '.env.local') });

// Target wallet and transaction
const TARGET_WALLET = 'F5Vw7k9rwy9QFtbjJdvnyJiA6Hs3bfxszeuYMDQXHQtd';
const TARGET_TRANSACTION =
  'pJo4MFP99wiVQUqoEMHRpeQHR9ui9oNDGYFx7j2b5eHkGmBvum9L8VH3LNnGEnqmP853Bb4MMwturw8umamZj8c';

// Get RPC URL with API key
const RPC_URL = process.env.SOLANA_RPC_URL;
const API_KEY = process.env.SOLANA_API_KEY;

let FULL_RPC_URL = RPC_URL;
if (API_KEY && RPC_URL && !RPC_URL.includes('api-key=') && !RPC_URL.includes('@')) {
  FULL_RPC_URL = RPC_URL.includes('?')
    ? `${RPC_URL}&api-key=${API_KEY}`
    : `${RPC_URL}?api-key=${API_KEY}`;
}

async function testWithdrawalFix() {
  console.log('=== Testing Withdrawal Processing Fix ===\n');
  console.log(`Target wallet: ${TARGET_WALLET}`);
  console.log(`Target transaction: ${TARGET_TRANSACTION}`);
  console.log('Looking for improved debugging logs...\n');

  try {
    // Run the staking data fetch to test the improved withdrawal processing
    const result = await fetchStakingData();

    console.log('\n=== RESULTS ===');
    console.log(`Total wallets found: ${result.stakingData.length}`);

    // Find our target wallet
    const targetWalletData = result.stakingData.find(w => w.walletAddress === TARGET_WALLET);

    if (targetWalletData) {
      console.log(`\n✓ Found target wallet ${TARGET_WALLET}`);
      console.log(`Total staked: ${targetWalletData.totalStaked}`);
      console.log(`Total locked: ${targetWalletData.totalLocked}`);
      console.log(`Total unlocked: ${targetWalletData.totalUnlocked}`);
      console.log(`Number of stakes: ${targetWalletData.stakes.length}`);

      console.log('\nIndividual stakes:');
      targetWalletData.stakes.forEach((stake, i) => {
        console.log(
          `${i + 1}. ${stake.amount} tokens - ${stake.isLocked ? 'LOCKED' : 'UNLOCKED'} (unlocks ${stake.unlockDate})`
        );
      });

      // Check if the 15,492 tokens are still showing as unlocked
      if (targetWalletData.totalUnlocked >= 15492) {
        console.log('\n❌ ISSUE STILL EXISTS: 15,492 tokens showing as unlocked');
        console.log('   These tokens were already withdrawn and should not appear');
      } else {
        console.log('\n✅ ISSUE FIXED: Withdrawal properly processed');
      }

      // Expected correct values after the fix
      console.log('\n=== EXPECTED CORRECT VALUES ===');
      console.log('Total staked: 63,117 tokens');
      console.log('Total locked: 63,117 tokens (all locked)');
      console.log('Total unlocked: 0 tokens');
      console.log('Breakdown:');
      console.log('- 42,491 tokens unlocking after 20 days');
      console.log('- 3,461 tokens unlocking after 40 days');
      console.log('- 17,164 tokens unlocking after 47 days');
      console.log('- 1 token unlocking after 81 days');
    } else {
      console.log(`\n✗ Target wallet ${TARGET_WALLET} NOT found in results`);
    }
  } catch (error) {
    console.error('Error testing withdrawal fix:', error);
  }
}

// Run test
testWithdrawalFix();
