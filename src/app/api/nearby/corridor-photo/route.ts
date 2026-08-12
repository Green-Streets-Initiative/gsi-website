import { NextRequest, NextResponse } from 'next/server'
import { resolveUnsplashPhoto } from '@/lib/unsplash'

/**
 * Corridor/station photos for the /nearby snapshot, two modes:
 *
 *  ?unsplash=<photoId>       → JSON { url, attribution, attributionUrl }
 *    Curated beauty shot resolved through the existing unsplash-proxy
 *    (same mechanism Roams use). Unsplash requires visible attribution.
 *
 *  ?lat=&lng=[&heading=]     → streams a Street View JPEG of that spot
 *    The default: an eye-level photo of the actual infrastructure at the
 *    corridor's access point, facing along it. Requires the Street View
 *    Static API to be enabled on the Google Cloud project — until then the
 *    metadata check returns REQUEST_DENIED and this responds 404, which the
 *    client treats as "no photo" (image simply doesn't render).
 *
 * The Google key stays server-side (it's unrestricted — see the 2026-06-02
 * key incident); never expose it in a client-visible URL.
 */

// Places key first: the Routes key carries an API-restrictions list that
// does NOT include Street View Static (verified 2026-08-12 — its metadata
// calls return REQUEST_DENIED while the Places key returns OK). Same
// fallback order the /api/places/* routes use.
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_ROUTES_API_KEY || ''

const META_OK_TTL = 7 * 24 * 60 * 60 * 1000
const META_MISS_TTL = 10 * 60 * 1000 // short: recovers quickly once the API is enabled
const metaCache = new Map<string, { ok: boolean; expires: number }>()

const round4 = (n: number) => Math.round(n * 10000) / 10000

export const maxDuration = 15

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  // Curated Unsplash mode
  const unsplashId = searchParams.get('unsplash')
  if (unsplashId) {
    if (!/^[\w-]{5,40}$/.test(unsplashId)) {
      return NextResponse.json({ error: 'invalid photo id' }, { status: 400 })
    }
    const photo = await resolveUnsplashPhoto(unsplashId)
    if (!photo) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(photo, {
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' },
    })
  }

  // Street View mode
  const lat = parseFloat(searchParams.get('lat') || '')
  const lng = parseFloat(searchParams.get('lng') || '')
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 40 || lat > 44 || lng < -75 || lng > -69) {
    return NextResponse.json({ error: 'valid lat and lng required' }, { status: 400 })
  }
  const heading = parseFloat(searchParams.get('heading') || '')

  if (!GOOGLE_KEY) return new NextResponse(null, { status: 404 })

  const lat4 = round4(lat)
  const lng4 = round4(lng)
  const metaKey = `${lat4},${lng4}`
  let meta = metaCache.get(metaKey)
  if (!meta || meta.expires <= Date.now()) {
    try {
      // radius: default pano search is ~50m; station platforms and path
      // midpoints often sit farther than that from the nearest street
      // imagery — 150m snaps to the closest block instead of missing
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat4},${lng4}&radius=150&source=outdoor&key=${GOOGLE_KEY}`,
        { signal: AbortSignal.timeout(6000) }
      )
      const data = await res.json()
      const ok = data.status === 'OK'
      meta = { ok, expires: Date.now() + (ok ? META_OK_TTL : META_MISS_TTL) }
    } catch {
      meta = { ok: false, expires: Date.now() + META_MISS_TTL }
    }
    if (metaCache.size > 2000) {
      const oldest = metaCache.keys().next().value
      if (oldest) metaCache.delete(oldest)
    }
    metaCache.set(metaKey, meta)
  }
  if (!meta.ok) return new NextResponse(null, { status: 404 })

  const params = new URLSearchParams({
    size: '640x360',
    location: `${lat4},${lng4}`,
    radius: '150',
    fov: '80',
    source: 'outdoor',
    key: GOOGLE_KEY,
  })
  if (Number.isFinite(heading)) params.set('heading', String(Math.round(heading)))

  try {
    const img = await fetch(`https://maps.googleapis.com/maps/api/streetview?${params}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!img.ok) return new NextResponse(null, { status: 404 })
    return new NextResponse(img.body, {
      headers: {
        'Content-Type': img.headers.get('Content-Type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=604800, s-maxage=2592000, immutable',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
