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

export interface TokenSnapshot {
  id?: number;         // Database ID of the snapshot
  tokenAddress: string;
  timestamp: string;   // ISO date string
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
