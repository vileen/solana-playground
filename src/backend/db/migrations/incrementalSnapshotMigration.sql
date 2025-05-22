-- Add last_signature column to staking_snapshots table
ALTER TABLE staking_snapshots ADD COLUMN IF NOT EXISTS last_signature TEXT;
ALTER TABLE staking_snapshots ADD COLUMN IF NOT EXISTS is_incremental BOOLEAN DEFAULT FALSE;

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_staking_snapshots_last_signature ON staking_snapshots(last_signature); 