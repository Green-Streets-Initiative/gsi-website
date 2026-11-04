/**
 * Bicycle Benefits members near a ride or a route, for riders (Keith
 * 2026-11-01: "We already have all of the Bike Benefits businesses ... We
 * should build that"). The list itself is read on the server
 * (src/lib/server/bike-perks.ts); this file is the geometry, so a ride page
 * can pick the ones near whichever date is on show without another request.
 *
 * "Near" is about a block (150 m) from the meeting spot or the line: close
 * enough that stopping costs nothing. Anything farther is a detour, and a
 * detour is the organizer's call, not ours.
 */

export type PerkKind = 'cafe' | 'bakery' | 'food' | 'bar' | 'sweets' | 'market' | 'bike_shop' | 'shop' | 'fitness' | 'attraction' | 'other'

export interface BikePerk {
  name: string
  /** As the business words it: "10% Off", "Free coffee refill". */
  perk: string
  kind: PerkKind
  lat: number
  lng: number
  address: string | null
  url: string | null
  /** Sells the helmet sticker the perk needs. */
  stickers: boolean
  /** Has an air pump riders can use. */
  pump: boolean
}

export interface PerkStop extends BikePerk {
  /** By the meeting spot, along the route, or (for a place search) nearby. */
  at: 'start' | 'route' | 'near'
  meters: number
}

export const BLOCK_M = 150

/** Bicycle Benefits' category names, in plain words. */
export function perkKind(category: string | null | undefined): PerkKind {
  const c = (category ?? '').toLowerCase()
  if (c.includes('bicycle')) return 'bike_shop'
  if (c.includes('cafe') || c.includes('coffee')) return 'cafe'
  if (c.includes('baker')) return 'bakery'
  if (c.includes('bar') || c.includes('brew')) return 'bar'
  if (c.includes('ice cream') || c.includes('sweet')) return 'sweets'
  if (c.includes('grocer') || c.includes('market')) return 'market'
  if (c.includes('food') || c.includes('restaurant')) return 'food'
  if (c.includes('retail')) return 'shop'
  if (c.includes('fitness') || c.includes('health')) return 'fitness'
  if (c.includes('tourist')) return 'attraction'
  return 'other'
}

export const PERK_KIND_LABEL: Record<PerkKind, string> = {
  cafe: 'Café', bakery: 'Bakery', food: 'Restaurant', bar: 'Bar or brewery', sweets: 'Ice cream and sweets',
  market: 'Market', bike_shop: 'Bike shop', shop: 'Shop', fitness: 'Fitness', attraction: 'Place to visit', other: 'Business',
}

type LatLng = { lat: number; lng: number }

/** Meters from p to the segment a–b, on a flat local projection (fine at a block's scale). */
function segMeters(p: LatLng, a: LatLng, b: LatLng): { m: number; t: number } {
  const kx = 111_320 * Math.cos((p.lat * Math.PI) / 180)
  const ky = 110_540
  const ax = (a.lng - p.lng) * kx, ay = (a.lat - p.lat) * ky
  const bx = (b.lng - p.lng) * kx, by = (b.lat - p.lat) * ky
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0
  return { m: Math.hypot(ax + t * dx, ay + t * dy), t }
}

export function metersBetween(a: LatLng, b: LatLng): number {
  return segMeters(a, b, b).m
}

/**
 * Members within `withinM` of the meeting spot or the line: the start's
 * first (nearest first), then the route's in riding order. A member close to
 * both counts as by the start.
 */
export function perksAlong(
  pool: BikePerk[],
  line: LatLng[],
  start: LatLng | null,
  { withinM = BLOCK_M, cap = 3 }: { withinM?: number; cap?: number } = {},
): PerkStop[] {
  if (!pool.length || (!start && line.length < 2)) return []
  // A box around everything first, so a long route checks only nearby members.
  const pts = start ? [...line, start] : line
  const pad = withinM / 100_000 * 1.6
  const s = Math.min(...pts.map((p) => p.lat)) - pad, n = Math.max(...pts.map((p) => p.lat)) + pad
  const w = Math.min(...pts.map((p) => p.lng)) - pad * 1.4, e = Math.max(...pts.map((p) => p.lng)) + pad * 1.4
  const atStart: (PerkStop & { order: number })[] = []
  const onRoute: (PerkStop & { order: number })[] = []
  for (const x of pool) {
    if (x.lat < s || x.lat > n || x.lng < w || x.lng > e) continue
    const fromStart = start ? metersBetween(x, start) : Infinity
    if (fromStart <= withinM) {
      atStart.push({ ...x, at: 'start', meters: Math.round(fromStart), order: fromStart })
      continue
    }
    let best = Infinity, order = 0
    for (let i = 0; i < line.length - 1; i++) {
      const d = segMeters(x, line[i], line[i + 1])
      if (d.m < best) { best = d.m; order = i + d.t }
    }
    if (best <= withinM) onRoute.push({ ...x, at: 'route', meters: Math.round(best), order })
  }
  atStart.sort((a, b) => a.order - b.order)
  onRoute.sort((a, b) => a.order - b.order)
  return [...atStart, ...onRoute].slice(0, cap).map(({ order: _order, ...p }) => p)
}

/** Members within `radiusM` of a place, nearest first. */
export function perksNear(pool: BikePerk[], at: LatLng, radiusM: number, cap = 10): PerkStop[] {
  return pool
    .map((x) => ({ ...x, at: 'near' as const, meters: Math.round(metersBetween(x, at)) }))
    .filter((x) => x.meters <= radiusM)
    .sort((a, b) => a.meters - b.meters)
    .slice(0, cap)
}

/** "By the start", "On the route", "0.4 mi away" as a rider reads it. */
export function perkWhere(p: PerkStop): string {
  if (p.at === 'start') return 'By the start'
  if (p.at === 'route') return 'On the route'
  return p.meters <= BLOCK_M ? 'About a block away' : `${Math.max(0.1, p.meters / 1609).toFixed(1)} mi away`
}
