/**
 * Script to compare calculated staking balances with actual on-chain balances
 * This will help identify which wallets have discrepancies
 */
import { Connection, PublicKey } from '@solana/web3.js';
import { config as dotenvConfig } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { FULL_RPC_URL } from '../config/config.js';
import { query } from '../db/index.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');

// Load environment variables from .env.local
console.log('Loading environment variables from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

// Contract addresses
const STAKING_CONTRACT_ADDRESS = 'GpUmCRvdKF7EkiufUTCPDvPgy6Fi4GXtrLgLSwLCCyLd';
const TOKEN_MINT_ADDRESS = '31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk';
const CONTRACT_TOKEN_ACCOUNT = 'JAji7pYxBgtDw1RGXhjH7tT1HzSD42FfZ5sAfyw5cz3A';

// Threshold for discrepancy reporting (percentage)
const DISCREPANCY_THRESHOLD = 1; // 1%

// Rate limiting parameters
const BATCH_SIZE = 10;
const BATCH_DELAY = 1000; // 1 second

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Define a type for wallet discrepancies
interface WalletDiscrepancy {
  walletAddress: string;
  calculatedStake: number;
  actualBalance: number;
  difference: number;
  percentDiff: number;
  hasStakingTx: boolean;
}

/**
 * Compare calculated staking balances with actual on-chain balances
 */
async function compareWalletBalances() {
  try {
    console.log('Starting wallet balance comparison...');

    // Create connection to Solana network
    const connectionConfig = {
      commitment: 'confirmed' as const,
      confirmTransactionInitialTimeout: 60000,
    };

    console.log('Creating Solana connection...');
    const connection = new Connection(FULL_RPC_URL, connectionConfig);

    // Get the contract's token account balance
    console.log('Getting contract token balance...');
    const contractTokenAccountPubkey = new PublicKey(CONTRACT_TOKEN_ACCOUNT);
    const tokenBalance = await connection.getTokenAccountBalance(contractTokenAccountPubkey);
    const actualContractBalance = tokenBalance.value.uiAmount || 0;
    console.log(`Current contract token balance: ${actualContractBalance}`);

    // Get the latest snapshot ID
    console.log('Getting latest staking snapshot...');
    const snapshotResult = await query(
      `SELECT id FROM staking_snapshots ORDER BY timestamp DESC LIMIT 1`
    );

    if (!snapshotResult.rowCount) {
      console.log('No staking snapshots found');
      return;
    }

    const snapshotId = snapshotResult.rows[0].id;
    console.log(`Using latest snapshot ID: ${snapshotId}`);

    // Get all wallet data from the snapshot
    const walletsResult = await query(
      `SELECT 
        wallet_address, 
        total_staked, 
        total_locked, 
        total_unlocked 
      FROM 
        staking_wallet_data 
      WHERE 
        snapshot_id = $1
      ORDER BY
        total_staked DESC`,
      [snapshotId]
    );

    const wallets = walletsResult.rows;
    console.log(`Found ${wallets.length} wallets in the snapshot`);

    // Calculate the total staked amount in our database
    const calculatedTotal = wallets.reduce(
      (sum, wallet) => sum + parseFloat(wallet.total_staked),
      0
    );
    console.log(`Total calculated stake amount: ${calculatedTotal}`);
    console.log(`Actual contract balance: ${actualContractBalance}`);

    // Calculate difference
    const difference = Math.abs(calculatedTotal - actualContractBalance);
    const percentDifference = (difference / actualContractBalance) * 100;
    console.log(`Difference: ${difference} tokens (${percentDifference.toFixed(2)}%)`);

    // Process wallets in batches to avoid rate limiting
    const discrepancies: WalletDiscrepancy[] = [];
    let totalProcessed = 0;
    let totalWithDiscrepancy = 0;
    let batchNum = 1;

    console.log(`Processing wallets in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < wallets.length; i += BATCH_SIZE) {
      const batch = wallets.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${batchNum}/${Math.ceil(wallets.length / BATCH_SIZE)}...`);

      for (const wallet of batch) {
        try {
          const walletAddress = wallet.wallet_address;
          const calculatedStake = parseFloat(wallet.total_staked);

          // Skip wallets with very small stakes
          if (calculatedStake < 10) {
            console.log(`Skipping wallet ${walletAddress} with small stake: ${calculatedStake}`);
            totalProcessed++;
            continue;
          }

          // Get token accounts for this wallet
          const walletPubkey = new PublicKey(walletAddress);
          const walletTokenAccounts = await connection.getTokenAccountsByOwner(walletPubkey, {
            mint: new PublicKey(TOKEN_MINT_ADDRESS),
          });

          // If wallet has no token accounts, it has no tokens
          let actualBalance = 0;

          if (walletTokenAccounts.value.length > 0) {
            const tokenAccount = walletTokenAccounts.value[0].pubkey;
            const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
            actualBalance = accountInfo.value.uiAmount || 0;
          }

          // Check for transactions between this wallet and the staking contract
          // This helps us identify if tokens are actually staked
          const hasStakingTransactions = await checkForStakingTransactions(
            connection,
            walletAddress
          );

          // Calculate the discrepancy
          const differenceAmount = Math.abs(calculatedStake - actualBalance);
          const diffPercentage =
            actualBalance > 0
              ? (differenceAmount / actualBalance) * 100
              : differenceAmount > 0
                ? 100
                : 0;

          // Check if there's a significant discrepancy
          if (diffPercentage > DISCREPANCY_THRESHOLD) {
            totalWithDiscrepancy++;

            discrepancies.push({
              walletAddress,
              calculatedStake,
              actualBalance,
              difference: differenceAmount,
              percentDiff: diffPercentage,
              hasStakingTx: hasStakingTransactions,
            });

            console.log(`Discrepancy found for wallet ${walletAddress}:`);
            console.log(`  Calculated stake: ${calculatedStake}`);
            console.log(`  Actual balance: ${actualBalance}`);
            console.log(`  Difference: ${differenceAmount} (${diffPercentage.toFixed(2)}%)`);
            console.log(`  Has staking transactions: ${hasStakingTransactions}`);
          }

          totalProcessed++;
        } catch (error) {
          console.error(`Error processing wallet ${wallet.wallet_address}:`, error);
        }
      }

      // Delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < wallets.length) {
        console.log(`Waiting ${BATCH_DELAY}ms before next batch...`);
        await sleep(BATCH_DELAY);
      }

      batchNum++;
    }

    // Sort discrepancies by difference amount (descending)
    discrepancies.sort((a, b) => b.difference - a.difference);

    // Output summary
    console.log('\n==== DISCREPANCY SUMMARY ====');
    console.log(`Total wallets processed: ${totalProcessed}`);
    console.log(
      `Wallets with discrepancies: ${totalWithDiscrepancy} (${((totalWithDiscrepancy / totalProcessed) * 100).toFixed(2)}%)`
    );

    // Show top discrepancies
    console.log('\nTop discrepancies by amount:');
    const topDiscrepancies = discrepancies.slice(0, 20);
    console.table(
      topDiscrepancies.map(d => ({
        wallet: d.walletAddress,
        calculated: d.calculatedStake,
        actual: d.actualBalance,
        diff: d.difference,
        diffPercent: `${d.percentDiff.toFixed(2)}%`,
        hasStakingTx: d.hasStakingTx,
      }))
    );

    // Calculate total discrepancy
    const totalDiscrepancy = discrepancies.reduce((sum, d) => sum + d.difference, 0);
    console.log(`\nTotal discrepancy amount: ${totalDiscrepancy}`);
    console.log(
      `This accounts for ${((totalDiscrepancy / difference) * 100).toFixed(2)}% of the overall difference`
    );

    // Count common patterns
    const noBalanceCount = discrepancies.filter(d => d.actualBalance === 0).length;
    const calculatedHigherCount = discrepancies.filter(
      d => d.calculatedStake > d.actualBalance
    ).length;
    const actualHigherCount = discrepancies.filter(d => d.actualBalance > d.calculatedStake).length;

    console.log('\nDiscrepancy patterns:');
    console.log(
      `Wallets with no actual balance: ${noBalanceCount} (${((noBalanceCount / totalWithDiscrepancy) * 100).toFixed(2)}%)`
    );
    console.log(
      `Calculated higher than actual: ${calculatedHigherCount} (${((calculatedHigherCount / totalWithDiscrepancy) * 100).toFixed(2)}%)`
    );
    console.log(
      `Actual higher than calculated: ${actualHigherCount} (${((actualHigherCount / totalWithDiscrepancy) * 100).toFixed(2)}%)`
    );

    // Output recommendations
    console.log('\n==== RECOMMENDATIONS ====');
    if (noBalanceCount > 0 && noBalanceCount / totalWithDiscrepancy > 0.5) {
      console.log(
        '- Many wallets have calculated stakes but no actual balance. This suggests withdrawn tokens are not being properly accounted for.'
      );
    }
    if (calculatedHigherCount > actualHigherCount) {
      console.log(
        '- Our calculation is generally overestimating stakes. Check withdrawal handling in the formatStakingData function.'
      );
    } else if (actualHigherCount > calculatedHigherCount) {
      console.log(
        '- Our calculation is generally underestimating stakes. Check deposit handling in the formatStakingData function.'
      );
    }
  } catch (error) {
    console.error('Error comparing wallet balances:', error);
  }
}

