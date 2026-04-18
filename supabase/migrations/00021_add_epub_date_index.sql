-- Performance fix: add indexes for epub_date ordering and abstract filtering.
-- With 15K+ papers the default feed query (ORDER BY epub_date DESC, WHERE
-- abstract IS NOT NULL) was hitting Supabase statement_timeout.

CREATE INDEX IF NOT EXISTS idx_papers_epub_date
  ON papers (epub_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_papers_feed
  ON papers (epub_date DESC NULLS LAST)
  WHERE abstract IS NOT NULL AND abstract != '';
