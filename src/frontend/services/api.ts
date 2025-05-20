import { EventNFTSnapshot, EventTokenSnapshot, NFTHolder, TokenHolder } from '../../types/index.js';

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
      throw new Error(
        `Failed to fetch holders: ${response.status} ${response.statusText} ${errorData.message || ''}`
      );
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error fetching holders:', error);
    throw error;
  }
};

// Fetch token holders
export const fetchTokenHolders = async (searchTerm?: string, snapshotId?: number): Promise<TokenHolder[]> => {
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

    // Add parameters if needed
    const finalUrl = new URL(url);
    if (searchTerm) {
      finalUrl.searchParams.append('search', searchTerm);
    }
    if (snapshotId !== undefined && snapshotId !== null) {
      finalUrl.searchParams.append('snapshotId', snapshotId.toString());
    }

    console.log('Fetching token holders from:', finalUrl.toString());
    const response = await fetch(finalUrl.toString());

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to fetch token holders: ${response.status} ${response.statusText} ${errorData.message || ''}`
      );
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
      throw new Error(
        `Failed to fetch social profiles: ${response.status} ${response.statusText} ${errorData.message || ''}`
      );
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error fetching social profiles:', error);
    throw error;
  }
};

// Take NFT snapshot
export const takeNftSnapshot = async (): Promise<{
  holders: NFTHolder[];
  total: number;
  timestamp: string;
}> => {
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
      throw new Error(
        `Failed to take snapshot: ${response.status} ${response.statusText} ${errorData.message || ''}`
      );
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error taking snapshot:', error);
    throw error;
  }
};

// Take token snapshot
export const takeTokenSnapshot = async (): Promise<{
  holders: TokenHolder[];
  totalSupply: number;
  timestamp: string;
}> => {
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
      throw new Error(
        `Failed to take token snapshot: ${response.status} ${response.statusText} ${errorData.message || ''}`
      );
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error taking token snapshot:', error);
    throw error;
  }
};

// Save social profile
export const saveSocialProfile = async (profileData: any): Promise<any> => {
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

    console.log(`Saving social profile to:`, url);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to save social profile: ${response.status} ${response.statusText} ${errorData.message || ''}`
      );
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error saving social profile:', error);
    throw error;
  }
};

// Delete social profile
export const deleteSocialProfile = async (profileId: string): Promise<any> => {
  try {
    const baseUrl = getApiUrl();
    let url;

    // Handle relative URLs properly
    if (baseUrl.startsWith('/')) {
      // For relative URLs, append to current origin
      url = `${window.location.origin}${baseUrl}/social-profiles/${profileId}`;
    } else {
      // For absolute URLs, use as is
      url = `${baseUrl}/social-profiles/${profileId}`;
    }

    console.log(`Deleting social profile:`, url);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to delete social profile: ${response.status} ${response.statusText} ${errorData.message || ''}`
      );
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error deleting social profile:', error);
    throw error;
  }
};

/**
 * Frontend API service to interact with the backend
 */

// Types
interface TokenEvent {
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
}

interface NFTEvent {
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
}

interface TokenSnapshot {
  id: number;
  timestamp: string;
  token_address: string;
  total_supply: number;
  events: TokenEvent[];
}

interface NFTSnapshot {
  id: number;
  timestamp: string;
  total_count: number;
  events: NFTEvent[];
}

// Base API URL
const API_BASE = '/api';

/**
 * Fetch token snapshots with associated events
 */
export async function fetchTokenSnapshotsWithEvents(limit = 5): Promise<EventTokenSnapshot[]> {
  try {
    const response = await fetch(`${API_BASE}/events/token/snapshots?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch token snapshots: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching token snapshots with events:', error);
    return [];
  }
}

/**
 * Fetch token snapshots
 */
export async function fetchTokenSnapshots(): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE}/token-snapshots`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch token snapshots: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching token snapshots:', error);
    return [];
  }
}

/**
 * Fetch NFT snapshots with associated events
 */
export async function fetchNFTSnapshotsWithEvents(limit = 5): Promise<EventNFTSnapshot[]> {
  try {
    const response = await fetch(`${API_BASE}/events/nft/snapshots?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch NFT snapshots: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching NFT snapshots with events:', error);
    return [];
  }
}
