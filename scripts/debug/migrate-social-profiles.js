// Script to migrate old social profile data to the new format
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const SOCIAL_PROFILES_FILE = path.join(DATA_DIR, 'social_profiles.json');

// Old data structure to migrate
const oldProfilesData = {
  "CyeLPkJs7CfzoC2MHLqwT61WFpwizFSE5zfZkivpv7z": {
    "twitter": "SolportTom",
    "discord": "solporttom"
  },
  "F5Vw7k9rwy9QFtbjJdvnyJiA6Hs3bfxszeuYMDQXHQtd": {
    "twitter": "vileeent",
    "discord": "_vileen"
  },
  "77CCdqAyub2fPBeSnyuqBstYmV68ajgCK3ux8tTDYFGD": {
    "twitter": "exodus_sol",
    "discord": "exdus_"
  },
  "7NfMDR5HV1ioyXFQXyPuYmoD6Qv4s3vNaajnp4fUUVcK": {
    "discord": "abdollasign"
  },
  "Fz9CbCaksGpgmwxFPJFHH5SYRfmiyFmv6y29tAaN6roH": {
    "discord": "zeefreaks",
    "twitter": "1037293"
  },
  "H2LN7auoZf5pdmpHUmuqUbYmGnGETrxV14vjZGS6RV7q": {
    "discord": "lovingrishi",
    "twitter": "LovingRishit"
  },
  "HRanJekcDT4HvJA5Pi9tccBzKutqFMrRHRLVugytML4n": {
    "discord": "puliusz"
  },
  "7nbzijZozh3j8dBsPmWhTUEFv2eH2MjvgqGcrTKYARtJ": {
    "comment": "TEAM"
  },
  "GpUmCRvdKF7EkiufUTCPDvPgy6Fi4GXtrLgLSwLCCyLd": {
    "comment": "GP STAKING"
  },
  "HkedZb9TNqFmVSUCQqhXzhWtsVLwwkJnztbsjeHi1WEa": {
    "comment": "NFT STAKING"
  },
  "CJpL2NxhQkDfu6k9PsGfFrQrBCaz7ijesNxyWcVmEvca": {
    "discord": "gulik.sol",
    "twitter": "Martin_Gula"
  },
  "Ch7xKu7R8UFQ9hmwe84SaMgFgCDsAnKg4Jw4jMgDdiHE": {
    "discord": "jamqs"
  }
};

async function migrateProfiles() {
  console.log('Starting social profiles migration...');

  try {
    // Ensure data directory exists
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      console.log(`Ensured data directory exists at ${DATA_DIR}`);
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }

    // Check if profiles file exists, load existing data if it does
    let currentData = { byWallet: {}, profiles: {} };
    
    try {
      const fileContent = await fs.readFile(SOCIAL_PROFILES_FILE, 'utf-8');
      currentData = JSON.parse(fileContent);
      console.log('Loaded existing social profiles data');
      
      // Ensure the structure has required properties
      if (!currentData.byWallet) currentData.byWallet = {};
      if (!currentData.profiles) currentData.profiles = {};
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      console.log('No existing social profiles file found, creating new one');
    }

    // Process old profiles data and merge with current data
    for (const [walletAddress, profileData] of Object.entries(oldProfilesData)) {
      // Check if the wallet is already associated with a profile
      if (currentData.byWallet[walletAddress]) {
        // Already exists, update the associated profile
        const socialId = currentData.byWallet[walletAddress].socialId;
        
        // Update only non-null fields from old data
        if (profileData.twitter) {
          currentData.profiles[socialId].twitter = profileData.twitter;
        }
        if (profileData.discord) {
          currentData.profiles[socialId].discord = profileData.discord;
        }
        if (profileData.comment) {
          currentData.profiles[socialId].comment = profileData.comment;
        }
        
        console.log(`Updated existing profile for wallet: ${walletAddress}`);
      } else {
        // Determine if this wallet should be part of an existing profile
        // based on matching social data
        let matchingSocialId = null;
        
        for (const [existingSocialId, existingProfile] of Object.entries(currentData.profiles)) {
          // Match based on Twitter or Discord handle
          if ((profileData.twitter && existingProfile.twitter === profileData.twitter) ||
              (profileData.discord && existingProfile.discord === profileData.discord)) {
            matchingSocialId = existingSocialId;
            break;
          }
        }
        
        if (matchingSocialId) {
          // Add this wallet to the existing profile
          currentData.byWallet[walletAddress] = { socialId: matchingSocialId };
          console.log(`Added wallet ${walletAddress} to existing profile: ${matchingSocialId}`);
        } else {
          // Create a new profile
          const socialId = `social_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          
          currentData.profiles[socialId] = {
            twitter: profileData.twitter || null,
            discord: profileData.discord || null,
            comment: profileData.comment || null,
            updatedAt: new Date().toISOString()
          };
          
          currentData.byWallet[walletAddress] = { socialId };
          console.log(`Created new profile ${socialId} for wallet: ${walletAddress}`);
        }
      }
    }

    // Save the updated data
    await fs.writeFile(SOCIAL_PROFILES_FILE, JSON.stringify(currentData, null, 2));
    console.log(`Successfully saved updated social profiles to ${SOCIAL_PROFILES_FILE}`);
    
    // Print a summary
    console.log(`\nMigration Summary:`);
    console.log(`Total profiles: ${Object.keys(currentData.profiles).length}`);
    console.log(`Total wallets: ${Object.keys(currentData.byWallet).length}`);
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Run the migration
migrateProfiles().then(() => {
  console.log('Migration completed');
}); 