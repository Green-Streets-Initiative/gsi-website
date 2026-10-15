import { NextRequest, NextResponse } from 'next/server'
import { tryItFor } from '@/lib/commute/try-it-event'
import type { EventMode } from '@/lib/types/commute'

/*
 * GET /api/commute/event?mode=walk|transit|bike&lat=&lng=
 * The "Try it with others" card for one way in, re-fetched by the advisor
 * page when a different row opens (Keith 2026-10-06). The recommend route
 * answers the same shape for the recommended way in; this is additive.
 * Reads public listings only; writes nothing, logs nothing.
 */

const MODES = new Set<string>(['walk', 'transit', 'bike'])

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const mode = p.get('mode') ?? ''
  const lat = Number(p.get('lat'))
  const lng = Number(p.get('lng'))
  if (!MODES.has(mode)) return NextResponse.json({ error: 'mode must be walk, transit or bike' }, { status: 400 })
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }
  try {
    const card = await tryItFor(mode as EventMode, { lat, lng })
    return NextResponse.json(card, {
      headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=60' },
    })
  } catch (err) {
    console.error('[commute/event] failed:', err)
    return NextResponse.json({ error: 'event_unavailable' }, { status: 502 })
  }
}
