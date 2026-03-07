-- Keyword alerts: users set keywords to get notified when matching papers appear
CREATE TABLE IF NOT EXISTS keyword_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, keyword)
);

-- Enable RLS
ALTER TABLE keyword_alerts ENABLE ROW LEVEL SECURITY;

-- Users can only read their own keyword alerts
CREATE POLICY "Users can view own keyword alerts" ON keyword_alerts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own keyword alerts
CREATE POLICY "Users can insert own keyword alerts" ON keyword_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own keyword alerts
CREATE POLICY "Users can update own keyword alerts" ON keyword_alerts
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own keyword alerts
CREATE POLICY "Users can delete own keyword alerts" ON keyword_alerts
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can read all keyword alerts (for matching during sync)
CREATE POLICY "Service role can read all keyword alerts" ON keyword_alerts
  FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');

-- Indexes
CREATE INDEX idx_keyword_alerts_user_id ON keyword_alerts(user_id);
CREATE INDEX idx_keyword_alerts_active ON keyword_alerts(user_id, active) WHERE active = true;
