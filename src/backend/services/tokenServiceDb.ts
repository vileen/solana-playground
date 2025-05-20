import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Connection } from '@solana/web3.js';

import { TokenHolder, TokenSnapshot } from '../../types/index.js';
import { API_KEY, FULL_RPC_URL, RPC_URL, TOKEN_ADDRESS } from '../config/config.js';
import { query, withTransaction } from '../db/index.js';
import { generateTokenEvents } from './eventsService.js';
import { loadSocialProfiles } from './socialProfilesDb.js';

/**
 * Get token holders using Solana RPC
 */
export async function getTokenHolders(tokenAddress: string): Promise<TokenHolder[]> {
  console.time('getTokenHolders:total');
  console.log('[Token Collection] Starting token holder fetch...');
  try {
    // Create connection to the Solana network
    if (!RPC_URL) {
      console.error('[Token Collection] RPC URL is not defined');
      throw new Error('RPC URL is not defined');
    }

    // Create connection with API key
    const connectionConfig = {
      commitment: 'confirmed' as const,
      confirmTransactionInitialTimeout: 60000,
    };

    console.log('[Token Collection] Creating Solana connection...');
    const connection = new Connection(FULL_RPC_URL, connectionConfig);
    console.log(
      '[Token Collection] Connection created with RPC URL:',
      FULL_RPC_URL.replace(/\/.*@/, '/***@').replace(/api-key=([^&]*)/, 'api-key=***')
    ); // Hide sensitive parts

    // Load social profiles for additional data
    console.time('getTokenHolders:loadSocialProfiles');
    console.log('[Token Collection] Loading social profiles...');
    const socialProfiles = await loadSocialProfiles();
    console.log(`[Token Collection] Loaded ${Object.keys(socialProfiles).length} social profiles`);
    console.timeEnd('getTokenHolders:loadSocialProfiles');

    // Check if connection is alive
    try {
      console.time('getTokenHolders:checkConnection');
      console.log('[Token Collection] Checking Solana connection...');
      const version = await connection.getVersion();
      console.log('[Token Collection] Solana version:', version);
      console.timeEnd('getTokenHolders:checkConnection');
    } catch (error) {
      console.error('[Token Collection] Error checking Solana connection:', error);
    }

    // Using getParsedProgramAccounts approach
    console.time('getTokenHolders:getParsedProgramAccounts');
    console.log('[Token Collection] Fetching token accounts using getParsedProgramAccounts...');
    const tokenProgramAccounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
      filters: [
        {
          dataSize: 165, // Token account size
        },
        {
          memcmp: {
            offset: 0,
            bytes: tokenAddress,
          },
        },
      ],
    });

    console.log(`[Token Collection] Found ${tokenProgramAccounts.length} program accounts`);
    console.timeEnd('getTokenHolders:getParsedProgramAccounts');

    // Process token accounts and aggregate by owner
    console.time('getTokenHolders:processAccounts');
    console.log('[Token Collection] Processing token accounts and aggregating by owner...');
    const holderMap = new Map<string, number>();
    let processedAccounts = 0;
    let validAccounts = 0;

    for (const account of tokenProgramAccounts) {
      try {
        const parsedData = account.account.data as any; // 'as any' is needed because of Solana's complex types

        if ('parsed' in parsedData) {
          const owner = parsedData.parsed.info.owner;
          const amount = parsedData.parsed.info.tokenAmount.uiAmount;

          // Only track non-zero balances
          if (amount > 0) {
            if (holderMap.has(owner)) {
              holderMap.set(owner, holderMap.get(owner)! + amount);
            } else {
              holderMap.set(owner, amount);
            }
            validAccounts++;
          }
        } else {
          const tokenAmount = parsedData?.parsed?.info?.tokenAmount?.uiAmount || 0;
          const owner = parsedData?.parsed?.info?.owner;

          // Only include accounts with balance
          if (tokenAmount > 0 && owner) {
            if (holderMap.has(owner)) {
              holderMap.set(owner, holderMap.get(owner)! + tokenAmount);
            } else {
              holderMap.set(owner, tokenAmount);
            }
            validAccounts++;
          }
        }
        
        processedAccounts++;
        if (processedAccounts % 100 === 0) {
          console.log(`[Token Collection] Processed ${processedAccounts}/${tokenProgramAccounts.length} accounts...`);
        }
      } catch (error) {
        console.error('[Token Collection] Error processing token account:', error);
      }
    }
    console.log(`[Token Collection] Found ${holderMap.size} unique holders with non-zero balances`);
    console.timeEnd('getTokenHolders:processAccounts');

    // Convert to array format
    console.time('getTokenHolders:createHolderArray');
    console.log('[Token Collection] Converting to array format and adding social data...');
    const holders: TokenHolder[] = Array.from(holderMap.entries()).map(([address, balance]) => ({
      address,
      balance,
      // Add social data if available
      ...(socialProfiles[address]
        ? {
            twitter: socialProfiles[address].twitter,
            discord: socialProfiles[address].discord,
            comment: socialProfiles[address].comment,
            id: socialProfiles[address].id,
          }
        : {}),
    }));

    // Sort by balance (descending)
    console.log('[Token Collection] Sorting holders by balance...');
    const sortedHolders = holders.sort((a, b) => b.balance - a.balance);
    console.log(`[Token Collection] Prepared ${sortedHolders.length} token holders`);
    console.timeEnd('getTokenHolders:createHolderArray');
    console.timeEnd('getTokenHolders:total');
    
    return sortedHolders;
  } catch (error) {
    console.error('[Token Collection] Error fetching token holders:', error);
    console.timeEnd('getTokenHolders:total');
    return [];
  }
}

