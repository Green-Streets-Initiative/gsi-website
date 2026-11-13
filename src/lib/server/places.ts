/**
 * Searching for a place: one path for the whole site (parity
 * gap-place-search, 2026-11-13).
 *
 * The address box (/api/places/autocomplete) and the assistants (the Shift
 * and organizer assistants' find_place, the ride designer, the employer
 * assistant's office lookup) all come through here, so they rank places the
 * same way: close to `near` (the map's position, or the person's) when one
 * is known, otherwise across Greater Boston.
 *
 * The radius matches the app's Around You (Shift `places-proxy`): 15 km
 * around a known point, so "20 Munroe St" finds Somerville before Lynn,
 * and 50 km when there is no point.
 */

export type Near = { lat: number; lng: number }

/** Boston, when nothing says where the person is. */
const DEFAULT_CENTER: Near = { lat: 42.3601, lng: -71.0589 }
const NEAR_RADIUS_M = 15_000
const DEFAULT_RADIUS_M = 50_000

export function placesKey(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_ROUTES_API_KEY || null
}

/** A point worth biasing to: finite and in or around New England. */
export function validNear(v: unknown): Near | null {
  if (!v || typeof v !== 'object') return null
  const lat = Number((v as Record<string, unknown>).lat)
  const lng = Number((v as Record<string, unknown>).lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < 40 || lat > 46 || lng < -75 || lng > -66) return null
  return { lat, lng }
}

/** Google's locationBias circle, 0.5 to 50 km (50 is Google's limit). */
export function placeBias(near?: Near | null, radiusM?: number) {
  const c = near ?? DEFAULT_CENTER
  const r = Number.isFinite(radiusM) ? (radiusM as number) : near ? NEAR_RADIUS_M : DEFAULT_RADIUS_M
  return {
    circle: {
      center: { latitude: c.lat, longitude: c.lng },
      radius: Math.round(Math.min(50_000, Math.max(500, r))),
    },
  }
}

export type PlacePrediction = { placeId: string; text: string }

/**
 * Suggestions as someone types. `types` undefined = addresses and
 * businesses; [] = every kind of place, neighborhoods and towns too.
 * Null when Google fails (the route answers 502), [] for no matches.
 */
export async function autocompletePlaces(
  input: string,
  opts: { types?: string[]; near?: Near | null; radiusM?: number } = {},
): Promise<PlacePrediction[] | null> {
  const key = placesKey()
  if (!key || input.trim().length < 3) return []
  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
    body: JSON.stringify({
      input,
      includedRegionCodes: ['us'],
      ...(Array.isArray(opts.types) && opts.types.length === 0
        ? {}
        : { includedPrimaryTypes: opts.types ?? ['street_address', 'premise', 'subpremise', 'establishment'] }),
      locationBias: placeBias(opts.near, opts.radiusM),
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)
  if (!res?.ok) {
    console.error('Places autocomplete error:', res?.status ?? 'network', await res?.text().catch(() => ''))
    return null
  }
  const data = (await res.json()) as { suggestions?: { placePrediction?: { placeId: string; text: { text: string } } }[] }
  return (data.suggestions ?? [])
    .filter((s) => s.placePrediction)
    .slice(0, 5)
    .map((s) => ({ placeId: s.placePrediction!.placeId, text: s.placePrediction!.text.text }))
}

export type FoundPlace = {
  name: string | null
  address: string | null
  lat: number
  lng: number
  /** Google's OPERATIONAL / CLOSED_TEMPORARILY / CLOSED_PERMANENTLY, when known. */
  businessStatus: string | null
}

/**
 * Places matching a typed name or address, best first (Google's order).
 * Throws when Google fails, so a caller's cache never keeps a failure.
 */
export async function searchPlaces(
  query: string,
  opts: { near?: Near | null; radiusM?: number; max?: number } = {},
): Promise<FoundPlace[]> {
  const key = placesKey()
  const q = query.trim().slice(0, 200)
  if (!key || !q) return []
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.businessStatus',
    },
    body: JSON.stringify({
      textQuery: q,
      maxResultCount: Math.min(20, Math.max(1, opts.max ?? 5)),
      locationBias: placeBias(opts.near, opts.radiusM),
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`places ${res.status}`)
  const json = (await res.json()) as {
    places?: { displayName?: { text?: string }; formattedAddress?: string; location?: { latitude: number; longitude: number }; businessStatus?: string }[]
  }
  return (json.places ?? [])
    .filter((p) => p.location)
    .map((p) => ({
      name: p.displayName?.text ?? null,
      address: p.formattedAddress ?? null,
      lat: p.location!.latitude,
      lng: p.location!.longitude,
      businessStatus: p.businessStatus ?? null,
    }))
}
