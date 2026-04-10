-- Refine barrier codes in content_items for more specific guide matching
-- Run this migration in the Supabase SQL editor

-- Split 'logistics' into finer barrier codes
-- "What to wear for a bike commute" → sweating (was logistics)
UPDATE content_items SET primary_barrier = 'sweating'
WHERE id = 'mg_bike_commute_gear' AND primary_barrier = 'logistics';

-- "Where to lock your bike" → bike_parking (was logistics)
UPDATE content_items SET primary_barrier = 'bike_parking'
WHERE id = 'mg_bike_lock' AND primary_barrier = 'logistics';

-- "How to use Blue Bikes" → keep as logistics (general planning)
-- UPDATE content_items SET primary_barrier = 'planning'
-- WHERE id = 'mg_blue_bikes' AND primary_barrier = 'logistics';

-- "How to pay for the T with your phone" → planning (was logistics)
UPDATE content_items SET primary_barrier = 'planning'
WHERE id = 'mg_pay_for_t' AND primary_barrier = 'logistics';

-- "Your first bus ride" → planning (was confidence)
UPDATE content_items SET primary_barrier = 'planning'
WHERE id = 'mg_first_bus_ride' AND primary_barrier = 'confidence';

-- Verify the updates
-- SELECT id, title, primary_barrier FROM content_items
-- WHERE content_type = 'micro_guide' AND status = 'approved'
-- ORDER BY primary_mode, primary_barrier;
