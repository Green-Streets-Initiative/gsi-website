# Commute Advisor — Mode Recommendation Enhancement Spec
**URL: /commute-advisor (renamed from /commute-advisor)**
**For: Claude Code implementation**
**Version: March 2026**
**Redirect:** Add `{ source: '/commute-advisor', destination: '/commute-advisor', permanent: true }` to `next.config.ts`
**Depends on: existing calculator, Supabase anon client, MBTA V3 API,
Bluebikes GBFS, MassDOT ArcGIS (via proxy), content_items, event_details**

---

## Overview

Add a mode recommendation output to the existing Commute Advisor.
The existing savings calculator (cost, time, health, CO₂) is unchanged.
A new section appears above it after the user submits their commute —
leading with a confident mode recommendation backed by real data, a
context map, barrier identification, and personalized guides and events.

The recommendation engine does not do turn-by-turn routing. It answers
"which mode is right for my commute and why?" and hands off to Google
Maps for actual navigation.

---

## New environment variables required

```
MBTA_API_KEY=                    # already used in app — add to website Vercel project
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY= # already planned for calculator
MASSDOT_PROXY_CACHE_SECONDS=3600 # cache MassDOT responses for 1 hour
```

Bluebikes GBFS is public — no key needed.

---

## New API routes

### `GET /api/commute/recommend`

Server-side recommendation engine. Accepts origin and destination
coordinates and returns a structured recommendation object.

**Query params:**
- `origin_lat`, `origin_lng` — user's starting point
- `dest_lat`, `dest_lng` — user's destination
- `barrier` — optional, barrier_code string (e.g. "safety")

**Process:**
1. Calculate straight-line distance (Haversine formula)
2. Check Bluebikes station availability near origin and destination (GBFS)
3. Check MBTA route feasibility (V3 API — stops near origin/dest, shared routes)
4. Check MassDOT bike infrastructure near origin (via `/api/massdot-proxy`)
5. Run recommendation logic (see below)
6. Fetch relevant content from `content_items` (Supabase)
7. Fetch nearest upcoming event from `event_details` (Supabase)
8. Return structured response

**Response shape:**
```typescript
interface RecommendationResponse {
  primary: {
    modes: Mode[]                    // e.g. ['bike', 'transit']
    label: string                    // "Bike to Davis, then Red Line"
    reasons: string[]                // 3 concrete bullets
    time_estimate_minutes: number
    cost_estimate_daily: number
    google_maps_url: string          // pre-filled multimodal directions
  }
  secondary: {
    modes: Mode[]
    label: string
    time_estimate_minutes: number
  } | null
  map_data: {
    bluebikes_origin: BluebikeStation[]   // nearest 2, with live availability
    bluebikes_dest: BluebikeStation[]     // nearest 2, with live docks
    mbta_stops: MBTAStop[]               // relevant stops with line color
    bike_infra_quality: 'protected' | 'shared' | 'none' | 'unknown'
  }
  content: {
    guide: ContentItem | null
    event: EventWithDetails | null
  }
  distance_miles: number
  distance_category: 'short' | 'medium' | 'long'
}
```

**Cache:** Cache responses by origin/dest grid cell (round to 2 decimal
places) + barrier code. TTL: 10 minutes for live transit/Bluebikes data,
1 hour for MassDOT infrastructure data.

---

### `GET /api/massdot-proxy`

Proxies MassDOT ArcGIS queries server-side. Accepts lat/lng + radius,
returns bike infrastructure quality for the corridor.

```typescript
// Query the same ArcGIS endpoints used by route-initiate Edge Function
// Extract the relevant parsing logic from route-initiate/index.ts
// Return a simplified response:
interface MassDOTResponse {
  bike_infra_quality: 'protected' | 'shared' | 'none' | 'unknown'
  has_protected_lane: boolean
  has_shared_lane: boolean
  crash_clusters: number  // count of crash clusters near corridor
}
```

Cache responses for `MASSDOT_PROXY_CACHE_SECONDS` (default 1 hour).
MassDOT data changes rarely — aggressive caching is appropriate.

---

## Recommendation logic

### Distance thresholds

```typescript
const DISTANCE = {
  SHORT: 1.5,   // miles — walk viable
  MEDIUM: 6.0,  // miles — bike viable
  LONG: 12.0,   // miles — e-bike or transit
}

const TRIP_DISTANCE_RANGE = {
  short: [0, 2],
  medium: [2, 6],
  long: [6, Infinity],
}
```

### Decision tree

