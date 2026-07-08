# Shift Town Pages — Build Spec

Public, evergreen, SEO-oriented per-town impact pages for Shift. The organic
top-of-funnel that needs **zero user sharing** — Google distributes them.
Reuses the existing Shift Your Summer leaderboard infrastructure; this is a new
*view* of data we already render, not a new system.

Mockup (structure + real Somerville data): the town-page mockup from the July 7
PLG session. Screenshots there are the source of truth for section order and copy tone.

## Goal & success metric
Rank in local search ("biking in Somerville", "Somerville bike commute", "car-free
Somerville") → pull high-intent local searchers → installs. **Success: ≥100 organic
sessions/mo (Search Console) + ≥15 UTM-attributed installs within 8 weeks** of the
first 9 pages going live.

## Routes (App Router, evergreen — NOT nested under /events)
- **Index / hub:** `src/app/shift/towns/page.tsx` — "Greater Boston is moving": the
  full inter-town leaderboard, each row linking to its town page. Its own SEO asset
  and the internal-link parent.
- **Per-town:** `src/app/shift/towns/[slug]/page.tsx` — `params` is a `Promise`, `await` it.
- **Phase 2:** neighborhoods `src/app/shift/towns/[slug]/[neighborhood]/page.tsx`,
  plus per-roam and per-event pages (same pattern).

## Rendering
`export const revalidate = 3600` (ISR — cacheable + crawlable + fresh). Do **not**
use `force-dynamic` (the SYS leaderboard uses it because it's a live board; these
must be fast and crawler-friendly).

## Data (server components, `createServerSupabaseClient()` from `src/lib/supabase-server.ts`, service-role)
Find the active public competition the way `src/app/events/shift-your-summer/page.tsx`
does (`competitions` where `is_public`, `group_id is null`, name like `%Shift Your Summer%`).

| Section | Source |
|---|---|
| **Hero + stat row** (active trips, active miles, CO₂ avoided, neighbors) | Month-to-date aggregate on `trips` ⋈ the town's `group_members`: `mode not in ('drive','carpool','other')`, `user_confirmed`, `started_at >= date_trunc('month', now())`. Active trips, active miles (`sum(distance_miles)`), CO₂ lbs (`miles × 404 / 453.592`), distinct active users. |
| **Leaderboard (the race)** | `rpc('get_event_standings', {p_competition_id, p_group_ids: matchup_group_ids, p_days: 90, p_only_public: true})` → geo standings (`groupType in ('town','neighborhood')`). Reuse **`GroupStandingsTable`** from `src/app/events/shift-your-summer/LeaderboardTabs.tsx`; highlight this town's row. When no competition is active, fall back to the month aggregate ranking across towns. |
| **Momentum sparkline** | Weekly active-trip counts for the town, last ~5 completed weeks. **Exclude the in-progress current week** so it never reads as a fake drop. |
| **Mode split** (walk / bike / transit — trips *and* miles) | Same month aggregate grouped by mode bucket: walk; bike+escooter; transit_bus/train/commuter_rail. Show both trips and miles — they tell different stories. |
| **Events near the town** | `event_details` where `qc_passed_at is not null`, future-dated, **within N miles of the town centroid** (proximity on `location_lat`/`location_lng` — NOT a name match; events are region-wide and untagged by town). |
| **Roams** | `roams` (nearby / `featured`), 2–3. |
| **Rewards Partners** | `sponsors` where `status='active'` and the location is in this town, showing `name`, logo, and the real offer (`discount_type`). **Interim match:** `address ILIKE '%<town>%'` (address is free-text; 11 partners have addresses, e.g. 4 in Somerville). **Better:** parse/geocode `sponsors.address` into a town field so matching is reliable — flag this as a data-cleanup follow-up. Drives foot traffic to partners AND adds real local-business names for SEO. |
| **Town list / lookup** | `groups` where `type='town'`. Auto-grows (town groups seed on signup for new MA towns). |

## Page structure (section order — matches the mockup)
1. **Hero** — "[Town] is on the move" + the standing.
2. **Stat row** — active trips · active miles · CO₂ avoided · neighbors (this month).
3. **Data-source note** (see Framing rules) — required, directly under the stats.
4. **Momentum** — sparkline of weekly active trips.
5. **Leaderboard** — `GroupStandingsTable`, this town highlighted, a "X trips from #1" hook.
6. **Mode split** — "How [Town] moves", walk/bike/transit bars (trips + miles).
7. **"What is Shift?" explainer** — one plain-language box for first-time search visitors.
8. **Events near [Town]** + **Roams** (two panels).
9. **Rewards Partners** — "Shift Rewards in [Town]", partner cards (logo, address, offer).
10. **CTA** — a civic line ("Help [Town] catch #1") + `StoreButtons` UTM-tagged.
11. **Footer** — existing `Footer`, with methodology.

## Framing rules (non-negotiable — brand voice)
- **Never adversarial to cars.** "active miles", never "car-free miles". Frame CO₂
  as "avoided, estimated from active miles traveled (EPA 404 g/mi baseline)", not
  "vs. driving". Lead with what we're for (active transportation), not against.
- **Honest data framing.** Every page states, near the stats and in the footer:
  *"Based on trips logged by Shift users who live in [Town] — a growing sample,
  meant as an interesting local signal, not an official or census-level count."*
- **Rewards Partner**, never "sponsor", in user-facing copy.

## Design
Dark navy `#191A2E` house style (match `/shift` and the SYS leaderboard — the mockup
is light for readability only; production is dark). Bricolage Grotesque (`--font-bricolage`,
`font-display font-extrabold tracking-tighter`) for display, DM Sans (`font-sans`) body.
Accents: lime `#BAF14D`, blue `#2966E5`, gold `#EDB93C`. Reuse `Nav`, `Footer`,
`Eyebrow`, `GradientBg`, `CtaSection`, `StoreButtons`, `GroupStandingsTable`. Follow
`shift-pages-design-brief.md`. `slugify()` / `withUtm()` from `src/lib/utm.ts`
(`withUtm(storeUrl, {source:'web_town', campaign: slugify(townName)})`).

## SEO
- `generateMetadata({params})` per town (copy `src/app/events/[id]/page.tsx`): title
  "Walking, Biking & Transit in [Town] — Shift"; description with the town + a live stat.
- Open Graph / Twitter (copy `src/app/shift/page.tsx`); optional dynamic per-town OG
  image via the existing `/api/og` route.
- **JSON-LD** (net-new to the repo): `Organization` + `Event` schema for the listed events.
- **Sitemap:** extend `src/app/sitemap.ts` to emit `/shift/towns` and each `/shift/towns/{slug}`
  (mirror the `/guides/{slug}` block, try/catch). Emit only towns that clear the gate.
- Add `src/app/robots.ts` if absent.

## Publication gate
Publish + sitemap a town only when it clears a **data floor** — start at **≥10 users**
(adjustable; consider "≥10 users AND ≥50 trips this month" for a stronger first
impression). Rationale: thin pages hurt SEO (Google demotes low-value pages), risk
inferring individual behavior (privacy), and read as un-credible. Gates *publication*,
not data collection — a town below the floor still collects data and appears
automatically once it crosses. **Today, 9 of 11 towns qualify:** Cambridge (109),
Somerville (100), Boston (97), Medford (27), Brookline (27), Arlington (25),
Watertown (20), Everett (12), Newton (11). Below: Salem (6), Marblehead (5).

## Navigation into the pages
1. **Search** (primary — the whole point). 2. The `/shift/towns` hub (linked from
`/shift` nav). 3. **From the app** — link the neighborhood/leaderboard screen to the
user's town page ("See / share [Town]'s page"), connecting app↔web and giving a
share hook. 4. Inter-town links (each leaderboard row → that town's page). 5. Org
newsletter / social.

## Phasing
- **Phase 1:** the 9 qualifying town pages + the `/shift/towns` hub + sitemap + JSON-LD.
- **Phase 2:** neighborhood pages (Davis Sq, Union Sq…), per-roam pages, per-event
  pages; geocode `sponsors.address` for reliable partner→town matching; dynamic OG images.

## Town Hub expansion (added July 8 — Keith approved)

Phase 1 (above) SHIPPED July 8: `src/app/shift/towns/page.tsx` + `[slug]/page.tsx`,
`src/lib/towns/queries.ts`, `src/components/towns/TownSections.tsx`, sitemap +
`robots.ts`. Data via Shift RPCs `get_town_directory()` / `get_town_page_stats(uuid)`
(Shift migration 00553). Slugs are `name-state` (`somerville-ma`) — nationally
collision-proof. Leaderboard ranks by month active trips (evergreen; no
competition dependency). Deviation from the original spec: `get_event_standings`
is not used — the month aggregate ranking IS the leaderboard.

Approved follow-on phases (full architecture in the July 8 plan):

- **Trip-corridor heatmap** (Phase 2) — "how this town actually moves." Shift-side
  pipeline: `town_corridor_heatmap` cache table + nightly compute. Privacy floor:
  ≥3 distinct users per segment, 200m endpoint trimming, intensity bands, 90-day
  window; town publishes at ≥10 users + ≥25 segments. Web renders via maplibre-gl
  GeoJSON line layers (pattern: `src/components/wayfinding/EventMap.tsx`) + a
  crawler-readable text summary. Section hidden entirely below the floor.
- **Civic / Get Involved layer** (Phase 2) — `town_resources` table (Shift repo):
  local ped/bike advocacy groups, Safe Streets organizers, town transportation
  dept links, public meetings (union with `infrastructure_hearings`). Curated in
  the Shift admin (hearings-approval pattern); AI-assisted research
  (`research-town-resources` edge fn) for national seeding, humans approve.
  Empty state = "Know a local group working on safer streets? Tell us."
- **In-app town profile** (Phase 2) — `app/(tabs)/community/town.tsx`, streamlined:
  stat hero, heatmap card, mini leaderboard, "Near you now" live card, Get
  Involved, "Share [Town]'s page" (UTM'd web link — closes the app→web SEO loop).
- **Live transit + bikeshare** (Phase 3) — GBFS national from day one (keyless);
  transit behind a provider adapter (`town_live_config` table: mbta | transitland),
  MBTA-only v1. Client-component widgets + `/api/town-live/[slug]` proxy — never
  server-fetched into ISR HTML. No config row ⇒ section doesn't render.
- **Degradation contract** — the always-present skeleton (hero, stats, disclaimer,
  leaderboard, explainer, CTA) must look complete on its own; every optional
  section returns null when empty. A 12-user town in any state looks intentional.

## Reusable pieces (from the gsi-website map)
- Data client: `src/lib/supabase-server.ts` → `createServerSupabaseClient()`.
- Leaderboard UI: `src/app/events/shift-your-summer/LeaderboardTabs.tsx` (`GroupStandingsTable`, `GroupStanding` type).
- Shell/CTA: `src/components/Nav.tsx`, `Footer.tsx`, `StoreButtons.tsx`; `Eyebrow`/`GradientBg`/`CtaSection` (inline in the SYS `page.tsx`).
- Metadata patterns: `src/app/events/[id]/page.tsx` (`generateMetadata`), `src/app/shift/page.tsx` (OG).
- `src/app/sitemap.ts` (extend), `src/lib/utm.ts` (`slugify`, `withUtm`).
