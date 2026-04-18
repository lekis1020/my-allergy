-- Add publication_types array column for article type filtering
-- (Review, RCT, Meta-Analysis, etc.) sourced from PubMed PublicationTypeList.
-- Previously attempted via mesh_terms, which only contains MeSH descriptors.

ALTER TABLE papers ADD COLUMN IF NOT EXISTS publication_types TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_papers_publication_types
  ON papers USING GIN (publication_types);
