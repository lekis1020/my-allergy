-- pubmed_query_cache: caches PubMed ESearch results for on-demand fetch
-- TTL is tracked per-row; rows older than ttl_seconds are considered stale.

CREATE TABLE IF NOT EXISTS pubmed_query_cache (
  query_hash TEXT PRIMARY KEY,
  pmids TEXT[] NOT NULL DEFAULT '{}',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ttl_seconds INTEGER NOT NULL DEFAULT 1800
);

CREATE INDEX IF NOT EXISTS idx_pubmed_query_cache_fetched_at
  ON pubmed_query_cache (fetched_at);

-- RLS: public read (anon), service-role writes only.
ALTER TABLE pubmed_query_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pubmed_query_cache_public_read" ON pubmed_query_cache;
CREATE POLICY "pubmed_query_cache_public_read"
  ON pubmed_query_cache
  FOR SELECT
  USING (TRUE);

-- No insert/update/delete policies → service role bypasses RLS, anon blocked.

-- Maintenance helper: purge expired rows.
CREATE OR REPLACE FUNCTION cleanup_pubmed_query_cache()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM pubmed_query_cache
  WHERE fetched_at + (ttl_seconds || ' seconds')::INTERVAL < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
