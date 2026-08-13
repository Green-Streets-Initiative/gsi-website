import { NextRequest, NextResponse } from 'next/server'
import { getCorridorMeta } from '@/lib/server/corridor-meta'

/**
 * Thin HTTP wrapper over the shared corridor-meta lib (see
 * src/lib/server/corridor-meta.ts — also consumed directly by the
 * /nearby/print server component) so both surfaces hit one set of
 * cross-visitor MBTA caches instead of a route HTTP-calling its own origin.
 */

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const routeId = (searchParams.get('route') || '').slice(0, 40)
  const stopId = (searchParams.get('stop') || '').slice(0, 40)
  if (!routeId || !stopId || !/^[\w.-]+$/.test(routeId) || !/^[\w.-]+$/.test(stopId)) {
    return NextResponse.json({ error: 'route and stop required' }, { status: 400 })
  }

  const meta = await getCorridorMeta(routeId, stopId)

  return NextResponse.json(meta, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=3600' },
  })
}
