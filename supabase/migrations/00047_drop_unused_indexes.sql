-- Drop indexes confirmed UNUSED in production.
--
-- `supabase inspect db index-stats` (2026-06-23, 110 days since stats reset)
-- reported 0 index scans for each of these while the sync path rewrites
-- papers/paper_authors heavily. Every index — used or not — is maintained on
-- every INSERT/UPDATE/DELETE, so an unused index is pure write amplification:
-- extra WAL and Disk IO on the hottest write path for zero read benefit.
--
-- Safe and reversible: re-add any of these with a plain CREATE INDEX if a
-- future query needs it.
--
--   idx_paper_authors_last_name  (00003) — author last-name lookups never hit it
--   idx_papers_doi               (00002) — partial doi index, unused by enricher
--   idx_papers_epub_date         (00021) — feed ordering uses idx_papers_feed
--   idx_papers_topic_tags        (00045) — GIN on topic_tags, never scanned

DROP INDEX IF EXISTS idx_paper_authors_last_name;
DROP INDEX IF EXISTS idx_papers_doi;
DROP INDEX IF EXISTS idx_papers_epub_date;
DROP INDEX IF EXISTS idx_papers_topic_tags;
