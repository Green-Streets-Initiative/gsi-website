-- Update organizer_logo_url to include both ESMS and SAC logos
UPDATE wayfinding_events
SET organizer_logo_url = 'https://static.wixstatic.com/media/e81d2c_b4217595de34451b87dc75433c7f6ebe~mv2.png, https://static.wixstatic.com/media/e81d2c_4f02db12d19d4de581643c20ccf5f624~mv2.png'
WHERE slug = 'carnaval';

-- Update business categories from generic "Restaurants" to proper subcategories
UPDATE wayfinding_businesses SET category = 'Cafe' WHERE name IN ('Recino''s Cafe', 'Pastelaria Vitoria Broadway', 'Ola Cafe') AND event_id = (SELECT id FROM wayfinding_events WHERE slug = 'carnaval');
UPDATE wayfinding_businesses SET category = 'Quick Bites' WHERE name IN ('Taco Loco Mexican Grill', 'Lotus Xpress', 'Friends Pizza', 'Taqueria Tapatio', 'Buddy''s', 'Royal Pizza & Subs') AND event_id = (SELECT id FROM wayfinding_events WHERE slug = 'carnaval');
UPDATE wayfinding_businesses SET category = 'Bar & Grill' WHERE name IN ('Casey''s', 'Louies', 'Mount Vernon Restaurant & Pub', 'Michael''s Bar') AND event_id = (SELECT id FROM wayfinding_events WHERE slug = 'carnaval');
UPDATE wayfinding_businesses SET category = 'Restaurant' WHERE category = 'Restaurants' AND event_id = (SELECT id FROM wayfinding_events WHERE slug = 'carnaval');
