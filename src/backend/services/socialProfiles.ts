import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';

import { SOCIAL_PROFILES_FILE } from '../config/config.js';

interface SocialData {
  twitter?: string | null;
  discord?: string | null;
  comment?: string | null;
  id?: string;
  wallets?: Array<{ address: string }>;
  updatedAt?: string;
}

interface ProfileStore {
  byWallet: Record<string, { socialId: string }>;
  profiles: Record<string, SocialData>;
}

// Function to load social profiles
export async function loadSocialProfiles(): Promise<Record<string, any>> {
  try {
    if (existsSync(SOCIAL_PROFILES_FILE)) {
      const content = await readFile(SOCIAL_PROFILES_FILE, 'utf-8');
      const data = JSON.parse(content);

      // Check if we're using the new format or need to convert
      if (data.byWallet && data.profiles) {
        // Already using new format - transform to wallet-to-profile mapping
        const walletToProfileMap: Record<string, any> = {};

        // For each wallet address, find its profile and create a mapping
        for (const address in data.byWallet) {
          const socialId = data.byWallet[address].socialId;
          const profile = data.profiles[socialId];

          if (profile) {
            // Include the actual backend socialId (e.g., "social_12345678_abc123") as the id
            walletToProfileMap[address] = {
              twitter: profile.twitter,
              discord: profile.discord,
              comment: profile.comment,
              id: socialId,
            };
          }
        }

        return walletToProfileMap;
      } else {
        // Old format - already a wallet-to-profile mapping
        return data;
      }
    }
  } catch (error) {
    console.error('Error loading social profiles:', error);
  }
  return {};
}

// Function to save social profiles
export async function saveSocialProfilesFile(data: ProfileStore): Promise<void> {
  try {
    await writeFile(SOCIAL_PROFILES_FILE, JSON.stringify(data, null, 2));
    console.log('Social profiles saved');
  } catch (error) {
    console.error('Error saving social profiles:', error);
  }
}

