export interface NFTHolder {
  address: string;
  nftCount: number;
  gen1Count: number;
  infantCount: number;
  nfts: {
    mint: string;
    name: string;
    type: 'Gen1' | 'Infant';
  }[];
  socialProfiles?: {
    twitter?: string;
    discord?: string;
    comment?: string;
  };
}

export interface TokenHolder {
  address: string;
  balance: number;
  isLpPool?: boolean;
  isTreasury?: boolean;
  socialProfiles?: {
    twitter?: string;
    discord?: string;
    comment?: string;
  };
}

export interface TokenSnapshot {
  tokenAddress: string;
  timestamp: number;
  holders: TokenHolder[];
}

export interface CollectionSnapshot {
  collectionAddress: string[];
  timestamp: number;
  holders: NFTHolder[];
}

export interface TokenDistribution {
  holderAddress: string;
  amount: number;
  status: 'pending' | 'sent' | 'failed';
  transactionId?: string;
} 