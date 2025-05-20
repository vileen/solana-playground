-- Drop the foreign key constraints first
ALTER TABLE token_events 
DROP CONSTRAINT IF EXISTS fk_token_events_social_profile;

ALTER TABLE nft_events 
DROP CONSTRAINT IF EXISTS fk_nft_events_social_profile;

-- Drop the indexes on the columns
DROP INDEX IF EXISTS idx_token_events_social_id;
DROP INDEX IF EXISTS idx_nft_events_social_id;

-- Remove the social_id column from token_events table
ALTER TABLE token_events 
DROP COLUMN IF EXISTS social_id;

-- Remove the social_id column from nft_events table
ALTER TABLE nft_events 
DROP COLUMN IF EXISTS social_id;

-- Add a comment about the migration
COMMENT ON TABLE token_events IS 'Token transfer events are now linked to social profiles via wallet addresses instead of directly storing social_id';
COMMENT ON TABLE nft_events IS 'NFT transfer events are now linked to social profiles via wallet addresses instead of directly storing social_id'; 