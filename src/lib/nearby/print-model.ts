import type { StopTopology } from './live-data'
import type { FrequencyInfo } from '@/lib/server/corridor-meta'
import { lineColor, lineTextColor } from './transit-ui'
import { walkTimeMinutes } from '@/lib/geo/measure'

/**
 * Station grouping for the /nearby/print page. Mirrors the interactive
 * page's groupStops (which lives in the 'use client' useNearbyModel hook,
 * so the server page can't import it): MBTA lists each platform separately,
 * so group by stop name, dedupe the routes serving the group, and keep the
 * closest platform's walk time.
 */

export interface PrintStationLine {
  routeId: string
  label: string
  color: string
  textColor: string
  frequencyLabel: string | null
  /** Both termini ("Medford/Tufts ↔ Heath Street") when the MBTA reports
   *  them — on paper, where a line GOES matters more than its next arrival. */
  endpoints: string | null
}

export interface PrintStation {
  name: string
  lat: number
  lng: number
  walkMin: number
  isRail: boolean
  lines: PrintStationLine[]
}

/** The interactive page's frequency sentences ("A couple of times an hour
 *  on weekdays (~every 40 min)") are too wide once each line row also names
 *  its termini — compress to the number and let one section footnote say
 *  "weekdays" for everybody. */
export function shortFrequencyLabel(f: FrequencyInfo | null): string | null {
  if (!f) return null
  if (f.headwayMin === null) {
    return f.tripsPerDay != null ? `${f.tripsPerDay} trips a day` : f.label
  }
  if (f.headwayMin <= 8) return 'every few minutes'
  return `every ~${f.headwayMin} min`
}

function groupTopology(
  rows: StopTopology[],
  isRail: boolean,
  freqByRoute: Map<string, string | null>,
): PrintStation[] {
  const groups = new Map<string, PrintStation & { dist: number }>()
  for (const stop of rows) {
    const key = stop.name.toLowerCase()
    let g = groups.get(key)
    if (!g) {
      g = { name: stop.name, lat: stop.lat, lng: stop.lng, walkMin: walkTimeMinutes(stop.dist), isRail, lines: [], dist: stop.dist }
      groups.set(key, g)
    }
    if (stop.dist < g.dist) {
      g.dist = stop.dist
      g.walkMin = walkTimeMinutes(stop.dist)
      g.lat = stop.lat
      g.lng = stop.lng
    }
    for (const route of stop.routes) {
      if (g.lines.some(l => l.routeId === route.id)) continue
      const termini = (route.directions ?? [])
        .filter(Boolean)
        // "Sullivan Square Station" → "Sullivan Square" (never bare
        // "Station" strips — "North Station" must survive intact), and
        // "Central Square, Cambridge" → "Central Square" — the city
        // qualifier wraps rows on paper without adding much
        .map(d => d.replace(/ Square Station$/, ' Square').replace(/,\s+[A-Z][a-z]+$/, ''))
      g.lines.push({
        routeId: route.id,
        label: /^\d/.test(route.name) ? `Route ${route.name}` : route.name,
        color: lineColor(route.id),
        textColor: lineTextColor(route.id),
        frequencyLabel: freqByRoute.get(route.id) ?? null,
        endpoints: termini.length === 2 ? termini.join(' ↔ ') : null,
      })
    }
  }
  return [...groups.values()].sort((a, b) => a.dist - b.dist)
}

/** Closest stations first, capped for single-page print discipline. Bus
 *  corridors put a stop every block — on paper, a stop that serves no NEW
 *  route is noise (four Highland Ave stops all saying "88 · 90"), so only
 *  bus stations that add at least one unseen route make the cut. Beyond
 *  the station caps, a total ROUTE-ROW budget keeps route-dense areas
 *  (Union Sq: stops serving 3–4 lines each) from spilling the page — the
 *  vertical cost of this section is its route rows, not its stations. */
const LINE_BUDGET = 12

export function buildPrintStations(
  rail: StopTopology[],
  bus: StopTopology[],
  freqByRoute: Map<string, string | null>,
  caps: { rail: number; bus: number } = { rail: 4, bus: 4 },
): PrintStation[] {
  const railKept = groupTopology(rail, true, freqByRoute).slice(0, caps.rail)
  let lineRows = railKept.reduce((a, s) => a + s.lines.length, 0)

  const seenBusRoutes = new Set<string>()
  const busKept: PrintStation[] = []
  for (const s of groupTopology(bus, false, freqByRoute)) {
    if (busKept.length >= caps.bus) break
    const freshCount = s.lines.filter(l => !seenBusRoutes.has(l.routeId)).length
    if (freshCount === 0) continue
    // A stop must be MOSTLY new routes to earn a block — spending a
    // ~5-line block to add one route on top of a neighbor's (McGrath @
    // Alston re-listing 80/88 to introduce the ~45-min Route 90) is what
    // pushed dense pages onto a second sheet. The QR's live page has it.
    if (freshCount * 2 < s.lines.length) continue
    // The nearest bus station always makes the page, budget or not
    if (busKept.length > 0 && lineRows + s.lines.length > LINE_BUDGET) continue
    for (const l of s.lines) seenBusRoutes.add(l.routeId)
    busKept.push(s)
    lineRows += s.lines.length
  }
  return [...railKept, ...busKept]
}
