/**
 * Truncate a Solana wallet address for display purposes
 * @param {string} address - The full wallet address
 * @param {number} [startChars=4] - Number of characters to show at start
 * @param {number} [endChars=4] - Number of characters to show at end
 * @returns {string} - Truncated address with ellipsis
 */
export const truncateAddress = (address, startChars = 4, endChars = 4) => {
  if (!address) return '';
  
  if (address.length <= startChars + endChars + 3) {
    return address;
  }
  
  return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
};

/**
 * Create a Solana Explorer URL for an address
 * @param {string} address - The wallet or token address
 * @param {string} [type='address'] - The type of address ('address', 'token', 'tx')
 * @param {string} [cluster='mainnet'] - The Solana cluster ('mainnet', 'devnet', 'testnet')
 * @returns {string} - Explorer URL
 */
export const createExplorerUrl = (address, type = 'address', cluster = 'mainnet') => {
  if (!address) return '';
  
  const baseUrl = 'https://explorer.solana.com';
  const clusterParam = cluster !== 'mainnet' ? `?cluster=${cluster}` : '';
  
  return `${baseUrl}/${type}/${address}${clusterParam}`;
};

/**
 * Check if a string appears to be a valid Solana address
 * @param {string} address - The address to validate
 * @returns {boolean} - True if address appears valid
 */
export const isValidSolanaAddress = (address) => {
  if (!address) return false;
  
  // Basic validation: Solana addresses are base58 encoded and are typically 32-44 characters
  const validAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return validAddressRegex.test(address);
};

/**
 * Format wallet addresses as links to Solana Explorer
 * @param {string} address - The wallet address
 * @param {boolean} [truncate=true] - Whether to truncate the address display
 * @returns {Object} - Object with href and display text
 */
export const formatAddressAsLink = (address, truncate = true) => {
  if (!address) return { href: '', display: '' };
  
  const href = createExplorerUrl(address);
  const display = truncate ? truncateAddress(address) : address;
  
  return { href, display };
}; 