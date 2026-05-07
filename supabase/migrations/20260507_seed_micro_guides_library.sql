-- Seed migration for the micro-guide library (20 guides).
-- Generated from content/micro-guides-library.md by
-- scripts/build-micro-guides-migration.mjs — do not edit by hand.
--
-- Re-running the parser overwrites this file. The markdown is the source of truth.

BEGIN;

-- 1. Mode cleanup: any pre-existing 'bike' rows fold into 'cycling'.
UPDATE content_items SET primary_mode = 'cycling' WHERE primary_mode = 'bike';

-- 2. Deprecate guides superseded by mg_bluebikes.
UPDATE content_items SET status = 'deprecated'
  WHERE id IN ('mg_blue_bikes', 'mg_return_bluebike');

-- 3. Upsert the 20-guide library.
INSERT INTO content_items (
  id, title, slug, summary, body, primary_mode, primary_barrier, status,
  content_type, surfaces, topics, related_guides, is_starter,
  read_time_minutes, last_reviewed_at
) VALUES
  (
    'mg_low_stress_routes',
    'Picking a bike route that feels comfortable',
    'picking-a-bike-route',
    'The fastest route isn''t always the right route. A five-minute-longer ride on protected infrastructure is almost always better than a "direct" route on a four-lane stretch with no bike lane. Here''s how to pick well, especially when you''re new.',
    $guidebody$The fastest route isn't always the right route. A five-minute-longer ride on protected infrastructure is almost always better than a "direct" route on a four-lane stretch with no bike lane. Here's how to pick well, especially when you're new.

**1. Know your infrastructure types.** Protected lanes (physically separated from traffic) are the most comfortable. Shared-use paths like the Minuteman or the Charles River paths are completely separate from cars. Painted lanes are good but watch the door zone. Neighborhood streets are often fine even without bike-specific infrastructure.

**2. Use a bike-specific routing app.** Google Maps' cycling layer shows infrastructure. The Strava global heatmap shows where cyclists actually ride — a useful proxy for where it's both safe and pleasant.

**3. Start with paths, not roads.** Before committing to a road-based commute, ride one of the great regional paths once for confidence: the Minuteman (Arlington–Bedford), the Charles River paths, the Somerville Community Path, or the Southwest Corridor. Flat, scenic, fully separated.

**4. One block off changes everything.** If your route includes a busy stretch, look at the parallel street one block over. It's almost always quieter and only adds a minute or two.

**5. Try it on a weekend first.** Ride your planned commute once on a Saturday morning with no time pressure. Knowing the route removes most of the stress before you ride it on a Tuesday.

**Try this first:** Pull up Google Maps with the cycling layer on and look at your typical destination. You'll often spot a path or protected lane within a block of where you were planning to ride.$guidebody$,
    'cycling',
    'routes',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['routes', 'getting-started', 'infrastructure']::text[],
    ARRAY['mg_first_bike_lane', 'mg_bike_commute_gear']::text[],
    true,
    2,
    now()
  ),
  (
    'mg_first_bike_lane',
    'Your first ride in a bike lane',
    'your-first-ride-in-a-bike-lane',
    'Bike lanes in Boston range from painted lines on the road to fully separated paths with their own signals. Here''s what to know for your first time in one.',
    $guidebody$Bike lanes in Boston range from painted lines on the road to fully separated paths with their own signals. Here's what to know for your first time in one.

**Protected lanes** (also called separated or cycle tracks) have a physical barrier between you and car traffic — usually parked cars, posts, or a curb. These are the most comfortable lanes in the city. Stay to the right, pass on the left, and watch for pedestrians stepping into the lane at crossings.

**Painted bike lanes** are marked with white lines and bike symbols on the road surface. Cars aren't supposed to be in them, but doors from parked cars can swing open. Ride toward the left side of the lane — far enough from parked cars that an opening door won't reach you. Cyclists call this the "door zone," and avoiding it becomes second nature fast.

**Green paint** on the road marks areas where bikes and cars are likely to cross paths — intersections, merge zones, driveways. It's a heads-up, not a hazard. Just keep your line and make eye contact with turning drivers when you can.

**Sharrows** (shared lane arrows, the ones with the chevrons) mean you share the lane with cars. You're allowed to take the full lane — ride in the center so cars pass you safely by changing lanes rather than squeezing by.

**The one habit that matters most:** Look behind you before changing your position in the lane. A quick shoulder check before moving left to pass or avoid something — it's the cycling equivalent of checking your mirror.$guidebody$,
    'cycling',
    'safety',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library', 'roam_leg']::text[],
    ARRAY['safety', 'getting-started', 'infrastructure']::text[],
    ARRAY['mg_low_stress_routes', 'mg_bike_commute_gear']::text[],
    true,
    2,
    now()
  ),
  (
    'mg_bike_commute_gear',
    'The gear that actually matters for bike commuting',
    'bike-commute-gear',
    'You don''t need much equipment to bike-commute, but a few things make the difference between a good ride and a frustrating one. Here''s what''s worth investing in.',
    $guidebody$You don't need much equipment to bike-commute, but a few things make the difference between a good ride and a frustrating one. Here's what's worth investing in.

**1. A helmet — non-negotiable.** A $40 helmet protects you about as well as a $200 one, but the kind of safety tech matters more than the price tag. Look for two things on the label: **MIPS** (a slip-plane layer that reduces rotational forces in a crash) and a rating from the **Virginia Tech Helmet Lab**, which independently star-rates helmets from 1 to 5. A 4- or 5-star MIPS helmet is plenty for daily commuting. Replace it after any crash, even if it looks fine.

**2. Lights, front and rear.** Lights are the single biggest thing you can do for safety. Most crashes happen because a driver didn't see the cyclist, and visibility is most of the fix. Look for at least 200 lumens on the front, a steady-and-flash pattern on the back, and run them even during the day.

**3. A real lock.** Cable locks get cut in seconds. A solid U-lock from Kryptonite or Abus runs $30-60 and pays for itself the first time you don't lose your bike.

**4. A way to carry stuff.** This is the gear question that's most underestimated.
- **Backpack** — fine for short rides, but it'll make your back sweaty.
- **Messenger bag** — better airflow than a backpack, decent capacity.
- **Panniers** (bags that mount on a rear rack) — the most comfortable for daily commutes. Your back stays dry and you can carry a real load. Get waterproof ones or use rain covers; Boston rain is real.
- **Basket** — old-school, perfect for grocery runs.

**5. Fenders if you ride in any weather.** A $25 fender set keeps a stripe of road grime off your back and pants. The single best rain-season investment.

**Try this first:** If you only buy two things, make them lights and a U-lock. Everything else can wait until you know what you actually need.$guidebody$,
    'cycling',
    'gear',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['gear', 'getting-started', 'safety']::text[],
    ARRAY['mg_bike_lock', 'mg_bike_sweat', 'mg_biking_in_rain']::text[],
    true,
    2,
    now()
  ),
  (
    'mg_bike_time',
    'When biking is actually the faster option',
    'when-biking-is-faster',
    'Biking is faster than driving for more trips than people expect — once you count door-to-door time. Here''s when it actually wins.',
    $guidebody$Biking is faster than driving for more trips than people expect — once you count door-to-door time. Here's when it actually wins.

**1. Trips under three miles, especially in dense neighborhoods.** Short urban trips on a bike are usually 15-25 minutes door-to-door. The same trip by car, including parking-search time, often comes out about the same — sometimes longer. The "driving is faster" intuition is mostly built on suburban-style trips, not city ones.

**2. Anywhere parking is hard.** Cambridge, Somerville, the Seaport, downtown Boston, anywhere near a hospital or a college — parking can take 5-15 minutes plus a walk from where you ended up. Biking puts you at the door.

**3. Rush hour, on protected infrastructure.** When traffic crawls, signal-independent routes — the Charles River paths, the Minuteman, the Southwest Corridor — keep moving at the same speed they always do. Predictable arrival times are part of why people bike-commute even when driving is an option.

**4. Longer trips, on an e-bike.** A 5-7 mile commute that's a slow slog on a regular bike is a comfortable 20-25 minute ride on an e-bike, with little exertion. E-bikes extend the range where biking competes with driving on time, often well past five miles.

**5. Errands and trips with kids — on an e-cargo bike.** An e-cargo bike (a long-tail or front-bucket frame with pedal-assist) can carry two kids plus a week of groceries, and uses bike infrastructure that skips the school-pickup line entirely. It handles most of what people assume requires a car. You don't have to buy one to find out: [CargoB](https://www.ridecargob.com/) rents cargo bikes by the minute around the region, and [Community Pedal Power](https://communitypedalpower.org/) in Cambridge runs an e-bike library where you can borrow one for free.

**Try this first:** Time your normal commute door-to-door once, including walking to and from the car and finding parking. Then time the same trip on a bike. Most people are surprised.$guidebody$,
    'cycling',
    'time',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['motivation', 'e-bikes', 'short-trips']::text[],
    ARRAY['mg_low_stress_routes', 'mg_cargo_bike', 'mg_bike_commute_gear']::text[],
    false,
    2,
    now()
  ),
  (
    'mg_bike_sweat',
    'How to bike-commute without breaking a sweat',
    'bike-commute-without-sweat',
    'Worrying about arriving sweaty stops a lot of people from biking to work. There are several layers of fix, and the most effective one doesn''t involve any extra gear at all.',
    $guidebody$Worrying about arriving sweaty stops a lot of people from biking to work. There are several layers of fix, and the most effective one doesn't involve any extra gear at all.

**1. The simplest fix: sweat less to begin with.** An e-bike does most of the work for you — you'll arrive at a 5-mile destination feeling about the same as after a 1-mile walk. Bluebikes has a growing fleet of e-bikes, and with a Monthly or Annual membership the rate drops to $0.10/min on top of the membership — affordable for daily commute use.

**2. Pace yourself on a regular bike.** You control the pace. Riding at "conversation pace" — slow enough you could chat with someone alongside you — generates very little sweat, even on warm days. The few extra minutes is less time than the cool-down you'd otherwise need.

**3. Pick a flatter route.** A 200-foot climb makes a real difference in sweat output. Google Maps' cycling layer shows elevation; a route that's a half-mile longer is often far cooler if it avoids a hill.

**4. Wear the right stuff for the ride.** You don't need cycling-specific clothes, but a few choices help:
- **Synthetic or wool layers wick sweat better than cotton.** Cotton holds moisture and stays heavy.
- **For longer rides, ride in athletic clothes and change at your destination.** Pack work clothes the night before, or keep a few days' worth at the office.
- **A breathable layer beats a heavy coat, even in cold weather.** You'll warm up fast on the bike.

**5. Build an arrival kit.** Keep these at your desk and the issue mostly disappears: deodorant, athletic body wipes (Action Wipes is one well-known option — make sure you're getting wipes designed for the gym, not bathroom wipes), a spare shirt, a small towel. Many workplaces also have showers or a fitness center; ask facilities.

**6. Plan around the worst days.** August humidity is real. On the worst handful of days, take the T or work from home. Keeping the streak intact for everything else matters more than perfection.

**Try this first:** Ride your normal route at conversation pace once. Most people overestimate how hard you have to work to bike-commute, and how warm you actually get.$guidebody$,
    'cycling',
    'sweating',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['gear', 'e-bikes', 'getting-started']::text[],
    ARRAY['mg_bike_commute_gear', 'mg_cargo_bike']::text[],
    false,
    2,
    now()
  ),
  (
    'mg_cargo_bike',
    'What you can do with an e-cargo bike',
    'what-you-can-do-with-an-e-cargo-bike',
    'An e-cargo bike is a regular bike with two changes: a longer or wider frame for carrying things, and a pedal-assist motor that helps with hills and loads. People who try one find it covers most of the trips they''d assumed required a car — daycare drop-off, the weekly grocery run, hardware store hauls, beach day, the occasional Costco trip.',
    $guidebody$An e-cargo bike is a regular bike with two changes: a longer or wider frame for carrying things, and a pedal-assist motor that helps with hills and loads. People who try one find it covers most of the trips they'd assumed required a car — daycare drop-off, the weekly grocery run, hardware store hauls, beach day, the occasional Costco trip.

**The main types:**
- **Long-tail** (Tern GSD, Yuba Spicy Curry, RadWagon): A standard frame stretched to fit two kids on the back rack, plus panniers below. Most popular for family use.
- **Front-bucket** (Urban Arrow, Bullitt, Riese & Müller Load): A box in front of the rider; kids face you. Excellent for cargo and very young children.
- **Midtail** (Tern HSD, Specialized Globe Haul): Smaller and easier to park than a long-tail. One kid plus groceries.

**What they handle:**
- 100+ pound loads (kids and groceries) without strain
- Hills that would be punishing on a regular bike
- 30-50 mile range on a charge
- Most short-to-medium errands more pleasantly than driving them, since you skip parking

**How to try one without buying:**
- **[Community Pedal Power](https://communitypedalpower.org/)** (Cambridge) runs a free e-bike library — borrow one for a weekend.
- **[CargoB](https://www.ridecargob.com/)** rents e-cargo bikes by the minute around Greater Boston.
- Most local bike shops do test rides; some run demo days.

**A few practical realities:**
- **Parking:** Long-tails and front-bucket bikes don't fit in standard bike racks. Plan for street parking with a heavy lock, or look for bike corrals.
- **Range:** A typical day uses 10-30% of the battery. Most people charge once or twice a week.
- **Price:** New e-cargo bikes run $3,000-$8,000. The used market is solid; bike libraries and rentals are how most people figure out which type fits before buying.

**Try this first:** Borrow one from Community Pedal Power for a weekend. Use it for one school pickup and one grocery run. You'll know quickly whether it fits your life.$guidebody$,
    'cycling',
    NULL,
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['e-bikes', 'cargo', 'family', 'getting-started']::text[],
    ARRAY['mg_bike_sweat', 'mg_bike_commute_gear', 'mg_bike_time', 'mg_walking_carrying']::text[],
    false,
    2,
    now()
  ),
  (
    'mg_bluebikes',
    'Bluebikes from start to finish',
    'how-to-use-bluebikes',
    'Bluebikes is Greater Boston''s bike-share system, with 400+ stations across Boston, Brookline, Cambridge, Somerville, Everett, Chelsea, Revere, and beyond. Once you''ve used it once, it''s simple. Here''s everything you need for the first time.',
    $guidebody$Bluebikes is Greater Boston's bike-share system, with 400+ stations across Boston, Brookline, Cambridge, Somerville, Everett, Chelsea, Revere, and beyond. Once you've used it once, it's simple. Here's everything you need for the first time.

**Getting started**
1. Download the **Bluebikes app** (iOS/Android), create an account, add a payment method.
2. Open the app to see nearby stations and live availability. Green means bikes are available.
3. Tap "Unlock," scan the QR code on any available bike at the station. The lock releases.

**Pricing options**
- **Single trip:** $3.00 for 30 minutes (e-bikes +$0.33/min on top).
- **Day Pass:** $11.99 for unlimited 2-hour rides that day.
- **Membership:** $30.50/month or $133.50/year (or $13/month on the annual plan). Unlimited 45-minute rides, e-bikes at $0.10/min.
- **Income Eligible:** Available based on residence — 60-minute rides and the cheapest e-bike rate ($0.07/min). Worth checking if you qualify.
- Helmet not provided. Bring your own or check if your workplace has loaners.

**Returning**
Roll the front wheel firmly into an empty dock until you hear a click and see the green light. **Always tug-test** — pull the bike backward gently to confirm it's locked. The most common docking issue is not pushing firmly enough; give it real force.

**If you might run over your ride time**
Dock at any station along the way, wait a minute, and undock a new bike. The clock resets. No penalty for swapping mid-trip.

**If something goes wrong**
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
    now()
  ),
  (
    'mg_bike_lock',
    'Where (and how) to lock your bike',
    'where-to-lock-your-bike',
    'A good lock is only as good as how and where you use it. Most stolen bikes weren''t unlocked — they were locked badly, or locked to something that didn''t actually hold. Here''s what works.',
    $guidebody$A good lock is only as good as how and where you use it. Most stolen bikes weren't unlocked — they were locked badly, or locked to something that didn't actually hold. Here's what works.

**1. Lock the frame, not just the wheel.** Your U-lock should go through the bike frame and around the rack. Wheels can be removed in seconds; if you only secured a wheel, you've left the rest of the bike loose.

**2. Use both wheels with two locks.** A U-lock on the frame plus a cable through the front wheel keeps both wheels with the bike. Cable locks alone aren't worth using — bolt cutters go through them in seconds.

**3. Fill the U-lock space.** A U-lock with empty space inside the U is easier to leverage open. Pack it tight against the rack and frame so there's no room for a tool to fit.

**4. Lock to something solid.** Look for inverted-U or post-and-ring bike racks, or solid metal sign posts. Avoid wooden posts (cuttable), thin poles (a thief can lift the bike over the top), and anything not anchored to the ground. Trees are a no — both because the lock can damage the tree and because trees are often less sturdy than they look.

**5. When indoors is an option, take it.** If your workplace has indoor bike parking, use it. Many MBTA stations have secure bike cages that require a CharlieCard for access. Cambridge and Somerville also have plenty of street-level racks; check Google Maps for "bike parking" near your destination.

**6. Register and track.** Register your bike at [bikeindex.org](https://bikeindex.org) (free, helps recovery if it's stolen) and take a photo of the serial number. Hide an AirTag or Tile tracker somewhere discreet — taped under the saddle, dropped inside the seat tube, or tucked into a tail-light housing. If the bike walks off, you can find it. Remove lights and quick-release accessories when you park.

**Try this first:** Walk to where you'd normally park your bike at work and look around for indoor or covered options before defaulting to a curb rack. A lot of people don't realize their building has secure bike parking until they ask.$guidebody$,
    'cycling',
    'bike_parking',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['parking', 'security', 'gear']::text[],
    ARRAY['mg_bike_commute_gear', 'mg_bluebikes']::text[],
    false,
    2,
    now()
  ),
  (
    'mg_biking_in_rain',
    'Biking in the rain',
    'biking-in-the-rain',
    'Rain stops a lot of would-be bike commuters, but with minimal gear it''s manageable — and once you''ve done it a few times, light rain stops feeling like a barrier at all.',
    $guidebody$Rain stops a lot of would-be bike commuters, but with minimal gear it's manageable — and once you've done it a few times, light rain stops feeling like a barrier at all.

**1. Fenders are the single best investment.** A $25-30 fender set keeps a stripe of road grime off your back and pants. This matters more than a rain jacket, because road spray gets you wetter and dirtier than the rain itself does.

**2. Any waterproof shell works.** You don't need a bike-specific rain jacket — any waterproof or water-resistant shell with pit zips or vents will do. Heavy rain calls for rain pants too, but for typical commute rain a jacket and fenders cover it.

**3. Keep your stuff dry.** Use a waterproof pannier or a backpack cover. A trash bag inside a regular backpack works in a pinch.

**4. Adjust how you ride.** Wet roads are slipperier than they look:
- **Slow down,** especially on painted lines, metal grates, and manhole covers — those are the slickest surfaces.
- **Brake earlier.** Wet rims need more stopping distance.
- **Watch the first 15 minutes.** Oil and grime get pulled to the road surface when rain starts. That's the slipperiest window.
- **Avoid standing puddles.** They can hide potholes.

**5. Be more visible than usual.** Lights on, even during the day. Bright or reflective layers help drivers see you sooner in low-contrast conditions.

Most "rain rides" are light drizzle or brief showers. Truly heavy rain during commute hours is rare, and even when you get wet, you dry off. People who try it a few times often find light rain pleasant — less traffic, cooler air, a small sense of accomplishment that brightens the day.$guidebody$,
    'cycling',
    'weather',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['weather', 'gear', 'year-round']::text[],
    ARRAY['mg_cold_weather', 'mg_bike_commute_gear']::text[],
    false,
    2,
    now()
  ),
  (
    'mg_cold_weather',
    'Cold-weather biking',
    'cold-weather-biking',
    'Cold-weather cycling is more comfortable than most people expect. Your body generates real heat while riding — the trick is dressing for that, not for standing still.',
    $guidebody$Cold-weather cycling is more comfortable than most people expect. Your body generates real heat while riding — the trick is dressing for that, not for standing still.

**1. Dress for 15°F warmer than it is.** This is the single most important rule. If you dress to feel comfortable standing outside, you'll overheat within five minutes of riding. Aim for "slightly cool at the start." You'll warm up fast.

**2. Layer in three parts.**
- **Base:** Synthetic or wool, not cotton. Keeps sweat off your skin.
- **Mid:** Insulating layer — a fleece or wool sweater works.
- **Outer:** Wind-blocking shell. Wind protection matters more than insulation; you generate the heat, the shell traps it.

**3. Hands and feet first.** These get cold fastest and ruin a ride quickest. Good gloves and warm socks are the highest-leverage upgrades.
- Below 30°F: insulated gloves, wool socks.
- Below 20°F: bar mitts (handlebar-mounted insulated covers) and insulated shoe covers or winter boots. Bar mitts in particular make a huge difference if you ride year-round.

**4. Cover your face on the cold days.** A buff or neck gaiter pulled up over your nose and cheeks dramatically extends your comfort range. A lot of people skip this and regret it below 25°F.

**5. Account for the season's other realities.**
- **Lights are essential** — shorter days mean a lot of commutes happen in the dark.
- **Lower tire pressure slightly** for better grip on cold or icy patches.
- **Keep your chain lubed.** Winter grime wears drivetrain parts faster than summer riding does.

Winter biking has real advantages once you're set up: lighter traffic, no overheating, and you arrive energized.

**Try this first:** Pick a 35-40°F day for your first cold ride. Wear a light shell over what you'd normally wear, and skip the heavy coat. You'll be surprised how comfortable you are within five minutes of pedaling.$guidebody$,
    'cycling',
    'weather',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['weather', 'gear', 'year-round']::text[],
    ARRAY['mg_biking_in_rain', 'mg_bike_commute_gear']::text[],
    false,
    2,
    now()
  ),
  (
    'mg_subway_vs_bus',
    'Subway vs. bus — what''s different',
    'subway-vs-bus',
    'The MBTA runs buses, subway lines, and the Green Line (which acts like a streetcar in some places and a subway in others). They''re all part of the same system, but the experience is different enough that it helps to know what you''re walking into.',
    $guidebody$The MBTA runs buses, subway lines, and the Green Line (which acts like a streetcar in some places and a subway in others). They're all part of the same system, but the experience is different enough that it helps to know what you're walking into.

**Buses** stop every few blocks and you board at the front. Tap your Charlie Card or phone on the reader by the driver. You can exit from any door — just push the yellow strip or pull cord to request your stop. Buses run on the street, so timing can vary with traffic. The posted schedule is a suggestion, not a promise — check real-time arrivals in the app.

**Subway (Red, Orange, Blue lines)** runs underground on its own tracks, so it's generally faster and more predictable than buses. You tap in at the fare gate, wait on the platform, and board any car. Trains don't have stop-request buttons — they stop at every station. Signs on the platform and announcements will tell you which direction you're headed (e.g. "Alewife" vs. "Ashmont/Braintree" on the Red Line).

**The Green Line** is the weird one. Parts of it run underground like a subway (downtown). Other parts run above ground at street level like a trolley (the B, C, and E branches). When it's above ground, you board at small platform stops on the street — look for the green signs. It can feel unfamiliar, but it works the same way: tap on, ride, get off at your stop.

If you pay with a Charlie Card or phone, a single bus-to-subway transfer is free within two hours. So a trip that mixes buses and trains often costs just a single fare.$guidebody$,
    'transit',
    'routes',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library', 'roam_leg']::text[],
    ARRAY['getting-started', 'mbta-basics', 'routes']::text[],
    ARRAY['mg_first_bus_ride', 'mg_pay_for_t']::text[],
    true,
    2,
    now()
  ),
  (
    'mg_bus_transfers',
    'How bus transfers work',
    'how-bus-transfers-work',
    'If your trip involves more than one bus or train, you''re probably paying less than you think.',
    $guidebody$If your trip involves more than one bus or train, you're probably paying less than you think.

**The basic rule:** When you pay with a Charlie Card or phone tap, your first transfer within two hours is free. Bus to bus, bus to subway, subway to bus — all free. That two-hour window starts from your first tap.

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
    now()
  ),
  (
    'mg_pay_for_t',
    'How to pay for the T',
    'how-to-pay-for-the-t',
    'The MBTA accepts both contactless payments and the older CharlieCard system. Which to use depends on how often you ride.',
    $guidebody$The MBTA accepts both contactless payments and the older CharlieCard system. Which to use depends on how often you ride.

**For occasional riders: tap to pay.** Hold your phone (Apple Pay, Google Pay) or a contactless card on the reader at any fare gate or bus farebox. You pay per ride — $2.40 subway, $1.70 local bus, $2.40-$13.25 commuter rail by zone.

**For regular riders: a CharlieCard with a pass saves money.** Pay-per-tap adds up fast. A monthly LinkPass on a CharlieCard is $90 for unlimited subway + local bus rides — cheaper than per-ride pricing for most daily commutes, and notably cheaper for bus-only commuters ($55/month with the Local Bus Pass).

**Pass options on a CharlieCard:**
- **1-Day Pass:** $11 — unlimited subway and bus for 24 hours.
- **7-Day Pass:** $22.50 — unlimited for 7 days.
- **Monthly LinkPass:** $90 — unlimited subway and bus for the calendar month.
- **Monthly Local Bus Pass:** $55 — bus only.

Get a CharlieCard from any subway station's vending machine; load it with cash or a card.

**Transfers are free** within 2 hours bus-to-bus, bus-to-subway, and subway-to-bus. The transfer benefit applies whether you're using a CharlieCard or contactless.

**For the Commuter Rail, use the mTicket app.** Buy your ticket in the app before boarding, show the active ticket to the conductor.

**Reduced fares** are available for riders 65+, riders with disabilities, students, and income-eligible riders. Details at mbta.com/fares.

If you ride a few times a month, just tap. If you commute regularly, get a CharlieCard with a monthly pass — it pays for itself within a couple weeks.$guidebody$,
    'transit',
    'planning',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library', 'nudge_card']::text[],
    ARRAY['fares', 'getting-started', 'mbta-basics']::text[],
    ARRAY['mg_bus_transfers', 'mg_first_bus_ride']::text[],
    true,
    2,
    now()
  ),
  (
    'mg_first_bus_ride',
    'Your first bus ride — what to expect',
    'your-first-bus-ride',
    'If you''ve never taken a city bus, or haven''t in years, here''s what to expect. It''s easier than it feels in advance.',
    $guidebody$If you've never taken a city bus, or haven't in years, here's what to expect. It's easier than it feels in advance.

**Before you leave**
Find your route in Google Maps, Apple Maps, or the Transit app. Enter your destination, select "Transit," and the app will tell you which bus, where to catch it, and when it arrives. Most also show real-time bus location, so you'll know whether to head out now or wait a minute.

**At the stop**
Look for a bus stop sign — the route number(s) will be listed. The bus pulls up and opens the front door. Board through the front, where the fare reader is.

**Paying**
- **Tap to pay (easiest):** Tap your phone (Apple Pay, Google Pay) or contactless card on the reader.
- **CharlieCard:** Tap on the same reader.
- **Cash:** Feed bills or coins into the farebox. Exact change only — the machine doesn't give change back.

**On the bus**
Move toward the back to make room for new riders. Hold a pole or strap if standing. Your stop will be announced over the speakers and shown on the display above. To request your stop, push the yellow strip on the wall or pull the cord above the windows. Exit through the rear door (push the yellow bars to open).

**A few useful things to know**
- **Transfers are free** within 2 hours if you connect to another bus or the subway using the same payment method.
- **The bus can kneel.** If you need step-free boarding, the driver can lower the bus.
- **Drivers are used to new riders.** If you're not sure whether you got the right bus or how something works, just ask.$guidebody$,
    'transit',
    'planning',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['getting-started', 'mbta-basics', 'planning']::text[],
    ARRAY['mg_pay_for_t', 'mg_subway_vs_bus']::text[],
    false,
    2,
    now()
  ),
  (
    'mg_transit_plus_walking',
    'Combining transit with walking or biking',
    'transit-plus-walking-or-biking',
    'For trips over 3-4 miles, mixing transit with a walk or bike at each end is often the fastest and most pleasant way to get there. You skip the slowest parts of pure-transit (local bus stops, transfers), get built-in exercise without adding total time, and arrive right at the door.',
    $guidebody$For trips over 3-4 miles, mixing transit with a walk or bike at each end is often the fastest and most pleasant way to get there. You skip the slowest parts of pure-transit (local bus stops, transfers), get built-in exercise without adding total time, and arrive right at the door.

**How it works**
1. Walk or bike to a transit stop (5-15 min).
2. Ride the bus or train for the long middle section.
3. Walk or bike from your destination stop (5-15 min).

**Planning the trip**
- **Use Google Maps or the Transit app.** Enter your destination, look at transit options, and notice which stops are within a 10-15 minute walk of your start and end points.
- **Choose rapid transit for the middle.** Subway, commuter rail, or express buses are the fastest options for the long leg.
- **Consider Bluebikes for the last mile.** Stations are often near transit stops. Biking the last mile is usually faster than waiting for a connecting bus.

**An example**
Somerville to the Seaport is a 6-mile trip. Multimodal version:
- Walk 8 min to Davis Square Red Line station
- Ride Red Line to South Station (15 min)
- Walk 10 min to the Seaport

Total: 33 minutes, $2.40, and 18 minutes of walking built into the day.

**A few practical things**
- **Build in buffer time** — allow 5 extra minutes until you learn the routine.
- **Have a backup plan** — know the all-transit route for bad weather days when the walk or bike-share segment is less appealing.
- **For repeat trips, the routine compounds.** Once you know the timing and rhythm, the planning effort drops to nearly zero.$guidebody$,
    'transit',
    'routes',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['routes', 'multimodal', 'getting-started']::text[],
    ARRAY['mg_transit_planning', 'mg_subway_vs_bus']::text[],
    false,
    2,
    now()
  ),
  (
    'mg_transit_planning',
    'Planning a transit trip — it''s mostly the apps doing the work',
    'planning-a-transit-trip',
    'Planning a transit trip used to mean reading printed schedules and hoping the bus showed up. Today the apps do all of that. Here''s how to use them well.',
    $guidebody$Planning a transit trip used to mean reading printed schedules and hoping the bus showed up. Today the apps do all of that. Here's how to use them well.

**1. Use the Transit app or Google Maps.** Both pull live MBTA data — real-time bus and train locations, predicted arrivals, and full route options.
- **Transit (the app):** Best for transit-specific use. Faster, cleaner, with countdown clocks for nearby stops the moment you open it.
- **Google Maps:** Best when comparing transit against walking or biking. The "Transit" tab shows multiple options ranked by total time.
- **MBTA's own app and mbta.com/trip-planner:** Useful for service alerts and accessibility info.

**2. Trust the predicted arrivals.** Real-time predictions are usually within a minute or two. Don't pad your schedule based on the printed schedule — that's the worst-case version, not the typical one.

**3. Allow extra time for transfers, but only the first time.** Apps build in standard transfer time. The first time you make an unfamiliar transfer, give yourself an extra 5 minutes to find the connecting platform or stop. Once you know the layout, you'll match the app's estimate.

**4. Have a backup plan for delays.** If your bus or train is late, the same app shows the next one. Sometimes the answer is wait; sometimes it's switch routes or grab a Bluebike for the rest of the leg.

**5. Save your common trips.** Both Transit and Google Maps let you favorite or pin frequent destinations. After a week of doing this, your morning routine collapses to "open app, see when to leave."

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
    now()
  ),
  (
    'mg_transit_time',
    'When transit is actually the faster option',
    'when-transit-is-faster',
    'Transit can feel slower than driving, but on most trips into or across downtown Boston, it isn''t — once you count the full door-to-door time and what driving actually costs you in stress and parking. Here''s when transit wins.',
    $guidebody$Transit can feel slower than driving, but on most trips into or across downtown Boston, it isn't — once you count the full door-to-door time and what driving actually costs you in stress and parking. Here's when transit wins.

**1. Anywhere downtown, in or out.** Driving into Back Bay, Downtown Crossing, the Seaport, or anywhere along the Red Line corridor means crawling traffic plus a parking search. The subway is signal-independent — it runs the same speed at 8 AM and 11 AM. For most downtown trips from the inner suburbs, the Red, Orange, or Green Line is usually the faster option door-to-door.

**2. Commuter Rail into Boston, from anywhere with a station.** From Worcester, Lowell, Beverly, or any commuter rail town, the train is hard to beat by car. It runs at consistent highway-equivalent speeds, drops you at South Station or North Station, and you skip the whole parking situation. For longer commutes, this is usually the fastest option, period.

**3. Across the river, anytime.** Cambridge to Boston (or vice versa) by car is a coin flip on the bridge timing. The Red Line is consistently 10-15 minutes across the same stretch, rush hour or midnight.

**4. The "predictable arrival" advantage.** Even when transit isn't the absolute fastest option on a given day, it's the most predictable. A 25-minute transit trip is 25 minutes most days. A 25-minute drive can be 25, 35, or 50 depending on traffic. Predictability is its own kind of fast — you don't have to leave 15 minutes early "just in case."

**5. What you do with the time.** A 30-minute drive is 30 minutes of driving. A 30-minute train ride is 30 minutes of reading, working, podcast-listening, or zoning out. For a daily commute, that adds up to several hours a week of time you get to spend on something else.

**Try this first:** Pick a trip you usually drive — ideally one with downtown parking or peak-hour traffic. Compare Google Maps' driving tab against the Transit tab, including walks at each end. Most people are surprised at how close they are, and predictability tilts the rest of the math.$guidebody$,
    'transit',
    'time',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['motivation', 'mbta-basics']::text[],
    ARRAY['mg_subway_vs_bus', 'mg_transit_plus_walking']::text[],
    false,
    2,
    now()
  ),
  (
    'mg_walking_vs_driving',
    'When walking is actually the faster option',
    'when-walking-is-faster',
    'Walking is faster than driving for more short trips than people expect — once you count door-to-door time. Here''s when it wins.',
    $guidebody$Walking is faster than driving for more short trips than people expect — once you count door-to-door time. Here's when it wins.

**1. Trips under half a mile.** Walking 0.5 miles takes about 10 minutes. Driving the same distance often takes longer once you count the trip to your car, traffic, and the trip from parking to the door. The shorter the trip, the more lopsided the math.

**2. Anywhere parking is hard.** Cambridge, Somerville, the Seaport, downtown Boston, anywhere near a hospital or a college — if you'd spend 5-10 minutes hunting for a spot, walking from a few blocks farther out is often faster door-to-door.

**3. Round trips with multiple stops.** Need to grab coffee, drop off a package, and pick something up at the pharmacy on the same block? Walking handles a chained errand without the park-and-re-park overhead at each stop.

**4. Rush hour, when traffic is bad.** A 1-mile drive in stop-and-go traffic can easily take 10-15 minutes. A 1-mile walk is 20 minutes — sometimes faster than the drive, almost always more pleasant.

**5. What walking does that GPS doesn't track.** A 15-minute walk burns about 60 calories, lets you notice your neighborhood, and ends with you in a better mood than you started.

**Try this first:** Pick one trip you usually drive that's under a mile. Walk it once and time yourself door-to-door. Most people are surprised at how close the times are.$guidebody$,
    'walking',
    'time',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library', 'nudge_card']::text[],
    ARRAY['motivation', 'short-trips']::text[],
    ARRAY['mg_walking_carrying']::text[],
    true,
    2,
    now()
  ),
  (
    'mg_walking_carrying',
    'Walking with stuff: how to carry what you need',
    'walking-with-stuff',
    'Carrying stuff is the most overstated walking barrier. Most things people assume require a car can be carried on foot with the right setup. For the rest, there are still good options. Here''s what works.',
    $guidebody$Carrying stuff is the most overstated walking barrier. Most things people assume require a car can be carried on foot with the right setup. For the rest, there are still good options. Here's what works.

**1. A rolling cart is the unsung hero.** A folding utility cart (sometimes called a "granny cart") holds 50+ pounds of groceries, pulls easily on sidewalks, and folds flat at home. They cost $30-60 and have changed the game for plenty of car-free families. Ikea, Amazon, and most hardware stores carry them.

**2. A backpack and a few foldable bags cover most everyday loads.** A backpack is hands-free and distributes weight; foldable bags tucked inside mean you're never caught short for a bigger haul. For groceries specifically, two reusable totes (one in each hand) carry weight more comfortably than one giant bag and let you rebalance as you go.

**3. For loads beyond walking, an e-cargo bike covers the middle ground.** An e-cargo bike handles a Costco run, a beach-day load, a trip to the lumber yard — most of what people assume requires a car. You don't have to buy one to find out; see *What you can do with an e-cargo bike* for the rental and library options that let you try one for a weekend.

**4. Use delivery for the truly bulky.** A 12-pack of paper towels or a case of sparkling water is more of a delivery problem than a walking or biking one. Most grocery stores in Greater Boston offer delivery, and one delivery a week handles what's left.

**5. Schedule around it.** Two smaller walking trips a week often work better than one big haul. Smaller loads, more steps, less of a production.

Together, a rolling cart, an e-cargo bike, and a delivery subscription cover almost any load people typically drive for.$guidebody$,
    'walking',
    'carrying',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['carrying', 'gear', 'errands']::text[],
    ARRAY['mg_cargo_bike', 'mg_walking_vs_driving']::text[],
    true,
    2,
    now()
  ),
  (
    'mg_walking_weather',
    'Walking through the weather',
    'walking-through-the-weather',
    'Weather is most people''s biggest walking hesitation, but most weather is more walkable than it looks from the warm side of a window. Here''s what to know.',
    $guidebody$Weather is most people's biggest walking hesitation, but most weather is more walkable than it looks from the warm side of a window. Here's what to know.

**1. The right shoes are step one.** Waterproof shoes (any decent pair, not specialty gear) make rain a non-event. Insulated boots make a 25°F walk perfectly comfortable. Non-waterproof shoes are often the real problem people blame on weather.

**2. Cold weather is a layering question, not a temperature question.** A light shell over your normal layers extends your comfort range a long way. The "dress like it's 15°F warmer" rule from biking applies here too — you'll warm up within a few blocks. Cover your ears and hands; everything else takes care of itself.

**3. Light rain is fine.** A waterproof jacket and a hood handle the typical drizzle that stops people from walking. An umbrella works for steady rain on a calm day; in wind, a hooded shell is better.

**4. Hot weather is about pace and hydration.** On 90°F days, walk slower, take a water bottle, stay on the shadier side of the street, and consider a hat. Pre-9 AM and post-7 PM hours are usually perfectly walkable even in summer.

**5. Know your bail-out options.** Real bad weather — sleet, lightning, dangerous heat — is the right time to take the T, take a rideshare, or stay home. Walking should be a default, not an obligation. Knowing the bail-out option in advance makes you more willing to start.

Most "the weather is bad" conclusions are made by people standing inside dressed for inside. Take a 5-minute walk to the corner and back before deciding it's a no-go day; the answer is usually different than expected.$guidebody$,
    'walking',
    'weather',
    'approved',
    'micro_guide',
    ARRAY['home_feed', 'guide_library']::text[],
    ARRAY['weather', 'gear', 'year-round']::text[],
    ARRAY['mg_biking_in_rain', 'mg_cold_weather']::text[],
    true,
    2,
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  slug = EXCLUDED.slug,
  summary = EXCLUDED.summary,
  body = EXCLUDED.body,
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

COMMIT;
