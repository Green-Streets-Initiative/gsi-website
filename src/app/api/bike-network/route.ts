import { NextRequest, NextResponse } from 'next/server'
import { getBikeNetwork } from '@/lib/server/bike-network'

/**
 * Thin HTTP wrapper over the shared bike-network lib (see
 * src/lib/server/bike-network.ts — also consumed directly by
 * /api/nearby/reach for corridor matching).
 */
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = parseFloat(searchParams.get('lat') || '')
  const lng = parseFloat(searchParams.get('lng') || '')
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 40 || lat > 44 || lng < -75 || lng > -69) {
    return NextResponse.json({ error: 'valid lat and lng required' }, { status: 400 })
  }
  const radius = Math.min(3, Math.max(0.25, parseFloat(searchParams.get('radius') || '') || 1.5))

  const data = await getBikeNetwork(lat, lng, radius)
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' },
  })
}
