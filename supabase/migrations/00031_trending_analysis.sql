CREATE TABLE trending_analysis (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  ai_summary text NOT NULL,
  stats_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE trending_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read trending analysis"
  ON trending_analysis FOR SELECT
  USING (true);
