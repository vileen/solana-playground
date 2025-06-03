import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Connection, ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js';

import {
  LiquidityPoolsAnalysis,
  LiquidityPoolsTransactionAnalysis,
  PoolTokenAnalysis,
  PoolTransactionAnalysis,
  PoolTransfer,
} from '../../types/index.js';
import { ENV } from '../config/env.js';

import { loadSocialProfiles } from './socialProfilesDb.js';

// The specific token we're tracking - $GP token
export const GP_TOKEN_ADDRESS = '31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk';

// Platform-specific pool addresses
export const LIQUIDITY_POOLS = {
  orca: [
    // Temporarily disabled for testing
    // '7YGHXMBpNLcDRLPUJfqzN79WMoh8Qniz52cNuZK6go7b',
    // '9vNKzrrHAjqjuTGLjCBo9Ai4edMYgP9dsG4tFZ2hF251',
    // '9E2AwC5SzfPy3otpmHHVwGNoM2b2SLrJ9M1T5inXrCPE',
    // '5FWEW9avoRGAp9WdVxxshcmshKEfpVBQkgLBnXcNQo36',
    // '7hrpRj8KayPDz4jZwXhEM6HE6eL2D1cSxKnovF7zZ69P',
    // '9CqcxgPYpi32vfMFcFJuicQEHAKRha17D8DXBA8JcZTc',
  ],
  raydium: [
    // Temporarily disabled for testing
    // '4pMNEfcPeQefWbhJHtV8gDYNB55V1EqcyD7Vj5V4Y14t',
    // '2HMbRsq41tb6QSbAggybkyLZyeAXWYfvpqWrQCDmngYt',
  ],
  meteora: [
    // Testing with only the first Meteora pool
    'J9oWwRzBNVoL5WteKRojBVGfvgkXdorswAgWsZVSdKef',
    // Temporarily disabled for testing
    // 'EPGjJMx8votjZqTufbgV2arDiQhUS9rJ53eLaTJD1SoR',
    // '6sZ3ZpZPVypTk6oTmc9YKBxbzGpxEmnMVD4NZLHqzqBJ',
    // 'GSb4APA9YTtZ52oaXj3z4t1UuGN25GiX5soLtcpZZehB',
    // 'AyMw6bwwCadsWGPLT76JgbuHs95rFayTURfbQXtV4Mk6',
    // '9gqqokj7xjr6chwrYa3aDBy6tSdsZR4qiuVrgnxPRBbE',
    // 'CKD1FtBsi37eFS6Tpdc9c6g4DrpMRKFLhpUXEyCNued5',
    // 'Cx3L9KTPdZBHN2USSLmwPY1XSL4RrZ51Mwtv7TKZ6kFc',
    // 'BYT9uZAy6che4zWoVhCyr9DCQfKwTL91h7j7GmYudK7C',
    // '36J8z8kvf5NuVfhXw8u1ykyb5u8Z57ffKsog1EjK2yoe',
  ],
};

/**
 * Retry function with exponential backoff for RPC calls
 */
async function retryRpcCall<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 5,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Check if this is a retryable RPC error
      const isRetryableError =
        error?.cause?.code === 'UND_ERR_SOCKET' ||
        error?.cause?.code === 'UND_ERR_HEADERS_TIMEOUT' ||
        error?.cause?.code === 'ECONNRESET' ||
        error?.code === 'ECONNRESET' ||
        error?.message?.includes('fetch failed') ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('ECONNRESET');

      if (!isRetryableError || attempt === maxRetries) {
        console.error(`[RPC Retry] ${operationName} failed after ${attempt + 1} attempts:`, error);
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
      console.log(
        `[RPC Retry] ${operationName} attempt ${attempt + 1} failed, retrying in ${delay}ms... Error: ${error?.cause?.code || error?.code || 'Unknown'}`
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Analyze $GP tokens in a specific liquidity pool
 */
async function analyzePool(
  connection: Connection,
  poolAddress: string
): Promise<PoolTokenAnalysis> {
  console.log(`[LP Analysis] Analyzing $GP tokens in pool: ${poolAddress}`);

  try {
    // Get all $GP token accounts for this pool
    const tokenAccounts = await retryRpcCall(
      () =>
        connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
          filters: [
            {
              dataSize: 165, // Token account size
            },
            {
              memcmp: {
                offset: 0, // Token mint address offset
                bytes: GP_TOKEN_ADDRESS,
              },
            },
            {
              memcmp: {
                offset: 32, // Owner field offset (should be the pool address)
                bytes: poolAddress,
              },
            },
          ],
        }),
      `getParsedProgramAccounts-${poolAddress}`,
      3, // 3 retries
      1000 // 1 second base delay
    );

    console.log(
      `[LP Analysis] Found ${tokenAccounts.length} $GP token accounts for pool ${poolAddress}`
    );

    const walletDistribution: { [walletAddress: string]: number } = {};
    let totalTokens = 0;

    // Process each $GP token account
    for (const account of tokenAccounts) {
      try {
        const parsedData = account.account.data as any;

        if ('parsed' in parsedData) {
          const tokenAmount = parsedData.parsed.info.tokenAmount.uiAmount || 0;
          const owner = parsedData.parsed.info.owner;
          const mint = parsedData.parsed.info.mint;

          // Double check this is actually our GP token
          if (mint === GP_TOKEN_ADDRESS && tokenAmount > 0 && owner) {
            totalTokens += tokenAmount;
            walletDistribution[owner] = (walletDistribution[owner] || 0) + tokenAmount;
          }
        }
      } catch (error) {
        console.warn(
          `[LP Analysis] Error processing $GP token account for pool ${poolAddress}:`,
          error
        );
      }
    }

    const uniqueWallets = Object.keys(walletDistribution).length;
    console.log(
      `[LP Analysis] Pool ${poolAddress}: ${totalTokens} $GP tokens across ${uniqueWallets} wallets`
    );

    return {
      platform: '', // Will be set by caller
      poolAddress,
      totalTokens,
      uniqueWallets,
      walletDistribution,
    };
  } catch (error) {
    console.error(`[LP Analysis] Error analyzing $GP tokens in pool ${poolAddress}:`, error);
    return {
      platform: '',
      poolAddress,
      totalTokens: 0,
      uniqueWallets: 0,
      walletDistribution: {},
    };
  }
}

/**
 * Analyze all liquidity pools across platforms for $GP tokens
 */
