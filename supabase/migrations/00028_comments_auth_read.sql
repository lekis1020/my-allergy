-- Restrict comment reads to authenticated users only
DROP POLICY IF EXISTS "paper_comments_public_read" ON paper_comments;

CREATE POLICY "paper_comments_auth_read"
  ON paper_comments FOR SELECT
  USING (deleted_at IS NULL AND auth.uid() IS NOT NULL);
