# GSI Micro-guide Library

**Status:** Final draft, ready for seed migration
**Last updated:** 2026-05-07
**Total guides:** 20 (10 cycling, 7 transit, 3 walking)

## What this is

Source-of-truth file for the GSI micro-guide library. Each entry below has YAML metadata (intended for the `content_items` table) followed by a markdown body (intended for the `body` field). Code can parse this file deterministically into a seed migration: walk each `### \`mg_*\`` section, extract the YAML block, capture the body content between the YAML block close and the next `---` separator, and emit `INSERT INTO content_items ... ON CONFLICT (id) DO UPDATE SET ...` statements.

Voice and content guidelines applied across all 20 guides:

- Direct, plain, adult-to-adult tone. No cuteness, no sales-pitch energy.
- Positive active-transportation framing. Cars are acknowledged where relevant and treated as legitimate options that sometimes win; the library is not adversarial against driving.
- Specific over abstract — actual brand examples, dollar amounts, route names, neighborhoods, where they add value.
- Mobile-first, scannable, ~200-380 words per guide.
- Sponsor recognition deliberately kept out of guide bodies (it belongs in dedicated sponsor channels, not woven into informational content).

## Schema additions needed before seed migration

The `content_items` table needs three additions before this seed runs cleanly:

1. **`slug`** (text, unique) — for public website URLs (e.g. `/guides/picking-a-bike-route`).
2. **`topics`** (text[]) — for browse-by-topic on the public website, separate from `primary_barrier`. Topics are an unconstrained content axis; barriers are the in-app Commute Advisor discovery key. Some overlap is fine.
3. **`related_guides`** (text[]) — array of guide IDs for cross-references. Replaces the prose "Related: ..." lines that earlier versions of guides used.

If any of these already exist with different names, the field names in the YAML below can be remapped.

## IDs to deprecate

The Bluebikes merge consolidated two existing guides into one. The seed migration should set the old IDs to `status = 'deprecated'` (or delete them, depending on retention policy):

- `mg_blue_bikes` — superseded by `mg_bluebikes`
- `mg_return_bluebike` — superseded by `mg_bluebikes`

Any inbound references to those old IDs should be updated to `mg_bluebikes`.

## Barrier-tagging notes for Code

A few decisions worth surfacing:

- **`confidence`** was discussed and intentionally **not** added as a UI barrier. Guides previously tagged `confidence` have been retagged into existing barriers: `mg_first_bike_lane` → `cycling/safety`, `mg_subway_vs_bus` → `transit/routes`.
- **`barrier: null`** on the cargo bike guide (`mg_cargo_bike`) is intentional. It's a featured library piece, not a barrier-gated answer. It surfaces via `home_feed` and `guide_library` (and via inbound `related` references from gear, sweating, time, and walking-carrying guides).
- **`logistics`** is not currently used by any guide in this seed. Several existing guides previously tagged `logistics` have been redistributed: gear-related → `gear`, lock-related → `bike_parking`, transit fare/transfer/first-ride content → `planning`. If `logistics` should be retired from the schema or kept as a catch-all, that's a separate cleanup pass.
- **The Commute Advisor barrier-code mapping in `GettingStarted.tsx:14`** should be updated so UI codes match DB codes 1:1 (`gear → 'gear'`, `planning → 'planning'`, etc.) rather than going through the legacy `logistics` indirection. With the seed migration applied, the indirection is no longer needed.

## Topics vocabulary

To keep browse-by-topic coherent, the `topics` field uses a controlled vocabulary across the library:

`apps`, `bike-share`, `cargo`, `e-bikes`, `errands`, `family`, `fares`, `gear`, `getting-started`, `infrastructure`, `mbta-basics`, `motivation`, `multimodal`, `parking`, `planning`, `routes`, `safety`, `security`, `short-trips`, `weather`, `year-round`

New topics can be added later but should be kept pruned — too many tags makes browse less useful.

## Outstanding work after seed migration runs

- **Public site IA:** the website needs a `/guides` library landing page with browse-by-mode and browse-by-topic, plus individual guide pages at `/guides/<slug>`. This is web work, not data work.
- **Cross-reference rendering:** the `related_guides` field needs a renderer in both surfaces (in-app library + public site). On the public site this could be a "Related guides" sidebar; in-app it could be inline tappable links.
- **Voice extension:** if more guides get authored later (e-scooter, accessibility, family-specific, route-specific Roams content), they should follow the same spec captured by the existing 20.

