CREATE TABLE IF NOT EXISTS paper_authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  last_name TEXT NOT NULL,
  first_name TEXT,
  initials TEXT,
  affiliation TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_paper_authors_paper_id ON paper_authors(paper_id);
CREATE INDEX idx_paper_authors_last_name ON paper_authors(last_name);

-- RLS
ALTER TABLE paper_authors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Paper authors are viewable by everyone"
  ON paper_authors FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage paper authors"
  ON paper_authors FOR ALL
  USING (auth.role() = 'service_role');
