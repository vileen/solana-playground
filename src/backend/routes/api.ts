import { Request, Response, Router } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

import { query } from '../db/index.js';
import {
  getNFTEventsForSnapshot,
  getNFTSnapshotsWithEvents,
  getTokenEventsForSnapshot,
  getTokenSnapshotsWithEvents,
} from '../services/eventsService.js';
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

// Define a typed request handler to avoid TypeScript errors
type RequestHandler<P extends ParamsDictionary = ParamsDictionary, ResBody = any, ReqBody = any> = 
  (req: Request<P, ResBody, ReqBody, ParsedQs>, res: Response<ResBody>) => Promise<void | Response<ResBody>>;

// Get NFT holders with optional search filter
router.get('/holders', async (req: Request, res: Response) => {
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
    
    const holders = await getHolders(search as string, limitNum, snapshotIdNum);
    res.json(holders);
  } catch (error: any) {
    console.error('Error in /holders endpoint:', error);
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
    console.log(`[API] Snapshot contains ${snapshot.holders.length} holders and ${snapshot.total} NFTs`);
    
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
    console.log(`[API] Snapshot contains ${snapshot.holders.length} holders and ${snapshot.totalSupply} tokens`);
    
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
      totalSupply: parseFloat(row.total_supply)
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
    
    const result = await query(`
      SELECT id, timestamp, total_count
      FROM nft_snapshots
      ORDER BY timestamp DESC
      LIMIT $1
    `, [limit]);
    
    const snapshots = result.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      totalCount: row.total_count
    }));
    
    res.json(snapshots);
  } catch (error: any) {
    console.error('Error in /nft/snapshots endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
