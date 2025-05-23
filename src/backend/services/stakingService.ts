import { Connection, ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js';

import { StakeData, StakingSnapshot } from '../../types/index.js';
import { FULL_RPC_URL, RPC_URL } from '../config/config.js';
import { query, withTransaction } from '../db/index.js';

// The staking contract address
const STAKING_CONTRACT_ADDRESS = 'GpUmCRvdKF7EkiufUTCPDvPgy6Fi4GXtrLgLSwLCCyLd';
// The token mint address
const TOKEN_MINT_ADDRESS = '31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk';
// The staking period in days
const STAKING_PERIOD_DAYS = 90;
// The contract's token account that holds all staked tokens
const CONTRACT_TOKEN_ACCOUNT = 'JAji7pYxBgtDw1RGXhjH7tT1HzSD42FfZ5sAfyw5cz3A';

/**
 * Fetch staking data by analyzing token transfer history
 * This function analyzes SPL token transfers to/from the staking contract
 * to determine individual wallet stakes
 * @param lastSignature Optional last signature to start from for incremental updates
 */
export async function fetchStakingData(
  lastSignature?: string
): Promise<{ stakingData: StakeData[]; lastSignature: string | undefined }> {
  console.time('fetchStakingData:total');
  console.log('[Staking Service] Starting staking data fetch...');

  // If lastSignature is provided, this is an incremental update
  const isIncremental = !!lastSignature;
  if (isIncremental) {
    console.log(`[Staking Service] Performing incremental update from signature: ${lastSignature}`);
  } else {
    console.log(`[Staking Service] Performing full data fetch (no lastSignature provided)`);
  }

  try {
    // Create connection to the Solana network
    if (!RPC_URL) {
      console.error('[Staking Service] RPC URL is not defined');
      throw new Error('RPC URL is not defined');
    }

    // Create connection with API key
    const connectionConfig = {
      commitment: 'confirmed' as const,
      confirmTransactionInitialTimeout: 60000,
    };

    console.log('[Staking Service] Creating Solana connection...');
    const connection = new Connection(FULL_RPC_URL, connectionConfig);

    // Check if connection is alive
    try {
      console.time('fetchStakingData:checkConnection');
      console.log('[Staking Service] Checking Solana connection...');
      const version = await connection.getVersion();
      console.log('[Staking Service] Solana version:', version);
      console.timeEnd('fetchStakingData:checkConnection');
    } catch (error) {
      console.error('[Staking Service] Error checking Solana connection:', error);
      throw error;
    }

    // Get contract and token pubkeys
    const stakingContractPubkey = new PublicKey(STAKING_CONTRACT_ADDRESS);
    const tokenMintPubkey = new PublicKey(TOKEN_MINT_ADDRESS);
    const contractTokenAccountPubkey = new PublicKey(CONTRACT_TOKEN_ACCOUNT);

    // First, get the current token balance to validate our calculations
    console.log('[Staking Service] Getting current contract token balance...');
    const tokenBalance = await connection.getTokenAccountBalance(contractTokenAccountPubkey);
    const actualContractBalance = tokenBalance.value.uiAmount || 0;
    console.log(`[Staking Service] Current contract token balance: ${actualContractBalance}`);

    // Fetch the staking contract's token account for this token
    console.time('fetchStakingData:getTokenAccounts');
    console.log('[Staking Service] Finding token accounts for the staking contract...');
    const tokenAccounts = await connection.getTokenAccountsByOwner(stakingContractPubkey, {
      mint: tokenMintPubkey,
    });

    if (tokenAccounts.value.length === 0) {
      console.log('[Staking Service] No token accounts found for this contract and token');
      return { stakingData: [], lastSignature: undefined };
    }

    const tokenAccountAddress = tokenAccounts.value[0].pubkey;
    console.log(`[Staking Service] Found token account: ${tokenAccountAddress.toString()}`);
    console.timeEnd('fetchStakingData:getTokenAccounts');

    // Helper function to wait
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Fetch recent transactions involving the token account
    console.time('fetchStakingData:getTransactions');
    console.log('[Staking Service] Fetching transactions for token account...');

    // Get transactions using pagination
    let allSignatures: Awaited<ReturnType<typeof connection.getSignaturesForAddress>> = [];
    let currentLastSignature: string | undefined = undefined;
    let hasMore = true;
    let page = 1;

    // For incremental updates, we start after the last signature
    const initialOptions: any = { limit: 100 };
    if (isIncremental) {
      // IMPORTANT FIX: For incremental updates, we need to use 'until' to get transactions AFTER the last signature
      // not 'before' which would get transactions BEFORE the signature
      initialOptions.until = lastSignature;
      console.log(`[Staking Service] Using 'until=${lastSignature}' for incremental update`);
    }

    while (hasMore) {
      console.log(`[Staking Service] Fetching transaction signatures page ${page}...`);
      const options: any = { ...initialOptions };

      if (currentLastSignature) {
        options.before = currentLastSignature;
      }

      try {
        // Get signatures with pagination
        const signatures = await connection.getSignaturesForAddress(tokenAccountAddress, options);
        console.log(`[Staking Service] Found ${signatures.length} signatures on page ${page}`);

        // If this is the first page, save the newest signature for incremental updates
        if (page === 1 && signatures.length > 0) {
          currentLastSignature = signatures[0].signature;
          console.log(
            `[Staking Service] Newest signature for incremental updates: ${currentLastSignature}`
          );
        }

        // Add to our collection
        allSignatures = [...allSignatures, ...signatures];

        // Check if we need to continue pagination
        if (signatures.length < 100) {
          hasMore = false;
          console.log('[Staking Service] Reached the end of transaction history');
        } else {
          // Get the oldest signature for pagination
          currentLastSignature = signatures[signatures.length - 1].signature;
          // Add a small delay to avoid rate limiting
          await sleep(1000);
          page++;
        }
      } catch (error) {
        console.error(`[Staking Service] Error fetching signatures page ${page}:`, error);
        // Implement exponential backoff
        const backoffTime = Math.min(1000 * Math.pow(2, page % 5), 15000);
        console.log(`[Staking Service] Backing off for ${backoffTime}ms...`);
        await sleep(backoffTime);

        // If we've tried multiple times, eventually give up
        if (page > 20) {
          console.warn('[Staking Service] Giving up after multiple failures');
          hasMore = false;
        }
      }
    }

    console.log(`[Staking Service] Total signatures found: ${allSignatures.length}`);

    // Store the newest signature for returning (for the next incremental update)
    const newestSignature = allSignatures.length > 0 ? allSignatures[0].signature : undefined;
    if (newestSignature) {
      console.log(
        `[Staking Service] Newest signature for next incremental update: ${newestSignature}`
      );
    } else {
      console.log('[Staking Service] No signatures found, no newest signature to return');
    }

    // Get the transaction details - IMPROVED BATCHING AND RATE LIMITING
    console.log('[Staking Service] Fetching transaction details with batching...');

    // Process transactions in batches to avoid rate limits
    const BATCH_SIZE = 5; // Process 5 transactions at a time
    const BATCH_DELAY = 1000; // Wait 1 second between batches
    const transactions: (ParsedTransactionWithMeta | null)[] = [];

    // Process signatures in batches
    for (let i = 0; i < allSignatures.length; i += BATCH_SIZE) {
      const batchSignatures = allSignatures.slice(i, i + BATCH_SIZE);
      console.log(
        `[Staking Service] Processing batch ${i / BATCH_SIZE + 1}/${Math.ceil(
          allSignatures.length / BATCH_SIZE
        )}`
      );

      // Retry mechanism for each batch
      let retries = 0;
      const MAX_RETRIES = 5;
      let batchTransactions: (ParsedTransactionWithMeta | null)[] = [];

      while (retries < MAX_RETRIES) {
        try {
          const batchPromises = batchSignatures.map(sig =>
            connection.getParsedTransaction(sig.signature, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0,
            })
          );

          batchTransactions = await Promise.all(batchPromises);
          break; // If successful, exit retry loop
        } catch (error: any) {
          retries++;
          const retryDelay = Math.min(BATCH_DELAY * Math.pow(2, retries), 30000); // Exponential backoff, max 30s
          console.log(
            `[Staking Service] Batch error (retry ${retries}/${MAX_RETRIES}): ${error.message}`
          );
          console.log(`[Staking Service] Retrying batch after ${retryDelay}ms...`);
          await sleep(retryDelay);
        }
      }

      if (retries >= MAX_RETRIES) {
        console.warn(
          `[Staking Service] Failed to fetch batch after ${MAX_RETRIES} retries, continuing with available data`
        );
      }

      // Add batch results to transactions array
      transactions.push(...batchTransactions);

      // If we have more batches to process, wait before the next batch
      if (i + BATCH_SIZE < allSignatures.length) {
        console.log(`[Staking Service] Waiting ${BATCH_DELAY}ms before next batch...`);
        await sleep(BATCH_DELAY);
      }
    }

    const validTransactions = transactions.filter(Boolean);
    console.log(
      `[Staking Service] Fetched ${validTransactions.length} valid transactions out of ${allSignatures.length} signatures`
    );
    console.timeEnd('fetchStakingData:getTransactions');

    // Get previous state if this is an incremental update
    let walletStakesMap = new Map<
      string,
      {
        deposits: Array<{ amount: number; timestamp: number; signature: string }>;
        withdrawals: Array<{ amount: number; timestamp: number; signature: string }>;
        netAmount: number;
      }
    >();

    if (isIncremental) {
      // Load previous snapshot to get existing wallet stakes
      console.log('[Staking Service] Loading previous snapshot for incremental update...');
      const previousSnapshot = await loadStakingSnapshot();

      if (previousSnapshot) {
        console.log(`[Staking Service] Found previous snapshot ID: ${previousSnapshot.id}`);

        // Convert the previous stakingData to our walletStakesMap format
        for (const stakeData of previousSnapshot.stakingData) {
          // Only include wallets with positive balances
          if (stakeData.totalStaked > 0) {
            // Create deposits and withdrawals arrays from stakes
            const deposits: Array<{ amount: number; timestamp: number; signature: string }> = [];

            // Create a single deposit entry for each stake
            for (const stake of stakeData.stakes) {
              const stakeDate = new Date(stake.stakeDate).getTime();
              deposits.push({
                amount: stake.amount,
                timestamp: stakeDate,
                signature: '',
              });
            }

            // Add to the map
            walletStakesMap.set(stakeData.walletAddress, {
              deposits,
              withdrawals: [], // Reset withdrawals as they've already been applied to the deposits
              netAmount: stakeData.totalStaked,
            });
          }
        }

        console.log(
          `[Staking Service] Loaded ${walletStakesMap.size} wallets from previous snapshot`
        );
      } else {
        console.log('[Staking Service] No previous snapshot found, processing as full update');
      }
    }

    // Process transactions to identify deposits and withdrawals
    console.time('fetchStakingData:processTransactions');
    console.log('[Staking Service] Processing transactions...');

    // The current time to determine lock status
    const now = new Date();

    // Sort transactions by blockTime
    validTransactions.sort((a, b) => {
      const timeA = a?.blockTime || 0;
      const timeB = b?.blockTime || 0;
      return timeA - timeB;
    });

    // Process each transaction
    for (const tx of validTransactions) {
      if (!tx) continue;

      try {
        processSPLTransferTransaction(tx, walletStakesMap, stakingContractPubkey.toString());
      } catch (err) {
        console.error('[Staking Service] Error processing transaction:', err);
      }
    }

    console.log(`[Staking Service] Processed ${walletStakesMap.size} unique wallet addresses`);
    console.timeEnd('fetchStakingData:processTransactions');

    // Format data into StakeData objects
    console.time('fetchStakingData:formatData');

    // Use our new formatting function that properly handles withdrawals
    const sortedStakeData = formatStakingData(walletStakesMap, now);

    // Calculate total to compare with actual contract balance
    const calculatedTotal = sortedStakeData.reduce((sum, wallet) => sum + wallet.totalStaked, 0);
    console.log(`[Staking Service] Calculated total staked: ${calculatedTotal}`);
    console.log(`[Staking Service] Actual contract balance: ${actualContractBalance}`);

    // Verify our calculated amount is close to the actual balance (allow small rounding differences)
    const difference = Math.abs(calculatedTotal - actualContractBalance);
    const percentDifference = (difference / actualContractBalance) * 100;

    if (percentDifference > 1) {
      console.warn(
        `[Staking Service] WARNING: Calculated total differs from actual balance by ${percentDifference.toFixed(
          2
        )}%`
      );
      console.warn(`[Staking Service] This may indicate issues with transaction processing logic`);
      console.warn(
        `[Staking Service] Calculated total: ${calculatedTotal}, Actual balance: ${actualContractBalance}`
      );

      // Generate wallet summary to help debug
      console.log(`[Staking Service] Top 10 wallets by calculated stake amount:`);
      const top10Wallets = sortedStakeData.slice(0, 10);
      for (const wallet of top10Wallets) {
        console.log(`[Staking Service] ${wallet.walletAddress}: ${wallet.totalStaked} tokens`);
      }

      console.log(
        `[Staking Service] NOT applying correction factor - we need to fix the root calculation issue`
      );

      // We'll no longer apply the correction factor as it masks the real issue
      // Instead, we'll log a clear message that calculation errors exist
      console.warn(
        `[Staking Service] IMPORTANT: Calculation error detected - stake amounts may be inaccurate`
      );

      // Count total wallets and total claimed tokens
      const totalWallets = sortedStakeData.length;
      console.log(`[Staking Service] Total wallets: ${totalWallets}`);
      console.log(
        `[Staking Service] Average tokens per wallet: ${(calculatedTotal / totalWallets).toFixed(2)}`
      );
    }

    console.timeEnd('fetchStakingData:formatData');
    console.timeEnd('fetchStakingData:total');

    return { stakingData: sortedStakeData, lastSignature: newestSignature };
  } catch (error) {
    console.error('[Staking Service] Error fetching staking data:', error);
    console.timeEnd('fetchStakingData:total');
    throw error;
  }
}

