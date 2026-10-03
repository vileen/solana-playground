/**
 * Excluded Profiles Service
 * Manages profiles excluded from token supply calculation
 */

import { query } from '../db/index.js';

/**
 * Get all excluded profile IDs
 */
export async function getExcludedProfiles(): Promise<string[]> {
  try {
    const result = await query(
      'SELECT social_id FROM excluded_profiles ORDER BY created_at DESC'
    );
    return result.rows.map((r: any) => r.social_id);
  } catch (error) {
    console.error('Error getting excluded profiles:', error);
    return [];
  }
}

/**
 * Add a profile to excluded list
 */
export async function excludeProfile(socialId: string): Promise<boolean> {
  try {
    await query(
      `INSERT INTO excluded_profiles (social_id) 
       VALUES ($1) 
       ON CONFLICT (social_id) DO NOTHING`,
      [socialId]
    );
    console.log(`[Excluded Profiles] Added ${socialId}`);
    return true;
  } catch (error) {
    console.error('Error excluding profile:', error);
    return false;
  }
}

/**
 * Remove a profile from excluded list
 */
export async function includeProfile(socialId: string): Promise<boolean> {
  try {
    await query('DELETE FROM excluded_profiles WHERE social_id = $1', [socialId]);
    console.log(`[Excluded Profiles] Removed ${socialId}`);
    return true;
  } catch (error) {
    console.error('Error including profile:', error);
    return false;
  }
}

/**
 * Set the entire excluded profiles list (replaces existing)
 */
export async function setExcludedProfiles(socialIds: string[]): Promise<boolean> {
  try {
    // Clear existing
    await query('DELETE FROM excluded_profiles');
    
    // Insert new
    if (socialIds.length > 0) {
      const values = socialIds.map((_, i) => `($${i + 1})`).join(', ');
      await query(
        `INSERT INTO excluded_profiles (social_id) VALUES ${values}`,
        socialIds
      );
    }
    
    console.log(`[Excluded Profiles] Set ${socialIds.length} excluded profiles`);
    return true;
  } catch (error) {
    console.error('Error setting excluded profiles:', error);
    return false;
  }
}
