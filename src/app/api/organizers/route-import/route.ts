import { requireOrganizerCaller } from '@/lib/organizers/server'
import { elevationOf, routeMiles, simplify, toWaypoints, type TrackPoint } from '@/lib/organizers/route-geo'

/**
 * POST { url } — a public or unlisted Ride with GPS route (or recorded
 * trip), as the console's route shape. Ride with GPS serves a route's track
 * as JSON without a key, but not to browsers on other sites, so the console
 * asks through here. Signed-in organizers only, so this isn't an open proxy.
 *
 * Accepts ridewithgps.com/routes/<id> and /trips/<id>, with the
 * privacy_code an unlisted route's share link carries.
 */
const HOSTS = new Set(['ridewithgps.com', 'www.ridewithgps.com'])

export async function POST(request: Request) {
  const caller = await requireOrganizerCaller(request)
  if (!caller.ok) return caller.res

  const body = await request.json().catch(() => ({}))
  let url: URL
  try {
    url = new URL(String(body?.url ?? '').trim())
  } catch {
    return Response.json({ error: 'Paste a Ride with GPS route link, like ridewithgps.com/routes/12345' }, { status: 400 })
  }
  const m = url.pathname.match(/^\/(routes|trips)\/(\d{1,12})/)
  if (!HOSTS.has(url.hostname) || !m) {
    return Response.json({ error: 'Paste a Ride with GPS route link, like ridewithgps.com/routes/12345' }, { status: 400 })
  }
  const [, type, id] = m
  const src = new URL(`https://ridewithgps.com/${type}/${id}.json`)
  const privacy = url.searchParams.get('privacy_code')
  if (privacy && /^[A-Za-z0-9]{1,64}$/.test(privacy)) src.searchParams.set('privacy_code', privacy)

  const res = await fetch(src, {
    headers: { Accept: 'application/json', 'User-Agent': 'GreenStreets-Shift-Organizers/1.0 (+https://www.gogreenstreets.org)' },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  }).catch(() => null)
  if (!res) return Response.json({ error: "Couldn't reach Ride with GPS. Try again in a minute." }, { status: 502 })

  const json = await res.json().catch(() => null) as Record<string, unknown> | null
  const errors = (json?.errors as { error_code?: string }[] | undefined) ?? []
  if (errors.some((e) => e.error_code === 'not_public') || res.status === 403) {
    return Response.json({
      error: 'That route is private on Ride with GPS. Make it public or unlisted there, or export it as a GPX file and upload that here.',
    }, { status: 422 })
  }
  if (!res.ok || !json) {
    return Response.json({ error: "We couldn't find that route on Ride with GPS. Check the link." }, { status: 404 })
  }

  // Trips nest the track under "trip"; routes under "route" on some API
  // versions and at the top level on others.
  const rec = ((json.route ?? json.trip ?? json) as Record<string, unknown>)
  const raw = (rec.track_points as { x?: number; y?: number; e?: number }[] | undefined) ?? []
  const points: TrackPoint[] = raw
    .filter((p) => typeof p.x === 'number' && typeof p.y === 'number')
    .map((p) => ({ lat: p.y as number, lng: p.x as number, ele: typeof p.e === 'number' ? p.e : null }))
  if (points.length < 2) {
    return Response.json({ error: 'That Ride with GPS link has no route line in it.' }, { status: 422 })
  }

  const elevation = elevationOf(points)
  const thin = simplify(points, 1500)
  return Response.json({
    name: typeof rec.name === 'string' ? rec.name : null,
    waypoints: toWaypoints(thin),
    distance_mi: Math.round(routeMiles(points) * 10) / 10,
    elevation,
  })
}
