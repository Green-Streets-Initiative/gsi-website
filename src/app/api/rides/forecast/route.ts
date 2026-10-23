import { NextResponse, type NextRequest } from 'next/server'
import { fetchNwsHours } from '@/lib/commute/weather'
import { forecastLine, rideForecast } from '@/lib/rides/forecast'

/**
 * GET ?lat&lng&date=YYYY-MM-DD&start=HH:MM — the forecast line for a ride
 * date, for the public ride page and the organizer console. Public data
 * only; the NWS fetch is cached per point (lib/commute/weather.ts).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const lat = parseFloat(q.get('lat') ?? '')
  const lng = parseFloat(q.get('lng') ?? '')
  const date = q.get('date') ?? ''
  const hour = parseInt((q.get('start') ?? '').slice(0, 2), 10)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 40 || lat > 44 || lng < -75 || lng > -69
    || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(hour)) {
    return NextResponse.json({ forecast: null }, { status: 400 })
  }
  const hours = await fetchNwsHours(Math.round(lat * 1000) / 1000, Math.round(lng * 1000) / 1000).catch(() => [])
  const f = rideForecast(hours.map((h) => ({ startTime: h.start, shortForecast: h.condition, pop: h.precipPct, tempF: h.tempF })), date, hour)
  return NextResponse.json({ forecast: f, line: f ? forecastLine(f) : null }, {
    headers: { 'Cache-Control': 'public, max-age=900, s-maxage=1800' },
  })
}
