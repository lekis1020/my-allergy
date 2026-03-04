CREATE OR REPLACE FUNCTION search_papers(
  search_query TEXT DEFAULT NULL,
  journal_slugs TEXT[] DEFAULT NULL,
  date_from DATE DEFAULT NULL,
  date_to DATE DEFAULT NULL,
  sort_by TEXT DEFAULT 'date_desc',
  page_num INTEGER DEFAULT 1,
  page_size INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  pmid TEXT,
  doi TEXT,
  title TEXT,
  abstract TEXT,
  publication_date DATE,
  volume TEXT,
  issue TEXT,
  pages TEXT,
  keywords TEXT[],
  mesh_terms TEXT[],
  citation_count INTEGER,
  journal_id UUID,
  journal_name TEXT,
  journal_abbreviation TEXT,
  journal_color TEXT,
  journal_slug TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  offset_val INTEGER;
  total BIGINT;
BEGIN
  offset_val := (page_num - 1) * page_size;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      p.id, p.pmid, p.doi, p.title, p.abstract, p.publication_date,
      p.volume, p.issue, p.pages, p.keywords, p.mesh_terms, p.citation_count,
      p.journal_id,
      j.name AS journal_name,
      j.abbreviation AS journal_abbreviation,
      j.color AS journal_color,
      j.slug AS journal_slug
    FROM papers p
    INNER JOIN journals j ON p.journal_id = j.id
    WHERE
      (search_query IS NULL OR to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(p.abstract, '')) @@ plainto_tsquery('english', search_query))
      AND (journal_slugs IS NULL OR j.slug = ANY(journal_slugs))
      AND (date_from IS NULL OR p.publication_date >= date_from)
      AND (date_to IS NULL OR p.publication_date <= date_to)
  ),
  counted AS (
    SELECT count(*) AS cnt FROM filtered
  )
  SELECT
    f.id, f.pmid, f.doi, f.title, f.abstract, f.publication_date,
    f.volume, f.issue, f.pages, f.keywords, f.mesh_terms, f.citation_count,
    f.journal_id, f.journal_name, f.journal_abbreviation, f.journal_color, f.journal_slug,
    c.cnt AS total_count
  FROM filtered f, counted c
  ORDER BY
    CASE WHEN sort_by = 'date_desc' THEN f.publication_date END DESC,
    CASE WHEN sort_by = 'date_asc' THEN f.publication_date END ASC,
    CASE WHEN sort_by = 'citations' THEN COALESCE(f.citation_count, 0) END DESC
  LIMIT page_size
  OFFSET offset_val;
END;
$$;
