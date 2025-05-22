/**
 * Script to audit staking calculations and find issues in the transaction processing logic
 */
import { Connection, ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js';
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

// Contract addresses
const STAKING_CONTRACT_ADDRESS = 'GpUmCRvdKF7EkiufUTCPDvPgy6Fi4GXtrLgLSwLCCyLd';
const TOKEN_MINT_ADDRESS = '31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk';
const CONTRACT_TOKEN_ACCOUNT = 'JAji7pYxBgtDw1RGXhjH7tT1HzSD42FfZ5sAfyw5cz3A';

// Target wallets to analyze in detail
const TARGET_WALLETS = [
  'F5Vw7k9rwy9QFtbjJdvnyJiA6Hs3bfxszeuYMDQXHQtd',
  'BEzePHuzfY2njeA6839gVoXQuVd6YvCTGavWjA9KF8ky',
];

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Audit staking calculations for specific wallets
 */
async function auditStakingCalculations() {
  try {
    console.log('Starting staking calculation audit...');

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

    // Track total deposits and withdrawals
    let globalTotalDeposits = 0;
    let globalTotalWithdrawals = 0;

    // Process each target wallet
    for (const walletAddress of TARGET_WALLETS) {
      console.log(`\n===== Analyzing wallet: ${walletAddress} =====`);

      // Get all transactions for this wallet
      const transactions = await getWalletTransactions(connection, walletAddress);
      console.log(`Found ${transactions.length} valid transactions for wallet`);

      // Process transactions to identify deposits and withdrawals
      const { deposits, withdrawals, calculatedNetAmount } = await processWalletTransactions(
        connection,
        walletAddress,
        transactions
      );

      console.log(`\nDeposits for ${walletAddress}:`);
      console.table(
        deposits.map(d => ({
          amount: d.amount,
          date: new Date(d.timestamp).toISOString(),
          txSignature: d.signature.slice(0, 8) + '...',
        }))
      );

      console.log(`\nWithdrawals for ${walletAddress}:`);
      console.table(
        withdrawals.map(w => ({
          amount: w.amount,
          date: new Date(w.timestamp).toISOString(),
          txSignature: w.signature.slice(0, 8) + '...',
        }))
      );

      // Calculate total deposits and withdrawals
      const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);
      const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);

      console.log(`\nTotal deposits: ${totalDeposits}`);
      console.log(`Total withdrawals: ${totalWithdrawals}`);
      console.log(`Calculated net amount: ${calculatedNetAmount}`);

      // Track global totals
      globalTotalDeposits += totalDeposits;
      globalTotalWithdrawals += totalWithdrawals;

      // Simulate FIFO processing logic - Standard Method
      console.log('\nSimulating FIFO withdrawal processing (Standard Method):');
      const standardFifoResult = simulateFifoWithdrawals(deposits, withdrawals);

      // Try a different FIFO calculation that avoids the reset-to-zero issue
      console.log('\nSimulating FIFO withdrawal processing (Alternative Method):');
      const alternativeFifoResult = simulateAlternativeFifoWithdrawals(deposits, withdrawals);

      // Compare different calculation methods
      console.log('\nComparison of different calculation methods:');
      console.log(`Raw Net Amount (deposits - withdrawals): ${totalDeposits - totalWithdrawals}`);
      console.log(`Standard FIFO Remaining Amount: ${standardFifoResult.remainingAmount}`);
      console.log(`Alternative FIFO Remaining Amount: ${alternativeFifoResult.remainingAmount}`);
      console.log(`Calculated Net Amount from Transactions: ${calculatedNetAmount}`);
      console.log(
        `Expected Amount for ${walletAddress}: ${walletAddress === 'F5Vw7k9rwy9QFtbjJdvnyJiA6Hs3bfxszeuYMDQXHQtd' ? 63117 : 'Unknown'}`
      );

      // Check for negative net amount issue
      if (totalDeposits - totalWithdrawals < 0) {
        console.log('\n⚠️ ISSUE DETECTED: Negative net amount after standard calculation');
        console.log(
          'This indicates withdrawals exceed deposits, which triggers the reset-to-zero behavior in the code'
        );
        console.log('This is likely causing the calculation error');
      }

      // Analyze the remaining deposit records
      console.log('\nRemaining deposit records after FIFO processing:');
      console.table(
        standardFifoResult.remainingDeposits.map(d => ({
          originalAmount: d.originalAmount,
          remainingAmount: d.amount,
          date: new Date(d.timestamp).toISOString(),
        }))
      );
    }

    // Overall summary
    console.log('\n===== OVERALL SUMMARY =====');
    console.log(`Total deposits across all target wallets: ${globalTotalDeposits}`);
    console.log(`Total withdrawals across all target wallets: ${globalTotalWithdrawals}`);
    console.log(
      `Net amount across all target wallets: ${globalTotalDeposits - globalTotalWithdrawals}`
    );

    // Output diagnostic information and findings
    console.log('\n===== FINDINGS =====');
    console.log(
      '1. The issue appears to be in the FIFO calculation logic when deposits and withdrawals are processed.'
    );
    console.log(
      '2. When a wallet has more withdrawals than deposits, the code resets the net amount to zero.'
    );
    console.log(
      '   However, subsequent deposits are still being tracked, creating an inconsistency.'
    );
    console.log(
      "3. The FIFO calculation doesn't properly handle the case where there are multiple deposits and withdrawals"
    );
    console.log('   that exceed total deposits at some point in the timeline.');
    console.log('\n===== RECOMMENDED FIXES =====');
    console.log('1. Remove the correction factor application entirely - it masks the real issue');
    console.log('2. Fix the handling of negative net amounts in processSPLTransferTransaction()');
    console.log(
      '3. Ensure the FIFO calculation in formatStakingData() properly accounts for all deposits and withdrawals'
    );
    console.log(
      '4. Add individual wallet overrides for known correct values until the calculation issue is fully resolved'
    );
  } catch (error) {
    console.error('Error in audit staking calculations:', error);
  }
}

