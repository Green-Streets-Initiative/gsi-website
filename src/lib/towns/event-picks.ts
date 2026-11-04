import 'server-only'
import { fetchEventPool, type TownEvent } from '@/lib/towns/queries'
import { rideStyle } from '@/lib/ride-style'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * The community events a town page (eight), the town digest email (three) and
 * the /nearby snapshot (four) feature.
 *
 * These surfaces used to take the top N of a town ranking whose first tier was
 * every Open Streets within ~3.5 miles. Cut to three, it was three Open
 * Streets days: Somerville's 2026-10-02 digest led with Memorial Drive, Open
 * Streets Allston/Brighton and Open Newbury, while the Annual Bow Tie Ride
 * (1.7 mi, free, family-friendly) and the Fall Cargo Bike Test Drive (2.1 mi,
 * beginner-friendly) went unmentioned, and missed the Somerville town page
 * too, which led with the same three Open Streets (Keith 2026-10-02).
 *
 * The list should be a mix of things someone new can show up to:
 *   - one pick per kind first (an outing, something to try, a street festival),
 *     then a per-kind cap, so the list is never mostly one kind. Open Streets
 *     is capped at one even when the list backfills.
 *   - within each kind: closer, sooner, and welcoming (beginner- or
 *     family-friendly, or an easy ride) wins. Paid events step back.
 *   - Rec rides (road, gravel, 20+ miles) stay out: the full calendar has
 *     them, and these picks are for people getting started.
 *   - contests and challenges are things you enter, not places you go.
 *   - inside the town line comes first (Keith 2026-11-02: "picking as many
 *     close to the town as possible"). Somerville's Nov 2 digest had one
 *     Somerville event and two from Boston and Cambridge, because each kind's
 *     reserved slot was filled from anywhere within 8 miles; the Elm-Beacon
 *     Connector Mini-Ride (1.3 mi, in Somerville) lost to a flat-fixing class
 *     at BU. In-town events now fill first, up to one more of a kind than the
 *     cap; the nearest variety fills what's left. Backtest that day across
 *     the 8 digest towns: 5 → 9 in-town picks of 24, no town worse off.
 *   - one pick per organizer before the backfill, so a weekly club's three
 *     differently-named rides don't take the whole list.
 */

const BUCKETS: Record<string, string> = {
  group_ride: 'outing',
  guided_ride: 'outing',
  bike_bus: 'outing',
  walking_tour: 'outing',
  transit_buddy: 'outing',
  class: 'try',
  ebike_demo: 'try',
  cargo_bike_demo: 'try',
  bike_repair: 'try',
  bike_rodeo: 'try',
  open_streets: 'festival',
  festival: 'festival',
}

const EXCLUDED_TYPES = new Set(['contest', 'challenge'])

/** Anything this close outranks anything farther; score decides within each group. */
const NEAR_MILES = 3

type Rings = number[][][]

/** Even-odd test over every ring, so islands and holes both come out right. Rings are [lng, lat]. */
function inRings(lng: number, lat: number, rings: Rings): boolean {
  let inside = false
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i]
      const [xj, yj] = r[j]
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
    }
  }
  return inside
}

/** The town's outline (Shift town_boundaries, Massachusetts only); null when unknown. */
async function townRings(town: { name: string; state: string }): Promise<Rings | null> {
  const { data } = await createServerSupabaseClient()
    .from('town_boundaries')
    .select('rings')
    .eq('name', town.name)
    .eq('state', town.state)
    .limit(1)
    .maybeSingle()
  return Array.isArray(data?.rings) ? (data.rings as Rings) : null
}

function bucketOf(e: TownEvent): string {
  return (e.event_type && BUCKETS[e.event_type]) || 'other'
}

function styleOf(e: TownEvent) {
  return rideStyle({
    title: e.title,
    description: e.summary,
    distanceText: e.distance_text,
    tags: e.tags,
    pace: e.pace,
    eventType: e.event_type,
  })
}

function isWelcoming(e: TownEvent): boolean {
  return e.tags.includes('beginner_friendly') || e.tags.includes('family_friendly') || styleOf(e) === 'easy'
}

