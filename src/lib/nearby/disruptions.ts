/**
 * MBTA disruptions happening now AND coming up, for guide pages (the T backup
 * guide's closures list and the guide trip planner). Same inclusion rules as
 * Nearby (src/lib/nearby/alerts.ts): only SHUTTLE, SUSPENSION and
 * STATION_CLOSURE, and a disruption that began more than ALERT_FRESH_DAYS ago
 * reads as baseline, not news. Added here: planned disruptions that start
 * within the look-ahead window. Fetched keyless from the browser, like Nearby.
 */

import { ALERT_FRESH_DAYS } from './alerts'

const MAJOR_EFFECTS = new Set(['SHUTTLE', 'SUSPENSION', 'STATION_CLOSURE'])
const GLYPH_STRIP = /[\u{E000}-\u{F8FF}\u{FFFD}]/gu
const DAY = 86_400_000

export interface Disruption {
  id: string
  effect: string
  header: string
  url: string | null
  routeIds: string[]
  /** One badge per line: Green branches collapse to "Green Line" when an
   *  alert names all four. Filled in by fetchDisruptions. */
  lines: LineBadge[]
  status: 'now' | 'upcoming'
  /** The period that is happening now, or the next one coming up (ISO). */
  start: string
  end: string | null
}

type Period = { start: string; end: string | null }

export interface LineBadge {
  /** Route id used for the color (lineColor): "Red", "Green", "CR-Worcester", "67". */
  id: string
  name: string
  mode: 'subway' | 'commuter_rail' | 'bus' | 'ferry'
}

const GREEN = ['Green-B', 'Green-C', 'Green-D', 'Green-E']

/** Route names for the badges, from the MBTA. */
async function routeInfo(ids: string[]): Promise<Map<string, { name: string; type: number }>> {
  if (!ids.length) return new Map()
  try {
    const res = await fetch(
      `https://api-v3.mbta.com/routes?filter[id]=${[...new Set(ids)].join(',')}&fields[route]=short_name,long_name,type`,
    )
    if (!res.ok) return new Map()
    const j = (await res.json()) as { data: { id: string; attributes: { short_name: string; long_name: string; type: number } }[] }
    return new Map(
      j.data.map((r) => [
        r.id,
        { name: r.attributes.type === 3 ? `Bus ${r.attributes.short_name}` : r.attributes.long_name, type: r.attributes.type },
      ]),
    )
  } catch {
    return new Map()
  }
}

function badgesFor(routeIds: string[], info: Map<string, { name: string; type: number }>): LineBadge[] {
  const ids = [...new Set(routeIds)]
  const out: LineBadge[] = []
  const allGreen = GREEN.every((g) => ids.includes(g))
  if (allGreen) out.push({ id: 'Green', name: 'Green Line', mode: 'subway' })
  for (const id of ids) {
    if (allGreen && GREEN.includes(id)) continue
    const r = info.get(id)
    if (!r) continue
    const mode = r.type === 2 ? 'commuter_rail' : r.type === 3 ? 'bus' : r.type === 4 ? 'ferry' : 'subway'
    out.push({ id, name: r.name, mode })
  }
  return out
}

/** "Green Line C Branch: Trains will…" -> "Trains will…": the badge already names the line. */
function stripLinePrefix(header: string): string {
  const m = /^([A-Z][A-Za-z/ ]{2,40}(?:Line|Branch|Lines))\s*:\s+/.exec(header)
  return m ? header.slice(m[0].length) : header
}

