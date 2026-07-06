-- Weekly trending snapshots: one row per (week, pmid) with the score/rank the
-- ranking pipeline produced. Read by /api/trending?window=week and used to
-- compute NEW / rank-delta badges by comparing to the previous week's snapshot.
CREATE TABLE IF NOT EXISTS weekly_trending_snapshots (
  week_starts_on   DATE      NOT NULL,
  rank             INT       NOT NULL,
  pmid             TEXT      NOT NULL REFERENCES papers(pmid) ON DELETE CASCADE,
  score            NUMERIC   NOT NULL,
  bookmark_count   INT       NOT NULL DEFAULT 0,
  like_count       INT       NOT NULL DEFAULT 0,
  comment_count    INT       NOT NULL DEFAULT 0,
  citation_count   INT       NOT NULL DEFAULT 0,
  impact_factor    NUMERIC,
  epub_date        DATE,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (week_starts_on, pmid)
);

CREATE INDEX IF NOT EXISTS idx_weekly_trending_rank
  ON weekly_trending_snapshots (week_starts_on, rank);

ALTER TABLE weekly_trending_snapshots ENABLE ROW LEVEL SECURITY;

-- Read-only for anyone: snapshot rows are pure aggregates over public data,
-- no user identifiers.
DROP POLICY IF EXISTS "weekly_trending_read" ON weekly_trending_snapshots;
CREATE POLICY "weekly_trending_read"
  ON weekly_trending_snapshots FOR SELECT
  TO anon, authenticated
  USING (true);

-- Writes happen from the Inngest cron via the service role, which bypasses
-- RLS — no INSERT/UPDATE policy needed for regular clients.