function score(e: TownEvent, todayStr: string): number {
  // Distance: 0 miles → 8 points, 8 miles → 0.
  const distanceScore = Math.max(0, 8 - e.distance_miles)
  // Date: today → 6 points, 30 days out → 0.
  const daysOut = Math.max(
    0,
    (new Date(`${e.event_date}T00:00:00`).getTime() - new Date(`${todayStr}T00:00:00`).getTime()) /
      86400000,
  )
  const dateScore = Math.max(0, 6 - daysOut / 5)
  let s = distanceScore + dateScore
  if (isWelcoming(e)) s += 5
  if (e.tags.includes('free')) s += 1
  if (e.tags.includes('paid')) s -= 4
  // Open Streets carry no tags, but they are the most open-door event there
  // is; without this the one festival slot goes to whatever is tagged.
  if (e.event_type === 'open_streets') s += 3
  return s
}

export async function getEventPicks(
  centroid: { lat: number; lng: number } | null,
  limit = 3,
  /**
   * Town pages only: when the area has too few other events to fill the list,
   * fill it with Rec rides rather than leave it short (Framingham's pool on
   * 2026-10-02 was three events, two of them Rec rides). The email and
   * /nearby leave them out regardless.
   */
  opts: {
    recRidesAsFill?: boolean
    /** Town pages and the digest: events inside this town's line come first. */
    town?: { name: string; state: string }
  } = {},
): Promise<TownEvent[]> {
  if (!centroid) return []
  const [pool, rings] = await Promise.all([
    fetchEventPool(centroid),
    opts.town ? townRings(opts.town).catch(() => null) : Promise.resolve(null),
  ])
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const inTown = (e: TownEvent) => !!rings && inRings(e.lng, e.lat, rings)
  const near = (e: TownEvent) => (inTown(e) ? 0 : e.distance_miles <= NEAR_MILES ? 1 : 2)
  const byRank = (a: TownEvent, b: TownEvent) =>
    near(a) - near(b) || score(b, todayStr) - score(a, todayStr)
  const eligible = pool.filter((e) => !EXCLUDED_TYPES.has(e.event_type ?? ''))
  const ranked = eligible.filter((e) => styleOf(e) !== 'rec').sort(byRank)
  const recRides = eligible.filter((e) => styleOf(e) === 'rec').sort(byRank)

  // 1. Inside the town line: the best of each kind, then up to one more of a
  //    kind than the cap.
  // 2. Everywhere (in town, then within NEAR_MILES, then farther): the best
  //    of each kind (meetings, talks and uncategorized events don't get a
  //    reserved slot), then up to a per-kind cap, so no kind takes most of
  //    the list: one each at three slots, two at four, three at eight.
  //    Meetings, talks and uncategorized events wait for pass 3: they're the
  //    least open-door kind. Passes 1 and 2 take one event per organizer.
  // 3. A thin week backfills with the next best regardless of kind (then Rec
  //    rides, on town pages).
  // Never a second Open Streets, in any pass.
  const picked: TownEvent[] = []
  const perKind = new Map<string, number>()
  const cap = Math.max(1, Math.ceil(limit / 3))
  const hasOpenStreets = () => picked.some((p) => p.event_type === 'open_streets')
  const organizerPicked = (e: TownEvent) =>
    !!e.organizer_name && picked.some((p) => p.organizer_name === e.organizer_name)
  const fill = (
    from: TownEvent[],
    admit: (e: TownEvent, count: number) => boolean,
    onePerOrganizer = false,
  ) => {
    for (const e of from) {
      if (picked.length >= limit) return
      if (picked.includes(e)) continue
      if (e.event_type === 'open_streets' && hasOpenStreets()) continue
      if (onePerOrganizer && organizerPicked(e)) continue
      const bucket = bucketOf(e)
      const count = perKind.get(bucket) ?? 0
      if (!admit(e, count)) continue
      perKind.set(bucket, count + 1)
      picked.push(e)
    }
  }
  const local = ranked.filter(inTown)
  fill(local, (e, count) => bucketOf(e) !== 'other' && count === 0, true)
  fill(local, (e, count) => bucketOf(e) !== 'other' && count < cap + 1, true)
  fill(ranked, (e, count) => bucketOf(e) !== 'other' && count === 0, true)
  fill(ranked, (e, count) => bucketOf(e) !== 'other' && count < cap, true)
  fill(ranked, () => true)
  if (opts.recRidesAsFill) fill(recRides, () => true)

  // Present in date order: the list reads as "what's coming up".
  return picked.sort((a, b) => a.event_date.localeCompare(b.event_date))
}
