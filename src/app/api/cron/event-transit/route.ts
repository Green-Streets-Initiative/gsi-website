import { createClient } from '@supabase/supabase-js'
import { getStopTopology } from '@/lib/server/mbta-topology'
import { SNAPSHOT_RAIL_TYPES } from '@/lib/nearby/corridors'
import type { StopTopology } from '@/lib/nearby/live-data'
import type { NearestTransit, NearestTransitStop } from '@/lib/event-transit'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Fills event_details.nearest_transit (Shift 01819): the nearest T station
 * and bus stop to each upcoming event's start, for the /events cards. Runs
 * every 30 min, a bounded batch per run; a place is worked out once and
 * redone only when the event's start point moves. Uses the same station
 * brain as /nearby and the event page (getStopTopology), so the card and
 * the page agree.
 *
 * ?limit=<n>  events per run (default 40)
 * Auth: Vercel cron Bearer CRON_SECRET, same as the other cron routes.
 */
const DEFAULT_LIMIT = 40
const BUDGET_MS = 240_000
/** Pause between places: getStopTopology is ~13 MBTA calls for a new place. */
const PACE_MS = 800
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

interface Row {
  content_id: string
  location_lat: number | string
  location_lng: number | string
  nearest_transit: NearestTransit | null
}

/** The nearest stop (all its platforms' routes together), or null. */
function nearest(stops: StopTopology[]): NearestTransitStop | null {
  if (!stops.length) return null
  const sorted = [...stops].sort((a, b) => a.dist - b.dist)
  const first = sorted[0]
  const same = sorted.filter(s => s.name === first.name)
  const routes: { id: string; name: string }[] = []
  for (const s of same) for (const r of s.routes) if (!routes.some(x => x.id === r.id)) routes.push({ id: r.id, name: r.name })
  if (!routes.length) return null
  return { name: first.name, meters: Math.round(first.dist), routes }
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const expected = process.env.CRON_SECRET
  if (!expected) return new Response('CRON_SECRET not set', { status: 500 })
  if (auth !== `Bearer ${expected}`) return new Response('unauthorized', { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const url = new URL(req.url)
  const limit = Math.max(1, Math.min(300, parseInt(url.searchParams.get('limit') || '') || DEFAULT_LIMIT))
  const started = Date.now()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const { data, error } = await supabase
    .from('event_details')
    .select('content_id, location_lat, location_lng, nearest_transit, content_items!inner(status)')
    .eq('content_items.status', 'approved')
    .or(`event_date.gte.${today},event_end_date.gte.${today}`)
    .not('location_lat', 'is', null)
    .not('location_lng', 'is', null)
    .order('event_date', { ascending: true })
    .limit(2000)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Missing, or worked out for a different point (the start moved).
  const todo = ((data ?? []) as unknown as Row[]).filter(r => {
    const t = r.nearest_transit
    return !t || Math.abs(t.lat - Number(r.location_lat)) > 0.0002 || Math.abs(t.lng - Number(r.location_lng)) > 0.0002
  })

  let done = 0
  const failed: string[] = []
  for (const r of todo.slice(0, limit)) {
    if (Date.now() - started > BUDGET_MS) break
    const lat = Number(r.location_lat)
    const lng = Number(r.location_lng)
    try {
      const [rail, bus] = await Promise.all([
        getStopTopology(lat, lng, { routeTypes: SNAPSHOT_RAIL_TYPES, radiusDeg: 0.02, nameStyle: 'long', maxStops: 3, perStation: true }),
        getStopTopology(lat, lng, { routeTypes: '3', radiusDeg: 0.01, nameStyle: 'short', maxStops: 5 }),
      ])
      const value: NearestTransit = { lat, lng, rail: nearest(rail), bus: nearest(bus) }
      const { error: upErr } = await supabase
        .from('event_details')
        .update({ nearest_transit: value, nearest_transit_at: new Date().toISOString() })
        .eq('content_id', r.content_id)
      if (upErr) failed.push(`${r.content_id}: ${upErr.message}`)
      else done++
    } catch (e) {
      // A refusal (rate limit) is not "no stops here": leave the row empty for the next run.
      failed.push(`${r.content_id}: ${e instanceof Error ? e.message : String(e)}`)
    }
    await sleep(PACE_MS)
  }

  return Response.json({ waiting: todo.length, done, failed: failed.slice(0, 20), ms: Date.now() - started })
}