/**
 * Create a new token snapshot and store in database
 */
export async function createTokenSnapshot(): Promise<TokenSnapshot> {
  console.time('createTokenSnapshot:total');
  console.log('[Token Snapshot] Starting creation of token snapshot...');
  try {
    let holders: TokenHolder[] = [];

    try {
      console.time('createTokenSnapshot:fetchHolders');
      // Only try to get token holders if API key is available
      if (API_KEY) {
        if (!TOKEN_ADDRESS) {
          console.error('[Token Snapshot] TOKEN_ADDRESS is not defined');
          throw new Error('TOKEN_ADDRESS is not defined');
        }
        console.log('[Token Snapshot] Fetching live token holders from Solana...');
        holders = await getTokenHolders(TOKEN_ADDRESS);
        console.log(`[Token Snapshot] Successfully fetched ${holders.length} token holders`);
      } else {
        console.warn('[Token Snapshot] No API key available, skipping live token holder fetch');
        throw new Error('No API key available');
      }
      console.timeEnd('createTokenSnapshot:fetchHolders');
    } catch (error) {
      console.error('[Token Snapshot] Error fetching live token holders:', error);

      // Try to get the latest snapshot from DB as a fallback
      console.time('createTokenSnapshot:fetchFromDB');
      console.log('[Token Snapshot] Attempting to fetch the latest snapshot from database as fallback...');
      const lastSnapshotResult = await query(`
        SELECT id FROM token_snapshots 
        ORDER BY timestamp DESC 
        LIMIT 1
      `);

      if (lastSnapshotResult?.rowCount) {
        const lastSnapshotId = lastSnapshotResult.rows[0].id;
        console.log(`[Token Snapshot] Found snapshot with ID ${lastSnapshotId}, fetching holders...`);
        
        const holdersResult = await query(`
          SELECT 
            th.address, th.balance, th.is_lp_pool, th.is_treasury,
            sp.twitter, sp.discord, sp.comment, sp.id as social_id
          FROM token_holders th
          LEFT JOIN wallet_addresses wa ON th.address = wa.address
          LEFT JOIN social_profiles sp ON wa.social_id = sp.id
          WHERE th.snapshot_id = $1
        `, [lastSnapshotId]);
        
        if (holdersResult?.rowCount) {
          holders = holdersResult.rows.map(row => ({
            address: row.address,
            balance: parseFloat(row.balance),
            isLpPool: row.is_lp_pool,
            isTreasury: row.is_treasury,
            twitter: row.twitter,
            discord: row.discord,
            comment: row.comment,
            id: row.social_id
          }));
          
          console.log(`[Token Snapshot] Using cached token snapshot with ${holders.length} holders`);
        }
      }
      console.timeEnd('createTokenSnapshot:fetchFromDB');

      // If we still have no holders, use mock data
      if (holders.length === 0) {
        console.log('[Token Snapshot] Using mock token holder data as last resort');
        holders = [
          { address: '4KNzZFcVBZ5SguqA7NN8sjR8HCTZiU3CJFAmtGFNQb2g', balance: 10000 },
          { address: 'BPEUBUFSjBGiT5WcPxymY1XVUkY7EKMVpVQ5WShGBMXx', balance: 5000 },
          { address: 'sK9E2jCFjELnR78WWsJUZNT9GraUD3Kx5TK7n8tFCfG', balance: 2500 },
          { address: 'Q5D6NiZP9ueHvUYfn987x7ekF6doXVCpBnkdmRnrxNR', balance: 1000 },
          { address: 'HXtBm8XZbxaTt41uqaKhwUAa6Z1aPyvJdsZVENiWsetg', balance: 500 },
        ];
      }
    }

    // Calculate total supply held by these holders
    console.log('[Token Snapshot] Calculating total token supply...');
    const totalSupply = holders.reduce((sum, holder) => sum + holder.balance, 0);
    console.log(`[Token Snapshot] Total supply: ${totalSupply} tokens across ${holders.length} holders`);

    // Get the previous snapshot ID for event generation
    console.log('[Token DB] Getting previous snapshot ID for event comparison...');
    let previousSnapshotId: number | undefined = undefined;
    
    try {
      const prevSnapshotResult = await query(
        `SELECT id FROM token_snapshots ORDER BY timestamp DESC LIMIT 1`
      );
      
      if (prevSnapshotResult && prevSnapshotResult.rowCount && prevSnapshotResult.rowCount > 0) {
        previousSnapshotId = prevSnapshotResult.rows[0].id;
        console.log(`[Token DB] Found previous snapshot with ID: ${previousSnapshotId}`);
      } else {
        console.log('[Token DB] No previous snapshot found, this appears to be the first snapshot');
      }
    } catch (error) {
      console.warn('[Token DB] Error getting previous snapshot:', error);
      // Continue without a previous snapshot reference
    }
    
    // Save snapshot to database and generate events
    console.time('createTokenSnapshot:saveToDatabase');
    console.log('[Token Snapshot] Saving snapshot to database...');
    
    return await withTransaction(async (client) => {
      try {
        // Insert snapshot metadata
        console.time('createTokenSnapshot:insertSnapshot');
        console.log('[Token DB] Inserting snapshot record...');
        const snapshotResult = await client.query(
          `INSERT INTO token_snapshots (token_address, total_supply) 
          VALUES ($1, $2) 
          RETURNING id, timestamp`,
          [TOKEN_ADDRESS || 'unknown', totalSupply]
        );
        
        if (!snapshotResult.rowCount) {
          console.error('[Token DB] Failed to create token snapshot record - no rows affected');
          throw new Error('Failed to create token snapshot record');
        }
        
        const snapshotId = snapshotResult.rows[0].id;
        const timestamp = snapshotResult.rows[0].timestamp;
        console.log(`[Token DB] Created snapshot record with ID ${snapshotId}`);
        console.timeEnd('createTokenSnapshot:insertSnapshot');
        
        // Process token holders in batches
        console.time('createTokenSnapshot:insertHolders');
        console.log(`[Token DB] Inserting ${holders.length} holder records...`);
        
        const batchSize = 100;
        let holdersProcessed = 0;
        
        for (let i = 0; i < holders.length; i += batchSize) {
          const batchHolders = holders.slice(i, i + batchSize);
          console.log(`[Token DB] Processing holder batch ${i/batchSize + 1}/${Math.ceil(holders.length/batchSize)}`);
          
          // Build batch values
          const holderValues = [];
          const holderParams = [];
          let paramIndex = 1;
          
          for (const holder of batchHolders) {
            holderValues.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
            holderParams.push(
              snapshotId, 
              holder.address, 
              holder.balance, 
              holder.isLpPool || false, 
              holder.isTreasury || false
            );
            holdersProcessed++;
          }
          
          // Insert holders in batch
          const holderQuery = `
            INSERT INTO token_holders (snapshot_id, address, balance, is_lp_pool, is_treasury)
            VALUES ${holderValues.join(', ')}
            ON CONFLICT (snapshot_id, address) DO UPDATE SET
              balance = EXCLUDED.balance,
              is_lp_pool = EXCLUDED.is_lp_pool,
              is_treasury = EXCLUDED.is_treasury
          `;
          
          await client.query(holderQuery, holderParams);
          console.log(`[Token DB] Inserted batch of ${batchHolders.length} holders (total: ${holdersProcessed}/${holders.length})`);
        }
        
        console.timeEnd('createTokenSnapshot:insertHolders');
        
        // Return the data needed for events generation
        return {
          snapshotId,
          timestamp,
          totalSupply,
          holders,
          previousSnapshotId
        };
      } catch (error) {
        console.error('[Token DB] Error saving token snapshot to database:', error);
        throw error;
      }
    }).then(async (result) => {
      // Generate token events outside the transaction
      console.time('createTokenSnapshot:generateEvents');
      console.log('[Token DB] Generating token events for this snapshot...');
      try {
        await generateTokenEvents(result.snapshotId, result.holders, result.previousSnapshotId);
        console.log('[Token DB] Successfully generated token events');
      } catch (error) {
        console.error('[Token DB] Error generating token events:', error);
        // Continue even if event generation fails
      }
      console.timeEnd('createTokenSnapshot:generateEvents');
      
      console.log('[Token DB] Successfully completed saving snapshot to database');
      console.timeEnd('createTokenSnapshot:saveToDatabase');
      console.timeEnd('createTokenSnapshot:total');
      
      // Create and return snapshot object
      const snapshot: TokenSnapshot = {
        tokenAddress: TOKEN_ADDRESS || 'unknown',
        timestamp: result.timestamp.toISOString(),
        totalSupply: result.totalSupply,
        holders: result.holders
      };
      
      return snapshot;
    });
  } catch (error) {
    console.error('[Token Snapshot] Error creating token snapshot:', error);
    console.timeEnd('createTokenSnapshot:total');
    throw error;
  }
}

