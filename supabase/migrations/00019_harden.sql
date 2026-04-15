-- 00019 Security hardening follow-up for Phase 1-3 migrations
--
-- Motivations:
--   1. Privacy: Realtime broadcasts must not expose paper_comments.user_id
--      (would break the anon-id design, since any authed subscriber could
--      correlate every comment to its true author).
--   2. SECURITY DEFINER functions must pin `search_path` to guard against
--      schema-shadowing attacks.
--   3. cleanup_pubmed_query_cache() needs SECURITY DEFINER so it can run
--      from pg_cron / less-privileged roles without relying on RLS bypass.

-- ---- 1. Realtime publication: drop & re-add with column filter ----
-- Column-level publications (PG15+) let us omit user_id from the stream.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE paper_comments;
EXCEPTION
  WHEN undefined_object THEN NULL;  -- not in publication yet; no-op
END
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE paper_comments
  (id, paper_pmid, parent_id, anon_id, content, created_at, updated_at,
   deleted_at, report_count);

-- ---- 2. Pin search_path on comment_reports_auto_hide ----

CREATE OR REPLACE FUNCTION comment_reports_auto_hide()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

-- ---- 3. cleanup_pubmed_query_cache as SECURITY DEFINER + search_path ----

CREATE OR REPLACE FUNCTION cleanup_pubmed_query_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM pubmed_query_cache
  WHERE fetched_at + (ttl_seconds || ' seconds')::INTERVAL < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
