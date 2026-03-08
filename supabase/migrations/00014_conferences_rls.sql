-- Enable RLS and allow public read on conferences table
ALTER TABLE conferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conferences_public_read" ON conferences
  FOR SELECT TO anon, authenticated
  USING (true);
