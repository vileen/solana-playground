import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { TokenHolder, TokenSnapshot } from '../../types/index.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { DATA_DIR, TOKEN_ADDRESS, RPC_URL, FULL_RPC_URL } from '../config/config.js';
import { loadSocialProfiles } from './socialProfiles.js';
import { readdir } from 'fs/promises';

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
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Get all token accounts for this mint
    console.log(`Fetching token accounts for mint: ${tokenAddress}`);
    const accounts = await connection.getParsedProgramAccounts(
      TOKEN_PROGRAM_ID,
      {
        filters: [
          {
            dataSize: 165, // Size of token account data
          },
          {
            memcmp: {
              offset: 0, // Mint address location in the account data
              bytes: tokenAddress,
            },
          },
        ],
      }
    );
    
    console.log(`Found ${accounts.length} token accounts`);
    
    // Load social profiles for additional data
    const socialProfiles = await loadSocialProfiles();
    
    // Process each account
    const holders: TokenHolder[] = [];
    for (const account of accounts) {
      try {
        // Parse account data
        const parsedData = account.account.data as any; // 'as any' is needed because of Solana's complex types
        const tokenAmount = parsedData?.parsed?.info?.tokenAmount?.uiAmount || 0;
        const owner = parsedData?.parsed?.info?.owner;
        
        // Only include accounts with balance
        if (tokenAmount > 0 && owner) {
          const holderData: TokenHolder = {
            address: owner,
            balance: tokenAmount,
            // Add social data if available
            ...(socialProfiles[owner] ? {
              twitter: socialProfiles[owner].twitter,
              discord: socialProfiles[owner].discord,
              comment: socialProfiles[owner].comment
            } : {})
          };
          holders.push(holderData);
        }
      } catch (error) {
        console.error('Error processing token account:', error);
      }
    }
    
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
    const holders = await getTokenHolders(TOKEN_ADDRESS);
    
    // Calculate total supply held by these holders
    const totalSupply = holders.reduce((sum, holder) => sum + holder.balance, 0);
    
    const snapshot: TokenSnapshot = {
      holders,
      totalSupply,
      tokenAddress: TOKEN_ADDRESS,
      timestamp: new Date().toISOString()
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
      return typeof file === 'string' && 
             file.startsWith('token_snapshot_') && 
             file.endsWith('.json');
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
              comment: socialProfiles[holder.address].comment || holder.comment
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
export async function getFilteredTokenHolders(searchTerm?: string): Promise<TokenHolder[]> {
  try {
    const snapshot = await loadTokenSnapshot();
    if (!snapshot) {
      return [];
    }
    
    // Apply search filter if provided
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return snapshot.holders.filter(holder => 
        holder.address.toLowerCase().includes(searchLower) || 
        holder.twitter?.toLowerCase().includes(searchLower) ||
        holder.discord?.toLowerCase().includes(searchLower) ||
        holder.comment?.toLowerCase().includes(searchLower)
      );
    }
    
    return snapshot.holders;
  } catch (error) {
    console.error('Error getting token holders:', error);
    return [];
  }
} 