-- Migration: Lost wallets + Token Info
-- Created: 2026-10-03

-- 1. Table for lost wallets (source of truth)
CREATE TABLE IF NOT EXISTS lost_wallets (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(100) UNIQUE NOT NULL,
  social_id VARCHAR(50) REFERENCES social_profiles(id) ON DELETE SET NULL,
  reason TEXT,
  lost_amount DECIMAL(20,9),
  lost_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  recovered_at TIMESTAMP WITH TIME ZONE,
  is_lost BOOLEAN DEFAULT TRUE
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_lost_wallets_address ON lost_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_lost_wallets_social_id ON lost_wallets(social_id);

-- 2. Add is_lost flag to token_holders
ALTER TABLE token_holders ADD COLUMN IF NOT EXISTS is_lost BOOLEAN DEFAULT FALSE;

-- 3. Add is_lost flag to staking_wallet_data
ALTER TABLE staking_wallet_data ADD COLUMN IF NOT EXISTS is_lost BOOLEAN DEFAULT FALSE;

-- 4. Add is_lost flag to staking_stakes
ALTER TABLE staking_stakes ADD COLUMN IF NOT EXISTS is_lost BOOLEAN DEFAULT FALSE;

-- 5. Mark existing lost wallet DDcUVKuSRpAq2nb2xVLShkZb3jWCCs2JtHhxbUEzXToU
INSERT INTO lost_wallets (wallet_address, reason, lost_amount, is_lost)
VALUES ('DDcUVKuSRpAq2nb2xVLShkZb3jWCCs2JtHhxbUEzXToU', 'Wallet breached - admin frozen tokens', NULL, TRUE)
ON CONFLICT (wallet_address) DO NOTHING;

-- 6. Update existing snapshots to mark this wallet as lost
UPDATE token_holders SET is_lost = TRUE 
WHERE address = 'DDcUVKuSRpAq2nb2xVLShkZb3jWCCs2JtHhxbUEzXToU';

UPDATE staking_wallet_data SET is_lost = TRUE 
WHERE wallet_address = 'DDcUVKuSRpAq2nb2xVLShkZb3jWCCs2JtHhxbUEzXToU';

UPDATE staking_stakes SET is_lost = TRUE 
WHERE wallet_address = 'DDcUVKuSRpAq2nb2xVLShkZb3jWCCs2JtHhxbUEzXToU';
