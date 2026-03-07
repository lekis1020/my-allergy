-- Email subscriptions: users subscribe to journals for email alerts
CREATE TABLE IF NOT EXISTS email_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journal_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, journal_slug)
);

-- Enable RLS
ALTER TABLE email_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON email_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own subscriptions
CREATE POLICY "Users can insert own subscriptions" ON email_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own subscriptions
CREATE POLICY "Users can delete own subscriptions" ON email_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can read all subscriptions (for sending notifications)
CREATE POLICY "Service role can read all subscriptions" ON email_subscriptions
  FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');

-- Indexes
CREATE INDEX idx_email_subscriptions_user_id ON email_subscriptions(user_id);
CREATE INDEX idx_email_subscriptions_journal ON email_subscriptions(journal_slug);
