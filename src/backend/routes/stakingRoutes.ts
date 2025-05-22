import express from 'express';

import {
  createStakingSnapshot,
  getFilteredStakingData,
  getUnlockSummary,
  loadStakingSnapshot,
} from '../services/stakingService.js';

const router = express.Router();

/**
 * GET /api/staking
 * Get staking data with optional filtering
 */
router.get('/staking', async (req, res) => {
  try {
    const { search, limit, snapshotId } = req.query;
    const searchTerm = search ? String(search) : undefined;
    const limitNum = limit ? parseInt(String(limit), 10) : undefined;
    const snapshotIdNum = snapshotId ? parseInt(String(snapshotId), 10) : undefined;

    const stakingData = await getFilteredStakingData(searchTerm, limitNum, snapshotIdNum);
    return res.json(stakingData);
  } catch (error: any) {
    console.error('Error fetching staking data:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch staking data' });
  }
});

/**
 * POST /api/staking-snapshot
 * Create a new staking snapshot
 */
router.post('/staking-snapshot', async (req, res) => {
  try {
    const snapshot = await createStakingSnapshot();
    return res.json(snapshot);
  } catch (error: any) {
    console.error('Error creating staking snapshot:', error);
    return res.status(500).json({ error: error.message || 'Failed to create staking snapshot' });
  }
});

/**
 * GET /api/staking-snapshots
 * Get list of staking snapshots
 */
router.get('/staking-snapshots', async (req, res) => {
  try {
    // Query database for snapshot metadata (without the full data)
    const { query } = await import('../db/index.js');
    const result = await query(`
      SELECT 
        id, 
        contract_address AS "contractAddress", 
        timestamp, 
        total_staked AS "totalStaked", 
        total_locked AS "totalLocked", 
        total_unlocked AS "totalUnlocked"
      FROM 
        staking_snapshots
      ORDER BY 
        timestamp DESC
    `);

    return res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching staking snapshots:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch staking snapshots' });
  }
});

/**
 * GET /api/staking-snapshot/:id
 * Get a specific staking snapshot
 */
router.get('/staking-snapshot/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid snapshot ID' });
    }

    const snapshot = await loadStakingSnapshot(id);
    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    return res.json(snapshot);
  } catch (error: any) {
    console.error('Error fetching staking snapshot:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch staking snapshot' });
  }
});

/**
 * GET /api/staking-unlock-summary
 * Get summary of upcoming unlock dates and amounts
 */
router.get('/staking-unlock-summary', async (req, res) => {
  try {
    const { snapshotId } = req.query;
    const snapshotIdNum = snapshotId ? parseInt(String(snapshotId), 10) : undefined;

    const summary = await getUnlockSummary(snapshotIdNum);
    return res.json(summary);
  } catch (error: any) {
    console.error('Error fetching unlock summary:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch unlock summary' });
  }
});

export default router;
