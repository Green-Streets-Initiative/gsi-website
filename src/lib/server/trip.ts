import 'server-only'

import { unstable_cache } from 'next/cache'
import {
  buildReachRow,
  laneIndexFor,
  haversineMiles,
  nextMonday830,
  REACH_ROW_VERSION,
  type ReachRow,
} from './reach'

/**
 * "Where do you want to go?" — one destination the visitor picked, answered
 * by exactly the pipeline that answers the curated ones.
 *
 * The Destinations tab used to lead with a hand-off to the Commute Advisor,
 * which is a three-step economic wizard (vehicle MPG, gas price, parking
 * mode, days driven) built for a RECURRING commute. Asking that of someone
 * who wants to get to the library on Saturday is the wrong question, and in
 * the app it was worse — the only destination picker read saved locations,
 * so an arbitrary destination was unreachable.
 *
 * This is not a Google Maps replacement and shouldn't grow into one: no
 * turn-by-turn, no live re-routing, no POI database. It answers "can I do
 * this without a car, and what will it feel like" with the data that IS
 * ours — bike comfort tiers, shared use paths, the line chain with its
 * transfers named — then hands off to a maps app for the actual navigation,
 * which is what every reach row already does.
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 500

/** Same window the rest of /nearby validates against (New England-ish). */
export function inServiceArea(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= 40 && lat <= 44 && lng >= -75 && lng <= -69
}

const cache = new Map<string, { row: ReachRow; expires: number }>()

/**
 * Deliberately NOT gated by the web's 40-mile Boston cutoff — the planner
 * works statewide, the same call the app's Around You made.
 */
export async function getTrip(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  name: string,
): Promise<ReachRow> {
  // Round to ~110 m so a neighborhood's first visitor pays for everyone,
  // matching the reach cache's convention.
  const f = { lat: round3(from.lat), lng: round3(from.lng) }
  const t = { lat: round3(to.lat), lng: round3(to.lng) }
  // Versioned with the row shape — see REACH_ROW_VERSION. Unversioned,
  // this cache kept serving pre-fix rows after the classifier changed.
  const key = `${REACH_ROW_VERSION}:${f.lat},${f.lng}|${t.lat},${t.lng}`

  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) return { ...cached.row, name }

  const row = await durableTrip(f, t)

  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(key, { row, expires: Date.now() + CACHE_TTL_MS })
  // The place NAME is the visitor's own text; it never enters the cache key
  // or the cached row, so one person's search can't relabel another's.
  return { ...row, name }
}

const durableTrip = unstable_cache(computeTrip, [`nearby-trip-${REACH_ROW_VERSION}`], {
  revalidate: CACHE_TTL_MS / 1000,
})

async function computeTrip(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<ReachRow> {
  const laneIndex = await laneIndexFor(from.lat, from.lng)
  return buildReachRow(
    from,
    {
      // The id is positional, not the visitor's text — it keys the map
      // overlay and the row selection, so it must be stable and PII-free.
      id: `trip:${to.lat},${to.lng}`,
      name: '',
      lat: to.lat,
      lng: to.lng,
      distance_miles: haversineMiles(from.lat, from.lng, to.lat, to.lng),
    },
    laneIndex,
    nextMonday830(),
  )
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
