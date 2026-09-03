import 'server-only'
import { fetchEventPool, type TownEvent } from '@/lib/towns/queries'

/**
 * Campus event selector for the Shift Your Semester school pages.
 *
 * Reuses the town-page event pool (approved, upcoming 30 days, within 8 miles,
 * weekly series deduped) but ranks it for a student audience instead of the
 * town tiering:
 *   - score: closer beats farther, sooner beats later, and beginner_friendly /
 *     students / family_friendly tags get a boost (beginner sessions first)
 *   - diversity: at most 2 picks per category bucket, so the list mixes rides,
 *     repair/learning sessions, and festivals instead of three of a kind.
 */

const BOOST_TAGS = ['beginner_friendly', 'students', 'family_friendly']

const CATEGORY_BUCKETS: Record<string, string> = {
  guided_ride: 'rides',
  group_ride: 'rides',
  bike_bus: 'rides',
  bike_repair: 'learning',
  class: 'learning',
  bike_rodeo: 'learning',
  talk: 'learning',
  festival: 'festivals',
  open_streets: 'festivals',
}

const PER_BUCKET_CAP = 2

function bucketOf(e: TownEvent): string {
  return (e.event_type && CATEGORY_BUCKETS[e.event_type]) || 'other'
}

function score(e: TownEvent, todayStr: string): number {
  // Distance: 0 miles → 8 points, 8 miles → 0 points.
  const distanceScore = Math.max(0, 8 - e.distance_miles)
  // Recency: today → 6 points, 30 days out → 0.
  const daysOut = Math.max(
    0,
    (new Date(`${e.event_date}T00:00:00`).getTime() - new Date(`${todayStr}T00:00:00`).getTime()) /
      86400000,
  )
  const dateScore = Math.max(0, 6 - daysOut / 5)
  const tagScore = BOOST_TAGS.some((t) => e.tags.includes(t)) ? 5 : 0
  return distanceScore + dateScore + tagScore
}

export async function getCampusEvents(
  centroid: { lat: number; lng: number },
  limit = 6,
): Promise<TownEvent[]> {
  const pool = await fetchEventPool(centroid)
  const todayStr = new Date().toISOString().slice(0, 10)

  const ranked = [...pool].sort((a, b) => score(b, todayStr) - score(a, todayStr))

  // Greedy diversity pass: take in score order, capped per bucket. If the cap
  // leaves the list short (thin week), backfill with the remaining best.
  const picked: TownEvent[] = []
  const bucketCounts = new Map<string, number>()
  for (const e of ranked) {
    if (picked.length >= limit) break
    const bucket = bucketOf(e)
    const count = bucketCounts.get(bucket) ?? 0
    if (count >= PER_BUCKET_CAP) continue
    bucketCounts.set(bucket, count + 1)
    picked.push(e)
  }
  if (picked.length < limit) {
    for (const e of ranked) {
      if (picked.length >= limit) break
      if (!picked.includes(e)) picked.push(e)
    }
  }

  // Present in date order — the panel reads as "what's coming up".
  return picked.sort((a, b) => a.event_date.localeCompare(b.event_date))
}
