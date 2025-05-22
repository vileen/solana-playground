/**
 * Script to verify unlocked tokens calculation for specific wallets
 */
import { config as dotenvConfig } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Import database functions
import { query } from '../db/index.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');

// Load environment variables from .env.local
console.log('Loading environment variables from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

// Target wallets to analyze
const TARGET_WALLETS = [
  'F5Vw7k9rwy9QFtbjJdvnyJiA6Hs3bfxszeuYMDQXHQtd',
  'BEzePHuzfY2njeA6839gVoXQuVd6YvCTGavWjA9KF8ky',
];

async function verifyWalletData(walletAddress: string, snapshotId: number) {
  console.log(`\n===============================================`);
  console.log(`Verifying unlocked tokens for wallet: ${walletAddress}`);
  console.log(`===============================================`);

  try {
    // Get wallet data from the database
    const walletDataResult = await query(
      `SELECT 
        wallet_address, 
        total_staked, 
        total_locked, 
        total_unlocked 
      FROM 
        staking_wallet_data 
      WHERE 
        snapshot_id = $1 
        AND wallet_address = $2`,
      [snapshotId, walletAddress]
    );

    if (!walletDataResult || !walletDataResult.rowCount || walletDataResult.rowCount === 0) {
      console.log(`No staking data found for wallet ${walletAddress}`);
      return;
    }

    const walletData = walletDataResult.rows[0];
    console.log('\nWallet Staking Summary:');
    console.log(`Total Staked: ${walletData.total_staked}`);
    console.log(`Total Locked: ${walletData.total_locked}`);
    console.log(`Total Unlocked: ${walletData.total_unlocked}`);

    // Get individual stakes for this wallet
    const stakesResult = await query(
      `SELECT 
        amount, 
        stake_date, 
        unlock_date, 
        is_locked 
      FROM 
        staking_stakes 
      WHERE 
        snapshot_id = $1 
        AND wallet_address = $2 
      ORDER BY 
        stake_date ASC`,
      [snapshotId, walletAddress]
    );

    const stakesCount = stakesResult && stakesResult.rows ? stakesResult.rows.length : 0;
    console.log(`\nFound ${stakesCount} individual stakes for this wallet`);

    if (stakesResult && stakesResult.rows && stakesResult.rows.length > 0) {
      console.log('\nIndividual Stakes:');
      console.table(
        stakesResult.rows.map(stake => ({
          amount: stake.amount,
          stakeDate: new Date(stake.stake_date).toISOString().split('T')[0],
          unlockDate: new Date(stake.unlock_date).toISOString().split('T')[0],
          isLocked: stake.is_locked,
          status: stake.is_locked ? 'LOCKED' : 'UNLOCKED',
        }))
      );

      // Verify totals
      const calculatedLocked = stakesResult.rows
        .filter(stake => stake.is_locked)
        .reduce((sum, stake) => sum + parseFloat(stake.amount), 0);

      const calculatedUnlocked = stakesResult.rows
        .filter(stake => !stake.is_locked)
        .reduce((sum, stake) => sum + parseFloat(stake.amount), 0);

      const calculatedTotal = calculatedLocked + calculatedUnlocked;

      console.log('\nVerification:');
      console.log(`Calculated Total: ${calculatedTotal}`);
      console.log(`Calculated Locked: ${calculatedLocked}`);
      console.log(`Calculated Unlocked: ${calculatedUnlocked}`);

      // Check for discrepancies
      const totalDiscrepancy = Math.abs(calculatedTotal - walletData.total_staked);
      const lockedDiscrepancy = Math.abs(calculatedLocked - walletData.total_locked);
      const unlockedDiscrepancy = Math.abs(calculatedUnlocked - walletData.total_unlocked);

      if (totalDiscrepancy > 0.01 || lockedDiscrepancy > 0.01 || unlockedDiscrepancy > 0.01) {
        console.log('\n⚠️ DISCREPANCIES DETECTED:');
        if (totalDiscrepancy > 0.01) {
          console.log(`Total staked discrepancy: ${totalDiscrepancy}`);
        }
        if (lockedDiscrepancy > 0.01) {
          console.log(`Locked tokens discrepancy: ${lockedDiscrepancy}`);
        }
        if (unlockedDiscrepancy > 0.01) {
          console.log(`Unlocked tokens discrepancy: ${unlockedDiscrepancy}`);
        }
      } else {
        console.log('\n✅ No discrepancies found - calculations match');
      }
    }
  } catch (error) {
    console.error(`Error verifying wallet ${walletAddress}:`, error);
  }
}

async function verifyUnlockedTokens() {
  try {
    // Get the latest snapshot ID
    const snapshotResult = await query(
      `SELECT id FROM staking_snapshots ORDER BY timestamp DESC LIMIT 1`
    );

    if (!snapshotResult || !snapshotResult.rowCount || snapshotResult.rowCount === 0) {
      console.log('No staking snapshots found');
      return;
    }

    const snapshotId = snapshotResult.rows[0].id;
    console.log(`Using latest snapshot ID: ${snapshotId}`);

    // Analyze each wallet
    for (const wallet of TARGET_WALLETS) {
      await verifyWalletData(wallet, snapshotId);
    }

    console.log('\nVerification complete. To get actual deposit/withdrawal transactions, run:');
    console.log('yarn tsx src/backend/scripts/analyzeWallet.ts');
  } catch (error) {
    console.error('Error verifying unlocked tokens:', error);
  }
}

// Run the verification
verifyUnlockedTokens();
