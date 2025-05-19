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
}

export interface TokenHolder {
  address: string;
  balance: number;
  isLpPool?: boolean;
  isTreasury?: boolean;
  twitter?: string; // Social profile data
  discord?: string;
  comment?: string;
}

export interface TokenSnapshot {
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