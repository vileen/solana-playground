import { Request, Response, Router } from 'express';

import { ENV } from '../config/env.js';
import { query } from '../db/index.js';
import {
  getNFTEventsForSnapshot,
  getNFTSnapshotsWithEvents,
  getTokenEventsForSnapshot,
  getTokenSnapshotsWithEvents,
} from '../services/eventsService.js';
import {
  GP_TOKEN_ADDRESS,
  LIQUIDITY_POOLS,
  analyzeLiquidityPools,
  analyzeLiquidityPoolsTransactions,
  analyzeLiquidityPoolsWithBitQuery,
  analyzePlatform,
  diagnosticBitQueryGPTokenData,
  searchSpecificWalletInBitQuery,
  searchWalletInLiquidityPools,
  searchWalletLiquidityTransfers,
} from '../services/liquidityPoolService.js';
import {
  createHolderSnapshot,
  getHolders,
  loadHolderSnapshot,
} from '../services/nftCollectionsDb.js';
import {
  deleteSocialProfile,
  loadSocialProfiles,
  saveSocialProfile,
} from '../services/socialProfilesDb.js';
import {
  createTokenSnapshot,
  getFilteredTokenHolders,
  loadTokenSnapshot,
} from '../services/tokenServiceDb.js';

// Fallback to file-based versions when needed

const router = Router();

