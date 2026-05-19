-- Agora feed aggregation pushed into Postgres.
--
-- fetchInitialAgora() and /api/agora previously pulled up to 2000 of the most
-- recent paper_comments rows on every request and aggregated counts +
-- latest-comment timestamp per pmid in JavaScript, just to surface ~20
-- discussed papers. That transfers thousands of rows and scales linearly with
-- discussion volume.
--
-- get_agora_papers() does the GROUP BY in Postgres and returns one row per
-- discussed paper for the requested page, plus the total distinct-paper count
-- (window function) so the caller can paginate. SECURITY INVOKER keeps the
-- existing "authenticated users only" RLS on paper_comments in force, so the
-- function exposes nothing an anonymous caller could not already see (nothing).

-- Partial index matching the function's filter + grouping. Supersedes the
-- plain (created_at) sort index the JS-scan approach would have wanted: the
-- new query groups by paper_pmid and filters deleted rows out.
CREATE INDEX IF NOT EXISTS idx_paper_comments_active_paper_created
  ON paper_comments (paper_pmid, created_at)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION get_agora_papers(p_limit int, p_offset int)
RETURNS TABLE (
  paper_pmid text,
  comment_count bigint,
  latest_comment_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      pc.paper_pmid,
      count(*)           AS comment_count,
      max(pc.created_at) AS latest_comment_at
    FROM paper_comments pc
    WHERE pc.deleted_at IS NULL
    GROUP BY pc.paper_pmid
  )
  SELECT
    agg.paper_pmid,
    agg.comment_count,
    agg.latest_comment_at,
    count(*) OVER () AS total_count
  FROM agg
  ORDER BY agg.latest_comment_at DESC
  LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION get_agora_papers(int, int) TO anon, authenticated, service_role;