/**
 * Get all transactions for a wallet
 */
async function getWalletTransactions(
  connection: Connection,
  walletAddress: string
): Promise<ParsedTransactionWithMeta[]> {
  try {
    const walletPubkey = new PublicKey(walletAddress);

    // Get token accounts for this wallet
    const walletTokenAccounts = await connection.getTokenAccountsByOwner(walletPubkey, {
      mint: new PublicKey(TOKEN_MINT_ADDRESS),
    });

    if (walletTokenAccounts.value.length === 0) {
      console.log(`No token accounts found for wallet ${walletAddress}`);
      return [];
    }

    const walletTokenAccount = walletTokenAccounts.value[0].pubkey;
    console.log(`Found wallet token account: ${walletTokenAccount.toString()}`);

    // Get all signatures for the wallet's token account
    console.log(`Fetching transactions for wallet token account...`);
    const walletTokenSignatures = await connection.getSignaturesForAddress(walletTokenAccount, {
      limit: 100,
    });

    console.log(`Found ${walletTokenSignatures.length} signatures for wallet token account`);

    if (walletTokenSignatures.length === 0) {
      return [];
    }

    // Process transactions in batches
    const BATCH_SIZE = 5;
    const BATCH_DELAY = 1000;
    const transactions: (ParsedTransactionWithMeta | null)[] = [];

    // Process signatures in batches
    for (let i = 0; i < walletTokenSignatures.length; i += BATCH_SIZE) {
      const batchSignatures = walletTokenSignatures.slice(i, i + BATCH_SIZE);

      const batchPromises = batchSignatures.map(sig =>
        connection.getParsedTransaction(sig.signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        })
      );

      const batchTransactions = await Promise.all(batchPromises);
      transactions.push(...batchTransactions);

      // Add a small delay between batches
      if (i + BATCH_SIZE < walletTokenSignatures.length) {
        await sleep(BATCH_DELAY);
      }
    }

    // Filter null transactions and sort by blockTime
    const validTransactions = transactions.filter(Boolean) as ParsedTransactionWithMeta[];
    validTransactions.sort((a, b) => {
      const timeA = a.blockTime || 0;
      const timeB = b.blockTime || 0;
      return timeA - timeB;
    });

    return validTransactions;
  } catch (error) {
    console.error(`Error getting wallet transactions:`, error);
    return [];
  }
}

/**
 * Process transactions to identify deposits and withdrawals
 */
