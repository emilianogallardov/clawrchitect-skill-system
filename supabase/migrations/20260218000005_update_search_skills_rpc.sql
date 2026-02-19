-- Drop old function to change return type
DROP FUNCTION IF EXISTS search_skills(VECTOR(1536), FLOAT, INT);

-- Recreate search_skills with category and upvote_count in RETURNS TABLE
CREATE OR REPLACE FUNCTION search_skills(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  full_instructions TEXT,
  tools_used TEXT[],
  triggers TEXT[],
  source_url TEXT,
  source_type TEXT,
  author TEXT,
  first_seen_at TIMESTAMPTZ,
  last_crawled_at TIMESTAMPTZ,
  mention_count INTEGER,
  is_new BOOLEAN,
  raw_skill_md TEXT,
  category TEXT,
  upvote_count INTEGER,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.description,
    s.full_instructions,
    s.tools_used,
    s.triggers,
    s.source_url,
    s.source_type,
    s.author,
    s.first_seen_at,
    s.last_crawled_at,
    s.mention_count,
    s.is_new,
    s.raw_skill_md,
    s.category,
    s.upvote_count,
    1 - (s.embedding <=> query_embedding) AS similarity
  FROM skills s
  WHERE 1 - (s.embedding <=> query_embedding) > match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Ensure source_type constraint allows all needed values
ALTER TABLE skills DROP CONSTRAINT IF EXISTS skills_source_type_check;
ALTER TABLE skills
  ADD CONSTRAINT skills_source_type_check
    CHECK (source_type IN ('clawhub', 'github', 'manual', 'campclaw', 'x_twitter', 'rss'));
