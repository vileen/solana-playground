/**
 * Script to verify and regenerate NFT events
 * This script will get the latest NFT snapshot, fetch events for it, and optionally regenerate events
 */
import { config as dotenvConfig } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { query } from '../db/index.js';
import { generateNFTEvents, getNFTEventsForSnapshot } from '../services/eventsService.js';
import { loadHolderSnapshot } from '../services/nftCollectionsDb.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');

// Load environment variables from .env.local
console.log('Loading environment variables from .env.local');
dotenvConfig({ path: join(rootDir, '.env.local') });

/**
 * Verify and regenerate NFT events for a snapshot
 */
async function verifyNftEvents(regenerateEvents: boolean = false) {
  try {
    // Get the latest snapshot
    console.log('Loading latest NFT snapshot...');
    const snapshot = await loadHolderSnapshot();

    if (!snapshot) {
      console.error('No NFT snapshot found in the database');
      return;
    }

    console.log(`Found snapshot from ${new Date(snapshot.timestamp).toLocaleString()}`);
    console.log(`Total NFTs: ${snapshot.total}`);
    console.log(`Total holders: ${snapshot.holders.length}`);

    // Get the snapshot ID from the database
    const snapshotResult = await query(
      `SELECT id, timestamp FROM nft_snapshots ORDER BY timestamp DESC LIMIT 1`
    );

    if (snapshotResult.rowCount === 0) {
      console.error('Could not find snapshot ID in the database');
      return;
    }

    const snapshotId = snapshotResult.rows[0].id;
    console.log(`Snapshot ID: ${snapshotId}`);

    // Get the previous snapshot ID (if any)
    const previousSnapshotResult = await query(
      `SELECT id FROM nft_snapshots 
       WHERE timestamp < (SELECT timestamp FROM nft_snapshots WHERE id = $1)
       ORDER BY timestamp DESC LIMIT 1`,
      [snapshotId]
    );

    const previousSnapshotId =
      previousSnapshotResult.rowCount > 0 ? previousSnapshotResult.rows[0].id : undefined;

    console.log(`Previous snapshot ID: ${previousSnapshotId || 'None'}`);

    // Get existing events for this snapshot
    console.log('Fetching existing NFT events for this snapshot...');
    const events = await getNFTEventsForSnapshot(snapshotId);
    console.log(`Found ${events.length} existing events`);

    // Categorize events
    const newHolderEvents = events.filter(e => e.event_type === 'new_holder');
    const transferEvents = events.filter(e => e.event_type === 'transfer_between');
    const emptyEvents = events.filter(e => e.event_type === 'wallet_empty');

    console.log(`Event breakdown:`);
    console.log(`  - New holder events: ${newHolderEvents.length}`);
    console.log(`  - Transfer events: ${transferEvents.length}`);
    console.log(`  - Empty wallet events: ${emptyEvents.length}`);

    // If regenerating events, first delete existing ones
    if (regenerateEvents) {
      console.log('Regenerating events...');

      // Delete existing events
      console.log('Deleting existing events...');
      await query('DELETE FROM nft_events WHERE snapshot_id = $1', [snapshotId]);
      console.log('Existing events deleted');

      // Regenerate events
      console.log('Regenerating NFT events...');
      await generateNFTEvents(snapshotId, snapshot.holders, previousSnapshotId);

      // Get new events count
      const newEventsResult = await query(
        'SELECT COUNT(*) as count FROM nft_events WHERE snapshot_id = $1',
        [snapshotId]
      );

      console.log(`Regenerated ${newEventsResult.rows[0].count} events`);
    }

    return { events, snapshot };
  } catch (error) {
    console.error('Error verifying NFT events:', error);
    throw error;
  }
}

// Command line argument to regenerate events
const regenerate = process.argv.includes('--regenerate');

// Run the script
verifyNftEvents(regenerate)
  .then(() => {
    console.log('Verification complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
