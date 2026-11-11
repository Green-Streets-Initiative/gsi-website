/**
 * The busy crossings on a planned route, from its crash flags: where a
 * crossing guard helps (Shift 01745). Same rule as the database's
 * _ride_crossings(): plan-ride-route's crash clusters the route crosses
 * (meets "crossing" or "crossing_separated"), and older text-only flags that
 * say "crashes reported". Two flags for one crossing count once.
 */
type Flag = {
  description?: string
  lat?: number
  lng?: number
  kind?: string
  crash?: { streets?: string[]; meets?: string }
}

export interface RouteCrossing {
  label: string
  lat: number
  lng: number
}

const titleCase = (x: string) => x.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

export function routeCrossings(flags: unknown[] | null | undefined): RouteCrossing[] {
  const out: RouteCrossing[] = []
  const seen = new Set<string>()
  for (const raw of flags ?? []) {
    const f = raw as Flag
    if (typeof f?.lat !== 'number' || typeof f?.lng !== 'number') continue
    const crash = f.kind === 'crash' && (f.crash?.meets ?? 'crossing') !== 'along'
    const legacy = !f.kind && /crashes reported/i.test(f.description ?? '')
    if (!crash && !legacy) continue
    const streets = f.crash?.streets ?? []
    const label = streets.length >= 2
      ? streets.slice(0, 2).join(' and ')
      : titleCase((/(?:Crosses|near|at) ([^(]+)/.exec(f.description ?? '')?.[1] ?? '').trim())
    if (!label || seen.has(label.toLowerCase())) continue
    seen.add(label.toLowerCase())
    out.push({ label, lat: f.lat, lng: f.lng })
  }
  return out
}
