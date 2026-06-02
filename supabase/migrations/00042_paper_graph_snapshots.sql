-- Stores precomputed relationship-graph snapshots for the home Timeline panel.
-- One row per scope: 'galaxy' (top-level topic-cluster view) or
-- 'topic:<slug>' (per-topic paper subgraph, capped at 80 nodes).
--
-- The payload is opaque JSONB so the cron can evolve the schema (e.g. add a
-- Phase 2 `communities` array) without a schema migration.
--
-- Reads are public (anon SELECT). Writes are via the service role only and
-- are not exposed by any RLS policy.
CREATE TABLE IF NOT EXISTS paper_graph_snapshots (
  scope TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  node_count INT NOT NULL,
  edge_count INT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE paper_graph_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_paper_graph_snapshots"
  ON paper_graph_snapshots FOR SELECT TO anon
  USING (true);

CREATE POLICY "authenticated_read_paper_graph_snapshots"
  ON paper_graph_snapshots FOR SELECT TO authenticated
  USING (true);
