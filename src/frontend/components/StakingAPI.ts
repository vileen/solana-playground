/**
 * This file re-exports the staking API functions from the main API file
 * to work around import issues.
 */

// Base API URL
const API_BASE = '/api';

// Helper to get the base API URL based on environment
export const getApiUrl = (): string => {
  // In production, API endpoints are on the same domain, so use relative URLs
  if (process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost') {
    return '/api';
  }
  // In development, use the local dev server
  return process.env.VITE_API_URL || 'http://localhost:3001/api';
};

// Fetch staking data
export async function fetchStakingData(searchTerm?: string, snapshotId?: number): Promise<any[]> {
  try {
    const baseUrl = getApiUrl();
    let url;

    // Handle relative URLs properly
    if (baseUrl.startsWith('/')) {
      // For relative URLs, append to current origin
      url = `${window.location.origin}${baseUrl}/staking`;
    } else {
      // For absolute URLs, use as is
      url = `${baseUrl}/staking`;
    }

    // Add parameters if needed
    const finalUrl = new URL(url);
    if (searchTerm) {
      finalUrl.searchParams.append('search', searchTerm);
    }
    if (snapshotId !== undefined && snapshotId !== null) {
      finalUrl.searchParams.append('snapshotId', snapshotId.toString());
    }

    console.log('Fetching staking data from:', finalUrl.toString());
    const response = await fetch(finalUrl.toString());

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to fetch staking data: ${response.status} ${response.statusText} ${errorData.message || ''}`
      );
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error fetching staking data:', error);
    throw error;
  }
}

// Take staking snapshot
export async function takeStakingSnapshot(): Promise<any> {
  try {
    const baseUrl = getApiUrl();
    let url;

    // Handle relative URLs properly
    if (baseUrl.startsWith('/')) {
      // For relative URLs, append to current origin
      url = `${window.location.origin}${baseUrl}/staking-snapshot`;
    } else {
      // For absolute URLs, use as is
      url = `${baseUrl}/staking-snapshot`;
    }

    console.log('Taking staking snapshot from:', url);
    const response = await fetch(url, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to take staking snapshot: ${response.status} ${response.statusText} ${errorData.message || ''}`
      );
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error taking staking snapshot:', error);
    throw error;
  }
}

// Fetch staking snapshots
export async function fetchStakingSnapshots(): Promise<any[]> {
  try {
    const baseUrl = getApiUrl();
    let url;

    // Handle relative URLs properly
    if (baseUrl.startsWith('/')) {
      // For relative URLs, append to current origin
      url = `${window.location.origin}${baseUrl}/staking-snapshots`;
    } else {
      // For absolute URLs, use as is
      url = `${baseUrl}/staking-snapshots`;
    }

    console.log('Fetching staking snapshots from:', url);
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to fetch staking snapshots: ${response.status} ${response.statusText} ${errorData.message || ''}`
      );
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error fetching staking snapshots:', error);
    throw error;
  }
}

// Fetch unlock summary
export async function fetchUnlockSummary(
  snapshotId?: number,
  walletAddress?: string
): Promise<any[]> {
  try {
    const baseUrl = getApiUrl();
    let url;

    // Handle relative URLs properly
    if (baseUrl.startsWith('/')) {
      // For relative URLs, append to current origin
      url = `${window.location.origin}${baseUrl}/staking-unlock-summary`;
    } else {
      // For absolute URLs, use as is
      url = `${baseUrl}/staking-unlock-summary`;
    }

    // Add parameters if needed
    const finalUrl = new URL(url);
    if (snapshotId !== undefined && snapshotId !== null) {
      finalUrl.searchParams.append('snapshotId', snapshotId.toString());
    }
    if (walletAddress && walletAddress.trim() !== '') {
      finalUrl.searchParams.append('walletAddress', walletAddress.trim());
    }

    console.log('Fetching unlock summary from:', finalUrl.toString());
    const response = await fetch(finalUrl.toString());

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to fetch unlock summary: ${response.status} ${response.statusText} ${errorData.message || ''}`
      );
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error fetching unlock summary:', error);
    throw error;
  }
}

// Fetch social profiles
export async function fetchSocialProfiles(): Promise<any[]> {
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
}
