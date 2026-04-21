-- 00025_create_notifications.sql
-- In-app notifications for comment activity on bookmarked/commented papers

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_pmid  TEXT NOT NULL,
  comment_id  UUID NOT NULL REFERENCES paper_comments(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('bookmark_comment', 'thread_comment')),
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup for user's unread notifications, newest first
CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id, read, created_at DESC);

-- Prevent duplicate notifications for same user + comment + type
CREATE UNIQUE INDEX idx_notifications_unique
  ON notifications (user_id, comment_id, type);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "users read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only update (mark read) their own notifications
CREATE POLICY "users update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- No INSERT policy: only service role client can insert (bypasses RLS)
