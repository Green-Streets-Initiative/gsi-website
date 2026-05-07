-- Snapshot store for the monthly freshness-check agent.
-- Each row holds the last extracted set of price strings for a tracked
-- canonical URL. The agent diffs new fetches against these snapshots and
-- emails a summary. Idempotent.

CREATE TABLE IF NOT EXISTS freshness_snapshots (
  url         text PRIMARY KEY,
  prices      text[] NOT NULL DEFAULT '{}',
  fetched_at  timestamptz NOT NULL DEFAULT now()
);
