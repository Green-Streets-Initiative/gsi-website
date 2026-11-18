/**
 * The nearest T station and bus stop to an event's start, as stored on
 * event_details.nearest_transit (Shift 01819) by /api/cron/event-transit,
 * and the one the /events card shows.
 */

export interface NearestTransitStop {
  name: string
  meters: number
  routes: { id: string; name: string }[]
}

export interface NearestTransit {
  lat: number
  lng: number
  rail: NearestTransitStop | null
  bus: NearestTransitStop | null
}

/** Minutes on foot, the event page's rule (80 m a minute, at least 1). */
export const walkMinutes = (m: number) => Math.max(1, Math.ceil(m / 80))

/** Walks past these aren't "near" enough to put on a card. */
const RAIL_MAX_MIN = 15
const BUS_MAX_MIN = 10
/** A station this close wins over a closer bus stop: the T is the easier ride to find. */
const RAIL_PREFERRED_MIN = 10

export type CardTransit = { kind: 'rail' | 'bus'; stop: NearestTransitStop; walk: number }

/** The one stop a card shows, or null when nothing is a short walk away. */
export function cardTransit(t: NearestTransit | null | undefined): CardTransit | null {
  if (!t) return null
  const rail = t.rail ? { kind: 'rail' as const, stop: t.rail, walk: walkMinutes(t.rail.meters) } : null
  const bus = t.bus ? { kind: 'bus' as const, stop: t.bus, walk: walkMinutes(t.bus.meters) } : null
  if (rail && rail.walk <= RAIL_PREFERRED_MIN) return rail
  if (bus && bus.walk <= BUS_MAX_MIN) return bus
  if (rail && rail.walk <= RAIL_MAX_MIN) return rail
  return null
}

/** A line's own color and letters, the way the map at the station shows it. */
export function lineTag(routeId: string, routeName: string): { bg: string; fg: string; text: string } {
  if (routeId.startsWith('Green-')) return { bg: '#00843D', fg: '#fff', text: `GL ${routeId.slice(6)}` }
  if (routeId === 'Green') return { bg: '#00843D', fg: '#fff', text: 'GL' }
  if (routeId === 'Red') return { bg: '#DA291C', fg: '#fff', text: 'RL' }
  if (routeId === 'Mattapan') return { bg: '#DA291C', fg: '#fff', text: 'M' }
  if (routeId === 'Orange') return { bg: '#ED8B00', fg: '#fff', text: 'OL' }
  if (routeId === 'Blue') return { bg: '#003DA5', fg: '#fff', text: 'BL' }
  if (routeId.startsWith('CR-')) return { bg: '#80276C', fg: '#fff', text: 'CR' }
  if (routeId.startsWith('Boat-')) return { bg: '#008EAA', fg: '#fff', text: 'Ferry' }
  // Bus: MBTA yellow with the route number (SL1 etc. keep their names).
  return { bg: '#FFC72C', fg: '#191A2E', text: routeName.length <= 4 ? routeName : routeId }
}

/** Tags for a stop, one per line (Green Line branches stay apart; commuter rail lines fold into one CR). */
export function stopTags(stop: NearestTransitStop, max = 3) {
  const seen = new Set<string>()
  const tags: ReturnType<typeof lineTag>[] = []
  for (const r of stop.routes) {
    const tag = lineTag(r.id, r.name)
    if (seen.has(tag.text)) continue
    seen.add(tag.text)
    tags.push(tag)
  }
  return tags.slice(0, max)
}