export async function analyzeLiquidityPools(): Promise<LiquidityPoolsAnalysis> {
  console.log('[LP Analysis] Starting $GP liquidity pools analysis...');

  if (!ENV.FULL_RPC_URL) {
    throw new Error('RPC URL is not configured');
  }

  const connection = new Connection(ENV.FULL_RPC_URL, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });

  // Load social profiles for wallet enrichment
  console.log('[LP Analysis] Loading social profiles...');
  const socialProfiles = await loadSocialProfiles();
  console.log(`[LP Analysis] Loaded ${Object.keys(socialProfiles).length} social profiles`);

  const results: LiquidityPoolsAnalysis = {
    orca: [],
    raydium: [],
    meteora: [],
    totalAnalysis: {
      totalTokensAcrossPlatforms: 0,
      totalUniqueWallets: 0,
      platformBreakdown: {},
      topWallets: [],
      walletDetails: [],
    },
  };

  // Analyze each platform
  for (const [platform, pools] of Object.entries(LIQUIDITY_POOLS)) {
    console.log(`[LP Analysis] Analyzing ${platform} platform with ${pools.length} pools...`);

    const platformResults: PoolTokenAnalysis[] = [];

    for (const poolAddress of pools) {
      const analysis = await analyzePool(connection, poolAddress);
      analysis.platform = platform;
      platformResults.push(analysis);

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    (results as any)[platform] = platformResults;
  }

  // Calculate total analysis with detailed wallet breakdown
  const allWallets = new Map<
    string,
    {
      totalTokens: number;
      platforms: Set<string>;
      poolBreakdown: Map<string, { tokens: number; pools: string[] }>;
    }
  >();

  for (const [platform, analyses] of Object.entries(results)) {
    if (platform === 'totalAnalysis') continue;

    let platformTotalTokens = 0;
    const platformWallets = new Set<string>();

    for (const analysis of analyses as PoolTokenAnalysis[]) {
      platformTotalTokens += analysis.totalTokens;

      for (const [walletAddress, tokens] of Object.entries(analysis.walletDistribution)) {
        platformWallets.add(walletAddress);

        if (!allWallets.has(walletAddress)) {
          allWallets.set(walletAddress, {
            totalTokens: 0,
            platforms: new Set(),
            poolBreakdown: new Map(),
          });
        }

        const walletData = allWallets.get(walletAddress)!;
        walletData.totalTokens += tokens;
        walletData.platforms.add(platform);

        // Track pool breakdown
        if (!walletData.poolBreakdown.has(platform)) {
          walletData.poolBreakdown.set(platform, { tokens: 0, pools: [] });
        }
        const platformData = walletData.poolBreakdown.get(platform)!;
        platformData.tokens += tokens;
        platformData.pools.push(analysis.poolAddress);
      }
    }

    results.totalAnalysis.platformBreakdown[platform] = {
      totalTokens: platformTotalTokens,
      uniqueWallets: platformWallets.size,
    };

    results.totalAnalysis.totalTokensAcrossPlatforms += platformTotalTokens;
  }

  results.totalAnalysis.totalUniqueWallets = allWallets.size;

  // Calculate top wallets with social profiles
  results.totalAnalysis.topWallets = Array.from(allWallets.entries())
    .map(([address, data]) => {
      const profile = socialProfiles[address] || {};
      return {
        address,
        totalTokens: data.totalTokens,
        platforms: Array.from(data.platforms),
        twitter: profile.twitter,
        discord: profile.discord,
        comment: profile.comment,
        id: profile.id,
      };
    })
    .sort((a, b) => b.totalTokens - a.totalTokens);

  // Create detailed wallet breakdown
  results.totalAnalysis.walletDetails = Array.from(allWallets.entries())
    .map(([address, data]) => {
      const profile = socialProfiles[address] || {};
      const poolBreakdown: { [platform: string]: { tokens: number; pools: string[] } } = {};

      for (const [platform, breakdown] of data.poolBreakdown.entries()) {
        poolBreakdown[platform] = {
          tokens: breakdown.tokens,
          pools: breakdown.pools,
        };
      }

      return {
        address,
        totalTokens: data.totalTokens,
        platforms: Array.from(data.platforms),
        poolBreakdown,
        twitter: profile.twitter,
        discord: profile.discord,
        comment: profile.comment,
        id: profile.id,
      };
    })
    .sort((a, b) => b.totalTokens - a.totalTokens);

  console.log('[LP Analysis] Analysis complete');
  console.log(
    `[LP Analysis] Total $GP tokens across platforms: ${results.totalAnalysis.totalTokensAcrossPlatforms}`
  );
  console.log(`[LP Analysis] Total unique wallets: ${results.totalAnalysis.totalUniqueWallets}`);

  return results;
}

/**
 * Analyze a specific platform's pools
 */
export async function analyzePlatform(
  platform: keyof typeof LIQUIDITY_POOLS
): Promise<PoolTokenAnalysis[]> {
  console.log(`[LP Analysis] Starting analysis for ${platform} platform...`);

  if (!ENV.FULL_RPC_URL) {
    throw new Error('RPC URL is not configured');
  }

  const connection = new Connection(ENV.FULL_RPC_URL, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });

  const pools = LIQUIDITY_POOLS[platform];
  const results: PoolTokenAnalysis[] = [];

  for (const poolAddress of pools) {
    const analysis = await analyzePool(connection, poolAddress);
    analysis.platform = platform;
    results.push(analysis);

    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`[LP Analysis] ${platform} analysis complete - ${results.length} pools analyzed`);
  return results;
}

/**
 * Analyze transaction flows for a specific liquidity pool
 */
