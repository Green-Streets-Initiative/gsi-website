# Shift Flagship Event Leaderboard Page — Spec
**URLs: /events/shift-your-summer (canonical) + /shift/leaderboard (redirect)**
**For: Claude Code implementation**
**Version: March 2026**

---

## Overview

A public-facing marketing page that showcases the current or next flagship
Shift event — displaying the live leaderboard, event details, prizes, and
sponsors, with a CTA to join via the app or waitlist.

Primary purpose: marketing and social proof. Show prospective users that
real people are competing, moving, and winning. Make the event feel alive
and worth joining.

Secondary purpose: SEO. "Shift Your Summer Boston," "commuter challenge
leaderboard," and similar queries should eventually land here.

---

## URL structure

`/events/shift-your-summer` — canonical URL for the first flagship event.
`/shift/leaderboard` — permanent redirect (308) to the canonical URL.

Future flagship events follow the same pattern:
`/events/shift-your-fall`, `/events/shift-september`, etc.

Add the redirect to `next.config.ts`:
```typescript
async redirects() {
  return [
    {
      source: '/shift/leaderboard',
      destination: '/events/shift-your-summer',
      permanent: true,
    },
  ]
}
```

---

## Page states

The page has three states depending on the active competition's status.
The state is determined by querying the `competitions` table on load.

### State A — Upcoming (starts_at > now)
Show event details, countdown timer, and waitlist CTA.
Leaderboard section is replaced by a "Be the first on the board" placeholder.

### State B — Active (starts_at <= now <= ends_at)
Full page with live leaderboard, updated on load (no real-time subscription needed —
a page refresh is sufficient for a marketing page).

### State C — No event scheduled / completed
Show a "coming soon" placeholder with waitlist CTA.
Do not show a completed event's final leaderboard — past results are not the point
of this page. If a past event exists and no future event is scheduled, show State C.

---

## Data fetching

### Finding the current event

```typescript
// Fetch the most relevant flagship competition
const { data: competition } = await supabase
  .from('competitions')
  .select(`
    id, name, description, metric, starts_at, ends_at,
    is_public, sponsor_name, sponsor_logo_url, prizes_json,
    event_sponsorships (
      id, tier,
      sponsors (
        id, name, logo_url, website_url
      )
    )
  `)
  .eq('is_public', true)
  .is('group_id', null)           // flagship events only (no group scope)
  .gte('ends_at', new Date().toISOString())  // not yet ended
  .order('starts_at', { ascending: true })
  .limit(1)
  .single()

// If no result → render State C (coming soon)
// If competition.starts_at > now → render State A (upcoming)
// If starts_at <= now <= ends_at → render State B (active)
```

### Fetching leaderboard (State B only)

```typescript
// Call the existing RPC
const { data: standings } = await supabase
  .rpc('get_competition_standings', {
    p_competition_id: competition.id
  })
```

Expected shape from the RPC (verify with Code against actual return):
```typescript
interface StandingEntry {
  rank: number
  user_id: string
  display_name: string        // anonymized if needed — check RPC
  shift_rate: number          // percentage, 0-100
  active_trips: number
  tier: string                // 'Starter' | 'Mover' | 'Shifter' | 'Leader' | 'Trailblazer'
}
```

Show top 25 entries. If fewer than 10 entries exist, show all entries plus
filler rows to suggest the board is just getting started — not an empty state.

### Fetching prizes

```typescript
const { data: prizes } = await supabase
  .from('competition_prizes')
  .select('place, prize_type, description, approximate_value')
  .eq('competition_id', competition.id)
  .eq('prize_type', 'individual')
  .order('place', { ascending: true })
```

---

## Page sections (State B — active event, full page)

### 1. Event hero

Background: dark navy with a lime/gold gradient glow treatment.
Full-width, generous vertical padding.

