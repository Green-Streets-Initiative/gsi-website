import { NEARBY_PATH, BOSTON_CENTER, OUTSIDE_AREA_MILES } from './config'

/**
 * Coordinates are rounded to 3 decimals (~110 m) the moment a location is
 * chosen, and the rounded values are used everywhere — data fetches, cache
 * keys, and the shareable URL — so a shared link never carries a
 * house-precision location, and server caches line up with client requests.
 */
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

export interface SnapshotLocation {
  lat: number
  lng: number
  label: string
}

/** Accept only plausibly-New-England coords from the URL; anything else → null. */
export function parseSnapshotParams(searchParams: URLSearchParams): SnapshotLocation | null {
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < 40 || lat > 44 || lng < -75 || lng > -69) return null
  const label = (searchParams.get('label') ?? '').slice(0, 80)
  return { lat: round3(lat), lng: round3(lng), label }
}

export function buildShareUrl(lat: number, lng: number, label: string): string {
  const params = new URLSearchParams({ lat: String(round3(lat)), lng: String(round3(lng)) })
  if (label) params.set('label', label)
  return `${NEARBY_PATH}?${params.toString()}`
}

const EARTH_RADIUS_MILES = 3958.8

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.sqrt(a))
}

export function isOutsideArea(lat: number, lng: number): boolean {
  return haversineMiles(lat, lng, BOSTON_CENTER.lat, BOSTON_CENTER.lng) > OUTSIDE_AREA_MILES
}
