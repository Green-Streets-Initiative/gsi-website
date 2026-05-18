-- Seed Carnaval event for East Somerville Main Streets
-- Corridor GeoJSON: Broadway between Pennsylvania Ave and McGrath Hwy

insert into wayfinding_events (
  slug, name, eyebrow, organizer_name,
  date_primary, date_rain, time_start, time_end,
  accent_color, center_lat, center_lng, default_zoom,
  locales, is_published,
  corridor_geojson, admin_token
) values (
  'carnaval',
  'Carnaval',
  'SomerStreets',
  'East Somerville Main Streets + Somerville Arts Council',
  '2026-06-07',
  '2026-06-14',
  '14:00',
  '18:00',
  '#D81B60',
  42.3878,
  -71.0835,
  16,
  '{en,es,pt}',
  true,
  '{
    "type": "LineString",
    "coordinates": [
      [-71.0780, 42.3858],
      [-71.0785, 42.3860],
      [-71.0795, 42.3863],
      [-71.0808, 42.3866],
      [-71.0820, 42.3870],
      [-71.0830, 42.3873],
      [-71.0840, 42.3876],
      [-71.0845, 42.3878],
      [-71.0850, 42.3880],
      [-71.0855, 42.3883],
      [-71.0860, 42.3889],
      [-71.0865, 42.3891],
      [-71.0870, 42.3895],
      [-71.0875, 42.3898]
    ]
  }'::jsonb,
  encode(gen_random_bytes(24), 'hex')
);

-- Seed 25 ESMS restaurants
with evt as (select id from wayfinding_events where slug = 'carnaval')
insert into wayfinding_businesses (event_id, name, category, description, lat, lng, address, website_url, google_place_id, show_on_map)
select evt.id, v.name, 'Restaurants', v.description, v.lat, v.lng, v.address, v.website_url, v.google_place_id, true
from evt, (values
  ('La Brasa', 'Wood-fired, globally inspired dishes & cocktails.', 42.3876847, -71.0845514, '124 Broadway', 'https://www.labrasasomerville.com', null),
  ('Fat Hen', 'Cozy Italian serving bowls of pasta & braised meats, plus fine wine.', 42.38791, -71.084638, null, null, 'ChIJf_M5Y9pw44kRuMmmh5GnXUY'),
  ('Taqueria Montecristo', 'Authentic Taqueria, Mexican and Salvadorean specialties.', 42.3880836, -71.0850222, '146 Broadway', 'https://montecristorestaurantsomerville.com', 'ChIJVVr8e9pw44kR5ycgfoFBlhU'),
  ('Gauchao Brazilian Cuisine', 'Corner churrascaria with a buffet, fire-roasted meats & Brazilian specialties.', 42.3874654, -71.08344, null, null, 'ChIJEalB9tpw44kRIR4EqysYXB8'),
  ('Rincon Mexicano Somerville', 'Authentic Mexican cuisine.', 42.387646, -71.082899, '99 Broadway', 'https://www.rinconmexicanosomerville.com', 'ChIJYbgbVNpw44kRFV41qqw3mPw'),
  ('Blessing Caribbean', 'Haitian and Caribbean Cuisine, Creole Griot.', 42.3875178, -71.0823981, '89 Broadway', null, 'ChIJsRBOVdpw44kRaJlfIaYcIbM'),
  ('Recino''s Cafe', 'Baked goods, beverages, and pupusas.', 42.3874485, -71.0822552, '85 Broadway', null, 'ChIJISwBq9tw44kRA4Ci9wB947w'),
  ('Vinny''s Ristorante', null, 42.3868797, -71.0816743, '76 Broadway', 'https://www.vinnysatnight.com/', 'ChIJ4RxWD9tw44kRfnBBHjLukwo'),
  ('Taco Loco Mexican Grill', 'Counter-serve burritos, taco combos, pupusas.', 42.386342, -71.0796774, '44 Broadway', null, 'ChIJtbLSfNtw44kR25KofPDZl3M'),
  ('Fasika Ethiopian Restaurant', 'Hands-on Ethiopian dining at traditional wicker tables, plus a full bar.', 42.3883488, -71.0848299, '145 Broadway', 'https://www.fasikaethiopian.com', 'ChIJrxxCcNpw44kRXOPPMg8myZM'),
  ('Lotus Xpress', 'Sushi, curries & noodle dishes.', 42.3889385, -71.0859397, '167 Broadway', 'https://www.lotusxpress.com', 'ChIJz2le8vh244kREBSYnYwT1Kk'),
  ('Casey''s', 'Pizza, sandwiches & bar bites.', 42.3890827, -71.0862535, '173 Broadway', 'https://www.caseyssomerville.com', 'ChIJIWIKl9Bw44kRqrcJvGf4L-w'),
  ('Maya Sol Mexican Grill', 'Mexican classics & Salvadoran pupusas.', 42.3891326, -71.0865165, '179 Broadway', 'https://www.mayasolmexicangrill.com', 'ChIJ5dyPltBw44kRfHg2YgGDaHQ'),
  ('Louies', null, 42.389559, -71.0870902, null, null, 'ChIJabfQ8dxw44kRbQGS-fA7VwM'),
  ('Pastelaria Vitoria Broadway', 'Brazilian Fast Food.', 42.3890312, -71.0873334, '192 Broadway', null, 'ChIJ1WFe6dBw44kRJUBchSYYOwQ'),
  ('Mount Vernon Restaurant & Pub', null, 42.385929, -71.0782028, '14 Broadway', 'https://www.mtvernonsomerville.com', 'ChIJ0feWktxw44kRMPIGmSD8rU0'),
  ('Friends Pizza', 'Pizzas, burgers, sandwiches, salads.', 42.386917, -71.086905, '38 Cross St', 'https://www.friendspizzamenu.com', 'ChIJSwOsatBw44kRxu36VKC2rNc'),
  ('Taqueria Tapatio', 'Mexican Restaurant.', 42.3870327, -71.0821241, '82 Broadway', null, 'ChIJZWCrANtw44kRXWBHooFaO1k'),
  ('Rei Da Picanha', 'Brazilian Steakhouse, burgers, and hot subs.', 42.3881068, -71.0841152, '129 Broadway', null, 'ChIJoa_wZtpw44kR3hcF6YMTo8o'),
  ('Ola Cafe', 'Cafe with coffee, pastries, sandwiches, fresh OJ.', 42.3875394, -71.083918, '112 Broadway', 'https://www.olacafesomerville.com', 'ChIJ8Z7uX9pw44kRHcApbk0KJWE'),
  ('Los Paisanos Restaurant', 'Mexican Dishes.', 42.386576, -71.080744, null, null, 'ChIJ2cSvc9tw44kRUKnF29-Q3bo'),
  ('Buddy''s', 'Small diner. Menu on paper plates tacked on the wall.', 42.3813466, -71.0868865, null, null, 'ChIJT1qRSc9w44kR9rjagY522fU'),
  ('Oliveira''s Steak House', 'Brazilian Steakhouse, rodízio style.', 42.3807928, -71.0869645, null, null, 'ChIJO03Gtchw44kRaJm0taIIUvk'),
  ('Royal Pizza & Subs', 'Pizza and Subs.', 42.3820859, -71.0820693, null, null, 'ChIJdXDrUcRw44kR_RJR5kDwKUs'),
  ('Michael''s Bar', 'Cheap drinks, fun atmosphere, local hangout.', 42.3815692, -71.085876, null, null, 'ChIJE_7PW89w44kR-KWwQjrAJJw')
) as v(name, description, lat, lng, address, website_url, google_place_id);
