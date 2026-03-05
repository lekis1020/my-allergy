-- Allow NULL issn for online-only journals (e.g., Frontiers in Allergy)
ALTER TABLE journals ALTER COLUMN issn DROP NOT NULL;

-- Drop the existing unique constraint and recreate as partial unique index
-- (unique only when issn is not null)
ALTER TABLE journals DROP CONSTRAINT IF EXISTS journals_issn_key;
CREATE UNIQUE INDEX IF NOT EXISTS journals_issn_unique ON journals(issn) WHERE issn IS NOT NULL;
