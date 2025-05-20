-- Database Schema for Solana Playground Application

-- Social Profiles Table
CREATE TABLE IF NOT EXISTS social_profiles (
  id VARCHAR(50) PRIMARY KEY,
  twitter VARCHAR(255),
  discord VARCHAR(255),
  comment TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Wallet Addresses Table
CREATE TABLE IF NOT EXISTS wallet_addresses (
  address VARCHAR(100) PRIMARY KEY,
  social_id VARCHAR(50) NOT NULL,
  FOREIGN KEY (social_id) REFERENCES social_profiles(id) ON DELETE CASCADE
);

-- NFT Snapshots Table
CREATE TABLE IF NOT EXISTS nft_snapshots (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  total_count INTEGER NOT NULL
);

-- NFT Holders Table
CREATE TABLE IF NOT EXISTS nft_holders (
  snapshot_id INTEGER NOT NULL,
  address VARCHAR(44) NOT NULL,
  nft_count INTEGER NOT NULL DEFAULT 0,
  gen1_count INTEGER NOT NULL DEFAULT 0,
  infant_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (snapshot_id, address),
  FOREIGN KEY (snapshot_id) REFERENCES nft_snapshots(id) ON DELETE CASCADE
);

-- NFTs Table
CREATE TABLE IF NOT EXISTS nfts (
  mint VARCHAR(44) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('Gen1', 'Infant'))
);

-- NFT Ownership Table
CREATE TABLE IF NOT EXISTS nft_ownership (
  snapshot_id INTEGER NOT NULL,
  mint VARCHAR(44) NOT NULL,
  owner_address VARCHAR(44) NOT NULL,
  PRIMARY KEY (snapshot_id, mint),
  FOREIGN KEY (snapshot_id) REFERENCES nft_snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (mint) REFERENCES nfts(mint) ON DELETE CASCADE
);

-- Token Snapshots Table
CREATE TABLE IF NOT EXISTS token_snapshots (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  token_address VARCHAR(44) NOT NULL,
  total_supply DECIMAL(20, 9) NOT NULL
);

-- Token Holders Table
CREATE TABLE IF NOT EXISTS token_holders (
  snapshot_id INTEGER NOT NULL,
  address VARCHAR(44) NOT NULL,
  balance DECIMAL(20, 9) NOT NULL,
  is_lp_pool BOOLEAN DEFAULT FALSE,
  is_treasury BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (snapshot_id, address),
  FOREIGN KEY (snapshot_id) REFERENCES token_snapshots(id) ON DELETE CASCADE
);

-- Token Distributions Table
CREATE TABLE IF NOT EXISTS token_distributions (
  id SERIAL PRIMARY KEY,
  holder_address VARCHAR(44) NOT NULL,
  amount DECIMAL(20, 9) NOT NULL,
  status VARCHAR(10) NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  transaction_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Event Types Table
CREATE TABLE IF NOT EXISTS event_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT
);

-- Insert default event types
INSERT INTO event_types (name, description) VALUES
('new_holder', 'New wallet holding token/NFT for the first time'),
('transfer_in', 'Existing wallet received more tokens/NFTs'),
('transfer_out', 'Existing wallet sent tokens/NFTs'),
('transfer_between', 'Transfer between two known wallets'),
('wallet_empty', 'Wallet no longer holds any tokens/NFTs')
ON CONFLICT (name) DO NOTHING;

-- Token Events Table
CREATE TABLE IF NOT EXISTS token_events (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  snapshot_id INTEGER NOT NULL,
  event_type_id INTEGER NOT NULL,
  source_address VARCHAR(44),
  destination_address VARCHAR(44),
  amount DECIMAL(20, 9) NOT NULL,
  previous_balance DECIMAL(20, 9),
  new_balance DECIMAL(20, 9),
  social_id VARCHAR(50),
  FOREIGN KEY (snapshot_id) REFERENCES token_snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (event_type_id) REFERENCES event_types(id) ON DELETE CASCADE,
  FOREIGN KEY (social_id) REFERENCES social_profiles(id) ON DELETE SET NULL
);

-- NFT Events Table
CREATE TABLE IF NOT EXISTS nft_events (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  snapshot_id INTEGER NOT NULL,
  event_type_id INTEGER NOT NULL,
  mint VARCHAR(44) NOT NULL,
  source_address VARCHAR(44),
  destination_address VARCHAR(44),
  social_id VARCHAR(50),
  FOREIGN KEY (snapshot_id) REFERENCES nft_snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (event_type_id) REFERENCES event_types(id) ON DELETE CASCADE,
  FOREIGN KEY (mint) REFERENCES nfts(mint) ON DELETE CASCADE,
  FOREIGN KEY (social_id) REFERENCES social_profiles(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_social_id ON wallet_addresses(social_id);
CREATE INDEX IF NOT EXISTS idx_nft_holder_address ON nft_holders(address);
CREATE INDEX IF NOT EXISTS idx_nft_ownership_owner ON nft_ownership(owner_address);
CREATE INDEX IF NOT EXISTS idx_token_holder_address ON token_holders(address);
CREATE INDEX IF NOT EXISTS idx_token_events_snapshot ON token_events(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_token_events_type ON token_events(event_type_id);
CREATE INDEX IF NOT EXISTS idx_token_events_source ON token_events(source_address);
CREATE INDEX IF NOT EXISTS idx_token_events_destination ON token_events(destination_address);
CREATE INDEX IF NOT EXISTS idx_nft_events_snapshot ON nft_events(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_nft_events_type ON nft_events(event_type_id);
CREATE INDEX IF NOT EXISTS idx_nft_events_mint ON nft_events(mint);
CREATE INDEX IF NOT EXISTS idx_nft_events_source ON nft_events(source_address);
CREATE INDEX IF NOT EXISTS idx_nft_events_destination ON nft_events(destination_address); 