# Bike lessons test: two ad groups (APPROVED 2026-10-28, not yet in the account)

Keith asked 2026-10-27 for a draft to review. 2026-10-28: the page and form are
live and Keith said the Ad Grants work can start (open item `bike-lessons-test`
in ads/ad-grants-state.json).
Apply from an interactive chat ("do ad grants: bike lessons"), the same way the
10-14 keyword adds were done (keywords page, blue +, pick campaign and ad group).

Search demand (Keyword Planner, Massachusetts, Oct 2025 to Sep 2026): about
200 searches a month for lessons and classes, about 60 for riding in traffic.
"Learn to bike in the city" and close variants have no measurable volume, so
that phrase is the headline, not a keyword.

## Where

- Campaign: **How-to Guides** (ID 24306480410). Already Massachusetts, Maximize
  conversions, $50/day, "Limited by search volume", so no new campaign or budget.
- Landing page: https://www.gogreenstreets.org/bike-lessons (live 2026-10-28).

## Ad group 1: Bike lessons

Final URL: `/bike-lessons`

Keywords, phrase match (monthly MA searches):

| Keyword | Searches |
|---|---|
| "bike lessons near me" | 40 |
| "learn to ride a bike" | 40 |
| "adult bike lessons" | 20 |
| "bike riding lessons for adults" | 20 |
| "cycling lessons for adults" | 20 |
| "bike classes" | 20 |
| "bicycle lessons" | 10 |
| "bike riding lessons" | 10 |
| "cycling lessons" | 10 |
| "bike lessons boston" | 10 |
| "bike lessons cambridge" | 10 |
| "learn to ride a bike boston" | 10 |
| "adult learn to ride bike" | 10 |
| "learn to ride a bike adults" | 10 |
| "how to ride a bike as an adult" | 10 |
| "learn to bike" | 10 |
| "bike safety class" | 10 |
| "bike safety course" | 10 |

Left out: "how to ride a bike" (140, mostly parents of young kids; would pull
the click rate down).

**Ad 1**
- Headlines: Bike lessons for adults · Learn to bike in the city · Free 1:1 street lesson · Classes for every level · Many classes are free · Bikes provided at most classes · Nervous in traffic? Start here · Lessons near Somerville · Classes across Massachusetts · First ride to city streets · Find a class near you · Green Streets Initiative · A Massachusetts nonprofit · Book a lesson any time · Easy group rides for beginners
- Descriptions:
  - Adult bike lessons in Massachusetts, from your first ride to riding on busy streets.
  - Can ride but nervous in traffic? Green Streets pays for a 1:1 lesson near Somerville.
  - City classes, private lessons and easy group rides. Many are free, most provide the bike.
  - Not ready yet? Get an email when a class is posted near you this spring.

**Ad 2**
- Headlines: Learn to ride a bike · Adult learn-to-ride classes · Never learned? Start here · Learn as an adult · Learn at your own pace · Bikes provided at most classes · Classes near Somerville · Boston and Cambridge classes · Many classes are free · Sliding-scale private lessons · Green Streets Initiative · Find a class near you · Lessons for grown-ups · Learn in a small group · A Massachusetts nonprofit
- Descriptions:
  - Learn to ride as an adult, with classes for people who never learned or are starting over.
  - Group classes and private lessons near Somerville, plus free city classes in season.
  - Most classes provide the bike. Find one near you, or get an email when one is posted.
  - From Green Streets Initiative, a Massachusetts nonprofit helping people bike since 2006.

## Ad group 2: Riding in traffic

Final URL: `/bike-lessons#street-lesson`

Keywords, phrase match: "how to bike in traffic" (10), "biking in traffic" (10),
"how to ride a bike in traffic" (10), "how to bike in the city" (10),
"riding a bike in the city" (10), "how to start bike commuting" (10),
"bike commuting for beginners" (10), "how to ride a bike on the road" (10).

Several may show "Not eligible: low search volume" at first. That is expected
and costs nothing.

**Ad 1**
- Headlines: Nervous biking in traffic? · Free 1:1 street lesson · Learn to bike in the city · Ride with an instructor · Practice turns and crossings · Ride at your own pace · 90 minutes, one-on-one · Green Streets pays · Near Davis Square, Somerville · Start bike commuting · Pick a calm bike route · Easy group rides near you · Classes across Massachusetts · Green Streets Initiative · Feel at home on city streets
- Descriptions:
  - An instructor rides with you on real streets, at your own pace. Green Streets pays.
  - Free 1:1 street lessons for adults who can ride and live near Somerville. 10 to start.
  - Farther away? Find a certified instructor, a city class or an easy group ride near you.
  - Practice intersections, bike lanes and turns before your first trip to work by bike.

**Ad 2**
- Headlines: How to bike in traffic · City biking, step by step · Take a free street lesson · Ride with someone first · Easy group rides for beginners · Learn the bike lanes · Classes with street skills · 1:1 lessons near Somerville · Get comfortable on the street · Green Streets pays · Start with one short trip · Find a calm route · Green Streets Initiative · Lessons for adults · A Massachusetts nonprofit
- Descriptions:
  - Ride real streets with an instructor, at your own pace. Free near Somerville.
  - Easy-pace group rides open to beginners, and city classes that cover riding with traffic.
  - Pick the lesson that fits: a 1:1 street lesson, a class, or a group ride with company.
  - From Green Streets Initiative, a Massachusetts nonprofit helping people bike since 2006.

All headlines are 30 characters or fewer and descriptions 90 or fewer (checked).

## Negative keywords (both ad groups; singular and plural)

kid, kids, child, children, toddler, toddlers, son, daughter, training wheels,
balance bike, balance bikes, spin, spinning, spin class, spin classes, peloton,
indoor cycling, motorcycle, motorcycles, dirt bike, dirt bikes, mountain bike,
mountain biking, certification, become an instructor, instructor jobs

## What counts as a result

- The main one, to add (GA4 star, then import as a Primary conversion, same
  path as 10-14): `free_lesson_code_requested`, fired when the "Send my request"
  form sends a request to the instructors. Judge the ads on this, not on downloads. Too far
  or all taken fire `free_lesson_code_unavailable` instead (not a conversion).
- Also to add (import as Engagement): `lesson_alert_signup`, the "Email me"
  form for people waiting for spring.
- Already an Ads conversion: the App Store and Google Play badges
  (`shift_store_click`, placement `bike_lessons`). On this page they show only
  after someone has asked for a code.
- Whether people went: the school's invoice lists each code used, and every
  code gets one "How did your bike lesson go?" email two weeks later
  (replies go to info@).

## Rule for judging it

Judge in April, when classes start again. Pause an ad group whose click rate
is under 5% after 300 impressions. At this volume 300 impressions may take
months; a winter read says little.

## Before it goes live

1. Keith signs off on the page; then it is committed with `robots` removed and
   `/bike-lessons` added to the sitemap.
2. The email code is switched on: Shift migration 01465 moved from
   `migrations-pending/` and applied, the `free-lessons` function deployed, a
   test code email and follow-up sent to Keith first. No app update needed.
3. Keith says go on the ad groups; Claude adds them in an interactive chat.
