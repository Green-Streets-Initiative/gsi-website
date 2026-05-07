-- Micro-guide library schema additions
-- Adds slug (for public URLs), topics (browse axis), related_guides (cross-refs),
-- is_starter (in-flow Commute Advisor surfacing), and last_reviewed_at (freshness tracking).
-- Idempotent — safe to re-run.

ALTER TABLE content_items ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS topics text[] DEFAULT '{}';
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS related_guides text[] DEFAULT '{}';
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS is_starter boolean DEFAULT false;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS content_items_slug_unique
  ON content_items (slug) WHERE slug IS NOT NULL;
