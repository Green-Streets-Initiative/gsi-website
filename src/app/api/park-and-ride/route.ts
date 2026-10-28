import { NextRequest, NextResponse } from 'next/server'
import { inServiceArea } from '@/lib/server/trip'
import { parkAndRideNear } from '@/lib/server/park-and-ride'

/** MBTA station parking near a point: /api/park-and-ride?lat=..&lng=.. (lib/server/park-and-ride.ts). */

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get('lat') ?? '')
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') ?? '')
  if (!inServiceArea(lat, lng)) {
    return NextResponse.json({ error: 'lat and lng required in the service area' }, { status: 400 })
  }
  const near = await parkAndRideNear(lat, lng)
  if (!near) return NextResponse.json({ error: 'mbta_unavailable' }, { status: 502 })
  // Private: the point is one visitor's starting place.
  return NextResponse.json({ lots: near }, { headers: { 'Cache-Control': 'private, no-store' } })
}
