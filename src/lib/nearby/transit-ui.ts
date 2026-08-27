/** MBTA line colors keyed by route id (official brand colors). */
export const ROUTE_COLORS: Record<string, string> = {
  Red: '#DA291C',
  Mattapan: '#DA291C',
  Orange: '#ED8B00',
  Blue: '#003DA5',
  'Green-B': '#00843D',
  'Green-C': '#00843D',
  'Green-D': '#00843D',
  'Green-E': '#00843D',
}

const COMMUTER_RAIL_COLOR = '#80276C'
const BUS_COLOR = '#FFC72C'
const SILVER_COLOR = '#7C878E'
const SHUTTLE_COLOR = '#6366F1'

/** Silver Line GTFS route ids (SL1–SL5 + Silver Line Way). */
const SILVER_IDS = new Set(['741', '742', '743', '746', '749', '751'])

/** Color for any MBTA route id — subway lines by table, CR-* purple, SL gray, numeric bus yellow. */
export function lineColor(routeId: string): string {
  if (ROUTE_COLORS[routeId]) return ROUTE_COLORS[routeId]
  if (routeId.startsWith('CR-')) return COMMUTER_RAIL_COLOR
  if (SILVER_IDS.has(routeId) || /^SL\d/.test(routeId)) return SILVER_COLOR
  if (routeId.startsWith('crtma:') || routeId.startsWith('longwood:')) return SHUTTLE_COLOR
  if (/^\d+$|^CT\d/.test(routeId)) return BUS_COLOR
  return '#666666'
}

/** Bus route chips read best dark-on-yellow; rail badges white-on-line-color. */
export function lineTextColor(routeId: string): string {
  return lineColor(routeId) === BUS_COLOR ? '#191A2E' : '#FFFFFF'
}

export type DirectionsMode = 'walking' | 'bicycling' | 'transit'

const APPLE_DIRFLG: Record<DirectionsMode, string> = { walking: 'w', bicycling: 'cy', transit: 'r' }

/** Directions deep link — Apple Maps on iOS, Google Maps elsewhere.
 *  Walking by default; pass mode/origin for door-to-door trips. */
export function directionsUrl(
  lat: number,
  lng: number,
  opts?: { mode?: DirectionsMode; origin?: { lat: number; lng: number } },
): string {
  const mode = opts?.mode ?? 'walking'
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (isIOS) {
    const saddr = opts?.origin ? `&saddr=${opts.origin.lat},${opts.origin.lng}` : ''
    return `maps://maps.apple.com/?daddr=${lat},${lng}${saddr}&dirflg=${APPLE_DIRFLG[mode]}`
  }
  const origin = opts?.origin ? `&origin=${opts.origin.lat},${opts.origin.lng}` : ''
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${origin}&travelmode=${mode}`
}