// Get NFT holders with optional search filter
router.get('/holders', async (req: Request, res: Response) => {
  try {
    // @ts-ignore - Express types issue
    const { search, limit, snapshotId } = req.query;
    let limitNum: number | undefined = undefined;
    let snapshotIdNum: number | undefined = undefined;

    // Convert limit to number if provided
    if (limit && !isNaN(Number(limit))) {
      limitNum = Number(limit);
    }

    // Convert snapshotId to number if provided
    if (snapshotId && !isNaN(Number(snapshotId))) {
      snapshotIdNum = Number(snapshotId);
    }

    const holders = await getHolders(search as string, limitNum, snapshotIdNum);
    // @ts-ignore - Express types issue
    res.json(holders);
  } catch (error: any) {
    console.error('Error in /holders endpoint:', error);
    // @ts-ignore - Express types issue
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get token holders with optional search filter and snapshot selection
router.get('/token-holders', async (req: Request, res: Response) => {
  try {
    const { search, limit, snapshotId } = req.query;
    let limitNum: number | undefined = undefined;
    let snapshotIdNum: number | undefined = undefined;

    // Convert limit to number if provided
    if (limit && !isNaN(Number(limit))) {
      limitNum = Number(limit);
    }

    // Convert snapshotId to number if provided
    if (snapshotId && !isNaN(Number(snapshotId))) {
      snapshotIdNum = Number(snapshotId);
    }

    const holders = await getFilteredTokenHolders(search as string, limitNum, snapshotIdNum);
    res.json(holders);
  } catch (error: any) {
    console.error('Error in /token-holders endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Take a new NFT snapshot
router.get('/snapshot', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    console.log(`[API] NFT snapshot requested at ${new Date().toISOString()}`);
    console.log('[API] Taking new NFT snapshot...');

    const snapshot = await createHolderSnapshot();

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[API] NFT snapshot completed in ${duration.toFixed(2)} seconds`);
    console.log(
      `[API] Snapshot contains ${snapshot.holders.length} holders and ${snapshot.total} NFTs`
    );

    res.json(snapshot);
  } catch (error: any) {
    console.error('[API] Error in /snapshot endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Take a new token snapshot
router.get('/token-snapshot', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    console.log(`[API] Token snapshot requested at ${new Date().toISOString()}`);
    console.log('[API] Taking new token snapshot...');

    const snapshot = await createTokenSnapshot();

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[API] Token snapshot completed in ${duration.toFixed(2)} seconds`);
    console.log(
      `[API] Snapshot contains ${snapshot.holders.length} holders and ${snapshot.totalSupply} tokens`
    );

    res.json(snapshot);
  } catch (error: any) {
    console.error('[API] Error in /token-snapshot endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Save social profile (single wallet)
router.post('/social-profile', (req: Request, res: Response) => {
  (async () => {
    try {
      const { walletAddress, twitter, discord, comment } = req.body;

      if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }

      const success = await saveSocialProfile(walletAddress, { twitter, discord, comment });

      if (success) {
        res.json({ success: true, message: 'Social profile saved' });
      } else {
        res.status(500).json({ error: 'Failed to save social profile' });
      }
    } catch (error: any) {
      console.error('Error in /social-profile endpoint:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  })();
});

// Updated endpoint to handle new profile format (multiple wallets)
router.post('/social-profiles', (req: Request, res: Response) => {
  (async () => {
    try {
      const profileData = req.body;

      if (!profileData.wallets || !profileData.wallets.length) {
        return res.status(400).json({ error: 'At least one wallet address is required' });
      }

      const success = await saveSocialProfile(profileData);

      if (success) {
        res.json({ success: true, message: 'Social profile saved' });
      } else {
        res.status(500).json({ error: 'Failed to save social profile' });
      }
    } catch (error: any) {
      console.error('Error in /social-profiles endpoint:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  })();
});

// Get all social profiles
router.get('/social-profiles', async (req: Request, res: Response) => {
  try {
    const profiles = await loadSocialProfiles();

    // Convert to array format for easier consumption
    const profileArray = Object.entries(profiles).map(([address, data]) => ({
      address,
      ...data,
    }));

    res.json(profileArray);
  } catch (error: any) {
    console.error('Error in /social-profiles endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Data summary endpoint
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const nftSnapshot = await loadHolderSnapshot();
    const tokenSnapshot = await loadTokenSnapshot();

    res.json({
      nft: {
        totalNFTs: nftSnapshot?.total || 0,
        totalHolders: nftSnapshot?.holders.length || 0,
        lastUpdated: nftSnapshot?.timestamp || null,
      },
      token: {
        totalSupply: tokenSnapshot?.totalSupply || 0,
        totalHolders: tokenSnapshot?.holders.length || 0,
        lastUpdated: tokenSnapshot?.timestamp || null,
      },
    });
  } catch (error: any) {
    console.error('Error in /summary endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete a social profile
router.delete('/social-profiles/:id', (req: Request, res: Response) => {
  (async () => {
    try {
      const profileId = req.params.id;

      if (!profileId) {
        console.error('Delete profile failed: No ID provided in URL');
        return res.status(400).json({ error: 'Profile ID is required' });
      }

      console.log(`Delete profile request received for ID: ${profileId}`);

      const success = await deleteSocialProfile(profileId);

      if (success) {
        console.log(`Profile ${profileId} deleted successfully`);
        res.json({ success: true, message: 'Social profile deleted successfully' });
      } else {
        console.error(`Profile not found or could not be deleted: ${profileId}`);
        res.status(404).json({ error: 'Profile not found or could not be deleted' });
      }
    } catch (error: any) {
      console.error('Error in DELETE /social-profiles endpoint:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  })();
});

// Get token events for latest snapshot
// @ts-ignore - TypeScript has issues with router.get types
router.get('/token-events/latest', async (req: Request, res: Response) => {
  try {
    // First get the latest snapshot
    const snapshot = await loadTokenSnapshot();

    if (!snapshot) {
      return res.status(404).json({ error: 'No token snapshot found' });
    }

    // Get the latest snapshot ID from database
    const snapshotResult = await query(
      'SELECT id FROM token_snapshots ORDER BY timestamp DESC LIMIT 1'
    );

    if (snapshotResult.rowCount === 0) {
      return res.status(404).json({ error: 'No token snapshots found in database' });
    }

    const snapshotId = snapshotResult.rows[0].id;
    const events = await getTokenEventsForSnapshot(snapshotId);
    res.json(events);
  } catch (error: any) {
    console.error('Error in /token-events/latest endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get token events for a specific snapshot
// @ts-ignore - TypeScript has issues with router.get types
router.get('/token-events/:id', async (req: Request, res: Response) => {
  try {
    const snapshotId = parseInt(req.params.id || '0');

    if (isNaN(snapshotId) || snapshotId === 0) {
      return res.status(400).json({ error: 'Invalid snapshot ID' });
    }

    const events = await getTokenEventsForSnapshot(snapshotId);
    res.json(events);
  } catch (error: any) {
    console.error(`Error in /token-events/:id endpoint:`, error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get NFT events for latest snapshot
// @ts-ignore - TypeScript has issues with router.get types
router.get('/nft-events/latest', async (req: Request, res: Response) => {
  try {
    // First get the latest snapshot
    const snapshot = await loadHolderSnapshot();

    if (!snapshot) {
      return res.status(404).json({ error: 'No NFT snapshot found' });
    }

    // Get the latest snapshot ID from database
    const snapshotResult = await query(
      'SELECT id FROM nft_snapshots ORDER BY timestamp DESC LIMIT 1'
    );

    if (snapshotResult.rowCount === 0) {
      return res.status(404).json({ error: 'No NFT snapshots found in database' });
    }

    const snapshotId = snapshotResult.rows[0].id;
    const events = await getNFTEventsForSnapshot(snapshotId);
    res.json(events);
  } catch (error: any) {
    console.error('Error in /nft-events/latest endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get NFT events for a specific snapshot
// @ts-ignore - TypeScript has issues with router.get types
router.get('/nft-events/:id', async (req: Request, res: Response) => {
  try {
    const snapshotId = parseInt(req.params.id || '0');

    if (isNaN(snapshotId) || snapshotId === 0) {
      return res.status(400).json({ error: 'Invalid snapshot ID' });
    }

    const events = await getNFTEventsForSnapshot(snapshotId);
    res.json(events);
  } catch (error: any) {
    console.error(`Error in /nft-events/:id endpoint:`, error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get recent token snapshots with their events
router.get('/token-snapshots/events', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    let limitNum = 5; // Default limit

    // Convert limit to number if provided
    if (limit && !isNaN(Number(limit))) {
      limitNum = Number(limit);
    }

    const snapshots = await getTokenSnapshotsWithEvents(limitNum);
    res.json(snapshots);
  } catch (error: any) {
    console.error('Error in /token-snapshots/events endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get recent NFT snapshots with their events
router.get('/nft-snapshots/events', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    let limitNum = 5; // Default limit

    // Convert limit to number if provided
    if (limit && !isNaN(Number(limit))) {
      limitNum = Number(limit);
    }

    const snapshots = await getNFTSnapshotsWithEvents(limitNum);
    res.json(snapshots);
  } catch (error: any) {
    console.error('Error in /nft-snapshots/events endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get token snapshots with events
router.get('/events/token/snapshots', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;

    const snapshots = await getTokenSnapshotsWithEvents(limit, skip);
    res.json(snapshots);
  } catch (error: any) {
    console.error('Error in /events/token/snapshots endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get token snapshots without events (for snapshot selector)
// @ts-ignore - TypeScript has issues with router.get types
router.get('/token-snapshots', async (req: Request, res: Response) => {
  try {
    // Get list of snapshots from database
    const snapshotsResult = await query(`
      SELECT id, timestamp, token_address, total_supply
      FROM token_snapshots
      ORDER BY timestamp DESC
    `);

    if (snapshotsResult.rowCount === 0) {
      return res.json([]);
    }

    const snapshots = snapshotsResult.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      tokenAddress: row.token_address,
      totalSupply: parseFloat(row.total_supply),
    }));

    res.json(snapshots);
  } catch (error: any) {
    console.error('Error in /token-snapshots endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get NFT snapshots with events
router.get('/events/nft/snapshots', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;

    const snapshots = await getNFTSnapshotsWithEvents(limit, skip);
    res.json(snapshots);
  } catch (error: any) {
    console.error('Error in /events/nft/snapshots endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get NFT snapshots
router.get('/nft/snapshots', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const result = await query(
      `
      SELECT id, timestamp, total_count
      FROM nft_snapshots
      ORDER BY timestamp DESC
      LIMIT $1
    `,
      [limit]
    );

    const snapshots = result.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      totalCount: row.total_count,
    }));

    res.json(snapshots);
  } catch (error: any) {
    console.error('Error in /nft/snapshots endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Liquidity Pools Analysis Endpoints

// Get complete liquidity pools analysis across all platforms
router.get('/liquidity-pools/analysis', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    console.log(`[API] Liquidity pools analysis requested at ${new Date().toISOString()}`);

    const analysis = await analyzeLiquidityPools();

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[API] Liquidity pools analysis completed in ${duration.toFixed(2)} seconds`);

    res.json(analysis);
  } catch (error: any) {
    console.error('[API] Error in /liquidity-pools/analysis endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get analysis for a specific platform
router.get('/liquidity-pools/platform/:platform', async (req: Request, res: Response) => {
  try {
    const platform = req.params.platform;

    if (!platform || !Object.keys(LIQUIDITY_POOLS).includes(platform)) {
      return res.status(400).json({
        error: 'Invalid platform. Valid platforms are: ' + Object.keys(LIQUIDITY_POOLS).join(', '),
      });
    }

    const startTime = Date.now();
    console.log(`[API] Platform analysis requested for ${platform} at ${new Date().toISOString()}`);

    const analysis = await analyzePlatform(platform as keyof typeof LIQUIDITY_POOLS);

    const duration = (Date.now() - startTime) / 1000;
    console.log(
      `[API] Platform analysis for ${platform} completed in ${duration.toFixed(2)} seconds`
    );

    res.json({
      platform,
      pools: analysis,
      summary: {
        totalPools: analysis.length,
        totalTokens: analysis.reduce((sum, pool) => sum + pool.totalTokens, 0),
        totalUniqueWallets: new Set(analysis.flatMap(pool => Object.keys(pool.walletDistribution)))
          .size,
      },
    });
  } catch (error: any) {
    console.error(
      `[API] Error in /liquidity-pools/platform/${req.params.platform} endpoint:`,
      error
    );
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get the list of supported platforms and their pool addresses
router.get('/liquidity-pools/platforms', async (req: Request, res: Response) => {
  try {
    const platformsInfo = Object.entries(LIQUIDITY_POOLS).map(([platform, pools]) => ({
      platform,
      poolCount: pools.length,
      pools,
    }));

    res.json({
      platforms: platformsInfo,
      totalPools: Object.values(LIQUIDITY_POOLS).flat().length,
    });
  } catch (error: any) {
    console.error('[API] Error in /liquidity-pools/platforms endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get detailed transaction flow analysis for liquidity pools
// @ts-ignore - TypeScript has issues with router.get types
router.get('/liquidity-pools/transactions', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    console.log(
      `[API] Comprehensive liquidity pools transaction analysis requested at ${new Date().toISOString()}`
    );

    const analysis = await analyzeLiquidityPoolsTransactions();

    const duration = (Date.now() - startTime) / 1000;
    console.log(
      `[API] Liquidity pools transaction analysis completed in ${duration.toFixed(2)} seconds`
    );

    res.json(analysis);
  } catch (error: any) {
    console.error('[API] Error in /liquidity-pools/transactions endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get detailed transaction flow analysis for liquidity pools using BitQuery (faster alternative)
// @ts-ignore - TypeScript has issues with router.get types
router.get('/liquidity-pools/transactions-bitquery', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    console.log(
      `[API] BitQuery-based liquidity pools transaction analysis requested at ${new Date().toISOString()}`
    );

    const analysis = await analyzeLiquidityPoolsWithBitQuery();

    const duration = (Date.now() - startTime) / 1000;
    console.log(
      `[API] BitQuery liquidity pools transaction analysis completed in ${duration.toFixed(2)} seconds`
    );

    // @ts-ignore - Express types issue
    res.json(analysis);
  } catch (error: any) {
    console.error('[API] Error in /liquidity-pools/transactions-bitquery endpoint:', error);
    // @ts-ignore - Express types issue
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Search for a specific wallet in liquidity pools
// @ts-ignore - TypeScript has issues with router.get types
router.get('/liquidity-pools/search/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    const startTime = Date.now();

    console.log(
      `[API] Searching for wallet ${walletAddress} in liquidity pools at ${new Date().toISOString()}`
    );

    const searchResult = await searchWalletInLiquidityPools(walletAddress);

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[API] Wallet search completed in ${duration.toFixed(2)} seconds`);

    // @ts-ignore - Express types issue
    res.json(searchResult);
  } catch (error: any) {
    console.error('[API] Error searching for wallet in liquidity pools:', error);
    // @ts-ignore - Express types issue
    res.status(500).json({
      error: 'Failed to search wallet in liquidity pools',
      details: error.message,
    });
  }
});

// Search for a specific wallet using targeted BitQuery search (more efficient)
// @ts-ignore - TypeScript has issues with router.get types
router.get('/liquidity-pools/search-direct/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    const startTime = Date.now();

    console.log(
      `[API] Direct BitQuery search for wallet ${walletAddress} at ${new Date().toISOString()}`
    );

    const searchResult = await searchSpecificWalletInBitQuery(walletAddress);

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[API] Direct wallet search completed in ${duration.toFixed(2)} seconds`);

    // @ts-ignore - Express types issue
    res.json(searchResult);
  } catch (error: any) {
    console.error('[API] Error in direct wallet search:', error);
    // @ts-ignore - Express types issue
    res.status(500).json({
      error: 'Failed to search wallet directly',
      details: error.message,
    });
  }
});

// Search for wallet's liquidity pool interactions using Transfers (more comprehensive)
// @ts-ignore - TypeScript has issues with router.get types
router.get(
  '/liquidity-pools/search-transfers/:walletAddress',
  async (req: Request, res: Response) => {
    try {
      const { walletAddress } = req.params;
      const startTime = Date.now();

      console.log(
        `[API] Transfer-based search for wallet ${walletAddress} at ${new Date().toISOString()}`
      );

      const searchResult = await searchWalletLiquidityTransfers(walletAddress);

      const duration = (Date.now() - startTime) / 1000;
      console.log(`[API] Transfer search completed in ${duration.toFixed(2)} seconds`);

      // @ts-ignore - Express types issue
      res.json(searchResult);
    } catch (error: any) {
      console.error('[API] Error in transfer-based wallet search:', error);
      // @ts-ignore - Express types issue
      res.status(500).json({
        error: 'Failed to search wallet transfers',
        details: error.message,
      });
    }
  }
);

// Temporary test endpoint to check wallet in BitQuery
// @ts-ignore - TypeScript has issues with router.get types
router.get('/test-wallet/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;

    if (!ENV.BITQUERY_API_KEY || !ENV.BITQUERY_TOKEN) {
      throw new Error('BitQuery API credentials not found');
    }

    const bitQueryEndpoint = 'https://streaming.bitquery.io/eap';

    // Simple query to check if wallet has ANY transfers at all
    const query = `
      query TestWallet {
        Solana {
          Transfers(
            where: {
              any: [
                { Transfer: { Sender: { Address: { is: "${walletAddress}" } } } }
                { Transfer: { Receiver: { Address: { is: "${walletAddress}" } } } }
              ]
              Transaction: { Result: { Success: true } }
            }
            limit: { count: 10 }
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
      console.error('[Test Wallet] GraphQL errors:', bitQueryData.errors);
      throw new Error(`BitQuery GraphQL errors: ${JSON.stringify(bitQueryData.errors)}`);
    }

    const transfers = bitQueryData.data?.Solana?.Transfers || [];

    // @ts-ignore - Express types issue
    res.json({
      wallet: walletAddress,
      found: transfers.length > 0,
      transferCount: transfers.length,
      transfers: transfers.slice(0, 5), // First 5 for inspection
    });
  } catch (error: any) {
    console.error('[Test Wallet] Error:', error);
    // @ts-ignore - Express types issue
    res.status(500).json({
      error: 'Failed to test wallet',
      details: error.message,
    });
  }
});

// Test endpoint to check wallet using direct Solana RPC
// @ts-ignore - TypeScript has issues with router.get types
router.get('/test-wallet-rpc/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;

    if (!ENV.FULL_RPC_URL) {
      throw new Error('RPC URL is not configured');
    }

    const { Connection, PublicKey } = await import('@solana/web3.js');
    const connection = new Connection(ENV.FULL_RPC_URL, 'confirmed');

    console.log(`[RPC Test] Checking wallet ${walletAddress} using direct RPC...`);

    // Get recent transaction signatures
    const signatures = await connection.getSignaturesForAddress(new PublicKey(walletAddress), {
      limit: 10,
    });

    console.log(`[RPC Test] Found ${signatures.length} recent signatures for wallet`);

    if (signatures.length === 0) {
      // @ts-ignore - Express types issue
      return res.json({
        wallet: walletAddress,
        found: false,
        signatureCount: 0,
        signatures: [],
        message: 'No transaction signatures found for this wallet',
      });
    }

    // Get details of first few transactions
    const transactionDetails = [];
    for (let i = 0; i < Math.min(3, signatures.length); i++) {
      try {
        const tx = await connection.getParsedTransaction(signatures[i].signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });

        if (tx) {
          // Look for $GP token activity
          const hasGPToken =
            tx.meta?.preTokenBalances?.some(balance => balance.mint === GP_TOKEN_ADDRESS) ||
            tx.meta?.postTokenBalances?.some(balance => balance.mint === GP_TOKEN_ADDRESS);

          transactionDetails.push({
            signature: signatures[i].signature,
            blockTime: signatures[i].blockTime,
            hasGPToken,
            programIds: tx.transaction.message.programIds?.map(id => id.toString()),
            instructions: tx.transaction.message.instructions?.length || 0,
          });
        }
      } catch (txError) {
        console.warn(
          `[RPC Test] Error getting transaction details for ${signatures[i].signature}:`,
          txError
        );
      }
    }

    // @ts-ignore - Express types issue
    res.json({
      wallet: walletAddress,
      found: true,
      signatureCount: signatures.length,
      signatures: signatures.slice(0, 5).map(sig => ({
        signature: sig.signature,
        blockTime: sig.blockTime,
        slot: sig.slot,
        confirmationStatus: sig.confirmationStatus,
      })),
      transactionDetails,
      message: `Found ${signatures.length} transactions. This wallet is active!`,
    });
  } catch (error: any) {
    console.error('[RPC Test] Error:', error);
    // @ts-ignore - Express types issue
    res.status(500).json({
      error: 'Failed to test wallet with RPC',
      details: error.message,
    });
  }
});

// Get detailed transaction information
// @ts-ignore - TypeScript has issues with router.get types
router.get('/transaction-details/:signature', async (req: Request, res: Response) => {
  try {
    const { signature } = req.params;

    if (!ENV.FULL_RPC_URL) {
      throw new Error('RPC URL is not configured');
    }

    const { Connection } = await import('@solana/web3.js');
    const connection = new Connection(ENV.FULL_RPC_URL, 'confirmed');

    console.log(`[Transaction Details] Getting details for ${signature}...`);

    const tx = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      // @ts-ignore - Express types issue
      return res.status(404).json({
        error: 'Transaction not found',
      });
    }

    // Extract relevant information
    const gpTokenBalances = {
      pre: tx.meta?.preTokenBalances?.filter(balance => balance.mint === GP_TOKEN_ADDRESS) || [],
      post: tx.meta?.postTokenBalances?.filter(balance => balance.mint === GP_TOKEN_ADDRESS) || [],
    };

    // Calculate balance changes
    const balanceChanges = [];
    for (const postBalance of gpTokenBalances.post) {
      const preBalance = gpTokenBalances.pre.find(
        pre => pre.accountIndex === postBalance.accountIndex
      );

      const preAmount = preBalance?.uiTokenAmount?.uiAmount || 0;
      const postAmount = postBalance.uiTokenAmount?.uiAmount || 0;
      const change = postAmount - preAmount;

      if (Math.abs(change) > 0.001) {
        // Only show significant changes
        balanceChanges.push({
          accountIndex: postBalance.accountIndex,
          owner: postBalance.owner,
          preAmount,
          postAmount,
          change,
          accountAddress:
            tx.transaction.message.accountKeys[postBalance.accountIndex]?.pubkey?.toString(),
        });
      }
    }

    // Get pool addresses involved
    const involvedPoolAddresses = [];
    const allPoolAddresses = Object.values(LIQUIDITY_POOLS).flat();

    for (const account of tx.transaction.message.accountKeys) {
      const accountStr = account.pubkey.toString();
      if (allPoolAddresses.includes(accountStr)) {
        involvedPoolAddresses.push(accountStr);
      }
    }

    // @ts-ignore - Express types issue
    res.json({
      signature,
      blockTime: tx.blockTime,
      slot: tx.slot,
      success: !tx.meta?.err,
      gpTokenBalances,
      balanceChanges,
      involvedPoolAddresses,
      programIds: tx.transaction.message.programIds?.map(id => id.toString()),
      instructionCount: tx.transaction.message.instructions?.length || 0,
      logMessages: tx.meta?.logMessages?.slice(0, 5) || [], // First 5 log messages for context
    });
  } catch (error: any) {
    console.error('[Transaction Details] Error:', error);
    // @ts-ignore - Express types issue
    res.status(500).json({
      error: 'Failed to get transaction details',
      details: error.message,
    });
  }
});

// Diagnostic endpoint to test BitQuery's $GP token data coverage
// @ts-ignore - TypeScript has issues with router.get types
router.get('/liquidity-pools/diagnostic', async (req: Request, res: Response) => {
  try {
    console.log('[API] BitQuery diagnostic requested at', new Date().toISOString());

    const diagnostic = await diagnosticBitQueryGPTokenData();

    // @ts-ignore - Express types issue
    res.json(diagnostic);
  } catch (error: any) {
    console.error('[API] Error in BitQuery diagnostic:', error);
    // @ts-ignore - Express types issue
    res.status(500).json({
      error: 'Failed to run BitQuery diagnostic',
      details: error.message,
    });
  }
});

export default router;