Left column:
- Eyebrow: "FLAGSHIP EVENT · [YEAR]" in lime, tracked out
- Headline: competition.name (e.g. "Shift Your Summer")
- Subhead: competition.description
- Dates: "June 1 – August 31, 2026" formatted from starts_at / ends_at
- Metric badge: show what the competition measures.
  Map competition.metric to human-readable:
  - `pct_non_car` → "Ranked by Shift Rate"
  - `trips` → "Ranked by active trips"
  - `miles` → "Ranked by miles shifted"
  - `active_days` → "Ranked by active days"
- CTA: "Join the challenge →" (see CTA logic below)

Right column:
- Live participant count: "X people competing"
  ```typescript
  const { count } = await supabase
    .from('competition_participants')
    .select('*', { count: 'exact', head: true })
    .eq('competition_id', competition.id)
  ```
- Top stat from leaderboard: "#1 this week: [display_name] · [shift_rate]% Shift Rate"
  (Use standings[0] from the RPC result)
- If event_sponsorships exist: "Presented by [sponsor logo]"

### 2. Live leaderboard

Section headline: "Live standings"
Update note: "Updated when you load this page."

Leaderboard table — clean, dark card, full width:

```
Rank  |  Name           |  Tier icon  |  Shift Rate  |  Active trips
------+-----------------+-------------+--------------+---------------
  1   |  Maya K.        |  [Shifter]  |    82%       |     47
  2   |  You            |  [Mover]    |    74%       |     31
  3   |  James R.       |  [Mover]    |    71%       |     28
  ...
```

Columns:
- **Rank** — integer, right-aligned, gold color for 1-3
- **Name** — display_name from RPC. If the RPC returns anonymized names
  (e.g., "Maya K."), use as-is. If it returns full names, truncate to
  first name + last initial client-side.
- **Tier icon** — render the appropriate tier SVG icon at 20dp using the
  canonical paths from shift-icon-kit-v2.html. Map tier string to icon.
