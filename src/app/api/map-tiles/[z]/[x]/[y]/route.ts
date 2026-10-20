import { rasterTileUrl } from '@/lib/nearby/static-map'
import { parseTileCoords } from '@/lib/map/tile-coords'

/**
 * Cached raster basemap tiles for the Shift app's monthly share picture,
 * which lays its own 256px Web Mercator grid under a navy overlay and the
 * person's walking and biking lines. A distributed app may not call
 * tile.openstreetmap.org directly (OSM tile policy), so it calls here and
 * Vercel's edge serves repeats for a month.
 *
 * Source follows rasterTileUrl(): CARTO light (512px @2x tiles) once
 * NEXT_PUBLIC_CARTO_BASEMAP_KEY is set, standard OSM (256px) until then.
 * Credit: GET /api/map-tiles/attribution.
 */

const TILE_UA = 'GreenStreetsInitiative-Website/1.0 (+https://www.gogreenstreets.org; info@gogreenstreets.org)'

const CACHE_OK = 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z: zRaw, x: xRaw, y: yRaw } = await params
  const coords = parseTileCoords(zRaw, xRaw, yRaw)
  if (!coords) {
    return new Response('Bad tile coordinates', { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const upstream = await fetch(rasterTileUrl('light', coords.z, coords.x, coords.y), {
      headers: { 'User-Agent': TILE_UA, Accept: 'image/png' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    const type = upstream.headers.get('content-type') ?? ''
    if (!upstream.ok || !type.startsWith('image/')) throw new Error(`tile ${upstream.status} ${type}`)
    const body = await upstream.arrayBuffer()
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': type, 'Cache-Control': CACHE_OK },
    })
  } catch (err) {
    console.error('[map-tiles]', coords, err instanceof Error ? err.message : err)
    return new Response('Tile unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
