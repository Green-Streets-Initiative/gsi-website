import { requireOrganizerCaller } from '@/lib/organizers/server'
import { fetchRideWithGps } from '@/lib/organizers/rwgps'

/**
 * POST { url } — a public or unlisted Ride with GPS route (or recorded
 * trip), as the console's route shape (lib/organizers/rwgps.ts). Signed-in
 * organizers only, so this isn't an open proxy.
 */
export async function POST(request: Request) {
  const caller = await requireOrganizerCaller(request)
  if (!caller.ok) return caller.res
  const body = await request.json().catch(() => ({}))
  const r = await fetchRideWithGps(String(body?.url ?? ''))
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status })
  return Response.json({ name: r.name, waypoints: r.waypoints, distance_mi: r.distance_mi, elevation: r.elevation })
}
