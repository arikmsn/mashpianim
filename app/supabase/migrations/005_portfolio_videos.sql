-- Add portfolio video support: creator_id, title, description
-- Make connection_id nullable for standalone portfolio uploads

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text;

-- Make connection_id nullable (was NOT NULL)
ALTER TABLE videos
  ALTER COLUMN connection_id DROP NOT NULL;

-- Index for fast portfolio lookups
CREATE INDEX IF NOT EXISTS idx_videos_creator_id ON videos(creator_id);
CREATE INDEX IF NOT EXISTS idx_videos_portfolio ON videos(creator_id) WHERE connection_id IS NULL;
