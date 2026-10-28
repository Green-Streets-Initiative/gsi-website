import 'server-only'

/** Map lines for one trail, [[lng, lat], ...][], built from OpenStreetMap and
 *  the stored path shapes (src/data/trails/<id>.json, checked by hand). */
export interface TrailGeometry {
  id: string
  lines: [number, number][][]
  miles: number
  source: string | null
}

export async function getTrailLines(id: string): Promise<TrailGeometry | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return null
  try {
    const mod = await import(`@/data/trails/${id}.json`)
    return (mod.default ?? mod) as TrailGeometry
  } catch {
    return null
  }
}

/** Every trail's lines, lighter, for the /trails network map. */
export async function getNetworkLines(): Promise<Array<{ id: string; name: string; lines: [number, number][][] }>> {
  const mod = await import('@/data/trails/all.json')
  return (mod.default ?? mod) as unknown as Array<{ id: string; name: string; lines: [number, number][][] }>
}
