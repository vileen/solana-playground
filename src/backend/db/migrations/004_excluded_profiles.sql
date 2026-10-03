-- Excluded Profiles Table
-- Profiles excluded from token supply calculation
CREATE TABLE IF NOT EXISTS excluded_profiles (
  social_id VARCHAR(50) PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (social_id) REFERENCES social_profiles(id) ON DELETE CASCADE
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_excluded_profiles_social_id ON excluded_profiles(social_id);
