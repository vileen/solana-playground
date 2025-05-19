import express, { Router, Request, Response } from 'express';
import { getHolders, createHolderSnapshot, loadHolderSnapshot } from '../services/nftCollections.js';
import { getFilteredTokenHolders, createTokenSnapshot, loadTokenSnapshot } from '../services/tokenService.js';
import { saveSocialProfile, loadSocialProfiles } from '../services/socialProfiles.js';

const router = Router();

// Get NFT holders with optional search filter
router.get('/holders', async (req: Request, res: Response) => {
  try {
    const searchTerm = req.query.search as string | undefined;
    const holders = await getHolders(searchTerm);
    res.json(holders);
  } catch (error: any) {
    console.error('Error in /holders endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get token holders with optional search filter
router.get('/token-holders', async (req: Request, res: Response) => {
  try {
    const searchTerm = req.query.search as string | undefined;
    const holders = await getFilteredTokenHolders(searchTerm);
    res.json(holders);
  } catch (error: any) {
    console.error('Error in /token-holders endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Take a new NFT snapshot
router.get('/snapshot', async (req: Request, res: Response) => {
  try {
    console.log('Taking new NFT snapshot...');
    const snapshot = await createHolderSnapshot();
    res.json(snapshot);
  } catch (error: any) {
    console.error('Error in /snapshot endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Take a new token snapshot
router.get('/token-snapshot', async (req: Request, res: Response) => {
  try {
    console.log('Taking new token snapshot...');
    const snapshot = await createTokenSnapshot();
    res.json(snapshot);
  } catch (error: any) {
    console.error('Error in /token-snapshot endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Save social profile (single wallet)
router.post('/social-profile', (req: Request, res: Response) => {
  (async () => {
    try {
      const { walletAddress, twitter, discord, comment } = req.body;
      
      if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }
      
      const success = await saveSocialProfile(walletAddress, { twitter, discord, comment });
      
      if (success) {
        res.json({ success: true, message: 'Social profile saved' });
      } else {
        res.status(500).json({ error: 'Failed to save social profile' });
      }
    } catch (error: any) {
      console.error('Error in /social-profile endpoint:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  })();
});

// Updated endpoint to handle new profile format (multiple wallets)
router.post('/social-profiles', (req: Request, res: Response) => {
  (async () => {
    try {
      const profileData = req.body;
      
      if (!profileData.wallets || !profileData.wallets.length) {
        return res.status(400).json({ error: 'At least one wallet address is required' });
      }
      
      const success = await saveSocialProfile(profileData);
      
      if (success) {
        res.json({ success: true, message: 'Social profile saved' });
      } else {
        res.status(500).json({ error: 'Failed to save social profile' });
      }
    } catch (error: any) {
      console.error('Error in /social-profiles endpoint:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  })();
});

// Get all social profiles
router.get('/social-profiles', async (req: Request, res: Response) => {
  try {
    const profiles = await loadSocialProfiles();
    
    // Convert to array format for easier consumption
    const profileArray = Object.entries(profiles).map(([address, data]) => ({
      address,
      ...data
    }));
    
    res.json(profileArray);
  } catch (error: any) {
    console.error('Error in /social-profiles endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Data summary endpoint
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const nftSnapshot = await loadHolderSnapshot();
    const tokenSnapshot = await loadTokenSnapshot();
    
    res.json({
      nft: {
        totalNFTs: nftSnapshot?.total || 0,
        totalHolders: nftSnapshot?.holders.length || 0,
        lastUpdated: nftSnapshot?.timestamp || null
      },
      token: {
        totalSupply: tokenSnapshot?.totalSupply || 0,
        totalHolders: tokenSnapshot?.holders.length || 0,
        lastUpdated: tokenSnapshot?.timestamp || null
      }
    });
  } catch (error: any) {
    console.error('Error in /summary endpoint:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router; 