---

## Cycling (10 guides)

### `mg_low_stress_routes`

```yaml
id: mg_low_stress_routes
title: "Picking a bike route that feels comfortable"
slug: picking-a-bike-route
mode: cycling
barrier: routes
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library]
topics: [routes, getting-started, infrastructure]
related: [mg_first_bike_lane, mg_bike_commute_gear]
```

The fastest route isn't always the right route. A five-minute-longer ride on protected infrastructure is almost always better than a "direct" route on a four-lane stretch with no bike lane. Here's how to pick well, especially when you're new.

**1. Know your infrastructure types.** Protected lanes (physically separated from traffic) are the most comfortable. Shared-use paths like the Minuteman or the Charles River paths are completely separate from cars. Painted lanes are good but watch the door zone. Neighborhood streets are often fine even without bike-specific infrastructure.

**2. Use a bike-specific routing app.** Google Maps' cycling layer shows infrastructure. The Strava global heatmap shows where cyclists actually ride — a useful proxy for where it's both safe and pleasant.

**3. Start with paths, not roads.** Before committing to a road-based commute, ride one of the great regional paths once for confidence: the Minuteman (Arlington–Bedford), the Charles River paths, the Somerville Community Path, or the Southwest Corridor. Flat, scenic, fully separated.

**4. One block off changes everything.** If your route includes a busy stretch, look at the parallel street one block over. It's almost always quieter and only adds a minute or two.

**5. Try it on a weekend first.** Ride your planned commute once on a Saturday morning with no time pressure. Knowing the route removes most of the stress before you ride it on a Tuesday.

**Try this first:** Pull up Google Maps with the cycling layer on and look at your typical destination. You'll often spot a path or protected lane within a block of where you were planning to ride.

---

### `mg_first_bike_lane`

```yaml
id: mg_first_bike_lane
title: "Your first ride in a bike lane"
slug: your-first-ride-in-a-bike-lane
mode: cycling
barrier: safety
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library, roam_leg]
topics: [safety, getting-started, infrastructure]
related: [mg_low_stress_routes, mg_bike_commute_gear]
```

Bike lanes in Boston range from painted lines on the road to fully separated paths with their own signals. Here's what to know for your first time in one.

**Protected lanes** (also called separated or cycle tracks) have a physical barrier between you and car traffic — usually parked cars, posts, or a curb. These are the most comfortable lanes in the city. Stay to the right, pass on the left, and watch for pedestrians stepping into the lane at crossings.

**Painted bike lanes** are marked with white lines and bike symbols on the road surface. Cars aren't supposed to be in them, but doors from parked cars can swing open. Ride toward the left side of the lane — far enough from parked cars that an opening door won't reach you. Cyclists call this the "door zone," and avoiding it becomes second nature fast.

**Green paint** on the road marks areas where bikes and cars are likely to cross paths — intersections, merge zones, driveways. It's a heads-up, not a hazard. Just keep your line and make eye contact with turning drivers when you can.

**Sharrows** (shared lane arrows, the ones with the chevrons) mean you share the lane with cars. You're allowed to take the full lane — ride in the center so cars pass you safely by changing lanes rather than squeezing by.

**The one habit that matters most:** Look behind you before changing your position in the lane. A quick shoulder check before moving left to pass or avoid something — it's the cycling equivalent of checking your mirror.

---

### `mg_bike_commute_gear`

```yaml
id: mg_bike_commute_gear
title: "The gear that actually matters for bike commuting"
slug: bike-commute-gear
mode: cycling
barrier: gear
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library]
topics: [gear, getting-started, safety]
related: [mg_bike_lock, mg_bike_sweat, mg_biking_in_rain]
```

You don't need much equipment to bike-commute, but a few things make the difference between a good ride and a frustrating one. Here's what's worth investing in.

**1. A helmet — non-negotiable.** A $40 helmet protects you about as well as a $200 one, but the kind of safety tech matters more than the price tag. Look for two things on the label: **MIPS** (a slip-plane layer that reduces rotational forces in a crash) and a rating from the **Virginia Tech Helmet Lab**, which independently star-rates helmets from 1 to 5. A 4- or 5-star MIPS helmet is plenty for daily commuting. Replace it after any crash, even if it looks fine.

