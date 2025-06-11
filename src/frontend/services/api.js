// Helper to get the base API URL based on environment
const API_BASE_URL =
  process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost'
    ? '/api'
    : 'http://localhost:3001/api';

// Fetch NFT holders
export const fetchNftHolders = async (searchTerm, snapshotId) => {
  try {
    let url = `${API_BASE_URL}/holders`;
    const params = new URLSearchParams();

    if (searchTerm) {
      params.append('search', searchTerm);
    }

    if (snapshotId) {
      params.append('snapshotId', snapshotId);
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching NFT holders:', error);
    throw error;
  }
};

// Fetch token holders
export const fetchTokenHolders = async (searchTerm, snapshotId) => {
  try {
    let url = `${API_BASE_URL}/token-holders`;
    const params = new URLSearchParams();

    if (searchTerm) {
      params.append('search', searchTerm);
    }

    if (snapshotId) {
      params.append('snapshotId', snapshotId);
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching token holders:', error);
    throw error;
  }
};

// Fetch social profiles
export const fetchSocialProfiles = async searchTerm => {
  try {
    const url = new URL(`${API_BASE_URL}/social-profiles`, window.location.origin);
    if (searchTerm) {
      url.searchParams.append('search', searchTerm);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching social profiles:', error);
    throw error;
  }
};

// Take NFT snapshot
export const takeNftSnapshot = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/snapshot`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error taking NFT snapshot:', error);
    throw error;
  }
};

// Take token snapshot
export const takeTokenSnapshot = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/token-snapshot`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error taking token snapshot:', error);
    throw error;
  }
};

// Save social profile (legacy format)
export const saveSocialProfileLegacy = async (walletAddress, twitter, discord, comment) => {
  try {
    const response = await fetch(`${API_BASE_URL}/social-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        twitter,
        discord,
        comment,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving social profile:', error);
    throw error;
  }
};

// Save social profile (new format with multiple wallets)
export const saveSocialProfile = async profileData => {
  try {
    const response = await fetch(`${API_BASE_URL}/social-profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving social profile:', error);
    throw error;
  }
};

// Delete social profile
export const deleteSocialProfile = async profileId => {
  try {
    if (!profileId) {
      console.error('Cannot delete profile: No profile ID provided');
      throw new Error('No profile ID provided');
    }

    console.log(`Attempting to delete profile with ID: ${profileId}`);
    const url = `${API_BASE_URL}/social-profiles/${encodeURIComponent(profileId)}`;

    console.log(`Deleting social profile at URL:`, url);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`Delete profile failed with status ${response.status}:`, errorData);
      throw new Error(`Failed to delete social profile: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error deleting social profile:', error);
    throw error;
  }
};

// Fetch latest token events
export const fetchLatestTokenEvents = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/token-events/latest`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching latest token events:', error);
    return [];
  }
};

// Fetch latest NFT events
export const fetchLatestNFTEvents = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/nft-events/latest`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching latest NFT events:', error);
    return [];
  }
};

// Fetch token events for a specific snapshot
export const fetchTokenEventsForSnapshot = async snapshotId => {
  try {
    const response = await fetch(`${API_BASE_URL}/token-events/${snapshotId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching token events for snapshot ${snapshotId}:`, error);
    return [];
  }
};

// Fetch NFT events for a specific snapshot
export const fetchNFTEventsForSnapshot = async snapshotId => {
  try {
    const response = await fetch(`${API_BASE_URL}/nft-events/${snapshotId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching NFT events for snapshot ${snapshotId}:`, error);
    return [];
  }
};

// Fetch token snapshots with their events
export const fetchTokenSnapshotsWithEvents = async (limit = 5, skip = 0) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/events/token/snapshots?limit=${limit}&skip=${skip}`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching token snapshots with events:', error);
    return [];
  }
};

// Fetch NFT snapshots with their events
export const fetchNFTSnapshotsWithEvents = async (limit = 5, skip = 0) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/events/nft/snapshots?limit=${limit}&skip=${skip}`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching NFT snapshots with events:', error);
    return [];
  }
};

// Fetch NFT snapshots
export const fetchNftSnapshots = async (limit = 10) => {
  try {
    const response = await fetch(`${API_BASE_URL}/nft/snapshots?limit=${limit}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching NFT snapshots:', error);
    return [];
  }
};

// Fetch token snapshots
export const fetchTokenSnapshots = async (limit = 10) => {
  try {
    const response = await fetch(`${API_BASE_URL}/token-snapshots?limit=${limit}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching token snapshots:', error);
    return [];
  }
};

// ============= STAKING API FUNCTIONS =============
// Fetch staking data
export const fetchStakingData = async (searchTerm = '', snapshotId) => {
  try {
    let url = `${API_BASE_URL}/staking`;
    const params = new URLSearchParams();

    if (searchTerm) {
      params.append('search', searchTerm);
    }

    if (snapshotId !== undefined && snapshotId !== null) {
      params.append('snapshotId', snapshotId.toString());
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching staking data:', error);
    throw error;
  }
};

// Take staking snapshot
export const takeStakingSnapshot = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/staking-snapshot`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error taking staking snapshot:', error);
    throw error;
  }
};

// Fetch staking snapshots
export const fetchStakingSnapshots = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/staking-snapshots`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching staking snapshots:', error);
    return [];
  }
};

// Fetch unlock summary
export const fetchUnlockSummary = async (snapshotId, walletAddress) => {
  try {
    let url = `${API_BASE_URL}/staking-unlock-summary`;
    const params = new URLSearchParams();

    if (snapshotId !== undefined && snapshotId !== null) {
      params.append('snapshotId', snapshotId.toString());
    }

    if (walletAddress && walletAddress.trim() !== '') {
      params.append('walletAddress', walletAddress.trim());
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching unlock summary:', error);
    return [];
  }
};
