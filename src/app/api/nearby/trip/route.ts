import { NextRequest, NextResponse } from 'next/server'
import { getTrip, inServiceArea } from '@/lib/server/trip'
import { getBikeShareDocks } from '@/lib/server/bluebikes'

/**
 * One planned trip: /api/nearby/trip?from=lat,lng&to=lat,lng&name=…
 *
 * Thin wrapper over the shared trip lib (src/lib/server/trip.ts) so both
 * surfaces hit one cross-visitor cache — the Shift app consumes this, it
 * doesn't re-implement it.
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
  const [trip, destDocks] = await Promise.all([
    getTrip(from, to, name),
    getBikeShareDocks(to.lat, to.lng, DEST_DOCK_RADIUS_METERS).catch(() => []),
  ])
  const row = trip ? { ...trip, dest_docks: destDocks.slice(0, 2) } : trip
  // Private: the destination is one person's search, not a shared page.
  // The upstream Google calls are still cached cross-visitor by getTrip.
  return NextResponse.json({ row }, { headers: { 'Cache-Control': 'private, no-store' } })
}