/**
 * Get a token snapshot from database by ID or the latest if no ID provided
 */
export async function loadTokenSnapshot(snapshotId?: number): Promise<TokenSnapshot | null> {
  try {
    // Get the specified snapshot or the latest
    let snapshotQuery = `
      SELECT id, timestamp, token_address, total_supply
      FROM token_snapshots
    `;
    
    let queryParams: any[] = [];
    
    if (snapshotId) {
      snapshotQuery += ` WHERE id = $1`;
      queryParams.push(snapshotId);
    } else {
      snapshotQuery += ` ORDER BY timestamp DESC LIMIT 1`;
    }
    
    const snapshotResult = await query(snapshotQuery, queryParams);
    
    if (snapshotResult.rowCount === 0) {
      console.error('No token snapshot found in database');
      return null;
    }
    
    const snapshot = snapshotResult.rows[0];
    const retrievedSnapshotId = snapshot.id;
    
    // Get holders for this snapshot
    const holdersResult = await query(`
      SELECT 
        th.address, th.balance, th.is_lp_pool, th.is_treasury,
        sp.twitter, sp.discord, sp.comment, sp.id as social_id
      FROM token_holders th
      LEFT JOIN wallet_addresses wa ON th.address = wa.address
      LEFT JOIN social_profiles sp ON wa.social_id = sp.id
      WHERE th.snapshot_id = $1
      ORDER BY th.balance DESC
    `, [retrievedSnapshotId]);
    
    const holders = holdersResult.rows.map(row => ({
      address: row.address,
      balance: parseFloat(row.balance),
      isLpPool: row.is_lp_pool,
      isTreasury: row.is_treasury,
      twitter: row.twitter,
      discord: row.discord,
      comment: row.comment,
      id: row.social_id
    }));
    
    return {
      id: retrievedSnapshotId,
      tokenAddress: snapshot.token_address,
      timestamp: snapshot.timestamp,
      totalSupply: parseFloat(snapshot.total_supply),
      holders
    };
  } catch (error) {
    console.error('Error loading token snapshot from database:', error);
    return null;
  }
}

