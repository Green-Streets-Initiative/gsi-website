import { NextResponse } from 'next/server'
import {
  mapboxToken, parseTileCoord, trafficTileUpstreamUrl,
  TRAFFIC_TILE_CACHE_CONTROL, TRAFFIC_TILE_CONTENT_TYPE,
} from '@/lib/server/traffic-tiles'

/**
 * GET /api/nearby/traffic/{z}/{x}/{y}
 *
 * Same-origin proxy for Mapbox's live traffic vector tiles, so the /nearby
 * map can draw current congestion without the Mapbox token ever reaching
 * the browser (see src/lib/server/traffic-tiles.ts).
 *
 * Contract:
 *   200  application/vnd.mapbox-vector-tile — the tile bytes, cached 2 min
 *        (public, max-age=120, s-maxage=120, stale-while-revalidate=300)
 *   204  no body — MAPBOX_ACCESS_TOKEN is unset on this deployment; the map
 *        shows no traffic and nothing else changes
 *   400  z outside 6..16, or x/y not integers inside the 2^z grid
 *   502  Mapbox answered with an error (short-cached so a blip is not pinned)
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_TOKEN_HEADERS = { 'Cache-Control': TRAFFIC_TILE_CACHE_CONTROL }

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z, x, y } = await params
  const coord = parseTileCoord(z, x, y)
  if (!coord) {
    return NextResponse.json({ error: 'z must be 6..16 and x/y integers within the tile grid' }, { status: 400 })
  }

  const token = mapboxToken()
  if (!token) return new Response(null, { status: 204, headers: NO_TOKEN_HEADERS })

  let upstream: Response
  try {
    upstream = await fetch(trafficTileUpstreamUrl(coord, token), {
      headers: { Accept: TRAFFIC_TILE_CONTENT_TYPE },
      cache: 'no-store',
    })
  } catch {
    return new Response(null, { status: 502, headers: { 'Cache-Control': 'public, max-age=30' } })
  }

  // Mapbox returns 204 for tiles with no traffic data at all — pass it
  // through as-is so MapLibre treats it as an empty tile.
  if (upstream.status === 204) return new Response(null, { status: 204, headers: NO_TOKEN_HEADERS })
  if (!upstream.ok) {
    return new Response(null, { status: 502, headers: { 'Cache-Control': 'public, max-age=30' } })
  }

  // fetch() has already inflated the body — do not forward Mapbox's
  // Content-Encoding, or the browser would try to gunzip plain bytes.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': TRAFFIC_TILE_CONTENT_TYPE,
      'Cache-Control': TRAFFIC_TILE_CACHE_CONTROL,
    },
  })
}
