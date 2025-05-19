import { NFTHolder, TokenHolder } from '../../types/index.js';

// Helper to get the base API URL based on environment
export const getApiUrl = (): string => {
  // In production, API endpoints are on the same domain, so use relative URLs
  if (process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost') {
    return '/api';
  }
  // In development, use the local dev server
  return process.env.VITE_API_URL || 'http://localhost:3001/api';
};

// Fetch NFT holders
export const fetchNftHolders = async (searchTerm?: string): Promise<NFTHolder[]> => {
  try {
    const baseUrl = getApiUrl();
    let url;
    
    // Handle relative URLs properly
    if (baseUrl.startsWith('/')) {
      // For relative URLs, append to current origin
      url = `${window.location.origin}${baseUrl}/holders`;
    } else {
      // For absolute URLs, use as is
      url = `${baseUrl}/holders`;
    }
    
    // Add search parameter if needed
    const finalUrl = new URL(url);
    if (searchTerm) {
      finalUrl.searchParams.append('search', searchTerm);
    }
    
    console.log('Fetching holders from:', finalUrl.toString());
    const response = await fetch(finalUrl.toString());
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to fetch holders: ${response.status} ${response.statusText} ${errorData.message || ''}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('Error fetching holders:', error);
    throw error;
  }
};

// Fetch token holders
export const fetchTokenHolders = async (searchTerm?: string): Promise<TokenHolder[]> => {
  try {
    const baseUrl = getApiUrl();
    let url;
    
    // Handle relative URLs properly
    if (baseUrl.startsWith('/')) {
      // For relative URLs, append to current origin
      url = `${window.location.origin}${baseUrl}/token-holders`;
    } else {
      // For absolute URLs, use as is
      url = `${baseUrl}/token-holders`;
    }
    
    // Add search parameter if needed
    const finalUrl = new URL(url);
    if (searchTerm) {
      finalUrl.searchParams.append('search', searchTerm);
    }
    
    console.log('Fetching token holders from:', finalUrl.toString());
    const response = await fetch(finalUrl.toString());
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to fetch token holders: ${response.status} ${response.statusText} ${errorData.message || ''}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('Error fetching token holders:', error);
    throw error;
  }
};

// Fetch social profiles
export const fetchSocialProfiles = async (): Promise<any[]> => {
  try {
    const baseUrl = getApiUrl();
    let url;
    
    // Handle relative URLs properly
    if (baseUrl.startsWith('/')) {
      // For relative URLs, append to current origin
      url = `${window.location.origin}${baseUrl}/social-profiles`;
    } else {
      // For absolute URLs, use as is
      url = `${baseUrl}/social-profiles`;
    }
    
    console.log('Fetching social profiles from:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to fetch social profiles: ${response.status} ${response.statusText} ${errorData.message || ''}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('Error fetching social profiles:', error);
    throw error;
  }
};

// Take NFT snapshot
export const takeNftSnapshot = async (): Promise<{ holders: NFTHolder[], total: number, timestamp: string }> => {
  try {
    const baseUrl = getApiUrl();
    let url;
    
    // Handle relative URLs properly
    if (baseUrl.startsWith('/')) {
      // For relative URLs, append to current origin
      url = `${window.location.origin}${baseUrl}/snapshot`;
    } else {
      // For absolute URLs, use as is
      url = `${baseUrl}/snapshot`;
    }
    
    console.log('Taking snapshot from:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to take snapshot: ${response.status} ${response.statusText} ${errorData.message || ''}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('Error taking snapshot:', error);
    throw error;
  }
};

// Take token snapshot
export const takeTokenSnapshot = async (): Promise<{ holders: TokenHolder[], totalSupply: number, timestamp: string }> => {
  try {
    const baseUrl = getApiUrl();
    let url;
    
    // Handle relative URLs properly
    if (baseUrl.startsWith('/')) {
      // For relative URLs, append to current origin
      url = `${window.location.origin}${baseUrl}/token-snapshot`;
    } else {
      // For absolute URLs, use as is
      url = `${baseUrl}/token-snapshot`;
    }
    
    console.log('Taking token snapshot from:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to take token snapshot: ${response.status} ${response.statusText} ${errorData.message || ''}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('Error taking token snapshot:', error);
    throw error;
  }
};

// Save social profile
export const saveSocialProfile = async (walletAddress: string, twitter: string, discord: string, comment: string): Promise<boolean> => {
  try {
    const baseUrl = getApiUrl();
    let url;
    
    // Handle relative URLs properly
    if (baseUrl.startsWith('/')) {
      // For relative URLs, append to current origin
      url = `${window.location.origin}${baseUrl}/social-profile`;
    } else {
      // For absolute URLs, use as is
      url = `${baseUrl}/social-profile`;
    }
    
    console.log(`Saving social profile for ${walletAddress} to:`, url);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        walletAddress,
        twitter,
        discord,
        comment
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to save social profile: ${response.status} ${response.statusText} ${errorData.message || ''}`);
    }
    
    const result = await response.json();
    return result.success === true;
  } catch (error: any) {
    console.error('Error saving social profile:', error);
    return false;
  }
}; 