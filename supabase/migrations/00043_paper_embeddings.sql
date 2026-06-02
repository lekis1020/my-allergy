-- pgvector + paper embeddings for semantic relationship-graph edges.
-- text-embedding-3-small returns 1536-dim vectors; we store one row per paper.
-- Index choice: IVFFlat with cosine ops, lists tuned for ~1k–10k corpus.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- IVFFlat needs at least one row to build, so we tolerate creation failure
-- on an empty table by guarding via DO block. lists=100 is a reasonable
-- default for our scale (sqrt(N) is the rule of thumb).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'papers_embedding_ivfflat_cosine'
  ) THEN
    BEGIN
      EXECUTE 'CREATE INDEX papers_embedding_ivfflat_cosine
        ON papers USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)';
    EXCEPTION WHEN OTHERS THEN
      -- IVFFlat creation on an empty / tiny table can fail; safe to skip
      -- and revisit after the first backfill populates rows.
      RAISE NOTICE 'ivfflat index creation skipped: %', SQLERRM;
    END;
  END IF;
END $$;
