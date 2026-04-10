-- Dynamic pricing data for Commute Advisor
-- Run this migration in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS pricing_data (
  key TEXT PRIMARY KEY,
  value NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  source TEXT
);

-- Seed with current values
INSERT INTO pricing_data (key, value, source) VALUES
  ('gas_price_ma', 3.59, 'AAA Massachusetts average, April 2026'),
  ('mbta_subway_single', 2.40, 'mbta.com/fares'),
  ('mbta_subway_monthly', 90, 'mbta.com/fares'),
  ('mbta_bus_single', 1.70, 'mbta.com/fares'),
  ('mbta_bus_monthly', 55, 'mbta.com/fares'),
  ('parking_daily_boston', 18, 'SpotAngels Boston metro average'),
  ('maint_per_mile', 0.109, 'AAA 2025 variable rate, medium sedan')
ON CONFLICT (key) DO NOTHING;

-- Allow public read access
ALTER TABLE pricing_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_pricing" ON pricing_data
  FOR SELECT USING (true);

GRANT SELECT ON pricing_data TO anon;
GRANT SELECT ON pricing_data TO authenticated;
