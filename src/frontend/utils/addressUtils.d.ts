declare module '../utils/addressUtils.js' {
  export function truncateAddress(address: string, startChars?: number, endChars?: number): string;
  export function createExplorerUrl(address: string, type?: 'address' | 'token' | 'tx', cluster?: string): string;
  export function isValidSolanaAddress(address: string): boolean;
  export function formatAddressAsLink(address: string, truncate?: boolean): { href: string; display: string };
} 