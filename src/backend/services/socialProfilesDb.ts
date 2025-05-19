import { query, withTransaction } from '../db/index.js';

interface SocialData {
  twitter?: string | null;
  discord?: string | null;
  comment?: string | null;
  id?: string;
  wallets?: Array<{ address: string }>;
  updatedAt?: string;
}

// Function to load all social profiles
export async function loadSocialProfiles(): Promise<Record<string, any>> {
  try {
    const result = await query(`
      SELECT w.address, p.id, p.twitter, p.discord, p.comment
      FROM wallet_addresses w
      JOIN social_profiles p ON w.social_id = p.id
    `);

    // Transform to wallet-to-profile mapping format to maintain compatibility with existing code
    const walletToProfileMap: Record<string, any> = {};

    for (const row of result.rows) {
      walletToProfileMap[row.address] = {
        twitter: row.twitter,
        discord: row.discord,
        comment: row.comment,
        id: row.id,
      };
    }

    return walletToProfileMap;
  } catch (error) {
    console.error('Error loading social profiles from database:', error);
    return {};
  }
}

// Function to save a social profile (handles both single wallet and multiple wallets)
export async function saveSocialProfile(
  walletAddressOrProfile: string | SocialData,
  socialData?: { twitter?: string; discord?: string; comment?: string }
): Promise<boolean> {
  try {
    // Handle new profile format with multiple wallets
    if (typeof walletAddressOrProfile === 'object') {
      return saveGroupedSocialProfile(walletAddressOrProfile);
    }

    // Old format - single wallet address
    const walletAddress = walletAddressOrProfile;
    
    return await withTransaction(async (client) => {
      // Check if this wallet already has a profile
      const existingWalletResult = await client.query(
        'SELECT social_id FROM wallet_addresses WHERE address = $1',
        [walletAddress]
      );

      let socialId: string;

      if (existingWalletResult.rowCount > 0) {
        // Wallet exists, update the associated profile
        socialId = existingWalletResult.rows[0].social_id;
        
        await client.query(
          `UPDATE social_profiles 
           SET twitter = $1, discord = $2, comment = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [socialData?.twitter || null, socialData?.discord || null, socialData?.comment || null, socialId]
        );
      } else {
        // Create a new profile and associate the wallet
        socialId = `social_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        await client.query(
          `INSERT INTO social_profiles (id, twitter, discord, comment)
           VALUES ($1, $2, $3, $4)`,
          [socialId, socialData?.twitter || null, socialData?.discord || null, socialData?.comment || null]
        );
        
        await client.query(
          `INSERT INTO wallet_addresses (address, social_id)
           VALUES ($1, $2)`,
          [walletAddress, socialId]
        );
      }
      
      return true;
    });
  } catch (error) {
    console.error('Error saving social profile to database:', error);
    return false;
  }
}

// Function to save a grouped social profile with multiple wallets
async function saveGroupedSocialProfile(profileData: SocialData): Promise<boolean> {
  try {
    const walletAddresses = profileData.wallets?.map(w => w.address) || [];
    
    return await withTransaction(async (client) => {
      let socialId = profileData.id;
      
      if (!socialId) {
        // Check if any of these wallets already has a profile
        if (walletAddresses.length > 0) {
          const existingWalletsResult = await client.query(
            `SELECT address, social_id FROM wallet_addresses 
             WHERE address = ANY($1)`,
            [walletAddresses]
          );
          
          if (existingWalletsResult.rowCount > 0) {
            socialId = existingWalletsResult.rows[0].social_id;
          }
        }
        
        // If still no socialId, create a new one
        if (!socialId) {
          socialId = `social_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }
      }
      
      // First, find all wallets currently associated with this profile
      const currentWalletsResult = await client.query(
        'SELECT address FROM wallet_addresses WHERE social_id = $1',
        [socialId]
      );
      
      const currentWallets = currentWalletsResult.rows.map(row => row.address);
      
      // Find wallets that need to be removed (in current but not in new list)
      const walletsToRemove = currentWallets.filter(address => !walletAddresses.includes(address));
      
      // Find wallets that need to be added (in new list but not in current)
      const walletsToAdd = walletAddresses.filter(address => !currentWallets.includes(address));
      
      console.log(
        `Updating profile ${socialId}: Adding ${walletsToAdd.length} wallets, removing ${walletsToRemove.length} wallets`
      );
      
      // Check if profile exists
      const profileExists = await client.query(
        'SELECT id FROM social_profiles WHERE id = $1',
        [socialId]
      );
      
      if (profileExists.rowCount === 0) {
        // Create new profile
        await client.query(
          `INSERT INTO social_profiles (id, twitter, discord, comment)
           VALUES ($1, $2, $3, $4)`,
          [socialId, profileData.twitter || null, profileData.discord || null, profileData.comment || null]
        );
      } else {
        // Update existing profile
        await client.query(
          `UPDATE social_profiles 
           SET twitter = $1, discord = $2, comment = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [profileData.twitter || null, profileData.discord || null, profileData.comment || null, socialId]
        );
      }
      
      // Handle wallets to remove
      if (walletsToRemove.length > 0) {
        await client.query(
          'DELETE FROM wallet_addresses WHERE address = ANY($1)',
          [walletsToRemove]
        );
      }
      
      // For wallets being added, first check if any are associated with other profiles
      for (const wallet of walletsToAdd) {
        // Check if wallet exists with different social_id
        const existingWalletResult = await client.query(
          'SELECT social_id FROM wallet_addresses WHERE address = $1',
          [wallet]
        );
        
        if (existingWalletResult.rowCount > 0) {
          const oldSocialId = existingWalletResult.rows[0].social_id;
          
          if (oldSocialId !== socialId) {
            // Remove existing association
            await client.query(
              'DELETE FROM wallet_addresses WHERE address = $1',
              [wallet]
            );
            
            // Check if old profile has any other wallets
            const oldProfileWalletsResult = await client.query(
              'SELECT COUNT(*) FROM wallet_addresses WHERE social_id = $1',
              [oldSocialId]
            );
            
            // If no other wallets, remove the profile
            if (parseInt(oldProfileWalletsResult.rows[0].count) === 0) {
              await client.query(
                'DELETE FROM social_profiles WHERE id = $1',
                [oldSocialId]
              );
            }
          }
        }
      }
      
      // Add new wallet associations
      for (const wallet of walletsToAdd) {
        await client.query(
          `INSERT INTO wallet_addresses (address, social_id)
           VALUES ($1, $2)
           ON CONFLICT (address) DO UPDATE SET social_id = $2`,
          [wallet, socialId]
        );
      }
      
      return true;
    });
  } catch (error) {
    console.error('Error saving grouped social profile to database:', error);
    return false;
  }
}

// Function to delete a social profile
export async function deleteSocialProfile(socialId: string): Promise<boolean> {
  try {
    return await withTransaction(async (client) => {
      // Check if profile exists
      const profileExists = await client.query(
        'SELECT id FROM social_profiles WHERE id = $1',
        [socialId]
      );
      
      if (profileExists.rowCount === 0) {
        console.error(`Profile with ID ${socialId} not found`);
        return false;
      }
      
      // Delete wallet associations (cascade will handle this, but let's be explicit)
      await client.query(
        'DELETE FROM wallet_addresses WHERE social_id = $1',
        [socialId]
      );
      
      // Delete the profile
      await client.query(
        'DELETE FROM social_profiles WHERE id = $1',
        [socialId]
      );
      
      console.log(`Profile ${socialId} successfully deleted`);
      return true;
    });
  } catch (error) {
    console.error('Error deleting social profile from database:', error);
    return false;
  }
} 