/**
 * Check if a wallet has transactions with the staking contract
 */
async function checkForStakingTransactions(
  connection: Connection,
  walletAddress: string
): Promise<boolean> {
  try {
    const walletPubkey = new PublicKey(walletAddress);

    // Get token accounts for this wallet
    const walletTokenAccounts = await connection.getTokenAccountsByOwner(walletPubkey, {
      mint: new PublicKey(TOKEN_MINT_ADDRESS),
    });

    if (walletTokenAccounts.value.length === 0) {
      return false;
    }

    // Get signatures for the token account
    const tokenAccount = walletTokenAccounts.value[0].pubkey;
    const signatures = await connection.getSignaturesForAddress(tokenAccount, { limit: 10 });

    // If we found signatures, check a sample transaction to see if it involves the contract
    if (signatures.length > 0) {
      const tx = await connection.getParsedTransaction(signatures[0].signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!tx || !tx.meta) {
        return false;
      }

      // Check if any account in the transaction is the staking contract
      const accounts = tx.transaction.message.accountKeys;
      return accounts.some(account => account.pubkey.toString() === STAKING_CONTRACT_ADDRESS);
    }

    return false;
  } catch (error) {
    console.error(`Error checking for staking transactions for wallet ${walletAddress}:`, error);
    return false;
  }
}

// Run the comparison
compareWalletBalances();
