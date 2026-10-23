import 'server-only'
import { elevationOf, routeMiles, simplify, toWaypoints, type TrackPoint } from './route-geo'
import type { LatLng, RouteElevation } from './types'

/**
 * A public or unlisted Ride with GPS route (or recorded trip), as the
 * console's route shape. Ride with GPS serves a route's track as JSON
 * without a key, but not to browsers on other sites, so the server asks.
 * Used by /api/organizers/route-import (the editor) and the ride
 * assistant's check_route_link.
 *
 * Accepts ridewithgps.com/routes/<id> and /trips/<id>, with the
 * privacy_code an unlisted route's share link carries.
 */
const HOSTS = new Set(['ridewithgps.com', 'www.ridewithgps.com'])
const LINK_HELP = 'Paste a Ride with GPS route link, like ridewithgps.com/routes/12345'

export type RwgpsResult =
  | { ok: true; name: string | null; waypoints: LatLng[]; distance_mi: number; elevation: RouteElevation | null }
  | { ok: false; status: number; error: string }

export async function fetchRideWithGps(link: string): Promise<RwgpsResult> {
  let url: URL
  try {
    url = new URL(link.trim())
  } catch {
    return { ok: false, status: 400, error: LINK_HELP }
  }
  const m = url.pathname.match(/^\/(routes|trips)\/(\d{1,12})/)
  if (!HOSTS.has(url.hostname) || !m) return { ok: false, status: 400, error: LINK_HELP }
  const [, type, id] = m
  const src = new URL(`https://ridewithgps.com/${type}/${id}.json`)
  const privacy = url.searchParams.get('privacy_code')
  if (privacy && /^[A-Za-z0-9]{1,64}$/.test(privacy)) src.searchParams.set('privacy_code', privacy)

  const res = await fetch(src, {
    headers: { Accept: 'application/json', 'User-Agent': 'GreenStreets-Shift-Organizers/1.0 (+https://www.gogreenstreets.org)' },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  }).catch(() => null)
  if (!res) return { ok: false, status: 502, error: "Couldn't reach Ride with GPS. Try again in a minute." }

  const json = await res.json().catch(() => null) as Record<string, unknown> | null
  const errors = (json?.errors as { error_code?: string }[] | undefined) ?? []
  if (errors.some((e) => e.error_code === 'not_public') || res.status === 403) {
    return { ok: false, status: 422, error: 'That route is private on Ride with GPS. Make it public or unlisted there, or export it as a GPX file and upload that here.' }
  }
  if (!res.ok || !json) return { ok: false, status: 404, error: "We couldn't find that route on Ride with GPS. Check the link." }

  // Trips nest the track under "trip"; routes under "route" on some API
  // versions and at the top level on others.
  const rec = ((json.route ?? json.trip ?? json) as Record<string, unknown>)
  const raw = (rec.track_points as { x?: number; y?: number; e?: number }[] | undefined) ?? []
  const points: TrackPoint[] = raw
    .filter((p) => typeof p.x === 'number' && typeof p.y === 'number')
    .map((p) => ({ lat: p.y as number, lng: p.x as number, ele: typeof p.e === 'number' ? p.e : null }))
  if (points.length < 2) return { ok: false, status: 422, error: 'That Ride with GPS link has no route line in it.' }

  return {
    ok: true,
    name: typeof rec.name === 'string' ? rec.name : null,
    waypoints: toWaypoints(simplify(points, 1500)),
    distance_mi: Math.round(routeMiles(points) * 10) / 10,
    elevation: elevationOf(points),
  }
}
