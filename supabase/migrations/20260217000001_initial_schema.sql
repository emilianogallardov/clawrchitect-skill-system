-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Skills table with vector embeddings
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  full_instructions TEXT,
  tools_used TEXT[] DEFAULT '{}',
  triggers TEXT[] DEFAULT '{}',
  source_url TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL CHECK (source_type IN ('clawhub', 'github', 'manual')),
  author TEXT,
  embedding VECTOR(1536),
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_crawled_at TIMESTAMPTZ DEFAULT NOW(),
  mention_count INTEGER DEFAULT 0,
  is_new BOOLEAN DEFAULT TRUE,
  raw_skill_md TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_skills_first_seen ON skills (first_seen_at DESC);
CREATE INDEX idx_skills_mentions ON skills (mention_count DESC);
CREATE INDEX idx_skills_source_url ON skills (source_url);

-- AIDB content table for podcast episodes, training, newsletters
CREATE TABLE aidb_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('podcast', 'training', 'newsletter')),
  description TEXT,
  url TEXT NOT NULL UNIQUE,
  embedding VECTOR(1536),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crawl logs for monitoring
CREATE TABLE crawl_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  skills_found INTEGER DEFAULT 0,
  skills_new INTEGER DEFAULT 0,
  skills_updated INTEGER DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'running')),
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Vector similarity search function for skills
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
    1 - (s.embedding <=> query_embedding) AS similarity
  FROM skills s
  WHERE 1 - (s.embedding <=> query_embedding) > match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Vector similarity search function for AIDB content
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
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM aidb_content c
  WHERE c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
