import { getTrails } from '@/lib/trails/queries'
import { getNetworkLines } from '@/lib/trails/geometry'
import { trailCard, OG_SIZE } from '@/lib/trails/ogCard'
import { clipLines, GREATER_BOSTON } from '@/lib/trails/shape'

/** Share card for /trip: Greater Boston's bike paths, and the four ways compared. */
export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 86400
export const alt = 'Plan a trip in Greater Boston: walk, bike, transit and drive side by side, over a map of the bike paths'

export default async function OGImage() {
  let lines: [number, number][][] = []
  try {
    const [trails, network] = await Promise.all([getTrails(), getNetworkLines()])
    const shown = new Set(trails.map((t) => t.id))
    lines = network
      .filter((n) => shown.has(n.id))
      .flatMap((n) => clipLines(n.lines, GREATER_BOSTON))
  } catch {
    lines = []
  }
  return trailCard({
    kicker: 'Plan a trip',
    title: 'Every way there, side by side, with calmer bike routes',
    chips: ['Walk', 'Bike', 'Transit', 'Drive'],
    lines,
    network: true,
  })
}
