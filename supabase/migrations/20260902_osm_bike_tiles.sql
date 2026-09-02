-- OpenStreetMap bike-lane ways for /nearby, one row per 0.05° map tile
-- (~3.5 x 2.6 mi). Filled and refreshed by the osm-bike-lanes cron so the
-- request path reads our own table instead of calling the public Overpass
-- API live (3 MB, 4-17 s, throttled). Raw whitelisted tags are stored and
-- classified at read time, so a rule change never needs a re-ingest.
-- Service-role access only: RLS enabled with no policies.

create table if not exists osm_bike_tiles (
  tile text primary key,            -- "latIdx:lngIdx" at 0.05° cells
  priority int not null,            -- miles from Boston center; lower fills first
  ways jsonb,                       -- [{id, tags, coords:[[lng,lat],...]}], null until fetched
  way_count int,
  fetched_at timestamptz,           -- last SUCCESSFUL fetch
  attempted_at timestamptz,         -- last attempt, success or not
  fetch_error text                  -- last failure; cleared on success
);

create index if not exists osm_bike_tiles_fetched_idx on osm_bike_tiles (fetched_at);

alter table osm_bike_tiles enable row level security;