```typescript
function recommend(
  distanceMiles: number,
  hasBluebikesOrigin: boolean,
  hasBluikesDest: boolean,
  hasMBTARoute: boolean,
  bikeInfraQuality: string,
  barrier: string | null
): Recommendation {

  // WALK
  if (distanceMiles < DISTANCE.SHORT) {
    return {
      modes: ['walk'],
      label: 'Walk',
      reasons: [
        `${distanceMiles.toFixed(1)} miles — about ${walkMinutes(distanceMiles)} minutes on foot`,
        'No cost, no wait, no parking',
        'Counts as active transportation in Shift',
      ]
    }
  }

  // BIKE (owned or Bluebikes)
  if (distanceMiles < DISTANCE.MEDIUM) {
    const hasBluebikes = hasBluebikesOrigin && hasBluikesDest
    if (hasBluebikes || bikeInfraQuality !== 'none') {
      return {
        modes: ['bike'],
        label: hasBluebikes ? 'Bluebikes' : 'Bike',
        reasons: buildBikeReasons(distanceMiles, hasBluebikes, bikeInfraQuality),
        secondary: hasMBTARoute ? transitOption() : null,
      }
    }
    if (hasMBTARoute) {
      return transitOption(bikeSecondary(distanceMiles))
    }
  }

  // BIKE + TRANSIT (multimodal)
  if (distanceMiles >= DISTANCE.MEDIUM && hasMBTARoute) {
    if (hasBluebikesOrigin) {
      return {
        modes: ['bike', 'transit'],
        label: buildMultimodalLabel(),
        reasons: buildMultimodalReasons(),
        secondary: transitOnlyOption(),
      }
    }
    return transitOption(null)
  }

  // E-BIKE (long distance, no good transit)
  if (distanceMiles < DISTANCE.LONG && !hasMBTARoute) {
    return {
      modes: ['ebike'],
      label: 'E-bike',
      reasons: [
        `${distanceMiles.toFixed(1)} miles — manageable with an e-bike`,
        'Arrives fresh, no sweat concerns',
        'Bluebikes e-bikes available at many stations',
      ]
    }
  }

  // TRANSIT (long distance)
  return transitOption(null)
}
```

### Reason bullet generation

Reasons are dynamically constructed from real data, not templates.
Each bullet should be a specific, concrete claim:

**Time:**
- "2.8 miles — about 15 minutes by bike, similar to driving in morning traffic"
- "Red Line from Porter to Kendall runs every 5–8 minutes"
- "8 min bike + 14 min Red Line = 22 min door to door"

**Cost:**
- "Free if you already own a bike"
- "Bluebikes day pass $3.50, or included with annual membership ($125/year)"
- "$2.40 per ride, or $90/month for an unlimited LinkPass"

