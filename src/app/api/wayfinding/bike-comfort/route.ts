import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const originLat = parseFloat(searchParams.get('origin_lat') || '')
  const originLng = parseFloat(searchParams.get('origin_lng') || '')
  const destLat = parseFloat(searchParams.get('dest_lat') || '')
  const destLng = parseFloat(searchParams.get('dest_lng') || '')

  if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
    return NextResponse.json({ error: 'origin_lat, origin_lng, dest_lat, dest_lng required' }, { status: 400 })
  }

  const edgeFnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/commute-advisor-compare`
  const res = await fetch(edgeFnUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      origin: { lat: originLat, lng: originLng },
      destination: { lat: destLat, lng: destLng },
    }),
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'comfort_unavailable' }, { status: 502 })
  }

  const edge = await res.json()

  return NextResponse.json({
    rating: edge.bike_comfort_rating ?? null,
    segments: edge.bike_comfort_segments ?? null,
    summary: edge.bike_comfort_summary ?? null,
  }, {
    headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=60' },
  })
}
