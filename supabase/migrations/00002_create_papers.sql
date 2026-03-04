CREATE TABLE IF NOT EXISTS papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  pmid TEXT NOT NULL UNIQUE,
  doi TEXT,
  title TEXT NOT NULL,
  abstract TEXT,
  publication_date DATE NOT NULL,
  epub_date DATE,
  volume TEXT,
  issue TEXT,
  pages TEXT,
  keywords TEXT[] DEFAULT '{}',
  mesh_terms TEXT[] DEFAULT '{}',
  citation_count INTEGER,
  crossref_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_papers_journal_id ON papers(journal_id);
CREATE INDEX idx_papers_pmid ON papers(pmid);
CREATE INDEX idx_papers_doi ON papers(doi) WHERE doi IS NOT NULL;
CREATE INDEX idx_papers_publication_date ON papers(publication_date DESC);
CREATE INDEX idx_papers_citation_count ON papers(citation_count DESC NULLS LAST);

-- Full-text search index
CREATE INDEX idx_papers_search ON papers
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(abstract, '')));

-- RLS
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Papers are viewable by everyone"
  ON papers FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage papers"
  ON papers FOR ALL
  USING (auth.role() = 'service_role');
