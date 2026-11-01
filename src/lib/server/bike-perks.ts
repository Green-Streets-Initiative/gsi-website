import 'server-only'
import { bikeFriendlyPlaces } from '@/lib/server/bike-friendly'
import { perkKind, perksAlong, type BikePerk } from '@/lib/bike-perks'

/**
 * Every Bicycle Benefits member with a perk, Massachusetts and its edges, in
 * the shape riders see (src/lib/bike-perks.ts has the geometry). The list is
 * read once a day by bike-friendly.ts; [] when it can't be read, so a page
 * simply shows no perks.
 */
export async function bikePerkPool(): Promise<BikePerk[]> {
  const places = await bikeFriendlyPlaces()
  return places.flatMap((x) => x.source !== 'bicycle_benefits' || !x.perk ? [] : [{
    name: x.name,
    perk: x.perk,
    kind: perkKind(x.category),
    lat: x.lat,
    lng: x.lng,
    address: x.address ?? null,
    url: webUrl(x.url),
    stickers: !!x.stickers,
    pump: !!x.pump,
  }])
}

/** The list's website field, sometimes written without https://. */
function webUrl(raw: string | null): string | null {
  const u = raw?.trim()
  if (!u) return null
  if (/^https?:\/\/\S+$/i.test(u)) return u
  return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(u) ? `https://${u}` : null
}

type LatLng = { lat: number; lng: number }

/**
 * The members a ride page may show: those within a block of any of the
 * ride's meeting spots or routes (each date can have its own). The page then
 * picks the ones near the date on show, without another request.
 */
export async function bikePerksForPlaces(places: { line: LatLng[]; start: LatLng | null }[]): Promise<BikePerk[]> {
  const pool = await bikePerkPool()
  const keep = new Map<string, BikePerk>()
  for (const p of places) {
    for (const x of perksAlong(pool, p.line, p.start, { cap: Infinity })) {
      const { at: _at, meters: _m, ...perk } = x
      keep.set(`${perk.name}|${perk.lat}|${perk.lng}`, perk)
    }
  }
  return [...keep.values()]
}
