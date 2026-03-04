CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
  papers_found INTEGER NOT NULL DEFAULT 0,
  papers_inserted INTEGER NOT NULL DEFAULT 0,
  papers_updated INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_logs_journal_id ON sync_logs(journal_id);
CREATE INDEX idx_sync_logs_started_at ON sync_logs(started_at DESC);

-- RLS
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sync logs are viewable by everyone"
  ON sync_logs FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage sync logs"
  ON sync_logs FOR ALL
  USING (auth.role() = 'service_role');
