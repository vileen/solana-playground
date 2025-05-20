-- Add social_id column to token_events table
ALTER TABLE token_events ADD COLUMN social_id VARCHAR(50);

-- Add social_id column to nft_events table
ALTER TABLE nft_events ADD COLUMN social_id VARCHAR(50);

-- Add foreign key constraints
ALTER TABLE token_events 
ADD CONSTRAINT fk_token_events_social_profile 
FOREIGN KEY (social_id) REFERENCES social_profiles(id) ON DELETE SET NULL;

ALTER TABLE nft_events 
ADD CONSTRAINT fk_nft_events_social_profile 
FOREIGN KEY (social_id) REFERENCES social_profiles(id) ON DELETE SET NULL;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_token_events_social_id ON token_events(social_id);
CREATE INDEX IF NOT EXISTS idx_nft_events_social_id ON nft_events(social_id); 