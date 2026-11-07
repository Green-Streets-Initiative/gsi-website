import { createServerSupabaseClient } from '@/lib/supabase-server'
import { looksLikeRideCode, type RideLookup } from '@/lib/rides/public'

/**
 * A ride's route as a GPX file: /rides/<code>/gpx (?date=YYYY-MM-DD for one
 * date's own route). GPX is the file Ride with GPS, Strava, Komoot, Garmin
 * and Wahoo all import, so the Shift app's "Open in Ride with GPS, Garmin…"
 * button (Keith 2026-11-07) and anyone with the ride's link can load the
 * route into the app they ride with. Same reach as the ride page: whoever
 * has the code.
 */

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!looksLikeRideCode(code)) return new Response('Not found', { status: 404 })
  const want = new URL(req.url).searchParams.get('date')
  const date = want && /^\d{4}-\d{2}-\d{2}$/.test(want) ? want : null

  const { data, error } = await createServerSupabaseClient().rpc('get_ride_public', date ? { p_code: code, p_date: date } : { p_code: code })
  if (error) return new Response('Something went wrong', { status: 500 })
  const ride = data as RideLookup | null
  if (!ride || !ride.web) return new Response('Not found', { status: 404 })

  // The asked-for date, else the next one; its own route when it rides one.
  const day = date ? ride.occurrences.find((d) => d.date === date) : ride.occurrences.find((d) => d.status !== 'canceled')
  const own = day?.own_route && day.route ? day.route : null
  const line = ((own ? own.route_waypoints : ride.route_waypoints) ?? []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
  if (line.length < 2) return new Response('This ride has no route yet', { status: 404 })

  const title = xml(day?.title ? `${day.title} · ${ride.name}` : ride.name)
  const page = `https://www.gogreenstreets.org/rides/${ride.code}${own && day ? `?date=${day.date}` : ''}`
  const pts = line.map((p) => `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"/>`).join('')
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Shift by Green Streets Initiative" xmlns="http://www.topografix.com/GPX/1/1">`
    + `<metadata><name>${title}</name><link href="${xml(page)}"/></metadata><trk><name>${title}</name><trkseg>${pts}</trkseg></trk></gpx>\n`
  const file = `${ride.name.replace(/[^\w-]+/g, '-').slice(0, 40)}${own && day ? `-${day.date}` : ''}.gpx`

  console.log(JSON.stringify({ fn: 'ride-gpx', code: ride.code, date: own && day ? day.date : null, points: line.length }))
  return new Response(gpx, {
    headers: {
      'Content-Type': 'application/gpx+xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${file}"`,
      'Cache-Control': 'public, max-age=300',
      'X-Robots-Tag': 'noindex',
    },
  })
}
