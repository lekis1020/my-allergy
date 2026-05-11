-- Conference date proposals: weekly LLM-extracted candidate dates awaiting admin review.

CREATE TABLE IF NOT EXISTS conference_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  current_start_date DATE,
  current_end_date DATE,
  proposed_start_date DATE,
  proposed_end_date DATE,
  source_url TEXT,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'superseded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS conference_proposals_conference_id_idx
  ON conference_proposals (conference_id);
CREATE INDEX IF NOT EXISTS conference_proposals_status_idx
  ON conference_proposals (status, created_at DESC);

-- Only one pending proposal per conference at a time.
CREATE UNIQUE INDEX IF NOT EXISTS conference_proposals_one_pending_per_conference
  ON conference_proposals (conference_id)
  WHERE status = 'pending';

ALTER TABLE conference_proposals ENABLE ROW LEVEL SECURITY;

-- No anon access; service role (used by cron + admin API routes) bypasses RLS.
-- Explicit deny-by-default — no policies means no anon/authenticated read or write.
