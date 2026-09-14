# Roam distance audit — 2026-09-14

**Why now.** SEO item 2 shipped today and put each Roam's `distance_miles` at the
front of its page title, its search snippet, and its llms.txt entry. Yesterday a
wrong distance was a detail on the page; today it is the first thing a searcher
reads. Keith asked for the audit.

**What was compared, and what deliberately was not.** A Roam is an achievable
experience — a route someone can actually do in an afternoon — not a survey of a
trail's full length. So this audit never compares a Roam against an outside
source's figure for "the" trail (a Roam that covers 3 miles of a 10-mile rail
trail is not wrong). It compares each Roam's stated distance against **the route
we stored for it** (`route_geometry`), and cross-checks that against the sum of
its legs and the straight-line chain through its required stops, which is a hard
floor: a real route can only be longer.

Method: `scripts/seo/audit-roam-distances.mjs`, read-only, same Supabase source
the pages render from. 25 active Roams, 25 with geometry.

## The short version

**18 of 25 are clean.** Stated distance within a few percent of the stored route,
legs agree, pace plausible for the mode.

**7 are flagged, in four different ways** — and the leg sums are what separate
them. Every Roam's legs add up to its stated total (4.92 ≈ 4.9, 1.48 ≈ 1.5,
18.12 ≈ 18.1), so no stated number is a typo. Where stated and geometry disagree,
one of the two *sources* is wrong, and which one differs case by case.

### A. The stated distance is wrong — 1 Roam

| Roam | Stated | Stored route | What happened |
|---|---|---|---|
| **Fresh Pond Loop** | 1.5 mi / 34 min | **2.45 mi**, closes a loop, 367 points | The legs were measured as straight lines between the four stops (they sum to 1.48; the straight-line chain is 1.49 — identical). But the route circles a reservoir, and a circle is a lot longer than the chords through four points on it. The stored perimeter trace is 2.45 mi, which is also what the reservoir's perimeter path actually measures. |

**Recommend:** `distance_miles` → **2.5**, and `estimated_minutes` from 34 to
about **50** at a walking pace (2.45 mi at 3 mph). The leg distances should be
re-measured along the path, not point to point. This is the one that is live in a
title right now saying a number that is wrong by 40%.

### B. The stated distance is right; the stored route is incomplete — 3 Roams

The tell is physical: the stored route is **shorter than the straight line
through the stops it visits**, which cannot happen. These affect the map drawn on
the page, not the number in the title.

| Roam | Stated | Stored route | Straight-line floor through stops |
|---|---|---|---|
| **Mass Central Rail Trail: Sudbury to Hudson** | 5.4 mi | 3.84 mi (34 points) | **5.52 mi** |
| **Battle Road Trail** | 4.9 mi | 3.87 mi (124 points) | **4.55 mi** |
| **Manhan Rail Trail** | 4.3 mi | 3.75 mi (44 points) | **3.99 mi** |

In all three the legs sum to the stated total and the stated total is at or
above the floor, so the number on the page is credible. The geometry is missing
a leg (Sudbury–Hudson and Battle Road) or cuts a corner (Manhan). **Recommend:**
re-trace the route geometry; leave the distances alone. Note the July audit's
invariant — geometry was explicitly out of scope for that copy-only fix — so
these have been this way at least since then.

### C. Needs your judgment — 2 Roams

| Roam | Stated | Stored route | The question |
|---|---|---|---|
| **WWII Veterans Memorial Trail** | 3.4 mi / 22 min (bike) | 5.67 mi (39 points) | The stored route is 2.3 mi *longer* than the Roam. Stated pace is 9.3 mph, exactly right for a bike; 5.67 mi in 22 min would be 15.5 mph, which it is not. So the 3.4 is probably the experience and the geometry is probably the whole trail, or an out-and-back. **This is your "achievable experience" case** — the fix, if any, is to trim the drawn route to what the Roam actually does, or leave it and accept the map shows more trail than the Roam covers. |
| **The Harbor Islands Hop** | 18.1 mi / 420 min (ferry) | 8.16 mi (101 points) | The stored route is identical to the straight-line chain through the stops (8.16 = 8.16) — it is just lines between islands, so it under-measures water miles by definition. The legs sum to 18.12, so 18.1 is presumably the real ferry mileage. The number may be right and the map crude. The better question is whether **ferry miles should headline the title at all**: "an 18.1-mile guided route" is accurate and slightly odd for a trip where the walking is a couple of miles. Options: leave it; or set the title distance from the on-foot legs only. |

### D. The copy promises a loop the route does not close — 1 Roam

| Roam | Stated | Stored route | Issue |
|---|---|---|---|
| **Charles River Bike Path Loop** | 4.1 mi | 4.15 mi, **open** — ends 1.5+ mi from the start | Name and copy say "Loop"; legs and geometry agree at 4.1 mi and neither returns to the start. Either the route should close (and the distance grows), or the name should. Distance itself is fine. |

