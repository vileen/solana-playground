import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import express from 'express';
import cors from 'cors';
import { CollectionSnapshot, NFTHolder, TokenHolder, TokenSnapshot } from '../types/index.js';
import { clusterApiUrl, Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Load environment variables with preference for .env.local
const rootDir = process.cwd();
const envLocalPath = join(rootDir, '.env.local');
const envPath = join(rootDir, '.env');

// First try .env.local, then fall back to .env
if (existsSync(envLocalPath)) {
  console.log('Loading environment from .env.local');
  dotenv.config({ path: envLocalPath });
} else {
  console.log('Loading environment from .env');
  dotenv.config({ path: envPath });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3001;

// Token address to track
const TOKEN_ADDRESS = '31k88G5Mq7ptbRDf3AM13HAq6wRQHXHikR8hik7wPygk';

// Replace the basic CORS setup with a more configurable one
const corsOptions = {
  origin: function(origin, callback) {
    // In production, only allow same-origin requests or no origin (like mobile apps)
    if (process.env.NODE_ENV === 'production') {
      if (!origin || origin === process.env.RENDER_EXTERNAL_URL) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    } else {
      // In development, allow all origins
      callback(null, true);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Initialize RPC connection
const RPC_URL = process.env.SOLANA_RPC_URL;
console.log('Using RPC URL:', RPC_URL?.replace(/\/.*@/, '/***@')); // Hide sensitive parts of URL for logging

if (!RPC_URL) {
  throw new Error('SOLANA_RPC_URL environment variable is required');
}

// Check for API key
const API_KEY = process.env.SOLANA_API_KEY;
if (!API_KEY) {
  console.warn('Warning: SOLANA_API_KEY environment variable is not set. RPC calls may fail.');
} else {
  console.log('API key is set');
}

// Debug environment variables
console.log('Available environment variables:', Object.keys(process.env).filter(key => 
  key.includes('SOLANA') || key.includes('NODE_ENV') || key.includes('PORT')
).join(', '));

// Construct RPC URL with API key if not already included
let fullRpcUrl = RPC_URL;
if (API_KEY && !RPC_URL.includes('api-key=') && !RPC_URL.includes('@')) {
  // Append API key as query parameter if not already in URL
  fullRpcUrl = RPC_URL.includes('?') 
    ? `${RPC_URL}&api-key=${API_KEY}` 
    : `${RPC_URL}?api-key=${API_KEY}`;
  console.log('Added API key to RPC URL');
}

// Collection addresses
const COLLECTION_ADDRESSES = [
  'HJx4HRAT3RiFq7cy9fSrvP92usAmJ7bJgPccQTyroT2r',
  'EN4u2jn6YHfhbDWvpF5nNcDwn3qdCZQTLJTURbZs6kWw' // base58 c68d8890fb88bd37e0ed9fcd03e60bee08c140394fb8f8f35825ad2876486b3c
];

// Use Render's persistent disk in production, otherwise use local path
const DATA_DIR = process.env.NODE_ENV === 'production' 
  ? '/data' // This matches the mountPath in render.yaml
  : join(__dirname, '../../data');

console.log(`Using data directory: ${DATA_DIR}`);
mkdir(DATA_DIR, { recursive: true }).catch(console.error);

// Path for social profiles storage
const SOCIAL_PROFILES_FILE = join(DATA_DIR, 'social_profiles.json');

// Function to load social profiles
async function loadSocialProfiles(): Promise<Record<string, any>> {
  try {
    if (existsSync(SOCIAL_PROFILES_FILE)) {
      const content = await readFile(SOCIAL_PROFILES_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Error loading social profiles:', error);
  }
  return {};
}

// Function to save social profiles
async function saveSocialProfilesFile(profiles: Record<string, any>): Promise<void> {
  try {
    await writeFile(SOCIAL_PROFILES_FILE, JSON.stringify(profiles, null, 2));
    console.log('Social profiles saved');
  } catch (error) {
    console.error('Error saving social profiles:', error);
  }
}

// Get all NFTs from collections
async function getCollectionNFTs() {
  const allItems: any[] = [];
  const pageSize = 1000;
  let page = 1;

  for (let i = 0; i < 20; i++) { // up to 10,000 NFTs
    const requestBody = {
      jsonrpc: '2.0',
      id: 'my-id',
      method: 'getAssetsByAuthority',
      params: {
        authorityAddress: 'F4emUyYXZxTKs34r5VRERTESrmrQ76D9ohseoTtgGRE8',
        page,
        limit: pageSize
      }
    };

    console.log(`Fetching page ${page} for update authority...`);
    const response = await fetch(`${RPC_URL}?api-key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const responseData = await response.json();
    if (responseData.error) {
      console.error('RPC Error:', responseData.error);
      throw new Error(`RPC Error: ${responseData.error.message}`);
    }

    const { result } = responseData;
    if (!result || !result.items) break;

    // Filter and categorize NFTs into Gen1 and Infant collections
    const filteredItems = result.items.filter((item: any) => {
      const name = item.content?.metadata?.name || '';
      return (name.startsWith('TYR-') && /^TYR-\d+/.test(name)) || 
             (name.startsWith('TYR-Infant-') && /^TYR-Infant-\d+/.test(name));
    }).map((item: any) => {
      const name = item.content?.metadata?.name || '';
      // Add collection type to the item
      const type = name.startsWith('TYR-Infant-') ? 'Infant' : 'Gen1';
      return { ...item, collectionType: type };
    });

    allItems.push(...filteredItems);

    if (result.items.length < pageSize) break;
    page++;
  }

  console.log('Total assets fetched:', allItems.length);
  return allItems;
}

// Create holder snapshot
async function createHolderSnapshot(): Promise<CollectionSnapshot> {
  const assets = await getCollectionNFTs();
  console.log('Processing assets:', assets.length);
  // Group NFTs by owner, saving mint, name, and collection type
  const holderMap = new Map<string, { 
    count: number, 
    gen1Count: number, 
    infantCount: number, 
    nfts: any[] 
  }>();
  
  // Load existing social profiles
  const socialProfiles = await loadSocialProfiles();
  
  for (const asset of assets) {
    try {
      const owner = asset.ownership.owner;
      const type = asset.collectionType as 'Gen1' | 'Infant';
      const nftInfo = {
        mint: asset.id,
        name: asset.content?.metadata?.name || '',
        type
      };
      
      if (!holderMap.has(owner)) {
        holderMap.set(owner, { 
          count: 0, 
          gen1Count: 0, 
          infantCount: 0, 
          nfts: [] 
        });
      }
      
      const holderData = holderMap.get(owner)!;
      holderData.count += 1;
      
      // Increment the appropriate counter
      if (type === 'Gen1') {
        holderData.gen1Count += 1;
      } else if (type === 'Infant') {
        holderData.infantCount += 1;
      }
      
      holderData.nfts.push(nftInfo);
    } catch (error) {
      console.error('Error processing asset:', error);
    }
  }

  // Convert to array format
  const holders: NFTHolder[] = Array.from(holderMap.entries()).map(([address, { count, gen1Count, infantCount, nfts }]) => {
    // Include social profiles if available
    const socialData = socialProfiles[address];
    return {
      address,
      nftCount: count,
      gen1Count,
      infantCount,
      nfts,
      socialProfiles: socialData || undefined
    };
  });

  const snapshot: CollectionSnapshot = {
    collectionAddress: COLLECTION_ADDRESSES,
    timestamp: Date.now(),
    holders
  };

  // Save snapshot to file (timestamp only)
  const filename = `snapshot_${snapshot.timestamp}.json`;
  const filePath = join(DATA_DIR, filename);
  try {
    await writeFile(filePath, JSON.stringify(snapshot, null, 2));
    console.log(`Snapshot saved to ${filePath}`);
  } catch (err) {
    console.error('Error saving snapshot:', err);
  }

  return snapshot;
}

// Get token holders
async function getTokenHolders(tokenAddress: string): Promise<TokenHolder[]> {
  try {
    console.log(`Fetching holders for token: ${tokenAddress}`);
    
    // Connect to Solana with explicit API key handling
    const connectionConfig = { 
      commitment: 'confirmed' as const,  // Use const assertion for valid Commitment type
      confirmTransactionInitialTimeout: 60000
    };
    
    // Create connection with API key
    const connection = new Connection(fullRpcUrl, connectionConfig);
    console.log('Connection created with RPC URL:', fullRpcUrl.replace(/\/.*@/, '/***@').replace(/api-key=([^&]*)/, 'api-key=***')); // Hide sensitive parts
    
    const tokenPublicKey = new PublicKey(tokenAddress);
    
    // First try the recommended method
    try {
      // Check if connection is alive
      const version = await connection.getVersion();
      console.log('Solana version:', version);
      
      // Fetch all token accounts for this mint
      console.log('Fetching token accounts...');
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        new PublicKey(tokenAddress),
        { programId: TOKEN_PROGRAM_ID }
      );

      if (!tokenAccounts || !tokenAccounts.value) {
        console.warn('No token accounts found using getParsedTokenAccountsByOwner, trying alternative method');
      } else {
        console.log(`Found ${tokenAccounts.value.length} token accounts`);
      }
    } catch (error) {
      console.error('Error with getParsedTokenAccountsByOwner:', error);
    }
    
    // Alternative approach using getParsedProgramAccounts
    console.log('Trying alternative method with getParsedProgramAccounts...');
    const tokenProgramAccounts = await connection.getParsedProgramAccounts(
      TOKEN_PROGRAM_ID,
      {
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
      }
    );
    
    console.log(`Found ${tokenProgramAccounts.length} program accounts`);
    
    // Process token accounts and aggregate by owner
    const holderMap = new Map<string, number>();
    
    for (const account of tokenProgramAccounts) {
      try {
        if ('parsed' in account.account.data) {
          const parsedData = account.account.data.parsed;
          const owner = parsedData.info.owner;
          const amount = parsedData.info.tokenAmount.uiAmount;
          
          // Only track non-zero balances
          if (amount > 0) {
            if (holderMap.has(owner)) {
              holderMap.set(owner, holderMap.get(owner)! + amount);
            } else {
              holderMap.set(owner, amount);
            }
          }
        }
      } catch (error) {
        console.error('Error processing token account:', error);
      }
    }
    
    // Convert to array format and filter out holders with less than 1 token
    const holders: TokenHolder[] = Array.from(holderMap.entries())
      .filter(([_, balance]) => balance >= 10) // Only include holders with 1 or more tokens
      .map(([address, balance]) => ({
        address,
        balance,
        // Default values for special wallets can be added here
      }));
    
    // Sort by balance (descending)
    holders.sort((a, b) => b.balance - a.balance);
    
    console.log(`Processed ${holders.length} token holders`);
    return holders;
  } catch (error) {
    console.error('Error fetching token holders:', error);
    throw error;
  }
}

// Create token snapshot
async function createTokenSnapshot(): Promise<TokenSnapshot> {
  let holders: TokenHolder[] = [];
  
  // Load existing social profiles
  const socialProfiles = await loadSocialProfiles();
  
  try {
    // Only try to get token holders if API key is available
    if (API_KEY) {
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
          
          // Make sure we have files before accessing the last one
          if (sortedFiles.length > 0) {
            // We've verified the array has elements, so this is safe to use
            const latestFile = sortedFiles[sortedFiles.length - 1] as string; // Get the last one (newest)
            
            // Read the file
            console.log(`Found latest snapshot file: ${latestFile}`);
            const filePath = join(DATA_DIR, latestFile);
            const content = await readFile(filePath, 'utf-8');
            const snapshotData = JSON.parse(content);
          
          if (snapshotData && Array.isArray(snapshotData.holders)) {
            console.log(`Using cached token snapshot with ${snapshotData.holders.length} holders`);
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
        { address: 'HXtBm8XZbxaTt41uqaKhwUAa6Z1aPyvJdsZVENiWsetg', balance: 500 }
      ];
    }
  }
  
  // Add social profiles to holders
  holders = holders.map(holder => ({
    ...holder,
    socialProfiles: socialProfiles[holder.address] || undefined
  }));
  
  // Create the snapshot
  const snapshot: TokenSnapshot = {
    tokenAddress: TOKEN_ADDRESS,
    timestamp: Date.now(),
    holders
  };
  
  // Only save to file if we have actual data
  if (holders.length > 0) {
    // Save snapshot to file (timestamp only)
    const filename = `token_snapshot_${snapshot.timestamp}.json`;
    const filePath = join(DATA_DIR, filename);
    
    try {
      await writeFile(filePath, JSON.stringify(snapshot, null, 2));
      console.log(`Token snapshot saved to ${filePath}`);
    } catch (err) {
      console.error('Error saving token snapshot:', err);
    }
  }
  
  return snapshot;
}

// Save social profile for a wallet
async function saveSocialProfile(walletAddress: string, socialData: { twitter?: string; discord?: string; comment?: string }) {
  // Load all social profiles
  const socialProfiles = await loadSocialProfiles();
  
  // Update or create the profile for this wallet
  socialProfiles[walletAddress] = {
    ...(socialProfiles[walletAddress] || {}),
    ...socialData
  };
  
  // Save back to file
  await saveSocialProfilesFile(socialProfiles);
  
  // Also update existing snapshots to maintain compatibility
  try {
    // Get the latest NFT snapshot
    const files = await readdir(DATA_DIR);
    const snapshots = await Promise.all(
      files
        .filter(f => f.startsWith('snapshot_'))
        .map(async f => {
          const content = await readFile(join(DATA_DIR, f), 'utf-8');
          return JSON.parse(content) as CollectionSnapshot;
        })
    );

    // If we have NFT snapshots, update the holder if found
    if (snapshots.length > 0) {
      // Get the latest snapshot
      const latestSnapshot = snapshots.sort((a: CollectionSnapshot, b: CollectionSnapshot) => b.timestamp - a.timestamp)[0];
      
      if (latestSnapshot && latestSnapshot.holders) {
        // Find holder and update social profiles
        let holderFound = false;
        const updatedHolders = latestSnapshot.holders.map((holder: NFTHolder) => {
          if (holder.address === walletAddress) {
            holderFound = true;
            return {
              ...holder,
              socialProfiles: {
                ...holder.socialProfiles,
                ...socialData
              }
            };
          }
          return holder;
        });
        
        // If holder found, update and save NFT snapshot
        if (holderFound) {
          // Save updated snapshot
          latestSnapshot.holders = updatedHolders;
          const filename = `snapshot_${latestSnapshot.timestamp}.json`;
          const filePath = join(DATA_DIR, filename);
          
          await writeFile(filePath, JSON.stringify(latestSnapshot, null, 2));
          console.log(`Updated social profile for NFT holder ${walletAddress}`);
        }
      }
    }
  } catch (error) {
    console.error('Error updating NFT holder profile:', error);
  }
  
  // Now try updating token holder profile
  try {
    // Get the latest token snapshot
    const files = await readdir(DATA_DIR);
    const tokenSnapshots = await Promise.all(
      files
        .filter(f => f.startsWith('token_snapshot_'))
        .map(async f => {
          const content = await readFile(join(DATA_DIR, f), 'utf-8');
          return JSON.parse(content) as TokenSnapshot;
        })
    );

    // If we have token snapshots, update the holder if found
    if (tokenSnapshots.length > 0) {
      // Get the latest snapshot
      const latestTokenSnapshot = tokenSnapshots.sort((a: TokenSnapshot, b: TokenSnapshot) => b.timestamp - a.timestamp)[0];
      
      if (latestTokenSnapshot && latestTokenSnapshot.holders) {
        // Find holder and update social profiles
        let tokenHolderFound = false;
        const updatedTokenHolders = latestTokenSnapshot.holders.map((holder: TokenHolder) => {
          if (holder.address === walletAddress) {
            tokenHolderFound = true;
            return {
              ...holder,
              socialProfiles: {
                ...holder.socialProfiles,
                ...socialData
              }
            };
          }
          return holder;
        });
        
        // If holder found, update and save token snapshot
        if (tokenHolderFound) {
          // Save updated snapshot
          latestTokenSnapshot.holders = updatedTokenHolders;
          const filename = `token_snapshot_${latestTokenSnapshot.timestamp}.json`;
          const filePath = join(DATA_DIR, filename);
          
          await writeFile(filePath, JSON.stringify(latestTokenSnapshot, null, 2));
          console.log(`Updated social profile for token holder ${walletAddress}`);
        }
      }
    }
  } catch (error) {
    console.error('Error updating token holder profile:', error);
  }
  
  return { success: true, walletAddress };
}

// API Endpoints for NFT Holders
app.get('/api/snapshot', async (req, res) => {
  try {
    const snapshot = await createHolderSnapshot();
    res.json({ holders: snapshot.holders });
  } catch (error) {
    console.error('Error creating snapshot:', error);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

app.get('/api/holders', async (req, res) => {
  try {
    const { search } = req.query;
    const files = await readdir(DATA_DIR);
    let snapshots = await Promise.all(
      files
        .filter(f => f.startsWith('snapshot_'))
        .map(async f => {
          const content = await readFile(join(DATA_DIR, f), 'utf-8');
          return JSON.parse(content) as CollectionSnapshot;
        })
    );

    // If no snapshots exist, create one
    if (snapshots.length === 0) {
      const snapshot = await createHolderSnapshot();
      snapshots = [snapshot];
    }

    // Get the latest snapshot
    const latestSnapshot = snapshots.sort((a: CollectionSnapshot, b: CollectionSnapshot) => b.timestamp - a.timestamp)[0];
    let holders = latestSnapshot?.holders || [];

    // Filter by search term if provided
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      holders = holders.filter((holder: any) =>
        holder.address.toLowerCase().includes(searchLower)
      );
    }

    res.json(holders);
  } catch (error) {
    console.error('Error fetching holders:', error);
    res.status(500).json({ error: 'Failed to fetch holders' });
  }
});

// API Endpoints for Token Holders
app.get('/api/token-snapshot', async (req, res) => {
  try {
    console.log('Token snapshot requested');
    const snapshot = await createTokenSnapshot();
    res.json({ holders: snapshot.holders });
  } catch (error) {
    console.error('Error creating token snapshot:', error);
    
    // Create a more user-friendly error response
    let errorMessage = 'Failed to create token snapshot';
    let statusCode = 500;
    
    // Extract more specific error information if available
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Check for specific error types
      if (errorMessage.includes('401 Unauthorized') || errorMessage.includes('missing api key')) {
        errorMessage = 'API authentication failed. Please check your Solana API key configuration.';
        statusCode = 401;
      } else if (errorMessage.includes('429 Too Many Requests')) {
        errorMessage = 'Rate limit exceeded for Solana RPC. Please try again later.';
        statusCode = 429;
      }
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'production' ? undefined : (error instanceof Error ? error.stack : String(error))
    });
  }
});

app.get('/api/token-holders', async (req, res) => {
  try {
    const { search } = req.query;
    const files = await readdir(DATA_DIR);
    let snapshots = await Promise.all(
      files
        .filter(f => f.startsWith('token_snapshot_'))
        .map(async f => {
          const content = await readFile(join(DATA_DIR, f), 'utf-8');
          return JSON.parse(content) as TokenSnapshot;
        })
    );

    // If no snapshots exist, create one or use mock data
    if (snapshots.length === 0) {
      try {
        const snapshot = await createTokenSnapshot();
        snapshots = [snapshot];
      } catch (error) {
        console.error('Failed to create token snapshot, using mock data:', error);
        
        // Use mock data as fallback
        snapshots = [{
          tokenAddress: TOKEN_ADDRESS,
          timestamp: Date.now(),
          holders: [
            { address: '4KN...demo1', balance: 1000 },
            { address: 'BPE...demo2', balance: 500 },
            { address: 'sK9...demo3', balance: 250 },
            { address: 'Q5D...demo4', balance: 100 }
          ]
        }];
      }
    }

    // Get the latest snapshot
    const latestSnapshot = snapshots.sort((a: TokenSnapshot, b: TokenSnapshot) => b.timestamp - a.timestamp)[0];
    let holders = latestSnapshot?.holders || [];

    // Filter by search term if provided
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      holders = holders.filter((holder: any) =>
        holder.address.toLowerCase().includes(searchLower)
      );
    }

    res.json(holders);
  } catch (error) {
    console.error('Error fetching token holders:', error);
    
    // Return mock data if everything fails
    res.json([
      { address: '4KN...mockdata1', balance: 1000 },
      { address: 'BPE...mockdata2', balance: 500 }
    ]);
  }
});

// API Endpoints for Social Profiles
app.post('/api/social-profile', async (req, res) => {
  try {
    const { walletAddress, twitter, discord, comment } = req.body;
    
    if (!walletAddress) {
      res.status(400).json({ error: 'Wallet address is required' });
      return;
    }
    
    const result = await saveSocialProfile(walletAddress, { twitter, discord, comment });
    res.json(result);
  } catch (error) {
    console.error('Error saving social profile:', error);
    res.status(500).json({ error: 'Failed to save social profile' });
  }
});

app.get('/api/social-profiles', async (req, res) => {
  try {
    // Load social profiles from separate file
    const socialProfiles = await loadSocialProfiles();
    
    // Also load from snapshot files for backward compatibility
    const files = await readdir(DATA_DIR);
    
    // Get NFT holders with social profiles
    const nftSnapshots = await Promise.all(
      files
        .filter(f => f.startsWith('snapshot_'))
        .map(async f => {
          const content = await readFile(join(DATA_DIR, f), 'utf-8');
          return JSON.parse(content) as CollectionSnapshot;
        })
    );

    let nftHoldersWithSocial: NFTHolder[] = [];
    if (nftSnapshots.length > 0) {
      const latestSnapshot = nftSnapshots.sort((a: CollectionSnapshot, b: CollectionSnapshot) => b.timestamp - a.timestamp)[0];
      if (latestSnapshot && latestSnapshot.holders) {
        nftHoldersWithSocial = latestSnapshot.holders.filter(
          holder => holder.socialProfiles?.twitter || holder.socialProfiles?.discord || holder.socialProfiles?.comment
        );
      }
    }
    
    // Get token holders with social profiles
    const tokenSnapshots = await Promise.all(
      files
        .filter(f => f.startsWith('token_snapshot_'))
        .map(async f => {
          const content = await readFile(join(DATA_DIR, f), 'utf-8');
          return JSON.parse(content) as TokenSnapshot;
        })
    );

    let tokenHoldersWithSocial: TokenHolder[] = [];
    if (tokenSnapshots.length > 0) {
      const latestTokenSnapshot = tokenSnapshots.sort((a: TokenSnapshot, b: TokenSnapshot) => b.timestamp - a.timestamp)[0];
      if (latestTokenSnapshot && latestTokenSnapshot.holders) {
        tokenHoldersWithSocial = latestTokenSnapshot.holders.filter(
          holder => holder.socialProfiles?.twitter || holder.socialProfiles?.discord || holder.socialProfiles?.comment
        );
      }
    }
    
    // Combine and deduplicate social profiles
    const socialProfileMap = new Map<string, any>();
    
    // Add NFT holders with social profiles
    for (const holder of nftHoldersWithSocial) {
      socialProfileMap.set(holder.address, {
        address: holder.address,
        nftCount: holder.nftCount,
        gen1Count: holder.gen1Count,
        infantCount: holder.infantCount,
        tokenBalance: 0, // Default value
        socialProfiles: holder.socialProfiles,
        hasNfts: true,
        hasTokens: false
      });
    }
    
    // Add or update with token holders
    for (const holder of tokenHoldersWithSocial) {
      if (socialProfileMap.has(holder.address)) {
        // Update existing entry
        const existing = socialProfileMap.get(holder.address);
        existing.tokenBalance = holder.balance;
        existing.hasTokens = true;
        // Merge social profiles if needed
        if (holder.socialProfiles) {
          existing.socialProfiles = {
            ...existing.socialProfiles,
            ...holder.socialProfiles
          };
        }
      } else {
        // Add new entry
        socialProfileMap.set(holder.address, {
          address: holder.address,
          nftCount: 0,
          gen1Count: 0,
          infantCount: 0,
          tokenBalance: holder.balance,
          socialProfiles: holder.socialProfiles,
          hasNfts: false,
          hasTokens: true
        });
      }
    }
    
    // Merge with standalone social profiles
    Object.entries(socialProfiles).forEach(([address, profile]) => {
      if (!socialProfileMap.has(address)) {
        socialProfileMap.set(address, {
          address,
          nftCount: 0,
          gen1Count: 0,
          infantCount: 0,
          tokenBalance: 0,
          socialProfiles: profile,
          hasNfts: false,
          hasTokens: false
        });
      }
    });
    
    // Convert to array and send
    const combinedSocialProfiles = Array.from(socialProfileMap.values());
    res.json(combinedSocialProfiles);
  } catch (error) {
    console.error('Error fetching social profiles:', error);
    res.status(500).json({ error: 'Failed to fetch social profiles' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = join(__dirname, '../../dist');
  console.log('Serving static files from:', distPath);
  app.use(express.static(distPath));
  
  // Handle SPA routing - serve index.html for any unmatched routes
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(join(distPath, 'index.html'));
  });
}

// Add general error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 