export async function fetchDisruptions(opts: {
  routeIds?: string[]
  routeTypes?: number[]
  daysAhead?: number
}): Promise<Disruption[]> {
  const daysAhead = opts.daysAhead ?? 30
  const params = new URLSearchParams({
    'filter[lifecycle]': 'NEW,ONGOING,ONGOING_UPCOMING,UPCOMING',
    'page[limit]': '100',
  })
  if (opts.routeIds?.length) params.set('filter[route]', [...new Set(opts.routeIds)].join(','))
  else if (opts.routeTypes?.length) params.set('filter[route_type]', opts.routeTypes.join(','))
  else return []
  try {
    const res = await fetch(`https://api-v3.mbta.com/alerts?${params}`)
    if (!res.ok) return []
    const json = await res.json()
    const now = Date.now()
    const out: Disruption[] = []
    for (const a of json?.data ?? []) {
      const at = a?.attributes
      if (!at || !MAJOR_EFFECTS.has(at.effect)) continue
      const header = String(at.header ?? '').replace(GLYPH_STRIP, '').trim()
      if (!header) continue
      const periods = ((at.active_period ?? []) as Period[]).filter((p) => typeof p?.start === 'string')
      if (!periods.length) continue
      const firstStart = new Date(periods[0].start).getTime()
      const current = periods.find(
        (p) => new Date(p.start).getTime() <= now && (!p.end || new Date(p.end).getTime() > now),
      )
      const next = periods.find((p) => new Date(p.start).getTime() > now)
      let status: Disruption['status'] | null = null
      let period: Period | undefined
      if (current && now - firstStart <= ALERT_FRESH_DAYS * DAY) {
        status = 'now'
        period = current
      } else if (!current && next && new Date(next.start).getTime() - now <= daysAhead * DAY) {
        status = 'upcoming'
        period = next
      }
      if (!status || !period) continue
      out.push({
        id: String(a.id),
        effect: at.effect,
        header: stripLinePrefix(header),
        url: typeof at.url === 'string' && at.url ? at.url : null,
        routeIds: [
          ...new Set(
            ((at.informed_entity ?? []) as Array<{ route?: string }>)
              .map((e) => e.route)
              .filter((r): r is string => typeof r === 'string'),
          ),
        ],
        lines: [],
        status,
        start: period.start,
        end: period.end ?? null,
      })
    }
    const info = await routeInfo(out.flatMap((d) => d.routeIds))
    for (const d of out) d.lines = badgesFor(d.routeIds, info)
    return out.sort((x, y) =>
      x.status === y.status ? x.start.localeCompare(y.start) : x.status === 'now' ? -1 : 1,
    )
  } catch {
    return []
  }
}

let commuterRailIds: Promise<Map<string, string>> | null = null

/** Commuter rail long name ("Framingham/Worcester Line") -> route id. */
function loadCommuterRailIds(): Promise<Map<string, string>> {
  commuterRailIds ??= fetch('https://api-v3.mbta.com/routes?filter[type]=2&fields[route]=long_name')
    .then((r) => (r.ok ? r.json() : { data: [] }))
    .then(
      (j: { data: { id: string; attributes: { long_name: string } }[] }) =>
        new Map(j.data.map((r) => [r.attributes.long_name, r.id])),
    )
    .catch(() => new Map())
  return commuterRailIds
}

/**
 * Route ids for the transit legs of a planned trip, from their labels
 * ("Red", "Green-B", "67", "Framingham/Worcester Line"). Labels we can't map
 * are skipped, so a missing alert never blocks the plan.
 */
export async function routeIdsForLabels(labels: string[]): Promise<string[]> {
  const ids: string[] = []
  const rail = labels.some((l) => / Line$/.test(l) && !/^(Red|Orange|Blue|Green|Mattapan)/.test(l))
    ? await loadCommuterRailIds()
    : null
  for (const l of labels) {
    const green = /^Green(?:[- ]Line)?[- ]\(?([A-E])\)?$/.exec(l)
    if (green) {
      ids.push(`Green-${green[1]}`)
    } else if (/^(Red|Orange|Blue|Mattapan)$/.test(l) || /^\d+[A-Z]?$/.test(l) || /^CT\d$/.test(l)) {
      ids.push(l)
    } else if (rail?.has(l)) {
      ids.push(rail.get(l) as string)
    }
  }
  return [...new Set(ids)]
}

/** "Sat, Oct 31" in Boston time. */
export function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
}
