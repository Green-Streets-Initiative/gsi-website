# DRAFT — proposed micro-guide (SEO item 1, report 2026-10-05)

Not live. The public site only renders Supabase rows with `status='approved'`;
this file renders nothing.

**Why this guide.** `year-round-weather` has had three published guides
(`mg_biking_in_rain`, `mg_cold_weather`, `mg_walking_weather`) and essentially
zero impressions across every Search Console pull since August (2 in the 28
days to 2026-10-02). The 2026-10-05 teardown found the query is won by **one
comprehensive, local page per publisher**: Streetsblog's December 2022 piece
(named Boston riders, local shops, ~1,500 words, now dated) and boston.gov's
Winter Biking page (updated 2026-01-12, named routes, no word on how bike lanes
get cleared). Our three guides are good general advice with nothing in them
that says *Boston*. This is the hub the watch list asked for since 2026-09-08:
the local facts the two winners leave out (how the lanes are cleared and how
fast, what Bluebikes does in winter, where to ride first, who to call), then a
hand-off to the three existing guides for gear. It is a hub, not a fourth gear
guide: gear stays in `mg_cold_weather` and `mg_biking_in_rain`.

**Timing.** The seasonal search window opens in November. Shipping in October
gives Google a few weeks to find it first.

**Sources, verified 2026-10-05.**
- Protected bike lanes cleared within 24 hours of the end of a snowfall;
  flex-posts on Mass Ave removed ahead of big storms; 311 for a missed street —
  boston.gov (Managing winter and snow; Mass Ave bike lane alert).
- Bluebikes open 24/7, 365 days; most stations stay in all winter, some
  on-street ones come out from October so plows can pass — bluebikes.com
  winter-operations posts.
- Named routes (Harborwalk, Southwest Corridor, Neponset Greenway, Charles River
  paths) — boston.gov Winter Biking page.
- "Roughly 40–50% of summer riders keep riding through winter" — appears in
  search results drawn from boston.gov / Boston Cyclists Union winter-survey
  pages. **Before shipping, confirm the exact source of this figure; if it
  can't be confirmed, cut that sentence** (the guide reads fine without it).

**Messaging self-check** (`seo/strategy.md`): no comparison against cars or
driving; leads with what winter riding gives (quiet streets, arriving warm and
awake); no toughness-shaming or "excuses" framing; transit appears as a friendly
partner for storm days, never as a fallback from failure; "active
transportation" not needed here and "sustainable" not used; no sentence defines
by negation.

## Ship checklist

1. Append the YAML+body block below to `content/micro-guides-library.md` (in
   the cycling/weather section, next to `mg_cold_weather`).
2. **Change `status: draft` to `status: approved`.**
3. Bump the guide-count check in `scripts/build-micro-guides-migration.mjs`
   from `!== 22` to `!== 23`.
4. Add `mg_boston_winter` to the `related:` lists of `mg_cold_weather`,
   `mg_biking_in_rain` and `mg_walking_weather` so the three existing guides
   point at the hub (this is the "tie them together" half of the change).
5. `node scripts/build-micro-guides-migration.mjs`
6. Commit both files by filename, push, apply the generated migration.
7. After the migration lands, check the `/guides` index, `sitemap.xml` and
   `llms.txt` — not just `/guides/<slug>`.

---

### `mg_boston_winter`

```yaml
id: mg_boston_winter
title: "Biking through a Boston winter: how local riders keep rolling"
summary: "Plenty of Bostonians ride straight through to spring. How the city clears bike lanes, what Bluebikes does in winter, the routes to start on, and the gear that makes it comfortable."
slug: biking-through-a-boston-winter
mode: cycling
barrier: weather
status: draft
content_type: micro_guide
surfaces: [home_feed, guide_library]
topics: [weather, year-round, planning, local]
related: [mg_cold_weather, mg_biking_in_rain, mg_walking_weather]
```

Riding through a Boston winter is more ordinary than it sounds. A big share of the people who bike here in summer keep going right through to spring — roughly 40 to 50 percent, by local winter-riding surveys. They get quiet streets, crisp air, and an arrival that feels earned. Here's what makes it work in this city specifically.

### The city clears protected bike lanes after a storm.

Boston Public Works aims to clear protected bike lanes within 24 hours of the end of a snowfall, using small plows and salt spreaders sized for the lanes. On Mass Ave, crews pull the flexible posts ahead of a big storm so the lane can be cleared edge to edge, then put them back.

If a lane on your route stays buried, report it to **311** (call, or use the BOS:311 app) — the reports go straight to the crews.

### Bluebikes runs all winter.

Bluebikes is open 24 hours a day, every day of the year, across Boston, Cambridge, Somerville, Brookline and Everett. Most stations stay in place all winter. Starting in October, a handful of on-street stations come out for the season so plows can get through, so check the station map in the app before you head out — your usual dock may have a winter neighbor a block away.

Bluebikes is also an easy way to try a winter ride before committing your own bike to the salt.

### Start on paths and quiet streets.

Your first few winter rides go best on routes with fewer cars and wider room. The City of Boston points winter riders to:

- **The Southwest Corridor** through Jamaica Plain, Roxbury and the South End.
- **The Harborwalk** along the waterfront.
- **The Neponset River Greenway** in Mattapan and Dorchester.
- **The paths along the Charles River.**

Ride a slower, steadier pace than you would in July, and give yourself a few short trips to learn how your bike feels on cold pavement.

### Dress for the ride, and the rest follows.

Your body makes plenty of heat once you're moving, so dress to feel slightly cool when you step outside. Our [cold-weather biking guide](/guides/cold-weather-biking) covers layering, hands and feet, and the gear that matters most below freezing. Our [rain guide](/guides/biking-in-the-rain) covers fenders and staying dry on the wet days, which in a Boston winter are as common as the snowy ones.

### Watch for the shiny patches.

Below freezing, a thin film of water can turn to black ice. Treat shiny pavement, painted lines and metal plates as slow zones, brake early and gently, and keep your tire pressure a little lower than usual for grip. Lights front and back, every ride — the short days mean most winter commutes happen at least partly in the dark.

### Mix and match on the stormiest days.

Winter riders here use the whole toolkit. On a heavy-snow morning, the T, a bus, or a walk ([our guide to walking through the weather](/guides/walking-through-the-weather)) gets you there, and the bike is ready again a day or two later. Choosing the best mode for the day is part of what makes year-round riding easy to keep up.

### One last thing

Winter is when bike shops are quietest, so it's a great time for a tune-up — and our [events calendar](/events) lists free repair clinics around Greater Boston. A bike that shifts and stops cleanly makes every cold ride more pleasant.
