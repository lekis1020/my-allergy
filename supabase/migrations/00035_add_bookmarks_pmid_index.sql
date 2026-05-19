-- Add a standalone index on bookmarks.pmid
--
-- The feed API (/api/papers) aggregates per-paper bookmark counts with:
--   SELECT pmid FROM bookmarks WHERE pmid IN (...)
-- The existing indexes only cover user_id (idx_bookmarks_user_id) and the
-- composite (user_id, pmid) (idx_bookmarks_user_pmid). A query filtering by
-- pmid alone cannot use the composite index because pmid is not its leading
-- column, so it falls back to a sequential scan of the whole table.
--
-- This index lets the count aggregation use an index scan instead.

CREATE INDEX IF NOT EXISTS idx_bookmarks_pmid ON bookmarks(pmid);