### Not flagged, on purpose

Three Roams have a slow implied pace — Harbor Walk to Eastie Eats (1.7 mph),
Museum Hop (1.2 mph), The B-Line Crawl (0.6 mph). Those are an eating tour, a
museum day, and a bar crawl; the time includes the point of the trip. The script
now only flags a pace that is too *fast* for the mode, which is the direction
that indicates a wrong number. None are.

### What this means for the title change

The change is doing what it should — it surfaced a 40% error that had sat on
the page unnoticed — and 24 of 25 titles are stating a defensible number. The
one to fix first is Fresh Pond, because it is the Roam with the most search
impressions (265 last week) and its title currently says 1.5. Categories B and
C do not affect the title; category D is a naming question.

Fixes go through the Roam data in the Shift project (per the Roam Playbook —
the website is read-only on this data). Once `distance_miles` changes, the
website page, snippet, JSON-LD and llms.txt all update on their own within the
hour; nothing on the website needs editing.

---

## Full table

| Roam | Mode | Stated | Measured | Δ | Stops floor | Loop? | Pace | Flags |
|---|---|---|---|---|---|---|---|---|
| [A City of Squares](https://www.gogreenstreets.org/shift/roams/roam-1776607065055) | multi | 4 mi / 36 min | 4.09 mi (route_geometry, 651 pts) | -0.09 (-2.3%) | 3.57 mi | open | 6.7 mph | ✓ |
| [Battle Road Trail](https://www.gogreenstreets.org/shift/roams/battle-road-trail) | walk | 4.9 mi / 99 min | 3.87 mi (route_geometry, 124 pts) | +1.03 (+26.6%) | 4.55 mi | open | 3 mph | ⚠ stated is 1 mi LONGER than route<br>⚠ stored route (3.9 mi) is shorter than the straight line through its own stops (4.5 mi) — geometry incomplete |
| [Charles River Bike Path Loop](https://www.gogreenstreets.org/shift/roams/charles-loop) | bike | 4.1 mi / 27 min | 4.15 mi (route_geometry, 89 pts) | -0.05 (-1.2%) | 2.6 mi | open (copy: loop) | 9.1 mph | ⚠ copy says loop, route does not return to start |
| [Emerald Necklace Bike Route](https://www.gogreenstreets.org/shift/roams/emerald-necklace) | bike | 7.3 mi / 49 min | 7.34 mi (route_geometry, 1369 pts) | -0.04 (-0.5%) | 4.41 mi | open | 8.9 mph | ✓ |
| [Fort River Trail (Silvio O. Conte Refuge)](https://www.gogreenstreets.org/shift/roams/fort-river-trail) | walk | 0.9 mi / 19 min | 0.98 mi (route_geometry, 69 pts) | -0.08 (-8.1%) | 0.67 mi | closes (copy: loop) | 2.8 mph | ✓ |
| [Fresh Pond Loop](https://www.gogreenstreets.org/shift/roams/fresh-pond-loop) | multi | 1.5 mi / 34 min | 2.45 mi (route_geometry, 367 pts) | -0.95 (-38.7%) | 1.49 mi | closes (copy: loop) | 2.6 mph | ⚠ stated is 0.9 mi SHORTER than route |
| [Harbor Walk to Eastie Eats](https://www.gogreenstreets.org/shift/roams/eastie-eats) | multi | 1.7 mi / 60 min | 1.72 mi (route_geometry, 245 pts) | -0.02 (-1%) | 1.27 mi | open | 1.7 mph | ✓ |
| [Manhan Rail Trail](https://www.gogreenstreets.org/shift/roams/manhan-rail-trail) | bike | 4.3 mi / 29 min | 3.75 mi (route_geometry, 44 pts) | +0.55 (+14.8%) | 3.99 mi | open | 8.9 mph | ⚠ stored route (3.7 mi) is shorter than the straight line through its own stops (4 mi) — geometry incomplete |
| [Marblehead Rail Trail](https://www.gogreenstreets.org/shift/roams/marblehead-rail-trail) | bike | 5.5 mi / 39 min | 5.6 mi (route_geometry, 108 pts) | -0.1 (-1.7%) | 3.08 mi | open | 8.5 mph | ✓ |
| [Mass Central Rail Trail: Sudbury to Hudson](https://www.gogreenstreets.org/shift/roams/mcrt-sudhud) | bike | 5.4 mi / 34 min | 3.84 mi (route_geometry, 34 pts) | +1.56 (+40.8%) | 5.52 mi | open | 9.5 mph | ⚠ stated is 1.6 mi LONGER than route<br>⚠ stored route (3.8 mi) is shorter than the straight line through its own stops (5.5 mi) — geometry incomplete |
| [Minuteman Bikeway](https://www.gogreenstreets.org/shift/roams/minuteman) | bike | 6.4 mi / 42 min | 6.39 mi (route_geometry, 88 pts) | +0.01 (+0.2%) | 5.88 mi | open | 9.1 mph | ✓ |
| [Museum Hop](https://www.gogreenstreets.org/shift/roams/museum-hop) | multi | 3.6 mi / 180 min | 3.64 mi (route_geometry, 615 pts) | -0.04 (-1.2%) | 3.02 mi | open | 1.2 mph | ✓ |
| [Mystic River Greenway (Alewife to Medford)](https://www.gogreenstreets.org/shift/roams/alewife-mystic-greenway) | bike | 6.7 mi / 41 min | 6.74 mi (route_geometry, 1191 pts) | -0.04 (-0.7%) | 4.87 mi | open | 9.8 mph | ✓ |
| [North Point to City Hall](https://www.gogreenstreets.org/shift/roams/north-point-city-hall) | bike | 1.6 mi / 10 min | 1.69 mi (route_geometry, 317 pts) | -0.09 (-5.1%) | 1.06 mi | open | 9.6 mph | ✓ |
| [Salem by Rail](https://www.gogreenstreets.org/shift/roams/salem-by-rail) | transit | 16.6 mi / 240 min | 16.58 mi (route_geometry, 407 pts) | +0.02 (+0.1%) | 13.77 mi | open | 4.2 mph | ✓ |
| [Shining Sea Bikeway](https://www.gogreenstreets.org/shift/roams/shining-sea-bikeway) | bike | 8.8 mi / 57 min | 8.62 mi (route_geometry, 68 pts) | +0.18 (+2.1%) | 7.97 mi | open | 9.3 mph | ✓ |
| [Somerville Community Path](https://www.gogreenstreets.org/shift/roams/community-path) | bike | 4 mi / 27 min | 4.04 mi (route_geometry, 94 pts) | -0.04 (-0.9%) | 2.64 mi | open | 8.9 mph | ✓ |
| [The B-Line Crawl](https://www.gogreenstreets.org/shift/roams/b-line-crawl) | transit | 0.9 mi / 90 min | 0.92 mi (route_geometry, 32 pts) | -0.02 (-2.5%) | 0.56 mi | open | 0.6 mph | ✓ |
| [The Bakery Run](https://www.gogreenstreets.org/shift/roams/bakery-run) | transit | 5.7 mi / 90 min | 5.71 mi (route_geometry, 908 pts) | -0.01 (-0.3%) | 4.37 mi | open | 3.8 mph | ✓ |
| [The Freedom Trail](https://www.gogreenstreets.org/shift/roams/freedom-stroll) | walk | 3.5 mi / 70 min | 3.53 mi (route_geometry, 151 pts) | -0.03 (-0.9%) | 2.15 mi | open | 3 mph | ✓ |
| [The Harbor Islands Hop](https://www.gogreenstreets.org/shift/roams/harbor-islands) | multi | 18.1 mi / 420 min | 8.16 mi (route_geometry, 101 pts) | +9.94 (+121.8%) | 8.16 mi | closes | 2.6 mph | ⚠ stated is 9.9 mi LONGER than route |
| [The Sunset Pedal](https://www.gogreenstreets.org/shift/roams/sunset-pedal) | bike | 1.6 mi / 10 min | 1.59 mi (route_geometry, 27 pts) | +0.01 (+0.4%) | 1.43 mi | open | 9.6 mph | ✓ |
| [Twin Cities Rail Trail](https://www.gogreenstreets.org/shift/roams/twin-cities-rail-trail) | bike | 4.3 mi / 28 min | 4.11 mi (route_geometry, 70 pts) | +0.19 (+4.6%) | 4.23 mi | open | 9.2 mph | ✓ |
| [Wachusett Greenways (Mass Central Rail Trail)](https://www.gogreenstreets.org/shift/roams/wachusett-greenways) | bike | 7.3 mi / 48 min | 7.26 mi (route_geometry, 108 pts) | +0.04 (+0.6%) | 5.7 mi | open | 9.1 mph | ✓ |
| [WWII Veterans Memorial Trail](https://www.gogreenstreets.org/shift/roams/wwii-veterans-memorial-trail) | bike | 3.4 mi / 22 min | 5.67 mi (route_geometry, 39 pts) | -2.27 (-40.1%) | 3.1 mi | open | 9.3 mph | ⚠ stated is 2.3 mi SHORTER than route |

**How to read it.** *Stated* is what the page title, snippet and llms.txt now lead with. *Measured* is our own stored route, walked point to point. *Stops floor* is the straight-line chain through the required stops — a real route can only be longer than this, so a stated distance below it is wrong on its face. *Loop* is whether the stored route ends within 0.15 mi of where it starts; when the copy says "loop" or "circle" and the route is open, the copy is promising more than the route delivers. *Pace* is stated distance over stated time, sanity-checked against a wide band for the mode.

