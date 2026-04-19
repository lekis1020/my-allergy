-- Multi-dimensional affinity profile for personalized feed scoring.
-- Each JSONB column stores { "feature_name": weight } where weight ∈ [-1, 1].

CREATE TABLE IF NOT EXISTS user_affinity_profiles (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  topics        JSONB NOT NULL DEFAULT '{}',
  authors       JSONB NOT NULL DEFAULT '{}',
  keywords      JSONB NOT NULL DEFAULT '{}',
  mesh_terms    JSONB NOT NULL DEFAULT '{}',
  journals      JSONB NOT NULL DEFAULT '{}',
  article_types JSONB NOT NULL DEFAULT '{}',
  feedback_count INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_affinity_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_affinity_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON user_affinity_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON user_affinity_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile" ON user_affinity_profiles
  FOR DELETE USING (auth.uid() = user_id);
