import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { SOCIAL_PROFILES_FILE } from '../config/config.js';

// Function to load social profiles
export async function loadSocialProfiles(): Promise<Record<string, any>> {
  try {
    if (existsSync(SOCIAL_PROFILES_FILE)) {
      const content = await readFile(SOCIAL_PROFILES_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Error loading social profiles:', error);
  }
  return {};
}

// Function to save social profiles
export async function saveSocialProfilesFile(profiles: Record<string, any>): Promise<void> {
  try {
    await writeFile(SOCIAL_PROFILES_FILE, JSON.stringify(profiles, null, 2));
    console.log('Social profiles saved');
  } catch (error) {
    console.error('Error saving social profiles:', error);
  }
}

// Function to update a single social profile
export async function saveSocialProfile(walletAddress: string, socialData: { twitter?: string; discord?: string; comment?: string }): Promise<boolean> {
  try {
    // Load existing profiles
    const profiles = await loadSocialProfiles();
    
    // Update the profile for this wallet address
    profiles[walletAddress] = {
      ...profiles[walletAddress], // Keep existing data
      ...socialData, // Add/update new data
      updatedAt: new Date().toISOString() // Add timestamp
    };
    
    // Save the updated profiles
    await saveSocialProfilesFile(profiles);
    return true;
  } catch (error) {
    console.error('Error saving social profile:', error);
    return false;
  }
} 