import { requireOrganizerCaller } from '@/lib/organizers/server'
import { getBikeShareDocks } from '@/lib/server/bluebikes'
import { haversineM } from '@/lib/organizers/route-geo'

/**
 * POST { line: [{lat,lng}...] } — places along a ride's route where people
 * could join it: T and commuter rail stations and Bluebikes docks within a
 * short walk of the line (Shift 01744, join-along stops). Signed-in organizers
 * only. Answers [{ lat, lng, label, kind: 't' | 'dock', along_m }] in route
 * order, at most 8, T stations first when two are close together.
 */

type LatLng = { lat: number; lng: number }
type Found = LatLng & { label: string; kind: 't' | 'dock' }

/** A candidate counts when it is this close to the route line. */
const NEAR_M = 150
/** Skip anything this close to the start: that's the meeting point. */
const START_M = 400

async function stations(near: LatLng, radiusM: number): Promise<Found[]> {
  const params = new URLSearchParams({
    'filter[latitude]': String(near.lat), 'filter[longitude]': String(near.lng),
    'filter[radius]': String(radiusM / 1609.344 / 69), 'filter[route_type]': '0,1,2',
  })
  if (process.env.MBTA_API_KEY) params.set('api_key', process.env.MBTA_API_KEY)
  try {
    const res = await fetch(`https://api-v3.mbta.com/stops?${params}`, { signal: AbortSignal.timeout(8000), next: { revalidate: 86400 } })
    if (!res.ok) return []
    const json = await res.json() as { data?: { attributes: { name: string; latitude: number; longitude: number; location_type: number } }[] }
    return (json.data ?? [])
      .filter((s) => s.attributes.location_type === 1 || s.attributes.location_type === 0)
      .map((s) => ({ lat: s.attributes.latitude, lng: s.attributes.longitude, label: `${s.attributes.name} station`.replace(/ Station station$/i, ' Station'), kind: 't' as const }))
  } catch {
    return []
  }
}

async function docks(near: LatLng, radiusM: number): Promise<Found[]> {
  try {
    const list = await getBikeShareDocks(near.lat, near.lng, radiusM)
    return list.map((d) => ({ lat: d.lat, lng: d.lng, label: d.name, kind: 'dock' as const }))
  } catch {
    return []
  }
}

export async function POST(request: Request) {
  const caller = await requireOrganizerCaller(request)
  if (!caller.ok) return caller.res
  const body = await request.json().catch(() => ({}))
  const raw = Array.isArray(body?.line) ? body.line : []
  const line: LatLng[] = raw
    .map((p: { lat?: unknown; lng?: unknown }) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
    .filter((p: LatLng) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .slice(0, 5000)
  if (line.length < 2) return Response.json({ stops: [] })

  // Distance along the line at each point.
  const along: number[] = [0]
  for (let i = 1; i < line.length; i++) along.push(along[i - 1] + haversineM(line[i - 1], line[i]))
  const total = along[along.length - 1]

  // Look around a point every ~1.2 km (at most 14 lookups).
  const step = Math.max(1200, total / 14)
  const samples: LatLng[] = []
  for (let d = 0, i = 0; d <= total; d += step) {
    while (i < line.length - 1 && along[i] < d) i++
    samples.push(line[i])
  }
  samples.push(line[line.length - 1])

  const found = (await Promise.all(samples.map(async (s) => [...(await stations(s, 900)), ...(await docks(s, 900))]))).flat()

  const placed: (Found & { along_m: number })[] = []
  for (const f of found) {
    let best = Infinity
    let at = 0
    for (let i = 0; i < line.length; i++) {
      const d = haversineM(f, line[i])
      if (d < best) { best = d; at = along[i] }
    }
    if (best > NEAR_M || at < START_M || haversineM(f, line[0]) < START_M) continue
    placed.push({ ...f, along_m: Math.round(at) })
  }

  // One per place: T before a dock within 250 m of it, then by route order.
  placed.sort((a, b) => (a.kind === b.kind ? a.along_m - b.along_m : a.kind === 't' ? -1 : 1))
  const kept: typeof placed = []
  for (const p of placed) {
    if (kept.some((k) => k.label === p.label || haversineM(k, p) < 250)) continue
    kept.push(p)
  }
  kept.sort((a, b) => a.along_m - b.along_m)
  return Response.json({ stops: kept.slice(0, 8) })
}
