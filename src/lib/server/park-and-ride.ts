import 'server-only'

/**
 * MBTA station parking near a point: the MBTA's own parking facilities (V3
 * /facilities, PARKING_AREA) with their posted daily fee, spaces and typical
 * weekday use, and the lines that stop at each station. Read by the "Park at
 * the T" finder on guide pages (/api/park-and-ride) and the Shift assistant.
 * The facility list is cached for a day; the point never goes into a cache key.
 */

const MBTA_BASE = 'https://api-v3.mbta.com'
const MBTA_API_KEY = process.env.MBTA_API_KEY || ''
const headers: HeadersInit = MBTA_API_KEY ? { 'x-api-key': MBTA_API_KEY } : {}

type Prop = { name: string; value: string | number }
type Facility = {
  id: string
  attributes: { long_name: string; latitude: number | null; longitude: number | null; properties: Prop[] }
  relationships: { stop?: { data?: { id: string } | null } }
}
type Stop = { id: string; attributes: { name: string } }

export interface ParkAndRideLot {
  id: string
  name: string
  station: string
  stationId: string | null
  lat: number
  lng: number
  miles: number
  dailyFee: string | null
  monthlyFee: string | null
  spaces: number | null
  weekdayUsePct: number | null
  lines: string[]
}

function prop(f: Facility, name: string): string | number | null {
  const p = f.attributes.properties.find((x) => x.name === name)
  return p ? p.value : null
}

function miles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (d: number) => (d * Math.PI) / 180
  const dLat = r(bLat - aLat)
  const dLng = r(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(h))
}

/** "Mon-Fri: $4 | Sat-Sun: $2" -> "$4 on weekdays, $2 on weekends" */
function feeText(raw: string | number | null): string | null {
  if (raw == null || raw === '') return null
  return String(raw)
    .replace(/Mon-Fri:\s*(\$[\d.]+)/i, '$1 on weekdays')
    .replace(/Sat-Sun:\s*(\$[\d.]+)/i, '$1 on weekends')
    .replace(/\s*\|\s*/g, ', ')
    .trim()
}

async function lines(stationId: string): Promise<string[]> {
  const res = await fetch(`${MBTA_BASE}/routes?filter[stop]=${encodeURIComponent(stationId)}&fields[route]=long_name,type`, {
    headers,
    next: { revalidate: 86400 },
  })
  if (!res.ok) return []
  const data = (await res.json()) as { data: { attributes: { long_name: string; type: number } }[] }
  // Subway, light rail, commuter rail and ferry; buses would crowd the list.
  return [...new Set(data.data.filter((r) => [0, 1, 2, 4].includes(r.attributes.type)).map((r) => r.attributes.long_name))]
}

/** The nearest stations with parking within 25 miles (five unless asked), or null when the MBTA doesn't answer. */
export async function parkAndRideNear(lat: number, lng: number, limit = 5): Promise<ParkAndRideLot[] | null> {
  const res = await fetch(`${MBTA_BASE}/facilities?filter[type]=PARKING_AREA&include=stop&page[limit]=500`, {
    headers,
    next: { revalidate: 86400 },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { data: Facility[]; included?: Stop[] }
  const stops = new Map((data.included ?? []).map((s) => [s.id, s.attributes.name]))

  const all = data.data
    .filter((f) => f.attributes.latitude != null && f.attributes.longitude != null)
    .map((f) => {
      const stationId = f.relationships.stop?.data?.id ?? null
      const spaces = Number(prop(f, 'capacity'))
      const use = Number(prop(f, 'weekday-typical-utilization'))
      return {
        id: f.id,
        name: f.attributes.long_name,
        station: (stationId && stops.get(stationId)) || f.attributes.long_name,
        stationId,
        lat: f.attributes.latitude as number,
        lng: f.attributes.longitude as number,
        miles: Math.round(miles(lat, lng, f.attributes.latitude as number, f.attributes.longitude as number) * 10) / 10,
        dailyFee: feeText(prop(f, 'fee-daily')),
        monthlyFee: feeText(prop(f, 'fee-monthly')),
        spaces: Number.isFinite(spaces) && spaces > 0 ? spaces : null,
        weekdayUsePct: null as number | null,
        lines: [] as string[],
        // MBTA's "weekday-typical-utilization" is a count of parked cars, not a percent.
        usedCars: Number.isFinite(use) && use > 0 ? use : null,
      }
    })
    .filter((l) => l.miles <= 25)
    .sort((a, b) => a.miles - b.miles)

  // One row per station: a garage and a surface lot at the same station are
  // one choice to a driver. Spaces add up; the fee shown is the largest
  // facility's; "how full" is typical weekday parked cars over spaces, across
  // the facilities that report both.
  const byStation = new Map<string, ParkAndRideLot>()
  const biggest = new Map<string, number>()
  const used = new Map<string, { cars: number; spaces: number }>()
  for (const l of all) {
    const key = l.stationId ?? l.id
    if (l.usedCars && l.spaces) {
      const u = used.get(key) ?? { cars: 0, spaces: 0 }
      used.set(key, { cars: u.cars + l.usedCars, spaces: u.spaces + l.spaces })
    }
    const { usedCars: _u, ...lot } = l
    void _u
    const cur = byStation.get(key)
    if (!cur) {
      byStation.set(key, lot)
      biggest.set(key, l.spaces ?? 0)
      continue
    }
    cur.miles = Math.min(cur.miles, l.miles)
    cur.spaces = (cur.spaces ?? 0) + (l.spaces ?? 0) || null
    if ((l.spaces ?? 0) > (biggest.get(key) ?? 0)) {
      biggest.set(key, l.spaces ?? 0)
      cur.dailyFee = l.dailyFee
      cur.monthlyFee = l.monthlyFee
      cur.lat = l.lat
      cur.lng = l.lng
    }
  }
  for (const [key, u] of used) {
    const lot = byStation.get(key)
    if (lot) lot.weekdayUsePct = Math.min(100, Math.round((100 * u.cars) / u.spaces))
  }
  const near: ParkAndRideLot[] = [...byStation.values()].slice(0, limit)

  await Promise.all(near.map(async (l) => (l.lines = l.stationId ? await lines(l.stationId) : [])))

  return near
}
