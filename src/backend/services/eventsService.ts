import { NFTHolder, TokenHolder } from '../../types/index.js';
import { query, withTransaction } from '../db/index.js';

// Event type IDs from database
enum EventType {
  NEW_HOLDER = 1,
  TRANSFER_IN = 2,
  TRANSFER_OUT = 3,
  TRANSFER_BETWEEN = 4,
  WALLET_EMPTY = 5
}

// Map to track wallet balance changes for detecting transfers between wallets
type BalanceChange = {
  address: string;
  previousBalance: number;
  currentBalance: number;
  difference: number;
};

/**
 * Generate token events by comparing previous and current snapshot holders
 */
export async function generateTokenEvents(
  snapshotId: number,
  currentHolders: TokenHolder[],
  previousSnapshotId?: number
): Promise<void> {
  try {
    // If no previous snapshot, all current holders are new
    if (!previousSnapshotId) {
      await createNewHolderTokenEvents(snapshotId, currentHolders);
      return;
    }

    // Get previous holders
    const previousHoldersResult = await query(
      'SELECT address, balance FROM token_holders WHERE snapshot_id = $1',
      [previousSnapshotId]
    );

    const previousHolders = new Map<string, number>();
    previousHoldersResult.rows.forEach(row => {
      previousHolders.set(row.address, parseFloat(row.balance));
    });

    // Current holders map for easy lookup
    const currentHoldersMap = new Map<string, number>();
    currentHolders.forEach(holder => {
      currentHoldersMap.set(holder.address, holder.balance);
    });
    
    // Get social profile mappings to check if wallets belong to the same profile
    const socialProfilesResult = await query(`
      SELECT w.address, w.social_id 
      FROM wallet_addresses w
    `);
    
    // Create a map of wallet address to social profile ID
    const walletSocialProfiles = new Map<string, string>();
    socialProfilesResult.rows.forEach(row => {
      if (row.social_id) {
        walletSocialProfiles.set(row.address, row.social_id);
      }
    });
    
    console.log(`[Token Events] Found ${socialProfilesResult.rowCount} wallet addresses with social profiles`);
    
    // Track wallets with same profile IDs for debugging
    const profileWallets = new Map<string, string[]>();
    socialProfilesResult.rows.forEach(row => {
      if (!row.social_id) return;
      
      if (!profileWallets.has(row.social_id)) {
        profileWallets.set(row.social_id, []);
      }
      profileWallets.get(row.social_id)?.push(row.address);
    });
    
    // Log profiles with multiple wallets for debugging
    profileWallets.forEach((wallets, profileId) => {
      if (wallets.length > 1) {
        console.log(`[Token Events] Profile ${profileId} has ${wallets.length} wallets: ${wallets.join(', ')}`);
      }
    });

    // Begin transaction for all events
    await withTransaction(async (client) => {
      // First pass: identify and record all balance changes
      
      // Create tracking lists for different event types
      const newHolders: TokenHolder[] = [];
      const emptyWallets: BalanceChange[] = [];
      const decreases: BalanceChange[] = [];
      const increases: BalanceChange[] = [];

      // Check for new holders and increased balances
      for (const holder of currentHolders) {
        // Skip wallets that don't have a social profile
        const socialId = walletSocialProfiles.get(holder.address);
        if (!socialId) continue;
        
        const previousBalance = previousHolders.get(holder.address);
        
        if (previousBalance === undefined) {
          // New holder - we'll process these after checking for potential transfers
          newHolders.push(holder);
        } else if (holder.balance > previousBalance) {
          // Increased balance - track for potential transfers between accounts
          const difference = holder.balance - previousBalance;
          if (difference > 0.000001) { // Ignore tiny rounding differences
            increases.push({
              address: holder.address,
              previousBalance,
              currentBalance: holder.balance,
              difference
            });
          }
        }
      }

      // Check for decreased balances and wallets that no longer hold tokens
      for (const [address, previousBalance] of previousHolders.entries()) {
        // Skip wallets that don't have a social profile
        const socialId = walletSocialProfiles.get(address);
        if (!socialId) continue;
        
        const currentBalance = currentHoldersMap.get(address);
        
        if (currentBalance === undefined) {
          // Wallet no longer holds tokens - track for potential transfers
          if (previousBalance > 0.000001) { // Ignore tiny rounding differences
            emptyWallets.push({
              address,
              previousBalance,
              currentBalance: 0,
              difference: previousBalance
            });
          }
        } else if (currentBalance < previousBalance) {
          // Decreased balance - track for potential transfers between accounts
          const difference = previousBalance - currentBalance;
          if (difference > 0.000001) { // Ignore tiny rounding differences
            decreases.push({
              address,
              previousBalance,
              currentBalance,
              difference
            });
          }
        }
      }
      
      // Log statistics for debugging
      console.log(`[Token Events] Found ${newHolders.length} new holders, ${emptyWallets.length} empty wallets, ${decreases.length} decreases, ${increases.length} increases`);
      
      // Second pass: try to match transfers between wallets of the same social profile
      // Sort by difference amount to try to match exact transfers first
      const allDecreases = [...decreases, ...emptyWallets].sort((a, b) => b.difference - a.difference);
      increases.sort((a, b) => b.difference - a.difference);
      
      const processedDecreases = new Set<string>();
      const processedIncreases = new Set<string>();
      const processedNewHolders = new Set<string>();
      
      // First check: Find transfers between new holders and empty wallets with the same social profile
      for (const emptyWallet of emptyWallets) {
        if (processedDecreases.has(emptyWallet.address)) continue;
        
        const emptyProfileId = walletSocialProfiles.get(emptyWallet.address);
        if (!emptyProfileId) continue;
        
        // First check new holders - they might be the destination of emptied wallets
        let foundMatch = false;
        for (const newHolder of newHolders) {
          if (processedNewHolders.has(newHolder.address)) continue;
          
          const newHolderProfileId = walletSocialProfiles.get(newHolder.address);
          
          // If both wallets belong to the same social profile and have similar amounts (within 1% tolerance)
          if (newHolderProfileId && 
              emptyProfileId === newHolderProfileId &&
              Math.abs(emptyWallet.difference - newHolder.balance) < 0.01 * emptyWallet.difference) {
            
            console.log(`[Token Events] Found transfer between same-profile wallets: ${emptyWallet.address} (empty) -> ${newHolder.address} (new)`);
            console.log(`[Token Events] Amounts: ${emptyWallet.difference} -> ${newHolder.balance}`);
            
            // Create a TRANSFER_BETWEEN event
            await client.query(
              `INSERT INTO token_events 
               (snapshot_id, event_type_id, source_address, destination_address, amount, previous_balance, new_balance) 
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                snapshotId, 
                EventType.TRANSFER_BETWEEN, 
                emptyWallet.address, 
                newHolder.address, 
                emptyWallet.difference, 
                emptyWallet.previousBalance,
                0
              ]
            );
            
            processedDecreases.add(emptyWallet.address);
            processedNewHolders.add(newHolder.address);
            foundMatch = true;
            break;
          }
        }
        
        // If not found in new holders, check for increases
        if (!foundMatch) {
          for (const increase of increases) {
            if (processedIncreases.has(increase.address)) continue;
            
            const increaseProfileId = walletSocialProfiles.get(increase.address);
            
            // If both wallets belong to the same social profile and have similar amounts (within 1% tolerance)
            if (increaseProfileId && 
                emptyProfileId === increaseProfileId &&
                Math.abs(emptyWallet.difference - increase.difference) < 0.01 * emptyWallet.difference) {
              
              console.log(`[Token Events] Found transfer between same-profile wallets: ${emptyWallet.address} (empty) -> ${increase.address}`);
              console.log(`[Token Events] Amounts: ${emptyWallet.difference} -> ${increase.difference}`);
              
              // Create a TRANSFER_BETWEEN event
              await client.query(
                `INSERT INTO token_events 
                (snapshot_id, event_type_id, source_address, destination_address, amount, previous_balance, new_balance) 
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                  snapshotId, 
                  EventType.TRANSFER_BETWEEN, 
                  emptyWallet.address, 
                  increase.address, 
                  emptyWallet.difference, 
                  emptyWallet.previousBalance,
                  0
                ]
              );
              
              processedDecreases.add(emptyWallet.address);
              processedIncreases.add(increase.address);
              break;
            }
          }
        }
      }
      
      // Next, match decreases with new holders of the same social profile
      for (const decrease of decreases) {
        if (processedDecreases.has(decrease.address)) continue;
        
        const decreaseProfileId = walletSocialProfiles.get(decrease.address);
        if (!decreaseProfileId) continue;
        
        // First check new holders for the destination
        let foundMatch = false;
        for (const newHolder of newHolders) {
          if (processedNewHolders.has(newHolder.address)) continue;
          
          const newHolderProfileId = walletSocialProfiles.get(newHolder.address);
          
          // If both wallets belong to the same social profile and have similar amounts (within 1% tolerance)
          if (newHolderProfileId && 
              decreaseProfileId === newHolderProfileId &&
              Math.abs(decrease.difference - newHolder.balance) < 0.01 * decrease.difference) {
            
            console.log(`[Token Events] Found transfer between same-profile wallets: ${decrease.address} -> ${newHolder.address} (new)`);
            console.log(`[Token Events] Amounts: ${decrease.difference} -> ${newHolder.balance}`);
            
            // Create a TRANSFER_BETWEEN event
            await client.query(
              `INSERT INTO token_events 
               (snapshot_id, event_type_id, source_address, destination_address, amount, previous_balance, new_balance) 
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                snapshotId, 
                EventType.TRANSFER_BETWEEN, 
                decrease.address, 
                newHolder.address, 
                decrease.difference, 
                decrease.previousBalance,
                decrease.currentBalance
              ]
            );
            
            processedDecreases.add(decrease.address);
            processedNewHolders.add(newHolder.address);
            foundMatch = true;
            break;
          }
        }
        
        // If not found in new holders, check for increases
        if (!foundMatch) {
          for (const increase of increases) {
            if (processedIncreases.has(increase.address)) continue;
            
            const increaseProfileId = walletSocialProfiles.get(increase.address);
            
            // If both wallets belong to the same social profile and have similar amounts (within 1% tolerance)
            if (increaseProfileId && 
                decreaseProfileId === increaseProfileId &&
                Math.abs(decrease.difference - increase.difference) < 0.01 * decrease.difference) {
              
              console.log(`[Token Events] Found transfer between same-profile wallets: ${decrease.address} -> ${increase.address}`);
              console.log(`[Token Events] Amounts: ${decrease.difference} -> ${increase.difference}`);
              
              // Create a TRANSFER_BETWEEN event
              await client.query(
                `INSERT INTO token_events 
                (snapshot_id, event_type_id, source_address, destination_address, amount, previous_balance, new_balance) 
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                  snapshotId, 
                  EventType.TRANSFER_BETWEEN, 
                  decrease.address, 
                  increase.address, 
                  decrease.difference, 
                  decrease.previousBalance,
                  decrease.currentBalance
                ]
              );
              
              processedDecreases.add(decrease.address);
              processedIncreases.add(increase.address);
              break;
            }
          }
        }
      }
      
      // Process new holders (that weren't part of transfers)
      for (const holder of newHolders) {
        if (!processedNewHolders.has(holder.address)) {
          await client.query(
            `INSERT INTO token_events 
             (snapshot_id, event_type_id, destination_address, amount, new_balance) 
             VALUES ($1, $2, $3, $4, $5)`,
            [snapshotId, EventType.NEW_HOLDER, holder.address, holder.balance, holder.balance]
          );
        }
      }
      
      // Process remaining unmatched empty wallets
      for (const emptyWallet of emptyWallets) {
        if (!processedDecreases.has(emptyWallet.address)) {
          await client.query(
            `INSERT INTO token_events 
             (snapshot_id, event_type_id, source_address, amount, previous_balance, new_balance) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [snapshotId, EventType.WALLET_EMPTY, emptyWallet.address, emptyWallet.previousBalance, emptyWallet.previousBalance, 0]
          );
        }
      }
      
      // Process remaining unmatched decreases
      for (const decrease of decreases) {
        if (!processedDecreases.has(decrease.address)) {
          await client.query(
            `INSERT INTO token_events 
             (snapshot_id, event_type_id, source_address, amount, previous_balance, new_balance) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              snapshotId, 
              EventType.TRANSFER_OUT, 
              decrease.address, 
              decrease.difference, 
              decrease.previousBalance, 
              decrease.currentBalance
            ]
          );
        }
      }
      
      // Process remaining unmatched increases
      for (const increase of increases) {
        if (!processedIncreases.has(increase.address)) {
          await client.query(
            `INSERT INTO token_events 
             (snapshot_id, event_type_id, destination_address, amount, previous_balance, new_balance) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              snapshotId, 
              EventType.TRANSFER_IN, 
              increase.address, 
              increase.difference, 
              increase.previousBalance, 
              increase.currentBalance
            ]
          );
        }
      }
    });

    console.log(`Generated token events for snapshot ${snapshotId}`);
  } catch (error) {
    console.error('Error generating token events:', error);
  }
}

/**
 * Create new holder events for all token holders (when there's no previous snapshot)
 */
async function createNewHolderTokenEvents(
  snapshotId: number,
  holders: TokenHolder[]
): Promise<void> {
  try {
    // Get social profile mappings
    const socialProfilesResult = await query(`
      SELECT w.address, w.social_id 
      FROM wallet_addresses w
    `);
    
    // Create a map of wallet address to social profile ID
    const walletSocialProfiles = new Map<string, string>();
    socialProfilesResult.rows.forEach(row => {
      if (row.social_id) {
        walletSocialProfiles.set(row.address, row.social_id);
      }
    });
    
    await withTransaction(async (client) => {
      for (const holder of holders) {
        // Skip wallets without a social profile
        const socialId = walletSocialProfiles.get(holder.address);
        if (!socialId) continue;
        
        await client.query(
          `INSERT INTO token_events 
           (snapshot_id, event_type_id, destination_address, amount, new_balance) 
           VALUES ($1, $2, $3, $4, $5)`,
          [snapshotId, EventType.NEW_HOLDER, holder.address, holder.balance, holder.balance]
        );
      }
    });
    
    console.log(`Created new holder events for token holders in snapshot ${snapshotId}`);
  } catch (error) {
    console.error('Error creating new holder token events:', error);
  }
}

/**
 * Generate NFT events by comparing previous and current snapshot holders
 */
export async function generateNFTEvents(
  snapshotId: number,
  currentHolders: NFTHolder[],
  previousSnapshotId?: number
): Promise<void> {
  try {
    // If no previous snapshot, all current holders are new
    if (!previousSnapshotId) {
      await createNewHolderNFTEvents(snapshotId, currentHolders);
      return;
    }

    // Get social profile mappings
    const socialProfilesResult = await query(`
      SELECT w.address, w.social_id 
      FROM wallet_addresses w
    `);
    
    // Create a map of wallet address to social profile ID
    const walletSocialProfiles = new Map<string, string>();
    socialProfilesResult.rows.forEach(row => {
      if (row.social_id) {
        walletSocialProfiles.set(row.address, row.social_id);
      }
    });

    // Get previous NFT ownership data
    const previousOwnershipResult = await query(
      'SELECT mint, owner_address FROM nft_ownership WHERE snapshot_id = $1',
      [previousSnapshotId]
    );

    // Map NFTs to their previous owners
    const previousOwnership = new Map<string, string>();
    previousOwnershipResult.rows.forEach(row => {
      previousOwnership.set(row.mint, row.owner_address);
    });

    // Get current ownership information
    const currentOwnershipResult = await query(
      'SELECT mint, owner_address FROM nft_ownership WHERE snapshot_id = $1',
      [snapshotId]
    );

    // Map NFTs to their current owners
    const currentOwnership = new Map<string, string>();
    currentOwnershipResult.rows.forEach(row => {
      currentOwnership.set(row.mint, row.owner_address);
    });

    // Begin transaction for all events
    await withTransaction(async (client) => {
      // Check for NFT transfers
      for (const [mint, currentOwner] of currentOwnership.entries()) {
        // Skip if current owner doesn't have a social profile
        const currentOwnerSocialId = walletSocialProfiles.get(currentOwner);
        if (!currentOwnerSocialId) continue;
        
        const previousOwner = previousOwnership.get(mint);
        
        if (!previousOwner) {
          // New NFT or new owner (first time tracked)
          await client.query(
            `INSERT INTO nft_events 
             (snapshot_id, event_type_id, mint, destination_address) 
             VALUES ($1, $2, $3, $4)`,
            [snapshotId, EventType.NEW_HOLDER, mint, currentOwner]
          );
        } else if (previousOwner !== currentOwner) {
          // Skip if previous owner didn't have a social profile
          const previousOwnerSocialId = walletSocialProfiles.get(previousOwner);
          if (!previousOwnerSocialId) continue;
          
          // NFT changed hands - if same social profile, it's a transfer between
          if (previousOwnerSocialId === currentOwnerSocialId) {
            await client.query(
              `INSERT INTO nft_events 
               (snapshot_id, event_type_id, mint, source_address, destination_address) 
               VALUES ($1, $2, $3, $4, $5)`,
              [snapshotId, EventType.TRANSFER_BETWEEN, mint, previousOwner, currentOwner]
            );
          } else {
            // Different social profiles - it's a true transfer
            await client.query(
              `INSERT INTO nft_events 
               (snapshot_id, event_type_id, mint, source_address, destination_address) 
               VALUES ($1, $2, $3, $4, $5)`,
              [snapshotId, EventType.TRANSFER_BETWEEN, mint, previousOwner, currentOwner]
            );
          }
        }
      }

      // Check for NFTs that are no longer in the current snapshot
      for (const [mint, previousOwner] of previousOwnership.entries()) {
        if (!currentOwnership.has(mint)) {
          // Skip if previous owner didn't have a social profile
          const previousOwnerSocialId = walletSocialProfiles.get(previousOwner);
          if (!previousOwnerSocialId) continue;
          
          // NFT is no longer in the snapshot
          await client.query(
            `INSERT INTO nft_events 
             (snapshot_id, event_type_id, mint, source_address) 
             VALUES ($1, $2, $3, $4)`,
            [snapshotId, EventType.WALLET_EMPTY, mint, previousOwner]
          );
        }
      }
    });

    console.log(`Generated NFT events for snapshot ${snapshotId}`);
  } catch (error) {
    console.error('Error generating NFT events:', error);
  }
}

/**
 * Create new holder events for all NFT holders (when there's no previous snapshot)
 */
async function createNewHolderNFTEvents(
  snapshotId: number,
  holders: NFTHolder[]
): Promise<void> {
  try {
    // Get social profile mappings
    const socialProfilesResult = await query(`
      SELECT w.address, w.social_id 
      FROM wallet_addresses w
    `);
    
    // Create a map of wallet address to social profile ID
    const walletSocialProfiles = new Map<string, string>();
    socialProfilesResult.rows.forEach(row => {
      if (row.social_id) {
        walletSocialProfiles.set(row.address, row.social_id);
      }
    });
    
    await withTransaction(async (client) => {
      for (const holder of holders) {
        // Skip holders without a social profile
        const socialId = walletSocialProfiles.get(holder.address);
        if (!socialId) continue;
        
        // For each NFT owned by this holder
        for (const nft of holder.nfts) {
          await client.query(
            `INSERT INTO nft_events 
             (snapshot_id, event_type_id, mint, destination_address) 
             VALUES ($1, $2, $3, $4)`,
            [snapshotId, EventType.NEW_HOLDER, nft.mint, holder.address]
          );
        }
      }
    });
    
    console.log(`Created new holder events for NFT holders in snapshot ${snapshotId}`);
  } catch (error) {
    console.error('Error creating new holder NFT events:', error);
  }
}

/**
 * Fetch token events for a specific snapshot
 */
export async function getTokenEventsForSnapshot(snapshotId: number) {
  try {
    const result = await query(`
      SELECT 
        e.id, e.timestamp as event_timestamp, t.name as event_type, 
        e.source_address, e.destination_address,
        e.amount, e.previous_balance, e.new_balance,
        s.id as snapshot_id, s.timestamp as snapshot_timestamp,
        s.total_supply, s.token_address,
        sp_source.twitter as source_twitter, sp_source.discord as source_discord,
        sp_dest.twitter as dest_twitter, sp_dest.discord as dest_discord,
        CASE
          WHEN sp_source.id = sp_dest.id AND sp_source.id IS NOT NULL THEN sp_source.twitter
          ELSE NULL
        END as twitter,
        CASE
          WHEN sp_source.id = sp_dest.id AND sp_source.id IS NOT NULL THEN sp_source.discord
          ELSE NULL
        END as discord,
        CASE
          WHEN sp_source.id = sp_dest.id AND sp_source.id IS NOT NULL THEN sp_source.comment
          ELSE NULL
        END as comment
      FROM token_events e
      JOIN event_types t ON e.event_type_id = t.id
      JOIN token_snapshots s ON e.snapshot_id = s.id
      LEFT JOIN wallet_addresses wa_source ON e.source_address = wa_source.address
      LEFT JOIN social_profiles sp_source ON wa_source.social_id = sp_source.id
      LEFT JOIN wallet_addresses wa_dest ON e.destination_address = wa_dest.address
      LEFT JOIN social_profiles sp_dest ON wa_dest.social_id = sp_dest.id
      WHERE e.snapshot_id = $1
      ORDER BY e.timestamp DESC
    `, [snapshotId]);
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching token events:', error);
    return [];
  }
}

/**
 * Fetch NFT events for a specific snapshot
 */
export async function getNFTEventsForSnapshot(snapshotId: number) {
  try {
    const result = await query(`
      SELECT 
        e.id, e.timestamp as event_timestamp, t.name as event_type, 
        e.mint, n.name as nft_name, n.type as nft_type,
        e.source_address, e.destination_address,
        s.id as snapshot_id, s.timestamp as snapshot_timestamp,
        s.total_count,
        sp_source.twitter as source_twitter, sp_source.discord as source_discord,
        sp_dest.twitter as dest_twitter, sp_dest.discord as dest_discord,
        CASE
          WHEN sp_source.id = sp_dest.id AND sp_source.id IS NOT NULL THEN sp_source.twitter
          ELSE NULL
        END as twitter,
        CASE
          WHEN sp_source.id = sp_dest.id AND sp_source.id IS NOT NULL THEN sp_source.discord
          ELSE NULL
        END as discord,
        CASE
          WHEN sp_source.id = sp_dest.id AND sp_source.id IS NOT NULL THEN sp_source.comment
          ELSE NULL
        END as comment
      FROM nft_events e
      JOIN event_types t ON e.event_type_id = t.id
      JOIN nfts n ON e.mint = n.mint
      JOIN nft_snapshots s ON e.snapshot_id = s.id
      LEFT JOIN wallet_addresses wa_source ON e.source_address = wa_source.address
      LEFT JOIN social_profiles sp_source ON wa_source.social_id = sp_source.id
      LEFT JOIN wallet_addresses wa_dest ON e.destination_address = wa_dest.address
      LEFT JOIN social_profiles sp_dest ON wa_dest.social_id = sp_dest.id
      WHERE e.snapshot_id = $1
      ORDER BY e.timestamp DESC
    `, [snapshotId]);
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching NFT events:', error);
    return [];
  }
}

/**
 * Get latest token snapshots with their events
 * Returns a list of snapshots with associated events
 */
export async function getTokenSnapshotsWithEvents(limit: number = 5, skip: number = 0) {
  try {
    // First get the most recent snapshots with pagination
    const snapshotsResult = await query(`
      SELECT id, timestamp, token_address, total_supply
      FROM token_snapshots
      ORDER BY timestamp DESC
      LIMIT $1 OFFSET $2
    `, [limit, skip]);
    
    if (snapshotsResult.rowCount === 0) {
      return [];
    }
    
    // For each snapshot, get the events
    const snapshotsWithEvents = await Promise.all(
      snapshotsResult.rows.map(async (snapshot) => {
        const events = await getTokenEventsForSnapshot(snapshot.id);
        return {
          ...snapshot,
          events
        };
      })
    );
    
    return snapshotsWithEvents;
  } catch (error) {
    console.error('Error fetching token snapshots with events:', error);
    return [];
  }
}

/**
 * Get latest NFT snapshots with their events
 * Returns a list of snapshots with associated events
 */
export async function getNFTSnapshotsWithEvents(limit: number = 5, skip: number = 0) {
  try {
    // First get the most recent snapshots with pagination
    const snapshotsResult = await query(`
      SELECT id, timestamp, total_count
      FROM nft_snapshots
      ORDER BY timestamp DESC
      LIMIT $1 OFFSET $2
    `, [limit, skip]);
    
    if (snapshotsResult.rowCount === 0) {
      return [];
    }
    
    // For each snapshot, get the events
    const snapshotsWithEvents = await Promise.all(
      snapshotsResult.rows.map(async (snapshot) => {
        const events = await getNFTEventsForSnapshot(snapshot.id);
        return {
          ...snapshot,
          events
        };
      })
    );
    
    return snapshotsWithEvents;
  } catch (error) {
    console.error('Error fetching NFT snapshots with events:', error);
    return [];
  }
} 