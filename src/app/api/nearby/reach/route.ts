import { NextRequest, NextResponse } from 'next/server'
import { getReach } from '@/lib/server/reach'

/**
 * Thin HTTP wrapper over the shared reach lib (see src/lib/server/reach.ts
 * — also consumed directly by the /nearby/print server component) so both
 * surfaces hit one cross-visitor cache instead of a route HTTP-calling its
 * own origin.
 */

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = parseFloat(searchParams.get('lat') || '')
  const lng = parseFloat(searchParams.get('lng') || '')
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 40 || lat > 44 || lng < -75 || lng > -69) {
    return NextResponse.json({ error: 'valid lat and lng required' }, { status: 400 })
  }

  const data = await getReach(lat, lng)
  return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=86400' } })
}