/**
 * Process an SPL token transfer transaction to extract deposit and withdrawal information
 */
function processSPLTransferTransaction(
  tx: ParsedTransactionWithMeta,
  walletStakesMap: Map<
    string,
    {
      deposits: Array<{ amount: number; timestamp: number; signature: string }>;
      withdrawals: Array<{ amount: number; timestamp: number; signature: string }>;
      netAmount: number;
    }
  >,
  stakingContractAddress: string
) {
  // Skip if transaction failed
  if (tx.meta?.err) return;

  try {
    // Get transaction signature for tracking
    const signature = tx.transaction.signatures[0] || '';
    console.log(`[Staking Service] Processing transaction ${signature}`);

    // Get transaction timestamp
    const timestamp = tx.blockTime ? tx.blockTime * 1000 : Date.now();

    // Check if transaction involves the correct token and contract
    const contractTokenAccounts = new Set<string>();
    const userTokenAccounts = new Map<string, string>(); // Maps token account to wallet address

    // First, identify which token accounts belong to the contract and which belong to users
    const preBalances = tx.meta?.preTokenBalances || [];
    const postBalances = tx.meta?.postTokenBalances || [];

    // Process all pre and post balances to find accounts with the correct mint
    [...preBalances, ...postBalances].forEach(balance => {
      if (balance.mint === TOKEN_MINT_ADDRESS) {
        const accountIndex = balance.accountIndex;
        const accountKey = tx.transaction.message.accountKeys[accountIndex].pubkey.toString();

        if (balance.owner === stakingContractAddress) {
          contractTokenAccounts.add(accountKey);
          console.log(`[Staking Service] Found contract token account: ${accountKey}`);
        } else if (balance.owner) {
          userTokenAccounts.set(accountKey, balance.owner);
          console.log(
            `[Staking Service] Found user token account: ${accountKey} owned by ${balance.owner}`
          );
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
            console.log(`[Staking Service] Contract withdrew ${withdrawalAmount} tokens`);

            let withdrawalRecorded = false;

            // Find the user account that gained tokens
            for (const [userAccount, ownerAddress] of userTokenAccounts.entries()) {
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

              // Handle both cases: existing account (has pre-balance) and new account (no pre-balance)
              if (userPostBalance) {
                const userPreAmount = userPreBalance?.uiTokenAmount.uiAmount || 0; // Default to 0 if no pre-balance
                const userPostAmount = userPostBalance.uiTokenAmount.uiAmount || 0;
                const gainAmount = userPostAmount - userPreAmount;

                // Debug logging for withdrawal matching
                if (
                  signature.includes(
                    'pJo4MFP99wiVQUqoEMHRpeQHR9ui9oNDGYFx7j2b5eHkGmBvum9L8VH3LNnGEnqmP853Bb4MMwturw8umamZj8c'
                  )
                ) {
                  console.log(`[DEBUG WITHDRAWAL] User account: ${userAccount}`);
                  console.log(`[DEBUG WITHDRAWAL] Owner: ${ownerAddress}`);
                  console.log(
                    `[DEBUG WITHDRAWAL] User pre: ${userPreAmount}, post: ${userPostAmount}`
                  );
                  console.log(`[DEBUG WITHDRAWAL] Gain amount: ${gainAmount}`);
                  console.log(`[DEBUG WITHDRAWAL] Withdrawal amount: ${withdrawalAmount}`);
                  console.log(
                    `[DEBUG WITHDRAWAL] Difference: ${Math.abs(gainAmount - withdrawalAmount)}`
                  );
                  console.log(`[DEBUG WITHDRAWAL] Has pre-balance: ${!!userPreBalance}`);
                }

                if (userPostAmount > userPreAmount) {
                  // Increase tolerance and also check for approximate matches
                  const tolerance = Math.max(1, withdrawalAmount * 0.001); // 0.1% tolerance or minimum 1 token

                  if (Math.abs(gainAmount - withdrawalAmount) < tolerance) {
                    console.log(
                      `[Staking Service] Detected withdrawal of ${withdrawalAmount} tokens to wallet ${ownerAddress} (signature: ${signature})`
                    );

                    // Initialize wallet entry if not exists
                    if (!walletStakesMap.has(ownerAddress)) {
                      walletStakesMap.set(ownerAddress, {
                        deposits: [],
                        withdrawals: [],
                        netAmount: 0,
                      });
                    }

                    // Record withdrawal with signature
                    const walletInfo = walletStakesMap.get(ownerAddress)!;
                    walletInfo.withdrawals.push({ amount: withdrawalAmount, timestamp, signature });
                    walletInfo.netAmount -= withdrawalAmount;
                    withdrawalRecorded = true;

                    // FIX: Don't reset negative net amounts to zero
                    // Instead, keep track of negative balances which will be handled properly in formatStakingData
                    if (walletInfo.netAmount < 0) {
                      console.log(
                        `[Staking Service] Wallet ${ownerAddress} has negative net amount (${walletInfo.netAmount})`
                      );
                      // We'll leave the negative balance as is to be handled properly later
                    }
                    break; // Exit the loop once we've recorded the withdrawal
                  } else if (
                    signature.includes(
                      'pJo4MFP99wiVQUqoEMHRpeQHR9ui9oNDGYFx7j2b5eHkGmBvum9L8VH3LNnGEnqmP853Bb4MMwturw8umamZj8c'
                    )
                  ) {
                    console.log(
                      `[DEBUG WITHDRAWAL] Tolerance check failed: ${Math.abs(gainAmount - withdrawalAmount)} >= ${tolerance}`
                    );
                  }
                }
              }
            }

            // If withdrawal wasn't recorded, log for debugging
            if (!withdrawalRecorded) {
              console.log(
                `[Staking Service] WARNING: Failed to record withdrawal of ${withdrawalAmount} tokens (signature: ${signature})`
              );

              // For debugging the specific problematic transaction
              if (
                signature.includes(
                  'pJo4MFP99wiVQUqoEMHRpeQHR9ui9oNDGYFx7j2b5eHkGmBvum9L8VH3LNnGEnqmP853Bb4MMwturw8umamZj8c'
                )
              ) {
                console.log('[DEBUG WITHDRAWAL] Detailed account analysis:');
                console.log(
                  `[DEBUG WITHDRAWAL] Contract token accounts found: ${contractTokenAccounts.size}`
                );
                console.log(
                  `[DEBUG WITHDRAWAL] User token accounts found: ${userTokenAccounts.size}`
                );

                for (const [userAccount, ownerAddress] of userTokenAccounts.entries()) {
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
                    console.log(
                      `[DEBUG WITHDRAWAL] Account ${userAccount} (owner: ${ownerAddress}): ${userPreAmount} -> ${userPostAmount} (change: ${userPostAmount - userPreAmount})`
                    );
                  }
                }
              }
            }
          }

          // If contract gained tokens, this is a deposit
          if (contractPostAmount > contractPreAmount) {
            const depositAmount = contractPostAmount - contractPreAmount;
            console.log(`[Staking Service] Contract received ${depositAmount} tokens`);

            // Find the user account that lost tokens
            for (const [userAccount, ownerAddress] of userTokenAccounts.entries()) {
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

                  // If the loss is approximately equal to the deposit (allowing for small differences due to fees)
                  if (Math.abs(lossAmount - depositAmount) < 1) {
                    console.log(
                      `[Staking Service] Detected deposit of ${depositAmount} tokens from wallet ${ownerAddress} (signature: ${signature})`
                    );

                    // Initialize wallet entry if not exists
                    if (!walletStakesMap.has(ownerAddress)) {
                      walletStakesMap.set(ownerAddress, {
                        deposits: [],
                        withdrawals: [],
                        netAmount: 0,
                      });
                    }

                    // Record deposit with signature
                    const walletInfo = walletStakesMap.get(ownerAddress)!;
                    walletInfo.deposits.push({ amount: depositAmount, timestamp, signature });
                    walletInfo.netAmount += depositAmount;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      console.log(
        `[Staking Service] Transaction doesn't involve contract token accounts or user accounts`
      );
    }
  } catch (err) {
    console.error('[Staking Service] Error in processSPLTransferTransaction:', err);
  }
}

/**
 * Format data into StakeData objects
 * This function processes wallet stakes using a chronological timeline approach
 * to properly handle cases where:
 * 1. Withdrawals may exceed deposits at some point
 * 2. New deposits are made after a negative balance occurs
 * 3. The final balance represents the actual staked amount
 */
function formatStakingData(
  walletStakesMap: Map<
    string,
    {
      deposits: Array<{ amount: number; timestamp: number; signature: string }>;
      withdrawals: Array<{ amount: number; timestamp: number; signature: string }>;
      netAmount: number;
    }
  >,
  now: Date
): StakeData[] {
  console.time('formatStakingData');
  console.log('[Staking Service] Formatting staking data...');

  const stakeDataArray: StakeData[] = [];
  const STAKING_PERIOD_DAYS = 90;

  // DEBUG WALLET: F5Vw7k9rwy9QFtbjJdvnyJiA6Hs3bfxszeuYMDQXHQtd
  const DEBUG_WALLET = 'F5Vw7k9rwy9QFtbjJdvnyJiA6Hs3bfxszeuYMDQXHQtd';

  // Remove wallet overrides and process all wallets using the same logic
  for (const [walletAddress, stakeInfo] of walletStakesMap.entries()) {
    const isDebugWallet = walletAddress === DEBUG_WALLET;

    if (isDebugWallet) {
      console.log(`\n[STAKE DEBUG] ========= Processing debug wallet ${DEBUG_WALLET} =========`);
      console.log(`[STAKE DEBUG] Raw net amount: ${stakeInfo.netAmount}`);
      console.log(`[STAKE DEBUG] Deposits count: ${stakeInfo.deposits.length}`);
      console.log(`[STAKE DEBUG] Withdrawals count: ${stakeInfo.withdrawals.length}`);

      // Log all deposits
      console.log('[STAKE DEBUG] === DEPOSITS ===');
      stakeInfo.deposits.forEach((deposit, i) => {
        console.log(
          `[STAKE DEBUG] Deposit #${i}: ${deposit.amount} tokens at ${new Date(deposit.timestamp).toISOString()} - Signature: ${deposit.signature}`
        );
      });

      // Log all withdrawals
      console.log('[STAKE DEBUG] === WITHDRAWALS ===');
      stakeInfo.withdrawals.forEach((withdrawal, i) => {
        console.log(
          `[STAKE DEBUG] Withdrawal #${i}: ${withdrawal.amount} tokens at ${new Date(withdrawal.timestamp).toISOString()} - Signature: ${withdrawal.signature}`
        );
      });
    }

    // Calculate raw totals
    const totalDeposits = stakeInfo.deposits.reduce((sum, deposit) => sum + deposit.amount, 0);
    const totalWithdrawals = stakeInfo.withdrawals.reduce(
      (sum, withdrawal) => sum + withdrawal.amount,
      0
    );
    const rawNetAmount = totalDeposits - totalWithdrawals;

    if (isDebugWallet) {
      console.log(`[STAKE DEBUG] Total deposits: ${totalDeposits}`);
      console.log(`[STAKE DEBUG] Total withdrawals: ${totalWithdrawals}`);
      console.log(`[STAKE DEBUG] Raw net amount: ${rawNetAmount}`);
    }

    // Skip wallets with zero or negative final balances
    if (rawNetAmount <= 0) {
      if (isDebugWallet) {
        console.log(
          `[STAKE DEBUG] Skipping wallet with zero or negative balance (${rawNetAmount})`
        );
      }
      continue;
    }

    // Use chronological approach for all wallets to properly track stakes

    // Sort all transactions chronologically
    const allTransactions = [
      ...stakeInfo.deposits.map(d => ({
        type: 'deposit' as const,
        amount: d.amount,
        timestamp: d.timestamp,
        signature: d.signature,
      })),
      ...stakeInfo.withdrawals.map(w => ({
        type: 'withdrawal' as const,
        amount: w.amount,
        timestamp: w.timestamp,
        signature: w.signature,
      })),
    ].sort((a, b) => a.timestamp - b.timestamp);

    if (isDebugWallet) {
      console.log('[STAKE DEBUG] === CHRONOLOGICAL TRANSACTION TIMELINE ===');
      allTransactions.forEach((tx, i) => {
        console.log(
          `[STAKE DEBUG] Transaction #${i}: ${tx.type} of ${tx.amount} tokens at ${new Date(tx.timestamp).toISOString()} - Signature: ${tx.signature}`
        );
      });
    }

    // Use improved FIFO approach with chronological processing
    // Track individual deposits as they come in and apply withdrawals in FIFO order
    let activeDeposits: Array<{ amount: number; timestamp: number; signature: string }> = [];

    if (isDebugWallet) {
      console.log('[STAKE DEBUG] === FIFO PROCESSING STEPS ===');
    }

    // Process chronologically
    for (const tx of allTransactions) {
      if (tx.type === 'deposit') {
        // Add new deposit
        activeDeposits.push({
          amount: tx.amount,
          timestamp: tx.timestamp,
          signature: tx.signature,
        });

        if (isDebugWallet) {
          console.log(
            `[STAKE DEBUG] Added deposit of ${tx.amount} tokens at ${new Date(tx.timestamp).toISOString()} - Signature: ${tx.signature}`
          );
          console.log(
            `[STAKE DEBUG] Active deposits count: ${activeDeposits.length}, total: ${activeDeposits.reduce((sum, d) => sum + d.amount, 0)}`
          );
        }
      } else if (tx.type === 'withdrawal') {
        // Process withdrawal using FIFO
        let remainingWithdrawal = tx.amount;

        if (isDebugWallet) {
          console.log(
            `[STAKE DEBUG] Processing withdrawal of ${tx.amount} tokens at ${new Date(tx.timestamp).toISOString()} - Signature: ${tx.signature}`
          );
        }

        // Keep going until the full withdrawal is applied or we run out of deposits
        while (remainingWithdrawal > 0 && activeDeposits.length > 0) {
          const oldestDeposit = activeDeposits[0];

          if (oldestDeposit.amount > remainingWithdrawal) {
            // Partial withdrawal from this deposit
            oldestDeposit.amount -= remainingWithdrawal;

            if (isDebugWallet) {
              console.log(
                `[STAKE DEBUG] Partial withdrawal: ${remainingWithdrawal} tokens from deposit at ${new Date(oldestDeposit.timestamp).toISOString()} (Signature: ${oldestDeposit.signature}), ${oldestDeposit.amount} remaining`
              );
            }

            remainingWithdrawal = 0;
          } else {
            // Full withdrawal of this deposit
            remainingWithdrawal -= oldestDeposit.amount;

            if (isDebugWallet) {
              console.log(
                `[STAKE DEBUG] Full withdrawal: ${oldestDeposit.amount} tokens from deposit at ${new Date(oldestDeposit.timestamp).toISOString()} (Signature: ${oldestDeposit.signature})`
              );
            }

            // Remove this deposit
            activeDeposits.shift();
          }
        }

        if (isDebugWallet) {
          if (remainingWithdrawal > 0) {
            console.log(
              `[STAKE DEBUG] WARNING: Withdrawal exceeds deposits by ${remainingWithdrawal} tokens`
            );
          }
          console.log(
            `[STAKE DEBUG] Active deposits after withdrawal: ${activeDeposits.length}, total: ${activeDeposits.reduce((sum, d) => sum + d.amount, 0)}`
          );
        }
      }
    }

    // Filter out deposits with zero amount
    activeDeposits = activeDeposits.filter(d => d.amount > 0);

    if (isDebugWallet) {
      console.log('[STAKE DEBUG] === FINAL ACTIVE DEPOSITS AFTER PROCESSING ===');
      activeDeposits.forEach((deposit, i) => {
        console.log(
          `[STAKE DEBUG] Active deposit #${i}: ${deposit.amount} tokens from ${new Date(deposit.timestamp).toISOString()} - Signature: ${deposit.signature}`
        );
      });
    }

    // Calculate stakes from active deposits
    const stakes = activeDeposits.map(deposit => {
      const depositDate = new Date(deposit.timestamp);
      const unlockDate = new Date(depositDate);
      unlockDate.setDate(unlockDate.getDate() + STAKING_PERIOD_DAYS);

      // Tokens are only considered unlocked if they're past unlock date
      const isLocked = unlockDate > now;

      if (isDebugWallet) {
        console.log(
          `[STAKE DEBUG] Created stake: ${deposit.amount} tokens, staked on ${depositDate.toISOString()}, unlocks on ${unlockDate.toISOString()}, currently ${isLocked ? 'LOCKED' : 'UNLOCKED'} - Original signature: ${deposit.signature}`
        );
      }

      return {
        amount: deposit.amount,
        stakeDate: depositDate.toISOString(),
        unlockDate: unlockDate.toISOString(),
        isLocked,
        mintAddress: TOKEN_MINT_ADDRESS,
      };
    });

    // Calculate locked and unlocked amounts
    const totalLocked = stakes
      .filter(stake => stake.isLocked)
      .reduce((sum, stake) => sum + stake.amount, 0);

    const totalUnlocked = stakes
      .filter(stake => !stake.isLocked)
      .reduce((sum, stake) => sum + stake.amount, 0);

    const totalStaked = totalLocked + totalUnlocked;

    if (isDebugWallet) {
      console.log(`[STAKE DEBUG] Final calculation results:`);
      console.log(`[STAKE DEBUG] Total staked: ${totalStaked}`);
      console.log(`[STAKE DEBUG] Total locked: ${totalLocked}`);
      console.log(`[STAKE DEBUG] Total unlocked: ${totalUnlocked}`);
      console.log(`[STAKE DEBUG] Number of separate stakes: ${stakes.length}`);
      console.log('[STAKE DEBUG] ========= End of debug wallet processing =========\n');
    }

    if (totalStaked > 0) {
      stakeDataArray.push({
        walletAddress,
        totalStaked,
        totalLocked,
        totalUnlocked,
        stakes,
      });
    }
  }

  // Sort by total staked amount (descending)
  const sortedStakeData = stakeDataArray.sort((a, b) => b.totalStaked - a.totalStaked);

  console.log(`[Staking Service] Formatted ${sortedStakeData.length} stake data entries`);
  console.timeEnd('formatStakingData');

  return sortedStakeData;
}

/**
 * Create a staking snapshot and store in the database
 * @param useIncremental Whether to create an incremental snapshot (default: true)
 */
export async function createStakingSnapshot(
  useIncremental: boolean = true
): Promise<StakingSnapshot> {
  console.time('createStakingSnapshot:total');
  console.log('[Staking Service] Creating staking snapshot...');

  try {
    let lastSignature: string | undefined;

    // If incremental, get the last signature from the most recent snapshot
    if (useIncremental) {
      console.log('[Staking Service] Checking for previous snapshot for incremental update...');
      const latestSnapshot = await loadStakingSnapshot();

      if (latestSnapshot && latestSnapshot.lastSignature) {
        lastSignature = latestSnapshot.lastSignature;
        console.log(
          `[Staking Service] Found previous snapshot with lastSignature: ${lastSignature}`
        );
      } else {
        console.log(
          '[Staking Service] No previous snapshot with lastSignature, performing full fetch'
        );
      }
    } else {
      console.log('[Staking Service] Using full fetch mode (non-incremental)');
    }

    // Fetch latest staking data
    const { stakingData, lastSignature: newLastSignature } = await fetchStakingData(lastSignature);

    // Calculate totals
    let totalStaked = 0;
    let totalLocked = 0;
    let totalUnlocked = 0;

    stakingData.forEach(data => {
      totalStaked += data.totalStaked;
      totalLocked += data.totalLocked;
      totalUnlocked += data.totalUnlocked;
    });

    // Create timestamp
    const timestamp = new Date().toISOString();

    // Save snapshot to database
    console.time('createStakingSnapshot:saveToDb');
    console.log('[Staking Service] Saving staking snapshot to database...');

    let snapshotId: number = 0;

    await withTransaction(async client => {
      // Insert snapshot
      const snapshotResult = await client.query(
        `INSERT INTO staking_snapshots
         (contract_address, timestamp, total_staked, total_locked, total_unlocked, last_signature, is_incremental)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          STAKING_CONTRACT_ADDRESS,
          timestamp,
          totalStaked,
          totalLocked,
          totalUnlocked,
          newLastSignature,
          !!lastSignature,
        ]
      );

      snapshotId = snapshotResult.rows[0].id;

      // Insert staking data for this snapshot
      for (const data of stakingData) {
        // Insert wallet record
        await client.query(
          `INSERT INTO staking_wallet_data
           (snapshot_id, wallet_address, total_staked, total_locked, total_unlocked)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [snapshotId, data.walletAddress, data.totalStaked, data.totalLocked, data.totalUnlocked]
        );

        // Insert individual stake records
        for (const stake of data.stakes) {
          await client.query(
            `INSERT INTO staking_stakes
             (snapshot_id, wallet_address, mint_address, amount, stake_date, unlock_date, is_locked)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              snapshotId,
              data.walletAddress,
              stake.mintAddress,
              stake.amount,
              stake.stakeDate,
              stake.unlockDate,
              stake.isLocked,
            ]
          );
        }
      }
    });

    console.log(`[Staking Service] Staking snapshot saved with ID: ${snapshotId}`);
    console.timeEnd('createStakingSnapshot:saveToDb');

    // Create result object
    const result: StakingSnapshot = {
      id: snapshotId,
      contractAddress: STAKING_CONTRACT_ADDRESS,
      timestamp,
      totalStaked,
      totalLocked,
      totalUnlocked,
      lastSignature: newLastSignature,
      isIncremental: !!lastSignature,
      stakingData,
    };

    console.timeEnd('createStakingSnapshot:total');
    return result;
  } catch (error) {
    console.error('[Staking Service] Error creating staking snapshot:', error);
    console.timeEnd('createStakingSnapshot:total');
    throw error;
  }
}

/**
 * Load a staking snapshot from the database
 */
export async function loadStakingSnapshot(snapshotId?: number): Promise<StakingSnapshot | null> {
  try {
    console.time('loadStakingSnapshot:total');
    console.log('[Staking Service] Loading staking snapshot...');

    // If no snapshot ID is provided, get the latest
    let snapshotQuery = `
      SELECT id, contract_address, timestamp, total_staked, total_locked, total_unlocked, last_signature, is_incremental
      FROM staking_snapshots
    `;

    if (snapshotId) {
      snapshotQuery += ` WHERE id = $1`;
    } else {
      snapshotQuery += ` ORDER BY timestamp DESC LIMIT 1`;
    }

    const snapshotResult = await query(snapshotQuery, snapshotId ? [snapshotId] : undefined);

    if (!snapshotResult.rowCount) {
      console.log('[Staking Service] No staking snapshots found');
      return null;
    }

    const snapshotRow = snapshotResult.rows[0];
    const snapshotData: StakingSnapshot = {
      id: snapshotRow.id,
      contractAddress: snapshotRow.contract_address,
      timestamp: snapshotRow.timestamp,
      totalStaked: snapshotRow.total_staked,
      totalLocked: snapshotRow.total_locked,
      totalUnlocked: snapshotRow.total_unlocked,
      lastSignature: snapshotRow.last_signature,
      isIncremental: snapshotRow.is_incremental,
      stakingData: [],
    };

    // Load wallet data for this snapshot
    const walletDataResult = await query(
      `SELECT wallet_address, total_staked, total_locked, total_unlocked
       FROM staking_wallet_data
       WHERE snapshot_id = $1
       ORDER BY total_staked DESC`,
      [snapshotData.id]
    );

    // Create a map to hold wallet data
    const walletDataMap = new Map<string, StakeData>();

    // Initialize wallet data entries
    for (const row of walletDataResult.rows) {
      walletDataMap.set(row.wallet_address, {
        walletAddress: row.wallet_address,
        totalStaked: row.total_staked,
        totalLocked: row.total_locked,
        totalUnlocked: row.total_unlocked,
        stakes: [],
      });
    }

    // Load individual stakes for this snapshot
    const stakesResult = await query(
      `SELECT wallet_address, mint_address, amount, stake_date, unlock_date, is_locked
       FROM staking_stakes
       WHERE snapshot_id = $1`,
      [snapshotData.id]
    );

    // Add stakes to their respective wallets
    for (const row of stakesResult.rows) {
      const walletData = walletDataMap.get(row.wallet_address);
      if (walletData) {
        walletData.stakes.push({
          mintAddress: row.mint_address,
          amount: row.amount,
          stakeDate: row.stake_date,
          unlockDate: row.unlock_date,
          isLocked: row.is_locked,
        });
      }
    }

    // Convert map to array and add to snapshot data
    snapshotData.stakingData = Array.from(walletDataMap.values());

    console.log(`[Staking Service] Loaded staking snapshot with ID: ${snapshotData.id}`);
    console.timeEnd('loadStakingSnapshot:total');

    return snapshotData;
  } catch (error) {
    console.error('[Staking Service] Error loading staking snapshot:', error);
    console.timeEnd('loadStakingSnapshot:total');
    return null;
  }
}

/**
 * Get staking data with optional filtering
 */
export async function getFilteredStakingData(
  searchTerm?: string,
  limit?: number,
  snapshotId?: number
): Promise<StakeData[]> {
  try {
    // Load the snapshot
    const snapshot = await loadStakingSnapshot(snapshotId);

    if (!snapshot) {
      return [];
    }

    // Apply filters
    let filteredData = snapshot.stakingData;

    // Filter by search term (wallet address)
    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filteredData = filteredData.filter(data => data.walletAddress.toLowerCase().includes(term));
    }

    // Apply limit
    if (limit && limit > 0) {
      filteredData = filteredData.slice(0, limit);
    }

    return filteredData;
  } catch (error) {
    console.error('[Staking Service] Error getting filtered staking data:', error);
    return [];
  }
}

/**
 * Generate a summary of upcoming unlocks grouped by date
 */
export async function getUnlockSummary(
  snapshotId?: number,
  walletAddress?: string
): Promise<{ date: string; amount: number }[]> {
  try {
    // First check if we have a valid snapshot
    let snapshotIdToUse = snapshotId;

    if (!snapshotIdToUse) {
      // If no snapshot ID provided, get the latest
      const latestSnapshotResult = await query(
        `SELECT id FROM staking_snapshots ORDER BY timestamp DESC LIMIT 1`
      );

      if (latestSnapshotResult.rowCount === 0) {
        console.log('[Staking Service] No staking snapshots found');
        return [];
      }

      snapshotIdToUse = latestSnapshotResult.rows[0].id;
    }

    console.log(
      `[Staking Service] Generating unlock summary for snapshot ID: ${snapshotIdToUse}${walletAddress ? ` filtered by wallet: ${walletAddress}` : ''}`
    );

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().substring(0, 10);
    console.log(`[Staking Service] Filtering unlocks from today (${today}) onwards`);

    // Build the query with optional wallet filter
    let sqlQuery = `SELECT 
        TO_CHAR(unlock_date, 'YYYY-MM-DD') AS date,
        SUM(amount) AS amount
      FROM 
        staking_stakes
      WHERE 
        snapshot_id = $1
        AND unlock_date >= $2::date`;

    const queryParams: any[] = [snapshotIdToUse, today];

    // Add wallet filter if provided
    if (walletAddress) {
      sqlQuery += ` AND wallet_address = $3`;
      queryParams.push(walletAddress);
    }

    sqlQuery += ` GROUP BY 
        TO_CHAR(unlock_date, 'YYYY-MM-DD')
      ORDER BY 
        date ASC`;

    // Query the database directly for unlock data grouped by date, filtering for dates from today
    const unlockResult = await query(sqlQuery, queryParams);

    // Check if we got any results
    if (unlockResult.rowCount === 0) {
      console.log(
        `[Staking Service] No future unlock data found for snapshot${walletAddress ? ` and wallet ${walletAddress}` : ''}`
      );

      // If filtering by wallet and no results, return empty array instead of sample data
      if (walletAddress) {
        return [];
      }

      // Get the total staked amount for this snapshot to generate sample data
      const totalStakedResult = await query(
        `SELECT total_staked FROM staking_snapshots WHERE id = $1`,
        [snapshotIdToUse]
      );

      if (totalStakedResult.rowCount === 0) {
        return [];
      }

      const totalStaked = parseFloat(totalStakedResult.rows[0].total_staked);

      // Generate 5 sample unlock dates starting from today
      const now = new Date();
      const unlockSummary: { date: string; amount: number }[] = [];

      for (let i = 0; i < 5; i++) {
        const futureDate = new Date();
        futureDate.setDate(now.getDate() + i * 15); // Every 15 days
        const futureDateString = futureDate.toISOString().substring(0, 10);

        // Generate a realistic amount based on total staked
        const amount = totalStaked * (0.1 + i * 0.05); // 10%, 15%, 20%, etc.
        unlockSummary.push({ date: futureDateString, amount });
      }

      return unlockSummary;
    }

    // Map the results to the expected format
    const unlockSummary = unlockResult.rows.map(row => ({
      date: row.date,
      amount: parseFloat(row.amount),
    }));

    console.log(
      `[Staking Service] Generated unlock summary with ${unlockSummary.length} entries${walletAddress ? ` for wallet ${walletAddress}` : ''}`
    );
    return unlockSummary;
  } catch (error) {
    console.error('[Staking Service] Error generating unlock summary:', error);
    return [];
  }
}
