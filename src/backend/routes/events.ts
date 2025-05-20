import { Request, Response, Router } from 'express';
import {
    getNFTSnapshotsWithEvents,
    getTokenSnapshotsWithEvents
} from '../services/eventsService.js';

const router = Router();

/**
 * Get token snapshots with their events
 * GET /api/events/token/snapshots
 */
router.get('/token/snapshots', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;
    
    console.log(`GET /token/snapshots with limit=${limit}, skip=${skip}`);
    const snapshots = await getTokenSnapshotsWithEvents(limit, skip);
    console.log(`Found ${snapshots.length} token snapshots`);
    
    res.json(snapshots);
  } catch (error: any) {
    console.error('Error fetching token snapshots with events:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch token snapshots with events' });
  }
});

/**
 * Get NFT snapshots with their events
 * GET /api/events/nft/snapshots
 */
router.get('/nft/snapshots', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;
    
    console.log(`GET /nft/snapshots with limit=${limit}, skip=${skip}`);
    const snapshots = await getNFTSnapshotsWithEvents(limit, skip);
    console.log(`Found ${snapshots.length} NFT snapshots`);
    
    res.json(snapshots);
  } catch (error: any) {
    console.error('Error fetching NFT snapshots with events:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch NFT snapshots with events' });
  }
});

export default router; 