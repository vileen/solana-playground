/**
 * Script to verify all transactions for a specific wallet
 * This script finds and displays all transactions related to a wallet's staking activity
 */
import { Connection, PublicKey } from '@solana/web3.js';
import { config as dotenvConfig } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { FULL_RPC_URL } from '../config/config.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');

// Load environment variables from .env.local
console.log('Loading environment variables from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

// Constants
const TOKEN_MINT_ADDRESS = '31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk';
const CONTRACT_TOKEN_ACCOUNT = 'JAji7pYxBgtDw1RGXhjH7tT1HzSD42FfZ5sAfyw5cz3A';
const STAKING_PERIOD_DAYS = 90;

async function main() {
  try {
    // Get wallet address from command line arguments
    const walletAddress = process.argv[2];

    if (!walletAddress) {
      console.log('Usage: yarn verify:wallet-transactions <wallet-address>');
      console.log(
        'Example: yarn verify:wallet-transactions F5Vw7k9rwy9QFtbjJdvnyJiA6Hs3bfxszeuYMDQXHQtd'
      );
      process.exit(1);
    }

    console.log(`Verifying transactions for wallet: ${walletAddress}`);

    // Create connection with API key
    const connectionConfig = {
      commitment: 'confirmed' as const,
      confirmTransactionInitialTimeout: 60000,
    };

    console.log('Creating Solana connection...');
    const connection = new Connection(FULL_RPC_URL, connectionConfig);

    // First, find all signatures involving the wallet and contract token account
    console.log('Finding signatures involving the wallet...');

    // Find wallet-owned token accounts
    const walletPubkey = new PublicKey(walletAddress);
    const tokenAccounts = await connection.getTokenAccountsByOwner(walletPubkey, {
      mint: new PublicKey(TOKEN_MINT_ADDRESS),
    });

    if (tokenAccounts.value.length === 0) {
      console.log(`No token accounts found for wallet ${walletAddress}`);
      process.exit(0);
    }

    console.log(`Found ${tokenAccounts.value.length} token accounts for wallet ${walletAddress}`);

    // Get all signatures for these token accounts and the contract account
    const allSignatures = [];
    const accountsToCheck = [
      ...tokenAccounts.value.map(acc => acc.pubkey),
      new PublicKey(CONTRACT_TOKEN_ACCOUNT),
    ];

    for (const account of accountsToCheck) {
      console.log(`Getting signatures for account ${account.toString()}...`);
      let signatures = [];
      let lastSignature = undefined;
      let hasMore = true;

      while (hasMore) {
        const options: any = { limit: 100 };
        if (lastSignature) {
          options.before = lastSignature;
        }

        try {
          const batch = await connection.getSignaturesForAddress(account, options);
          console.log(`Found ${batch.length} signatures in batch`);

          if (batch.length === 0) {
            hasMore = false;
            continue;
          }

          lastSignature = batch[batch.length - 1].signature;
          signatures = [...signatures, ...batch];

          if (batch.length < 100) {
            hasMore = false;
          } else {
            // Wait to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`Error fetching signatures: ${error}`);
          hasMore = false;
        }
      }

      allSignatures.push(...signatures);
    }

    // Deduplicate signatures
    const uniqueSignatures = [...new Map(allSignatures.map(sig => [sig.signature, sig])).values()];

    // Sort by timestamp
    uniqueSignatures.sort((a, b) => b.blockTime - a.blockTime);

    console.log(
      `Found ${uniqueSignatures.length} unique signatures possibly involving wallet ${walletAddress}`
    );

    // Analyze each transaction to see if it's a deposit or withdrawal involving the wallet
    const walletTransactions = [];
    let processedCount = 0;

    for (const sigInfo of uniqueSignatures) {
      processedCount++;
      if (processedCount % 10 === 0) {
        console.log(`Processed ${processedCount}/${uniqueSignatures.length} transactions...`);
      }

      try {
        const tx = await connection.getParsedTransaction(sigInfo.signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });

        if (!tx) continue;

        const preBalances = tx.meta?.preTokenBalances || [];
        const postBalances = tx.meta?.postTokenBalances || [];

        let isDeposit = false;
        let isWithdrawal = false;
        let amount = 0;

        // Find contract token account balances
        const contractPreBalance = preBalances.find(
          balance =>
            tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString() ===
            CONTRACT_TOKEN_ACCOUNT
        );

        const contractPostBalance = postBalances.find(
          balance =>
            tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString() ===
            CONTRACT_TOKEN_ACCOUNT
        );

        if (contractPreBalance && contractPostBalance) {
          const contractPreAmount = contractPreBalance.uiTokenAmount.uiAmount || 0;
          const contractPostAmount = contractPostBalance.uiTokenAmount.uiAmount || 0;

          // Check if wallet was involved in this transaction
          let walletInvolved = false;

          // If contract balance increased, it might be a deposit from the wallet
          if (contractPostAmount > contractPreAmount) {
            const depositAmount = contractPostAmount - contractPreAmount;

            // Find which user account sent the tokens
            for (const preBalance of preBalances) {
              const accountOwner = preBalance.owner || '';

              if (accountOwner === walletAddress && preBalance.mint === TOKEN_MINT_ADDRESS) {
                // Find matching post balance
                const accountIndex = preBalance.accountIndex;
                const accountKey =
                  tx.transaction.message.accountKeys[accountIndex].pubkey.toString();

                const userPostBalance = postBalances.find(
                  pb =>
                    tx.transaction.message.accountKeys[pb.accountIndex].pubkey.toString() ===
                    accountKey
                );

                const userPreAmount = preBalance.uiTokenAmount.uiAmount || 0;
                const userPostAmount = userPostBalance?.uiTokenAmount.uiAmount || 0;

                if (
                  userPreAmount > userPostAmount &&
                  Math.abs(userPreAmount - userPostAmount - depositAmount) < 1
                ) {
                  isDeposit = true;
                  amount = depositAmount;
                  walletInvolved = true;
                  break;
                }
              }
            }
          }

          // If contract balance decreased, it might be a withdrawal to the wallet
          if (contractPreAmount > contractPostAmount) {
            const withdrawalAmount = contractPreAmount - contractPostAmount;

            // Find which user account received the tokens
            for (const postBalance of postBalances) {
              const accountOwner = postBalance.owner || '';

              if (accountOwner === walletAddress && postBalance.mint === TOKEN_MINT_ADDRESS) {
                // Find matching pre balance
                const accountIndex = postBalance.accountIndex;
                const accountKey =
                  tx.transaction.message.accountKeys[accountIndex].pubkey.toString();

                const userPreBalance = preBalances.find(
                  pb =>
                    tx.transaction.message.accountKeys[pb.accountIndex].pubkey.toString() ===
                    accountKey
                );

                const userPreAmount = userPreBalance?.uiTokenAmount.uiAmount || 0;
                const userPostAmount = postBalance.uiTokenAmount.uiAmount || 0;

                if (
                  userPostAmount > userPreAmount &&
                  Math.abs(userPostAmount - userPreAmount - withdrawalAmount) < 1
                ) {
                  isWithdrawal = true;
                  amount = withdrawalAmount;
                  walletInvolved = true;
                  break;
                }
              }
            }
          }

          if (walletInvolved) {
            walletTransactions.push({
              signature: sigInfo.signature,
              timestamp: new Date(sigInfo.blockTime * 1000),
              type: isDeposit ? 'DEPOSIT' : 'WITHDRAWAL',
              amount,
            });
          }
        }
      } catch (error) {
        console.error(`Error processing transaction ${sigInfo.signature}: ${error}`);
      }
    }

    // Display results
    console.log('\n===== WALLET STAKING TRANSACTIONS =====');
    console.log(`Total transactions found: ${walletTransactions.length}`);

    // Sort chronologically
    walletTransactions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate expected unlock dates
    const transactionsWithUnlockDates = walletTransactions.map(tx => {
      const unlockDate =
        tx.type === 'DEPOSIT'
          ? new Date(tx.timestamp.getTime() + STAKING_PERIOD_DAYS * 24 * 60 * 60 * 1000)
          : null;

      return {
        ...tx,
        unlockDate,
      };
    });

    // Calculate running balance and net amount
    let runningBalance = 0;
    const transactionsWithBalance = transactionsWithUnlockDates.map(tx => {
      if (tx.type === 'DEPOSIT') {
        runningBalance += tx.amount;
      } else {
        runningBalance -= tx.amount;
      }

      return {
        ...tx,
        balanceAfter: runningBalance,
      };
    });

    // Print transactions in table format
    console.log('\n=== TRANSACTION HISTORY ===');
    console.log(
      'DATE            | TYPE       | AMOUNT    | BALANCE   | UNLOCK DATE    | SIGNATURE'
    );
    console.log(
      '----------------|------------|-----------|-----------|----------------|--------------------------------------------'
    );

    for (const tx of transactionsWithBalance) {
      const date = tx.timestamp.toISOString().substring(0, 10);
      const type = tx.type.padEnd(10, ' ');
      const amount = tx.amount.toString().padEnd(9, ' ');
      const balance = tx.balanceAfter.toString().padEnd(9, ' ');
      const unlockDate = tx.unlockDate
        ? tx.unlockDate.toISOString().substring(0, 10)
        : 'N/A'.padEnd(10, ' ');
      const shortSig = tx.signature.substring(0, 16) + '...';

      console.log(`${date} | ${type} | ${amount} | ${balance} | ${unlockDate} | ${shortSig}`);
    }

    // Show active stakes (deposits that haven't been fully withdrawn)
    const now = new Date();
    const activeDeposits = transactionsWithBalance
      .filter(tx => tx.type === 'DEPOSIT' && tx.balanceAfter > 0)
      .map(tx => ({
        amount: tx.amount,
        stakeDate: tx.timestamp,
        unlockDate: tx.unlockDate!,
        isLocked: tx.unlockDate! > now,
        signature: tx.signature,
      }));

    const totalLocked = activeDeposits
      .filter(stake => stake.isLocked)
      .reduce((sum, stake) => sum + stake.amount, 0);

    const totalUnlocked = activeDeposits
      .filter(stake => !stake.isLocked)
      .reduce((sum, stake) => sum + stake.amount, 0);

    console.log('\n=== ACTIVE STAKES ===');
    console.log(`Total active stakes: ${activeDeposits.length}`);
    console.log(`Total staked: ${runningBalance} tokens`);
    console.log(`Total locked: ${totalLocked} tokens`);
    console.log(`Total unlocked: ${totalUnlocked} tokens`);

    console.log('\nSTAKE DATE      | AMOUNT    | UNLOCK DATE     | STATUS    | SIGNATURE');
    console.log(
      '----------------|-----------|-----------------|-----------|--------------------------------------------'
    );

    for (const stake of activeDeposits) {
      const stakeDate = stake.stakeDate.toISOString().substring(0, 10);
      const amount = stake.amount.toString().padEnd(9, ' ');
      const unlockDate = stake.unlockDate.toISOString().substring(0, 10);
      const status = stake.isLocked ? 'LOCKED' : 'UNLOCKED';
      const shortSig = stake.signature.substring(0, 16) + '...';

      console.log(
        `${stakeDate} | ${amount} | ${unlockDate} | ${status.padEnd(9, ' ')} | ${shortSig}`
      );
    }
  } catch (error) {
    console.error('Error verifying wallet transactions:', error);
    process.exit(1);
  }
}

main();
