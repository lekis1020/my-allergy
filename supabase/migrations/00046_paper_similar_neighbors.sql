-- Top-K embedding neighbours of ONE paper, for the paper-detail relationship graph.
CREATE OR REPLACE FUNCTION paper_similar_neighbors(p_pmid TEXT, p_k INT, p_threshold FLOAT)
RETURNS TABLE (pmid TEXT, similarity FLOAT)
LANGUAGE sql STABLE AS $$
  WITH src AS (SELECT embedding FROM papers WHERE pmid = p_pmid AND embedding IS NOT NULL)
  SELECT t.pmid, 1 - (t.embedding <=> src.embedding) AS similarity
  FROM papers t, src
  WHERE t.pmid <> p_pmid AND t.embedding IS NOT NULL
    AND 1 - (t.embedding <=> src.embedding) >= p_threshold
  ORDER BY t.embedding <=> src.embedding
  LIMIT p_k;
$$;
REVOKE ALL ON FUNCTION paper_similar_neighbors(TEXT, INT, FLOAT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION paper_similar_neighbors(TEXT, INT, FLOAT) TO anon, authenticated, service_role;