async function analyzePoolTransactions(
  connection: Connection,
  poolAddress: string,
  socialProfiles: { [address: string]: any }
): Promise<PoolTransactionAnalysis> {
  console.log(`[LP Transaction Analysis] Analyzing transactions for pool: ${poolAddress}`);

  // First get the current token analysis to know target amounts
  const currentAnalysis = await analyzePool(connection, poolAddress);

  const poolTransactionAnalysis: PoolTransactionAnalysis = {
    ...currentAnalysis,
    inflows: [],
    outflows: [],
    totalInflow: 0,
    totalOutflow: 0,
    uniqueContributors: 0,
    contributorBreakdown: {},
  };

  try {
    // Get ALL transaction signatures for the pool address, fetching until we match totals
    console.log(`[LP Transaction Analysis] Fetching transaction signatures for ${poolAddress}...`);
    console.log(
      `[LP Transaction Analysis] Target total tokens in pool: ${currentAnalysis.totalTokens}`
    );

    let before: string | undefined;
    let totalTrackedInflow = 0;
    let totalTrackedOutflow = 0;
    let hasMoreTransactions = true;
    let fetchRound = 0;

    // Keep fetching until we've tracked enough transactions to account for current holdings
    while (hasMoreTransactions) {
      // No arbitrary limit - run until completion or no more transactions
      fetchRound++;
      console.log(`[LP Transaction Analysis] Fetch round ${fetchRound} for pool ${poolAddress}`);

      const signatures = await retryRpcCall(
        () =>
          connection.getSignaturesForAddress(new PublicKey(poolAddress), {
            limit: 500, // Reduced from 1000 to 500 to be more conservative
            before: before,
          }),
        `getSignaturesForAddress-${poolAddress}-round${fetchRound}`,
        5, // 5 retries
        2000 // 2 second base delay
      );

      if (signatures.length === 0) {
        hasMoreTransactions = false;
        console.log(
          `[LP Transaction Analysis] ⚠️  No more transactions available for pool ${poolAddress}`
        );
        break;
      }

      // Process this batch to see how much we've tracked
      const batchTransfers = await processBatchTransactions(connection, signatures, poolAddress);

      // Add to our totals
      for (const transfer of batchTransfers.inflows) {
        totalTrackedInflow += transfer.amount;
      }
      for (const transfer of batchTransfers.outflows) {
        totalTrackedOutflow += transfer.amount;
      }

      poolTransactionAnalysis.inflows.push(...batchTransfers.inflows);
      poolTransactionAnalysis.outflows.push(...batchTransfers.outflows);

      console.log(
        `[LP Transaction Analysis] Round ${fetchRound}: Tracked inflow: ${totalTrackedInflow.toFixed(6)}, outflow: ${totalTrackedOutflow.toFixed(6)}, net: ${(totalTrackedInflow - totalTrackedOutflow).toFixed(6)}, target: ${currentAnalysis.totalTokens.toFixed(6)}`
      );

      // Check if we've tracked enough to account for current holdings
      // Net inflow should exactly equal current holdings (inflow - outflow = current balance)
      const netTracked = totalTrackedInflow - totalTrackedOutflow;
      const targetNet = currentAnalysis.totalTokens;
      const tolerance = 0.000001; // Small tolerance for floating point precision
      const completionPercentage = targetNet > 0 ? (netTracked / targetNet) * 100 : 0;

      console.log(
        `[LP Transaction Analysis] Progress: ${completionPercentage.toFixed(2)}% of target balance tracked`
      );

      // If we've matched the target balance (within tolerance), we can stop
      if (Math.abs(netTracked - targetNet) <= tolerance || netTracked >= targetNet) {
        console.log(
          `[LP Transaction Analysis] ✅ Exact balance reached! Net tracked: ${netTracked.toFixed(6)}, Target: ${targetNet.toFixed(6)}, Difference: ${Math.abs(netTracked - targetNet).toFixed(6)}`
        );
        hasMoreTransactions = false;
      } else {
        console.log(
          `[LP Transaction Analysis] Still need ${(targetNet - netTracked).toFixed(6)} more tokens to match pool balance`
        );
        // Set up for next batch
        before = signatures[signatures.length - 1].signature;
        console.log(
          `[LP Transaction Analysis] Rate limiting: waiting 3 seconds before next batch...`
        );
        await new Promise(resolve => setTimeout(resolve, 3000)); // Increased from 1000ms to 3000ms
      }
    }

    // Check completion status
    const finalNetTracked = totalTrackedInflow - totalTrackedOutflow;
    const finalTargetNet = currentAnalysis.totalTokens;
    const finalTolerance = 0.000001;
    const isComplete =
      Math.abs(finalNetTracked - finalTargetNet) <= finalTolerance ||
      finalNetTracked >= finalTargetNet;
    const finalCompletionPercentage =
      finalTargetNet > 0 ? (finalNetTracked / finalTargetNet) * 100 : 0;

    if (!isComplete) {
      console.log(
        `[LP Transaction Analysis] ⚠️  INCOMPLETE: Processed all available transactions for pool ${poolAddress}`
      );
      console.log(
        `[LP Transaction Analysis] ⚠️  Only tracked ${finalCompletionPercentage.toFixed(2)}% of target balance (${finalNetTracked.toFixed(6)} / ${finalTargetNet.toFixed(6)})`
      );
      console.log(
        `[LP Transaction Analysis] ⚠️  Missing ${(finalTargetNet - finalNetTracked).toFixed(6)} tokens - this may indicate:`
      );
      console.log(
        `[LP Transaction Analysis] ⚠️  1. Tokens were deposited before blockchain history coverage`
      );
      console.log(
        `[LP Transaction Analysis] ⚠️  2. Initial pool funding not captured in transaction history`
      );
      console.log(
        `[LP Transaction Analysis] ⚠️  3. Non-standard token transfers not detected by our analysis`
      );
    }

    // Calculate totals and contributor breakdown
    poolTransactionAnalysis.totalInflow = poolTransactionAnalysis.inflows.reduce(
      (sum, t) => sum + t.amount,
      0
    );
    poolTransactionAnalysis.totalOutflow = poolTransactionAnalysis.outflows.reduce(
      (sum, t) => sum + t.amount,
      0
    );

    // Build contributor breakdown with social profiles
    const contributors = new Set<string>();
    [...poolTransactionAnalysis.inflows, ...poolTransactionAnalysis.outflows].forEach(transfer => {
      contributors.add(transfer.counterpartyAddress);
    });

    for (const address of contributors) {
      const profile = socialProfiles[address] || {};
      const inflows = poolTransactionAnalysis.inflows.filter(
        t => t.counterpartyAddress === address
      );
      const outflows = poolTransactionAnalysis.outflows.filter(
        t => t.counterpartyAddress === address
      );

      const totalInflow = inflows.reduce((sum, t) => sum + t.amount, 0);
      const totalOutflow = outflows.reduce((sum, t) => sum + t.amount, 0);

      poolTransactionAnalysis.contributorBreakdown[address] = {
        address,
        totalInflow,
        totalOutflow,
        netContribution: totalInflow - totalOutflow,
        transactionCount: inflows.length + outflows.length,
        twitter: profile.twitter,
        discord: profile.discord,
        comment: profile.comment,
        id: profile.id,
      };
    }

    poolTransactionAnalysis.uniqueContributors = contributors.size;

    const statusText = isComplete
      ? 'COMPLETE'
      : `INCOMPLETE (${finalCompletionPercentage.toFixed(1)}%)`;

    console.log(
      `[LP Transaction Analysis] Pool ${poolAddress} ${statusText}: ${poolTransactionAnalysis.inflows.length} inflows (${poolTransactionAnalysis.totalInflow}), ${poolTransactionAnalysis.outflows.length} outflows (${poolTransactionAnalysis.totalOutflow}), ${poolTransactionAnalysis.uniqueContributors} unique contributors`
    );

    return poolTransactionAnalysis;
  } catch (error) {
    console.error(`[LP Transaction Analysis] Error analyzing pool ${poolAddress}:`, error);
    return poolTransactionAnalysis;
  }
}

/**
 * Process a batch of transactions for a pool
 */
async function processBatchTransactions(
  connection: Connection,
  signatures: any[],
  poolAddress: string
): Promise<{ inflows: PoolTransfer[]; outflows: PoolTransfer[] }> {
  const inflows: PoolTransfer[] = [];
  const outflows: PoolTransfer[] = [];

  const BATCH_SIZE = 3;

  for (let i = 0; i < signatures.length; i += BATCH_SIZE) {
    const batchSignatures = signatures.slice(i, i + BATCH_SIZE);

    const batchPromises = batchSignatures.map(sig =>
      retryRpcCall(
        () =>
          connection.getParsedTransaction(sig.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          }),
        `getParsedTransaction-${sig.signature.slice(0, 8)}`,
        3, // 3 retries for individual transactions
        1500 // 1.5 second base delay
      )
    );

    const batchTransactions = await Promise.all(batchPromises);

    for (let j = 0; j < batchTransactions.length; j++) {
      const tx = batchTransactions[j];
      const signature = batchSignatures[j].signature;

      if (!tx || tx.meta?.err) continue;

      const transfers = analyzeTransactionForPoolFlows(tx, poolAddress, signature);
      inflows.push(...transfers.inflows);
      outflows.push(...transfers.outflows);
    }

    // Small delay between batches
    if (i + BATCH_SIZE < signatures.length) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Increased from 200ms to 1000ms
    }
  }

  return { inflows, outflows };
}

/**
 * Analyze a single transaction for pool flows
 */