- **Shift Rate** — percentage, colored by value:
  - 0–40%: white/60 opacity
  - 40–60%: blue (#2966E5)
  - 60–80%: lime (#BAF14D)
  - 80%+: gold (#EDB93C)
- **Active trips** — integer, right-aligned, white/60 opacity

Top 3 rows get a subtle highlight: gold/10, silver/10, bronze/10 left border
or background tint. Keep it subtle — this is a marketing leaderboard, not a
gaming UI.

If fewer than 10 entries: show all entries, then add 3-5 placeholder rows
at the bottom with "—" in all fields and a note below:
"The board is just getting started. Be one of the first."

Refresh button below the table: "Refresh standings" — triggers a client-side
re-fetch without a full page reload.

### 3. Prizes

Only render this section if competition_prizes returns results.

Section headline: "What's at stake"

Display prizes in order of place. For each prize:
- Place badge: "1st place", "2nd place", etc. — gold/silver/bronze treatment
- Prize description: competition_prizes.description
- Approximate value: "~$[approximate_value]" if value_amount or approximate_value exists

Layout: horizontal card row on desktop, stacked on mobile.

### 4. Sponsors

Only render if event_sponsorships returns results.

Section headline: "Presented by"
Display: sponsor logo grid (same pattern as rewards partners page).
Link each logo to sponsors.website_url if it exists.

If no event_sponsorships: skip this section entirely.

### 5. How to join

Three-step explainer, icon + text:

1. **Download Shift** — Available on iOS and Android.
   Join the challenge from the Events tab.
2. **Take active trips** — Walk, bike, or ride transit.
   Shift detects your trips automatically.
3. **Climb the board** — Your Shift Rate updates in real time.
   Top finishers win prizes.

### 6. CTA section

Full-width, dark card.
Headline: "Ready to compete?"

**CTA logic — two states:**

*Pre-launch (app not yet available):*
Subhead: "Shift launches this summer. Join the waitlist and we'll notify you
the moment the challenge goes live."
Show: email waitlist form (same pattern as homepage hero)

*Post-launch (app available):*
Subhead: "Download Shift, join the challenge, and start earning your spot
on the board."
Show: App Store + Google Play download buttons

**Implementation:** Control which state renders via an environment variable:
`NEXT_PUBLIC_APP_LAUNCHED=false` (flip to `true` at launch).
This avoids a code deploy just to change the CTA.

---

## Page sections (State A — upcoming event)

Same hero section, but:
- Replace participant count with a countdown timer component:
  ```
  Starts in: 14 days  |  6 hours  |  22 min
  ```
  Built as a client component with useEffect updating every second.
- Replace leaderboard section with:
  Headline: "Be the first on the board"
  Subhead: "The challenge hasn't started yet. Download Shift and be ready
  to compete from day one."
  Show the CTA section immediately below.
- Keep prizes and sponsors sections if data exists.
- Keep "How to join" section.

---

## Page sections (State C — no event scheduled)

Minimal page. No leaderboard, no prizes.

Hero:
- Headline: "The next challenge is coming."
- Subhead: "Shift flagship events bring Greater Boston commuters together
  to compete, move, and win real prizes. Join the waitlist to be first
  to know when the next event launches."
- CTA: waitlist email form

Below hero:
- One section explaining what flagship events are — 2-3 sentences.
- Link to /shift for more about the app.

---

## Navigation and linking

**Add to /shift hub page:**
Add a "Flagship events" card or section between the employer and school
sections (or after them). Short version:
- Eyebrow: "EVENTS"
- Headline: "Compete. Move. Win."
- Body: "Shift flagship events bring the whole city together. Track your
  commute, climb the leaderboard, and win real prizes."
- CTA: "See the leaderboard →" linking to /events/shift-your-summer

**Add to footer:**
Add "Shift Your Summer" under the Shift column in the footer,
pointing to /events/shift-your-summer.

**Do NOT add to primary nav** — this is a supporting page, not a primary
destination. The /shift hub is the nav entry point.

---

## Design notes

- Match the homepage and /shift hub visual language throughout.
- The leaderboard table should feel data-dense but readable — not a wall of text.
  Use generous row padding (py-3), a subtle divider between rows (border-white/5),
  and alternating row backgrounds (transparent / white/[0.02]) for scannability.
- Rank 1-3 should feel special but not garish. A left border in gold/silver/bronze
  works better than background colors for the overall dark aesthetic.
- The countdown timer (State A) should feel energetic — large numbers, Bricolage
  Grotesque display font, lime color for the numbers.
- Mobile: the leaderboard table should scroll horizontally if needed, or collapse
  to a simpler format (rank + name + primary metric only) on small screens.

---

## Implementation notes

**No real-time subscription needed.**
This is a marketing page, not an in-app leaderboard. Refresh on load is sufficient.
Do not implement Supabase real-time subscriptions here — keep it simple.

**RLS consideration.**
The leaderboard RPC must be callable without authentication (public read).
Verify that `get_competition_standings` is accessible to the `anon` role,
or that the page uses the service role key server-side via a Next.js API route.
If the RPC requires auth, build a thin API route at `/api/leaderboard` that
calls it server-side and returns the data — never expose the service role key
client-side.

**Supabase server component.**
Fetch competition data and standings in a Next.js server component where possible.
Only the countdown timer and refresh button need to be client components.

**Environment variable for app launch state:**
```
NEXT_PUBLIC_APP_LAUNCHED=false
```
Add to Vercel environment variables. Flip to `true` at app launch.
No code change required.

**Mock data for development.**
If the competitions table has no flagship events yet, seed a mock competition
for development:
```sql
INSERT INTO competitions (
  name, description, metric, starts_at, ends_at,
  is_public, event_type
) VALUES (
  'Shift Your Summer',
  'Three months. Every trip counts. Compete with commuters across Greater Boston.',
  'pct_non_car',
  '2026-06-01T00:00:00Z',
  '2026-08-31T23:59:59Z',
  true,
  'flagship'
);
```
Note: verify that `event_type = 'flagship'` is the correct value for this
column, or adjust based on actual enum/check constraint.

---

*Cross-references: shift-engagement-consolidated-spec.md · shift-badge-spec.md*
*Supabase RPCs: get_competition_standings(p_competition_id)*
