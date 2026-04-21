-- 00027_create_chat_tables.sql
-- Chat sessions for AI paper Q&A and rate limiting

CREATE TABLE chat_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_pmid TEXT NOT NULL,
  messages   JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, paper_pmid)
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions (user_id, updated_at DESC);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own chat sessions"
  ON chat_sessions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users update own chat sessions"
  ON chat_sessions FOR UPDATE USING (auth.uid() = user_id);

-- No INSERT/DELETE policy: service role only

CREATE TABLE chat_usage (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_pmid TEXT NOT NULL,
  used_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  count      INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, paper_pmid, used_at)
);

ALTER TABLE chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own chat usage"
  ON chat_usage FOR SELECT USING (auth.uid() = user_id);
