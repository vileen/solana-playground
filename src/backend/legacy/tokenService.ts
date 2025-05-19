import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Connection } from '@solana/web3.js';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

import { TokenHolder, TokenSnapshot } from '../../types/index.js';
import { API_KEY, DATA_DIR, FULL_RPC_URL, RPC_URL, TOKEN_ADDRESS } from '../config/config.js';

import { loadSocialProfiles } from './socialProfiles.js';

// Path for token snapshot storage
const TOKEN_SNAPSHOT_FILE = join(DATA_DIR, 'token_snapshot.json');
// Snapshot file pattern for timestamp-based files
const TOKEN_SNAPSHOT_PATTERN = /^token_snapshot_\d+\.json$/;

// Get token holders using token accounts data
export async function getTokenHolders(tokenAddress: string): Promise<TokenHolder[]> {
  try {
    // Create connection to the Solana network
    if (!RPC_URL) {
      throw new Error('RPC URL is not defined');
    }

    // Create connection with API key
    const connectionConfig = {
      commitment: 'confirmed' as const,
      confirmTransactionInitialTimeout: 60000,
    };

    const connection = new Connection(FULL_RPC_URL, connectionConfig);
    console.log(
      'Connection created with RPC URL:',
      FULL_RPC_URL.replace(/\/.*@/, '/***@').replace(/api-key=([^&]*)/, 'api-key=***')
    ); // Hide sensitive parts

    // Load social profiles for additional data
    const socialProfiles = await loadSocialProfiles();

    // First try the recommended method
    try {
      // Check if connection is alive
      const version = await connection.getVersion();
      console.log('Solana version:', version);
    } catch (error) {
      console.error('Error checking Solana connection:', error);
    }

    // Using getParsedProgramAccounts approach
    console.log('Fetching token accounts using getParsedProgramAccounts...');
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

    console.log(`Found ${tokenProgramAccounts.length} program accounts`);

    // Process token accounts and aggregate by owner
    const holderMap = new Map<string, number>();

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
          }
        }
      } catch (error) {
        console.error('Error processing token account:', error);
      }
    }

    // Convert to array format
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
    return holders.sort((a, b) => b.balance - a.balance);
  } catch (error) {
    console.error('Error fetching token holders:', error);
    return [];
  }
}

// Create token holder snapshot
export async function createTokenSnapshot(): Promise<TokenSnapshot> {
  try {
    console.log('Creating token snapshot...');
    let holders: TokenHolder[] = [];

    try {
      // Only try to get token holders if API key is available
      if (API_KEY) {
        if (!TOKEN_ADDRESS) {
          throw new Error('TOKEN_ADDRESS is not defined');
        }
        holders = await getTokenHolders(TOKEN_ADDRESS);
      } else {
        console.warn('No API key available, skipping live token holder fetch');
        throw new Error('No API key available');
      }
    } catch (error) {
      console.error('Error fetching live token holders:', error);

      // Try to get the last snapshot as a fallback
      try {
        console.log('Attempting to get the latest token snapshot as fallback');
        const files = await readdir(DATA_DIR);

        // Filter token snapshot files
        const snapshotFiles = files.filter(f => f.startsWith('token_snapshot_'));

        if (snapshotFiles.length > 0) {
          // Sort files by timestamp in filename
          const sortedFiles = snapshotFiles.sort();

          // Get the last one (newest)
          const latestFile = sortedFiles[sortedFiles.length - 1];

          if (latestFile) {
            // Read the file
            console.log(`Found latest snapshot file: ${latestFile}`);
            const filePath = join(DATA_DIR, latestFile);
            const content = await readFile(filePath, 'utf-8');
            const snapshotData = JSON.parse(content);

            if (snapshotData && Array.isArray(snapshotData.holders)) {
              console.log(
                `Using cached token snapshot with ${snapshotData.holders.length} holders`
              );
              holders = snapshotData.holders;
            }
          }
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }

      // If we still have no holders, use mock data
      if (holders.length === 0) {
        console.log('Using mock token holder data');
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
    const totalSupply = holders.reduce((sum, holder) => sum + holder.balance, 0);

    const snapshot: TokenSnapshot = {
      holders,
      totalSupply,
      tokenAddress: TOKEN_ADDRESS,
      timestamp: new Date().toISOString(),
    };

    // Save snapshot with timestamp in filename
    const timestamp = Date.now();
    const snapshotFileName = `token_snapshot_${timestamp}.json`;
    const snapshotPath = join(DATA_DIR, snapshotFileName);

    try {
      await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
      console.log(`Token snapshot saved as ${snapshotFileName}`);
      return snapshot;
    } catch (error) {
      console.error('Error saving token snapshot with timestamp:', error);
      // Fallback to the original file path
      await saveTokenSnapshot(snapshot);
      return snapshot;
    }
  } catch (error) {
    console.error('Error creating token snapshot:', error);
    throw error;
  }
}

// Save token snapshot to file
export async function saveTokenSnapshot(snapshot: TokenSnapshot): Promise<void> {
  try {
    await writeFile(TOKEN_SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2));
    console.log('Token snapshot saved');
  } catch (error) {
    console.error('Error saving token snapshot:', error);
  }
}

// Load token snapshot from file
export async function loadTokenSnapshot(): Promise<TokenSnapshot | null> {
  try {
    // Try to find the latest timestamped snapshot file
    const files = await readdir(DATA_DIR);
    const snapshotFiles = files.filter(file => {
      // Make sure file is a string and matches the token snapshot pattern
      return (
        typeof file === 'string' && file.startsWith('token_snapshot_') && file.endsWith('.json')
      );
    });

    if (snapshotFiles.length > 0) {
      // Sort files by timestamp (descending)
      snapshotFiles.sort((a, b) => {
        // Extract timestamp from filename
        const timestampA = parseInt(a.replace('token_snapshot_', '').replace('.json', ''));
        const timestampB = parseInt(b.replace('token_snapshot_', '').replace('.json', ''));
        return timestampB - timestampA;
      });

      // Load the most recent file
      const latestFile = snapshotFiles[0];
      console.log(`Loading latest token snapshot file: ${latestFile}`);
      const filePath = join(DATA_DIR, latestFile || '');
      const data = await readFile(filePath, 'utf-8');

      // Parse the snapshot
      const snapshot = JSON.parse(data) as TokenSnapshot;

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
    console.log('No timestamped token snapshots found, trying default file');
    const data = await readFile(TOKEN_SNAPSHOT_FILE, 'utf-8');
    return JSON.parse(data) as TokenSnapshot;
  } catch (error) {
    console.error('Error loading token snapshot:', error);
    return null;
  }
}

// Get token holders with optional search filter
export async function getFilteredTokenHolders(searchTerm?: string, limit?: number): Promise<TokenHolder[]> {
  try {
    const snapshot = await loadTokenSnapshot();
    if (!snapshot || !snapshot.holders) {
      console.log('No token holder snapshot found');
      return [];
    }

    // Load social profiles to ensure they're included
    const socialProfiles = await loadSocialProfiles();
    
    // Make sure all holders have the latest social profile data
    let holders = snapshot.holders.map(holder => {
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
