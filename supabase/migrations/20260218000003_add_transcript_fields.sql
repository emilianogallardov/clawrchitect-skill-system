-- Add transcript and YouTube video ID to aidb_content
ALTER TABLE aidb_content ADD COLUMN IF NOT EXISTS transcript TEXT;
ALTER TABLE aidb_content ADD COLUMN IF NOT EXISTS youtube_video_id TEXT;

CREATE INDEX IF NOT EXISTS idx_aidb_content_youtube_video_id ON aidb_content (youtube_video_id);

-- Update content_type check to include all types
ALTER TABLE aidb_content DROP CONSTRAINT IF EXISTS aidb_content_content_type_check;
ALTER TABLE aidb_content ADD CONSTRAINT aidb_content_content_type_check
  CHECK (content_type IN ('podcast', 'training', 'newsletter', 'intel', 'program'));

-- Update match_aidb_content to return transcript and youtube_video_id
DROP FUNCTION IF EXISTS match_aidb_content(VECTOR(1536), INT);

CREATE OR REPLACE FUNCTION match_aidb_content(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content_type TEXT,
  description TEXT,
  url TEXT,
  published_at TIMESTAMPTZ,
  transcript TEXT,
  youtube_video_id TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.content_type,
    c.description,
    c.url,
    c.published_at,
    c.transcript,
    c.youtube_video_id,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM aidb_content c
  WHERE c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
