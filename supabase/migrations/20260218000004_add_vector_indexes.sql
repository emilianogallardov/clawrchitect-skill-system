-- Add HNSW indexes for faster vector similarity search
CREATE INDEX IF NOT EXISTS idx_skills_embedding ON skills USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_aidb_content_embedding ON aidb_content USING hnsw (embedding vector_cosine_ops);

-- Update match_aidb_content to enforce a minimum similarity threshold
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
    AND 1 - (c.embedding <=> query_embedding) > 0.2
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
