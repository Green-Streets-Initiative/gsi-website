-- Backfill roams.hero_image_url + add hero_image_attribution_url for the
-- Shift Your Summer partner page. The marketing page reads three columns
-- directly (hero_image_url, hero_image_attribution, hero_image_attribution_url)
-- so it doesn't need to call the Unsplash API at render time.
--
-- Values come from the Shift Your Summer Roams JSON dump (2026-04-25).

ALTER TABLE roams ADD COLUMN IF NOT EXISTS hero_image_attribution_url text;

UPDATE roams SET
  hero_image_url = 'https://images.unsplash.com/photo-1689037676470-b72230d5236e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MjUwNzh8MHwxfGFsbHx8fHx8fHx8fDE3NzcxNTgwMDR8&ixlib=rb-4.1.0&q=80&w=1080',
  hero_image_attribution = 'Photo by Amy Vosters on Unsplash',
  hero_image_attribution_url = 'https://unsplash.com/@amyvosters'
WHERE id = 'bakery-run';

UPDATE roams SET
  hero_image_url = 'https://images.unsplash.com/photo-1667670196362-7919eb140574?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MjUwNzh8MHwxfGFsbHx8fHx8fHx8fDE3NzcxNTg3ODV8&ixlib=rb-4.1.0&q=80&w=1080',
  hero_image_attribution = 'Photo by G Schwan on Unsplash',
  hero_image_attribution_url = 'https://unsplash.com/@gschwan'
WHERE id = 'charles-loop';

UPDATE roams SET
  hero_image_url = 'https://images.unsplash.com/photo-1611839234426-21de3ee58176?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MjUwNzh8MHwxfHNlYXJjaHwxfHxGcmVlZG9tJTIwVHJhaWwlMjBCb3N0b24lMjBDb21tb258ZW58MHwwfHx8MTc3NzE1NzY1NHww&ixlib=rb-4.1.0&q=80&w=1080',
  hero_image_attribution = 'Photo by Sean Sweeney on Unsplash',
  hero_image_attribution_url = 'https://unsplash.com/@seansweeney'
WHERE id = 'freedom-stroll';

UPDATE roams SET
  hero_image_url = 'https://images.unsplash.com/photo-1558279209-0117252c552a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MjUwNzh8MHwxfHNlYXJjaHwxfHxCb3N0b24lMjBzdW5zZXQlMjBicmlkZ2V8ZW58MHwwfHx8MTc3NzE1NzY4OXww&ixlib=rb-4.1.0&q=80&w=1080',
  hero_image_attribution = 'Photo by Sahaj Bedi on Unsplash',
  hero_image_attribution_url = 'https://unsplash.com/@sahajbedi'
WHERE id = 'sunset-pedal';

UPDATE roams SET
  hero_image_url = 'https://images.unsplash.com/photo-1578245511952-48e962102af7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MjUwNzh8MHwxfGFsbHx8fHx8fHx8fDE3NzcxNTg3ODl8&ixlib=rb-4.1.0&q=80&w=1080',
  hero_image_attribution = 'Photo by Pascal Bernardon on Unsplash',
  hero_image_attribution_url = 'https://unsplash.com/@pbernardon'
WHERE id = 'b-line-crawl';

UPDATE roams SET
  hero_image_url = 'https://images.unsplash.com/photo-1595170307713-506d6cf84162?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MjUwNzh8MHwxfGFsbHx8fHx8fHx8fDE3NzcxNTg3OTN8&ixlib=rb-4.1.0&q=80&w=1080',
  hero_image_attribution = 'Photo by Mark Olsen on Unsplash',
  hero_image_attribution_url = 'https://unsplash.com/@markolsen'
WHERE id = 'emerald-necklace';

UPDATE roams SET
  hero_image_url = 'https://images.unsplash.com/photo-1651439504798-123517bec7b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MjUwNzh8MHwxfHNlYXJjaHwxfHxNdXNldW0lMjBvZiUyMEZpbmUlMjBBcnRzJTIwQm9zdG9ufGVufDB8MHx8fDE3NzcxNTc2NTZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
  hero_image_attribution = 'Photo by Herry Sutanto on Unsplash',
  hero_image_attribution_url = 'https://unsplash.com/@sutanto'
WHERE id = 'museum-hop';

UPDATE roams SET
  hero_image_url = 'https://images.unsplash.com/photo-1609959164279-8874a3e2a920?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MjUwNzh8MHwxfGFsbHx8fHx8fHx8fDE3NzcxNTg3OTh8&ixlib=rb-4.1.0&q=80&w=1080',
  hero_image_attribution = 'Photo by Aaron Doucett on Unsplash',
  hero_image_attribution_url = 'https://unsplash.com/@adoucett'
WHERE id = 'minuteman';

