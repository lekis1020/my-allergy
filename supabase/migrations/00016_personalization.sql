-- Personalization Phase 1: explicit feedback (interested / not_interested)
-- Used together with journal subscriptions, bookmarks and keyword alerts to
-- compute a personalized feed score for logged-in users.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'paper_feedback_kind') THEN
    CREATE TYPE paper_feedback_kind AS ENUM ('interested', 'not_interested');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS paper_feedback (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_pmid TEXT NOT NULL,
  feedback paper_feedback_kind NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, paper_pmid)
);

-- Enable RLS — users only see/manage their own feedback
ALTER TABLE paper_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own paper_feedback" ON paper_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own paper_feedback" ON paper_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own paper_feedback" ON paper_feedback
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own paper_feedback" ON paper_feedback
  FOR DELETE USING (auth.uid() = user_id);

-- Lookup by (user, feedback) accelerates affinity aggregation
CREATE INDEX IF NOT EXISTS idx_paper_feedback_user_feedback
  ON paper_feedback (user_id, feedback);

-- updated_at auto-refresh trigger
CREATE OR REPLACE FUNCTION set_paper_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_paper_feedback_updated_at ON paper_feedback;
CREATE TRIGGER trg_paper_feedback_updated_at
  BEFORE UPDATE ON paper_feedback
  FOR EACH ROW
  EXECUTE FUNCTION set_paper_feedback_updated_at();
