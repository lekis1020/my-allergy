-- Anonymous paper comments (Phase 3: community threads)
-- NOTE: migrations 00013-00015 are owned by other teams, so this file uses 00016.

CREATE TABLE IF NOT EXISTS paper_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_pmid TEXT NOT NULL REFERENCES papers(pmid) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES paper_comments(id) ON DELETE CASCADE,
  anon_id TEXT NOT NULL,
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  report_count INT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paper_comments_paper_created
  ON paper_comments(paper_pmid, created_at);
CREATE INDEX IF NOT EXISTS idx_paper_comments_parent
  ON paper_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_paper_comments_user
  ON paper_comments(user_id) WHERE user_id IS NOT NULL;

-- Enforce 1-level nesting at the DB layer: a comment whose parent has a non-NULL
-- parent_id cannot be inserted (API layer also checks this, belt-and-suspenders).
CREATE OR REPLACE FUNCTION enforce_one_level_nesting()
RETURNS TRIGGER AS $$
DECLARE
  parent_parent UUID;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT parent_id INTO parent_parent
  FROM paper_comments
  WHERE id = NEW.parent_id;

  IF parent_parent IS NOT NULL THEN
    RAISE EXCEPTION 'Replies to replies are not allowed (one-level nesting only)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_paper_comments_nesting ON paper_comments;
CREATE TRIGGER trg_paper_comments_nesting
  BEFORE INSERT ON paper_comments
  FOR EACH ROW EXECUTE FUNCTION enforce_one_level_nesting();

-- updated_at auto-maintain
CREATE OR REPLACE FUNCTION paper_comments_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_paper_comments_touch ON paper_comments;
CREATE TRIGGER trg_paper_comments_touch
  BEFORE UPDATE ON paper_comments
  FOR EACH ROW EXECUTE FUNCTION paper_comments_touch_updated_at();

-- RLS
ALTER TABLE paper_comments ENABLE ROW LEVEL SECURITY;

-- Public read (only non-deleted)
CREATE POLICY "paper_comments_public_read"
  ON paper_comments FOR SELECT
  USING (deleted_at IS NULL);

-- Insert: must be authenticated, must match user_id, email must be confirmed.
CREATE POLICY "paper_comments_auth_insert"
  ON paper_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND u.email_confirmed_at IS NOT NULL
    )
  );

-- Update: only own rows, within 5 minutes of creation.
-- Content may change; other columns are locked down at the API layer.
CREATE POLICY "paper_comments_auth_update"
  ON paper_comments FOR UPDATE
  USING (
    auth.uid() = user_id
    AND deleted_at IS NULL
    AND created_at > now() - INTERVAL '5 minutes'
  )
  WITH CHECK (
    auth.uid() = user_id
  );

-- Hard delete is not used; soft delete is done via UPDATE deleted_at.
-- Still allow owners to DELETE their own row (for admin/cleanup).
CREATE POLICY "paper_comments_auth_delete"
  ON paper_comments FOR DELETE
  USING (auth.uid() = user_id);


-- comment_reports
CREATE TABLE IF NOT EXISTS comment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES paper_comments(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comment_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_reports_comment
  ON comment_reports(comment_id);

ALTER TABLE comment_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comment_reports_select_own"
  ON comment_reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "comment_reports_insert_own"
  ON comment_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Auto-hide threshold trigger: at 3 reports, soft-delete the comment.
CREATE OR REPLACE FUNCTION comment_reports_auto_hide()
RETURNS TRIGGER AS $$
DECLARE
  report_total INT;
BEGIN
  SELECT COUNT(*) INTO report_total
  FROM comment_reports
  WHERE comment_id = NEW.comment_id;

  UPDATE paper_comments
  SET report_count = report_total
  WHERE id = NEW.comment_id;

  IF report_total >= 3 THEN
    UPDATE paper_comments
    SET deleted_at = now()
    WHERE id = NEW.comment_id
      AND deleted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_comment_reports_auto_hide ON comment_reports;
CREATE TRIGGER trg_comment_reports_auto_hide
  AFTER INSERT ON comment_reports
  FOR EACH ROW EXECUTE FUNCTION comment_reports_auto_hide();

-- Realtime: enable postgres_changes for paper_comments only (not reports).
ALTER PUBLICATION supabase_realtime ADD TABLE paper_comments;
