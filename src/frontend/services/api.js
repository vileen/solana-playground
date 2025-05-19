// Helper to get the base API URL based on environment
const API_BASE_URL = process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost'
  ? '/api'
  : 'http://localhost:3001/api';

// Fetch NFT holders
export const fetchNftHolders = async (searchTerm) => {
  try {
    let url = `${API_BASE_URL}/holders`;
    if (searchTerm) {
      url += `?search=${encodeURIComponent(searchTerm)}`;
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
export const fetchTokenHolders = async (searchTerm) => {
  try {
    let url = `${API_BASE_URL}/token-holders`;
    if (searchTerm) {
      url += `?search=${encodeURIComponent(searchTerm)}`;
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
export const fetchSocialProfiles = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/social-profiles`);
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
        comment
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
export const saveSocialProfile = async (profileData) => {
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