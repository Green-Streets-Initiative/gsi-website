import { NextRequest, NextResponse } from 'next/server'
import { resolveUnsplashPhoto } from '@/lib/unsplash'
import {
  resolveNearbyPhoto, isValidPlacePhotoName, fetchPlacePhotoStream, type PhotoKind,
} from '@/lib/server/nearby-photos'

/**
 * Corridor/station photos for the /nearby snapshot, four modes:
 *
 *  ?resolve=1&name=&kind=&lat=&lng=  → JSON { url, attribution, attributionUrl, source }
 *    The recognizable-photo pipeline (Wikipedia lead image → Google Places
 *    + vision pick → 404). Resolution persists per location in Supabase, so
 *    each place is resolved once, ever. 404 = client falls back to Street
 *    View or no photo.
 *
 *  ?placephoto=<resource>    → streams a Google Places photo JPEG
 *    Serves photos the pipeline picked. Keyed media URL stays server-side.
 *
 *  ?unsplash=<photoId>       → JSON { url, attribution, attributionUrl }
 *    Curated beauty shot resolved through the existing unsplash-proxy
 *    (same mechanism Roams use). Unsplash requires visible attribution.
 *
 *  ?lat=&lng=[&heading=]     → streams a Street View JPEG of that spot
 *    Last resort: eye-level photo at the access point, facing along the
 *    corridor. Street View shoots from the road, so paths/stations often
 *    get a photo of the nearest street — hence the pipeline above.
 *
 * Google keys stay server-side (see the 2026-06-02 key incident); never
 * expose them in a client-visible URL.
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

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  // Recognizable-photo pipeline mode
  if (searchParams.get('resolve')) {
    const name = (searchParams.get('name') ?? '').trim().replace(/\s+/g, ' ')
    const kind = searchParams.get('kind') as PhotoKind
    const rlat = parseFloat(searchParams.get('lat') || '')
    const rlng = parseFloat(searchParams.get('lng') || '')
    if (
      name.length < 2 || name.length > 80 ||
      !['station', 'bike', 'line'].includes(kind) ||
      !Number.isFinite(rlat) || !Number.isFinite(rlng) || rlat < 40 || rlat > 44 || rlng < -75 || rlng > -69
    ) {
      return NextResponse.json({ error: 'name, kind, lat, lng required' }, { status: 400 })
    }
    const photo = await resolveNearbyPhoto(name, kind, rlat, rlng)
    if (!photo) return NextResponse.json({ error: 'no photo' }, { status: 404 })
    return NextResponse.json(photo, {
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' },
    })
  }

  // Places photo streaming mode (photos the pipeline picked)
  const placePhoto = searchParams.get('placephoto')
  if (placePhoto) {
    if (!isValidPlacePhotoName(placePhoto)) {
      return NextResponse.json({ error: 'invalid photo reference' }, { status: 400 })
    }
    const img = await fetchPlacePhotoStream(placePhoto)
    if (!img) return new NextResponse(null, { status: 404 })
    return new NextResponse(img.body, {
      headers: {
        'Content-Type': img.headers.get('Content-Type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=604800, s-maxage=2592000, immutable',
      },
    })
  }

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
