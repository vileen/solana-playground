-- Create staking snapshots table
CREATE TABLE IF NOT EXISTS staking_snapshots (
  id SERIAL PRIMARY KEY,
  contract_address TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  total_staked DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_locked DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_unlocked DOUBLE PRECISION NOT NULL DEFAULT 0
);

-- Create staking wallet data table
CREATE TABLE IF NOT EXISTS staking_wallet_data (
  id SERIAL PRIMARY KEY,
  snapshot_id INTEGER NOT NULL,
  wallet_address TEXT NOT NULL,
  total_staked DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_locked DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_unlocked DOUBLE PRECISION NOT NULL DEFAULT 0,
  CONSTRAINT fk_staking_snapshot FOREIGN KEY (snapshot_id) REFERENCES staking_snapshots(id) ON DELETE CASCADE
);

-- Create index on wallet_address for faster searches
CREATE INDEX IF NOT EXISTS idx_staking_wallet_address ON staking_wallet_data(wallet_address);
CREATE INDEX IF NOT EXISTS idx_staking_snapshot_id ON staking_wallet_data(snapshot_id);

-- Create staking stakes table (individual stake entries)
CREATE TABLE IF NOT EXISTS staking_stakes (
  id SERIAL PRIMARY KEY,
  snapshot_id INTEGER NOT NULL,
  wallet_address TEXT NOT NULL,
  mint_address TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  stake_date TIMESTAMP NOT NULL,
  unlock_date TIMESTAMP NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_staking_stakes_snapshot FOREIGN KEY (snapshot_id) REFERENCES staking_snapshots(id) ON DELETE CASCADE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_staking_stakes_wallet ON staking_stakes(wallet_address);
CREATE INDEX IF NOT EXISTS idx_staking_stakes_snapshot ON staking_stakes(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_staking_stakes_unlock_date ON staking_stakes(unlock_date);
CREATE INDEX IF NOT EXISTS idx_staking_stakes_is_locked ON staking_stakes(is_locked); 