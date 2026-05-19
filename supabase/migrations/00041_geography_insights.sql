-- Precomputed snapshot for the First Author Geography insight.
--
-- /api/insights/author-geography aggregates first-author affiliations across
-- 180 days of papers. Doing that join + JS aggregation per request is slow and
-- risks the statement timeout. A daily Inngest job computes the result once and
-- stores it here; the API route then just reads this row (instant).
--
-- Written by the background job with the service role, so only a read policy
-- is needed — same pattern as trending_analysis.

CREATE TABLE IF NOT EXISTS geography_insights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  days int NOT NULL UNIQUE,
  computed_at timestamptz NOT NULL DEFAULT now(),
  from_date date NOT NULL,
  total_first_authors int NOT NULL DEFAULT 0,
  locations jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE geography_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read geography insights"
  ON geography_insights FOR SELECT
  USING (true);
