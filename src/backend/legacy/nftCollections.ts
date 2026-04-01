import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

import { CollectionSnapshot, NFTHolder } from '../../types/index.js';
import { DATA_DIR, FULL_RPC_URL } from '../config/config.js';

import { loadSocialProfiles } from './socialProfiles.js';

// Paths for data storage
const NFT_SNAPSHOT_FILE = join(DATA_DIR, 'nft_snapshot.json');
// Snapshot file pattern for timestamp-based files
const NFT_SNAPSHOT_PATTERN = /^snapshot_\d+\.json$/;

// Collection IDs for TYR NFTs
const GEN1_COLLECTION_ID = 'HJx4HRAT3RiFq7cy9fSrvP92usAmJ7bJgPccQTyroT2r';
const INFANT_COLLECTION_ID = '6fXJ7FgxoovfAbrFpvH1cJcAiHdPuum2bmVxLjuqqV6L';

// Fetch NFTs from a specific collection
async function fetchCollectionNFTs(collectionId: string, collectionType: 'Gen1' | 'Infant'): Promise<any[]> {
  const allItems: any[] = [];
  const pageSize = 1000;
  let page = 1;

  console.log(`Fetching ${collectionType} NFTs from collection ${collectionId}...`);

  for (let i = 0; i < 20; i++) {
    const requestBody = {
      jsonrpc: '2.0',
      id: 'my-id',
      method: 'getAssetsByGroup',
      params: {
        groupKey: 'collection',
        groupValue: collectionId,
        page,
        limit: pageSize,
      },
    };

    console.log(`Fetching page ${page} for ${collectionType}...`);
    const response = await fetch(`${FULL_RPC_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();
    if (responseData.error) {
      console.error('RPC Error:', responseData.error);
      throw new Error(`RPC Error: ${responseData.error.message}`);
    }

    const { result } = responseData;
    if (!result || !result.items) break;

    // Filter and categorize NFTs
    const filteredItems = result.items
      .filter((item: any) => {
        const name = item.content?.metadata?.name || '';
        return collectionType === 'Gen1'
          ? name.startsWith('TYR-') && /^TYR-\d+/.test(name)
          : name.startsWith('TYR-Infant-') && /^TYR-Infant-\d+/.test(name);
      })
      .map((item: any) => {
        const name = item.content?.metadata?.name || '';
        return { ...item, collectionType };
      });

    allItems.push(...filteredItems);

    if (result.items.length < pageSize) break;
    page++;
  }

  console.log(`Fetched ${allItems.length} ${collectionType} NFTs`);
  return allItems;
}

// Fetch detached NFTs by authority (for NFTs not in any collection)
async function fetchDetachedNFTs(): Promise<any[]> {
  const allItems: any[] = [];
  const pageSize = 1000;
  let page = 1;

  const AUTHORITY_ADDRESS = 'F4emUyYXZxTKs34r5VRERTESrmrQ76D9ohseoTtgGRE8';
  console.log(`Fetching detached NFTs by authority ${AUTHORITY_ADDRESS}...`);

  for (let i = 0; i < 20; i++) {
    const requestBody = {
      jsonrpc: '2.0',
      id: 'my-id',
      method: 'getAssetsByAuthority',
      params: {
        authorityAddress: AUTHORITY_ADDRESS,
        page,
        limit: pageSize,
      },
    };

    const response = await fetch(`${FULL_RPC_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();
    if (responseData.error) {
      console.error('RPC Error:', responseData.error);
      throw new Error(`RPC Error: ${responseData.error.message}`);
    }

    const { result } = responseData;
    if (!result || !result.items) break;

    allItems.push(...result.items);

    if (result.items.length < pageSize) break;
    page++;
  }

  // Filter to only TYR NFTs that are NOT part of any collection (detached)
  return allItems
    .filter((item: any) => {
      const name = item.content?.metadata?.name || '';
      const isTyr = (name.startsWith('TYR-') && /^TYR-\d+/.test(name)) ||
                    (name.startsWith('TYR-Infant-') && /^TYR-Infant-\d+/.test(name));
      const hasNoCollection = !item.grouping || item.grouping.length === 0;
      return isTyr && hasNoCollection;
    })
    .map((item: any) => {
      const name = item.content?.metadata?.name || '';
      const collectionType = name.startsWith('TYR-Infant-') ? 'Infant' : 'Gen1';
      return { ...item, collectionType };
    });
}

// Get all NFTs from both collections plus detached ones
export async function getCollectionNFTs() {
  console.log('Starting NFT collection fetch...');

  // Fetch from collections and detached in parallel
  const [gen1Items, infantItems, detachedItems] = await Promise.all([
    fetchCollectionNFTs(GEN1_COLLECTION_ID, 'Gen1'),
    fetchCollectionNFTs(INFANT_COLLECTION_ID, 'Infant'),
    fetchDetachedNFTs(),
  ]);

  // Merge and deduplicate by mint ID
  const allItemsMap = new Map<string, any>();

  for (const item of gen1Items) allItemsMap.set(item.id, item);
  for (const item of infantItems) allItemsMap.set(item.id, item);
  for (const item of detachedItems) {
    if (!allItemsMap.has(item.id)) {
      allItemsMap.set(item.id, item);
    }
  }

  const allItems = Array.from(allItemsMap.values());
  const gen1Count = allItems.filter((i: any) => i.collectionType === 'Gen1').length;
  const infantCount = allItems.filter((i: any) => i.collectionType === 'Infant').length;

  console.log(`Total: ${gen1Count} Gen1 + ${infantCount} Infant (${detachedItems.length} detached) = ${allItems.length} NFTs`);
  return allItems;
}

// Create holder snapshot
export async function createHolderSnapshot(): Promise<CollectionSnapshot> {
  const assets = await getCollectionNFTs();
  console.log('Processing assets:', assets.length);
  // Group NFTs by owner, saving mint, name, and collection type
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
  const socialProfiles = await loadSocialProfiles();

  for (const asset of assets) {
    try {
      const owner = asset.ownership.owner;

      if (!owner) {
        console.warn(`No owner found for asset: ${asset.id}`);
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
    } catch (error) {
      console.error('Error processing asset:', error);
    }
  }

  // Convert to array and sort by count (descending)
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

  // Create and save snapshot
  const snapshot: CollectionSnapshot = {
    holders,
    total: assets.length,
    timestamp: new Date().toISOString(),
  };

  // Save with timestamp in filename
  const timestamp = Date.now();
  const snapshotFileName = `snapshot_${timestamp}.json`;
  const snapshotPath = join(DATA_DIR, snapshotFileName);

  try {
    await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
    console.log(`Holder snapshot saved as ${snapshotFileName}`);
    return snapshot;
  } catch (error) {
    console.error('Error saving holder snapshot:', error);
    // Fallback to the original file path
    await saveHolderSnapshot(snapshot);
    return snapshot;
  }
}

// Save snapshot to file
export async function saveHolderSnapshot(snapshot: CollectionSnapshot): Promise<void> {
  try {
    await writeFile(NFT_SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2));
    console.log('Holder snapshot saved');
  } catch (error) {
    console.error('Error saving holder snapshot:', error);
  }
}

// Load snapshot from file
export async function loadHolderSnapshot(): Promise<CollectionSnapshot | null> {
  try {
    // Try to find the latest timestamped snapshot file
    const files = await readdir(DATA_DIR);
    const snapshotFiles = files.filter(file => {
      // Make sure file is a string before testing with regex
      return typeof file === 'string' && file.startsWith('snapshot_') && file.endsWith('.json');
    });

    if (snapshotFiles.length > 0) {
      // Sort files by timestamp (descending)
      snapshotFiles.sort((a, b) => {
        // Extract timestamp from filename by removing "snapshot_" prefix and ".json" suffix
        const timestampA = parseInt(a.replace('snapshot_', '').replace('.json', ''));
        const timestampB = parseInt(b.replace('snapshot_', '').replace('.json', ''));
        return timestampB - timestampA;
      });

      // Load the most recent file
      const latestFile = snapshotFiles[0];
      console.log(`Loading latest snapshot file: ${latestFile}`);
      const filePath = join(DATA_DIR, latestFile || '');
      const data = await readFile(filePath, 'utf-8');

      // Parse the snapshot
      const snapshot = JSON.parse(data) as CollectionSnapshot;

      // Load social profiles to ensure they're included
      const socialProfiles = await loadSocialProfiles();

      // Add social profiles to holders if they exist
      if (snapshot.holders) {
        snapshot.holders = snapshot.holders.map(holder => {
          if (socialProfiles[holder.address]) {
            return {
              ...holder,
              twitter: socialProfiles[holder.address].twitter || holder.twitter,
              discord: socialProfiles[holder.address].discord || holder.discord,
              comment: socialProfiles[holder.address].comment || holder.comment,
              id: socialProfiles[holder.address].id,
            };
          }
          return holder;
        });
      }

      return snapshot;
    }

    // If no timestamped files found, try the default file
    console.log('No timestamped snapshots found, trying default file');
    const data = await readFile(NFT_SNAPSHOT_FILE, 'utf-8');
    return JSON.parse(data) as CollectionSnapshot;
  } catch (error) {
    console.error('Error loading holder snapshot:', error);
    return null;
  }
}

// Get holders with optional search filter
export async function getHolders(searchTerm?: string, limit?: number): Promise<NFTHolder[]> {
  try {
    // Load the latest snapshot
    const snapshot = await loadHolderSnapshot();
    
    if (!snapshot || !snapshot.holders) {
      console.log('No holder snapshot found');
      return [];
    }
    
    // Load social profiles to ensure they're included
    const socialProfiles = await loadSocialProfiles();
    
    // Filter holders if search term is provided
    let holders = snapshot.holders;
    
    // Make sure all holders have the latest social profile data
    holders = holders.map(holder => {
      if (socialProfiles[holder.address]) {
        return {
          ...holder,
          twitter: socialProfiles[holder.address].twitter || holder.twitter,
          discord: socialProfiles[holder.address].discord || holder.discord, 
          comment: socialProfiles[holder.address].comment || holder.comment,
          id: socialProfiles[holder.address].id,
        };
      }
      return holder;
    });
    
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
    console.error('Error getting holders:', error);
    return [];
  }
}
