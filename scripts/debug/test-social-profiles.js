// Test script for social profiles
import { loadSocialProfiles } from './dist/backend/services/socialProfiles.js';
import { getHolders } from './dist/backend/services/nftCollections.js';
import { getFilteredTokenHolders } from './dist/backend/services/tokenService.js';

async function testSocialProfiles() {
  console.log('Testing social profiles functionality...');
  
  try {
    // 1. Load social profiles
    console.log('Loading social profiles...');
    const socialProfiles = await loadSocialProfiles();
    console.log('Social profiles loaded:', Object.keys(socialProfiles).length);
    
    // Print a sample of the social profiles
    const sampleKeys = Object.keys(socialProfiles).slice(0, 3);
    for (const key of sampleKeys) {
      console.log(`Sample profile for ${key}:`, socialProfiles[key]);
    }
    
    // 2. Test NFT holders with social profiles
    console.log('\nLoading NFT holders...');
    const nftHolders = await getHolders();
    console.log('NFT holders loaded:', nftHolders.length);
    
    // Check which NFT holders have social profiles
    const nftHoldersWithSocial = nftHolders.filter(h => h.twitter || h.discord || h.comment);
    console.log('NFT holders with social profiles:', nftHoldersWithSocial.length);
    
    if (nftHoldersWithSocial.length > 0) {
      console.log('Sample NFT holder with social:', nftHoldersWithSocial[0]);
    }
    
    // 3. Test token holders with social profiles
    console.log('\nLoading token holders...');
    const tokenHolders = await getFilteredTokenHolders();
    console.log('Token holders loaded:', tokenHolders.length);
    
    // Check which token holders have social profiles
    const tokenHoldersWithSocial = tokenHolders.filter(h => h.twitter || h.discord || h.comment);
    console.log('Token holders with social profiles:', tokenHoldersWithSocial.length);
    
    if (tokenHoldersWithSocial.length > 0) {
      console.log('Sample token holder with social:', tokenHoldersWithSocial[0]);
    }
    
  } catch (error) {
    console.error('Error in test script:', error);
  }
}

// Run the test
testSocialProfiles().then(() => {
  console.log('Test complete!');
}); 