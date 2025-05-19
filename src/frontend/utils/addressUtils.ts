/**
 * Utilities for formatting and handling Solana addresses
 */

/**
 * Truncates a Solana address for display purposes
 * e.g., "ABC...XYZ"
 * 
 * @param address The full Solana address
 * @param startChars Number of characters to show at the start
 * @param endChars Number of characters to show at the end
 * @returns Truncated address string
 */
export function truncateAddress(address: string, startChars = 4, endChars = 4): string {
  if (!address) return '';
  
  if (address.length <= startChars + endChars) {
    return address;
  }
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Checks if a string is a valid Solana address (public key)
 * 
 * @param address The address to validate
 * @returns True if the address appears to be a valid Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  // Basic validation - Solana addresses are base58 encoded and 44 characters long
  return Boolean(address && address.length === 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(address));
}

/**
 * Creates a link to Solana Explorer for the given address
 * 
 * @param address The Solana address
 * @param cluster Network to use (mainnet, devnet, testnet)
 * @returns URL to Solana Explorer
 */
export function getSolanaExplorerLink(address: string, cluster = 'mainnet'): string {
  return `https://explorer.solana.com/address/${address}?cluster=${cluster}`;
} 