**Infrastructure/safety:**
- "Protected bike lane on Cambridge Street for most of the route"
- "Shared lane — moderate traffic, suitable for most riders"
- (omit if no data — don't fabricate infrastructure claims)

**Bluebikes:**
- "Bluebikes station 0.2 miles from your address — no bike ownership needed"
- "8 bikes currently available at Holland St & Cameron Ave"

**Never generate a reason that isn't backed by actual data.**
If a data source fails or returns no results, omit that reason rather
than falling back to a generic claim.

---

## UI components

### Placement

The recommendation output appears between the form inputs and the
existing savings breakdown. It is hidden until the user submits
the calculator. On submit, the page smooth-scrolls to the
recommendation section and animates it into view.

The existing savings breakdown moves below it — no content is removed.

---

### Component: RecommendationCard

```
┌─────────────────────────────────────────────────────────┐
│  YOUR BEST OPTION                    [Refresh ↻]        │
│                                                          │
│  [Mode icon(s)]  Bike to Davis, then Red Line           │
│                                                          │
│  ✓  22 minutes door to door                             │
│  ✓  $5.90/day — or free with LinkPass + Bluebikes       │
│  ✓  Bluebikes station 0.2 miles from your address       │
│                                                          │
│  [Get directions in Google Maps ↗]                      │
│                                                          │
│  ─────────────────────────────────────────────          │
│  Also consider: Red Line from Porter — 31 minutes       │
└─────────────────────────────────────────────────────────┘
```

- Background: `#242538` (slightly lighter than navy)
- Mode icons: use existing Phosphor icons from the design system
  (`PersonSimpleWalk`, `Bicycle`, `Bus`, `Train`)
- Primary recommendation: Bricolage Grotesque, large
- Reasons: DM Sans, with lime checkmarks
- Secondary option: smaller, muted, single line only
- Refresh button: re-fetches live Bluebikes/MBTA data without
  re-running the full recommendation logic

---

### Component: CommuteMap

Renders after recommendation data is available.
Uses the existing Google Maps embed (already planned for the calculator).

**Layers:**
- Origin marker (lime)
- Destination marker (white)
- Bluebikes stations near origin: green pins with live bike count badge
- Bluebikes stations near dest: green pins with live dock count badge
- MBTA stops: colored by line (Red, Orange, Green, Blue, Silver)
- No routing polylines — pins only

**Below the map:**
Live status row — updates when user clicks Refresh:
```
🟢 8 bikes at Holland St & Cameron Ave (0.2 mi)
🔴 Red Line: Next train in 4 min at Davis Square
```

If MBTA predictions unavailable: "Check the MBTA app for real-time arrivals"
If Bluebikes unavailable: "Check the Bluebikes app for live availability"

---

### Component: BarrierSelector

Appears below the map. Single question, multiple choice.

**Question:** "What's your biggest hesitation?"

**Options — dynamically filtered to recommended mode(s):**

For bike or bike+transit:
```
○  I'm not confident biking in traffic        [barrier_code: 'safety']
○  I don't know the best route                [barrier_code: 'routes']
○  I'm worried about arriving sweaty          [barrier_code: 'logistics']
○  I don't want to deal with weather          [barrier_code: 'weather']
○  I'm not sure it would be faster            [barrier_code: 'time']
○  Nothing — I'm ready to try it             [barrier_code: 'habit']
```

For transit:
```
○  It seems complicated to plan               [barrier_code: 'logistics']
○  I'm not sure it would be faster            [barrier_code: 'time']
○  I don't know which routes to take          [barrier_code: 'routes']
○  Nothing — I'm ready to try it             [barrier_code: 'habit']
```

For walk:
```
○  It takes too long                          [barrier_code: 'time']
○  I need to carry things                     [barrier_code: 'carrying']
○  Nothing — I'm ready to try it             [barrier_code: 'habit']
```

On selection: triggers a content fetch from Supabase and renders
the GettingStarted component below. No page reload.

If user selects "Nothing — I'm ready to try it": skip the guide
and show only the Shift app CTA.

---

### Component: GettingStarted

Two-column layout. Appears after barrier selection.

**Left column: Guide**

Query:
```typescript
const { data: guide } = await supabase
  .from('content_items')
  .select('id, title, summary, body')
  .eq('content_type', 'micro_guide')
  .eq('status', 'approved')
  .eq('primary_mode', primaryMode)
  .eq('primary_barrier', selectedBarrier)
  .contains('surfaces', ['guide_library'])
  .order('created_at', { ascending: false })
  .limit(1)
  .single()
```

If no exact match: fall back to `primary_mode` match only
(ignore barrier). If still no match: hide the guide column.

Display:
```
┌────────────────────────┐
│  READ THIS FIRST        │
│                         │
│  [Guide title]          │
│  [summary — 2 lines]    │
│                         │
│  [Read the guide →]     │
└────────────────────────┘
```

**Right column: Community event or Shift CTA**

Query:
```typescript
// Find nearest upcoming event relevant to recommended mode
const { data: event } = await supabase
  .from('event_details')
  .select(`
    *,
    content_items!inner(
      title, summary, primary_mode, status
    )
  `)
  .eq('content_items.status', 'approved')
  .eq('content_items.primary_mode', primaryMode)
  .gte('event_date', today())
  .order('event_date', { ascending: true })
  .limit(1)
  .single()
```

If event found:
```
┌────────────────────────┐
│  TRY IT WITH OTHERS     │
│                         │
│  [Event title]          │
│  [Date · Location name] │
│  [summary]              │
│                         │
│  [Learn more →]         │
└────────────────────────┘
```

If no event found — show Shift CTA:
```
┌────────────────────────┐
│  START TRACKING         │
│                         │
│  "Download Shift and    │
│  your first commute     │
│  logs itself."          │
│                         │
│  [Join the waitlist →]  │
└────────────────────────┘
```

---

## Address input

The existing calculator already uses address fields ("Where do you live?"
and "Where do you work?") with Google Places Autocomplete, and already
derives distance from those addresses. It also has a manual distance
override field for users who prefer not to enter addresses.

No changes needed to the address input layer. The lat/lng values from
the existing address fields should be passed directly to
`/api/commute/recommend`. Read the existing calculator component to
confirm the exact state variable names before building the API route.

If the user has entered addresses: pass lat/lng to the recommendation
API and show the full output including the map and live data.

If the user has only set a manual distance (no addresses): show a
simplified recommendation card without the map, using estimated rather
than live Bluebikes/MBTA data. Note below the card:
"Enter your home and work addresses above for live transit
and Bluebikes availability."

Do NOT modify the existing address autocomplete implementation.

---

## Content query: trip_distance_range mapping

```typescript
function getDistanceCategory(miles: number): 'short' | 'medium' | 'long' {
  if (miles < 2) return 'short'
  if (miles < 6) return 'medium'
  return 'long'
}

// Include in content_items query:
.eq('trip_distance_range', getDistanceCategory(distanceMiles))
// or: .or(`trip_distance_range.eq.${category},trip_distance_range.is.null`)
// to also return content with no distance restriction
```

---

## Error and fallback states

**MBTA API unavailable:**
Show recommendation without transit time estimates.
"Transit time varies — check the MBTA Trip Planner for real-time info"
with a link to mbta.com/trip-planner.

**Bluebikes GBFS unavailable:**
Show Bluebikes stations on map without live availability.
"Check the Bluebikes app for live bike availability"

**MassDOT proxy unavailable:**
Omit infrastructure reason bullet. Do not show "unknown infrastructure"
to the user — just skip the safety/route quality claim.

**No address entered (manual distance only):**
Show simplified recommendation card:
- Mode recommendation and generic reasons (no live data)
- No map
- Barrier selector and guide still work
- Note: "Enter your commute addresses above for live transit
  and Bluebikes availability"

**Commute outside Massachusetts:**
Most APIs are MA-specific. If destination is outside MA bounding box:
Show a polite message: "Our recommendation engine is optimized for
Massachusetts commutes. For other locations, try Google Maps or
a local transit app."

---

## Implementation notes

**Address input and geocoding:**
Use `@react-google-maps/api` — already planned for the calculator.
Restrict Places Autocomplete to Massachusetts:
```typescript
<Autocomplete
  restrictions={{ country: 'us' }}
  bounds={MA_BOUNDS}  // Massachusetts bounding box
/>
```

**Google Maps URL construction for directions:**
```typescript
function buildGoogleMapsUrl(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  modes: Mode[]
): string {
  const travelMode = modes.includes('transit') ? 'r' :
                     modes.includes('bike') ? 'b' : 'w'
  return `https://www.google.com/maps/dir/?api=1` +
    `&origin=${originLat},${originLng}` +
    `&destination=${destLat},${destLng}` +
    `&travelmode=${travelMode}`
}
```

**Bluebikes distance calculation:**
Use Haversine formula — same as used elsewhere in the project.
Consider stations within 0.4 miles (≈ 8 min walk) as "nearby."

**MBTA route feasibility check:**
Don't attempt full routing — just check if there are MBTA stops
within 0.5 miles of both origin and destination, and if any shared
routes connect them. Use the `/stops` and `/routes` endpoints.
A "feasible transit option exists" check is sufficient — not a
full journey planner.

**No user authentication required:**
The recommendation engine works for anonymous users.
All Supabase queries use the anon key.
`get_eligible_event` RPC requires a user_id — use a simplified
direct query to `event_details` instead (shown above).

**Caching:**
- Bluebikes station info: cache 1 hour (changes rarely)
- Bluebikes station status: cache 60 seconds (live availability)
- MBTA stops: cache 24 hours (changes rarely)
- MBTA predictions: no cache (real-time)
- MassDOT proxy: cache 1 hour

**Performance:**
All API calls in `/api/commute/recommend` should run in parallel
where possible (Promise.all for Bluebikes + MBTA + MassDOT).
Target response time under 2 seconds.

---

## Build sequence

**Phase 1 — Foundation**
1. Read the existing calculator component to identify how lat/lng and
   distance are stored in state — do not modify the existing input layer
2. `/api/massdot-proxy` route — extract logic from `route-initiate/index.ts`
3. `/api/commute/recommend` route — skeleton with distance calculation,
   wired to existing lat/lng state values
4. RecommendationCard component with mock data

**Phase 2 — Live data**
1. Wire Bluebikes GBFS to recommendation route
2. Wire MBTA V3 to recommendation route
3. Wire MassDOT proxy to recommendation route
4. Dynamic reason bullet generation from real data

**Phase 3 — Map and content**
1. CommuteMap component with Google Maps
2. Live status row (Bluebikes availability + MBTA next train)
3. BarrierSelector component
4. GettingStarted component with Supabase content queries

**Phase 4 — Polish**
1. Error and fallback states
2. Refresh button
3. Smooth scroll and animation on recommendation reveal
4. Manual distance fallback (simplified recommendation without map)
5. Test across short / medium / long distance commutes

---

*Cross-references: shift-mbta-integration-spec.md ·
commute-advisor.html (existing) · content_items table ·
event_details table · route_assessments table (MassDOT data)*
