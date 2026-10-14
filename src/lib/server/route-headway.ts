import 'server-only'

import { unstable_cache } from 'next/cache'
import { peakHeadway } from '@/lib/nearby/transit-choice'

/**
 * Weekday morning headway for one MBTA route, from the route's first-stop
 * departures 7–10 AM on the service date a Nearby row is planned for. Used to
 * break near-ties between Google's transit alternatives (lib/nearby/transit-choice).
 *
 * Schedules change a few times a year, so a week is plenty; the date is part
 * of the key, which rolls it over with the planned Monday anyway. MBTA errors
 * throw inside the durable layer (never cached) and read as "unknown" here.
 */

const MBTA_BASE = 'https://api-v3.mbta.com'
const MBTA_API_KEY = (process.env.MBTA_API_KEY || '').trim()
const TTL_MS = 7 * 24 * 60 * 60 * 1000
const CACHE_MAX = 500

const memo = new Map<string, { headway: number | null; expires: number }>()

async function computeHeadway(routeId: string, date: string): Promise<number | null> {
  const params = new URLSearchParams({
    'filter[route]': routeId,
    'filter[date]': date,
    'filter[stop_sequence]': 'first',
    'filter[min_time]': '07:00',
    'filter[max_time]': '10:00',
    'fields[schedule]': 'departure_time,direction_id',
    'page[limit]': '300',
  })
  if (MBTA_API_KEY) params.set('api_key', MBTA_API_KEY)
  const res = await fetch(`${MBTA_BASE}/schedules?${params}`, { signal: AbortSignal.timeout(6000) })
  const data = await res.json()
  if (!res.ok || data.errors) throw new Error(`schedules ${res.status}`)
  const rows = ((data.data ?? []) as { attributes?: { departure_time?: string | null; direction_id?: number } }[])
    .flatMap((r) => {
      const t = r.attributes?.departure_time
      const dir = r.attributes?.direction_id
      if (!t || dir === undefined) return []
      // "2026-10-19T07:16:00-04:00": the wall-clock time is in the string.
      const [h, m] = t.slice(11, 16).split(':').map(Number)
      return [{ minuteOfDay: h * 60 + m, direction: dir }]
    })
  return peakHeadway(rows)
}

const durableHeadway = unstable_cache(computeHeadway, ['nearby-route-headway-v1'], {
  revalidate: TTL_MS / 1000,
})

/** Morning headway in minutes, or null when unknown (no schedule, MBTA error). */
export async function getPeakHeadway(routeId: string, departureIso: string): Promise<number | null> {
  // The planned departure's date in Eastern time (the Monday a row answers).
  const date = new Date(departureIso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const key = `${routeId}|${date}`
  const hit = memo.get(key)
  if (hit && hit.expires > Date.now()) return hit.headway
  let headway: number | null
  try {
    headway = await durableHeadway(routeId, date)
  } catch {
    return null
  }
  if (memo.size >= CACHE_MAX) {
    const oldest = memo.keys().next().value
    if (oldest !== undefined) memo.delete(oldest)
  }
  memo.set(key, { headway, expires: Date.now() + TTL_MS })
  return headway
}
