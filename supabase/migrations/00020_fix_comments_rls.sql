-- Fix paper_comments_auth_insert RLS: drop direct auth.users reference.
--
-- Background: the original policy in 00018 referenced auth.users in a subquery,
-- which fails for the `authenticated` role (no SELECT grant on auth.users) and
-- surfaces as `permission denied for table users` whenever a user posts a
-- comment. The check is wrapped in a SECURITY DEFINER helper so the
-- privileged owner can read auth.users without exposing the table to clients.

CREATE OR REPLACE FUNCTION public.is_email_confirmed()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT u.email_confirmed_at IS NOT NULL
      FROM auth.users u
      WHERE u.id = auth.uid()
    ),
    FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_email_confirmed() TO authenticated, anon;

DROP POLICY IF EXISTS "paper_comments_auth_insert" ON paper_comments;

CREATE POLICY "paper_comments_auth_insert"
  ON paper_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_email_confirmed()
  );