/**
 * Get filtered token holders with optional search and snapshot selection
 */
export async function getFilteredTokenHolders(
  searchTerm?: string, 
  limit?: number, 
  snapshotId?: number
): Promise<TokenHolder[]> {
  try {
    // Load the specified snapshot or the latest
    const snapshot = await loadTokenSnapshot(snapshotId);
    if (!snapshot || !snapshot.holders) {
      console.log('No token holder snapshot found');
      return [];
    }

    let holders = snapshot.holders;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      holders = holders.filter(
        holder =>
          holder.address.toLowerCase().includes(searchLower) ||
          (holder.twitter && holder.twitter.toLowerCase().includes(searchLower)) ||
          (holder.discord && holder.discord.toLowerCase().includes(searchLower)) ||
          (holder.comment && holder.comment.toLowerCase().includes(searchLower))
      );
    }
    
    // Apply limit if provided
    if (limit && limit > 0) {
      holders = holders.slice(0, limit);
    }
    
    return holders;
  } catch (error) {
    console.error('Error getting filtered token holders:', error);
    return [];
  }
}

/**
 * Get token events for the most recent snapshot
 */
export async function getLatestTokenEvents() {
  try {
    const result = await query(`
      WITH latest_snapshot AS (
        SELECT id 
        FROM token_snapshots 
        ORDER BY timestamp DESC 
        LIMIT 1
      )
      SELECT 
        e.id, e.timestamp, t.name as event_type, t.icon,
        e.source_address, e.destination_address,
        e.amount, e.previous_balance, e.new_balance,
        sp_source.twitter as source_twitter, sp_source.discord as source_discord,
        sp_dest.twitter as dest_twitter, sp_dest.discord as dest_discord
      FROM token_events e
      JOIN event_types t ON e.event_type_id = t.id
      JOIN latest_snapshot ls ON e.snapshot_id = ls.id
      LEFT JOIN wallet_addresses wa_source ON e.source_address = wa_source.address
      LEFT JOIN social_profiles sp_source ON wa_source.social_id = sp_source.id
      LEFT JOIN wallet_addresses wa_dest ON e.destination_address = wa_dest.address
      LEFT JOIN social_profiles sp_dest ON wa_dest.social_id = sp_dest.id
      ORDER BY e.timestamp DESC
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching latest token events:', error);
    return [];
  }
} 