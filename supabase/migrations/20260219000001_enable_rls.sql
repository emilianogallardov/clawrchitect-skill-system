-- Enable Row Level Security on all public tables
-- This is a read-only public API, so we allow SELECT for anon users
-- and restrict all writes to the service_role (used by API routes)

-- Skills table
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to skills"
  ON public.skills FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow service role full access to skills"
  ON public.skills FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- AIDB Content table
ALTER TABLE public.aidb_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to aidb_content"
  ON public.aidb_content FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow service role full access to aidb_content"
  ON public.aidb_content FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Crawl Logs table
ALTER TABLE public.crawl_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to crawl_logs"
  ON public.crawl_logs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow service role full access to crawl_logs"
  ON public.crawl_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