function analyzeTransactionForPoolFlows(
  tx: ParsedTransactionWithMeta,
  poolAddress: string,
  signature: string
): { inflows: PoolTransfer[]; outflows: PoolTransfer[] } {
  const inflows: PoolTransfer[] = [];
  const outflows: PoolTransfer[] = [];

  if (!tx.meta || tx.meta.err) {
    return { inflows, outflows };
  }

  const timestamp = tx.blockTime
    ? new Date(tx.blockTime * 1000).toISOString()
    : new Date().toISOString();
  const preBalances = tx.meta.preTokenBalances || [];
  const postBalances = tx.meta.postTokenBalances || [];

  // Track balance changes for $GP token accounts
  const balanceChanges = new Map<
    string,
    {
      owner: string;
      preBal: number;
      postBal: number;
      change: number;
    }
  >();

  // Process pre-balances
  for (const balance of preBalances) {
    if (balance.mint === GP_TOKEN_ADDRESS) {
      const accountKey = tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString();
      const owner = balance.owner || '';
      const amount = balance.uiTokenAmount.uiAmount || 0;

      balanceChanges.set(accountKey, {
        owner,
        preBal: amount,
        postBal: 0,
        change: 0,
      });
    }
  }

  // Process post-balances
  for (const balance of postBalances) {
    if (balance.mint === GP_TOKEN_ADDRESS) {
      const accountKey = tx.transaction.message.accountKeys[balance.accountIndex].pubkey.toString();
      const owner = balance.owner || '';
      const amount = balance.uiTokenAmount.uiAmount || 0;

      if (balanceChanges.has(accountKey)) {
        const existing = balanceChanges.get(accountKey)!;
        existing.postBal = amount;
        existing.change = amount - existing.preBal;
      } else {
        balanceChanges.set(accountKey, {
          owner,
          preBal: 0,
          postBal: amount,
          change: amount,
        });
      }
    }
  }

  // Find pool's balance change
  let poolGain = 0;
  let poolLoss = 0;

  for (const [, change] of balanceChanges) {
    if (change.owner === poolAddress) {
      if (change.change > 0) {
        poolGain += change.change;
      } else if (change.change < 0) {
        poolLoss += Math.abs(change.change);
      }
    }
  }

  // Find counterparties for pool gains (inflows)
  if (poolGain > 0) {
    for (const [, change] of balanceChanges) {
      if (change.owner !== poolAddress && change.change < 0) {
        const loss = Math.abs(change.change);
        if (Math.abs(loss - poolGain) < 0.001) {
          inflows.push({
            signature,
            timestamp,
            amount: poolGain,
            counterpartyAddress: change.owner,
            direction: 'inflow',
          });
          break;
        }
      }
    }
  }

  // Find counterparties for pool losses (outflows)
  if (poolLoss > 0) {
    for (const [, change] of balanceChanges) {
      if (change.owner !== poolAddress && change.change > 0) {
        const gain = change.change;
        if (Math.abs(gain - poolLoss) < 0.001) {
          outflows.push({
            signature,
            timestamp,
            amount: poolLoss,
            counterpartyAddress: change.owner,
            direction: 'outflow',
          });
          break;
        }
      }
    }
  }

  return { inflows, outflows };
}

/**
 * Analyze all liquidity pools transaction flows across platforms
 */
export async function analyzeLiquidityPoolsTransactions(): Promise<LiquidityPoolsTransactionAnalysis> {
  console.log(
    '[LP Transaction Analysis] Starting comprehensive liquidity pools transaction analysis...'
  );
  console.log('[LP Transaction Analysis] Using conservative rate limiting to avoid 429 errors...');

  if (!ENV.FULL_RPC_URL) {
    throw new Error('RPC URL is not configured');
  }

  const connection = new Connection(ENV.FULL_RPC_URL, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });

  // Load social profiles
  console.log('[LP Transaction Analysis] Loading social profiles...');
  const socialProfiles = await loadSocialProfiles();
  console.log(
    `[LP Transaction Analysis] Loaded ${Object.keys(socialProfiles).length} social profiles`
  );

  const results: LiquidityPoolsTransactionAnalysis = {
    orca: [],
    raydium: [],
    meteora: [],
    totalAnalysis: {
      totalTokensAcrossPlatforms: 0,
      totalUniqueWallets: 0,
      totalInflows: 0,
      totalOutflows: 0,
      platformBreakdown: {},
      topContributors: [],
      contributorDetails: [],
    },
  };

  // Analyze each platform
  for (const [platform, pools] of Object.entries(LIQUIDITY_POOLS)) {
    console.log(
      `[LP Transaction Analysis] Analyzing ${platform} platform with ${pools.length} pools...`
    );

    const platformResults: PoolTransactionAnalysis[] = [];

    for (const poolAddress of pools) {
      const analysis = await analyzePoolTransactions(connection, poolAddress, socialProfiles);
      analysis.platform = platform;
      platformResults.push(analysis);

      // Add delay between pools to be respectful to RPC
      console.log(`[LP Transaction Analysis] Rate limiting: waiting 5 seconds before next pool...`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Increased from 2000ms to 5000ms
    }

    (results as any)[platform] = platformResults;
  }

  // Calculate total analysis
  const allContributors = new Map<
    string,
    {
      totalContributed: number;
      totalReceived: number;
      platforms: Set<string>;
      poolBreakdown: Map<string, { contributed: number; received: number; pools: string[] }>;
    }
  >();

  for (const [platform, analyses] of Object.entries(results)) {
    if (platform === 'totalAnalysis') continue;

    let platformTotalTokens = 0;
    let platformTotalInflows = 0;
    let platformTotalOutflows = 0;
    const platformWallets = new Set<string>();

    for (const analysis of analyses as PoolTransactionAnalysis[]) {
      platformTotalTokens += analysis.totalTokens;
      platformTotalInflows += analysis.totalInflow;
      platformTotalOutflows += analysis.totalOutflow;

      // Process contributors
      for (const [address, contributor] of Object.entries(analysis.contributorBreakdown)) {
        platformWallets.add(address);

        if (!allContributors.has(address)) {
          allContributors.set(address, {
            totalContributed: 0,
            totalReceived: 0,
            platforms: new Set(),
            poolBreakdown: new Map(),
          });
        }

        const contributorData = allContributors.get(address)!;
        contributorData.totalContributed += contributor.totalInflow;
        contributorData.totalReceived += contributor.totalOutflow;
        contributorData.platforms.add(platform);

        if (!contributorData.poolBreakdown.has(platform)) {
          contributorData.poolBreakdown.set(platform, { contributed: 0, received: 0, pools: [] });
        }
        const platformData = contributorData.poolBreakdown.get(platform)!;
        platformData.contributed += contributor.totalInflow;
        platformData.received += contributor.totalOutflow;
        platformData.pools.push(analysis.poolAddress);
      }
    }

    results.totalAnalysis.platformBreakdown[platform] = {
      totalTokens: platformTotalTokens,
      uniqueWallets: platformWallets.size,
      totalInflows: platformTotalInflows,
      totalOutflows: platformTotalOutflows,
    };

    results.totalAnalysis.totalTokensAcrossPlatforms += platformTotalTokens;
    results.totalAnalysis.totalInflows += platformTotalInflows;
    results.totalAnalysis.totalOutflows += platformTotalOutflows;
  }

  results.totalAnalysis.totalUniqueWallets = allContributors.size;

  // Build top contributors with social profiles
  results.totalAnalysis.topContributors = Array.from(allContributors.entries())
    .map(([address, data]) => {
      const profile = socialProfiles[address] || {};
      const poolBreakdown: {
        [platform: string]: { contributed: number; received: number; pools: string[] };
      } = {};

      for (const [platform, breakdown] of data.poolBreakdown.entries()) {
        poolBreakdown[platform] = {
          contributed: breakdown.contributed,
          received: breakdown.received,
          pools: breakdown.pools,
        };
      }

      return {
        address,
        totalContributed: data.totalContributed,
        totalReceived: data.totalReceived,
        netContribution: data.totalContributed - data.totalReceived,
        platforms: Array.from(data.platforms),
        poolBreakdown,
        twitter: profile.twitter,
        discord: profile.discord,
        comment: profile.comment,
        id: profile.id,
      };
    })
    .sort((a, b) => b.netContribution - a.netContribution);

  // Build detailed contributor breakdown with the same structure as topContributors
  results.totalAnalysis.contributorDetails = Array.from(allContributors.entries())
    .map(([address, data]) => {
      const profile = socialProfiles[address] || {};
      const poolBreakdown: {
        [platform: string]: { contributed: number; received: number; pools: string[] };
      } = {};

      for (const [platform, breakdown] of data.poolBreakdown.entries()) {
        poolBreakdown[platform] = {
          contributed: breakdown.contributed,
          received: breakdown.received,
          pools: breakdown.pools,
        };
      }

      return {
        address,
        totalContributed: data.totalContributed,
        totalReceived: data.totalReceived,
        netContribution: data.totalContributed - data.totalReceived,
        platforms: Array.from(data.platforms),
        poolBreakdown,
        twitter: profile.twitter,
        discord: profile.discord,
        comment: profile.comment,
        id: profile.id,
      };
    })
    .sort((a, b) => b.netContribution - a.netContribution);

  console.log('[LP Transaction Analysis] COMPLETE ANALYSIS:');
  console.log(`[LP Transaction Analysis] Total inflows: ${results.totalAnalysis.totalInflows}`);
  console.log(`[LP Transaction Analysis] Total outflows: ${results.totalAnalysis.totalOutflows}`);
  console.log(
    `[LP Transaction Analysis] Total contributors: ${results.totalAnalysis.totalUniqueWallets}`
  );
  console.log(
    `[LP Transaction Analysis] Net in pools: ${results.totalAnalysis.totalInflows - results.totalAnalysis.totalOutflows}`
  );

  return results;
}

