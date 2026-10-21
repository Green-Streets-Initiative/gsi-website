import { NextRequest, NextResponse } from 'next/server'
import { fetchNwsHours } from '@/lib/commute/weather'

/*
 * GET /api/commute/weather?lat=&lng=
 * The National Weather Service hourly forecast near the home end of a plan
 * (product item 17: weather per way in). The advisor page picks the hour
 * each way in leaves (src/lib/commute/weather.ts). The point is rounded to
 * two decimals (about 1 km) before it leaves the browser's request, so the
 * forecast is cached per neighbourhood and no address is ever sent on.
 * Writes nothing, logs nothing.
 */

/** Enough hours to reach the next weekday morning from a Friday evening. */
const HOURS_KEPT = 96

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const lat = Number(p.get('lat'))
  const lng = Number(p.get('lng'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }
  const hours = await fetchNwsHours(Math.round(lat * 100) / 100, Math.round(lng * 100) / 100)
  if (hours.length === 0) return NextResponse.json({ error: 'weather_unavailable', hours: [] }, { status: 502 })
  return NextResponse.json({ hours: hours.slice(0, HOURS_KEPT) }, {
    headers: { 'Cache-Control': 'public, max-age=900, stale-while-revalidate=900' },
  })
}
