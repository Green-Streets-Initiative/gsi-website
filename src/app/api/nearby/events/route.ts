import { NextRequest, NextResponse } from 'next/server'
import { getTownRoams, getTownPartners, getQualifyingTowns } from '@/lib/towns/queries'
import { getEventPicks } from '@/lib/towns/event-picks'

/**
 * Community context for the /nearby snapshot: beginner-prioritized events
 * within 8 miles, the closest Roams, and (when we know the town name from
 * the location label) a Rewards Partner mention for the Get-the-app card
 * and the town's digest sign-up when the town has a published page (only
 * those, so every link in the email works; towns milestone g2).
 * All of them reuse the town-page query layer, which is server-only — hence
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
  const [events, roams, partners, published] = await Promise.all([
    getEventPicks(centroid, 4).catch(() => []),
    getTownRoams(centroid, 3).catch(() => []),
    town ? getTownPartners(town).catch(() => []) : Promise.resolve([]),
    town ? getQualifyingTowns().catch(() => []) : Promise.resolve([]),
  ])
  const digest = published.find(t => t.town_name.toLowerCase() === town.toLowerCase())

  return NextResponse.json(
    {
      events,
      roams,
      partners: { count: partners.length, names: partners.slice(0, 2).map(p => p.name) },
      digestTown: digest ? { name: digest.town_name, slug: digest.slug } : null,
    },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' } }
  )
}
