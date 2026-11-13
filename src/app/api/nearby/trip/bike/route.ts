import { NextRequest, NextResponse } from 'next/server'
import { inServiceArea } from '@/lib/server/trip'
import {
  networkKeyOf,
  planBudgetOk,
  planIsCached,
  plannerBikeOptions,
  plannerRateLine,
  rateBudgetOk,
} from '@/lib/server/planner-bike'

/**
 * Around You's opened bike trip, from the Shift ride planner (parity
 * gap-two-engines; src/lib/server/planner-bike.ts).
 *
 *   GET  ?from=lat,lng&to=lat,lng  → { options, degraded }
 *        The planner's ways to ride it, best first: route, street-by-street
 *        comfort in Around You's shape, hills, minutes. `options` is empty
 *        when the planner answered without OpenStreetMap (`degraded`), and
 *        the answer is a 502 when it didn't answer; either way the trip
 *        keeps the route it has.
 *   POST { polyline }               → { rating }
 *        A drawn line (the trip re-planned around a street or through a
 *        place) rated by the planner, with its hills; `rating` null when the
 *        planner couldn't.
 *
 * Both answer the app and the website alike. The planner takes 4 to 40 s
 * when a trip is new to it and a fraction of a second after, so callers
 * show the trip first and fill this in when it lands.
 */

export const maxDuration = 60

function parsePoint(raw: string | null): { lat: number; lng: number } | null {
  if (!raw) return null
  const [a, b] = raw.split(',')
  const lat = parseFloat(a)
  const lng = parseFloat(b)
  return inServiceArea(lat, lng) ? { lat, lng } : null
}

const PRIVATE = { 'Cache-Control': 'private, no-store' }

export async function GET(req: NextRequest) {
  const from = parsePoint(req.nextUrl.searchParams.get('from'))
  const to = parsePoint(req.nextUrl.searchParams.get('to'))
  if (!from || !to) {
    return NextResponse.json({ error: 'from and to required as lat,lng in the service area' }, { status: 400 })
  }
  if (!planIsCached(from, to) && !(await planBudgetOk(networkKeyOf(req.headers.get('x-forwarded-for'))))) {
    return NextResponse.json({ error: 'over budget' }, { status: 429, headers: PRIVATE })
  }
  const result = await plannerBikeOptions(from, to)
  if (!result) return NextResponse.json({ error: 'planner did not answer' }, { status: 502, headers: PRIVATE })
  return NextResponse.json(result, { headers: PRIVATE })
}

const MAX_POLYLINE_CHARS = 12_000

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const polyline = typeof body?.polyline === 'string' ? body.polyline : null
  if (!polyline || polyline.length < 4 || polyline.length > MAX_POLYLINE_CHARS) {
    return NextResponse.json({ error: 'polyline required' }, { status: 400 })
  }
  if (!(await rateBudgetOk(networkKeyOf(req.headers.get('x-forwarded-for'))))) {
    return NextResponse.json({ error: 'over budget' }, { status: 429, headers: PRIVATE })
  }
  const rating = await plannerRateLine(polyline)
  return NextResponse.json({ rating }, { headers: PRIVATE })
}
