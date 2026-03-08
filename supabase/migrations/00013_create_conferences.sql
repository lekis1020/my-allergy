CREATE TABLE IF NOT EXISTS conferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ko TEXT,
  start_date DATE,
  end_date DATE,
  location TEXT,
  country TEXT,
  tags TEXT[] DEFAULT '{}',
  website TEXT,
  is_korean BOOLEAN DEFAULT false,
  source_url TEXT,
  scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conferences_start_date_idx ON conferences (start_date);
