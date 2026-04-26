-- Add a `tagline` column to roams (curated short marketing copy, distinct from
-- `description`) and backfill from the Shift Your Summer Roams JSON dump.
-- Used by the partner marketing page; falls back to first sentence of
-- description when null.

ALTER TABLE roams ADD COLUMN IF NOT EXISTS tagline text;

UPDATE roams SET tagline = 'Three bakeries, three neighborhoods, three buses and trains.' WHERE id = 'bakery-run';
UPDATE roams SET tagline = 'The ride everyone should do at least once.' WHERE id = 'charles-loop';
UPDATE roams SET tagline = 'Sixteen stops, 2.5 miles, 400 years of history.' WHERE id = 'freedom-stroll';
UPDATE roams SET tagline = 'There''s a reason cyclists line up on the Mass Ave Bridge at golden hour.' WHERE id = 'sunset-pedal';
UPDATE roams SET tagline = 'Four consecutive B Line stops through the heart of Allston, each with a bar worth ducking into.' WHERE id = 'b-line-crawl';
UPDATE roams SET tagline = 'Olmsted''s seven-mile chain of parks, end to end.' WHERE id = 'emerald-necklace';
UPDATE roams SET tagline = 'Three world-class museums, zero parking headaches.' WHERE id = 'museum-hop';
UPDATE roams SET tagline = 'Ten miles tracing the route the British marched in 1775.' WHERE id = 'minuteman';
UPDATE roams SET tagline = 'Boston''s best-kept-secret Harborwalk + Latin American food scene.' WHERE id = 'eastie-eats';
UPDATE roams SET tagline = 'South Station to Foxborough on the Stadium Train. No traffic on Route 1.' WHERE id = 'world-cup-express';
UPDATE roams SET tagline = 'Walk from Charlestown Navy Yard to the Seaport during Sail Boston.' WHERE id = 'tall-ships';
UPDATE roams SET tagline = '30 minutes from North Station drops you in downtown Salem.' WHERE id = 'salem-by-rail';
UPDATE roams SET tagline = 'Davis Square to Lovejoy Wharf, end-to-end on the new Somerville extension.' WHERE id = 'community-path';
UPDATE roams SET tagline = 'A national park 20 minutes from Long Wharf by ferry.' WHERE id = 'harbor-islands';
UPDATE roams SET tagline = 'The ride that proves Boston is a bike city — almost entirely on protected lanes.' WHERE id = 'north-point-city-hall';
UPDATE roams SET tagline = 'Four Cambridge squares, end to end, on the Red Line.' WHERE id = 'roam-1776607065055';
UPDATE roams SET tagline = 'Cambridge''s 155-acre reservoir, fully looped, no street crossings.' WHERE id = 'fresh-pond-loop';
