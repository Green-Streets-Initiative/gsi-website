import { NextResponse, type NextRequest } from 'next/server'
import { fetchNwsHours } from '@/lib/commute/weather'
import { forecastLine, rideForecast } from '@/lib/rides/forecast'

/**
 * GET ?lat&lng&date=YYYY-MM-DD&start=HH:MM — the forecast line for a ride
 * date, for the public ride page and the organizer console. Public data
 * only; the NWS fetch is cached per point (lib/commute/weather.ts).
 * With ?dates=YYYY-MM-DD,... instead of ?date, one small sky word and
 * temperature per date, for the ride page's date chips.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const lat = parseFloat(q.get('lat') ?? '')
  const lng = parseFloat(q.get('lng') ?? '')
  const hour = parseInt((q.get('start') ?? '').slice(0, 2), 10)
  const many = (q.get('dates') ?? '').split(',').filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 8)
  if (many.length > 0 && Number.isFinite(lat) && Number.isFinite(lng) && lat >= 40 && lat <= 44 && lng >= -75 && lng <= -69 && Number.isFinite(hour)) {
    const hours = await fetchNwsHours(Math.round(lat * 1000) / 1000, Math.round(lng * 1000) / 1000).catch(() => [])
    const periods = hours.map((h) => ({ startTime: h.start, shortForecast: h.condition, pop: h.precipPct, tempF: h.tempF }))
    const byDate: Record<string, { sky: Sky; temp_f: number | null }> = {}
    for (const d of many) {
      const f = rideForecast(periods, d, hour)
      if (f) byDate[d] = { sky: skyOf(f.short_forecast, f.wet), temp_f: f.temp_f }
    }
    return NextResponse.json({ byDate }, { headers: { 'Cache-Control': 'public, max-age=900, s-maxage=1800' } })
  }
  const date = q.get('date') ?? ''
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

type Sky = 'sun' | 'part' | 'cloud' | 'rain' | 'snow'
/** NWS's words for the hour as one of five pictures. */
function skyOf(words: string | null, wet: boolean): Sky {
  const w = (words ?? '').toLowerCase()
  if (/snow|sleet|flurr|ice/.test(w)) return 'snow'
  if (wet || /rain|shower|storm|drizzle/.test(w)) return 'rain'
  if (/partly|mostly sunny|mostly clear/.test(w)) return 'part'
  if (/cloud|overcast|fog/.test(w)) return 'cloud'
  return 'sun'
}
