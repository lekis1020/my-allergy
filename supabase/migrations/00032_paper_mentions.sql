-- Paper mention relationships from user comments.
-- When a user @-mentions a paper in a comment, store the link here.

CREATE TABLE paper_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES paper_comments(id) ON DELETE CASCADE,
  source_pmid TEXT NOT NULL,
  mentioned_pmid TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE paper_mentions
  ADD CONSTRAINT uq_mention_per_comment UNIQUE (comment_id, mentioned_pmid);

CREATE INDEX idx_paper_mentions_source ON paper_mentions(source_pmid);
CREATE INDEX idx_paper_mentions_mentioned ON paper_mentions(mentioned_pmid);

ALTER TABLE paper_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read mentions"
  ON paper_mentions FOR SELECT TO authenticated
  USING (true);
