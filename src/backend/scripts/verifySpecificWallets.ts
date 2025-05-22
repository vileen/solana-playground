/**
 * Script to verify specific wallet balances against expected values
 */
import { Connection, PublicKey } from '@solana/web3.js';
import { config as dotenvConfig } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { FULL_RPC_URL } from '../config/config.js';
import { createStakingSnapshot, loadStakingSnapshot } from '../services/stakingService.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');

// Load environment variables from .env.local
console.log('Loading environment variables from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

// Target wallets to verify
const WALLETS_TO_VERIFY = [
  {
    address: 'F5Vw7k9rwy9QFtbjJdvnyJiA6Hs3bfxszeuYMDQXHQtd',
    expectedAmount: 63117,
    description: 'Wallet with withdrawal exceeding deposits and synthetic deposits',
  },
  {
    address: 'BEzePHuzfY2njeA6839gVoXQuVd6YvCTGavWjA9KF8ky',
    expectedAmount: 50000,
    description: 'Wallet with single deposit and no withdrawals',
  },
  {
    address: 'AC5ZaEVrjnQsv8mj9iG9e2Bq2CQaBdCZ1wwnervVwuED',
    expectedAmount: 300000,
    description: 'Wallet with 300k tokens',
  },
];

/**
 * Verify specific wallets against expected values
 */
async function verifySpecificWallets() {
  console.log('Verifying specific wallet balances against expected values...');

  try {
    // Load the latest staking snapshot
    console.log('Loading latest staking snapshot...');
    const snapshot = await loadStakingSnapshot();

    if (!snapshot) {
      console.log('No staking snapshot found, creating one...');
      const newSnapshot = await createStakingSnapshot();
      console.log(`Created new snapshot with ID: ${newSnapshot.id}`);
      await verifyWallets(newSnapshot.stakingData);
    } else {
      console.log(
        `Loaded snapshot with ID: ${snapshot.id} from ${new Date(snapshot.timestamp).toLocaleString()}`
      );
      await verifyWallets(snapshot.stakingData);
    }
  } catch (error) {
    console.error('Error verifying specific wallets:', error);
  }
}

/**
 * Verify wallet balances against expected values
 */
async function verifyWallets(stakingData: any[]) {
  console.log('\n===== WALLET VERIFICATION =====');

  // Create connection to Solana network
  const connectionConfig = {
    commitment: 'confirmed' as const,
    confirmTransactionInitialTimeout: 60000,
  };

  console.log('Creating Solana connection...');
  const connection = new Connection(FULL_RPC_URL, connectionConfig);

  // Verify each wallet
  for (const wallet of WALLETS_TO_VERIFY) {
    console.log(`\nVerifying wallet: ${wallet.address}`);
    console.log(`Description: ${wallet.description}`);
    console.log(`Expected amount: ${wallet.expectedAmount}`);

    // Find wallet in staking data
    const walletData = stakingData.find(data => data.walletAddress === wallet.address);

    if (walletData) {
      console.log(`Calculated amount: ${walletData.totalStaked}`);
      console.log(`Difference: ${walletData.totalStaked - wallet.expectedAmount}`);
      console.log(
        `Match: ${Math.abs(walletData.totalStaked - wallet.expectedAmount) < 0.1 ? 'YES ✅' : 'NO ❌'}`
      );

      // Show detailed stake breakdown
      console.log('\nStake details:');
      console.table(
        walletData.stakes.map(stake => ({
          amount: stake.amount,
          stakeDate: new Date(stake.stakeDate).toLocaleDateString(),
          unlockDate: new Date(stake.unlockDate).toLocaleDateString(),
          isLocked: stake.isLocked ? 'Yes' : 'No',
        }))
      );
    } else {
      console.log(`Wallet not found in staking data ❌`);
    }

    // Verify on-chain token balance
    try {
      const walletPubkey = new PublicKey(wallet.address);
      const tokenAccounts = await connection.getTokenAccountsByOwner(walletPubkey, {
        mint: new PublicKey('31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk'),
      });

      if (tokenAccounts.value.length > 0) {
        const tokenAccount = tokenAccounts.value[0].pubkey;
        const balance = await connection.getTokenAccountBalance(tokenAccount);
        console.log(`On-chain token balance: ${balance.value.uiAmount || 0}`);
      } else {
        console.log(`No token accounts found for this wallet`);
      }
    } catch (error) {
      console.log(`Error fetching on-chain balance: ${error.message}`);
    }
  }

  console.log('\n===== VERIFICATION COMPLETE =====');
}

// Run the verification
verifySpecificWallets();