UPDATE roams SET
  hero_image_url = 'https://images.unsplash.com/photo-1740151369477-7faa67493885?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MjUwNzh8MHwxfHNlYXJjaHwxfHxFYXN0JTIwQm9zdG9uJTIwd2F0ZXJmcm9udHxlbnwwfDB8fHwxNzc3MTU3NjU2fDA&ixlib=rb-4.1.0&q=80&w=1080',
  hero_image_attribution = 'Photo by Brett Wharton on Unsplash',
  hero_image_attribution_url = 'https://unsplash.com/@brettwharton'
WHERE id = 'eastie-eats';

UPDATE roams SET
  hero_image_url = 'https://images.unsplash.com/photo-1692796226663-dd49d738f43c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MjUwNzh8MHwxfHNlYXJjaHwxfHxHaWxsZXR0ZSUyMFN0YWRpdW0lMjBGb3hib3JvdWdofGVufDB8MHx8fDE3NzcxNTc2NTZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
  hero_image_attribution = 'Photo by Stephen Mease on Unsplash',
  hero_image_attribution_url = 'https://unsplash.com/@smeasevt'
WHERE id = 'world-cup-express';

UPDATE roams SET
  hero_image_url = 'https://images.unsplash.com/photo-1654600423457-6bbb8e5d837a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MjUwNzh8MHwxfHNlYXJjaHwxfHxCb3N0b24lMjBIYXJib3IlMjB0YWxsJTIwc2hpcHN8ZW58MHwwfHx8MTc3NzE1NzY1N3ww&ixlib=rb-4.1.0&q=80&w=1080',
  hero_image_attribution = 'Photo by David Trinks on Unsplash',
  hero_image_attribution_url = 'https://unsplash.com/@dtrinksrph'
WHERE id = 'tall-ships';

UPDATE roams SET
  hero_image_url = 'https://images.unsplash.com/photo-1654741973313-5a11be275611?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MjUwNzh8MHwxfGFsbHx8fHx8fHx8fDE3NzcxNTg4MDJ8&ixlib=rb-4.1.0&q=80&w=1080',
  hero_image_attribution = 'Photo by David Trinks on Unsplash',
  hero_image_attribution_url = 'https://unsplash.com/@dtrinksrph'
WHERE id = 'salem-by-rail';

UPDATE roams SET
  hero_image_url = 'https://images.unsplash.com/photo-1594138485078-2362f4b78b73?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MjUwNzh8MHwxfHNlYXJjaHwxfHxiaWtlJTIwcGF0aCUyME5ldyUyMEVuZ2xhbmR8ZW58MHwwfHx8MTc3NzE1NzY5MXww&ixlib=rb-4.1.0&q=80&w=1080',
  hero_image_attribution = 'Photo by Alex Jones on Unsplash',
  hero_image_attribution_url = 'https://unsplash.com/@the_aoj'
WHERE id = 'community-path';

UPDATE roams SET
  hero_image_url = 'https://images.unsplash.com/photo-1633092653905-75b50723547d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MjUwNzh8MHwxfHNlYXJjaHwxfHxCb3N0b24lMjBIYXJib3IlMjBJc2xhbmRzJTIwU3BlY3RhY2xlfGVufDB8MHx8fDE3NzcxNTc2NTh8MA&ixlib=rb-4.1.0&q=80&w=1080',
  hero_image_attribution = 'Photo by Charlie Hales on Unsplash',
  hero_image_attribution_url = 'https://unsplash.com/@capturedbyhales'
WHERE id = 'harbor-islands';

UPDATE roams SET
  hero_image_url = 'https://images.unsplash.com/photo-1705363969996-cad961478b89?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MjUwNzh8MHwxfHNlYXJjaHwxfHxCb3N0b24lMjBicmlkZ2UlMjBjeWNsaXN0fGVufDB8MHx8fDE3NzcxNTgwMTd8MA&ixlib=rb-4.1.0&q=80&w=1080',
  hero_image_attribution = 'Photo by Yaakov Winiarz on Unsplash',
  hero_image_attribution_url = 'https://unsplash.com/@ywiniarz'
WHERE id = 'north-point-city-hall';

UPDATE roams SET
  hero_image_url = 'https://images.unsplash.com/photo-1680674428972-3e40c64c730c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MjUwNzh8MHwxfGFsbHx8fHx8fHx8fDE3NzcxNTg4MDZ8&ixlib=rb-4.1.0&q=80&w=1080',
  hero_image_attribution = 'Photo by Arthur Tseng on Unsplash',
  hero_image_attribution_url = 'https://unsplash.com/@arthur3607'
WHERE id = 'roam-1776607065055';

-- Fresh Pond Loop already has hero_image_url + hero_image_attribution (Wikimedia).
-- Just set the new attribution_url column.
UPDATE roams SET
  hero_image_attribution_url = 'https://commons.wikimedia.org/wiki/File:08-1323-fresh_pond-sky.jpg'
WHERE id = 'fresh-pond-loop';
