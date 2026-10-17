-- Seed migration for the micro-guide library (28 guides).
-- Generated from content/micro-guides-library.md by
-- scripts/build-micro-guides-migration.mjs — do not edit by hand.
--
-- Re-running the parser overwrites this file. The markdown is the source of truth.

BEGIN;

-- 0. Ensure the body_template column exists (added for auto-price-update).
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS body_template text;

-- 1. Mode cleanup: any pre-existing 'bike' rows fold into 'cycling'.
UPDATE content_items SET primary_mode = 'cycling' WHERE primary_mode = 'bike';

-- 2. Archive guides superseded by mg_bluebikes.
-- (CHECK constraint allows 'approved' | 'archived' | 'draft' — 'archived'
--  takes them out of the active set without inventing a new status value.)
UPDATE content_items SET status = 'archived'
  WHERE id IN ('mg_blue_bikes', 'mg_return_bluebike');

-- 3. Upsert the 28-guide library.
INSERT INTO content_items (
  id, title, slug, summary, body, body_template, primary_mode, primary_barrier, status,
  content_type, surfaces, topics, related_guides, is_starter,
  read_time_minutes, last_reviewed_at
) VALUES
  (
    'mg_low_stress_routes',
    'Picking a bike route that feels comfortable',
    'picking-a-bike-route',
    'Comfort beats speed for a route you''ll actually keep using. How to pick one that feels manageable from day one.',
    $guidebody$The fastest route isn't always the right route. A ride that's five minutes longer on a protected lane is almost always better than a "direct" route on a four-lane road with no bike lane. Here's how to pick well, especially when you're new.

### 1. Know your infrastructure types.

Protected lanes (physically separated from traffic) are the most comfortable. Shared-use paths like the Minuteman or the Charles River paths are completely separate from cars. Painted lanes are good, but watch for car doors opening. Neighborhood streets are often fine even without bike lanes.

### 2. Let a map show you the comfortable streets.

In the Shift app, open Around You and pick where you're headed. You'll see the calmest route and the fastest one, with every street rated for comfort and the busy crossings called out. Don't have the app? The Nearby page at gogreenstreets.org/nearby does the same thing in a browser. Google Maps' cycling layer is a good second opinion: it shows bike lanes and paths, and it's the app you'll navigate with anyway.

### 3. Start with paths, not roads.

Before committing to a commute on the road, ride one of the region's paths once for confidence: the Minuteman (Alewife in Cambridge to Bedford), the Charles River paths, the Somerville Community Path, or the Southwest Corridor. Flat, scenic and fully separated from traffic.

### 4. One block over changes everything.

If your route has a busy stretch, look at the parallel street one block over. It's almost always quieter and adds only a minute or two.

### 5. Try it on a weekend first.

Ride your planned commute once on a Saturday morning with no time pressure. Knowing the route takes most of the stress out of riding it on a Tuesday.

### Try this first

Pick the place you go most and compare the calmest route with the fastest. The difference is usually a couple of minutes and a lot less traffic.$guidebody$,
    $guidebody$The fastest route isn't always the right route. A ride that's five minutes longer on a protected lane is almost always better than a "direct" route on a four-lane road with no bike lane. Here's how to pick well, especially when you're new.

### 1. Know your infrastructure types.

Protected lanes (physically separated from traffic) are the most comfortable. Shared-use paths like the Minuteman or the Charles River paths are completely separate from cars. Painted lanes are good, but watch for car doors opening. Neighborhood streets are often fine even without bike lanes.

### 2. Let a map show you the comfortable streets.

In the Shift app, open Around You and pick where you're headed. You'll see the calmest route and the fastest one, with every street rated for comfort and the busy crossings called out. Don't have the app? The Nearby page at gogreenstreets.org/nearby does the same thing in a browser. Google Maps' cycling layer is a good second opinion: it shows bike lanes and paths, and it's the app you'll navigate with anyway.

### 3. Start with paths, not roads.

Before committing to a commute on the road, ride one of the region's paths once for confidence: the Minuteman (Alewife in Cambridge to Bedford), the Charles River paths, the Somerville Community Path, or the Southwest Corridor. Flat, scenic and fully separated from traffic.

### 4. One block over changes everything.

If your route has a busy stretch, look at the parallel street one block over. It's almost always quieter and adds only a minute or two.

### 5. Try it on a weekend first.

Ride your planned commute once on a Saturday morning with no time pressure. Knowing the route takes most of the stress out of riding it on a Tuesday.

### Try this first

Pick the place you go most and compare the calmest route with the fastest. The difference is usually a couple of minutes and a lot less traffic.$guidebody$,
    'cycling',
    'routes',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['routes', 'getting-started', 'infrastructure']::text[],
    ARRAY['mg_first_bike_lane', 'mg_bike_commute_gear']::text[],
    true,
    2,
    timezone('America/New_York', '2026-10-06 12:00'::timestamp)
  ),
  (
    'mg_first_bike_lane',
    'Your first ride in a bike lane',
    'your-first-ride-in-a-bike-lane',
    'Protected, painted, sharrows, green paint — what each kind of bike lane means and how to ride it without overthinking.',
    $guidebody$Bike lanes in Boston range from painted lines on the road to fully separated paths with their own signals. Here's what to know for your first time in one.

### Protected lanes

Also called separated or cycle tracks. These have a physical barrier between you and car traffic — usually parked cars, posts, or a curb. The most comfortable lanes in the city. Stay to the right, pass on the left, and watch for pedestrians stepping into the lane at crossings.

### Painted bike lanes

Marked with white lines and bike symbols on the road surface. Cars aren't supposed to be in them, but doors from parked cars can swing open. Ride toward the left side of the lane — far enough from parked cars that an opening door won't reach you. Cyclists call this the "door zone," and avoiding it becomes second nature fast.

### Green paint

Marks areas where bikes and cars are likely to cross paths — intersections, merge zones, driveways. It's a heads-up, not a hazard. Just keep your line and make eye contact with turning drivers when you can.

### Sharrows

Shared lane arrows, the ones with the chevrons. They mean you share the lane with cars. You're allowed to take the full lane — ride in the center so cars pass you safely by changing lanes rather than squeezing by.

### The one habit that matters most

Look behind you before changing your position in the lane. A quick shoulder check before moving left to pass or avoid something — it's the cycling equivalent of checking your mirror.$guidebody$,
    $guidebody$Bike lanes in Boston range from painted lines on the road to fully separated paths with their own signals. Here's what to know for your first time in one.

### Protected lanes

Also called separated or cycle tracks. These have a physical barrier between you and car traffic — usually parked cars, posts, or a curb. The most comfortable lanes in the city. Stay to the right, pass on the left, and watch for pedestrians stepping into the lane at crossings.

### Painted bike lanes

Marked with white lines and bike symbols on the road surface. Cars aren't supposed to be in them, but doors from parked cars can swing open. Ride toward the left side of the lane — far enough from parked cars that an opening door won't reach you. Cyclists call this the "door zone," and avoiding it becomes second nature fast.

### Green paint

Marks areas where bikes and cars are likely to cross paths — intersections, merge zones, driveways. It's a heads-up, not a hazard. Just keep your line and make eye contact with turning drivers when you can.

### Sharrows

Shared lane arrows, the ones with the chevrons. They mean you share the lane with cars. You're allowed to take the full lane — ride in the center so cars pass you safely by changing lanes rather than squeezing by.

### The one habit that matters most

Look behind you before changing your position in the lane. A quick shoulder check before moving left to pass or avoid something — it's the cycling equivalent of checking your mirror.$guidebody$,
    'cycling',
    'safety',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library', 'roam_leg']::text[],
    ARRAY['safety', 'getting-started', 'infrastructure']::text[],
    ARRAY['mg_low_stress_routes', 'mg_bike_commute_gear']::text[],
    true,
    2,
    timezone('America/New_York', '2026-05-08 12:00'::timestamp)
  ),
  (
    'mg_bike_commute_gear',
    'The gear that actually matters for bike commuting',
    'bike-commute-gear',
    'What''s worth spending on for daily bike commuting, what isn''t, and which two purchases matter most.',
    $guidebody$You don't need much equipment to bike-commute, but a few things make the difference between a good ride and a frustrating one. Here's what's worth investing in.

### 1. A helmet — non-negotiable.

A $40 helmet protects you about as well as a $200 one, but the kind of safety tech matters more than the price tag. Look for two things on the label: **MIPS** (a slip-plane layer that reduces rotational forces in a crash) and a rating from the **Virginia Tech Helmet Lab**, which independently star-rates helmets from 1 to 5. A 4- or 5-star MIPS helmet is plenty for daily commuting. Replace it after any crash, even if it looks fine.

### 2. Lights, front and rear.

Lights are the single biggest thing you can do for safety. Most crashes happen because a driver didn't see the cyclist, and visibility is most of the fix. Look for at least 200 lumens on the front, a steady-and-flash pattern on the back, and run them even during the day.

### 3. A real lock.

Cable locks get cut in seconds. A solid U-lock from Kryptonite or Abus runs $30-60 and pays for itself the first time you don't lose your bike.

### 4. A way to carry stuff.

This is the gear question that's most underestimated.

- **Backpack** — fine for short rides, but it'll make your back sweaty.
- **Messenger bag** — better airflow than a backpack, decent capacity.
- **Panniers** (bags that mount on a rear rack) — the most comfortable for daily commutes. Your back stays dry and you can carry a real load. Get waterproof ones or use rain covers; Boston rain is real.
- **Basket** — old-school, perfect for grocery runs.

### 5. Fenders if you ride in any weather.

A $25 fender set keeps a stripe of road grime off your back and pants. The single best rain-season investment.

### Try this first

If you only buy two things, make them lights and a U-lock. Everything else can wait until you know what you actually need.$guidebody$,
    $guidebody$You don't need much equipment to bike-commute, but a few things make the difference between a good ride and a frustrating one. Here's what's worth investing in.

### 1. A helmet — non-negotiable.

A $40 helmet protects you about as well as a $200 one, but the kind of safety tech matters more than the price tag. Look for two things on the label: **MIPS** (a slip-plane layer that reduces rotational forces in a crash) and a rating from the **Virginia Tech Helmet Lab**, which independently star-rates helmets from 1 to 5. A 4- or 5-star MIPS helmet is plenty for daily commuting. Replace it after any crash, even if it looks fine.

### 2. Lights, front and rear.

Lights are the single biggest thing you can do for safety. Most crashes happen because a driver didn't see the cyclist, and visibility is most of the fix. Look for at least 200 lumens on the front, a steady-and-flash pattern on the back, and run them even during the day.

### 3. A real lock.

Cable locks get cut in seconds. A solid U-lock from Kryptonite or Abus runs $30-60 and pays for itself the first time you don't lose your bike.

### 4. A way to carry stuff.

This is the gear question that's most underestimated.

- **Backpack** — fine for short rides, but it'll make your back sweaty.
- **Messenger bag** — better airflow than a backpack, decent capacity.
- **Panniers** (bags that mount on a rear rack) — the most comfortable for daily commutes. Your back stays dry and you can carry a real load. Get waterproof ones or use rain covers; Boston rain is real.
- **Basket** — old-school, perfect for grocery runs.

### 5. Fenders if you ride in any weather.

A $25 fender set keeps a stripe of road grime off your back and pants. The single best rain-season investment.

### Try this first

If you only buy two things, make them lights and a U-lock. Everything else can wait until you know what you actually need.$guidebody$,
    'cycling',
    'gear',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['gear', 'getting-started', 'safety']::text[],
    ARRAY['mg_bike_lock', 'mg_bike_sweat', 'mg_biking_in_rain']::text[],
    true,
    2,
    timezone('America/New_York', '2026-10-01 12:00'::timestamp)
  ),
  (
    'mg_bike_time',
    'When biking is actually the faster option',
    'when-biking-is-faster',
    'Door-to-door, biking beats driving for more trips than people expect. The five situations where it definitely wins.',
    $guidebody$Biking is faster than driving for more trips than people expect — once you count door-to-door time. Here's when it actually wins.

### 1. Trips under three miles, especially in dense neighborhoods.

Short urban trips on a bike are usually 15-25 minutes door-to-door. The same trip by car, including parking-search time, often comes out about the same — sometimes longer. The "driving is faster" intuition is mostly built on suburban-style trips, not city ones.

### 2. Anywhere parking is hard.

Cambridge, Somerville, the Seaport, downtown Boston, anywhere near a hospital or a college — parking can take 5-15 minutes plus a walk from where you ended up. Biking puts you at the door.

### 3. Rush hour, on protected infrastructure.

When traffic crawls, signal-independent routes — the Charles River paths, the Minuteman, the Southwest Corridor — keep moving at the same speed they always do. Predictable arrival times are part of why people bike-commute even when driving is an option.

### 4. Longer trips, on an e-bike.

A 5-7 mile commute that's a slow slog on a regular bike is a comfortable 20-25 minute ride on an e-bike, with little exertion. E-bikes extend the range where biking competes with driving on time, often well past five miles.

### 5. Errands and trips with kids — on an e-cargo bike.

An e-cargo bike (a long-tail or front-bucket frame with pedal-assist) can carry two kids plus a week of groceries, and uses bike infrastructure that skips the school-pickup line entirely. It handles most of what people assume requires a car. You don't have to buy one to find out: [CargoB](https://www.ridecargob.com/) rents cargo bikes by the minute around the region, and [Community Pedal Power](https://communitypedalpower.org/) in Cambridge runs an e-bike library where you can borrow one for free.$guidebody$,
    $guidebody$Biking is faster than driving for more trips than people expect — once you count door-to-door time. Here's when it actually wins.

### 1. Trips under three miles, especially in dense neighborhoods.

Short urban trips on a bike are usually 15-25 minutes door-to-door. The same trip by car, including parking-search time, often comes out about the same — sometimes longer. The "driving is faster" intuition is mostly built on suburban-style trips, not city ones.

### 2. Anywhere parking is hard.

Cambridge, Somerville, the Seaport, downtown Boston, anywhere near a hospital or a college — parking can take 5-15 minutes plus a walk from where you ended up. Biking puts you at the door.

### 3. Rush hour, on protected infrastructure.

When traffic crawls, signal-independent routes — the Charles River paths, the Minuteman, the Southwest Corridor — keep moving at the same speed they always do. Predictable arrival times are part of why people bike-commute even when driving is an option.

### 4. Longer trips, on an e-bike.

A 5-7 mile commute that's a slow slog on a regular bike is a comfortable 20-25 minute ride on an e-bike, with little exertion. E-bikes extend the range where biking competes with driving on time, often well past five miles.

### 5. Errands and trips with kids — on an e-cargo bike.

An e-cargo bike (a long-tail or front-bucket frame with pedal-assist) can carry two kids plus a week of groceries, and uses bike infrastructure that skips the school-pickup line entirely. It handles most of what people assume requires a car. You don't have to buy one to find out: [CargoB](https://www.ridecargob.com/) rents cargo bikes by the minute around the region, and [Community Pedal Power](https://communitypedalpower.org/) in Cambridge runs an e-bike library where you can borrow one for free.$guidebody$,
    'cycling',
    'time',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['motivation', 'e-bikes', 'short-trips']::text[],
    ARRAY['mg_low_stress_routes', 'mg_cargo_bike', 'mg_bike_commute_gear']::text[],
    false,
    2,
    timezone('America/New_York', '2026-05-08 12:00'::timestamp)
  ),
  (
    'mg_bike_sweat',
    'How to bike-commute without breaking a sweat',
    'bike-commute-without-sweat',
    'Pace, route, gear, and the desk-side kit that makes August humidity manageable on a bike.',
    $guidebody$Worrying about arriving sweaty stops a lot of people from biking to work. There are several layers of fix, and the most effective one doesn't involve any extra gear at all.

### 1. The simplest fix: sweat less to begin with.

An e-bike does most of the work for you — you'll arrive at a 5-mile destination feeling about the same as after a 1-mile walk. Bluebikes has a growing fleet of e-bikes, and with a Monthly or Annual membership the rate drops to $0.10/min on top of the membership — affordable for daily commute use.

### 2. Pace yourself on a regular bike.

You control the pace. Riding at "conversation pace" — slow enough you could chat with someone alongside you — generates very little sweat, even on warm days. The few extra minutes is less time than the cool-down you'd otherwise need.

### 3. Pick a flatter route.

A 200-foot climb makes a real difference in sweat output. Google Maps' cycling layer shows elevation; a route that's a half-mile longer is often far cooler if it avoids a hill.

### 4. Wear the right stuff for the ride.

You don't need cycling-specific clothes, but a few choices help:

- **Synthetic or wool layers wick sweat better than cotton.** Cotton holds moisture and stays heavy.
- **For longer rides, ride in athletic clothes and change at your destination.** Pack work clothes the night before, or keep a few days' worth at the office.
- **A breathable layer beats a heavy coat, even in cold weather.** You'll warm up fast on the bike.

### 5. Build an arrival kit.

Keep these at your desk and the issue mostly disappears: deodorant, athletic body wipes (Action Wipes is one well-known option — make sure you're getting wipes designed for the gym, not bathroom wipes), a spare shirt, a small towel. Many workplaces also have showers or a fitness center; ask facilities.

### 6. Plan around the worst days.

August humidity is real. On the worst handful of days, take the T or work from home. Keeping the streak intact for everything else matters more than perfection.$guidebody$,
    $guidebody$Worrying about arriving sweaty stops a lot of people from biking to work. There are several layers of fix, and the most effective one doesn't involve any extra gear at all.

### 1. The simplest fix: sweat less to begin with.

An e-bike does most of the work for you — you'll arrive at a 5-mile destination feeling about the same as after a 1-mile walk. Bluebikes has a growing fleet of e-bikes, and with a Monthly or Annual membership the rate drops to {{price:bluebikes.ebikePerMinMember}}/min on top of the membership — affordable for daily commute use.

### 2. Pace yourself on a regular bike.

You control the pace. Riding at "conversation pace" — slow enough you could chat with someone alongside you — generates very little sweat, even on warm days. The few extra minutes is less time than the cool-down you'd otherwise need.

### 3. Pick a flatter route.

A 200-foot climb makes a real difference in sweat output. Google Maps' cycling layer shows elevation; a route that's a half-mile longer is often far cooler if it avoids a hill.

### 4. Wear the right stuff for the ride.

You don't need cycling-specific clothes, but a few choices help:

- **Synthetic or wool layers wick sweat better than cotton.** Cotton holds moisture and stays heavy.
- **For longer rides, ride in athletic clothes and change at your destination.** Pack work clothes the night before, or keep a few days' worth at the office.
- **A breathable layer beats a heavy coat, even in cold weather.** You'll warm up fast on the bike.

### 5. Build an arrival kit.

Keep these at your desk and the issue mostly disappears: deodorant, athletic body wipes (Action Wipes is one well-known option — make sure you're getting wipes designed for the gym, not bathroom wipes), a spare shirt, a small towel. Many workplaces also have showers or a fitness center; ask facilities.

### 6. Plan around the worst days.

August humidity is real. On the worst handful of days, take the T or work from home. Keeping the streak intact for everything else matters more than perfection.$guidebody$,
    'cycling',
    'sweating',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['gear', 'e-bikes', 'getting-started']::text[],
    ARRAY['mg_bike_commute_gear', 'mg_cargo_bike']::text[],
    false,
    2,
    timezone('America/New_York', '2026-05-08 12:00'::timestamp)
  ),
  (
    'mg_cargo_bike',
    'What you can do with an e-cargo bike',
    'what-you-can-do-with-an-e-cargo-bike',
    'An e-cargo bike replaces most car trips a family makes in a week. What they handle, and where to try one before buying.',
    $guidebody$An e-cargo bike is a regular bike with two changes: a longer or wider frame for carrying things, and a pedal-assist motor that helps with hills and loads. People who try one find it covers most of the trips they'd assumed required a car — daycare drop-off, the weekly grocery run, hardware store hauls, beach day, the occasional Costco trip.

### The main types

- **Long-tail** (Tern GSD, Yuba Spicy Curry, RadWagon): A standard frame stretched to fit two kids on the back rack, plus panniers below. Most popular for family use.
- **Front-bucket** (Urban Arrow, Bullitt, Riese & Müller Load): A box in front of the rider; kids face you. Excellent for cargo and very young children.
- **Midtail** (Tern HSD, Specialized Globe Haul): Smaller and easier to park than a long-tail. One kid plus groceries.

### What they handle

- 100+ pound loads (kids and groceries) without strain
- Hills that would be punishing on a regular bike
- 30-50 mile range on a charge
- Most short-to-medium errands more pleasantly than driving them, since you skip parking

### How to try one without buying

- **[Community Pedal Power](https://communitypedalpower.org/)** (Cambridge) runs a free e-bike library — borrow one for a weekend.
- **[CargoB](https://www.ridecargob.com/)** rents e-cargo bikes by the minute around Greater Boston.
- Most local bike shops do test rides; some run demo days.

### A few practical realities

- **Parking:** Long-tails and front-bucket bikes don't fit in standard bike racks. Plan for street parking with a heavy lock, or look for bike corrals.
- **Range:** A typical day uses 10-30% of the battery. Most people charge once or twice a week.
- **Price:** New e-cargo bikes run $3,000-$8,000. The used market is solid; bike libraries and rentals are how most people figure out which type fits before buying.

### Try this first

Borrow one from Community Pedal Power for a weekend. Use it for one school pickup and one grocery run. You'll know quickly whether it fits your life.$guidebody$,
    $guidebody$An e-cargo bike is a regular bike with two changes: a longer or wider frame for carrying things, and a pedal-assist motor that helps with hills and loads. People who try one find it covers most of the trips they'd assumed required a car — daycare drop-off, the weekly grocery run, hardware store hauls, beach day, the occasional Costco trip.

### The main types

- **Long-tail** (Tern GSD, Yuba Spicy Curry, RadWagon): A standard frame stretched to fit two kids on the back rack, plus panniers below. Most popular for family use.
- **Front-bucket** (Urban Arrow, Bullitt, Riese & Müller Load): A box in front of the rider; kids face you. Excellent for cargo and very young children.
- **Midtail** (Tern HSD, Specialized Globe Haul): Smaller and easier to park than a long-tail. One kid plus groceries.

### What they handle

- 100+ pound loads (kids and groceries) without strain
- Hills that would be punishing on a regular bike
- 30-50 mile range on a charge
- Most short-to-medium errands more pleasantly than driving them, since you skip parking

### How to try one without buying

- **[Community Pedal Power](https://communitypedalpower.org/)** (Cambridge) runs a free e-bike library — borrow one for a weekend.
- **[CargoB](https://www.ridecargob.com/)** rents e-cargo bikes by the minute around Greater Boston.
- Most local bike shops do test rides; some run demo days.

### A few practical realities

- **Parking:** Long-tails and front-bucket bikes don't fit in standard bike racks. Plan for street parking with a heavy lock, or look for bike corrals.
- **Range:** A typical day uses 10-30% of the battery. Most people charge once or twice a week.
- **Price:** New e-cargo bikes run $3,000-$8,000. The used market is solid; bike libraries and rentals are how most people figure out which type fits before buying.

### Try this first

Borrow one from Community Pedal Power for a weekend. Use it for one school pickup and one grocery run. You'll know quickly whether it fits your life.$guidebody$,
    'cycling',
    NULL,
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['e-bikes', 'cargo', 'family', 'getting-started']::text[],
    ARRAY['mg_bike_sweat', 'mg_bike_commute_gear', 'mg_bike_time', 'mg_walking_carrying']::text[],
    false,
    2,
    timezone('America/New_York', '2026-05-08 12:00'::timestamp)
  ),
  (
    'mg_bluebikes',
    'Bluebikes from start to finish',
    'how-to-use-bluebikes',
    'How to unlock, ride, dock, and avoid surprise charges with Greater Boston''s bike-share. First-trip jitters, sorted.',
    $guidebody$Bluebikes is Greater Boston's bike-share system, with nearly 600 stations in 13 cities and towns, including Boston, Brookline, Cambridge, Somerville, Everett, Chelsea and Revere. Once you've used it once, it's simple. Here's everything you need for the first time.

### Getting started

1. [Download the **Bluebikes app**](https://bluebikes.com/how-it-works/get-the-app) (iOS/Android), create an account, add a payment method.
2. Open the app to see nearby stations and live availability. Green means bikes are available.
3. Tap "Unlock," scan the QR code on any available bike at the station. The lock releases.

### Pricing options

- **Single trip:** $3.00 for 30 minutes (e-bikes +$0.33/min on top).
- **Day Pass:** $11.99 for unlimited 2-hour rides that day.
- **Membership:** $30.50/month or $133.50/year (or $11.13/month on the annual plan). Unlimited 45-minute rides, e-bikes at $0.10/min.
- **Income Eligible:** Available based on residence — 60-minute rides and the cheapest e-bike rate ($0.07/min). Worth checking if you qualify.
- Helmet not provided. Bring your own or check if your workplace has loaners.

### Returning

Roll the front wheel firmly into an empty dock until you hear a click and see the green light. **Always tug-test** — pull the bike backward gently to confirm it's locked. The most common docking issue is not pushing firmly enough; give it real force.

### If you might run over your ride time

Dock at any station along the way, wait a minute, and undock a new bike. The clock resets. No penalty for swapping mid-trip.

### If something goes wrong

- **Station full?** The app shows real-time dock availability — there's almost always one within a block or two.
- **App still shows your ride active after docking?** Take a screenshot of the green light. Contact Bluebikes through the app; they resolve these quickly and won't charge you for a properly returned bike.$guidebody$,
    $guidebody$Bluebikes is Greater Boston's bike-share system, with nearly 600 stations in 13 cities and towns, including Boston, Brookline, Cambridge, Somerville, Everett, Chelsea and Revere. Once you've used it once, it's simple. Here's everything you need for the first time.

### Getting started

1. [Download the **Bluebikes app**](https://bluebikes.com/how-it-works/get-the-app) (iOS/Android), create an account, add a payment method.
2. Open the app to see nearby stations and live availability. Green means bikes are available.
3. Tap "Unlock," scan the QR code on any available bike at the station. The lock releases.

### Pricing options

- **Single trip:** {{price:bluebikes.singleRide|cents}} for 30 minutes (e-bikes +{{price:bluebikes.ebikePerMinNonMember}}/min on top).
- **Day Pass:** {{price:bluebikes.dayPass}} for unlimited 2-hour rides that day.
- **Membership:** {{price:bluebikes.monthly}}/month or {{price:bluebikes.annual}}/year (or {{price:bluebikes.annualPerMonth}}/month on the annual plan). Unlimited 45-minute rides, e-bikes at {{price:bluebikes.ebikePerMinMember}}/min.
- **Income Eligible:** Available based on residence — 60-minute rides and the cheapest e-bike rate ({{price:bluebikes.ebikePerMinIncomeEligible}}/min). Worth checking if you qualify.
- Helmet not provided. Bring your own or check if your workplace has loaners.

### Returning

Roll the front wheel firmly into an empty dock until you hear a click and see the green light. **Always tug-test** — pull the bike backward gently to confirm it's locked. The most common docking issue is not pushing firmly enough; give it real force.

### If you might run over your ride time

Dock at any station along the way, wait a minute, and undock a new bike. The clock resets. No penalty for swapping mid-trip.

### If something goes wrong

- **Station full?** The app shows real-time dock availability — there's almost always one within a block or two.
- **App still shows your ride active after docking?** Take a screenshot of the green light. Contact Bluebikes through the app; they resolve these quickly and won't charge you for a properly returned bike.$guidebody$,
    'cycling',
    NULL,
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library', 'nudge_card', 'roam_leg']::text[],
    ARRAY['bike-share', 'getting-started']::text[],
    ARRAY['mg_bike_lock', 'mg_low_stress_routes']::text[],
    false,
    2,
    timezone('America/New_York', '2026-10-17 12:00'::timestamp)
  ),
  (
    'mg_bike_lock',
    'Where (and how) to lock your bike',
    'where-to-lock-your-bike',
    'Most stolen bikes weren''t unlocked — they were locked badly. Six rules that make the difference.',
    $guidebody$A good lock is only as good as how and where you use it. Most stolen bikes weren't unlocked — they were locked badly, or locked to something that didn't actually hold. Here's what works.

### 1. Lock the frame, not just the wheel.

Your U-lock should go through the bike frame and around the rack. Wheels can be removed in seconds; if you only secured a wheel, you've left the rest of the bike loose.

### 2. Use both wheels with two locks.

A U-lock on the frame plus a cable through the front wheel keeps both wheels with the bike. Cable locks alone aren't worth using — bolt cutters go through them in seconds.

### 3. Fill the U-lock space.

A U-lock with empty space inside the U is easier to leverage open. Pack it tight against the rack and frame so there's no room for a tool to fit.

### 4. Lock to something solid.

Look for inverted-U or post-and-ring bike racks, or solid metal sign posts. Avoid wooden posts (cuttable), thin poles (a thief can lift the bike over the top), and anything not anchored to the ground. Trees are a no — both because the lock can damage the tree and because trees are often less sturdy than they look.

### 5. When indoors is an option, take it.

If your workplace has indoor bike parking, use it. Many MBTA stations have secure bike cages that require a CharlieCard for access. Cambridge and Somerville also have plenty of street-level racks; check Google Maps for "bike parking" near your destination.

### 6. Register and track.

Register your bike at [bikeindex.org](https://bikeindex.org) (free, helps recovery if it's stolen) and take a photo of the serial number. Hide an AirTag or Tile tracker somewhere discreet — taped under the saddle, dropped inside the seat tube, or tucked into a tail-light housing. If the bike walks off, you can find it. Remove lights and quick-release accessories when you park.$guidebody$,
    $guidebody$A good lock is only as good as how and where you use it. Most stolen bikes weren't unlocked — they were locked badly, or locked to something that didn't actually hold. Here's what works.

### 1. Lock the frame, not just the wheel.

Your U-lock should go through the bike frame and around the rack. Wheels can be removed in seconds; if you only secured a wheel, you've left the rest of the bike loose.

### 2. Use both wheels with two locks.

A U-lock on the frame plus a cable through the front wheel keeps both wheels with the bike. Cable locks alone aren't worth using — bolt cutters go through them in seconds.

### 3. Fill the U-lock space.

A U-lock with empty space inside the U is easier to leverage open. Pack it tight against the rack and frame so there's no room for a tool to fit.

### 4. Lock to something solid.

Look for inverted-U or post-and-ring bike racks, or solid metal sign posts. Avoid wooden posts (cuttable), thin poles (a thief can lift the bike over the top), and anything not anchored to the ground. Trees are a no — both because the lock can damage the tree and because trees are often less sturdy than they look.

### 5. When indoors is an option, take it.

If your workplace has indoor bike parking, use it. Many MBTA stations have secure bike cages that require a CharlieCard for access. Cambridge and Somerville also have plenty of street-level racks; check Google Maps for "bike parking" near your destination.

### 6. Register and track.

Register your bike at [bikeindex.org](https://bikeindex.org) (free, helps recovery if it's stolen) and take a photo of the serial number. Hide an AirTag or Tile tracker somewhere discreet — taped under the saddle, dropped inside the seat tube, or tucked into a tail-light housing. If the bike walks off, you can find it. Remove lights and quick-release accessories when you park.$guidebody$,
    'cycling',
    'bike_parking',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['parking', 'security', 'gear']::text[],
    ARRAY['mg_bike_commute_gear', 'mg_bluebikes']::text[],
    false,
    2,
    timezone('America/New_York', '2026-10-01 12:00'::timestamp)
  ),
  (
    'mg_biking_in_rain',
    'Biking in the rain',
    'biking-in-the-rain',
    'Light rain stops feeling like a barrier after the third or fourth time. The minimal gear that gets you there fast.',
    $guidebody$Rain stops a lot of would-be bike commuters, but with minimal gear it's manageable — and once you've done it a few times, light rain stops feeling like a barrier at all.

### 1. Fenders are the single best investment.

A $25-30 fender set keeps a stripe of road grime off your back and pants. This matters more than a rain jacket, because road spray gets you wetter and dirtier than the rain itself does.

### 2. Any waterproof shell works.

You don't need a bike-specific rain jacket — any waterproof or water-resistant shell with pit zips or vents will do. Heavy rain calls for rain pants too, but for typical commute rain a jacket and fenders cover it.

### 3. Keep your stuff dry.

Use a waterproof pannier or a backpack cover. A trash bag inside a regular backpack works in a pinch.

### 4. Adjust how you ride.

Wet roads are slipperier than they look:

- **Slow down,** especially on painted lines, metal grates, and manhole covers — those are the slickest surfaces.
- **Brake earlier.** Wet rims need more stopping distance.
- **Watch the first 15 minutes.** Oil and grime get pulled to the road surface when rain starts. That's the slipperiest window.
- **Avoid standing puddles.** They can hide potholes.

### 5. Be more visible than usual.

Lights on, even during the day. Bright or reflective layers help drivers see you sooner in low-contrast conditions.

### One last thing

Most "rain rides" are light drizzle or brief showers. Truly heavy rain during commute hours is rare, and even when you get wet, you dry off. People who try it a few times often find light rain pleasant — less traffic, cooler air, a small sense of accomplishment that brightens the day.$guidebody$,
    $guidebody$Rain stops a lot of would-be bike commuters, but with minimal gear it's manageable — and once you've done it a few times, light rain stops feeling like a barrier at all.

### 1. Fenders are the single best investment.

A $25-30 fender set keeps a stripe of road grime off your back and pants. This matters more than a rain jacket, because road spray gets you wetter and dirtier than the rain itself does.

### 2. Any waterproof shell works.

You don't need a bike-specific rain jacket — any waterproof or water-resistant shell with pit zips or vents will do. Heavy rain calls for rain pants too, but for typical commute rain a jacket and fenders cover it.

### 3. Keep your stuff dry.

Use a waterproof pannier or a backpack cover. A trash bag inside a regular backpack works in a pinch.

### 4. Adjust how you ride.

Wet roads are slipperier than they look:

- **Slow down,** especially on painted lines, metal grates, and manhole covers — those are the slickest surfaces.
- **Brake earlier.** Wet rims need more stopping distance.
- **Watch the first 15 minutes.** Oil and grime get pulled to the road surface when rain starts. That's the slipperiest window.
- **Avoid standing puddles.** They can hide potholes.

### 5. Be more visible than usual.

Lights on, even during the day. Bright or reflective layers help drivers see you sooner in low-contrast conditions.

### One last thing

Most "rain rides" are light drizzle or brief showers. Truly heavy rain during commute hours is rare, and even when you get wet, you dry off. People who try it a few times often find light rain pleasant — less traffic, cooler air, a small sense of accomplishment that brightens the day.$guidebody$,
    'cycling',
    'weather',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['weather', 'gear', 'year-round']::text[],
    ARRAY['mg_cold_weather', 'mg_boston_winter', 'mg_bike_commute_gear']::text[],
    false,
    2,
    timezone('America/New_York', '2026-10-01 12:00'::timestamp)
  ),
  (
    'mg_cold_weather',
    'Cold-weather biking',
    'cold-weather-biking',
    'Dress for the riding body, not the standing-still body. Layering, hands and feet, and what matters most below freezing.',
    $guidebody$Cold-weather cycling is more comfortable than most people expect. Your body generates real heat while riding — the trick is dressing for that, not for standing still.

### 1. Dress for 15°F warmer than it is.

This is the single most important rule. If you dress to feel comfortable standing outside, you'll overheat within five minutes of riding. Aim for "slightly cool at the start." You'll warm up fast.

### 2. Layer in three parts.

- **Base:** Synthetic or wool, not cotton. Keeps sweat off your skin.
- **Mid:** Insulating layer — a fleece or wool sweater works.
- **Outer:** Wind-blocking shell. Wind protection matters more than insulation; you generate the heat, the shell traps it.

### 3. Hands and feet first.

These get cold fastest and ruin a ride quickest. Good gloves and warm socks are the highest-leverage upgrades.

- Below 30°F: insulated gloves, wool socks.
- Below 20°F: bar mitts (handlebar-mounted insulated covers) and insulated shoe covers or winter boots. Bar mitts in particular make a huge difference if you ride year-round.

### 4. Cover your face on the cold days.

A buff or neck gaiter pulled up over your nose and cheeks dramatically extends your comfort range. A lot of people skip this and regret it below 25°F.

### 5. Account for the season's other realities.

- **Lights are essential** — shorter days mean a lot of commutes happen in the dark.
- **Lower tire pressure slightly** for better grip on cold or icy patches.
- **Keep your chain lubed.** Winter grime wears drivetrain parts faster than summer riding does.

### One last thing

Winter biking has real advantages once you're set up: lighter traffic, no overheating, and you arrive energized.$guidebody$,
    $guidebody$Cold-weather cycling is more comfortable than most people expect. Your body generates real heat while riding — the trick is dressing for that, not for standing still.

### 1. Dress for 15°F warmer than it is.

This is the single most important rule. If you dress to feel comfortable standing outside, you'll overheat within five minutes of riding. Aim for "slightly cool at the start." You'll warm up fast.

### 2. Layer in three parts.

- **Base:** Synthetic or wool, not cotton. Keeps sweat off your skin.
- **Mid:** Insulating layer — a fleece or wool sweater works.
- **Outer:** Wind-blocking shell. Wind protection matters more than insulation; you generate the heat, the shell traps it.

### 3. Hands and feet first.

These get cold fastest and ruin a ride quickest. Good gloves and warm socks are the highest-leverage upgrades.

- Below 30°F: insulated gloves, wool socks.
- Below 20°F: bar mitts (handlebar-mounted insulated covers) and insulated shoe covers or winter boots. Bar mitts in particular make a huge difference if you ride year-round.

### 4. Cover your face on the cold days.

A buff or neck gaiter pulled up over your nose and cheeks dramatically extends your comfort range. A lot of people skip this and regret it below 25°F.

### 5. Account for the season's other realities.

- **Lights are essential** — shorter days mean a lot of commutes happen in the dark.
- **Lower tire pressure slightly** for better grip on cold or icy patches.
- **Keep your chain lubed.** Winter grime wears drivetrain parts faster than summer riding does.

### One last thing

Winter biking has real advantages once you're set up: lighter traffic, no overheating, and you arrive energized.$guidebody$,
    'cycling',
    'weather',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['weather', 'gear', 'year-round']::text[],
    ARRAY['mg_boston_winter', 'mg_biking_in_rain', 'mg_bike_commute_gear']::text[],
    false,
    2,
    timezone('America/New_York', '2026-10-01 12:00'::timestamp)
  ),
  (
    'mg_boston_winter',
    'Biking through a Boston winter: Boston, Cambridge and Somerville',
    'biking-through-a-boston-winter',
    'Plenty of people around here ride straight through to spring. Where local riders share real-time conditions, how Bluebikes runs in winter, routes to start on in Boston, Cambridge and Somerville, and the gear that makes it comfortable.',
    $guidebody$Riding through a winter in Boston, Cambridge or Somerville is more ordinary than it sounds. Plenty of people who bike here in summer keep going right through to spring, and they get quiet streets, crisp air, and an arrival that feels earned. Here's what makes it work around here specifically.

### Join the riders who report conditions in real time.

After a storm, conditions change street by street and day by day: one bike lane is clear by morning, the next stays packed with snow for a while. The best way to know before you leave is to hear from people who rode it an hour ago.

- **[r/bikeboston](https://www.reddit.com/r/bikeboston/)** is the go-to local bike forum. After a snowfall, riders post which lanes and paths are clear and which to skip.
- **Neighborhood Discord and WhatsApp groups**, often run by local bike groups and commuter crews, trade quick updates about specific streets and bridges. Ask on r/bikeboston or at a local bike shop which ones cover your route.

Post what you see on your own ride, too. Every report makes the next person's morning easier.

If a bike lane on your route stays buried, report it to your city: **Boston** through 311 (call, or the BOS:311 app), and **Cambridge** and **Somerville** through their own service-request lines and apps. Reports point crews to the spots riders need most.

### Bluebikes runs all winter.

Bluebikes is open 24 hours a day, every day of the year, across Boston, Cambridge, Somerville and the rest of its network. Most stations stay in place all winter. Starting in October, a handful of on-street stations come out for the season so plows can get through, so check the station map in the app before you head out — your usual dock may have a winter neighbor a block away.

Bluebikes is also an easy way to try a winter ride before committing your own bike to the salt.

### Start on paths and quiet streets.

Your first few winter rides go best on routes with fewer cars and more room. Check the latest rider reports first, then try one of these on a clear day:

**Boston.** The City of Boston points winter riders to the **Southwest Corridor** through Jamaica Plain, Roxbury and the South End, the **Harborwalk** along the waterfront, the **Neponset River Greenway** in Mattapan and Dorchester, and the **paths along the Charles River**.

**Cambridge.** The **Linear Path** from Davis Square to Alewife, the **[Fresh Pond loop](/shift/roams/fresh-pond-loop)**, and the Cambridge side of the **Charles River paths**.

**Somerville.** The **[Community Path](/shift/roams/community-path)**, which runs from Davis Square east toward Lechmere and links up with the Linear Path toward Alewife and the Minuteman.

For more routes and local options, see our town pages for [Boston](/shift/towns/boston-ma), [Cambridge](/shift/towns/cambridge-ma) and [Somerville](/shift/towns/somerville-ma).

Ride a slower, steadier pace than you would in July, and give yourself a few short trips to learn how your bike feels on cold pavement.

### Dress for the ride, and the rest follows.

Your body makes plenty of heat once you're moving, so dress to feel slightly cool when you step outside. Our [cold-weather biking guide](/guides/cold-weather-biking) covers layering, hands and feet, and the gear that matters most below freezing. Our [rain guide](/guides/biking-in-the-rain) covers fenders and staying dry on the wet days, which a New England winter has plenty of.

### Watch for the shiny patches.

Below freezing, a thin film of water can turn to black ice. Treat shiny pavement, painted lines and metal plates as slow zones, brake early and gently, and keep your tire pressure a little lower than usual for grip. Lights front and back, every ride — the short days mean most winter commutes happen at least partly in the dark.

### Mix and match on the stormiest days.

Winter riders here use the whole toolkit. On a heavy-snow morning, the T, a bus, or a walk ([our guide to walking through the weather](/guides/walking-through-the-weather)) gets you there, and the bike is ready again once riders report your route clear. Choosing the best mode for the day is part of what makes year-round riding easy to keep up.

### One last thing

Winter is when bike shops are quietest, so it's a great time for a tune-up — and our [events calendar](/events) lists free repair clinics around Greater Boston. A bike that shifts and stops cleanly makes every cold ride more pleasant.$guidebody$,
    $guidebody$Riding through a winter in Boston, Cambridge or Somerville is more ordinary than it sounds. Plenty of people who bike here in summer keep going right through to spring, and they get quiet streets, crisp air, and an arrival that feels earned. Here's what makes it work around here specifically.

### Join the riders who report conditions in real time.

After a storm, conditions change street by street and day by day: one bike lane is clear by morning, the next stays packed with snow for a while. The best way to know before you leave is to hear from people who rode it an hour ago.

- **[r/bikeboston](https://www.reddit.com/r/bikeboston/)** is the go-to local bike forum. After a snowfall, riders post which lanes and paths are clear and which to skip.
- **Neighborhood Discord and WhatsApp groups**, often run by local bike groups and commuter crews, trade quick updates about specific streets and bridges. Ask on r/bikeboston or at a local bike shop which ones cover your route.

Post what you see on your own ride, too. Every report makes the next person's morning easier.

If a bike lane on your route stays buried, report it to your city: **Boston** through 311 (call, or the BOS:311 app), and **Cambridge** and **Somerville** through their own service-request lines and apps. Reports point crews to the spots riders need most.

### Bluebikes runs all winter.

Bluebikes is open 24 hours a day, every day of the year, across Boston, Cambridge, Somerville and the rest of its network. Most stations stay in place all winter. Starting in October, a handful of on-street stations come out for the season so plows can get through, so check the station map in the app before you head out — your usual dock may have a winter neighbor a block away.

Bluebikes is also an easy way to try a winter ride before committing your own bike to the salt.

### Start on paths and quiet streets.

Your first few winter rides go best on routes with fewer cars and more room. Check the latest rider reports first, then try one of these on a clear day:

**Boston.** The City of Boston points winter riders to the **Southwest Corridor** through Jamaica Plain, Roxbury and the South End, the **Harborwalk** along the waterfront, the **Neponset River Greenway** in Mattapan and Dorchester, and the **paths along the Charles River**.

**Cambridge.** The **Linear Path** from Davis Square to Alewife, the **[Fresh Pond loop](/shift/roams/fresh-pond-loop)**, and the Cambridge side of the **Charles River paths**.

**Somerville.** The **[Community Path](/shift/roams/community-path)**, which runs from Davis Square east toward Lechmere and links up with the Linear Path toward Alewife and the Minuteman.

For more routes and local options, see our town pages for [Boston](/shift/towns/boston-ma), [Cambridge](/shift/towns/cambridge-ma) and [Somerville](/shift/towns/somerville-ma).

Ride a slower, steadier pace than you would in July, and give yourself a few short trips to learn how your bike feels on cold pavement.

### Dress for the ride, and the rest follows.

Your body makes plenty of heat once you're moving, so dress to feel slightly cool when you step outside. Our [cold-weather biking guide](/guides/cold-weather-biking) covers layering, hands and feet, and the gear that matters most below freezing. Our [rain guide](/guides/biking-in-the-rain) covers fenders and staying dry on the wet days, which a New England winter has plenty of.

### Watch for the shiny patches.

Below freezing, a thin film of water can turn to black ice. Treat shiny pavement, painted lines and metal plates as slow zones, brake early and gently, and keep your tire pressure a little lower than usual for grip. Lights front and back, every ride — the short days mean most winter commutes happen at least partly in the dark.

### Mix and match on the stormiest days.

Winter riders here use the whole toolkit. On a heavy-snow morning, the T, a bus, or a walk ([our guide to walking through the weather](/guides/walking-through-the-weather)) gets you there, and the bike is ready again once riders report your route clear. Choosing the best mode for the day is part of what makes year-round riding easy to keep up.

### One last thing

Winter is when bike shops are quietest, so it's a great time for a tune-up — and our [events calendar](/events) lists free repair clinics around Greater Boston. A bike that shifts and stops cleanly makes every cold ride more pleasant.$guidebody$,
    'cycling',
    'weather',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['weather', 'year-round', 'routes', 'bike-share']::text[],
    ARRAY['mg_cold_weather', 'mg_biking_in_rain', 'mg_walking_weather']::text[],
    false,
    4,
    timezone('America/New_York', '2026-10-05 12:00'::timestamp)
  ),
  (
    'mg_subway_vs_bus',
    'Subway vs. bus — what''s different',
    'subway-vs-bus',
    'Bus, subway, Green Line — three modes, one fare. What to expect the first time you ride each.',
    $guidebody$The MBTA runs buses, subway lines, and the Green Line (which acts like a streetcar in some places and a subway in others). They're all part of the same system, but the experience is different enough that it helps to know what you're walking into.

### Buses

Stop every few blocks; you board at the front. Tap your Charlie Card or phone on the reader by the driver. You can exit from any door — just push the yellow strip or pull cord to request your stop. Buses run on the street, so timing can vary with traffic. The posted schedule is a suggestion, not a promise — check real-time arrivals in the app.

### Subway (Red, Orange, Blue lines)

Runs underground on its own tracks, so it's generally faster and more predictable than buses. You tap in at the fare gate, wait on the platform, and board any car. Trains don't have stop-request buttons — they stop at every station. Signs on the platform and announcements will tell you which direction you're headed (e.g. "Alewife" vs. "Ashmont/Braintree" on the Red Line).

### The Green Line

The weird one. Parts run underground like a subway (downtown). Other parts run above ground at street level like a trolley (the B, C, and E branches). When it's above ground, you board at small platform stops on the street — look for the green signs. It can feel unfamiliar, but it works the same way: tap on, ride, get off at your stop.

### Transfers

If you pay with a CharlieCard or your phone, you can switch between buses and the subway within two hours and pay only the highest fare on the trip. Subway to bus is free; bus to subway costs the $0.70 difference. So a trip that mixes buses and trains costs about the same as one subway ride.$guidebody$,
    $guidebody$The MBTA runs buses, subway lines, and the Green Line (which acts like a streetcar in some places and a subway in others). They're all part of the same system, but the experience is different enough that it helps to know what you're walking into.

### Buses

Stop every few blocks; you board at the front. Tap your Charlie Card or phone on the reader by the driver. You can exit from any door — just push the yellow strip or pull cord to request your stop. Buses run on the street, so timing can vary with traffic. The posted schedule is a suggestion, not a promise — check real-time arrivals in the app.

### Subway (Red, Orange, Blue lines)

Runs underground on its own tracks, so it's generally faster and more predictable than buses. You tap in at the fare gate, wait on the platform, and board any car. Trains don't have stop-request buttons — they stop at every station. Signs on the platform and announcements will tell you which direction you're headed (e.g. "Alewife" vs. "Ashmont/Braintree" on the Red Line).

### The Green Line

The weird one. Parts run underground like a subway (downtown). Other parts run above ground at street level like a trolley (the B, C, and E branches). When it's above ground, you board at small platform stops on the street — look for the green signs. It can feel unfamiliar, but it works the same way: tap on, ride, get off at your stop.

### Transfers

If you pay with a CharlieCard or your phone, you can switch between buses and the subway within two hours and pay only the highest fare on the trip. Subway to bus is free; bus to subway costs the $0.70 difference. So a trip that mixes buses and trains costs about the same as one subway ride.$guidebody$,
    'transit',
    'routes',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library', 'roam_leg']::text[],
    ARRAY['getting-started', 'mbta-basics', 'routes']::text[],
    ARRAY['mg_first_bus_ride', 'mg_pay_for_t']::text[],
    true,
    2,
    timezone('America/New_York', '2026-10-17 12:00'::timestamp)
  ),
  (
    'mg_bus_transfers',
    'How bus transfers work',
    'how-bus-transfers-work',
    'Two-hour transfers are the MBTA''s quietest perk. The basic rule and the gotchas.',
    $guidebody$If your trip involves more than one bus or train, you're probably paying less than you think.

**The basic rule:** When you pay with a CharlieCard or by tapping your phone or bank card, you can change buses and trains as many times as you need within two hours and pay only the highest fare on the trip. Bus to bus and subway to bus are free; bus to subway costs the $0.70 difference. The two hours start from your first tap.

**What counts:** The transfer has to be between different routes. Riding the same bus back doesn't count. And the free transfer only covers the base fare — if you're transferring to an express bus or commuter rail, you pay the difference.

**What doesn't work:** Cash on the bus doesn't get you a free transfer. Neither do single-ride tickets from the machines. If you're going to ride transit more than once, a Charlie Card (or just your phone) pays for itself immediately.$guidebody$,
    $guidebody$If your trip involves more than one bus or train, you're probably paying less than you think.

**The basic rule:** When you pay with a CharlieCard or by tapping your phone or bank card, you can change buses and trains as many times as you need within two hours and pay only the highest fare on the trip. Bus to bus and subway to bus are free; bus to subway costs the $0.70 difference. The two hours start from your first tap.

**What counts:** The transfer has to be between different routes. Riding the same bus back doesn't count. And the free transfer only covers the base fare — if you're transferring to an express bus or commuter rail, you pay the difference.

**What doesn't work:** Cash on the bus doesn't get you a free transfer. Neither do single-ride tickets from the machines. If you're going to ride transit more than once, a Charlie Card (or just your phone) pays for itself immediately.$guidebody$,
    'transit',
    'planning',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library', 'roam_leg']::text[],
    ARRAY['fares', 'mbta-basics']::text[],
    ARRAY['mg_pay_for_t', 'mg_subway_vs_bus']::text[],
    false,
    1,
    timezone('America/New_York', '2026-10-17 12:00'::timestamp)
  ),
  (
    'mg_pay_for_t',
    'How to pay for the T',
    'how-to-pay-for-the-t',
    'Tap if you ride now and then. A monthly pass if you ride almost every workday. Transfers, Commuter Rail and reduced fares in plain language.',
    $guidebody$The MBTA takes both tap-to-pay and the CharlieCard. Which to use depends on how often you ride.

### For occasional riders: tap to pay.

Hold your phone (Apple Pay, Google Pay) or a contactless card on the reader at any fare gate or bus farebox. You pay per ride: $2.40 subway, $1.70 local bus.

### For regular riders: do the math on a pass.

A Monthly LinkPass on a CharlieCard is $90 for unlimited subway and local bus. A subway round trip every workday costs about $4.80 a day, so the pass comes out ahead once you ride about 19 days a month. If you only take the bus, the Monthly Local Bus Pass is $55, which beats paying per ride at about 17 round trips a month.

### Pass options on a CharlieCard

- **1-Day Pass:** $11, unlimited subway and bus for 24 hours.
- **7-Day Pass:** $22.50, unlimited for 7 days.
- **Monthly LinkPass:** $90, unlimited subway and bus for the calendar month.
- **Monthly Local Bus Pass:** $55, bus only.

Get a CharlieCard from a subway station fare machine and load it with cash or a card.

### Transfers

Within 2 hours, you can change between buses, the subway and the ferry as many times as you need and pay only the highest fare on the trip. Going from a bus to the subway costs the $0.70 difference; subway to bus is free. Use the same card or phone the whole way. Transfers don't work with cash or a paper CharlieTicket.

### For the Commuter Rail, use the mTicket app.

Buy your ticket in the app before boarding and show it to the conductor. Tap-to-pay isn't accepted on the Commuter Rail yet. Fares run $2.40 to $13.25 by zone.

### Reduced fares

Children 11 and under ride free. Reduced fares are available for riders 65 and older, riders with disabilities, middle and high school students, and income-eligible adults. Details at mbta.com/fares.

### The bottom line

If you ride a few times a week, just tap. If you ride the subway round trip almost every workday, a monthly pass saves a little and means you never think about the fare.$guidebody$,
    $guidebody$The MBTA takes both tap-to-pay and the CharlieCard. Which to use depends on how often you ride.

### For occasional riders: tap to pay.

Hold your phone (Apple Pay, Google Pay) or a contactless card on the reader at any fare gate or bus farebox. You pay per ride: {{price:mbta.subwaySingle}} subway, {{price:mbta.busSingle}} local bus.

### For regular riders: do the math on a pass.

A Monthly LinkPass on a CharlieCard is {{price:mbta.linkPassMonthly}} for unlimited subway and local bus. A subway round trip every workday costs about $4.80 a day, so the pass comes out ahead once you ride about 19 days a month. If you only take the bus, the Monthly Local Bus Pass is {{price:mbta.busPassMonthly}}, which beats paying per ride at about 17 round trips a month.

### Pass options on a CharlieCard

- **1-Day Pass:** {{price:mbta.dayPass}}, unlimited subway and bus for 24 hours.
- **7-Day Pass:** {{price:mbta.weekPass}}, unlimited for 7 days.
- **Monthly LinkPass:** {{price:mbta.linkPassMonthly}}, unlimited subway and bus for the calendar month.
- **Monthly Local Bus Pass:** {{price:mbta.busPassMonthly}}, bus only.

Get a CharlieCard from a subway station fare machine and load it with cash or a card.

### Transfers

Within 2 hours, you can change between buses, the subway and the ferry as many times as you need and pay only the highest fare on the trip. Going from a bus to the subway costs the $0.70 difference; subway to bus is free. Use the same card or phone the whole way. Transfers don't work with cash or a paper CharlieTicket.

### For the Commuter Rail, use the mTicket app.

Buy your ticket in the app before boarding and show it to the conductor. Tap-to-pay isn't accepted on the Commuter Rail yet. Fares run {{price:mbta.commuterRailMin}} to {{price:mbta.commuterRailMax}} by zone.

### Reduced fares

Children 11 and under ride free. Reduced fares are available for riders 65 and older, riders with disabilities, middle and high school students, and income-eligible adults. Details at mbta.com/fares.

### The bottom line

If you ride a few times a week, just tap. If you ride the subway round trip almost every workday, a monthly pass saves a little and means you never think about the fare.$guidebody$,
    'transit',
    'planning',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library', 'nudge_card']::text[],
    ARRAY['fares', 'getting-started', 'mbta-basics']::text[],
    ARRAY['mg_bus_transfers', 'mg_first_bus_ride']::text[],
    true,
    2,
    timezone('America/New_York', '2026-10-01 12:00'::timestamp)
  ),
  (
    'mg_first_bus_ride',
    'Your first bus ride — what to expect',
    'your-first-bus-ride',
    'Step by step from finding the right route to walking off at your stop, with paying and transfers in between.',
    $guidebody$If you've never taken a city bus, or haven't in years, here's what to expect. It's easier than it feels in advance.

### Before you leave

Find your route in Google Maps, Apple Maps, or the Transit app. Enter your destination, choose "Transit," and the app tells you which bus, where to catch it, and when it arrives. Most show where the bus is right now, so you know whether to head out or wait a minute.

### At the stop

Look for the bus stop sign; the route numbers are listed on it. When the bus pulls up, board through the front door, where the fare reader is.

### Paying

- **Tap to pay (easiest):** tap your phone (Apple Pay, Google Pay) or a contactless card on the reader.
- **CharlieCard:** tap it on the same reader.
- **Cash:** feed bills or coins into the farebox. It doesn't give change, but it can put the extra on a CharlieCard for next time.

### On the bus

Move toward the back to make room. Hold a pole or strap if you're standing. Stops are announced and shown on the display. To request your stop, press the yellow strip on the wall or pull the cord above the windows. Exit through the rear door (push the yellow bars to open it).

### A few useful things to know

- **Transfers:** within 2 hours, a second bus is free and the subway costs the $0.70 difference, as long as you pay the same way each time. Cash doesn't carry a transfer.
- **The bus can kneel.** If you need step-free boarding, the driver can lower it.
- **Drivers are used to new riders.** If you're not sure you're on the right bus, just ask.$guidebody$,
    $guidebody$If you've never taken a city bus, or haven't in years, here's what to expect. It's easier than it feels in advance.

### Before you leave

Find your route in Google Maps, Apple Maps, or the Transit app. Enter your destination, choose "Transit," and the app tells you which bus, where to catch it, and when it arrives. Most show where the bus is right now, so you know whether to head out or wait a minute.

### At the stop

Look for the bus stop sign; the route numbers are listed on it. When the bus pulls up, board through the front door, where the fare reader is.

### Paying

- **Tap to pay (easiest):** tap your phone (Apple Pay, Google Pay) or a contactless card on the reader.
- **CharlieCard:** tap it on the same reader.
- **Cash:** feed bills or coins into the farebox. It doesn't give change, but it can put the extra on a CharlieCard for next time.

### On the bus

Move toward the back to make room. Hold a pole or strap if you're standing. Stops are announced and shown on the display. To request your stop, press the yellow strip on the wall or pull the cord above the windows. Exit through the rear door (push the yellow bars to open it).

### A few useful things to know

- **Transfers:** within 2 hours, a second bus is free and the subway costs the $0.70 difference, as long as you pay the same way each time. Cash doesn't carry a transfer.
- **The bus can kneel.** If you need step-free boarding, the driver can lower it.
- **Drivers are used to new riders.** If you're not sure you're on the right bus, just ask.$guidebody$,
    'transit',
    'planning',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['getting-started', 'mbta-basics', 'planning']::text[],
    ARRAY['mg_pay_for_t', 'mg_subway_vs_bus']::text[],
    false,
    2,
    timezone('America/New_York', '2026-10-01 12:00'::timestamp)
  ),
  (
    'mg_transit_plus_walking',
    'Combining transit with walking or biking',
    'transit-plus-walking-or-biking',
    'Transit plus a short walk or bike at each end beats pure transit and pure walking on most longer trips.',
    $guidebody$For trips over 3 or 4 miles, mixing transit with a walk or bike ride at each end is often the fastest and most pleasant way to get there. You skip the slowest parts of an all-transit trip (local stops, transfers), get some exercise without adding much time, and arrive right at the door.

### How it works

1. Walk or bike to a stop or station (5 to 15 min).
2. Ride the bus or train for the long middle part.
3. Walk or bike from the stop to where you're going (5 to 15 min).

### Planning the trip

- **Use Google Maps or the Transit app.** Enter your destination, look at the transit options, and notice which stops are within a 10 to 15 minute walk of each end.
- **Choose rapid transit for the middle.** The subway, Commuter Rail or an express bus is the fastest way to cover the long stretch.
- **Consider Bluebikes for the last mile.** Stations are often right next to transit stops, and biking the last mile is usually quicker than waiting for a connecting bus.

### An example

Somerville to the Seaport is about 6 miles. One way to do it:

- Walk 8 min to Davis station
- Ride the Red Line to South Station (about 17 min)
- Walk 10 min to the Seaport

About 35 minutes, $2.40, and 18 minutes of walking built into the day.

### A few practical things

- **Build in buffer time.** Allow 5 extra minutes until you know the routine.
- **Have a backup.** Know the all-transit route for bad-weather days.
- **It gets easier.** Once you know the timing, the planning drops to almost nothing.$guidebody$,
    $guidebody$For trips over 3 or 4 miles, mixing transit with a walk or bike ride at each end is often the fastest and most pleasant way to get there. You skip the slowest parts of an all-transit trip (local stops, transfers), get some exercise without adding much time, and arrive right at the door.

### How it works

1. Walk or bike to a stop or station (5 to 15 min).
2. Ride the bus or train for the long middle part.
3. Walk or bike from the stop to where you're going (5 to 15 min).

### Planning the trip

- **Use Google Maps or the Transit app.** Enter your destination, look at the transit options, and notice which stops are within a 10 to 15 minute walk of each end.
- **Choose rapid transit for the middle.** The subway, Commuter Rail or an express bus is the fastest way to cover the long stretch.
- **Consider Bluebikes for the last mile.** Stations are often right next to transit stops, and biking the last mile is usually quicker than waiting for a connecting bus.

### An example

Somerville to the Seaport is about 6 miles. One way to do it:

- Walk 8 min to Davis station
- Ride the Red Line to South Station (about 17 min)
- Walk 10 min to the Seaport

About 35 minutes, {{price:mbta.subwaySingle}}, and 18 minutes of walking built into the day.

### A few practical things

- **Build in buffer time.** Allow 5 extra minutes until you know the routine.
- **Have a backup.** Know the all-transit route for bad-weather days.
- **It gets easier.** Once you know the timing, the planning drops to almost nothing.$guidebody$,
    'transit',
    'routes',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['routes', 'multimodal', 'getting-started']::text[],
    ARRAY['mg_transit_planning', 'mg_subway_vs_bus']::text[],
    false,
    2,
    timezone('America/New_York', '2026-10-01 12:00'::timestamp)
  ),
  (
    'mg_transit_planning',
    'Planning a transit trip — it''s mostly the apps doing the work',
    'planning-a-transit-trip',
    'Real-time apps do the work that printed schedules used to. Five rules for getting the most out of them.',
    $guidebody$Planning a transit trip used to mean reading printed schedules and hoping the bus showed up. Today the apps do all of that. Here's how to use them well.

### 1. Use the Transit app or Google Maps.

Both pull live MBTA data — real-time bus and train locations, predicted arrivals, and full route options.

- **Transit (the app):** Best for transit-specific use. Faster, cleaner, with countdown clocks for nearby stops the moment you open it.
- **Google Maps:** Best when comparing transit against walking or biking. The "Transit" tab shows multiple options ranked by total time.
- **MBTA's own app and mbta.com/trip-planner:** Useful for service alerts and accessibility info.

### 2. Trust the predicted arrivals.

Real-time predictions are usually within a minute or two. Don't pad your schedule based on the printed schedule — that's the worst-case version, not the typical one.

### 3. Allow extra time for transfers, but only the first time.

Apps build in standard transfer time. The first time you make an unfamiliar transfer, give yourself an extra 5 minutes to find the connecting platform or stop. Once you know the layout, you'll match the app's estimate.

### 4. Have a backup plan for delays.

If your bus or train is late, the same app shows the next one. Sometimes the answer is wait; sometimes it's switch routes or grab a Bluebike for the rest of the leg.

### 5. Save your common trips.

Both Transit and Google Maps let you favorite or pin frequent destinations. After a week of doing this, your morning routine collapses to "open app, see when to leave."

### One last thing

For first-time multi-leg trips, screenshot the directions in case signal drops on the platform.$guidebody$,
    $guidebody$Planning a transit trip used to mean reading printed schedules and hoping the bus showed up. Today the apps do all of that. Here's how to use them well.

### 1. Use the Transit app or Google Maps.

Both pull live MBTA data — real-time bus and train locations, predicted arrivals, and full route options.

- **Transit (the app):** Best for transit-specific use. Faster, cleaner, with countdown clocks for nearby stops the moment you open it.
- **Google Maps:** Best when comparing transit against walking or biking. The "Transit" tab shows multiple options ranked by total time.
- **MBTA's own app and mbta.com/trip-planner:** Useful for service alerts and accessibility info.

### 2. Trust the predicted arrivals.

Real-time predictions are usually within a minute or two. Don't pad your schedule based on the printed schedule — that's the worst-case version, not the typical one.

### 3. Allow extra time for transfers, but only the first time.

Apps build in standard transfer time. The first time you make an unfamiliar transfer, give yourself an extra 5 minutes to find the connecting platform or stop. Once you know the layout, you'll match the app's estimate.

### 4. Have a backup plan for delays.

If your bus or train is late, the same app shows the next one. Sometimes the answer is wait; sometimes it's switch routes or grab a Bluebike for the rest of the leg.

### 5. Save your common trips.

Both Transit and Google Maps let you favorite or pin frequent destinations. After a week of doing this, your morning routine collapses to "open app, see when to leave."

### One last thing

For first-time multi-leg trips, screenshot the directions in case signal drops on the platform.$guidebody$,
    'transit',
    'planning',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['planning', 'apps', 'getting-started']::text[],
    ARRAY['mg_subway_vs_bus', 'mg_transit_plus_walking']::text[],
    true,
    2,
    timezone('America/New_York', '2026-05-08 12:00'::timestamp)
  ),
  (
    'mg_transit_time',
    'When transit is actually the faster option',
    'when-transit-is-faster',
    'On most trips into or across downtown, transit door-to-door beats driving once you count the parking search.',
    $guidebody$Transit can feel slower than driving, but on most trips into or across downtown Boston, it isn't — once you count the full door-to-door time and what driving actually costs you in stress and parking. Here's when transit wins.

### 1. Anywhere downtown, in or out.

Driving into Back Bay, Downtown Crossing, the Seaport, or anywhere along the Red Line corridor means crawling traffic plus a parking search. The subway is signal-independent — it runs the same speed at 8 AM and 11 AM. For most downtown trips from the inner suburbs, the Red, Orange, or Green Line is usually the faster option door-to-door.

### 2. Commuter Rail into Boston, from anywhere with a station.

From Worcester, Lowell, Beverly, or any commuter rail town, the train is hard to beat by car. It runs at consistent highway-equivalent speeds, drops you at South Station or North Station, and you skip the whole parking situation. For longer commutes, this is usually the fastest option, period.

### 3. Across the river, anytime.

Cambridge to Boston (or vice versa) by car is a coin flip on the bridge timing. The Red Line is consistently 10-15 minutes across the same stretch, rush hour or midnight.

### 4. The "predictable arrival" advantage.

Even when transit isn't the absolute fastest option on a given day, it's the most predictable. A 25-minute transit trip is 25 minutes most days. A 25-minute drive can be 25, 35, or 50 depending on traffic. Predictability is its own kind of fast — you don't have to leave 15 minutes early "just in case."

### 5. What you do with the time.

A 30-minute drive is 30 minutes of driving. A 30-minute train ride is 30 minutes of reading, working, podcast-listening, or zoning out. For a daily commute, that adds up to several hours a week of time you get to spend on something else.$guidebody$,
    $guidebody$Transit can feel slower than driving, but on most trips into or across downtown Boston, it isn't — once you count the full door-to-door time and what driving actually costs you in stress and parking. Here's when transit wins.

### 1. Anywhere downtown, in or out.

Driving into Back Bay, Downtown Crossing, the Seaport, or anywhere along the Red Line corridor means crawling traffic plus a parking search. The subway is signal-independent — it runs the same speed at 8 AM and 11 AM. For most downtown trips from the inner suburbs, the Red, Orange, or Green Line is usually the faster option door-to-door.

### 2. Commuter Rail into Boston, from anywhere with a station.

From Worcester, Lowell, Beverly, or any commuter rail town, the train is hard to beat by car. It runs at consistent highway-equivalent speeds, drops you at South Station or North Station, and you skip the whole parking situation. For longer commutes, this is usually the fastest option, period.

### 3. Across the river, anytime.

Cambridge to Boston (or vice versa) by car is a coin flip on the bridge timing. The Red Line is consistently 10-15 minutes across the same stretch, rush hour or midnight.

### 4. The "predictable arrival" advantage.

Even when transit isn't the absolute fastest option on a given day, it's the most predictable. A 25-minute transit trip is 25 minutes most days. A 25-minute drive can be 25, 35, or 50 depending on traffic. Predictability is its own kind of fast — you don't have to leave 15 minutes early "just in case."

### 5. What you do with the time.

A 30-minute drive is 30 minutes of driving. A 30-minute train ride is 30 minutes of reading, working, podcast-listening, or zoning out. For a daily commute, that adds up to several hours a week of time you get to spend on something else.$guidebody$,
    'transit',
    'time',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['motivation', 'mbta-basics']::text[],
    ARRAY['mg_subway_vs_bus', 'mg_transit_plus_walking']::text[],
    false,
    2,
    timezone('America/New_York', '2026-05-08 12:00'::timestamp)
  ),
  (
    'mg_walking_vs_driving',
    'When walking is actually the faster option',
    'when-walking-is-faster',
    'For trips under a mile, walking often beats driving once you count getting to the car. Five times it definitely wins.',
    $guidebody$Walking is faster than driving for more short trips than people expect — once you count door-to-door time. Here's when it wins.

### 1. Trips under half a mile.

Walking 0.5 miles takes about 10 minutes. Driving the same distance often takes longer once you count the trip to your car, traffic, and the trip from parking to the door. The shorter the trip, the more lopsided the math.

### 2. Anywhere parking is hard.

Cambridge, Somerville, the Seaport, downtown Boston, anywhere near a hospital or a college — if you'd spend 5-10 minutes hunting for a spot, walking from a few blocks farther out is often faster door-to-door.

### 3. Round trips with multiple stops.

Need to grab coffee, drop off a package, and pick something up at the pharmacy on the same block? Walking handles a chained errand without the park-and-re-park overhead at each stop.

### 4. Rush hour, when traffic is bad.

A 1-mile drive in stop-and-go traffic can easily take 10-15 minutes. A 1-mile walk is 20 minutes — sometimes faster than the drive, almost always more pleasant.

### 5. What walking does that GPS doesn't track.

A 15-minute walk lets you notice your neighborhood, and ends with you in a better mood than you started.$guidebody$,
    $guidebody$Walking is faster than driving for more short trips than people expect — once you count door-to-door time. Here's when it wins.

### 1. Trips under half a mile.

Walking 0.5 miles takes about 10 minutes. Driving the same distance often takes longer once you count the trip to your car, traffic, and the trip from parking to the door. The shorter the trip, the more lopsided the math.

### 2. Anywhere parking is hard.

Cambridge, Somerville, the Seaport, downtown Boston, anywhere near a hospital or a college — if you'd spend 5-10 minutes hunting for a spot, walking from a few blocks farther out is often faster door-to-door.

### 3. Round trips with multiple stops.

Need to grab coffee, drop off a package, and pick something up at the pharmacy on the same block? Walking handles a chained errand without the park-and-re-park overhead at each stop.

### 4. Rush hour, when traffic is bad.

A 1-mile drive in stop-and-go traffic can easily take 10-15 minutes. A 1-mile walk is 20 minutes — sometimes faster than the drive, almost always more pleasant.

### 5. What walking does that GPS doesn't track.

A 15-minute walk lets you notice your neighborhood, and ends with you in a better mood than you started.$guidebody$,
    'walking',
    'time',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library', 'nudge_card']::text[],
    ARRAY['motivation', 'short-trips']::text[],
    ARRAY['mg_walking_carrying']::text[],
    true,
    2,
    timezone('America/New_York', '2026-10-01 12:00'::timestamp)
  ),
  (
    'mg_walking_carrying',
    'Walking with stuff: how to carry what you need',
    'walking-with-stuff',
    'A rolling cart, a good backpack, and one delivery a week cover almost any load people typically drive for.',
    $guidebody$Carrying stuff is the most overstated walking barrier. Most things people assume require a car can be carried on foot with the right setup. For the rest, there are still good options. Here's what works.

### 1. A rolling cart is the unsung hero.

A folding utility cart (sometimes called a "granny cart") holds 50+ pounds of groceries, pulls easily on sidewalks, and folds flat at home. They cost $30-60 and have changed the game for plenty of car-free families. Ikea, Amazon, and most hardware stores carry them.

### 2. A backpack and a few foldable bags cover most everyday loads.

A backpack is hands-free and distributes weight; foldable bags tucked inside mean you're never caught short for a bigger haul. For groceries specifically, two reusable totes (one in each hand) carry weight more comfortably than one giant bag and let you rebalance as you go.

### 3. For loads beyond walking, an e-cargo bike covers the middle ground.

An e-cargo bike handles a Costco run, a beach-day load, a trip to the lumber yard — most of what people assume requires a car. You don't have to buy one to find out; see *What you can do with an e-cargo bike* for the rental and library options that let you try one for a weekend.

### 4. Use delivery for the truly bulky.

A 12-pack of paper towels or a case of sparkling water is more of a delivery problem than a walking or biking one. Most grocery stores in Greater Boston offer delivery, and one delivery a week handles what's left.

### 5. Schedule around it.

Two smaller walking trips a week often work better than one big haul. Smaller loads, more steps, less of a production.

### Putting it together

A rolling cart, an e-cargo bike, and a delivery subscription cover almost any load people typically drive for.$guidebody$,
    $guidebody$Carrying stuff is the most overstated walking barrier. Most things people assume require a car can be carried on foot with the right setup. For the rest, there are still good options. Here's what works.

### 1. A rolling cart is the unsung hero.

A folding utility cart (sometimes called a "granny cart") holds 50+ pounds of groceries, pulls easily on sidewalks, and folds flat at home. They cost $30-60 and have changed the game for plenty of car-free families. Ikea, Amazon, and most hardware stores carry them.

### 2. A backpack and a few foldable bags cover most everyday loads.

A backpack is hands-free and distributes weight; foldable bags tucked inside mean you're never caught short for a bigger haul. For groceries specifically, two reusable totes (one in each hand) carry weight more comfortably than one giant bag and let you rebalance as you go.

### 3. For loads beyond walking, an e-cargo bike covers the middle ground.

An e-cargo bike handles a Costco run, a beach-day load, a trip to the lumber yard — most of what people assume requires a car. You don't have to buy one to find out; see *What you can do with an e-cargo bike* for the rental and library options that let you try one for a weekend.

### 4. Use delivery for the truly bulky.

A 12-pack of paper towels or a case of sparkling water is more of a delivery problem than a walking or biking one. Most grocery stores in Greater Boston offer delivery, and one delivery a week handles what's left.

### 5. Schedule around it.

Two smaller walking trips a week often work better than one big haul. Smaller loads, more steps, less of a production.

### Putting it together

A rolling cart, an e-cargo bike, and a delivery subscription cover almost any load people typically drive for.$guidebody$,
    'walking',
    'carrying',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['carrying', 'gear', 'errands']::text[],
    ARRAY['mg_cargo_bike', 'mg_walking_vs_driving']::text[],
    true,
    2,
    timezone('America/New_York', '2026-05-08 12:00'::timestamp)
  ),
  (
    'mg_walking_weather',
    'Walking through the weather',
    'walking-through-the-weather',
    'Most weather is more walkable than it looks from the warm side of a window. The shoes, layers, and bail-out plan that get you out the door.',
    $guidebody$Weather is most people's biggest walking hesitation, but most weather is more walkable than it looks from the warm side of a window. Here's what to know.

### 1. The right shoes are step one.

Waterproof shoes (any decent pair, not specialty gear) make rain a non-event. Insulated boots make a 25°F walk perfectly comfortable. Non-waterproof shoes are often the real problem people blame on weather.

### 2. Cold weather is a layering question, not a temperature question.

A light shell over your normal layers extends your comfort range a long way. The "dress like it's 15°F warmer" rule from biking applies here too — you'll warm up within a few blocks. Cover your ears and hands; everything else takes care of itself.

### 3. Light rain is fine.

A waterproof jacket and a hood handle the typical drizzle that stops people from walking. An umbrella works for steady rain on a calm day; in wind, a hooded shell is better.

### 4. Hot weather is about pace and hydration.

On 90°F days, walk slower, take a water bottle, stay on the shadier side of the street, and consider a hat. Pre-9 AM and post-7 PM hours are usually perfectly walkable even in summer.

### 5. Know your bail-out options.

Real bad weather — sleet, lightning, dangerous heat — is the right time to take the T, take a rideshare, or stay home. Walking should be a default, not an obligation. Knowing the bail-out option in advance makes you more willing to start.

### One last thing

Most "the weather is bad" conclusions are made by people standing inside dressed for inside. Take a 5-minute walk to the corner and back before deciding it's a no-go day; the answer is usually different than expected.$guidebody$,
    $guidebody$Weather is most people's biggest walking hesitation, but most weather is more walkable than it looks from the warm side of a window. Here's what to know.

### 1. The right shoes are step one.

Waterproof shoes (any decent pair, not specialty gear) make rain a non-event. Insulated boots make a 25°F walk perfectly comfortable. Non-waterproof shoes are often the real problem people blame on weather.

### 2. Cold weather is a layering question, not a temperature question.

A light shell over your normal layers extends your comfort range a long way. The "dress like it's 15°F warmer" rule from biking applies here too — you'll warm up within a few blocks. Cover your ears and hands; everything else takes care of itself.

### 3. Light rain is fine.

A waterproof jacket and a hood handle the typical drizzle that stops people from walking. An umbrella works for steady rain on a calm day; in wind, a hooded shell is better.

### 4. Hot weather is about pace and hydration.

On 90°F days, walk slower, take a water bottle, stay on the shadier side of the street, and consider a hat. Pre-9 AM and post-7 PM hours are usually perfectly walkable even in summer.

### 5. Know your bail-out options.

Real bad weather — sleet, lightning, dangerous heat — is the right time to take the T, take a rideshare, or stay home. Walking should be a default, not an obligation. Knowing the bail-out option in advance makes you more willing to start.

### One last thing

Most "the weather is bad" conclusions are made by people standing inside dressed for inside. Take a 5-minute walk to the corner and back before deciding it's a no-go day; the answer is usually different than expected.$guidebody$,
    'walking',
    'weather',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['weather', 'gear', 'year-round']::text[],
    ARRAY['mg_biking_in_rain', 'mg_cold_weather', 'mg_boston_winter']::text[],
    true,
    2,
    timezone('America/New_York', '2026-05-08 12:00'::timestamp)
  ),
  (
    'mg_drive_time_on_foot',
    'How far is a 10-minute drive on foot or by bike?',
    'how-far-is-a-ten-minute-drive-on-foot',
    'A 10-minute drive across Greater Boston is roughly two and a half miles — about 12 minutes on a bike. Here''s the whole conversion, plus the door-to-door minutes each way of getting around adds on top.',
    $guidebody$People measure trips in drive-minutes. Here's what those minutes look like on foot and on a bike, using typical Greater Boston traffic speeds of roughly 12–15 mph on local streets and arterials.

### A 5-minute drive is about a mile.

That's a 20-minute walk, or a 6-minute ride. At this distance the bike is usually the fastest thing you own, and the walk is short enough that plenty of people do it without thinking of it as a walk.

### A 10-minute drive is about 2 to 2.5 miles.

Call it 45 minutes on foot and 12 minutes on a bike. This is the sweet spot for biking around here — far enough that walking takes real time, close enough that you arrive before you'd have found parking.

### A 15-minute drive is about 3 to 4 miles.

An hour or so of walking, and about 20 minutes on a bike. On an e-bike it's closer to 15, at a pace that doesn't ask much of you.

### A 20-minute drive is about 5 miles.

Roughly 25 to 30 minutes riding, or 20 on an e-bike. Five miles is also comfortable territory for a bike-plus-T trip if the weather turns.

### Door to door is the comparison that counts.

Each of those estimates measures a different slice of the trip. Here's what to add back for a real one.

**Parking, if you drive.** The estimate stops at the destination address. The trip you actually take includes finding a space and walking in from it — around a hospital, a campus, the Seaport, or downtown, that's regularly another 5 to 15 minutes at the destination and a few more back at the start. Paying is its own step: a full day in a downtown Boston garage runs $30 to $47, and metered spots want a minute at the kiosk or in the app. On a short errand that overhead can be most of the trip.

**Locking up, if you bike.** Add a minute or two at each end. On Bluebikes, add the walk to a dock, and at rush hour the occasional extra block to reach one with a free spot — a single ride is $3, or $11.13 a month on an annual pass.

**Walking and waiting, if you take the T.** Add the walk to the stop, the wait, and the walk at the far end. The ride itself is $2.40 on the subway, $1.70 on the bus, and it's usually those two walks — not the ride — that decide whether transit beats driving on a given trip.

**Nothing extra, if you walk.** The estimate is already door to door. What you see is what it takes, which is a large part of why walking wins more short trips than people expect.

Add all of that back and the gaps at the short end close considerably. Under about a mile, the modes are usually much closer than the drive-time estimate makes them look.

### Try this first

Put your own trip into the [Commute Advisor](https://www.gogreenstreets.org/commute-advisor). It gives you real walking, biking, and transit times for the actual route, plus what each option costs per day and per year.$guidebody$,
    $guidebody$People measure trips in drive-minutes. Here's what those minutes look like on foot and on a bike, using typical Greater Boston traffic speeds of roughly 12–15 mph on local streets and arterials.

### A 5-minute drive is about a mile.

That's a 20-minute walk, or a 6-minute ride. At this distance the bike is usually the fastest thing you own, and the walk is short enough that plenty of people do it without thinking of it as a walk.

### A 10-minute drive is about 2 to 2.5 miles.

Call it 45 minutes on foot and 12 minutes on a bike. This is the sweet spot for biking around here — far enough that walking takes real time, close enough that you arrive before you'd have found parking.

### A 15-minute drive is about 3 to 4 miles.

An hour or so of walking, and about 20 minutes on a bike. On an e-bike it's closer to 15, at a pace that doesn't ask much of you.

### A 20-minute drive is about 5 miles.

Roughly 25 to 30 minutes riding, or 20 on an e-bike. Five miles is also comfortable territory for a bike-plus-T trip if the weather turns.

### Door to door is the comparison that counts.

Each of those estimates measures a different slice of the trip. Here's what to add back for a real one.

**Parking, if you drive.** The estimate stops at the destination address. The trip you actually take includes finding a space and walking in from it — around a hospital, a campus, the Seaport, or downtown, that's regularly another 5 to 15 minutes at the destination and a few more back at the start. Paying is its own step: a full day in a downtown Boston garage runs {{price:parking.bostonCommonDay}} to {{price:parking.prudentialDay}}, and metered spots want a minute at the kiosk or in the app. On a short errand that overhead can be most of the trip.

**Locking up, if you bike.** Add a minute or two at each end. On Bluebikes, add the walk to a dock, and at rush hour the occasional extra block to reach one with a free spot — a single ride is {{price:bluebikes.singleRide}}, or {{price:bluebikes.annualPerMonth}} a month on an annual pass.

**Walking and waiting, if you take the T.** Add the walk to the stop, the wait, and the walk at the far end. The ride itself is {{price:mbta.subwaySingle}} on the subway, {{price:mbta.busSingle}} on the bus, and it's usually those two walks — not the ride — that decide whether transit beats driving on a given trip.

**Nothing extra, if you walk.** The estimate is already door to door. What you see is what it takes, which is a large part of why walking wins more short trips than people expect.

Add all of that back and the gaps at the short end close considerably. Under about a mile, the modes are usually much closer than the drive-time estimate makes them look.

### Try this first

Put your own trip into the [Commute Advisor](https://www.gogreenstreets.org/commute-advisor). It gives you real walking, biking, and transit times for the actual route, plus what each option costs per day and per year.$guidebody$,
    'walking',
    'time',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['planning', 'short-trips', 'motivation', 'routes']::text[],
    ARRAY['mg_walking_vs_driving', 'mg_bike_time', 'mg_transit_time']::text[],
    false,
    3,
    timezone('America/New_York', '2026-08-31 12:00'::timestamp)
  ),
  (
    'mg_cargo_bike_cost',
    'What a cargo e-bike costs — new, used, and what drives the price',
    'what-a-cargo-ebike-costs',
    'Cargo e-bikes run from around $2,000 to well past $8,000 new, and a well-kept used one often lands near $3,000. Here''s what you''re paying for, what to check before you buy secondhand, and where to try one first.',
    $guidebody$A cargo e-bike is the one bike that can replace a whole category of trips — the school run, a full grocery shop, a kid and their scooter and a library bag. Here's what one costs and what your money is actually buying.

### New cargo e-bikes start around $2,000 and climb past $8,000.

The spread is wide because "cargo e-bike" covers a lot of ground. Around $2,000 to $3,000 you're looking at direct-to-consumer longtails — a rear rack long enough for two small kids or a big load, a hub motor, and a battery that will comfortably cover a day of errands.

From about $4,000 to $6,000 you move into mid-drive motors, better brakes, and frames built to carry more weight with more composure. Above that sit the front-loader box bikes and the premium longtails, where you're paying for load capacity, ride quality, and parts that shrug off daily year-round use.

Accessories are a real line item and worth planning for. Seats, running boards, a rain canopy, panniers, and a good lock can add $300 to $900 on top, depending on how many people and how much stuff you're carrying.

### A used one often lands around $3,000.

That figure comes up again and again for well-kept longtails from the established brands. It's a genuinely good place to shop: cargo bikes are bought by people who intend to use them hard, and a lot of them get sold on in good condition when a family's needs change.

What to look at before you buy secondhand:

**The battery, first and most.** It's the single most expensive part to replace. Ask how old it is, roughly how many charge cycles it's seen, and whether it still holds close to its original range. A battery that's four or five years old is not a dealbreaker, but it should be reflected in the price, and you'll want to know what a replacement costs for that model.

**Whether the brand still supports the model.** Parts availability is what separates a bargain from a project. Established cargo brands with a dealer network in the area are the safer buy, because a shop can get you a controller, a display, or a proprietary rack part without a scavenger hunt.

**Brakes and tires.** Both are wear items and both matter more on a loaded bike than an unloaded one. Budget for a fresh set of pads and possibly tires — it's a modest cost that's easy to fold into your offer.

**The frame and the welds, especially around the rack and the kickstand.** These bikes carry real weight. Look for cracks or repairs at the joints, and put the bike on its centerstand to check that it's solid and not bent.

**A test ride with weight on it.** An empty cargo bike rides like any bike. Load it up — even with a couple of bags of something heavy — and you'll learn more in five minutes than in any spec sheet.

### What actually drives the price

**Motor placement.** Mid-drive motors sit at the cranks and use the bike's gears, which makes them stronger on hills and easier on the drivetrain under load. Hub motors are simpler and cheaper and do fine on the flatter routes.

**Battery capacity.** More watt-hours means more range, and range is the thing you notice on a hilly route with a full load. Some bikes take a second battery, which is worth knowing about if your days are long.

**Load rating.** The published maximum for rider plus cargo is one of the honest signals of how a bike is built. A higher rating usually means a stronger frame, better brakes, and a more capable rear end.

**Brakes.** Hydraulic discs are the standard on bikes meant to carry weight, and they're the upgrade that matters most for confidence on a wet Boston hill.

### Where to look around here

Local bike shops are worth the visit even if you end up buying used, because a shop that sells the brand can service it and will often know who's selling. Shops in the area increasingly keep a cargo bike or two available to demo, and an hour on one tells you more than weeks of reading.

Community bike programs and campus repair co-ops are the other good local resource — a place to get a secondhand bike checked over before you commit.

Incentives change often. The Massachusetts statewide e-bike voucher ran in 2025 and is closed as of this writing, but new rounds and utility or municipal programs come and go, so it's worth checking what's open at [MassCEC](https://goclean.masscec.com/) before you buy.

### Try one before you buy one

Riding a loaded cargo bike is the part that decides it for most people. Our [community events calendar](https://www.gogreenstreets.org/events) lists e-bike demos, group rides, and family rides across Greater Boston — the easiest way to try a few and find out which shape suits your trips.

And if you want to know what those trips would look like, the [Commute Advisor](https://www.gogreenstreets.org/commute-advisor) gives you real biking times for your actual routes.$guidebody$,
    $guidebody$A cargo e-bike is the one bike that can replace a whole category of trips — the school run, a full grocery shop, a kid and their scooter and a library bag. Here's what one costs and what your money is actually buying.

### New cargo e-bikes start around $2,000 and climb past $8,000.

The spread is wide because "cargo e-bike" covers a lot of ground. Around $2,000 to $3,000 you're looking at direct-to-consumer longtails — a rear rack long enough for two small kids or a big load, a hub motor, and a battery that will comfortably cover a day of errands.

From about $4,000 to $6,000 you move into mid-drive motors, better brakes, and frames built to carry more weight with more composure. Above that sit the front-loader box bikes and the premium longtails, where you're paying for load capacity, ride quality, and parts that shrug off daily year-round use.

Accessories are a real line item and worth planning for. Seats, running boards, a rain canopy, panniers, and a good lock can add $300 to $900 on top, depending on how many people and how much stuff you're carrying.

### A used one often lands around $3,000.

That figure comes up again and again for well-kept longtails from the established brands. It's a genuinely good place to shop: cargo bikes are bought by people who intend to use them hard, and a lot of them get sold on in good condition when a family's needs change.

What to look at before you buy secondhand:

**The battery, first and most.** It's the single most expensive part to replace. Ask how old it is, roughly how many charge cycles it's seen, and whether it still holds close to its original range. A battery that's four or five years old is not a dealbreaker, but it should be reflected in the price, and you'll want to know what a replacement costs for that model.

**Whether the brand still supports the model.** Parts availability is what separates a bargain from a project. Established cargo brands with a dealer network in the area are the safer buy, because a shop can get you a controller, a display, or a proprietary rack part without a scavenger hunt.

**Brakes and tires.** Both are wear items and both matter more on a loaded bike than an unloaded one. Budget for a fresh set of pads and possibly tires — it's a modest cost that's easy to fold into your offer.

**The frame and the welds, especially around the rack and the kickstand.** These bikes carry real weight. Look for cracks or repairs at the joints, and put the bike on its centerstand to check that it's solid and not bent.

**A test ride with weight on it.** An empty cargo bike rides like any bike. Load it up — even with a couple of bags of something heavy — and you'll learn more in five minutes than in any spec sheet.

### What actually drives the price

**Motor placement.** Mid-drive motors sit at the cranks and use the bike's gears, which makes them stronger on hills and easier on the drivetrain under load. Hub motors are simpler and cheaper and do fine on the flatter routes.

**Battery capacity.** More watt-hours means more range, and range is the thing you notice on a hilly route with a full load. Some bikes take a second battery, which is worth knowing about if your days are long.

**Load rating.** The published maximum for rider plus cargo is one of the honest signals of how a bike is built. A higher rating usually means a stronger frame, better brakes, and a more capable rear end.

**Brakes.** Hydraulic discs are the standard on bikes meant to carry weight, and they're the upgrade that matters most for confidence on a wet Boston hill.

### Where to look around here

Local bike shops are worth the visit even if you end up buying used, because a shop that sells the brand can service it and will often know who's selling. Shops in the area increasingly keep a cargo bike or two available to demo, and an hour on one tells you more than weeks of reading.

Community bike programs and campus repair co-ops are the other good local resource — a place to get a secondhand bike checked over before you commit.

Incentives change often. The Massachusetts statewide e-bike voucher ran in 2025 and is closed as of this writing, but new rounds and utility or municipal programs come and go, so it's worth checking what's open at [MassCEC](https://goclean.masscec.com/) before you buy.

### Try one before you buy one

Riding a loaded cargo bike is the part that decides it for most people. Our [community events calendar](https://www.gogreenstreets.org/events) lists e-bike demos, group rides, and family rides across Greater Boston — the easiest way to try a few and find out which shape suits your trips.

And if you want to know what those trips would look like, the [Commute Advisor](https://www.gogreenstreets.org/commute-advisor) gives you real biking times for your actual routes.$guidebody$,
    'cycling',
    'cost',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['cost', 'gear', 'family', 'planning']::text[],
    ARRAY['mg_cargo_bike', 'mg_bike_commute_gear', 'mg_bike_lock']::text[],
    false,
    5,
    timezone('America/New_York', '2026-09-28 12:00'::timestamp)
  ),
  (
    'mg_boston_traffic',
    'Why Boston traffic is so bad, and how to get around it',
    'boston-traffic',
    'Boston drivers lose about 83 hours a year to traffic. Why it happens, how to time your trip, and the trains, buses and ferries that skip the worst of it.',
    $guidebody$Boston's traffic is among the worst in the country. The average driver here lost 83 hours to it in 2025, the fifth most of any U.S. city ([INRIX](https://inrix.com/press-releases/2025-global-traffic-scorecard-us/)). Many of the state's jobs are in the Boston area, reached by a few bridges, tunnels and highways, and those roads are so full that one crash or storm backs everything up. You can't fix the traffic, but on many trips you can get around it.

### Why is it so bad?

- **Lots of jobs, few ways in.** The Boston region had 44% of the state's jobs in 2019 ([MassDOT](https://www.mass.gov/doc/congestion-in-the-commonwealth/download)).
- **The roads are full, so small problems spread.** When a road has no spare room, a single crash or work zone slows traffic for miles. MassDOT says the bigger problem is how unpredictable the trip is, more than the average delay.
- **A few choke points carry everyone.** The worst are the Tobin Bridge, the Zakim Bridge and the tunnels, the Southeast Expressway, the Leverett Connector, and Alewife Brook Parkway near Route 2. Seven of the state's ten worst spots are on I-93 ([MassDOT, 2025 update](https://web.archive.org/web/20251206011247/https://www.mass.gov/doc/congestion-in-the-commonwealth-2025-data-update/download)).
- **Rush hour is getting longer.** By 5 p.m. on a weekday, almost every major road inside Route 128 has some delay, and nearly half are congested as early as 2 p.m. Tuesday to Thursday is worse than Monday or Friday.

### Is driving faster in the city at rush hour?

Not by much. On weekday rush-hour trips of 3 to 8 miles in Boston, Cambridge, Somerville, Brookline and nearby, people using Shift typically went 8.4 mph by car, 8.6 mph by bike and 8.8 mph on the subway. Outside rush hour, drives of that length typically went 10.3 mph.

**About these numbers:** From 1,078 rush-hour trips of 3 to 8 miles by car, bike and subway recorded by people using Shift, July 18 to October 16, 2026 (weekdays 7 to 9:30 a.m. and 4 to 7 p.m.). Typical means half the trips were faster and half were slower.

### When should I leave to miss it?

Timing still matters. At 6 a.m., 15% of the roads inside Route 128 are congested. By 8 a.m., it's 45% ([MassDOT, 2024 data](https://web.archive.org/web/20251206011247/https://www.mass.gov/doc/congestion-in-the-commonwealth-2025-data-update/download)).

### How do I get around it from where I live?

- **MetroWest and the Mass Pike.** The commuter rail from Framingham reaches Back Bay in 35 to 56 minutes on weekday mornings. Parking at the Framingham station is $4 a day. From Worcester, the fastest morning train takes 70 minutes to South Station ([Framingham/Worcester Line schedule](https://www.mbta.com/schedules/CR-Worcester/timetable)).
- **The South Shore and the Braintree Split.** Park at the Braintree or Quincy Adams garage for $9 and the Red Line reaches Park Street in under half an hour. From farther out, the Kingston and Greenbush trains take about an hour to South Station, and the Hingham ferry reaches Rowes Wharf in 30 to 40 minutes.
- **Route 128 and Burlington.** Bus 350 runs from Alewife to Burlington Mall Road in about 30 to 40 minutes. Many employers along 128 belong to a transportation management association that runs shuttles and carpool matching for their staff. [Find yours through MassCommute](https://www.masscommute.com/find-your-tma).

The trains can run late too, so check [T-Alerts](https://alerts.mbta.com) before you leave. But they skip the Braintree Split and the Pike, and you can read or rest on the way.

### Try this first

Pick one day next week to make your usual trip a different way: [park at a T station](https://www.gogreenstreets.org/guides/boston-traffic#station-parking) and ride in, or [plan it by train](https://www.gogreenstreets.org/nearby?plan=1). Time it door to door and compare it with a normal day.$guidebody$,
    $guidebody$Boston's traffic is among the worst in the country. The average driver here lost 83 hours to it in 2025, the fifth most of any U.S. city ([INRIX](https://inrix.com/press-releases/2025-global-traffic-scorecard-us/)). Many of the state's jobs are in the Boston area, reached by a few bridges, tunnels and highways, and those roads are so full that one crash or storm backs everything up. You can't fix the traffic, but on many trips you can get around it.

### Why is it so bad?

- **Lots of jobs, few ways in.** The Boston region had 44% of the state's jobs in 2019 ([MassDOT](https://www.mass.gov/doc/congestion-in-the-commonwealth/download)).
- **The roads are full, so small problems spread.** When a road has no spare room, a single crash or work zone slows traffic for miles. MassDOT says the bigger problem is how unpredictable the trip is, more than the average delay.
- **A few choke points carry everyone.** The worst are the Tobin Bridge, the Zakim Bridge and the tunnels, the Southeast Expressway, the Leverett Connector, and Alewife Brook Parkway near Route 2. Seven of the state's ten worst spots are on I-93 ([MassDOT, 2025 update](https://web.archive.org/web/20251206011247/https://www.mass.gov/doc/congestion-in-the-commonwealth-2025-data-update/download)).
- **Rush hour is getting longer.** By 5 p.m. on a weekday, almost every major road inside Route 128 has some delay, and nearly half are congested as early as 2 p.m. Tuesday to Thursday is worse than Monday or Friday.

### Is driving faster in the city at rush hour?

Not by much. On weekday rush-hour trips of 3 to 8 miles in Boston, Cambridge, Somerville, Brookline and nearby, people using Shift typically went 8.4 mph by car, 8.6 mph by bike and 8.8 mph on the subway. Outside rush hour, drives of that length typically went 10.3 mph.

**About these numbers:** From 1,078 rush-hour trips of 3 to 8 miles by car, bike and subway recorded by people using Shift, July 18 to October 16, 2026 (weekdays 7 to 9:30 a.m. and 4 to 7 p.m.). Typical means half the trips were faster and half were slower.

### When should I leave to miss it?

Timing still matters. At 6 a.m., 15% of the roads inside Route 128 are congested. By 8 a.m., it's 45% ([MassDOT, 2024 data](https://web.archive.org/web/20251206011247/https://www.mass.gov/doc/congestion-in-the-commonwealth-2025-data-update/download)).

### How do I get around it from where I live?

- **MetroWest and the Mass Pike.** The commuter rail from Framingham reaches Back Bay in 35 to 56 minutes on weekday mornings. Parking at the Framingham station is {{price:parking.framinghamDay}} a day. From Worcester, the fastest morning train takes 70 minutes to South Station ([Framingham/Worcester Line schedule](https://www.mbta.com/schedules/CR-Worcester/timetable)).
- **The South Shore and the Braintree Split.** Park at the Braintree or Quincy Adams garage for {{price:parking.mbtaGarageDay}} and the Red Line reaches Park Street in under half an hour. From farther out, the Kingston and Greenbush trains take about an hour to South Station, and the Hingham ferry reaches Rowes Wharf in 30 to 40 minutes.
- **Route 128 and Burlington.** Bus 350 runs from Alewife to Burlington Mall Road in about 30 to 40 minutes. Many employers along 128 belong to a transportation management association that runs shuttles and carpool matching for their staff. [Find yours through MassCommute](https://www.masscommute.com/find-your-tma).

The trains can run late too, so check [T-Alerts](https://alerts.mbta.com) before you leave. But they skip the Braintree Split and the Pike, and you can read or rest on the way.

### Try this first

Pick one day next week to make your usual trip a different way: [park at a T station](https://www.gogreenstreets.org/guides/boston-traffic#station-parking) and ride in, or [plan it by train](https://www.gogreenstreets.org/nearby?plan=1). Time it door to door and compare it with a normal day.$guidebody$,
    'multimodal',
    'time',
    'approved',
    'micro_guide',
    ARRAY['guide_library']::text[],
    ARRAY['planning', 'mbta-basics', 'multimodal', 'short-trips']::text[],
    ARRAY['mg_transit_time', 'mg_bike_time', 'mg_transit_planning']::text[],
    false,
    3,
    timezone('America/New_York', '2026-10-17 12:00'::timestamp)
  ),
  (
    'mg_boston_parking_costs',
    'What parking costs in Boston, and cheaper ways in',
    'boston-parking-costs',
    'A workday in a downtown garage costs $30 to $47. What parking at a T station costs instead, how your employer can help, and whether a campus permit is worth it.',
    $guidebody$A full workday in a downtown Boston garage costs $30 to $47 at posted drive-up rates, and a monthly space starts at about $395. Parking at a T station is $9 a day or less, plus your fare, and your employer may be able to pay for the T with money that isn't taxed.

### What do downtown garages charge?

Posted weekday rates, October 2026:

- **Boston Common Garage:** $30 for 3 to 10 hours, or $395 a month.
- **Post Office Square:** $42 for a full day.
- **Prudential Center:** $47 for 2 to 24 hours.

Street meters downtown are $2 an hour ($3.75 in Back Bay and the Seaport), and Sundays are free ([City of Boston](https://www.boston.gov/departments/parking-clerk/how-do-parking-meters-work)). An expired meter is a $40 ticket ([Boston parking fines](https://www.boston.gov/departments/parking-clerk/parking-ticket-fines-and-codes)).

### Is it cheaper to park at a T station?

Yes. The MBTA's garages and lots are paid by phone, and most cost less than an hour downtown ([MBTA parking rates](https://www.mbta.com/parking/stations-and-rates)):

- **Alewife, Braintree, Quincy Adams, Oak Grove:** $9 a weekday.
- **Riverside (Green Line):** $6 a weekday, or $105 a month.
- **Route 128 station (commuter rail):** $7 a weekday.
- **Framingham (commuter rail):** $4 a weekday, or $70 a month.

Add the fare: $2.40 each way on the subway, or $90 a month. A monthly commuter rail pass is $232 from Route 128 and $311 from Framingham.

Of all weekday trips into downtown by people using Shift, about 1 in 9 was a drive. Of the 99 people using Shift who drove downtown on a weekday, 90 also came in by T, bike, ferry or on foot at least once. Half of those drives were shorter than 3.4 miles.

**About these numbers:** From weekday trips into downtown Boston recorded by people using Shift, June to October 2026, including 363 drives by 99 people.

### Can my employer help pay?

Employers can let you pay for the T with up to $340 a month taken out before taxes, and many pay for part of the pass outright ([IRS, 2026 limits](https://www.irs.gov/pub/irs-drop/rp-25-32.pdf)). Massachusetts also lets you deduct T fares and bike-share costs you paid yourself, up to $750 a year, for the part above $150 ([Mass.gov](https://www.mass.gov/info-details/commuter-tax-deduction-income-exclusion-and-pre-tax-savings)).

### Is a student parking permit worth it?

For most students, a T pass costs less:

- **Boston University:** a commuter permit is $900 for the fall semester; a semester T pass is $320.
- **Simmons:** $515 a semester for a permit.
- **UMass Boston:** $576 a semester for a permit.

Many schools sell the T pass at 11% off through the [MBTA Semester Pass](https://www.mbta.com/fares/college-student-semester-passes), and some pay more of it. MIT pays half for all degree students. A permit can still make sense if you commute from somewhere the T doesn't reach well, or have a job or family trips after class.

### Try this first

1. [Find the T station parking](https://www.gogreenstreets.org/guides/boston-parking-costs#station-parking) closest to where your drive starts.
2. One day next week, park there and ride in. Compare the cost and time with your usual day.$guidebody$,
    $guidebody$A full workday in a downtown Boston garage costs {{price:parking.bostonCommonDay}} to {{price:parking.prudentialDay}} at posted drive-up rates, and a monthly space starts at about {{price:parking.bostonCommonMonthly}}. Parking at a T station is {{price:parking.mbtaGarageDay}} a day or less, plus your fare, and your employer may be able to pay for the T with money that isn't taxed.

### What do downtown garages charge?

Posted weekday rates, October 2026:

- **Boston Common Garage:** {{price:parking.bostonCommonDay}} for 3 to 10 hours, or {{price:parking.bostonCommonMonthly}} a month.
- **Post Office Square:** {{price:parking.poSquareDay}} for a full day.
- **Prudential Center:** {{price:parking.prudentialDay}} for 2 to 24 hours.

Street meters downtown are {{price:parking.meterStandard}} an hour ({{price:parking.meterBackBay}} in Back Bay and the Seaport), and Sundays are free ([City of Boston](https://www.boston.gov/departments/parking-clerk/how-do-parking-meters-work)). An expired meter is a {{price:parking.meterTicket}} ticket ([Boston parking fines](https://www.boston.gov/departments/parking-clerk/parking-ticket-fines-and-codes)).

### Is it cheaper to park at a T station?

Yes. The MBTA's garages and lots are paid by phone, and most cost less than an hour downtown ([MBTA parking rates](https://www.mbta.com/parking/stations-and-rates)):

- **Alewife, Braintree, Quincy Adams, Oak Grove:** {{price:parking.mbtaGarageDay}} a weekday.
- **Riverside (Green Line):** {{price:parking.riversideDay}} a weekday, or {{price:parking.riversideMonthly}} a month.
- **Route 128 station (commuter rail):** {{price:parking.routeOneTwentyEightDay}} a weekday.
- **Framingham (commuter rail):** {{price:parking.framinghamDay}} a weekday, or {{price:parking.framinghamMonthly}} a month.

Add the fare: {{price:mbta.subwaySingle}} each way on the subway, or {{price:mbta.linkPassMonthly}} a month. A monthly commuter rail pass is {{price:mbta.crZoneTwoMonthly}} from Route 128 and {{price:mbta.crZoneFiveMonthly}} from Framingham.

Of all weekday trips into downtown by people using Shift, about 1 in 9 was a drive. Of the 99 people using Shift who drove downtown on a weekday, 90 also came in by T, bike, ferry or on foot at least once. Half of those drives were shorter than 3.4 miles.

**About these numbers:** From weekday trips into downtown Boston recorded by people using Shift, June to October 2026, including 363 drives by 99 people.

### Can my employer help pay?

Employers can let you pay for the T with up to {{price:parking.irsTransitMonthly}} a month taken out before taxes, and many pay for part of the pass outright ([IRS, 2026 limits](https://www.irs.gov/pub/irs-drop/rp-25-32.pdf)). Massachusetts also lets you deduct T fares and bike-share costs you paid yourself, up to {{price:parking.maDeductionCap}} a year, for the part above $150 ([Mass.gov](https://www.mass.gov/info-details/commuter-tax-deduction-income-exclusion-and-pre-tax-savings)).

### Is a student parking permit worth it?

For most students, a T pass costs less:

- **Boston University:** a commuter permit is {{price:parking.buPermitFall}} for the fall semester; a semester T pass is {{price:parking.buSemesterLinkPass}}.
- **Simmons:** {{price:parking.simmonsPermitSemester}} a semester for a permit.
- **UMass Boston:** {{price:parking.umbPermitSemester}} a semester for a permit.

Many schools sell the T pass at 11% off through the [MBTA Semester Pass](https://www.mbta.com/fares/college-student-semester-passes), and some pay more of it. MIT pays half for all degree students. A permit can still make sense if you commute from somewhere the T doesn't reach well, or have a job or family trips after class.

### Try this first

1. [Find the T station parking](https://www.gogreenstreets.org/guides/boston-parking-costs#station-parking) closest to where your drive starts.
2. One day next week, park there and ride in. Compare the cost and time with your usual day.$guidebody$,
    'multimodal',
    'cost',
    'approved',
    'micro_guide',
    ARRAY['guide_library']::text[],
    ARRAY['parking', 'fares', 'planning', 'mbta-basics']::text[],
    ARRAY['mg_pay_for_t', 'mg_transit_time', 'mg_bluebikes']::text[],
    false,
    3,
    timezone('America/New_York', '2026-10-17 12:00'::timestamp)
  ),
  (
    'mg_keeping_a_car',
    'Is it worth keeping a car in Boston?',
    'keeping-a-car-in-boston',
    'It depends on how often you drive and where you park it. What owning a car costs here, how often people actually use theirs, and what to use on the days you need one.',
    $guidebody$It depends on how often you drive. If you use the car a few times a month, owning one in Boston usually costs far more than renting or sharing a car for those trips. If you drive most days, or your work, your kids' activities or your family live where the T doesn't reach, keeping it often makes sense.

### What does a car cost to keep here?

AAA puts the cost of owning and running a new car 15,000 miles a year at $12,863 ([AAA, 2026](https://newsroom.aaa.com/wp-content/uploads/2026/09/AAA_YDC-Fact-Sheet_2026.pdf)). About $7,704 of that is depreciation, insurance and loan interest, which you pay whether the car moves or not. An older car that's paid off costs much less.

Massachusetts adds a few costs of its own:

- **Excise tax:** $25 for every $1,000 of the car's value, set by its age. A $30,000 car in its second year owes $450 ([Mass.gov](https://www.mass.gov/info-details/a-brief-introduction-to-motor-vehicle-excise)).
- **Registration:** $60 every two years ([RMV fees](https://www.mass.gov/info-details/massachusetts-registry-of-motor-vehicles-fees)). **Inspection:** $35 a year ([Mass.gov](https://www.mass.gov/info-details/vehicle-inspections)).
- **Parking:** Boston's resident permit is free, but it doesn't promise a space. Cambridge's permit is $25 and goes up to $75 on December 1, 2026, free for residents facing financial hardship ([City of Cambridge](https://www.cambridgema.gov/rpp)). A monthly garage space downtown starts at about $395.

### How often do people here actually drive?

About two days a week, among people using Shift who live in Boston, Cambridge, Somerville or Brookline. About 1 in 4 of their drives was under 2 miles. Many of those short trips are an easy walk or bike ride.

**About these numbers:** From 3,263 drives recorded by 65 people using Shift who live in those four cities, August 21 to October 16, 2026. Driving here includes rides in a taxi or ride-hail car.

The City of Boston found something similar: a privately owned car is driven about one hour a day, while each car in the city's car-share pilot was used about seven hours a day ([City of Boston](https://www.boston.gov/departments/transportation/car-share-boston)).

### How do I work out what's right for me?

1. For two weeks, write down each day you drive and where you went.
2. Mark the trips under 2 miles. Those are the easiest to walk, bike or take the T.
3. For the rest, [check how else you could make the trip](https://www.gogreenstreets.org/guides/keeping-a-car-in-boston#trip-planner): the T, a Bluebike, a car share, or a ride with someone.

If only a few trips a month really need a car, sharing or renting will cost much less than keeping one. If most of them do, keeping the car makes sense.

### What do I use on the days I need a car?

Car-share services rent cars by the hour from lots across the city, with gas and insurance included. Zipcar's standard plan is $9 a month plus the hourly or daily rate. A regular rental works for weekends away. Ride-hail fills the gaps. If you have kids under 8, bring a car seat: state law requires one in an Uber or Lyft unless the child is over 57 inches tall.

### How do I sell a car in Massachusetts?

Cancel the registration online with your MyMassGov account, which is free, and send the receipt to your insurer. You don't return the plates: cut them in half and recycle them where your town accepts them, or throw them away. Once the car is sold, ask your town's assessor for an excise refund for the months you no longer owned it ([Mass.gov](https://www.mass.gov/how-to/cancel-your-vehicle-registration-license-plates)).

### Try this first

1. Pick one short trip you usually drive, like groceries or the gym, and [see how long it takes by T or by bike](https://www.gogreenstreets.org/guides/keeping-a-car-in-boston#trip-planner).
2. Make that trip without the car for the next two weeks, and see how often you miss it.$guidebody$,
    $guidebody$It depends on how often you drive. If you use the car a few times a month, owning one in Boston usually costs far more than renting or sharing a car for those trips. If you drive most days, or your work, your kids' activities or your family live where the T doesn't reach, keeping it often makes sense.

### What does a car cost to keep here?

AAA puts the cost of owning and running a new car 15,000 miles a year at {{price:driving.aaaAnnualOwnership}} ([AAA, 2026](https://newsroom.aaa.com/wp-content/uploads/2026/09/AAA_YDC-Fact-Sheet_2026.pdf)). About {{price:driving.aaaFixedAnnual}} of that is depreciation, insurance and loan interest, which you pay whether the car moves or not. An older car that's paid off costs much less.

Massachusetts adds a few costs of its own:

- **Excise tax:** {{price:driving.maExcisePerThousand}} for every $1,000 of the car's value, set by its age. A $30,000 car in its second year owes $450 ([Mass.gov](https://www.mass.gov/info-details/a-brief-introduction-to-motor-vehicle-excise)).
- **Registration:** {{price:driving.maRegistrationTwoYears}} every two years ([RMV fees](https://www.mass.gov/info-details/massachusetts-registry-of-motor-vehicles-fees)). **Inspection:** {{price:driving.maInspection}} a year ([Mass.gov](https://www.mass.gov/info-details/vehicle-inspections)).
- **Parking:** Boston's resident permit is free, but it doesn't promise a space. Cambridge's permit is {{price:driving.cambridgePermitNow}} and goes up to {{price:driving.cambridgePermitDecember}} on December 1, 2026, free for residents facing financial hardship ([City of Cambridge](https://www.cambridgema.gov/rpp)). A monthly garage space downtown starts at about {{price:parking.bostonCommonMonthly}}.

### How often do people here actually drive?

About two days a week, among people using Shift who live in Boston, Cambridge, Somerville or Brookline. About 1 in 4 of their drives was under 2 miles. Many of those short trips are an easy walk or bike ride.

**About these numbers:** From 3,263 drives recorded by 65 people using Shift who live in those four cities, August 21 to October 16, 2026. Driving here includes rides in a taxi or ride-hail car.

The City of Boston found something similar: a privately owned car is driven about one hour a day, while each car in the city's car-share pilot was used about seven hours a day ([City of Boston](https://www.boston.gov/departments/transportation/car-share-boston)).

### How do I work out what's right for me?

1. For two weeks, write down each day you drive and where you went.
2. Mark the trips under 2 miles. Those are the easiest to walk, bike or take the T.
3. For the rest, [check how else you could make the trip](https://www.gogreenstreets.org/guides/keeping-a-car-in-boston#trip-planner): the T, a Bluebike, a car share, or a ride with someone.

If only a few trips a month really need a car, sharing or renting will cost much less than keeping one. If most of them do, keeping the car makes sense.

### What do I use on the days I need a car?

Car-share services rent cars by the hour from lots across the city, with gas and insurance included. Zipcar's standard plan is {{price:driving.zipcarStandardMonthly}} a month plus the hourly or daily rate. A regular rental works for weekends away. Ride-hail fills the gaps. If you have kids under 8, bring a car seat: state law requires one in an Uber or Lyft unless the child is over 57 inches tall.

### How do I sell a car in Massachusetts?

Cancel the registration online with your MyMassGov account, which is free, and send the receipt to your insurer. You don't return the plates: cut them in half and recycle them where your town accepts them, or throw them away. Once the car is sold, ask your town's assessor for an excise refund for the months you no longer owned it ([Mass.gov](https://www.mass.gov/how-to/cancel-your-vehicle-registration-license-plates)).

### Try this first

1. Pick one short trip you usually drive, like groceries or the gym, and [see how long it takes by T or by bike](https://www.gogreenstreets.org/guides/keeping-a-car-in-boston#trip-planner).
2. Make that trip without the car for the next two weeks, and see how often you miss it.$guidebody$,
    'multimodal',
    'cost',
    'approved',
    'micro_guide',
    ARRAY['guide_library']::text[],
    ARRAY['planning', 'parking', 'getting-started']::text[],
    ARRAY['mg_walking_vs_driving', 'mg_bluebikes', 'mg_pay_for_t']::text[],
    false,
    4,
    timezone('America/New_York', '2026-10-17 12:00'::timestamp)
  ),
  (
    'mg_t_backup_plans',
    'Backup plans for when the T is late or closed',
    'backup-plans-for-the-t',
    'The T runs on time far more often than it did two years ago, but closures still happen. How to pick a backup before you need one.',
    $guidebody$When the T is late or a line is closed, your best backup is usually a bus that runs near your line, a Bluebike, or the commuter rail. Pick one the night before a planned closure, [check the MBTA's alerts](https://www.mbta.com/alerts) before you leave, and give yourself extra time if you take the shuttle.

### Is the T really less reliable than it used to be?

No. It's more reliable than it was a few years ago. The MBTA counts a Red, Orange or Blue Line trip as on time when it arrives within five minutes of the expected time. By late 2025 about 92% of trips met that bar, up from about 25% in late 2023 ([Christian Science Monitor](https://www.csmonitor.com/Business/2025/1115/boston-mbta-phillip-eng)). Current numbers are on the [MBTA's reliability page](https://www.mbta.com/performance-metrics/service-reliability).

In December 2024 the MBTA cleared more than 220 slow zones, stretches where trains must go slower for safety ([MBTA](https://www.mbta.com/projects/track-improvement-program)). Short ones for repairs have come and gone since. In the last published data, from May 2026, there were a few, including a 10 mph zone at Braintree ([TransitMatters](https://dashboard.transitmatters.org/system/slowzones)).

Planned repair closures still happen, like the Red Line's closure from Alewife to Park Street on July 21 to 30, 2026.

### What did riders do during the July 2026 Red Line closure?

Among people using Shift who rode the Red Line regularly, driving went from about a quarter of their trips to about a third during the closure. Biking went up too, from 15% to 18% of trips. Yet at rush hour, drives of 3 to 8 miles in Boston, Cambridge, Somerville, Brookline and nearby were no faster than biking or the subway: typically 8.4 mph by car, 8.6 by bike and 8.8 on the subway.

**About these numbers:** From trips recorded by 17 to 22 regular Red Line riders using Shift, June 22 to July 30, 2026 (a small group, in midsummer), and 1,078 rush-hour trips by people using Shift, July 18 to October 16, 2026. Typical means half the trips were faster and half were slower.

### What are my backup options?

- **A bus near your line.** For the Red Line, route 77 runs from Arlington Heights to Harvard about every 10 to 15 minutes at rush hour, and route 96 runs from Medford Square to Harvard. [Our trip planner](https://www.gogreenstreets.org/guides/backup-plans-for-the-t#trip-planner) shows the bus options for your own trip. A bus ride is $1.70. Through February 2027, if you switch to the subway within two hours on the same card or phone, you pay only the higher fare.
- **Bluebikes.** Nearly 600 stations in 13 cities and towns. A single ride is $3 and a day pass is $11.99. Members get 45 minutes per ride on a classic bike, and people who qualify by income can join for $5 a month.
- **The commuter rail.** If you live near a station, it can skip the closed stretch. During some closures the MBTA makes it free on the affected stretch: in July 2026 it was free between Porter and North Station.
- **The free shuttle.** Shuttles are free and accessible, but slow. In July the MBTA told riders to allow at least 70 minutes from Alewife to Park Street.

[Nearby](https://www.gogreenstreets.org/nearby) on our website, and Around You in the Shift app, show the next buses and the bikes free at the closest Bluebikes docks.

### Is the Green Line slower than walking?

No, for most trips. On trips of 0.75 to 2 miles, Green Line rides recorded by people using Shift typically went 6.4 mph, more than twice their typical walking speed of 2.8 mph. Those times may leave out some platform waiting, so for one or two stops downtown, where stations are a quarter mile apart, walking can come close.

**About these numbers:** From 324 Green Line trips and 3,111 walks of 0.75 to 2 miles recorded by people using Shift, June to October 2026. Typical means half were faster and half were slower.

### Should I get an e-bike or a scooter?

In Massachusetts, e-bikes that stop helping at 20 mph need no license. You can ride them on roads, in bike lanes and on most paved paths, but not on sidewalks ([MassBike's e-bike guide](https://www.massbike.org/ebikesfaq)). Motorized scooters need a driver's license or learner's permit and a helmet, and can't be ridden between sunset and sunrise ([state law](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXIV/Chapter90/Section1E)). A bill that would update these rules is still being worked out at the State House. The state's e-bike rebate is closed for 2026.

### Try this first

Set up your backup now, before you need it.

1. [Plan your usual trip](https://www.gogreenstreets.org/guides/backup-plans-for-the-t#trip-planner). You'll see the bus or train and the bike route, and the map shows live arrivals and the closest Bluebikes docks.
2. [Sign up for T-Alerts](https://alerts.mbta.com/) for your line, so you hear about a closure before you leave home.$guidebody$,
    $guidebody$When the T is late or a line is closed, your best backup is usually a bus that runs near your line, a Bluebike, or the commuter rail. Pick one the night before a planned closure, [check the MBTA's alerts](https://www.mbta.com/alerts) before you leave, and give yourself extra time if you take the shuttle.

### Is the T really less reliable than it used to be?

No. It's more reliable than it was a few years ago. The MBTA counts a Red, Orange or Blue Line trip as on time when it arrives within five minutes of the expected time. By late 2025 about 92% of trips met that bar, up from about 25% in late 2023 ([Christian Science Monitor](https://www.csmonitor.com/Business/2025/1115/boston-mbta-phillip-eng)). Current numbers are on the [MBTA's reliability page](https://www.mbta.com/performance-metrics/service-reliability).

In December 2024 the MBTA cleared more than 220 slow zones, stretches where trains must go slower for safety ([MBTA](https://www.mbta.com/projects/track-improvement-program)). Short ones for repairs have come and gone since. In the last published data, from May 2026, there were a few, including a 10 mph zone at Braintree ([TransitMatters](https://dashboard.transitmatters.org/system/slowzones)).

Planned repair closures still happen, like the Red Line's closure from Alewife to Park Street on July 21 to 30, 2026.

### What did riders do during the July 2026 Red Line closure?

Among people using Shift who rode the Red Line regularly, driving went from about a quarter of their trips to about a third during the closure. Biking went up too, from 15% to 18% of trips. Yet at rush hour, drives of 3 to 8 miles in Boston, Cambridge, Somerville, Brookline and nearby were no faster than biking or the subway: typically 8.4 mph by car, 8.6 by bike and 8.8 on the subway.

**About these numbers:** From trips recorded by 17 to 22 regular Red Line riders using Shift, June 22 to July 30, 2026 (a small group, in midsummer), and 1,078 rush-hour trips by people using Shift, July 18 to October 16, 2026. Typical means half the trips were faster and half were slower.

### What are my backup options?

- **A bus near your line.** For the Red Line, route 77 runs from Arlington Heights to Harvard about every 10 to 15 minutes at rush hour, and route 96 runs from Medford Square to Harvard. [Our trip planner](https://www.gogreenstreets.org/guides/backup-plans-for-the-t#trip-planner) shows the bus options for your own trip. A bus ride is {{price:mbta.busSingle}}. Through February 2027, if you switch to the subway within two hours on the same card or phone, you pay only the higher fare.
- **Bluebikes.** Nearly 600 stations in 13 cities and towns. A single ride is {{price:bluebikes.singleRide}} and a day pass is {{price:bluebikes.dayPass}}. Members get 45 minutes per ride on a classic bike, and people who qualify by income can join for {{price:bluebikes.incomeEligibleMonthly}} a month.
- **The commuter rail.** If you live near a station, it can skip the closed stretch. During some closures the MBTA makes it free on the affected stretch: in July 2026 it was free between Porter and North Station.
- **The free shuttle.** Shuttles are free and accessible, but slow. In July the MBTA told riders to allow at least 70 minutes from Alewife to Park Street.

[Nearby](https://www.gogreenstreets.org/nearby) on our website, and Around You in the Shift app, show the next buses and the bikes free at the closest Bluebikes docks.

### Is the Green Line slower than walking?

No, for most trips. On trips of 0.75 to 2 miles, Green Line rides recorded by people using Shift typically went 6.4 mph, more than twice their typical walking speed of 2.8 mph. Those times may leave out some platform waiting, so for one or two stops downtown, where stations are a quarter mile apart, walking can come close.

**About these numbers:** From 324 Green Line trips and 3,111 walks of 0.75 to 2 miles recorded by people using Shift, June to October 2026. Typical means half were faster and half were slower.

### Should I get an e-bike or a scooter?

In Massachusetts, e-bikes that stop helping at 20 mph need no license. You can ride them on roads, in bike lanes and on most paved paths, but not on sidewalks ([MassBike's e-bike guide](https://www.massbike.org/ebikesfaq)). Motorized scooters need a driver's license or learner's permit and a helmet, and can't be ridden between sunset and sunrise ([state law](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXIV/Chapter90/Section1E)). A bill that would update these rules is still being worked out at the State House. The state's e-bike rebate is closed for 2026.

### Try this first

Set up your backup now, before you need it.

1. [Plan your usual trip](https://www.gogreenstreets.org/guides/backup-plans-for-the-t#trip-planner). You'll see the bus or train and the bike route, and the map shows live arrivals and the closest Bluebikes docks.
2. [Sign up for T-Alerts](https://alerts.mbta.com/) for your line, so you hear about a closure before you leave home.$guidebody$,
    'multimodal',
    'planning',
    'approved',
    'micro_guide',
    ARRAY['guide_library']::text[],
    ARRAY['mbta-basics', 'planning', 'bike-share', 'multimodal']::text[],
    ARRAY['mg_bluebikes', 'mg_subway_vs_bus', 'mg_transit_planning']::text[],
    false,
    4,
    timezone('America/New_York', '2026-10-17 12:00'::timestamp)
  ),
  (
    'mg_getting_around_boston',
    'Getting around Boston by T, bike and foot',
    'getting-around-boston',
    'Do you need a car to live in Boston, Cambridge or Somerville? For most people, no. How people here get around, what it costs, and the neighborhoods where it''s easiest.',
    $guidebody$For most people who live in Boston, Cambridge or Somerville, a car is optional. About a third of households in Boston and Cambridge don't own one ([Census, 2020 to 2024](https://censusreporter.org/data/table/?table=B25044&geo_ids=16000US2507000,16000US2511000,16000US2562535)). The neighborhoods are close together, and walking, the T and Bluebikes cover most everyday trips. For the few trips that need a car, you can rent one by the hour.

### How do people here get to work?

In Boston, about a third of workers drive alone to work. About 1 in 5 takes transit, and about 1 in 7 walks. In Cambridge, walking (19%) and transit (18%) are each about as common as driving alone (20%), and nearly 1 in 12 bikes. These are U.S. Census figures for 2020 to 2024 ([Census Reporter](https://censusreporter.org/data/table/?table=B08301&geo_ids=16000US2507000,16000US2511000,16000US2562535)).

People using Shift who live in these cities show the same thing for every kind of trip, not only the commute. About 7 in 10 of their trips were on foot, by bike or by transit, and more than 4 in 10 were walks.

**About these numbers:** From 12,256 trips recorded by 65 people using Shift who live in Boston, Cambridge, Somerville or Brookline, August 21 to October 16, 2026.

### What's the cheapest way to get around?

Walking, for anything under a mile or so. After that:

- **The T:** $2.40 on the subway, $1.70 on the bus, or $90 a month for unlimited subway and bus rides. Through February 2027, if you switch between the bus and subway within two hours on the same card or phone, you pay only the higher of the two fares.
- **Reduced fares:** people 65 and older, people with disabilities, and people on SNAP, MassHealth and some other programs pay $1.10 on the subway, $0.85 on the bus, or $30 a month ([how to apply](https://www.mbta.com/fares/reduced)). Children 11 and under ride free, and so do riders 75 and older who no longer drive.
- **Bluebikes:** $3 a ride, or $133.50 a year with 45 minutes per ride, at nearly 600 stations in 13 cities and towns.

### Which neighborhoods are easiest?

The ones where shops, a T stop and a Bluebikes dock are all a short walk away. On walkscore.com's 100-point scale, Beacon Hill, Back Bay, the South End and Fenway-Kenmore score 95 or higher for walking and over 90 for transit. Davis Square in Somerville scores 97 for walking, and Cambridge as a whole scores 96 for biking. Central Maverick Square in East Boston and Uphams Corner in Dorchester both score 90 or higher for walking. (Scores as listed in October 2026.)

The same pattern holds beyond Boston. Town centers with a commuter rail station and Bluebikes, like Salem, work much the same way at a smaller scale.

### Can a family with young kids do it?

Many do. Children 11 and under ride the T free, strollers are welcome on the subway, and most stations have elevators. For daycare drop-offs and groceries, many parents use a cargo bike ([how families use them](/guides/what-you-can-do-with-an-e-cargo-bike)).

One thing to know before you rely on ride-hail: Massachusetts law requires a car seat for children under 8 unless they're over 57 inches tall, and that applies in an Uber or Lyft ([state law](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXIV/Chapter90/Section7AA)). Taxis without child seats are exempt.

### What about the trips that need a car?

Car-share services like Zipcar rent cars by the hour from lots across the city, with gas and insurance included. A regular rental works for weekend trips.

### Try this first

Before you sign a lease, [put the address into our trip planner](https://www.gogreenstreets.org/guides/getting-around-boston#trip-planner) with the three places you go most: work or school, groceries, and one place you love. It shows how long each trip takes by T and by bike.$guidebody$,
    $guidebody$For most people who live in Boston, Cambridge or Somerville, a car is optional. About a third of households in Boston and Cambridge don't own one ([Census, 2020 to 2024](https://censusreporter.org/data/table/?table=B25044&geo_ids=16000US2507000,16000US2511000,16000US2562535)). The neighborhoods are close together, and walking, the T and Bluebikes cover most everyday trips. For the few trips that need a car, you can rent one by the hour.

### How do people here get to work?

In Boston, about a third of workers drive alone to work. About 1 in 5 takes transit, and about 1 in 7 walks. In Cambridge, walking (19%) and transit (18%) are each about as common as driving alone (20%), and nearly 1 in 12 bikes. These are U.S. Census figures for 2020 to 2024 ([Census Reporter](https://censusreporter.org/data/table/?table=B08301&geo_ids=16000US2507000,16000US2511000,16000US2562535)).

People using Shift who live in these cities show the same thing for every kind of trip, not only the commute. About 7 in 10 of their trips were on foot, by bike or by transit, and more than 4 in 10 were walks.

**About these numbers:** From 12,256 trips recorded by 65 people using Shift who live in Boston, Cambridge, Somerville or Brookline, August 21 to October 16, 2026.

### What's the cheapest way to get around?

Walking, for anything under a mile or so. After that:

- **The T:** {{price:mbta.subwaySingle}} on the subway, {{price:mbta.busSingle}} on the bus, or {{price:mbta.linkPassMonthly}} a month for unlimited subway and bus rides. Through February 2027, if you switch between the bus and subway within two hours on the same card or phone, you pay only the higher of the two fares.
- **Reduced fares:** people 65 and older, people with disabilities, and people on SNAP, MassHealth and some other programs pay {{price:mbta.reducedSubway}} on the subway, {{price:mbta.reducedBus}} on the bus, or {{price:mbta.reducedLinkPass}} a month ([how to apply](https://www.mbta.com/fares/reduced)). Children 11 and under ride free, and so do riders 75 and older who no longer drive.
- **Bluebikes:** {{price:bluebikes.singleRide}} a ride, or {{price:bluebikes.annual}} a year with 45 minutes per ride, at nearly 600 stations in 13 cities and towns.

### Which neighborhoods are easiest?

The ones where shops, a T stop and a Bluebikes dock are all a short walk away. On walkscore.com's 100-point scale, Beacon Hill, Back Bay, the South End and Fenway-Kenmore score 95 or higher for walking and over 90 for transit. Davis Square in Somerville scores 97 for walking, and Cambridge as a whole scores 96 for biking. Central Maverick Square in East Boston and Uphams Corner in Dorchester both score 90 or higher for walking. (Scores as listed in October 2026.)

The same pattern holds beyond Boston. Town centers with a commuter rail station and Bluebikes, like Salem, work much the same way at a smaller scale.

### Can a family with young kids do it?

Many do. Children 11 and under ride the T free, strollers are welcome on the subway, and most stations have elevators. For daycare drop-offs and groceries, many parents use a cargo bike ([how families use them](/guides/what-you-can-do-with-an-e-cargo-bike)).

One thing to know before you rely on ride-hail: Massachusetts law requires a car seat for children under 8 unless they're over 57 inches tall, and that applies in an Uber or Lyft ([state law](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXIV/Chapter90/Section7AA)). Taxis without child seats are exempt.

### What about the trips that need a car?

Car-share services like Zipcar rent cars by the hour from lots across the city, with gas and insurance included. A regular rental works for weekend trips.

### Try this first

Before you sign a lease, [put the address into our trip planner](https://www.gogreenstreets.org/guides/getting-around-boston#trip-planner) with the three places you go most: work or school, groceries, and one place you love. It shows how long each trip takes by T and by bike.$guidebody$,
    'multimodal',
    'planning',
    'approved',
    'micro_guide',
    ARRAY['guide_library']::text[],
    ARRAY['getting-started', 'planning', 'mbta-basics', 'bike-share', 'family']::text[],
    ARRAY['mg_pay_for_t', 'mg_bluebikes', 'mg_cargo_bike']::text[],
    false,
    4,
    timezone('America/New_York', '2026-10-17 12:00'::timestamp)
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  slug = EXCLUDED.slug,
  summary = EXCLUDED.summary,
  body = EXCLUDED.body,
  body_template = EXCLUDED.body_template,
  primary_mode = EXCLUDED.primary_mode,
  primary_barrier = EXCLUDED.primary_barrier,
  status = EXCLUDED.status,
  content_type = EXCLUDED.content_type,
  surfaces = EXCLUDED.surfaces,
  topics = EXCLUDED.topics,
  related_guides = EXCLUDED.related_guides,
  is_starter = EXCLUDED.is_starter,
  read_time_minutes = EXCLUDED.read_time_minutes,
  last_reviewed_at = EXCLUDED.last_reviewed_at;
  -- created_at intentionally not in SET so existing rows keep their original timestamp.
  -- external_links and expires_at are not in this seed; Shift migrations own them.
  -- Every column this seed DOES own is overwritten on each run, so a fix to
  -- title/summary/body made anywhere else is lost on the next rebuild (that is
  -- how the 2026-10-05 run reverted Shift migrations 01052 and 01058). Edit the
  -- markdown, not the database.

COMMIT;
