-- First-author lookup index for the insights endpoints.
--
-- /api/insights/author-geography and /api/insights/author-leaders join
-- paper_authors to papers and filter to first authors (position = 1). Without
-- an index on position, that join can fall back to a sequential scan of the
-- entire paper_authors table (every author of every paper), which blows past
-- the Postgres statement timeout and 500s the request.
--
-- A partial index over just the first-author rows keeps the
-- papers(publication_date) -> paper_authors nested-loop join on an index path.

CREATE INDEX IF NOT EXISTS idx_paper_authors_first_author
  ON paper_authors (paper_id)
  WHERE position = 1;
