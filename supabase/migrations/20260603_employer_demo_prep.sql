-- Employer demo prep: ensure prize_description column exists on competitions.
-- The employer portal reads and writes this column for employer challenges,
-- but it was only ever defined on school_competitions (migration 00046).
-- IF NOT EXISTS makes this safe to re-run.

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS prize_description text;
