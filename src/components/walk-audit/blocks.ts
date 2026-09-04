// Route "blocks": ~150 m segments of a walked line, used for block-by-block
// progress and check-ins. Shared by the walk-audit capture and the corridor
// (Safe Routes) walk form.

export interface BlockDef {
  i: number
  name: string | null
  mid: { lat: number; lng: number }
  start: { lat: number; lng: number }
  end: { lat: number; lng: number }
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function buildClientBlocks(points: { lat: number; lng: number }[]): BlockDef[] {
  const blocks: BlockDef[] = []
  let idx = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1]
    const dist = haversineMeters(a, b)
    const n = Math.max(1, Math.round(dist / 150))
    for (let k = 0; k < n; k++) {
      const tStart = k / n
      const tEnd = (k + 1) / n
      const tMid = (k + 0.5) / n
      blocks.push({
        i: idx++,
        name: null,
        mid: { lat: a.lat + (b.lat - a.lat) * tMid, lng: a.lng + (b.lng - a.lng) * tMid },
        start: { lat: a.lat + (b.lat - a.lat) * tStart, lng: a.lng + (b.lng - a.lng) * tStart },
        end: { lat: a.lat + (b.lat - a.lat) * tEnd, lng: a.lng + (b.lng - a.lng) * tEnd },
      })
    }
  }
  return blocks
}

export function routeMilesOf(points: { lat: number; lng: number }[]): number {
  let m = 0
  for (let i = 0; i < points.length - 1; i++) m += haversineMeters(points[i], points[i + 1])
  return m / 1609.34
}
