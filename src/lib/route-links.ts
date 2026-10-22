/**
 * Route links on community events (Shift 01394, Keith 2026-10-22): the
 * organizer's published route on RideWithGPS, Strava, Komoot and the like.
 * Same patterns as Shift's supabase/functions/_shared/route-links.ts.
 */
export interface EventRouteLink {
  url: string
  provider: string
  /** "Ride route", "Walk route" or "Route" */
  label: string
  source?: 'organizer_page' | 'submitted' | 'manual'
}

const PROVIDERS: Array<{ provider: string; re: RegExp }> = [
  { provider: 'RideWithGPS', re: /^https?:\/\/(?:www\.)?ridewithgps\.com\/(?:routes|trips)\/\d+(?:\?privacy_code=[A-Za-z0-9]+)?/i },
  { provider: 'Strava', re: /^https?:\/\/(?:www\.)?strava\.com\/routes\/\d+/i },
  { provider: 'Komoot', re: /^https?:\/\/(?:www\.)?komoot\.(?:com|de)\/(?:[a-z]{2}-[a-z]{2}\/)?tour\/\d+/i },
  { provider: 'Garmin Connect', re: /^https?:\/\/connect\.garmin\.com\/modern\/course\/\d+/i },
  { provider: 'MapMyRide', re: /^https?:\/\/(?:www\.)?mapmyride\.com\/routes\/view\/\d+/i },
  { provider: 'Plotaroute', re: /^https?:\/\/(?:www\.)?plotaroute\.com\/route\/\d+/i },
  { provider: 'On The Go Map', re: /^https?:\/\/(?:www\.)?onthegomap\.com\/s\/[a-z0-9]+/i },
]

/** A submitted URL as a route link, or null when it isn't one we recognize. */
export function asRouteLink(raw: string | null | undefined, source: EventRouteLink['source'] = 'submitted'): EventRouteLink | null {
  const url = raw?.trim()
  if (!url) return null
  for (const p of PROVIDERS) {
    const m = url.match(p.re)
    if (m) return { url: m[0].replace(/^http:/i, 'https:'), provider: p.provider, label: 'Route', source }
  }
  return null
}

/** Stored route_links, cleaned for display (unknown shapes dropped). */
export function readRouteLinks(value: unknown): EventRouteLink[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((l): l is EventRouteLink => !!l && typeof l.url === 'string' && /^https:\/\//.test(l.url) && typeof l.provider === 'string')
    .map((l) => ({ url: l.url, provider: l.provider, label: typeof l.label === 'string' && l.label ? l.label : 'Route', source: l.source }))
    .slice(0, 4)
}
