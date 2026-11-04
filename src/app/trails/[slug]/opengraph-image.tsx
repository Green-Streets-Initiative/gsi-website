import { getTrail } from '@/lib/trails/queries'
import { getTrailLines } from '@/lib/trails/geometry'
import { trailCard, surfaceWord, milesLabel, OG_SIZE } from '@/lib/trails/ogCard'

/** Share card for a trail page: its line, its places to get on, name and facts. */
export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 86400
export const alt = 'The trail drawn on a card, with its length and where to get on'

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const data = await getTrail(decodeURIComponent(slug))
    if (!data) throw new Error('no trail')
    const t = data.trail
    const geo = await getTrailLines(t.id)
    const pts = t.access_points
    const chips = [
      t.full_miles ? milesLabel(t.full_miles) : null,
      surfaceWord(t.surface),
      pts.length > 0 ? `${pts.length} ${pts.length === 1 ? 'place' : 'places'} to get on` : null,
    ].filter((c): c is string => !!c)
    const towns = t.towns.length <= 2 ? t.towns.join(' and ') : `${t.towns.slice(0, 2).join(', ')} and more`
    return await trailCard({
      kicker: towns ? `Trail · ${towns}` : 'Trail',
      title: t.name,
      chips,
      lines: geo?.lines ?? [],
      points: pts.map((p) => [p.lng, p.lat] as [number, number]),
    })
  } catch {
    return trailCard({ kicker: 'Trails', title: 'Bike paths and rail trails', chips: ['Maps', 'Parking', 'Closures'], lines: [] })
  }
}
