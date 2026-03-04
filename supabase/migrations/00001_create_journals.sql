CREATE TABLE IF NOT EXISTS journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL UNIQUE,
  issn TEXT NOT NULL UNIQUE,
  e_issn TEXT,
  impact_factor NUMERIC(5,2),
  color TEXT NOT NULL DEFAULT '#6B7280',
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_journals_slug ON journals(slug);

-- RLS
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Journals are viewable by everyone"
  ON journals FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage journals"
  ON journals FOR ALL
  USING (auth.role() = 'service_role');
