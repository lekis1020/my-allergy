-- 00026_drop_email_keyword_alerts.sql
-- Remove email subscription and keyword alert tables (replaced by in-app notifications)

DROP TABLE IF EXISTS keyword_alerts;
DROP TABLE IF EXISTS email_subscriptions;
