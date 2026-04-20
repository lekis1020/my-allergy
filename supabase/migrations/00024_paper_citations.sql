-- Citation relationships between papers in our database.
-- source_pmid cites target_pmid (source → target).

CREATE TABLE IF NOT EXISTS paper_citations (
  source_pmid TEXT NOT NULL,
  target_pmid TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_pmid, target_pmid)
);

-- Find all papers that a given paper cites (outgoing)
CREATE INDEX IF NOT EXISTS idx_paper_citations_source
  ON paper_citations (source_pmid);

-- Find all papers that cite a given paper (incoming)
CREATE INDEX IF NOT EXISTS idx_paper_citations_target
  ON paper_citations (target_pmid);