/**
 * Alternative implementation using BitQuery API for better performance
 * This avoids RPC rate limiting and provides pre-processed data
 */
export async function analyzeLiquidityPoolsWithBitQuery(): Promise<LiquidityPoolsTransactionAnalysis> {
  console.log('[BitQuery LP Analysis] Starting BitQuery-based liquidity pools analysis...');

  // Load social profiles
  const socialProfiles = await loadSocialProfiles();

  const results: LiquidityPoolsTransactionAnalysis = {
    orca: [],
    raydium: [],
    meteora: [],
    totalAnalysis: {
      totalTokensAcrossPlatforms: 0,
      totalUniqueWallets: 0,
      totalInflows: 0,
      totalOutflows: 0,
      platformBreakdown: {},
      topContributors: [],
      contributorDetails: [],
    },
  };

  try {
    // BitQuery V2 API endpoint (EAP for Solana)
    const bitQueryEndpoint = 'https://streaming.bitquery.io/eap';

    console.log(
      '[BitQuery LP Analysis] Querying BitQuery V2 EAP API for $GP token liquidity events...'
    );
    console.log(
      '[BitQuery LP Analysis] Starting comprehensive pagination to fetch ALL transactions...'
    );

    // Check if environment variables are set
    if (!ENV.BITQUERY_API_KEY || !ENV.BITQUERY_TOKEN) {
      throw new Error(
        'BitQuery API credentials not found. Please set BITQUERY_API_KEY and BITQUERY_TOKEN in .env.local'
      );
    }

    // Collect all events from paginated requests
    let allPoolEvents: any[] = [];
    let offset = 0;
    const BATCH_SIZE = 10000; // Max per request
    let hasMoreData = true;
    let requestCount = 0;
    const MAX_REQUESTS = 30; // Safety limit (300k transactions max)

    while (hasMoreData && requestCount < MAX_REQUESTS) {
      requestCount++;
      console.log(
        `[BitQuery LP Analysis] Request ${requestCount}: Fetching transactions ${offset} to ${offset + BATCH_SIZE - 1}...`
      );

      // Query for $GP token liquidity events with pagination
      const query = `
        query GetGPTokenLiquidityEvents {
          Solana {
            DEXTradeByTokens(
              where: {
                Trade: {
                  Currency: { MintAddress: { is: "${GP_TOKEN_ADDRESS}" } }
                }
                Transaction: { Result: { Success: true } }
              }
              limit: { count: ${BATCH_SIZE}, offset: ${offset} }
              orderBy: { descending: Block_Time }
            ) {
              Block {
                Time
              }
              Transaction {
                Signer
                Signature
              }
              Trade {
                Currency {
                  MintAddress
                  Symbol
                  Name
                }
                Amount
                PriceInUSD
                Dex {
                  ProtocolFamily
                  ProtocolName
                  ProgramAddress
                }
                Market {
                  MarketAddress
                }
                Side {
                  Type
                  Currency {
                    MintAddress
                    Symbol
                    Name
                  }
                  Amount
                  AmountInUSD
                }
              }
            }
          }
        }
      `;

      // Make the API call
      const response = await fetch(bitQueryEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ENV.BITQUERY_TOKEN}`,
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`BitQuery API error: ${response.status} - ${response.statusText}`);
      }

      const bitQueryData = await response.json();

      if (bitQueryData.errors) {
        console.error('[BitQuery LP Analysis] GraphQL errors:', bitQueryData.errors);
        throw new Error(`BitQuery GraphQL errors: ${JSON.stringify(bitQueryData.errors)}`);
      }

      const batchEvents = bitQueryData.data?.Solana?.DEXTradeByTokens || [];
      console.log(
        `[BitQuery LP Analysis] Request ${requestCount}: Retrieved ${batchEvents.length} transactions`
      );

      if (batchEvents.length === 0) {
        console.log('[BitQuery LP Analysis] No more data available, stopping pagination');
        hasMoreData = false;
      } else {
        allPoolEvents.push(...batchEvents);
        offset += BATCH_SIZE;

        // If we got fewer than the batch size, we've reached the end
        if (batchEvents.length < BATCH_SIZE) {
          console.log('[BitQuery LP Analysis] Retrieved final batch, stopping pagination');
          hasMoreData = false;
        }

        // Add delay between requests to be respectful to the API
        if (hasMoreData) {
          console.log('[BitQuery LP Analysis] Waiting 2 seconds before next request...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (requestCount >= MAX_REQUESTS) {
      console.log(
        `[BitQuery LP Analysis] Reached maximum request limit (${MAX_REQUESTS}), stopping pagination`
      );
    }

    console.log(
      `[BitQuery LP Analysis] 🎯 TOTAL: Fetched ${allPoolEvents.length} transactions across ${requestCount} requests`
    );

    // Process all the collected events
    console.log('[BitQuery LP Analysis] Processing all collected events...');

    // Process the BitQuery response
    const poolEvents = allPoolEvents;

    // Group events by platform and process them
    const platformGroups: { [key: string]: any[] } = {
      orca: [],
      raydium: [],
      meteora: [],
    };

    const allContributors = new Map<
      string,
      {
        totalContributed: number;
        totalReceived: number;
        platforms: Set<string>;
        transactions: number;
        poolBreakdown: Map<string, { contributed: number; received: number; pools: string[] }>;
      }
    >();

    poolEvents.forEach(event => {
      const platform = event.Trade.Dex.ProtocolFamily.toLowerCase();
      const contributorAddress = event.Transaction.Signer;
      const tradeAmount = parseFloat(event.Trade.Amount || '0');
      const sideAmount = parseFloat(event.Trade.Side.Amount || '0');
      const poolAddress = event.Trade.Market.MarketAddress;

      // Categorize by platform
      if (platform.includes('orca')) {
        platformGroups.orca.push(event);
      } else if (platform.includes('raydium')) {
        platformGroups.raydium.push(event);
      } else if (platform.includes('meteora')) {
        platformGroups.meteora.push(event);
      }

      // Track contributors
      if (!allContributors.has(contributorAddress)) {
        allContributors.set(contributorAddress, {
          totalContributed: 0,
          totalReceived: 0,
          platforms: new Set(),
          transactions: 0,
          poolBreakdown: new Map(),
        });
      }

      const contributor = allContributors.get(contributorAddress)!;
      contributor.platforms.add(platform);
      contributor.transactions++;

      // Track pool breakdown
      if (!contributor.poolBreakdown.has(platform)) {
        contributor.poolBreakdown.set(platform, { contributed: 0, received: 0, pools: [] });
      }
      const platformData = contributor.poolBreakdown.get(platform)!;
      if (!platformData.pools.includes(poolAddress)) {
        platformData.pools.push(poolAddress);
      }

      // Determine if this is an inflow or outflow based on side type
      if (event.Trade.Side.Type === 'buy') {
        // When someone buys the token, they contribute to the pool
        contributor.totalContributed += sideAmount;
        platformData.contributed += sideAmount;
        results.totalAnalysis.totalInflows += sideAmount;
      } else if (event.Trade.Side.Type === 'sell') {
        // When someone sells the token, they receive from the pool
        contributor.totalReceived += sideAmount;
        platformData.received += sideAmount;
        results.totalAnalysis.totalOutflows += sideAmount;
      }
    });

    // Build top contributors with social profiles
    results.totalAnalysis.topContributors = Array.from(allContributors.entries())
      .map(([address, data]) => {
        const profile = socialProfiles[address] || {};
        const poolBreakdown: {
          [platform: string]: { contributed: number; received: number; pools: string[] };
        } = {};

        for (const [platform, breakdown] of data.poolBreakdown.entries()) {
          poolBreakdown[platform] = {
            contributed: breakdown.contributed,
            received: breakdown.received,
            pools: breakdown.pools,
          };
        }

        return {
          address,
          totalContributed: data.totalContributed,
          totalReceived: data.totalReceived,
          netContribution: data.totalContributed - data.totalReceived,
          platforms: Array.from(data.platforms),
          poolBreakdown,
          twitter: profile.twitter,
          discord: profile.discord,
          comment: profile.comment,
          id: profile.id,
        };
      })
      .sort((a, b) => b.netContribution - a.netContribution);

    // Build detailed contributor breakdown with the same structure as topContributors
    results.totalAnalysis.contributorDetails = Array.from(allContributors.entries())
      .map(([address, data]) => {
        const profile = socialProfiles[address] || {};
        const poolBreakdown: {
          [platform: string]: { contributed: number; received: number; pools: string[] };
        } = {};

        for (const [platform, breakdown] of data.poolBreakdown.entries()) {
          poolBreakdown[platform] = {
            contributed: breakdown.contributed,
            received: breakdown.received,
            pools: breakdown.pools,
          };
        }

        return {
          address,
          totalContributed: data.totalContributed,
          totalReceived: data.totalReceived,
          netContribution: data.totalContributed - data.totalReceived,
          platforms: Array.from(data.platforms),
          poolBreakdown,
          twitter: profile.twitter,
          discord: profile.discord,
          comment: profile.comment,
          id: profile.id,
        };
      })
      .sort((a, b) => b.netContribution - a.netContribution);

    results.totalAnalysis.totalUniqueWallets = allContributors.size;

    // Set platform breakdowns (simplified for BitQuery response)
    Object.keys(platformGroups).forEach(platform => {
      const events = platformGroups[platform];
      const platformInflows = events
        .filter(e => e.Trade.Side.Type === 'buy')
        .reduce((sum, e) => sum + parseFloat(e.Trade.Side.Amount || '0'), 0);
      const platformOutflows = events
        .filter(e => e.Trade.Side.Type === 'sell')
        .reduce((sum, e) => sum + parseFloat(e.Trade.Side.Amount || '0'), 0);

      results.totalAnalysis.platformBreakdown[platform] = {
        totalTokens: platformInflows - platformOutflows,
        uniqueWallets: new Set(events.map(e => e.Transaction.Signer)).size,
        totalInflows: platformInflows,
        totalOutflows: platformOutflows,
      };
    });

    console.log(
      '[BitQuery LP Analysis] ✅ Comprehensive BitQuery analysis complete with pagination!'
    );
    console.log(
      `[BitQuery LP Analysis] 📊 Total transactions processed: ${poolEvents.length} (across ${requestCount || 1} API requests)`
    );
    console.log(
      `[BitQuery LP Analysis] 📊 Found ${results.totalAnalysis.totalUniqueWallets} unique contributors`
    );
    console.log(
      `[BitQuery LP Analysis] 💰 Total inflows: ${results.totalAnalysis.totalInflows.toFixed(2)} $GP`
    );
    console.log(
      `[BitQuery LP Analysis] 💸 Total outflows: ${results.totalAnalysis.totalOutflows.toFixed(2)} $GP`
    );
    console.log(
      `[BitQuery LP Analysis] 🚀 Comprehensive analysis complete - this should include all available historical data!`
    );

    return results;
  } catch (error) {
    console.error('[BitQuery LP Analysis] Error with BitQuery approach:', error);

    // Don't fall back to RPC - just throw the error so the user knows BitQuery failed
    throw new Error(
      `BitQuery API failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Search for a specific wallet address in liquidity pools
 */
export async function searchWalletInLiquidityPools(walletAddress: string): Promise<{
  found: boolean;
  walletData?: any;
  allWallets: string[];
  totalWallets: number;
}> {
  console.log(`[Wallet Search] Searching for wallet: ${walletAddress}`);

  try {
    // Get the full analysis
    const analysis = await analyzeLiquidityPoolsWithBitQuery();

    // Extract all wallet addresses
    const allWallets = analysis.totalAnalysis.contributorDetails.map(c => c.address);

    // Search for the specific wallet
    const walletData = analysis.totalAnalysis.contributorDetails.find(
      contributor => contributor.address === walletAddress
    );

    console.log(`[Wallet Search] Total wallets found: ${allWallets.length}`);
    console.log(`[Wallet Search] Target wallet found: ${!!walletData}`);

    return {
      found: !!walletData,
      walletData,
      allWallets,
      totalWallets: allWallets.length,
    };
  } catch (error) {
    console.error(`[Wallet Search] Error searching for wallet ${walletAddress}:`, error);
    throw error;
  }
}

/**
 * Search for a specific wallet's $GP token transactions directly via BitQuery
 * This is more efficient than fetching all transactions and searching through them
 */
export async function searchSpecificWalletInBitQuery(walletAddress: string): Promise<{
  found: boolean;
  transactions: any[];
  totalFound: number;
  analysis: {
    totalContributed: number;
    totalReceived: number;
    netContribution: number;
    platforms: string[];
    pools: string[];
  };
}> {
  console.log(`[BitQuery Wallet Search] Searching specifically for wallet: ${walletAddress}`);

  try {
    // Check if environment variables are set
    if (!ENV.BITQUERY_API_KEY || !ENV.BITQUERY_TOKEN) {
      throw new Error(
        'BitQuery API credentials not found. Please set BITQUERY_API_KEY and BITQUERY_TOKEN in .env.local'
      );
    }

    const bitQueryEndpoint = 'https://streaming.bitquery.io/eap';

    // Query specifically for this wallet's $GP token transactions
    const query = `
      query SearchSpecificWallet {
        Solana {
          DEXTradeByTokens(
            where: {
              Trade: {
                Currency: { MintAddress: { is: "${GP_TOKEN_ADDRESS}" } }
              }
              Transaction: { 
                Result: { Success: true }
                Signer: { is: "${walletAddress}" }
              }
            }
            limit: { count: 1000 }
            orderBy: { descending: Block_Time }
          ) {
            Block {
              Time
            }
            Transaction {
              Signer
              Signature
            }
            Trade {
              Currency {
                MintAddress
                Symbol
                Name
              }
              Amount
              PriceInUSD
              Dex {
                ProtocolFamily
                ProtocolName
                ProgramAddress
              }
              Market {
                MarketAddress
              }
              Side {
                Type
                Currency {
                  MintAddress
                  Symbol
                  Name
                }
                Amount
                AmountInUSD
              }
            }
          }
        }
      }
    `;

    console.log(
      `[BitQuery Wallet Search] Querying BitQuery specifically for wallet ${walletAddress}...`
    );

    const response = await fetch(bitQueryEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ENV.BITQUERY_TOKEN}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`BitQuery API error: ${response.status} - ${response.statusText}`);
    }

    const bitQueryData = await response.json();

    if (bitQueryData.errors) {
      console.error('[BitQuery Wallet Search] GraphQL errors:', bitQueryData.errors);
      throw new Error(`BitQuery GraphQL errors: ${JSON.stringify(bitQueryData.errors)}`);
    }

    const transactions = bitQueryData.data?.Solana?.DEXTradeByTokens || [];
    console.log(
      `[BitQuery Wallet Search] Found ${transactions.length} transactions for wallet ${walletAddress}`
    );

    if (transactions.length === 0) {
      return {
        found: false,
        transactions: [],
        totalFound: 0,
        analysis: {
          totalContributed: 0,
          totalReceived: 0,
          netContribution: 0,
          platforms: [],
          pools: [],
        },
      };
    }

    // Analyze the found transactions
    let totalContributed = 0;
    let totalReceived = 0;
    const platforms = new Set<string>();
    const pools = new Set<string>();

    transactions.forEach(tx => {
      const platform = tx.Trade.Dex.ProtocolFamily.toLowerCase();
      const poolAddress = tx.Trade.Market.MarketAddress;
      const sideAmount = parseFloat(tx.Trade.Side.Amount || '0');

      platforms.add(platform);
      pools.add(poolAddress);

      if (tx.Trade.Side.Type === 'buy') {
        totalContributed += sideAmount;
      } else if (tx.Trade.Side.Type === 'sell') {
        totalReceived += sideAmount;
      }
    });

    const analysis = {
      totalContributed,
      totalReceived,
      netContribution: totalContributed - totalReceived,
      platforms: Array.from(platforms),
      pools: Array.from(pools),
    };

    console.log(`[BitQuery Wallet Search] ✅ Found wallet activity!`);
    console.log(`[BitQuery Wallet Search] 📊 Transactions: ${transactions.length}`);
    console.log(`[BitQuery Wallet Search] 💰 Contributed: ${totalContributed.toFixed(6)} $GP`);
    console.log(`[BitQuery Wallet Search] 💸 Received: ${totalReceived.toFixed(6)} $GP`);
    console.log(`[BitQuery Wallet Search] 🏦 Platforms: ${Array.from(platforms).join(', ')}`);
    console.log(`[BitQuery Wallet Search] 🏊 Pools: ${pools.size} different pools`);

    return {
      found: true,
      transactions,
      totalFound: transactions.length,
      analysis,
    };
  } catch (error) {
    console.error(`[BitQuery Wallet Search] Error searching for wallet ${walletAddress}:`, error);
    throw error;
  }
}

/**
 * Diagnostic function to test BitQuery's $GP token data coverage
 */
export async function diagnosticBitQueryGPTokenData(): Promise<{
  totalTransactions: number;
  uniqueWallets: number;
  recentTransactions: any[];
  dateRange: { earliest: string; latest: string };
  platforms: string[];
}> {
  console.log(`[BitQuery Diagnostic] Testing $GP token data coverage...`);
  console.log(`[BitQuery Diagnostic] Using token address: ${GP_TOKEN_ADDRESS}`);

  try {
    if (!ENV.BITQUERY_API_KEY || !ENV.BITQUERY_TOKEN) {
      throw new Error('BitQuery API credentials not found');
    }

    const bitQueryEndpoint = 'https://streaming.bitquery.io/eap';

    // Simple query to get basic $GP token data
    const query = `
      query DiagnosticGPToken {
        Solana {
          DEXTradeByTokens(
            where: {
              Trade: {
                Currency: { MintAddress: { is: "${GP_TOKEN_ADDRESS}" } }
              }
              Transaction: { Result: { Success: true } }
            }
            limit: { count: 100 }
            orderBy: { descending: Block_Time }
          ) {
            Block {
              Time
            }
            Transaction {
              Signer
              Signature
            }
            Trade {
              Currency {
                MintAddress
                Symbol
                Name
              }
              Amount
              Dex {
                ProtocolFamily
                ProtocolName
              }
              Market {
                MarketAddress
              }
              Side {
                Type
                Amount
              }
            }
          }
        }
      }
    `;

    console.log(`[BitQuery Diagnostic] Querying for recent $GP token transactions...`);

    const response = await fetch(bitQueryEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ENV.BITQUERY_TOKEN}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`BitQuery API error: ${response.status} - ${response.statusText}`);
    }

    const bitQueryData = await response.json();

    if (bitQueryData.errors) {
      console.error('[BitQuery Diagnostic] GraphQL errors:', bitQueryData.errors);
      throw new Error(`BitQuery GraphQL errors: ${JSON.stringify(bitQueryData.errors)}`);
    }

    const transactions = bitQueryData.data?.Solana?.DEXTradeByTokens || [];

    console.log(`[BitQuery Diagnostic] Found ${transactions.length} recent transactions`);

    if (transactions.length === 0) {
      console.log(`[BitQuery Diagnostic] ❌ No $GP token transactions found in BitQuery!`);
      console.log(`[BitQuery Diagnostic] This suggests:`);
      console.log(`[BitQuery Diagnostic] 1. Token address might be incorrect`);
      console.log(`[BitQuery Diagnostic] 2. BitQuery doesn't have $GP token data`);
      console.log(`[BitQuery Diagnostic] 3. All transactions are outside their coverage period`);

      return {
        totalTransactions: 0,
        uniqueWallets: 0,
        recentTransactions: [],
        dateRange: { earliest: 'N/A', latest: 'N/A' },
        platforms: [],
      };
    }

    // Analyze the data
    const uniqueWallets = new Set(transactions.map(tx => tx.Transaction.Signer)).size;
    const platforms = new Set(transactions.map(tx => tx.Trade.Dex.ProtocolFamily)).size;
    const dates = transactions
      .map(tx => tx.Block.Time)
      .filter(Boolean)
      .sort();
    const earliest = dates[dates.length - 1] || 'N/A';
    const latest = dates[0] || 'N/A';

    console.log(`[BitQuery Diagnostic] ✅ Analysis Results:`);
    console.log(`[BitQuery Diagnostic] 📊 Transactions: ${transactions.length}`);
    console.log(`[BitQuery Diagnostic] 👥 Unique wallets: ${uniqueWallets}`);
    console.log(`[BitQuery Diagnostic] 🏦 Platforms: ${platforms}`);
    console.log(`[BitQuery Diagnostic] 📅 Date range: ${earliest} to ${latest}`);
    console.log(
      `[BitQuery Diagnostic] 🎯 Recent signers:`,
      transactions.slice(0, 5).map(tx => tx.Transaction.Signer)
    );

    return {
      totalTransactions: transactions.length,
      uniqueWallets,
      recentTransactions: transactions.slice(0, 10), // Return first 10 for inspection
      dateRange: { earliest, latest },
      platforms: Array.from(new Set(transactions.map(tx => tx.Trade.Dex.ProtocolFamily))),
    };
  } catch (error) {
    console.error(`[BitQuery Diagnostic] Error:`, error);
    throw error;
  }
}

