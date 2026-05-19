-- Add a partial index for the trending query.
--
-- The trending feed (/trending page + /api/trending) runs:
--   WHERE abstract IS NOT NULL AND abstract <> ''
--     AND epub_date >= <last 180 days>
--     AND citation_count > 0
--   ORDER BY citation_count DESC, epub_date DESC
--   LIMIT 50
--
-- With only the single-column idx_papers_citation_count, Postgres tends to
-- scan that index from the top (oldest, highly-cited papers) and discard
-- every row failing the recent epub_date filter, touching far more pages
-- than the ~hundreds of rows the filter actually matches.
--
-- This partial index is leading-keyed on epub_date so the recent-window
-- filter is a tight range scan, and its predicate keeps only cited papers
-- with abstracts — the exact working set — so the scan stays small even on
-- a cold cache. citation_count is included so the result can be ordered
-- without a separate heap lookup.

CREATE INDEX IF NOT EXISTS idx_papers_trending
  ON papers (epub_date DESC, citation_count DESC)
  WHERE abstract IS NOT NULL AND abstract <> '' AND citation_count > 0;
