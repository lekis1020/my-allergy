-- Persist topic classification on papers so the relationship-graph recompute
-- no longer has to scan every abstract on each run.
--
-- Background: `relationship-graph.recompute` classified topics at run time by
-- fetching `title + abstract` for the entire corpus (16k+ rows, ~27MB) in a
-- single unbounded query. That exceeded the Postgres statement timeout and the
-- function failed on every run, freezing the snapshot at 2026-06-02. Topic
-- classification is deterministic and never changes after a paper is stored, so
-- we compute it once at sync time and store it here. The recompute then reads
-- only this lightweight column and skips `abstract` entirely.
--
-- `topic_tags` mirrors the runtime output of classifyPaperTopics() (see
-- src/lib/utils/topic-tags.ts): an ordered TopicTag[] whose first element is the
-- primary topic. NULL means "not yet classified" and is backfilled by the
-- `papers.backfill-topics` Inngest function.

ALTER TABLE papers ADD COLUMN IF NOT EXISTS topic_tags text[];

-- Lets the backfill job find unclassified rows cheaply, and supports any future
-- topic filtering on the primary tag.
CREATE INDEX IF NOT EXISTS idx_papers_topic_tags ON papers USING GIN (topic_tags);
