import { NextRequest, NextResponse } from 'next/server'
import { getTrip, getWalk, getDrive, inServiceArea, leavingNow } from '@/lib/server/trip'
import { getBikeShareDocks } from '@/lib/server/bluebikes'
import { nextMonday830 } from '@/lib/server/reach'

/**
 * One planned trip: /api/nearby/trip?from=lat,lng&to=lat,lng&name=…
 *
 * Thin wrapper over the shared trip lib (src/lib/server/trip.ts) so both
 * surfaces hit one cross-visitor cache — the Shift app consumes this, it
 * doesn't re-implement it.
 *
 * Plan a trip (/trip, Keith 2026-11-12) adds two params:
 *   &depart=now  transit for leaving this quarter hour, not next Monday 8:30
 *   &ways=all    also a real walking route and the drive time (a reference
 *                row), so the answer compares every way to make the trip
 * Without them the answer is unchanged, which the Shift app relies on.
 */

export const maxDuration = 30

/** Docks this close to the destination are worth ending a bike ride at. */
const DEST_DOCK_RADIUS_METERS = 400

function parsePoint(raw: string | null): { lat: number; lng: number } | null {
  if (!raw) return null
  const [a, b] = raw.split(',')
  const lat = parseFloat(a)
  const lng = parseFloat(b)
  return inServiceArea(lat, lng) ? { lat, lng } : null
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const from = parsePoint(searchParams.get('from'))
  const to = parsePoint(searchParams.get('to'))
  if (!from || !to) {
    return NextResponse.json({ error: 'from and to required as lat,lng in the service area' }, { status: 400 })
  }
  // The visitor's own words for the place. Trimmed hard: it's echoed back
  // into the page as the row title and never goes near the cache key.
  const name = (searchParams.get('name') || 'Your destination').slice(0, 80)

  // The bike-share docks at the far end ride along live, never inside
  // getTrip's day-long cache: the map lights the nearest one on a bike route,
  // and its card has bikes and open docks right now.
  const departAt = searchParams.get('depart') === 'now' ? leavingNow() : undefined
  const allWays = searchParams.get('ways') === 'all'
  const [trip, destDocks, walk, drive] = await Promise.all([
    getTrip(from, to, name, departAt),
    getBikeShareDocks(to.lat, to.lng, DEST_DOCK_RADIUS_METERS).catch(() => []),
    allWays ? getWalk(from, to) : Promise.resolve(null),
    allWays ? getDrive(from, to, departAt ?? nextMonday830()) : Promise.resolve(null),
  ])
  const row = trip
    ? {
        ...trip,
        dest_docks: destDocks.slice(0, 2),
        ...(allWays ? { walk, drive, depart_at: departAt ?? null } : {}),
      }
    : trip
  // Private: the destination is one person's search, not a shared page.
  // The upstream Google calls are still cached cross-visitor by getTrip.
  return NextResponse.json({ row }, { headers: { 'Cache-Control': 'private, no-store' } })
}