async function processWalletTransactions(
  connection: Connection,
  walletAddress: string,
  transactions: ParsedTransactionWithMeta[]
): Promise<{
  deposits: Array<{ amount: number; timestamp: number; signature: string }>;
  withdrawals: Array<{ amount: number; timestamp: number; signature: string }>;
  calculatedNetAmount: number;
}> {
  const deposits: Array<{ amount: number; timestamp: number; signature: string }> = [];
  const withdrawals: Array<{ amount: number; timestamp: number; signature: string }> = [];
  let netAmount = 0;

  for (const tx of transactions) {
    try {
      // Skip if transaction failed
      if (tx.meta?.err) continue;

      // Get transaction timestamp
      const timestamp = tx.blockTime ? tx.blockTime * 1000 : Date.now();
      const signature = tx.transaction.signatures[0];

      // Check if transaction involves the correct token and contract
      const contractTokenAccounts = new Set<string>();
      const userTokenAccounts = new Map<string, string>(); // Maps token account to wallet address

      // Pre and post balances
      const preBalances = tx.meta?.preTokenBalances || [];
      const postBalances = tx.meta?.postTokenBalances || [];

      // Process balances to find accounts with the correct mint
      [...preBalances, ...postBalances].forEach(balance => {
        if (balance.mint === TOKEN_MINT_ADDRESS) {
          const accountIndex = balance.accountIndex;
          const accountKey = tx.transaction.message.accountKeys[accountIndex].pubkey.toString();

          if (balance.owner === STAKING_CONTRACT_ADDRESS) {
            contractTokenAccounts.add(accountKey);
          } else if (balance.owner) {
            userTokenAccounts.set(accountKey, balance.owner);
          }
        }
      });

      // Now detect balance changes for these accounts
      if (contractTokenAccounts.size > 0 && userTokenAccounts.size > 0) {
        // Process contract accounts to find withdrawals and deposits
        for (const contractAccount of contractTokenAccounts) {
          const contractPreBalance = preBalances.find(
            balance =>
              tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString() ===
              contractAccount
          );

          const contractPostBalance = postBalances.find(
            balance =>
              tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString() ===
              contractAccount
          );

          if (contractPreBalance && contractPostBalance) {
            const contractPreAmount = contractPreBalance.uiTokenAmount.uiAmount || 0;
            const contractPostAmount = contractPostBalance.uiTokenAmount.uiAmount || 0;

            // If contract lost tokens, this is a withdrawal
            if (contractPreAmount > contractPostAmount) {
              const withdrawalAmount = contractPreAmount - contractPostAmount;

              // Find the user account that gained tokens
              for (const [userAccount, ownerAddress] of userTokenAccounts.entries()) {
                // Only process if this is our target wallet
                if (ownerAddress !== walletAddress) continue;

                const userPreBalance = preBalances.find(
                  balance =>
                    tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString() ===
                    userAccount
                );

                const userPostBalance = postBalances.find(
                  balance =>
                    tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString() ===
                    userAccount
                );

                if (userPreBalance && userPostBalance) {
                  const userPreAmount = userPreBalance.uiTokenAmount.uiAmount || 0;
                  const userPostAmount = userPostBalance.uiTokenAmount.uiAmount || 0;

                  if (userPostAmount > userPreAmount) {
                    const gainAmount = userPostAmount - userPreAmount;

                    // If the gain is approximately equal to the withdrawal
                    if (Math.abs(gainAmount - withdrawalAmount) < 1) {
                      console.log(
                        `Detected withdrawal of ${withdrawalAmount} tokens at ${new Date(timestamp).toISOString()}`
                      );

                      // Record withdrawal
                      withdrawals.push({ amount: withdrawalAmount, timestamp, signature });
                      netAmount -= withdrawalAmount;

                      // ISSUE: Our original code resets negative net amounts to zero
                      // This is what we need to fix
                      if (netAmount < 0) {
                        console.log(
                          `ISSUE DETECTED: Net amount went negative (${netAmount}) - would be reset to 0 in production code`
                        );
                      }
                    }
                  }
                }
              }
            }

            // If contract gained tokens, this is a deposit
            if (contractPostAmount > contractPreAmount) {
              const depositAmount = contractPostAmount - contractPreAmount;

              // Find the user account that lost tokens
              for (const [userAccount, ownerAddress] of userTokenAccounts.entries()) {
                // Only process if this is our target wallet
                if (ownerAddress !== walletAddress) continue;

                const userPreBalance = preBalances.find(
                  balance =>
                    tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString() ===
                    userAccount
                );

                const userPostBalance = postBalances.find(
                  balance =>
                    tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString() ===
                    userAccount
                );

                if (userPreBalance && userPostBalance) {
                  const userPreAmount = userPreBalance.uiTokenAmount.uiAmount || 0;
                  const userPostAmount = userPostBalance.uiTokenAmount.uiAmount || 0;

                  if (userPreAmount > userPostAmount) {
                    const lossAmount = userPreAmount - userPostAmount;

                    // If the loss is approximately equal to the deposit
                    if (Math.abs(lossAmount - depositAmount) < 1) {
                      console.log(
                        `Detected deposit of ${depositAmount} tokens at ${new Date(timestamp).toISOString()}`
                      );

                      // Record deposit
                      deposits.push({ amount: depositAmount, timestamp, signature });
                      netAmount += depositAmount;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing transaction:', error);
    }
  }

  return { deposits, withdrawals, calculatedNetAmount: netAmount };
}

/**
 * Simulate FIFO withdrawal processing using standard method
 */
function simulateFifoWithdrawals(
  deposits: Array<{ amount: number; timestamp: number; signature: string }>,
  withdrawals: Array<{ amount: number; timestamp: number; signature: string }>
): {
  remainingDeposits: Array<{ amount: number; timestamp: number; originalAmount: number }>;
  remainingAmount: number;
} {
  // Create a copy of deposits
  let remainingDeposits = deposits.map(d => ({
    ...d,
    originalAmount: d.amount,
  }));

  // Sort deposits and withdrawals by timestamp
  remainingDeposits.sort((a, b) => a.timestamp - b.timestamp);
  const sortedWithdrawals = [...withdrawals].sort((a, b) => a.timestamp - b.timestamp);

  // Process withdrawals
  let remainingWithdrawalAmount = 0;
  for (const withdrawal of sortedWithdrawals) {
    remainingWithdrawalAmount += withdrawal.amount;
    console.log(
      `Processing withdrawal of ${withdrawal.amount} tokens at ${new Date(withdrawal.timestamp).toISOString()}`
    );
  }

  console.log(`Total withdrawal amount to process: ${remainingWithdrawalAmount}`);

  // Reduce deposits by withdrawal amounts (FIFO order)
  for (let i = 0; i < remainingDeposits.length; i++) {
    const deposit = remainingDeposits[i];
    const originalAmount = deposit.amount;

    if (remainingWithdrawalAmount >= deposit.amount) {
      // This deposit has been fully withdrawn
      console.log(
        `Deposit ${i + 1}: ${originalAmount} - fully consumed by withdrawals, setting to 0`
      );
      remainingWithdrawalAmount -= deposit.amount;
      deposit.amount = 0;
    } else if (remainingWithdrawalAmount > 0) {
      // This deposit has been partially withdrawn
      console.log(
        `Deposit ${i + 1}: ${originalAmount} - partially consumed by withdrawals, remaining: ${deposit.amount - remainingWithdrawalAmount}`
      );
      deposit.amount -= remainingWithdrawalAmount;
      remainingWithdrawalAmount = 0;
    } else {
      // This deposit is not affected by withdrawals
      console.log(`Deposit ${i + 1}: ${originalAmount} - not affected by withdrawals`);
    }
  }

  // Filter out deposits that have been completely withdrawn
  remainingDeposits = remainingDeposits.filter(deposit => deposit.amount > 0);

  // Calculate total remaining amount
  const remainingAmount = remainingDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);

  return { remainingDeposits, remainingAmount };
}

/**
 * Simulate an alternative FIFO withdrawal processing method
 * This approach doesn't reset negative balances to zero
 */
function simulateAlternativeFifoWithdrawals(
  deposits: Array<{ amount: number; timestamp: number; signature: string }>,
  withdrawals: Array<{ amount: number; timestamp: number; signature: string }>
): {
  remainingDeposits: Array<{ amount: number; timestamp: number; originalAmount: number }>;
  remainingAmount: number;
} {
  // First, let's perform a chronological simulation of the wallet activity
  const allTransactions = [
    ...deposits.map(d => ({ type: 'deposit' as const, amount: d.amount, timestamp: d.timestamp })),
    ...withdrawals.map(w => ({
      type: 'withdrawal' as const,
      amount: w.amount,
      timestamp: w.timestamp,
    })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  let balance = 0;
  let negativeBalanceDetected = false;
  let lastDeposit = 0;

  console.log('Chronological simulation of wallet activity:');
  for (const tx of allTransactions) {
    if (tx.type === 'deposit') {
      balance += tx.amount;
      lastDeposit = tx.timestamp;
      console.log(
        `Deposit: +${tx.amount} → Balance: ${balance} at ${new Date(tx.timestamp).toISOString()}`
      );
    } else {
      const prevBalance = balance;
      balance -= tx.amount;
      console.log(
        `Withdrawal: -${tx.amount} → Balance: ${balance} at ${new Date(tx.timestamp).toISOString()}`
      );

      if (balance < 0) {
        negativeBalanceDetected = true;
        console.log(`⚠️ Negative balance detected: ${balance}`);
      }
    }
  }

  // If we detected a negative balance during the simulation,
  // but there were deposits after that, we should create a synthetic deposit
  // that represents the current actual balance
  let remainingDeposits: Array<{ amount: number; timestamp: number; originalAmount: number }> = [];

  if (negativeBalanceDetected && balance > 0) {
    console.log(`Creating a synthetic deposit record with amount ${balance}`);
    remainingDeposits = [
      {
        amount: balance,
        timestamp: lastDeposit,
        originalAmount: balance,
      },
    ];
    return { remainingDeposits, remainingAmount: balance };
  } else if (balance < 0) {
    // If final balance is negative, return empty deposits
    console.log(`Final balance is negative (${balance}), returning 0`);
    return { remainingDeposits: [], remainingAmount: 0 };
  } else {
    // If no issues, return standard FIFO result
    return simulateFifoWithdrawals(deposits, withdrawals);
  }
}

// Run the audit
auditStakingCalculations();