**2. Lights, front and rear.** Lights are the single biggest thing you can do for safety. Most crashes happen because a driver didn't see the cyclist, and visibility is most of the fix. Look for at least 200 lumens on the front, a steady-and-flash pattern on the back, and run them even during the day.

**3. A real lock.** Cable locks get cut in seconds. A solid U-lock from Kryptonite or Abus runs $30-60 and pays for itself the first time you don't lose your bike.

**4. A way to carry stuff.** This is the gear question that's most underestimated.
- **Backpack** — fine for short rides, but it'll make your back sweaty.
- **Messenger bag** — better airflow than a backpack, decent capacity.
- **Panniers** (bags that mount on a rear rack) — the most comfortable for daily commutes. Your back stays dry and you can carry a real load. Get waterproof ones or use rain covers; Boston rain is real.
- **Basket** — old-school, perfect for grocery runs.

**5. Fenders if you ride in any weather.** A $25 fender set keeps a stripe of road grime off your back and pants. The single best rain-season investment.

**Try this first:** If you only buy two things, make them lights and a U-lock. Everything else can wait until you know what you actually need.

---

### `mg_bike_time`

```yaml
id: mg_bike_time
title: "When biking is actually the faster option"
slug: when-biking-is-faster
mode: cycling
barrier: time
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library]
topics: [motivation, e-bikes, short-trips]
related: [mg_low_stress_routes, mg_cargo_bike, mg_bike_commute_gear]
```

Biking is faster than driving for more trips than people expect — once you count door-to-door time. Here's when it actually wins.

**1. Trips under three miles, especially in dense neighborhoods.** Short urban trips on a bike are usually 15-25 minutes door-to-door. The same trip by car, including parking-search time, often comes out about the same — sometimes longer. The "driving is faster" intuition is mostly built on suburban-style trips, not city ones.

**2. Anywhere parking is hard.** Cambridge, Somerville, the Seaport, downtown Boston, anywhere near a hospital or a college — parking can take 5-15 minutes plus a walk from where you ended up. Biking puts you at the door.

**3. Rush hour, on protected infrastructure.** When traffic crawls, signal-independent routes — the Charles River paths, the Minuteman, the Southwest Corridor — keep moving at the same speed they always do. Predictable arrival times are part of why people bike-commute even when driving is an option.

**4. Longer trips, on an e-bike.** A 5-7 mile commute that's a slow slog on a regular bike is a comfortable 20-25 minute ride on an e-bike, with little exertion. E-bikes extend the range where biking competes with driving on time, often well past five miles.

**5. Errands and trips with kids — on an e-cargo bike.** An e-cargo bike (a long-tail or front-bucket frame with pedal-assist) can carry two kids plus a week of groceries, and uses bike infrastructure that skips the school-pickup line entirely. It handles most of what people assume requires a car. You don't have to buy one to find out: [CargoB](https://www.ridecargob.com/) rents cargo bikes by the minute around the region, and [Community Pedal Power](https://communitypedalpower.org/) in Cambridge runs an e-bike library where you can borrow one for free.

**Try this first:** Time your normal commute door-to-door once, including walking to and from the car and finding parking. Then time the same trip on a bike. Most people are surprised.

---

### `mg_bike_sweat`

```yaml
id: mg_bike_sweat
title: "How to bike-commute without breaking a sweat"
slug: bike-commute-without-sweat
mode: cycling
barrier: sweating
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library]
topics: [gear, e-bikes, getting-started]
related: [mg_bike_commute_gear, mg_cargo_bike]
```

Worrying about arriving sweaty stops a lot of people from biking to work. There are several layers of fix, and the most effective one doesn't involve any extra gear at all.

**1. The simplest fix: sweat less to begin with.** An e-bike does most of the work for you — you'll arrive at a 5-mile destination feeling about the same as after a 1-mile walk. Bluebikes has a growing fleet of e-bikes, and with a Monthly or Annual membership the rate drops to $0.10/min on top of the membership — affordable for daily commute use.

**2. Pace yourself on a regular bike.** You control the pace. Riding at "conversation pace" — slow enough you could chat with someone alongside you — generates very little sweat, even on warm days. The few extra minutes is less time than the cool-down you'd otherwise need.

