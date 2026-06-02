-- RPC that returns per-paper top-K nearest neighbours by embedding cosine
-- similarity, filtered by a minimum similarity threshold.
--
-- Returns deduplicated pairs (source_pmid < target_pmid) so the caller can
-- treat the result as an undirected edge list directly.
--
-- Cost: roughly O(N × K) reads thanks to the ivfflat index. With 1k–10k
-- papers and K=10 this is well under a second.

CREATE OR REPLACE FUNCTION paper_similarity_edges_topk(
  p_k INT,
  p_threshold FLOAT
)
RETURNS TABLE (
  source_pmid TEXT,
  target_pmid TEXT,
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  WITH neighbours AS (
    SELECT
      s.pmid AS s_pmid,
      t.pmid AS t_pmid,
      1 - (s.embedding <=> t.embedding) AS sim
    FROM papers s
    CROSS JOIN LATERAL (
      SELECT pmid, embedding
      FROM papers p
      WHERE p.pmid <> s.pmid
        AND p.embedding IS NOT NULL
      ORDER BY p.embedding <=> s.embedding
      LIMIT p_k
    ) t
    WHERE s.embedding IS NOT NULL
  )
  SELECT
    LEAST(s_pmid, t_pmid) AS source_pmid,
    GREATEST(s_pmid, t_pmid) AS target_pmid,
    MAX(sim) AS similarity
  FROM neighbours
  WHERE sim >= p_threshold
  GROUP BY LEAST(s_pmid, t_pmid), GREATEST(s_pmid, t_pmid);
$$;

-- Allow the anon and authenticated roles to read; the service role can
-- already invoke any function. We keep it tight even though the data is
-- not sensitive.
REVOKE ALL ON FUNCTION paper_similarity_edges_topk(INT, FLOAT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION paper_similarity_edges_topk(INT, FLOAT) TO anon, authenticated, service_role;
