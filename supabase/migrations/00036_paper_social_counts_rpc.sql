-- Aggregate per-paper social counts in a single round-trip.
--
-- The feed API (/api/papers) previously issued 5 separate queries
-- (paper_likes, bookmarks, paper_comments, paper_citations, paper_mentions),
-- fetched every matching row, and counted them in JavaScript. That transfers
-- thousands of rows for popular papers and scales linearly with social data.
--
-- This function does the counting in Postgres and returns one row per input
-- pmid with only the aggregate numbers. SECURITY DEFINER lets it read tables
-- whose RLS would otherwise zero the counts; it exposes counts only, never
-- row data.

CREATE OR REPLACE FUNCTION get_paper_social_counts(p_pmids text[])
RETURNS TABLE (
  pmid text,
  like_count bigint,
  bookmark_count bigint,
  comment_count bigint,
  connection_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH input AS (
    SELECT DISTINCT unnest(p_pmids) AS pmid
  ),
  likes AS (
    SELECT paper_pmid AS pmid, count(*) AS c
    FROM paper_likes
    WHERE paper_pmid = ANY(p_pmids)
    GROUP BY paper_pmid
  ),
  bms AS (
    SELECT pmid, count(*) AS c
    FROM bookmarks
    WHERE pmid = ANY(p_pmids)
    GROUP BY pmid
  ),
  cmts AS (
    SELECT paper_pmid AS pmid, count(*) AS c
    FROM paper_comments
    WHERE paper_pmid = ANY(p_pmids) AND deleted_at IS NULL
    GROUP BY paper_pmid
  ),
  -- connection_count = distinct papers linked to each pmid via a citation or
  -- a mention, in either direction. Matches the previous in-JS Set logic.
  conn AS (
    SELECT pmid, count(DISTINCT other) AS c
    FROM (
      SELECT source_pmid AS pmid, target_pmid AS other
        FROM paper_citations WHERE source_pmid = ANY(p_pmids)
      UNION ALL
      SELECT target_pmid AS pmid, source_pmid AS other
        FROM paper_citations WHERE target_pmid = ANY(p_pmids)
      UNION ALL
      SELECT source_pmid AS pmid, mentioned_pmid AS other
        FROM paper_mentions WHERE source_pmid = ANY(p_pmids)
      UNION ALL
      SELECT mentioned_pmid AS pmid, source_pmid AS other
        FROM paper_mentions WHERE mentioned_pmid = ANY(p_pmids)
    ) edges
    GROUP BY pmid
  )
  SELECT
    i.pmid,
    COALESCE(likes.c, 0) AS like_count,
    COALESCE(bms.c, 0)   AS bookmark_count,
    COALESCE(cmts.c, 0)  AS comment_count,
    COALESCE(conn.c, 0)  AS connection_count
  FROM input i
  LEFT JOIN likes ON likes.pmid = i.pmid
  LEFT JOIN bms   ON bms.pmid   = i.pmid
  LEFT JOIN cmts  ON cmts.pmid  = i.pmid
  LEFT JOIN conn  ON conn.pmid  = i.pmid;
$$;

GRANT EXECUTE ON FUNCTION get_paper_social_counts(text[]) TO anon, authenticated, service_role;
