import 'server-only'
import { unstable_cache } from 'next/cache'

/**
 * Bike-friendly businesses from two public lists, for the ride assistant's
 * stops (Keith 2026-10-23: let organizers find and prefer them):
 *  - Bicycle Benefits (bicyclebenefits.org): businesses that give a perk to
 *    people with the program's helmet sticker. Its member map loads
 *    bicyclebenefits.org/members, every member with coordinates.
 *  - Bicycle Friendly Businesses, certified by the League of American
 *    Bicyclists (bikeleague.org/bfa/award-database). Awards last four years;
 *    the list keeps older rounds, so `current` is round year + 4.
 * Both are read once a day and kept only for Massachusetts and its edges
 * (the trip classifier's area). Credit the program by name wherever one
 * shows; Keith's call (2026-10-23) was to use the published lists as they are.
 */

export interface BikeFriendlyPlace {
  source: 'bicycle_benefits' | 'bike_friendly_business'
  name: string
  lat: number
  lng: number
  /** "Cafes & Coffeeshops", "Bicycle Shop", ... as the list words it. */
  category: string | null
  /** Bicycle Benefits: the perk for sticker holders. */
  perk: string | null
  /** League: Platinum, Gold, Silver, Bronze, and the round ("Summer 2026"). */
  level: string | null
  round: string | null
  current: boolean
  url: string | null
}

const AREA = { s: 41.15, w: -73.6, n: 42.9, e: -69.8 }
const inArea = (lat: number, lng: number) => lat >= AREA.s && lat <= AREA.n && lng >= AREA.w && lng <= AREA.e
const UA = { 'User-Agent': 'GreenStreetsInitiative-Website/1.0 (info@gogreenstreets.org)' }

async function bicycleBenefits(): Promise<BikeFriendlyPlace[]> {
  const res = await fetch('https://bicyclebenefits.org/members', { headers: UA, signal: AbortSignal.timeout(20_000), cache: 'no-store' })
  if (!res.ok) throw new Error(`Bicycle Benefits ${res.status}`)
  const json = await res.json() as { members?: { name: string; status: number; discount: string | null; latitude: string; longitude: string; web: string | null; category?: { name?: string } | null }[] }
  return (json.members ?? []).flatMap((m) => {
    const lat = parseFloat(m.latitude)
    const lng = parseFloat(m.longitude)
    if (m.status !== 1 || !m.discount?.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || !inArea(lat, lng)) return []
    return [{
      source: 'bicycle_benefits' as const, name: m.name.trim(), lat, lng,
      category: m.category?.name ?? null,
      perk: m.discount.replace(/\s*\(Program stickers available HERE!?\)/i, '').trim(),
      level: null, round: null, current: true, url: m.web,
    }]
  })
}

async function bikeFriendlyBusinesses(): Promise<BikeFriendlyPlace[]> {
  const res = await fetch('https://bikeleague.org/wp-admin/admin-ajax.php?action=sf_api&route=programs&program=bfb',
    { headers: UA, signal: AbortSignal.timeout(20_000), cache: 'no-store' })
  if (!res.ok) throw new Error(`League ${res.status}`)
  const json = await res.json() as { data?: { name: string; latitude: number | null; longitude: number | null; bfaAward: string | null; bfaRound: string | null; bfaIndustry: string | null; website: string | null }[] }
  const year = new Date().getFullYear()
  return (json.data ?? []).flatMap((b) => {
    if (b.latitude == null || b.longitude == null || !inArea(b.latitude, b.longitude)) return []
    const roundYear = parseInt(b.bfaRound?.match(/\d{4}/)?.[0] ?? '', 10)
    return [{
      source: 'bike_friendly_business' as const, name: b.name.trim(), lat: b.latitude, lng: b.longitude,
      category: b.bfaIndustry, perk: null, level: b.bfaAward, round: b.bfaRound,
      current: Number.isFinite(roundYear) && roundYear + 4 >= year, url: b.website,
    }]
  })
}

const cached = unstable_cache(
  async (): Promise<BikeFriendlyPlace[]> => {
    const [bb, bfb] = await Promise.allSettled([bicycleBenefits(), bikeFriendlyBusinesses()])
    if (bb.status === 'rejected') console.warn('[bike-friendly] Bicycle Benefits:', bb.reason)
    if (bfb.status === 'rejected') console.warn('[bike-friendly] League:', bfb.reason)
    return [...(bb.status === 'fulfilled' ? bb.value : []), ...(bfb.status === 'fulfilled' ? bfb.value : [])]
  },
  ['bike-friendly-places-v1'],
  { revalidate: 24 * 60 * 60 },
)

/** Both lists, Massachusetts and its edges; [] if neither answers. */
export async function bikeFriendlyPlaces(): Promise<BikeFriendlyPlace[]> {
  return cached().catch(() => [])
}