/**
 * Search for wallet's liquidity pool interactions using Transfers (more comprehensive)
 */
export async function searchWalletLiquidityTransfers(walletAddress: string): Promise<{
  found: boolean;
  transfers: any[];
  totalFound: number;
  poolInteractions: {
    [poolAddress: string]: {
      totalSent: number;
      totalReceived: number;
      netContribution: number;
      transactionCount: number;
      firstSeen: string;
      lastSeen: string;
    };
  };
}> {
  console.log(`[BitQuery Transfers] Searching for wallet's LP transfers: ${walletAddress}`);

  try {
    if (!ENV.BITQUERY_API_KEY || !ENV.BITQUERY_TOKEN) {
      throw new Error('BitQuery API credentials not found');
    }

    const bitQueryEndpoint = 'https://streaming.bitquery.io/eap';

    // Query for all $GP token transfers involving this wallet
    const query = `
      query SearchWalletTransfers {
        Solana {
          Transfers(
            where: {
              Transfer: {
                Currency: { MintAddress: { is: "${GP_TOKEN_ADDRESS}" } }
              }
              Transaction: { Result: { Success: true } }
              any: [
                { Transfer: { Sender: { Address: { is: "${walletAddress}" } } } }
                { Transfer: { Receiver: { Address: { is: "${walletAddress}" } } } }
              ]
            }
            limit: { count: 1000 }
            orderBy: { descending: Block_Time }
          ) {
            Block {
              Time
            }
            Transaction {
              Signature
            }
            Transfer {
              Sender {
                Address
              }
              Receiver {
                Address
              }
              Amount
              Currency {
                MintAddress
                Symbol
                Name
              }
            }
          }
        }
      }
    `;

    console.log(`[BitQuery Transfers] Querying transfers for wallet ${walletAddress}...`);

    const response = await fetch(bitQueryEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ENV.BITQUERY_TOKEN}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`BitQuery API error: ${response.status} - ${response.statusText}`);
    }

    const bitQueryData = await response.json();

    if (bitQueryData.errors) {
      console.error('[BitQuery Transfers] GraphQL errors:', bitQueryData.errors);
      throw new Error(`BitQuery GraphQL errors: ${JSON.stringify(bitQueryData.errors)}`);
    }

    const transfers = bitQueryData.data?.Solana?.Transfers || [];
    console.log(
      `[BitQuery Transfers] Found ${transfers.length} transfers for wallet ${walletAddress}`
    );

    if (transfers.length === 0) {
      return {
        found: false,
        transfers: [],
        totalFound: 0,
        poolInteractions: {},
      };
    }

    // Get all liquidity pool addresses for comparison
    const allPoolAddresses = Object.values(LIQUIDITY_POOLS).flat();
    console.log(
      `[BitQuery Transfers] Checking against ${allPoolAddresses.length} known pool addresses...`
    );

    // Analyze transfers with liquidity pools
    const poolInteractions: {
      [poolAddress: string]: {
        totalSent: number;
        totalReceived: number;
        netContribution: number;
        transactionCount: number;
        firstSeen: string;
        lastSeen: string;
      };
    } = {};

    transfers.forEach(transfer => {
      const sender = transfer.Transfer.Sender.Address;
      const receiver = transfer.Transfer.Receiver.Address;
      const amount = parseFloat(transfer.Transfer.Amount || '0');
      const timestamp = transfer.Block.Time;

      // Check if this transfer involves a liquidity pool
      let poolAddress: string | null = null;
      let isSentToPool = false;
      let isReceivedFromPool = false;

      if (sender === walletAddress && allPoolAddresses.includes(receiver)) {
        // Wallet sent tokens to a pool (liquidity provision)
        poolAddress = receiver;
        isSentToPool = true;
      } else if (receiver === walletAddress && allPoolAddresses.includes(sender)) {
        // Wallet received tokens from a pool (liquidity withdrawal)
        poolAddress = sender;
        isReceivedFromPool = true;
      }

      if (poolAddress) {
        if (!poolInteractions[poolAddress]) {
          poolInteractions[poolAddress] = {
            totalSent: 0,
            totalReceived: 0,
            netContribution: 0,
            transactionCount: 0,
            firstSeen: timestamp,
            lastSeen: timestamp,
          };
        }

        const interaction = poolInteractions[poolAddress];
        interaction.transactionCount++;

        if (isSentToPool) {
          interaction.totalSent += amount;
        } else if (isReceivedFromPool) {
          interaction.totalReceived += amount;
        }

        interaction.netContribution = interaction.totalSent - interaction.totalReceived;

        // Update date range
        if (timestamp < interaction.firstSeen) interaction.firstSeen = timestamp;
        if (timestamp > interaction.lastSeen) interaction.lastSeen = timestamp;
      }
    });

    const poolInteractionCount = Object.keys(poolInteractions).length;
    const totalLPTransfers = Object.values(poolInteractions).reduce(
      (sum, interaction) => sum + interaction.transactionCount,
      0
    );

    console.log(`[BitQuery Transfers] ✅ Analysis complete!`);
    console.log(`[BitQuery Transfers] 📊 Total transfers: ${transfers.length}`);
    console.log(`[BitQuery Transfers] 🏊 Pool interactions: ${poolInteractionCount} pools`);
    console.log(`[BitQuery Transfers] 🔄 LP transfers: ${totalLPTransfers}`);

    if (poolInteractionCount > 0) {
      console.log(`[BitQuery Transfers] 🎯 Found liquidity pool activity!`);
      Object.entries(poolInteractions).forEach(([pool, data]) => {
        console.log(
          `[BitQuery Transfers] Pool ${pool.slice(0, 8)}...: Sent ${data.totalSent.toFixed(2)}, Received ${data.totalReceived.toFixed(2)}, Net ${data.netContribution.toFixed(2)}`
        );
      });
    }

    return {
      found: poolInteractionCount > 0,
      transfers,
      totalFound: transfers.length,
      poolInteractions,
    };
  } catch (error) {
    console.error(
      `[BitQuery Transfers] Error searching transfers for wallet ${walletAddress}:`,
      error
    );
    throw error;
  }
}
