-- Resolved photos for /nearby stations and corridors.
-- One row per location, written by the server-side photo pipeline
-- (Wikipedia lead image -> Google Places + vision pick -> none).
-- Service-role access only: RLS enabled with no policies.

create table if not exists nearby_photos (
  key text primary key,
  name text not null,
  kind text not null,               -- station | bike | line
  source text not null,             -- wikipedia | places | none
  url text,                         -- display URL (wikimedia thumb, or our places proxy path)
  attribution text,
  attribution_url text,
  place_photo_name text,            -- Google Places photo resource, when source = places
  meta jsonb not null default '{}'::jsonb,
  resolved_at timestamptz not null default now()
);

alter table nearby_photos enable row level security;
