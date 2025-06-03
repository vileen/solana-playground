export interface NFTHolder {
  address: string;
  nftCount: number; // Total NFT count
  gen1Count: number;
  infantCount: number;
  nfts: {
    mint: string;
    name: string;
    type: 'Gen1' | 'Infant';
  }[];
  twitter?: string; // Social profile data
  discord?: string;
  comment?: string;
  id?: string;
}

export interface TokenHolder {
  address: string;
  balance: number;
  isLpPool?: boolean;
  isTreasury?: boolean;
  twitter?: string; // Social profile data
  discord?: string;
  comment?: string;
  id?: string; // Social profile ID
}

// Staking types
export interface Stake {
  amount: number;
  stakeDate: string; // ISO date string
  unlockDate: string; // ISO date string
  isLocked: boolean;
  mintAddress: string;
}

export interface StakeData {
  walletAddress: string;
  totalStaked: number;
  totalLocked: number;
  totalUnlocked: number;
  stakes: Stake[];
}

export interface StakingSnapshot {
  id?: number;
  contractAddress: string;
  timestamp: string; // ISO date string
  totalStaked: number;
  totalLocked: number;
  totalUnlocked: number;
  lastSignature?: string; // Last transaction signature processed
  isIncremental?: boolean; // Whether this is an incremental snapshot
  stakingData: StakeData[];
}

export interface TokenSnapshot {
  id?: number; // Database ID of the snapshot
  tokenAddress: string;
  timestamp: string; // ISO date string
  holders: TokenHolder[];
  totalSupply: number; // Total token supply
}

export interface CollectionSnapshot {
  holders: NFTHolder[];
  timestamp: string; // ISO date string
  total: number; // Total NFTs in the snapshot
}

export interface TokenDistribution {
  holderAddress: string;
  amount: number;
  status: 'pending' | 'sent' | 'failed';
  transactionId?: string;
}

// Event Types
export interface TokenEvent {
  id: number;
  event_timestamp: string;
  event_type: string;
  source_address?: string;
  destination_address?: string;
  amount: number;
  previous_balance?: number;
  new_balance?: number;
  snapshot_id: number;
  snapshot_timestamp: string;
  source_twitter?: string;
  source_discord?: string;
  source_comment?: string;
  dest_twitter?: string;
  dest_discord?: string;
  dest_comment?: string;
  social_id?: string;
  twitter?: string;
  discord?: string;
  comment?: string;
}

export interface NFTEvent {
  id: number;
  event_timestamp: string;
  event_type: string;
  mint: string;
  nft_name: string;
  nft_type: string;
  source_address?: string;
  destination_address?: string;
  snapshot_id: number;
  snapshot_timestamp: string;
  social_id?: string;
  twitter?: string;
  discord?: string;
  comment?: string;
  source_twitter?: string;
  source_discord?: string;
  source_comment?: string;
  dest_twitter?: string;
  dest_discord?: string;
  dest_comment?: string;
}

// Interfaces for events API
export interface EventTokenSnapshot {
  id: number;
  timestamp: string;
  token_address: string;
  total_supply: number;
  events: TokenEvent[];
}

export interface EventNFTSnapshot {
  id: number;
  timestamp: string;
  total_count: number;
  events: NFTEvent[];
}

// Liquidity Pool Analysis Types
export interface PoolTokenAnalysis {
  platform: string;
  poolAddress: string;
  totalTokens: number;
  uniqueWallets: number;
  walletDistribution: {
    [walletAddress: string]: number;
  };
}

export interface LiquidityPoolsAnalysis {
  orca: PoolTokenAnalysis[];
  raydium: PoolTokenAnalysis[];
  meteora: PoolTokenAnalysis[];
  totalAnalysis: {
    totalTokensAcrossPlatforms: number;
    totalUniqueWallets: number;
    platformBreakdown: {
      [platform: string]: {
        totalTokens: number;
        uniqueWallets: number;
      };
    };
    topWallets: {
      address: string;
      totalTokens: number;
      platforms: string[];
      twitter?: string;
      discord?: string;
      comment?: string;
      id?: string;
    }[];
    walletDetails: {
      address: string;
      totalTokens: number;
      platforms: string[];
      poolBreakdown: {
        [platform: string]: {
          tokens: number;
          pools: string[];
        };
      };
      twitter?: string;
      discord?: string;
      comment?: string;
      id?: string;
    }[];
  };
}

export interface PlatformAnalysisResponse {
  platform: string;
  pools: PoolTokenAnalysis[];
  summary: {
    totalPools: number;
    totalTokens: number;
    totalUniqueWallets: number;
  };
}

// Liquidity Pool Transaction Flow Analysis Types
export interface PoolTransfer {
  signature: string;
  timestamp: string;
  amount: number;
  counterpartyAddress: string;
  direction: 'inflow' | 'outflow';
  twitter?: string;
  discord?: string;
  comment?: string;
  id?: string;
}

export interface PoolTransactionAnalysis extends PoolTokenAnalysis {
  inflows: PoolTransfer[];
  outflows: PoolTransfer[];
  totalInflow: number;
  totalOutflow: number;
  uniqueContributors: number;
  contributorBreakdown: {
    [address: string]: {
      address: string;
      totalInflow: number;
      totalOutflow: number;
      netContribution: number;
      transactionCount: number;
      twitter?: string;
      discord?: string;
      comment?: string;
      id?: string;
    };
  };
}

export interface LiquidityPoolsTransactionAnalysis {
  orca: PoolTransactionAnalysis[];
  raydium: PoolTransactionAnalysis[];
  meteora: PoolTransactionAnalysis[];
  totalAnalysis: {
    totalTokensAcrossPlatforms: number;
    totalUniqueWallets: number;
    totalInflows: number;
    totalOutflows: number;
    platformBreakdown: {
      [platform: string]: {
        totalTokens: number;
        uniqueWallets: number;
        totalInflows: number;
        totalOutflows: number;
      };
    };
    topContributors: {
      address: string;
      totalContributed: number;
      totalReceived: number;
      netContribution: number;
      platforms: string[];
      twitter?: string;
      discord?: string;
      comment?: string;
      id?: string;
    }[];
    contributorDetails: {
      address: string;
      totalContributed: number;
      totalReceived: number;
      netContribution: number;
      platforms: string[];
      poolBreakdown: {
        [platform: string]: {
          contributed: number;
          received: number;
          pools: string[];
        };
      };
      twitter?: string;
      discord?: string;
      comment?: string;
      id?: string;
    }[];
  };
}