// Legacy function to update a single social profile
export async function saveSocialProfile(
  walletAddressOrProfile: string | SocialData,
  socialData?: { twitter?: string; discord?: string; comment?: string }
): Promise<boolean> {
  try {
    // Handle new profile format
    if (typeof walletAddressOrProfile === 'object') {
      return saveGroupedSocialProfile(walletAddressOrProfile);
    }

    // Old format - single wallet address
    const walletAddress = walletAddressOrProfile;

    // Create/load profiles storage
    let profileStore: ProfileStore;

    try {
      if (existsSync(SOCIAL_PROFILES_FILE)) {
        const content = await readFile(SOCIAL_PROFILES_FILE, 'utf-8');
        const data = JSON.parse(content);

        // Check if we're using the new format
        if (data.byWallet && data.profiles) {
          profileStore = data;
        } else {
          // Migrate old format to new format
          profileStore = {
            byWallet: {},
            profiles: {},
          };

          // Convert old data to new format
          for (const [addr, profile] of Object.entries(data)) {
            const socialId = `social_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            profileStore.profiles[socialId] = profile as SocialData;
            profileStore.byWallet[addr] = { socialId };
          }
        }
      } else {
        profileStore = {
          byWallet: {},
          profiles: {},
        };
      }
    } catch (error) {
      console.error('Error reading social profiles file:', error);
      profileStore = {
        byWallet: {},
        profiles: {},
      };
    }

    // Check if this wallet is already associated with a profile
    if (profileStore.byWallet[walletAddress]) {
      // Update existing profile
      const socialId = profileStore.byWallet[walletAddress].socialId;
      profileStore.profiles[socialId] = {
        ...profileStore.profiles[socialId],
        ...socialData,
        updatedAt: new Date().toISOString(),
      };
    } else {
      // Create new profile
      const socialId = `social_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      profileStore.profiles[socialId] = {
        ...socialData,
        updatedAt: new Date().toISOString(),
      };
      profileStore.byWallet[walletAddress] = { socialId };
    }

    // Save the updated profiles
    await saveSocialProfilesFile(profileStore);
    return true;
  } catch (error) {
    console.error('Error saving social profile:', error);
    return false;
  }
}

// New function to save a grouped social profile with multiple wallets
async function saveGroupedSocialProfile(profileData: SocialData): Promise<boolean> {
  try {
    // Allow empty wallets array
    const walletAddresses = profileData.wallets?.map(w => w.address) || [];

    // Create/load profiles storage
    let profileStore: ProfileStore;

    try {
      if (existsSync(SOCIAL_PROFILES_FILE)) {
        const content = await readFile(SOCIAL_PROFILES_FILE, 'utf-8');
        profileStore = JSON.parse(content);

        // Ensure we have the correct structure
        if (!profileStore.byWallet || !profileStore.profiles) {
          profileStore = {
            byWallet: {},
            profiles: {},
          };
        }
      } else {
        profileStore = {
          byWallet: {},
          profiles: {},
        };
      }
    } catch (error) {
      console.error('Error reading social profiles file:', error);
      profileStore = {
        byWallet: {},
        profiles: {},
      };
    }

    // Check if we're updating an existing profile
    let socialId = profileData.id;

    if (!socialId) {
      // Check if any of these wallets are already associated with a profile
      for (const wallet of walletAddresses) {
        if (profileStore.byWallet[wallet]) {
          socialId = profileStore.byWallet[wallet].socialId;
          break;
        }
      }

      // If still no socialId, create a new one
      if (!socialId) {
        socialId = `social_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
    }

    // Find all wallets that were previously associated with this socialId
    const previousWallets = Object.entries(profileStore.byWallet)
      .filter(([_, data]) => data.socialId === socialId)
      .map(([addr, _]) => addr);

    // Find wallets that are no longer in the list and need to be removed
    const walletsToRemove = previousWallets.filter(addr => !walletAddresses.includes(addr));

    console.log(
      `Updating profile ${socialId}: Adding ${walletAddresses.length} wallets, removing ${walletsToRemove.length} wallets`
    );

    // Remove wallet mappings that are no longer associated with this profile
    for (const wallet of walletsToRemove) {
      delete profileStore.byWallet[wallet];
      console.log(`Removed wallet ${wallet} from profile ${socialId}`);
    }

    // Remove any existing mappings for these wallets to avoid duplicates
    for (const wallet of walletAddresses) {
      if (profileStore.byWallet[wallet] && profileStore.byWallet[wallet].socialId !== socialId) {
        const oldSocialId = profileStore.byWallet[wallet].socialId;

        // Check if the old profile has any other wallets
        const hasOtherWallets = Object.entries(profileStore.byWallet).some(
          ([addr, data]) => addr !== wallet && data.socialId === oldSocialId
        );

        // If not, remove the old profile
        if (!hasOtherWallets && profileStore.profiles[oldSocialId]) {
          delete profileStore.profiles[oldSocialId];
        }
      }
    }

    // Update the profile
    profileStore.profiles[socialId] = {
      twitter: profileData.twitter,
      discord: profileData.discord,
      comment: profileData.comment,
      updatedAt: new Date().toISOString(),
    };

    // Update wallet mappings
    for (const wallet of walletAddresses) {
      profileStore.byWallet[wallet] = { socialId };
    }

    // Save the updated profiles
    await saveSocialProfilesFile(profileStore);
    return true;
  } catch (error) {
    console.error('Error saving grouped social profile:', error);
    return false;
  }
}

// Function to delete a social profile
export async function deleteSocialProfile(socialId: string): Promise<boolean> {
  try {
    let profileStore: ProfileStore;

    // Load existing profile data
    try {
      if (existsSync(SOCIAL_PROFILES_FILE)) {
        const content = await readFile(SOCIAL_PROFILES_FILE, 'utf-8');
        profileStore = JSON.parse(content);

        if (!profileStore.byWallet || !profileStore.profiles) {
          return false; // Invalid profile store format
        }
      } else {
        return false; // Profile file doesn't exist
      }
    } catch (error) {
      console.error('Error reading social profiles file:', error);
      return false;
    }

    // Check if the profile exists
    if (!profileStore.profiles[socialId]) {
      console.error(`Profile with ID ${socialId} not found`);
      return false;
    }

    console.log(`Deleting profile ${socialId}`);

    // Find all wallets associated with this profile
    const associatedWallets = Object.entries(profileStore.byWallet)
      .filter(([_, data]) => data.socialId === socialId)
      .map(([addr, _]) => addr);

    // Remove all wallet mappings for this profile
    for (const wallet of associatedWallets) {
      delete profileStore.byWallet[wallet];
      console.log(`Removed wallet mapping for ${wallet}`);
    }

    // Delete the profile itself
    delete profileStore.profiles[socialId];

    // Save the updated profiles
    await saveSocialProfilesFile(profileStore);
    console.log(`Profile ${socialId} successfully deleted`);
    return true;
  } catch (error) {
    console.error('Error deleting social profile:', error);
    return false;
  }
}
