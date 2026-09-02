import { createClient } from '@supabase/supabase-js'
import { coverageTiles, tileBounds } from '@/lib/nearby/osm-tiles'
import { fetchOverpassBikeWays, overpassNextAvailableAt } from '@/lib/server/overpass'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * OpenStreetMap bike-lane refresh for /nearby. Runs every 20 min: keeps
 * osm_bike_tiles filled for every region's coverage area, fetching the
 * never-fetched tiles first (Boston core outward) and then the stalest,
 * a bounded batch per run so the whole set turns over weekly — far fresher
 * than bike lanes change, and gentle on Overpass's fair-use limits.
 *
 * A tile that fails keeps its previous ways; only attempted_at/fetch_error
 * move, so it is retried next run without ever serving a hole.
 *
 * ?limit=<n>  tiles per run (default 60)
 * ?tile=<key> force one specific tile (manual use)
 * Auth: Vercel cron Bearer CRON_SECRET, same as the other cron routes.
 */
const DEFAULT_LIMIT = 60
const REFRESH_DAYS = 7
const RETRY_MINUTES = 60
const BUDGET_MS = 240_000 // leave headroom under maxDuration
/** Pause between tiles — Overpass throttles bursts from one IP. */
const PACE_MS = 1_500
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

interface TileRow { tile: string; priority: number }

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
  const only = url.searchParams.get('tile')
  const limit = Math.max(1, Math.min(500, parseInt(url.searchParams.get('limit') || '') || DEFAULT_LIMIT))
  const started = Date.now()

  // Seed: the coverage set is derived from REGIONS, so a new region shows up
  // here as missing rows on the next run.
  const coverage = coverageTiles()
  const { count: existing, error: countErr } = await supabase
    .from('osm_bike_tiles')
    .select('tile', { count: 'exact', head: true })
  if (countErr) return Response.json({ error: countErr.message }, { status: 500 })
  let seeded = 0
  if ((existing ?? 0) < coverage.length) {
    for (let i = 0; i < coverage.length; i += 500) {
      const { error } = await supabase
        .from('osm_bike_tiles')
        .upsert(coverage.slice(i, i + 500), { onConflict: 'tile', ignoreDuplicates: true })
      if (error) return Response.json({ error: `seed: ${error.message}` }, { status: 500 })
    }
    seeded = coverage.length - (existing ?? 0)
  }

  // Select: never-fetched first, core outward; a tile that failed waits an
  // hour before its retry so one bad tile can't hog every run, but a
  // transient failure in Boston doesn't wait behind the whole Cape either.
  // Then the stalest.
  let batch: TileRow[] = []
  if (only) {
    const { data } = await supabase.from('osm_bike_tiles').select('tile, priority').eq('tile', only)
    batch = (data ?? []) as TileRow[]
  } else {
    const retryAfter = new Date(Date.now() - RETRY_MINUTES * 60_000).toISOString()
    const { data: fresh, error } = await supabase
      .from('osm_bike_tiles')
      .select('tile, priority')
      .is('fetched_at', null)
      .or(`attempted_at.is.null,attempted_at.lt.${retryAfter}`)
      .order('priority', { ascending: true })
      .order('attempted_at', { ascending: true, nullsFirst: true })
      .limit(limit)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    batch = (fresh ?? []) as TileRow[]
    if (batch.length < limit) {
      const cutoff = new Date(Date.now() - REFRESH_DAYS * 86_400_000).toISOString()
      const { data: stale } = await supabase
        .from('osm_bike_tiles')
        .select('tile, priority')
        .lt('fetched_at', cutoff)
        .order('fetched_at', { ascending: true })
        .limit(limit - batch.length)
      batch = [...batch, ...((stale ?? []) as TileRow[])]
    }
  }

  // Fetch sequentially: Overpass allows two slots per IP and throttles bursts.
  let fetched = 0
  let failed = 0
  let stopped: string | null = null
  const errors: Record<string, string> = {}
  for (const row of batch) {
    if (Date.now() - started > BUDGET_MS) {
      stopped = 'budget reached; remaining tiles next run'
      break
    }
    // Every endpoint cooling down: wait for the first to come back rather
    // than burn the batch on guaranteed failures.
    const wait = overpassNextAvailableAt() - Date.now()
    if (wait > 0) {
      if (Date.now() - started + wait > BUDGET_MS) {
        stopped = 'overpass endpoints cooling down; remaining tiles next run'
        break
      }
      await sleep(wait)
    }
    const b = tileBounds(row.tile)
    const now = new Date().toISOString()
    const ways = await fetchOverpassBikeWays(
      `${b.minLat},${b.minLng},${b.maxLat},${b.maxLng}`,
      { timeoutS: 25, abortMs: 30_000 },
    )
    if (ways === null) {
      failed++
      errors[row.tile] = 'overpass failed'
      await supabase
        .from('osm_bike_tiles')
        .update({ attempted_at: now, fetch_error: `overpass failed ${now}` })
        .eq('tile', row.tile)
      await sleep(PACE_MS)
      continue
    }
    const { error } = await supabase
      .from('osm_bike_tiles')
      .update({ ways, way_count: ways.length, fetched_at: now, attempted_at: now, fetch_error: null })
      .eq('tile', row.tile)
    if (error) {
      failed++
      errors[row.tile] = error.message
    } else {
      fetched++
    }
    await sleep(PACE_MS)
  }

  const [{ count: remainingUnfetched }, { count: remainingStale }] = await Promise.all([
    supabase.from('osm_bike_tiles').select('tile', { count: 'exact', head: true }).is('fetched_at', null),
    supabase.from('osm_bike_tiles').select('tile', { count: 'exact', head: true })
      .lt('fetched_at', new Date(Date.now() - REFRESH_DAYS * 86_400_000).toISOString()),
  ])

  await supabase.rpc('record_cron_heartbeat', {
    p_function_name: 'osm-bike-lanes',
    p_started_at: new Date(started).toISOString(),
    p_finished_at: new Date().toISOString(),
    p_status: batch.length === 0 ? 'no-op' : failed === 0 ? 'success' : 'partial',
    p_sent: fetched,
    p_errors: failed,
    p_message: stopped,
  }).then(({ error: hbErr }) => {
    if (hbErr) console.error('osm-bike-lanes heartbeat failed:', hbErr.message)
  })

  return Response.json({
    elapsed_ms: Date.now() - started,
    coverage: coverage.length,
    seeded,
    selected: batch.length,
    fetched,
    failed,
    remaining_unfetched: remainingUnfetched ?? null,
    remaining_stale: remainingStale ?? null,
    ...(stopped ? { stopped } : {}),
    ...(Object.keys(errors).length ? { errors } : {}),
  })
}
