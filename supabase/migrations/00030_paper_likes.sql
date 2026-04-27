CREATE TABLE paper_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  paper_pmid text REFERENCES papers(pmid) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, paper_pmid)
);

ALTER TABLE paper_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read likes"
  ON paper_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own likes"
  ON paper_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
  ON paper_likes FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_paper_likes_pmid ON paper_likes(paper_pmid);
CREATE INDEX idx_paper_likes_user ON paper_likes(user_id);
