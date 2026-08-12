import { NextRequest, NextResponse } from 'next/server'
import { getTownEvents, getTownRoams, getTownPartners } from '@/lib/towns/queries'

/**
 * Community context for the /nearby snapshot: beginner-prioritized events
 * within 8 miles, the closest Roams, and (when we know the town name from
 * the location label) a Rewards Partner mention for the Get-the-app card.
 * All three reuse the town-page query layer, which is server-only — hence
 * this thin route.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = parseFloat(searchParams.get('lat') || '')
  const lng = parseFloat(searchParams.get('lng') || '')
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }
  const town = (searchParams.get('town') || '').slice(0, 60).trim()

  const centroid = { lat, lng }
  const [events, roams, partners] = await Promise.all([
    getTownEvents(centroid, 4).catch(() => []),
    getTownRoams(centroid, 3).catch(() => []),
    town ? getTownPartners(town).catch(() => []) : Promise.resolve([]),
  ])

  return NextResponse.json(
    {
      events,
      roams,
      partners: { count: partners.length, names: partners.slice(0, 2).map(p => p.name) },
    },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' } }
  )
}
