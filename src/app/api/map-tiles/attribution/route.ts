import { RASTER_TILE_ATTRIBUTION } from '@/lib/nearby/static-map'

/** The credit line for /api/map-tiles tiles; it changes when the CARTO key
 *  is set, so the app reads it rather than hard-coding one source. */
export function GET() {
  return Response.json(
    { attribution: RASTER_TILE_ATTRIBUTION },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  )
}
