-- Add category field to skills table matching CampClaw resource categories
ALTER TABLE skills
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'uncategorized'
    CHECK (category IN (
      'getting_started', 'building_agents', 'multi_agent', 'security',
      'real_builds', 'aidb_episodes', 'community_submitted', 'uncategorized'
    )),
  ADD COLUMN IF NOT EXISTS upvote_count INTEGER DEFAULT 0,
  DROP CONSTRAINT IF EXISTS skills_source_type_check;

-- Expand source_type to include new sources
ALTER TABLE skills
  ADD CONSTRAINT skills_source_type_check
    CHECK (source_type IN ('clawhub', 'github', 'manual', 'campclaw', 'x_twitter', 'rss'));

-- Expand aidb_content types
ALTER TABLE aidb_content
  DROP CONSTRAINT IF EXISTS aidb_content_content_type_check;

ALTER TABLE aidb_content
  ADD CONSTRAINT aidb_content_content_type_check
    CHECK (content_type IN ('podcast', 'training', 'newsletter', 'intel', 'program'));

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills (category);
CREATE INDEX IF NOT EXISTS idx_skills_upvotes ON skills (upvote_count DESC);
