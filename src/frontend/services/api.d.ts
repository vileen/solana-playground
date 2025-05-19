// Type definition overrides for the API module
import { NFTHolder, TokenHolder } from '../../types/index';

// Override the saveSocialProfile function to accept either the old format or the new profile format
export function saveSocialProfile(profileData: any): Promise<any>;

export function saveSocialProfile(
  walletAddress: string,
  twitter: string,
  discord: string,
  comment: string
): Promise<boolean>;

// Ensure other functions are properly typed
export function fetchNftHolders(searchTerm?: string): Promise<NFTHolder[]>;
export function fetchTokenHolders(searchTerm?: string): Promise<TokenHolder[]>;
export function fetchSocialProfiles(): Promise<any[]>;
export function takeNftSnapshot(): Promise<{
  holders: NFTHolder[];
  total: number;
  timestamp: string;
}>;
export function takeTokenSnapshot(): Promise<{
  holders: TokenHolder[];
  totalSupply: number;
  timestamp: string;
}>;

declare module '../services/api.js' {
  export function fetchNftHolders(searchTerm?: string): Promise<any[]>;
  export function fetchTokenHolders(searchTerm?: string): Promise<any[]>;
  export function fetchSocialProfiles(): Promise<any[]>;
  export function takeNftSnapshot(): Promise<any>;
  export function takeTokenSnapshot(): Promise<any>;
  export function saveSocialProfileLegacy(walletAddress: string, twitter?: string, discord?: string, comment?: string): Promise<any>;
  export function saveSocialProfile(profileData: any): Promise<any>;
  export function deleteSocialProfile(profileId: string): Promise<any>;
  export function fetchLatestTokenEvents(): Promise<any[]>;
  export function fetchLatestNFTEvents(): Promise<any[]>;
  export function fetchTokenEventsForSnapshot(snapshotId: number): Promise<any[]>;
  export function fetchNFTEventsForSnapshot(snapshotId: number): Promise<any[]>;
  export function fetchTokenSnapshotsWithEvents(limit?: number): Promise<any[]>;
  export function fetchNFTSnapshotsWithEvents(limit?: number): Promise<any[]>;
}
