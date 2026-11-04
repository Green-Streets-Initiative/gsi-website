import { getNetworkLines } from '@/lib/trails/geometry'
import { trailCard, OG_SIZE } from '@/lib/trails/ogCard'
import { clipLines, GREATER_BOSTON } from '@/lib/trails/shape'

/** Share card for the path and bike lane conditions map. */
export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 86400
export const alt = 'Greater Boston paths drawn on a card, for path and bike lane conditions after snow'

export default async function OGImage() {
  let lines: [number, number][][] = []
  try {
    lines = (await getNetworkLines()).flatMap((n) => clipLines(n.lines, GREATER_BOSTON))
  } catch {
    lines = []
  }
  return trailCard({
    kicker: 'After snow',
    title: 'Path and bike lane conditions',
    chips: ['Who plows each trail', 'Reports from today'],
    lines,
    network: true,
  })
}