**3. Pick a flatter route.** A 200-foot climb makes a real difference in sweat output. Google Maps' cycling layer shows elevation; a route that's a half-mile longer is often far cooler if it avoids a hill.

**4. Wear the right stuff for the ride.** You don't need cycling-specific clothes, but a few choices help:
- **Synthetic or wool layers wick sweat better than cotton.** Cotton holds moisture and stays heavy.
- **For longer rides, ride in athletic clothes and change at your destination.** Pack work clothes the night before, or keep a few days' worth at the office.
- **A breathable layer beats a heavy coat, even in cold weather.** You'll warm up fast on the bike.

**5. Build an arrival kit.** Keep these at your desk and the issue mostly disappears: deodorant, athletic body wipes (Action Wipes is one well-known option — make sure you're getting wipes designed for the gym, not bathroom wipes), a spare shirt, a small towel. Many workplaces also have showers or a fitness center; ask facilities.

**6. Plan around the worst days.** August humidity is real. On the worst handful of days, take the T or work from home. Keeping the streak intact for everything else matters more than perfection.

**Try this first:** Ride your normal route at conversation pace once. Most people overestimate how hard you have to work to bike-commute, and how warm you actually get.

---

### `mg_cargo_bike`

```yaml
id: mg_cargo_bike
title: "What you can do with an e-cargo bike"
slug: what-you-can-do-with-an-e-cargo-bike
mode: cycling
barrier: null
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library]
topics: [e-bikes, cargo, family, getting-started]
related: [mg_bike_sweat, mg_bike_commute_gear, mg_bike_time, mg_walking_carrying]
```

An e-cargo bike is a regular bike with two changes: a longer or wider frame for carrying things, and a pedal-assist motor that helps with hills and loads. People who try one find it covers most of the trips they'd assumed required a car — daycare drop-off, the weekly grocery run, hardware store hauls, beach day, the occasional Costco trip.

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

**Try this first:** Borrow one from Community Pedal Power for a weekend. Use it for one school pickup and one grocery run. You'll know quickly whether it fits your life.

---

### `mg_bluebikes`

```yaml
id: mg_bluebikes
title: "Bluebikes from start to finish"
slug: how-to-use-bluebikes
mode: cycling
barrier: bike_share
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library, nudge_card, roam_leg]
topics: [bike-share, getting-started]
related: [mg_bike_lock, mg_low_stress_routes]
supersedes: [mg_blue_bikes, mg_return_bluebike]
```

Bluebikes is Greater Boston's bike-share system, with 400+ stations across Boston, Brookline, Cambridge, Somerville, Everett, Chelsea, Revere, and beyond. Once you've used it once, it's simple. Here's everything you need for the first time.

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
- **App still shows your ride active after docking?** Take a screenshot of the green light. Contact Bluebikes through the app; they resolve these quickly and won't charge you for a properly returned bike.

**Note for Code:** I tagged `barrier: bike_share` here as a guess; if `bike_share` isn't in the barrier vocabulary, fall back to `logistics` or just `null`. Bluebikes is more of a topical resource than a barrier-specific answer; consider surfacing primarily via `home_feed` and `guide_library`.

---

### `mg_bike_lock`

```yaml
id: mg_bike_lock
title: "Where (and how) to lock your bike"
slug: where-to-lock-your-bike
mode: cycling
barrier: bike_parking
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library]
topics: [parking, security, gear]
related: [mg_bike_commute_gear, mg_bluebikes]
```

A good lock is only as good as how and where you use it. Most stolen bikes weren't unlocked — they were locked badly, or locked to something that didn't actually hold. Here's what works.

**1. Lock the frame, not just the wheel.** Your U-lock should go through the bike frame and around the rack. Wheels can be removed in seconds; if you only secured a wheel, you've left the rest of the bike loose.

**2. Use both wheels with two locks.** A U-lock on the frame plus a cable through the front wheel keeps both wheels with the bike. Cable locks alone aren't worth using — bolt cutters go through them in seconds.

**3. Fill the U-lock space.** A U-lock with empty space inside the U is easier to leverage open. Pack it tight against the rack and frame so there's no room for a tool to fit.

**4. Lock to something solid.** Look for inverted-U or post-and-ring bike racks, or solid metal sign posts. Avoid wooden posts (cuttable), thin poles (a thief can lift the bike over the top), and anything not anchored to the ground. Trees are a no — both because the lock can damage the tree and because trees are often less sturdy than they look.

**5. When indoors is an option, take it.** If your workplace has indoor bike parking, use it. Many MBTA stations have secure bike cages that require a CharlieCard for access. Cambridge and Somerville also have plenty of street-level racks; check Google Maps for "bike parking" near your destination.

**6. Register and track.** Register your bike at [bikeindex.org](https://bikeindex.org) (free, helps recovery if it's stolen) and take a photo of the serial number. Hide an AirTag or Tile tracker somewhere discreet — taped under the saddle, dropped inside the seat tube, or tucked into a tail-light housing. If the bike walks off, you can find it. Remove lights and quick-release accessories when you park.

**Try this first:** Walk to where you'd normally park your bike at work and look around for indoor or covered options before defaulting to a curb rack. A lot of people don't realize their building has secure bike parking until they ask.

---

### `mg_biking_in_rain`

```yaml
id: mg_biking_in_rain
title: "Biking in the rain"
slug: biking-in-the-rain
mode: cycling
barrier: weather
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library]
topics: [weather, gear, year-round]
related: [mg_cold_weather, mg_bike_commute_gear]
```

Rain stops a lot of would-be bike commuters, but with minimal gear it's manageable — and once you've done it a few times, light rain stops feeling like a barrier at all.

**1. Fenders are the single best investment.** A $25-30 fender set keeps a stripe of road grime off your back and pants. This matters more than a rain jacket, because road spray gets you wetter and dirtier than the rain itself does.

**2. Any waterproof shell works.** You don't need a bike-specific rain jacket — any waterproof or water-resistant shell with pit zips or vents will do. Heavy rain calls for rain pants too, but for typical commute rain a jacket and fenders cover it.

**3. Keep your stuff dry.** Use a waterproof pannier or a backpack cover. A trash bag inside a regular backpack works in a pinch.

**4. Adjust how you ride.** Wet roads are slipperier than they look:
- **Slow down,** especially on painted lines, metal grates, and manhole covers — those are the slickest surfaces.
- **Brake earlier.** Wet rims need more stopping distance.
- **Watch the first 15 minutes.** Oil and grime get pulled to the road surface when rain starts. That's the slipperiest window.
- **Avoid standing puddles.** They can hide potholes.

**5. Be more visible than usual.** Lights on, even during the day. Bright or reflective layers help drivers see you sooner in low-contrast conditions.

Most "rain rides" are light drizzle or brief showers. Truly heavy rain during commute hours is rare, and even when you get wet, you dry off. People who try it a few times often find light rain pleasant — less traffic, cooler air, a small sense of accomplishment that brightens the day.

---

### `mg_cold_weather`

```yaml
id: mg_cold_weather
title: "Cold-weather biking"
slug: cold-weather-biking
mode: cycling
barrier: weather
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library]
topics: [weather, gear, year-round]
related: [mg_biking_in_rain, mg_bike_commute_gear]
```

Cold-weather cycling is more comfortable than most people expect. Your body generates real heat while riding — the trick is dressing for that, not for standing still.

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

**Try this first:** Pick a 35-40°F day for your first cold ride. Wear a light shell over what you'd normally wear, and skip the heavy coat. You'll be surprised how comfortable you are within five minutes of pedaling.

---

## Transit (7 guides)

### `mg_subway_vs_bus`

```yaml
id: mg_subway_vs_bus
title: "Subway vs. bus — what's different"
slug: subway-vs-bus
mode: transit
barrier: routes
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library, roam_leg]
topics: [getting-started, mbta-basics, routes]
related: [mg_first_bus_ride, mg_pay_for_t]
```

The MBTA runs buses, subway lines, and the Green Line (which acts like a streetcar in some places and a subway in others). They're all part of the same system, but the experience is different enough that it helps to know what you're walking into.

**Buses** stop every few blocks and you board at the front. Tap your Charlie Card or phone on the reader by the driver. You can exit from any door — just push the yellow strip or pull cord to request your stop. Buses run on the street, so timing can vary with traffic. The posted schedule is a suggestion, not a promise — check real-time arrivals in the app.

**Subway (Red, Orange, Blue lines)** runs underground on its own tracks, so it's generally faster and more predictable than buses. You tap in at the fare gate, wait on the platform, and board any car. Trains don't have stop-request buttons — they stop at every station. Signs on the platform and announcements will tell you which direction you're headed (e.g. "Alewife" vs. "Ashmont/Braintree" on the Red Line).

**The Green Line** is the weird one. Parts of it run underground like a subway (downtown). Other parts run above ground at street level like a trolley (the B, C, and E branches). When it's above ground, you board at small platform stops on the street — look for the green signs. It can feel unfamiliar, but it works the same way: tap on, ride, get off at your stop.

If you pay with a Charlie Card or phone, a single bus-to-subway transfer is free within two hours. So a trip that mixes buses and trains often costs just a single fare.

---

### `mg_bus_transfers`

```yaml
id: mg_bus_transfers
title: "How bus transfers work"
slug: how-bus-transfers-work
mode: transit
barrier: planning
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library, roam_leg]
topics: [fares, mbta-basics]
related: [mg_pay_for_t, mg_subway_vs_bus]
```

If your trip involves more than one bus or train, you're probably paying less than you think.

**The basic rule:** When you pay with a Charlie Card or phone tap, your first transfer within two hours is free. Bus to bus, bus to subway, subway to bus — all free. That two-hour window starts from your first tap.

**What counts:** The transfer has to be between different routes. Riding the same bus back doesn't count. And the free transfer only covers the base fare — if you're transferring to an express bus or commuter rail, you pay the difference.

**What doesn't work:** Cash on the bus doesn't get you a free transfer. Neither do single-ride tickets from the machines. If you're going to ride transit more than once, a Charlie Card (or just your phone) pays for itself immediately.

---

### `mg_pay_for_t`

```yaml
id: mg_pay_for_t
title: "How to pay for the T"
slug: how-to-pay-for-the-t
mode: transit
barrier: planning
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library, nudge_card]
topics: [fares, getting-started, mbta-basics]
related: [mg_bus_transfers, mg_first_bus_ride]
```

The MBTA accepts both contactless payments and the older CharlieCard system. Which to use depends on how often you ride.

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

If you ride a few times a month, just tap. If you commute regularly, get a CharlieCard with a monthly pass — it pays for itself within a couple weeks.

---

### `mg_first_bus_ride`

```yaml
id: mg_first_bus_ride
title: "Your first bus ride — what to expect"
slug: your-first-bus-ride
mode: transit
barrier: planning
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library]
topics: [getting-started, mbta-basics, planning]
related: [mg_pay_for_t, mg_subway_vs_bus]
```

If you've never taken a city bus, or haven't in years, here's what to expect. It's easier than it feels in advance.

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
- **Drivers are used to new riders.** If you're not sure whether you got the right bus or how something works, just ask.

---

### `mg_transit_plus_walking`

```yaml
id: mg_transit_plus_walking
title: "Combining transit with walking or biking"
slug: transit-plus-walking-or-biking
mode: transit
barrier: routes
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library]
topics: [routes, multimodal, getting-started]
related: [mg_transit_planning, mg_subway_vs_bus]
```

For trips over 3-4 miles, mixing transit with a walk or bike at each end is often the fastest and most pleasant way to get there. You skip the slowest parts of pure-transit (local bus stops, transfers), get built-in exercise without adding total time, and arrive right at the door.

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
- **For repeat trips, the routine compounds.** Once you know the timing and rhythm, the planning effort drops to nearly zero.

---

### `mg_transit_planning`

```yaml
id: mg_transit_planning
title: "Planning a transit trip — it's mostly the apps doing the work"
slug: planning-a-transit-trip
mode: transit
barrier: planning
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library]
topics: [planning, apps, getting-started]
related: [mg_subway_vs_bus, mg_transit_plus_walking]
```

Planning a transit trip used to mean reading printed schedules and hoping the bus showed up. Today the apps do all of that. Here's how to use them well.

**1. Use the Transit app or Google Maps.** Both pull live MBTA data — real-time bus and train locations, predicted arrivals, and full route options.
- **Transit (the app):** Best for transit-specific use. Faster, cleaner, with countdown clocks for nearby stops the moment you open it.
- **Google Maps:** Best when comparing transit against walking or biking. The "Transit" tab shows multiple options ranked by total time.
- **MBTA's own app and mbta.com/trip-planner:** Useful for service alerts and accessibility info.

**2. Trust the predicted arrivals.** Real-time predictions are usually within a minute or two. Don't pad your schedule based on the printed schedule — that's the worst-case version, not the typical one.

**3. Allow extra time for transfers, but only the first time.** Apps build in standard transfer time. The first time you make an unfamiliar transfer, give yourself an extra 5 minutes to find the connecting platform or stop. Once you know the layout, you'll match the app's estimate.

**4. Have a backup plan for delays.** If your bus or train is late, the same app shows the next one. Sometimes the answer is wait; sometimes it's switch routes or grab a Bluebike for the rest of the leg.

**5. Save your common trips.** Both Transit and Google Maps let you favorite or pin frequent destinations. After a week of doing this, your morning routine collapses to "open app, see when to leave."

For first-time multi-leg trips, screenshot the directions in case signal drops on the platform.

---

### `mg_transit_time`

```yaml
id: mg_transit_time
title: "When transit is actually the faster option"
slug: when-transit-is-faster
mode: transit
barrier: time
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library]
topics: [motivation, mbta-basics]
related: [mg_subway_vs_bus, mg_transit_plus_walking]
```

Transit can feel slower than driving, but on most trips into or across downtown Boston, it isn't — once you count the full door-to-door time and what driving actually costs you in stress and parking. Here's when transit wins.

**1. Anywhere downtown, in or out.** Driving into Back Bay, Downtown Crossing, the Seaport, or anywhere along the Red Line corridor means crawling traffic plus a parking search. The subway is signal-independent — it runs the same speed at 8 AM and 11 AM. For most downtown trips from the inner suburbs, the Red, Orange, or Green Line is usually the faster option door-to-door.

**2. Commuter Rail into Boston, from anywhere with a station.** From Worcester, Lowell, Beverly, or any commuter rail town, the train is hard to beat by car. It runs at consistent highway-equivalent speeds, drops you at South Station or North Station, and you skip the whole parking situation. For longer commutes, this is usually the fastest option, period.

**3. Across the river, anytime.** Cambridge to Boston (or vice versa) by car is a coin flip on the bridge timing. The Red Line is consistently 10-15 minutes across the same stretch, rush hour or midnight.

**4. The "predictable arrival" advantage.** Even when transit isn't the absolute fastest option on a given day, it's the most predictable. A 25-minute transit trip is 25 minutes most days. A 25-minute drive can be 25, 35, or 50 depending on traffic. Predictability is its own kind of fast — you don't have to leave 15 minutes early "just in case."

**5. What you do with the time.** A 30-minute drive is 30 minutes of driving. A 30-minute train ride is 30 minutes of reading, working, podcast-listening, or zoning out. For a daily commute, that adds up to several hours a week of time you get to spend on something else.

**Try this first:** Pick a trip you usually drive — ideally one with downtown parking or peak-hour traffic. Compare Google Maps' driving tab against the Transit tab, including walks at each end. Most people are surprised at how close they are, and predictability tilts the rest of the math.

---

## Walking (3 guides)

### `mg_walking_vs_driving`

```yaml
id: mg_walking_vs_driving
title: "When walking is actually the faster option"
slug: when-walking-is-faster
mode: walking
barrier: time
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library, nudge_card]
topics: [motivation, short-trips]
related: [mg_walking_carrying]
```

Walking is faster than driving for more short trips than people expect — once you count door-to-door time. Here's when it wins.

**1. Trips under half a mile.** Walking 0.5 miles takes about 10 minutes. Driving the same distance often takes longer once you count the trip to your car, traffic, and the trip from parking to the door. The shorter the trip, the more lopsided the math.

**2. Anywhere parking is hard.** Cambridge, Somerville, the Seaport, downtown Boston, anywhere near a hospital or a college — if you'd spend 5-10 minutes hunting for a spot, walking from a few blocks farther out is often faster door-to-door.

**3. Round trips with multiple stops.** Need to grab coffee, drop off a package, and pick something up at the pharmacy on the same block? Walking handles a chained errand without the park-and-re-park overhead at each stop.

**4. Rush hour, when traffic is bad.** A 1-mile drive in stop-and-go traffic can easily take 10-15 minutes. A 1-mile walk is 20 minutes — sometimes faster than the drive, almost always more pleasant.

**5. What walking does that GPS doesn't track.** A 15-minute walk burns about 60 calories, lets you notice your neighborhood, and ends with you in a better mood than you started.

**Try this first:** Pick one trip you usually drive that's under a mile. Walk it once and time yourself door-to-door. Most people are surprised at how close the times are.

---

### `mg_walking_carrying`

```yaml
id: mg_walking_carrying
title: "Walking with stuff: how to carry what you need"
slug: walking-with-stuff
mode: walking
barrier: carrying
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library]
topics: [carrying, gear, errands]
related: [mg_cargo_bike, mg_walking_vs_driving]
```

Carrying stuff is the most overstated walking barrier. Most things people assume require a car can be carried on foot with the right setup. For the rest, there are still good options. Here's what works.

**1. A rolling cart is the unsung hero.** A folding utility cart (sometimes called a "granny cart") holds 50+ pounds of groceries, pulls easily on sidewalks, and folds flat at home. They cost $30-60 and have changed the game for plenty of car-free families. Ikea, Amazon, and most hardware stores carry them.

**2. A backpack and a few foldable bags cover most everyday loads.** A backpack is hands-free and distributes weight; foldable bags tucked inside mean you're never caught short for a bigger haul. For groceries specifically, two reusable totes (one in each hand) carry weight more comfortably than one giant bag and let you rebalance as you go.

**3. For loads beyond walking, an e-cargo bike covers the middle ground.** An e-cargo bike handles a Costco run, a beach-day load, a trip to the lumber yard — most of what people assume requires a car. You don't have to buy one to find out; see *What you can do with an e-cargo bike* for the rental and library options that let you try one for a weekend.

**4. Use delivery for the truly bulky.** A 12-pack of paper towels or a case of sparkling water is more of a delivery problem than a walking or biking one. Most grocery stores in Greater Boston offer delivery, and one delivery a week handles what's left.

**5. Schedule around it.** Two smaller walking trips a week often work better than one big haul. Smaller loads, more steps, less of a production.

Together, a rolling cart, an e-cargo bike, and a delivery subscription cover almost any load people typically drive for.

---

### `mg_walking_weather`

```yaml
id: mg_walking_weather
title: "Walking through the weather"
slug: walking-through-the-weather
mode: walking
barrier: weather
status: approved
content_type: micro_guide
surfaces: [home_feed, guide_library]
topics: [weather, gear, year-round]
related: [mg_biking_in_rain, mg_cold_weather]
```

Weather is most people's biggest walking hesitation, but most weather is more walkable than it looks from the warm side of a window. Here's what to know.

**1. The right shoes are step one.** Waterproof shoes (any decent pair, not specialty gear) make rain a non-event. Insulated boots make a 25°F walk perfectly comfortable. Non-waterproof shoes are often the real problem people blame on weather.

**2. Cold weather is a layering question, not a temperature question.** A light shell over your normal layers extends your comfort range a long way. The "dress like it's 15°F warmer" rule from biking applies here too — you'll warm up within a few blocks. Cover your ears and hands; everything else takes care of itself.

**3. Light rain is fine.** A waterproof jacket and a hood handle the typical drizzle that stops people from walking. An umbrella works for steady rain on a calm day; in wind, a hooded shell is better.

**4. Hot weather is about pace and hydration.** On 90°F days, walk slower, take a water bottle, stay on the shadier side of the street, and consider a hat. Pre-9 AM and post-7 PM hours are usually perfectly walkable even in summer.

**5. Know your bail-out options.** Real bad weather — sleet, lightning, dangerous heat — is the right time to take the T, take a rideshare, or stay home. Walking should be a default, not an obligation. Knowing the bail-out option in advance makes you more willing to start.

Most "the weather is bad" conclusions are made by people standing inside dressed for inside. Take a 5-minute walk to the corner and back before deciding it's a no-go day; the answer is usually different than expected.

---

## End of library

**Total: 20 guides** (10 cycling, 7 transit, 3 walking) plus 2 deprecations (`mg_blue_bikes`, `mg_return_bluebike`).

If anything in this file needs to change before the seed migration runs, edit here first — this file is the source of truth. Re-running the parser produces a fresh migration.
