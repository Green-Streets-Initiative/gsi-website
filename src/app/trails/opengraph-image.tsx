import { getTrails } from '@/lib/trails/queries'
import { getNetworkLines } from '@/lib/trails/geometry'
import { trailCard, OG_SIZE } from '@/lib/trails/ogCard'
import { clipLines, GREATER_BOSTON } from '@/lib/trails/shape'

/** Share card for /trails: every trail's line together, and the count. */
export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 86400
export const alt = 'Bike paths and rail trails around Boston and across Massachusetts, drawn together'

export default async function OGImage() {
  let lines: [number, number][][] = []
  let count = 0
  try {
    const [trails, network] = await Promise.all([getTrails(), getNetworkLines()])
    const shown = new Set(trails.map((t) => t.id))
    count = trails.length
    // Greater Boston only: the whole state shrinks the paths to specks.
    lines = network
      .filter((n) => shown.has(n.id))
      .flatMap((n) => clipLines(n.lines, GREATER_BOSTON))
  } catch {
    lines = []
  }
  return trailCard({
    kicker: 'Trails',
    title: 'Bike paths and rail trails in Boston and Massachusetts',
    chips: [count ? `${count} trails` : 'Maps', 'Parking', 'Closures'],
    lines,
    network: true,
  })
}
