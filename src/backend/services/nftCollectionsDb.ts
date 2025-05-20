import { CollectionSnapshot, NFTHolder } from '../../types/index.js';
import { FULL_RPC_URL } from '../config/config.js';
import { query, withTransaction } from '../db/index.js';

import { generateNFTEvents } from './eventsService.js';
import { loadSocialProfiles } from './socialProfilesDb.js';

// Get all NFTs from collections
export async function getCollectionNFTs() {
  console.time('getCollectionNFTs:total');
  console.log('[NFT Collection] Starting NFT collection fetch...');
  const allItems: any[] = [];
  const pageSize = 1000;
  let page = 1;

  for (let i = 0; i < 20; i++) {
    console.time(`getCollectionNFTs:page${page}`);
    // up to 20000 NFTs (20 pages)
    const requestBody = {
      jsonrpc: '2.0',
      id: 'my-id',
      method: 'getAssetsByAuthority',
      params: {
        authorityAddress: 'F4emUyYXZxTKs34r5VRERTESrmrQ76D9ohseoTtgGRE8',
        page,
        limit: pageSize,
      },
    };

    console.log(`[NFT Collection] Fetching page ${page} for update authority...`);
    const response = await fetch(`${FULL_RPC_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    console.log(`[NFT Collection] Received response for page ${page}, parsing...`);
    const responseData = await response.json();
    if (responseData.error) {
      console.error('[NFT Collection] RPC Error:', responseData.error);
      throw new Error(`RPC Error: ${responseData.error.message}`);
    }

    const { result } = responseData;
    if (!result || !result.items) {
      console.log('[NFT Collection] No items found in response, stopping pagination');
      break;
    }

    console.log(`[NFT Collection] Found ${result.items.length} items on page ${page}`);
    allItems.push(...result.items);
    page++;
    console.timeEnd(`getCollectionNFTs:page${page-1}`);

    if (result.items.length < pageSize) {
      // End of data
      console.log('[NFT Collection] Reached end of data (fewer items than page size)');
      break;
    }
  }

  console.log(`[NFT Collection] Processing ${allItems.length} total NFT items...`);
  console.time('getCollectionNFTs:processing');
  
  // Process and structure the NFT data
  const processedItems = allItems
    .filter(item => {
      // Filter to only include NFTs with names matching patterns
      const name = item.content?.metadata?.name || '';
      return (
        (name.startsWith('TYR-') && /^TYR-\d+/.test(name)) ||
        (name.startsWith('TYR-Infant-') && /^TYR-Infant-\d+/.test(name))
      );
    })
    .map(item => {
      try {
        // Determine collection type (Gen1 or Infant)
        const name = item.content?.metadata?.name || '';
        const collectionType = name.startsWith('TYR-Infant-') ? 'Infant' : 'Gen1';
        
        return {
          id: item.id, // The mint address
          ownership: {
            owner: item.ownership?.owner || null,
            delegate: item.ownership?.delegate || null,
          },
          content: {
            metadata: {
              name: name,
            },
          },
          collectionType,
        };
      } catch (error) {
        console.error('[NFT Collection] Error processing NFT item:', error);
        return null;
      }
    }).filter(Boolean) as any[];
  
  console.timeEnd('getCollectionNFTs:processing');
  console.log(`[NFT Collection] Processed ${processedItems.length} NFTs in total`);
  console.timeEnd('getCollectionNFTs:total');
  return processedItems;
}

// Create holder snapshot
export async function createHolderSnapshot(): Promise<CollectionSnapshot> {
  console.time('createHolderSnapshot:total');
  console.log('[NFT Snapshot] Starting creation of holder snapshot...');
  
  try {
    // Fetch NFT data
    console.time('createHolderSnapshot:fetchAssets');
    console.log('[NFT Snapshot] Fetching NFT assets...');
    const assets = await getCollectionNFTs();
    console.timeEnd('createHolderSnapshot:fetchAssets');
    console.log(`[NFT Snapshot] Processing ${assets.length} assets...`);
    
    // Group NFTs by owner, saving mint, name, and collection type
    console.time('createHolderSnapshot:groupByOwner');
    const holderMap = new Map<
      string,
      {
        count: number;
        gen1Count: number;
        infantCount: number;
        nfts: any[];
      }
    >();

    // Load existing social profiles
    console.time('createHolderSnapshot:loadSocialProfiles');
    console.log('[NFT Snapshot] Loading social profiles...');
    const socialProfiles = await loadSocialProfiles();
    console.timeEnd('createHolderSnapshot:loadSocialProfiles');
    console.log(`[NFT Snapshot] Loaded ${Object.keys(socialProfiles).length} social profiles`);

    console.time('createHolderSnapshot:processAssets');
    console.log('[NFT Snapshot] Processing assets to group by owner...');
    let processedAssets = 0;
    let processedOwners = 0;
    
    for (const asset of assets) {
      try {
        const owner = asset.ownership.owner;

        if (!owner) {
          console.warn(`[NFT Snapshot] No owner found for asset: ${asset.id}`);
          continue;
        }

        // Initialize or update holder data
        if (!holderMap.has(owner)) {
          holderMap.set(owner, {
            count: 0,
            gen1Count: 0,
            infantCount: 0,
            nfts: [],
          });
          processedOwners++;
        }

        const holderData = holderMap.get(owner)!;
        holderData.count++;

        if (asset.collectionType === 'Gen1') {
          holderData.gen1Count++;
        } else if (asset.collectionType === 'Infant') {
          holderData.infantCount++;
        }

        // Add this NFT to the holder's list, with minimal data
        holderData.nfts.push({
          mint: asset.id,
          name: asset.content?.metadata?.name || 'Unknown',
          type: asset.collectionType,
        });
        
        processedAssets++;
        if (processedAssets % 500 === 0) {
          console.log(`[NFT Snapshot] Processed ${processedAssets}/${assets.length} assets...`);
        }
      } catch (error) {
        console.error('[NFT Snapshot] Error processing asset:', error);
      }
    }
    console.timeEnd('createHolderSnapshot:processAssets');
    console.log(`[NFT Snapshot] Finished processing: ${processedAssets} assets for ${processedOwners} unique owners`);
    
    // Convert to array and sort by count (descending)
    console.time('createHolderSnapshot:createHolderArray');
    console.log('[NFT Snapshot] Creating holder array...');
    const holders: NFTHolder[] = Array.from(holderMap.entries())
      .map(([address, data]) => {
        return {
          address,
          nftCount: data.count,
          gen1Count: data.gen1Count,
          infantCount: data.infantCount,
          nfts: data.nfts,
          // Add social data if available
          ...(socialProfiles[address]
            ? {
                twitter: socialProfiles[address].twitter,
                discord: socialProfiles[address].discord,
                comment: socialProfiles[address].comment,
                id: socialProfiles[address].id,
              }
            : {}),
        };
      })
      .sort((a, b) => b.nftCount - a.nftCount);
    console.timeEnd('createHolderSnapshot:createHolderArray');
    console.log(`[NFT Snapshot] Created array with ${holders.length} holders`);
    console.timeEnd('createHolderSnapshot:groupByOwner');

    // Create snapshot
    const snapshot: CollectionSnapshot = {
      holders,
      total: assets.length,
      timestamp: new Date().toISOString(),
    };

    // Save to database
    console.time('createHolderSnapshot:saveToDatabase');
    console.log('[NFT Snapshot] Saving snapshot to database...');
    const result = await saveHolderSnapshot(snapshot);
    console.timeEnd('createHolderSnapshot:saveToDatabase');
    console.log('[NFT Snapshot] Successfully saved snapshot to database');
    
    // Generate NFT events
    console.time('createHolderSnapshot:generateEvents');
    console.log('[NFT Snapshot] Generating NFT events for this snapshot...');
    try {
      await generateNFTEvents(result.snapshotId, result.holders, result.previousSnapshotId);
      console.log('[NFT Snapshot] Successfully generated NFT events');
    } catch (error) {
      console.error('[NFT Snapshot] Error generating NFT events:', error);
      // Continue even if event generation fails
    }
    console.timeEnd('createHolderSnapshot:generateEvents');
    
    console.timeEnd('createHolderSnapshot:total');
    return result;
  } catch (error) {
    console.error('[NFT Snapshot] Error creating holder snapshot:', error);
    console.timeEnd('createHolderSnapshot:total');
    throw error;
  }
}

// Save snapshot to database
export async function saveHolderSnapshot(snapshot: CollectionSnapshot): Promise<CollectionSnapshot & { snapshotId: number, previousSnapshotId?: number }> {
  console.time('saveHolderSnapshot:total');
  console.log('[NFT DB] Starting database save of NFT snapshot with', snapshot.holders.length, 'holders');
  
  return await withTransaction(async (client) => {
    try {
      // Get previous snapshot ID (if any)
      const previousSnapshotResult = await client.query(
        `SELECT id FROM nft_snapshots ORDER BY timestamp DESC LIMIT 1`
      );
      
      const previousSnapshotId = previousSnapshotResult.rowCount > 0 
        ? previousSnapshotResult.rows[0].id 
        : undefined;
      
      // Insert snapshot
      console.time('saveHolderSnapshot:insertSnapshot');
      console.log('[NFT DB] Inserting snapshot record...');
      const snapshotResult = await client.query(
        `INSERT INTO nft_snapshots (timestamp, total_count)
         VALUES ($1, $2)
         RETURNING id, timestamp`,
        [new Date(snapshot.timestamp), snapshot.total]
      );
      
      if (!snapshotResult.rowCount) {
        console.error('[NFT DB] Failed to create NFT snapshot record - no rows affected');
        throw new Error('Failed to create NFT snapshot record');
      }
      
      const snapshotId = snapshotResult.rows[0].id;
      const timestamp = snapshotResult.rows[0].timestamp;
      console.timeEnd('saveHolderSnapshot:insertSnapshot');
      console.log(`[NFT DB] Created snapshot record with ID ${snapshotId}`);
      
      // Process each holder
      console.time('saveHolderSnapshot:insertHolders');
      console.log(`[NFT DB] Inserting ${snapshot.holders.length} holder records...`);
      let holdersProcessed = 0;
      let batchSize = 100;
      
      // Process holders in batches
      for (let i = 0; i < snapshot.holders.length; i += batchSize) {
        const batchHolders = snapshot.holders.slice(i, i + batchSize);
        console.log(`[NFT DB] Processing holder batch ${i/batchSize + 1}/${Math.ceil(snapshot.holders.length/batchSize)}`);
        
        // Build batch values
        const holderValues = [];
        const holderParams = [];
        let paramIndex = 1;
        
        for (const holder of batchHolders) {
          holderValues.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
          holderParams.push(
            snapshotId, 
            holder.address, 
            holder.nftCount || 0, 
            holder.gen1Count || 0, 
            holder.infantCount || 0
          );
          holdersProcessed++;
        }
        
        // Insert holders in batch
        const holderQuery = `
          INSERT INTO nft_holders (snapshot_id, address, nft_count, gen1_count, infant_count)
          VALUES ${holderValues.join(', ')}
          ON CONFLICT (snapshot_id, address) DO UPDATE SET
            nft_count = EXCLUDED.nft_count,
            gen1_count = EXCLUDED.gen1_count,
            infant_count = EXCLUDED.infant_count
        `;
        
        await client.query(holderQuery, holderParams);
        console.log(`[NFT DB] Inserted batch of ${batchHolders.length} holders (total: ${holdersProcessed}/${snapshot.holders.length})`);
      }
      
      // Process NFTs
      console.time('saveHolderSnapshot:insertNFTs');
      console.log('[NFT DB] Processing NFTs for all holders...');
      
      // Count total NFTs
      let totalNFTs = 0;
      for (const holder of snapshot.holders) {
        if (holder.nfts && Array.isArray(holder.nfts)) {
          totalNFTs += holder.nfts.length;
        }
      }
      console.log(`[NFT DB] Total NFTs to process: ${totalNFTs}`);
      
      // Process NFTs in batches
      let nftBatchSize = 500;
      let processedNFTs = 0;
      
      // First, build a unique list of all NFTs
      console.log('[NFT DB] Building unique NFT list...');
      const uniqueNFTs = new Map();
      for (const holder of snapshot.holders) {
        if (holder.nfts && Array.isArray(holder.nfts)) {
          for (const nft of holder.nfts) {
            uniqueNFTs.set(nft.mint, {
              name: nft.name || 'Unknown',
              type: nft.type || 'Gen1'
            });
          }
        }
      }
      console.log(`[NFT DB] Found ${uniqueNFTs.size} unique NFTs`);
      
      // Insert NFTs in batches
      const uniqueNFTsList = Array.from(uniqueNFTs.entries());
      for (let i = 0; i < uniqueNFTsList.length; i += nftBatchSize) {
        const batchNFTs = uniqueNFTsList.slice(i, i + nftBatchSize);
        console.log(`[NFT DB] Processing NFT batch ${i/nftBatchSize + 1}/${Math.ceil(uniqueNFTsList.length/nftBatchSize)}`);
        
        // Build batch values
        const nftValues = [];
        const nftParams = [];
        let paramIndex = 1;
        
        for (const [mint, data] of batchNFTs) {
          nftValues.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
          nftParams.push(mint, data.name, data.type);
        }
        
        // Insert NFTs in batch
        const nftQuery = `
          INSERT INTO nfts (mint, name, type)
          VALUES ${nftValues.join(', ')}
          ON CONFLICT (mint) DO UPDATE SET
            name = EXCLUDED.name,
            type = EXCLUDED.type
        `;
        
        await client.query(nftQuery, nftParams);
        processedNFTs += batchNFTs.length;
        console.log(`[NFT DB] Inserted batch of ${batchNFTs.length} unique NFTs (total: ${processedNFTs}/${uniqueNFTs.size})`);
      }
      
      // Process ownership records in batches
      console.time('saveHolderSnapshot:insertOwnership');
      console.log('[NFT DB] Processing ownership records...');
      let ownershipBatchSize = 500;
      let processedOwnerships = 0;
      
      // Build list of all ownerships
      const ownerships = [];
      for (const holder of snapshot.holders) {
        if (holder.nfts && Array.isArray(holder.nfts)) {
          for (const nft of holder.nfts) {
            ownerships.push({
              snapshotId,
              mint: nft.mint,
              owner: holder.address
            });
          }
        }
      }
      
      // Insert ownerships in batches
      for (let i = 0; i < ownerships.length; i += ownershipBatchSize) {
        const batchOwnerships = ownerships.slice(i, i + ownershipBatchSize);
        console.log(`[NFT DB] Processing ownership batch ${i/ownershipBatchSize + 1}/${Math.ceil(ownerships.length/ownershipBatchSize)}`);
        
        // Build batch values
        const ownershipValues = [];
        const ownershipParams = [];
        let paramIndex = 1;
        
        for (const ownership of batchOwnerships) {
          ownershipValues.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
          ownershipParams.push(ownership.snapshotId, ownership.mint, ownership.owner);
        }
        
        // Insert ownerships in batch
        const ownershipQuery = `
          INSERT INTO nft_ownership (snapshot_id, mint, owner_address)
          VALUES ${ownershipValues.join(', ')}
          ON CONFLICT (snapshot_id, mint) DO UPDATE SET
            owner_address = EXCLUDED.owner_address
        `;
        
        await client.query(ownershipQuery, ownershipParams);
        processedOwnerships += batchOwnerships.length;
        console.log(`[NFT DB] Inserted batch of ${batchOwnerships.length} ownership records (total: ${processedOwnerships}/${ownerships.length})`);
      }
      
      console.timeEnd('saveHolderSnapshot:insertOwnership');
      console.timeEnd('saveHolderSnapshot:insertNFTs');
      console.timeEnd('saveHolderSnapshot:insertHolders');
      console.log(`[NFT DB] Completed inserting ${holdersProcessed} holders and ${processedOwnerships} ownership records`);
      
      // Return updated snapshot with database timestamp
      console.timeEnd('saveHolderSnapshot:total');
      console.log('[NFT DB] Successfully completed saving snapshot to database');
      
      return {
        ...snapshot,
        timestamp: timestamp.toISOString(),
        snapshotId,
        previousSnapshotId
      };
    } catch (error) {
      console.error('[NFT DB] Error saving holder snapshot to database:', error);
      console.timeEnd('saveHolderSnapshot:total');
      throw error;
    }
  });
}

// Load snapshot from database
export async function loadHolderSnapshot(snapshotId?: number): Promise<CollectionSnapshot | null> {
  try {
    // Get the specified snapshot or the latest
    let snapshotQuery = `
      SELECT id, timestamp, total_count
      FROM nft_snapshots
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
      console.error('No NFT snapshot found in database');
      return null;
    }
    
    const snapshot = snapshotResult.rows[0];
    const retrievedSnapshotId = snapshot.id;
    
    // Get holders for this snapshot
    const holdersResult = await query(`
      SELECT 
        nh.address, nh.nft_count, nh.gen1_count, nh.infant_count,
        sp.twitter, sp.discord, sp.comment, sp.id as social_id
      FROM nft_holders nh
      LEFT JOIN wallet_addresses wa ON nh.address = wa.address
      LEFT JOIN social_profiles sp ON wa.social_id = sp.id
      WHERE nh.snapshot_id = $1
      ORDER BY nh.nft_count DESC
    `, [retrievedSnapshotId]);
    
    // Get NFTs and their ownership for this snapshot
    const nftsResult = await query(`
      SELECT n.mint, n.name, n.type, no.owner_address
      FROM nft_ownership no
      JOIN nfts n ON no.mint = n.mint
      WHERE no.snapshot_id = $1
    `, [retrievedSnapshotId]);
    
    // Organize NFTs by owner
    const nftsByOwner: Record<string, any[]> = {};
    for (const nft of nftsResult.rows) {
      const ownerAddress = nft.owner_address;
      if (!ownerAddress) continue;
      
      if (!nftsByOwner[ownerAddress]) {
        nftsByOwner[ownerAddress] = [];
      }
      nftsByOwner[ownerAddress].push({
        mint: nft.mint,
        name: nft.name,
        type: nft.type
      });
    }
    
    // Create holder objects with their NFTs
    const holders = holdersResult.rows.map(row => {
      const holder: NFTHolder = {
        address: row.address,
        nftCount: parseInt(row.nft_count),
        gen1Count: parseInt(row.gen1_count),
        infantCount: parseInt(row.infant_count),
        nfts: nftsByOwner[row.address] || []
      };
      
      // Add social data if available
      if (row.social_id) {
        holder.twitter = row.twitter;
        holder.discord = row.discord;
        holder.comment = row.comment;
        holder.id = row.social_id;
      }
      
      return holder;
    });
    
    return {
      holders,
      total: parseInt(snapshot.total_count),
      timestamp: snapshot.timestamp.toISOString()
    };
  } catch (error) {
    console.error('Error loading holder snapshot from database:', error);
    return null;
  }
}

// Get holders with optional search filter
export async function getHolders(searchTerm?: string, limit?: number, snapshotId?: number): Promise<NFTHolder[]> {
  try {
    // Load the specified snapshot or the latest
    const snapshot = await loadHolderSnapshot(snapshotId);
    
    if (!snapshot || !snapshot.holders) {
      console.log('No holder snapshot found');
      return [];
    }
    
    // Filter holders if search term is provided
    let holders = snapshot.holders;
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      holders = holders.filter(
        holder =>
          holder.address.toLowerCase().includes(searchLower) ||
          holder.twitter?.toLowerCase().includes(searchLower) ||
          holder.discord?.toLowerCase().includes(searchLower) ||
          holder.comment?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply limit if provided
    if (limit && limit > 0) {
      holders = holders.slice(0, limit);
    }
    
    return holders;
  } catch (error) {
    console.error('Error getting holders from database:', error);
    return [];
  }
} 