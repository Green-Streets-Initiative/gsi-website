import { fetchRepairPlaces } from '@/lib/nearby/repair'

/**
 * Same-origin list of community bike repair co-ops for /nearby's "Fix your
 * bike" section. The whole approved set is small (a handful statewide), so
 * the client filters by distance itself — one cached read, no per-location
 * round trip. Rows are the Shift app's town_resources bike_repair entries;
 * the anon key means only approved places show.
 */
export async function GET() {
  const places = await fetchRepairPlaces()
  return Response.json(
    { places },
    // Hours are edited by hand a few times a season — a five-minute CDN
    // cache keeps corrections quick without hitting the DB per visitor.
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600' } },
  )
}
