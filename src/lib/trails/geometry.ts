import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/** Map lines for one trail, [[lng, lat], ...][], built from OpenStreetMap and
 *  the stored path shapes (src/data/trails/<id>.json, checked by hand).
 *  Trails the details check made public (Shift 01896, trail-research details)
 *  have no file: their line is trails.map_lines in the database. */
export interface TrailGeometry {
  id: string
  lines: [number, number][][]
  miles: number
  source: string | null
}

interface DbLine {
  id: string
  name: string
  map_lines: { lines?: [number, number][][]; miles?: number; source?: string } | null
}

/** Lines stored in the database for public trails with no file. Cached for
 *  ten minutes, like the trail pages. */
const dbLines = unstable_cache(
  async (): Promise<DbLine[]> => {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('trails')
      .select('id, name, map_lines')
      .eq('status', 'approved')
      .eq('active', true)
      .not('map_lines', 'is', null)
      .limit(500)
    if (error) return []
    return ((data ?? []) as DbLine[]).filter((r) => (r.map_lines?.lines?.length ?? 0) > 0)
  },
  ['trail-db-lines'],
  { revalidate: 600 },
)

export async function getTrailLines(id: string): Promise<TrailGeometry | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return null
  try {
    const mod = await import(`@/data/trails/${id}.json`)
    return (mod.default ?? mod) as TrailGeometry
  } catch {
    const row = (await dbLines().catch(() => [] as DbLine[])).find((r) => r.id === id)
    if (!row?.map_lines?.lines) return null
    return { id, lines: row.map_lines.lines, miles: row.map_lines.miles ?? 0, source: row.map_lines.source ?? 'OpenStreetMap' }
  }
}

/** Every trail's lines, lighter, for the /trails network map: the hand-built
 *  set, plus database lines for trails it doesn't have. */
export async function getNetworkLines(): Promise<Array<{ id: string; name: string; lines: [number, number][][] }>> {
  const mod = await import('@/data/trails/all.json')
  const files = (mod.default ?? mod) as unknown as Array<{ id: string; name: string; lines: [number, number][][] }>
  const have = new Set(files.map((f) => f.id))
  const extra = (await dbLines().catch(() => [] as DbLine[]))
    .filter((r) => !have.has(r.id))
    .map((r) => ({ id: r.id, name: r.name, lines: thinForNetwork(r.map_lines!.lines!) }))
  return [...files, ...extra]
}

/** The network map draws every trail at once, so keep about one point in
 *  four (the ends always) on long lines. */
function thinForNetwork(lines: [number, number][][]): [number, number][][] {
  return lines.map((l) => (l.length <= 40 ? l : l.filter((_, i) => i % 4 === 0 || i === l.length - 1)))
}
