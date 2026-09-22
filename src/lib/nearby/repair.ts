/**
 * "Fix your bike" — community repair co-ops near you.
 *
 * The sibling of borrow-rent.ts: those pins are for getting a bike you don't
 * own, these are for fixing the one you do. Unlike borrow-rent the places are
 * NOT bundled here. A co-op's hours change with the term, the season and the
 * weather, so they live in Supabase `town_resources` (category bike_repair,
 * status approved) where they can be corrected without a deploy — the same
 * rows the Shift app's Around You reads.
 *
 * The browser never talks to Supabase directly (privacy extensions block
 * third-party supabase.co calls and the section would silently vanish):
 * it reads same-origin /api/nearby/repair, which does the lookup below.
 */
import { supabase } from '@/lib/supabase'
import type { RepairHoursBlock, RepairSeasonality } from './repair-status'

export interface RepairPlace {
  id: string
  name: string
  description: string | null
  /** The org's own page — where a rider goes for anything we don't carry. */
  url: string | null
  address: string | null
  lat: number
  lng: number
  hours: RepairHoursBlock[] | null
  seasonality: RepairSeasonality | null
  effectiveStart: string | null
  effectiveEnd: string | null
  /** Caveat shown with the hours, verbatim from the org where possible. */
  note: string | null
  /** Where the org announces changes — usually Instagram. */
  hoursUrl: string | null
  verifiedAt: string | null
}

export type RepairPlaceNearby = RepairPlace & { distMiles: number }

/** Repair co-ops are scarce — a handful statewide — so the net is cast wider
 *  than the 2 mi borrow/rent radius. Same as the app's REPAIR_RADIUS_MILES. */
export const REPAIR_RADIUS_MILES = 8

interface RepairRow {
  id: string
  name: string
  description: string | null
  url: string | null
  address: string | null
  lat: number | string | null
  lng: number | string | null
  hours: RepairHoursBlock[] | null
  hours_seasonality: RepairSeasonality | null
  hours_effective_start: string | null
  hours_effective_end: string | null
  hours_note: string | null
  hours_url: string | null
  hours_verified_at: string | null
}

function num(v: number | string | null): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Every approved repair place with coordinates. SERVER callers (the API
 *  route) — queries Supabase on the anon key, so only approved rows show. */
export async function fetchRepairPlaces(): Promise<RepairPlace[]> {
  const { data, error } = await supabase
    .from('town_resources')
    .select(
      'id, name, description, url, address, lat, lng, hours, hours_seasonality, hours_effective_start, hours_effective_end, hours_note, hours_url, hours_verified_at',
    )
    .eq('category', 'bike_repair')
    .eq('status', 'approved')
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (error) {
    console.error('fetchRepairPlaces error:', error)
    return []
  }

  const out: RepairPlace[] = []
  for (const row of (data ?? []) as RepairRow[]) {
    const lat = num(row.lat)
    const lng = num(row.lng)
    if (lat === null || lng === null) continue
    out.push({
      id: row.id,
      name: row.name,
      description: row.description,
      url: row.url,
      address: row.address,
      lat,
      lng,
      hours: Array.isArray(row.hours) ? row.hours : null,
      seasonality: row.hours_seasonality,
      effectiveStart: row.hours_effective_start,
      effectiveEnd: row.hours_effective_end,
      note: row.hours_note,
      hoursUrl: row.hours_url,
      verifiedAt: row.hours_verified_at,
    })
  }
  return out
}

/** BROWSER callers — same-origin route; fails soft to an empty list. */
export async function fetchRepairPlacesClient(signal?: AbortSignal): Promise<RepairPlace[]> {
  try {
    const res = await fetch('/api/nearby/repair', { signal })
    if (!res.ok) return []
    const json = (await res.json()) as { places?: RepairPlace[] }
    return Array.isArray(json.places) ? json.places : []
  } catch {
    return []
  }
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return (
    3958.8 *
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(((lat2 - lat1) * Math.PI) / 360) ** 2 +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(((lng2 - lng1) * Math.PI) / 360) ** 2,
      ),
    )
  )
}

/** Places within radius of a point, nearest first. */
export function nearbyRepair(
  places: RepairPlace[],
  lat: number,
  lng: number,
  radiusMiles: number = REPAIR_RADIUS_MILES,
): RepairPlaceNearby[] {
  return places
    .map(p => ({ ...p, distMiles: haversineMiles(lat, lng, p.lat, p.lng) }))
    .filter(p => p.distMiles <= radiusMiles)
    .sort((a, b) => a.distMiles - b.distMiles)
}
