import type { StopTopology } from './live-data'
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
}

export interface PrintStation {
  name: string
  lat: number
  lng: number
  walkMin: number
  isRail: boolean
  lines: PrintStationLine[]
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
      g.lines.push({
        routeId: route.id,
        label: /^\d/.test(route.name) ? `Route ${route.name}` : route.name,
        color: lineColor(route.id),
        textColor: lineTextColor(route.id),
        frequencyLabel: freqByRoute.get(route.id) ?? null,
      })
    }
  }
  return [...groups.values()].sort((a, b) => a.dist - b.dist)
}

/** Closest stations first, capped for single-page print discipline. Bus
 *  corridors put a stop every block — on paper, a stop that serves no NEW
 *  route is noise (four Highland Ave stops all saying "88 · 90"), so only
 *  bus stations that add at least one unseen route make the cut. */
export function buildPrintStations(
  rail: StopTopology[],
  bus: StopTopology[],
  freqByRoute: Map<string, string | null>,
  caps: { rail: number; bus: number } = { rail: 4, bus: 4 },
): PrintStation[] {
  const seenBusRoutes = new Set<string>()
  const busStations = groupTopology(bus, false, freqByRoute).filter(s => {
    const fresh = s.lines.some(l => !seenBusRoutes.has(l.routeId))
    for (const l of s.lines) seenBusRoutes.add(l.routeId)
    return fresh
  })
  return [
    ...groupTopology(rail, true, freqByRoute).slice(0, caps.rail),
    ...busStations.slice(0, caps.bus),
  ]
}
