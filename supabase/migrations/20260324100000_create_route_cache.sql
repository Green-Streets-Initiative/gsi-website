CREATE TABLE route_cache (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  origin_lat      NUMERIC(9,6) NOT NULL,
  origin_lng      NUMERIC(9,6) NOT NULL,
  dest_lat        NUMERIC(9,6) NOT NULL,
  dest_lng        NUMERIC(9,6) NOT NULL,
  mode            TEXT NOT NULL,
  duration_mins   INTEGER NOT NULL,
  distance_miles  NUMERIC(7,2) NOT NULL,
  fetched_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (origin_lat, origin_lng, dest_lat, dest_lng, mode)
);

CREATE INDEX idx_route_cache_lookup
  ON route_cache (origin_lat, origin_lng, dest_lat, dest_lng, mode);

ALTER TABLE route_cache ENABLE ROW LEVEL SECURITY;
