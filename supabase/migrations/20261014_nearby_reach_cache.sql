-- Travel times from a ~220 m grid cell to its region's destinations, as
-- served by /api/nearby/reach, the app's Around You, and the campus and print
-- snapshots (src/lib/server/reach.ts). Each row stands for 14–32 paid Google
-- Routes calls. Next's own data cache was wiped by every deploy, so each
-- publish re-bought them (Oct 2026: ~$90 of Routes in 13 days). Rows are
-- fresh for 7 days (checked in code); the nightly job drops anything past 30.
-- Service-role access only: RLS enabled with no policies.

create table if not exists nearby_reach_cache (
  key text primary key,             -- '<REACH_ROW_VERSION>:<lat>,<lng>' (cell centre)
  version text not null,
  lat double precision not null,
  lng double precision not null,
  payload jsonb not null,           -- { destinations: ReachRow[], region }
  computed_at timestamptz not null default now()
);

alter table nearby_reach_cache enable row level security;

select cron.schedule(
  'prune-nearby-reach-cache',
  '35 7 * * *',
  $$delete from public.nearby_reach_cache where computed_at < now() - interval '30 days'$$
);
