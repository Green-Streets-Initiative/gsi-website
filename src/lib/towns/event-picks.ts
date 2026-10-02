import 'server-only'
import { fetchEventPool, type TownEvent } from '@/lib/towns/queries'
import { rideStyle } from '@/lib/ride-style'

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
  opts: { recRidesAsFill?: boolean } = {},
): Promise<TownEvent[]> {
  if (!centroid) return []
  const pool = await fetchEventPool(centroid)
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const near = (e: TownEvent) => (e.distance_miles <= NEAR_MILES ? 0 : 1)
  const byRank = (a: TownEvent, b: TownEvent) =>
    near(a) - near(b) || score(b, todayStr) - score(a, todayStr)
  const eligible = pool.filter((e) => !EXCLUDED_TYPES.has(e.event_type ?? ''))
  const ranked = eligible.filter((e) => styleOf(e) !== 'rec').sort(byRank)
  const recRides = eligible.filter((e) => styleOf(e) === 'rec').sort(byRank)

  // 1. The best of each kind (meetings, talks and uncategorized events don't
  //    get a reserved slot).
  // 2. Fill up to a per-kind cap, so no kind takes most of the list: one each
  //    at three slots, two at four, three at eight. Meetings, talks and
  //    uncategorized events wait for pass 3: they're the least open-door kind.
  // 3. A thin week backfills with the next best regardless of kind (then Rec
  //    rides, on town pages).
  // Never a second Open Streets, in any pass.
  const picked: TownEvent[] = []
  const perKind = new Map<string, number>()
  const cap = Math.max(1, Math.ceil(limit / 3))
  const hasOpenStreets = () => picked.some((p) => p.event_type === 'open_streets')
  const fill = (from: TownEvent[], admit: (e: TownEvent, count: number) => boolean) => {
    for (const e of from) {
      if (picked.length >= limit) return
      if (picked.includes(e)) continue
      if (e.event_type === 'open_streets' && hasOpenStreets()) continue
      const bucket = bucketOf(e)
      const count = perKind.get(bucket) ?? 0
      if (!admit(e, count)) continue
      perKind.set(bucket, count + 1)
      picked.push(e)
    }
  }
  fill(ranked, (e, count) => bucketOf(e) !== 'other' && count === 0)
  fill(ranked, (e, count) => bucketOf(e) !== 'other' && count < cap)
  fill(ranked, () => true)
  if (opts.recRidesAsFill) fill(recRides, () => true)

  // Present in date order: the list reads as "what's coming up".
  return picked.sort((a, b) => a.event_date.localeCompare(b.event_date))
}
