import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { haversineMeters } from '@/lib/server/bike-network'

/**
 * Recognizable-photo pipeline for /nearby stations and corridors.
 *
 * Tier 1 — Wikipedia: every MBTA station (and the major paths/lines) has an
 * article whose lead image volunteer editors already curated to be THE
 * recognizable shot. Free, needs attribution, works without any AI key.
 *
 * Tier 2 — Google Places: community photos, ~10 per place, but photo #1 is
 * popularity-sorted (a Halloween skeleton once outranked the Community
 * Path). Only usable behind a vision-model pick, so this tier activates
 * only when ANTHROPIC_API_KEY is set.
 *
 * A one-image vision sanity check also runs on the Wikipedia pick when the
 * key is present (guards against route-map diagrams); without the key the
 * Wikipedia pick is accepted as-is.
 *
 * Results persist per location in the `nearby_photos` table (service-role
 * only), so each location is resolved once, ever. "Nothing found" persists
 * too and retries after 30 days — but never when the pipeline was degraded
 * (vision unavailable), so adding the key later lights up the Places tier
 * without stale negatives blocking it.
 */

export type PhotoKind = 'station' | 'bike' | 'line'

export interface ResolvedPhoto {
  url: string
  attribution: string | null
  attributionUrl: string | null
  source: 'wikipedia' | 'places'
}

const NONE_RETRY_MS = 30 * 24 * 60 * 60 * 1000
const MEMO_TTL_MS = 60 * 60 * 1000
const GEO_MATCH_METERS = 30_000
const VISION_MODEL = 'claude-opus-5'

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_ROUTES_API_KEY || ''
const WIKI_UA = 'gsi-website-nearby/1.0 (https://gogreenstreets.org; photo resolver)'

const KIND_DESCRIPTION: Record<PhotoKind, string> = {
  station: 'an MBTA transit station',
  bike: 'a bike path / cycling corridor',
  line: 'an MBTA transit line (a clear photo of its train, or of a station it serves, qualifies)',
}

/* ── Small in-memory layers: burst dedupe + non-persisted nulls ── */

const memo = new Map<string, { result: ResolvedPhoto | null; expires: number }>()
const inflight = new Map<string, Promise<ResolvedPhoto | null>>()

function photoKey(name: string, kind: PhotoKind, lat: number, lng: number): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  // 1-decimal cells (~11 km): same-named streets in different towns split,
  // while a long corridor viewed from nearby spots still shares a row
  return `${kind}:${slug}:${Math.round(lat * 10) / 10},${Math.round(lng * 10) / 10}`
}

export async function resolveNearbyPhoto(
  name: string,
  kind: PhotoKind,
  lat: number,
  lng: number,
): Promise<ResolvedPhoto | null> {
  const key = photoKey(name, kind, lat, lng)

  const cached = memo.get(key)
  if (cached && cached.expires > Date.now()) return cached.result

  const running = inflight.get(key)
  if (running) return running

  const promise = resolveUncached(key, name, kind, lat, lng)
    .catch(() => null)
    .finally(() => inflight.delete(key))
  inflight.set(key, promise)
  return promise
}

async function resolveUncached(
  key: string,
  name: string,
  kind: PhotoKind,
  lat: number,
  lng: number,
): Promise<ResolvedPhoto | null> {
  const supabase = createServerSupabaseClient()

  const { data: row } = await supabase
    .from('nearby_photos')
    .select('source, url, attribution, attribution_url, resolved_at')
    .eq('key', key)
    .maybeSingle()

  if (row) {
    if (row.source !== 'none') {
      const result: ResolvedPhoto = {
        url: row.url,
        attribution: row.attribution,
        attributionUrl: row.attribution_url,
        source: row.source,
      }
      memo.set(key, { result, expires: Date.now() + MEMO_TTL_MS })
      return result
    }
    if (Date.now() - new Date(row.resolved_at).getTime() < NONE_RETRY_MS) {
      memo.set(key, { result: null, expires: Date.now() + MEMO_TTL_MS })
      return null
    }
    // stale "none" — fall through and re-run the pipeline
  }

  let visionDegraded = false

  // ── Tier 1: Wikipedia ──
  const wiki = await tryWikipedia(name, kind, lat, lng)
  if (wiki) {
    let accept = true
    let verified = false
    const img = await fetchImageBase64(wiki.verifyUrl, WIKI_UA)
    if (img) {
      const pick = await pickBestPhoto(name, KIND_DESCRIPTION[kind], [img])
      if (pick === 'unavailable') visionDegraded = true
      else {
        accept = pick === 0
        verified = true
      }
    }
    if (accept) {
      const result: ResolvedPhoto = {
        url: wiki.url,
        attribution: wiki.attribution,
        attributionUrl: wiki.attributionUrl,
        source: 'wikipedia',
      }
      await persist(supabase, key, name, kind, result, null, { article: wiki.article, verified })
      memo.set(key, { result, expires: Date.now() + MEMO_TTL_MS })
      return result
    }
  }

  // ── Tier 2: Google Places (needs the vision pick — unsafe without it) ──
  const places = await tryPlaces(name, kind, lat, lng)
  if (places === 'unavailable') {
    visionDegraded = true
  } else if (places) {
    const result: ResolvedPhoto = {
      url: places.url,
      attribution: places.attribution,
      attributionUrl: places.attributionUrl,
      source: 'places',
    }
    await persist(supabase, key, name, kind, result, places.photoName, places.meta)
    memo.set(key, { result, expires: Date.now() + MEMO_TTL_MS })
    return result
  }

  // ── Nothing usable ──
  if (!visionDegraded) {
    await supabase.from('nearby_photos').upsert({
      key, name, kind, source: 'none', url: null,
      attribution: null, attribution_url: null, place_photo_name: null,
      meta: {}, resolved_at: new Date().toISOString(),
    })
  }
  memo.set(key, { result: null, expires: Date.now() + MEMO_TTL_MS })
  return null
}

async function persist(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  key: string,
  name: string,
  kind: PhotoKind,
  result: ResolvedPhoto,
  photoName: string | null,
  meta: Record<string, unknown>,
) {
  await supabase.from('nearby_photos').upsert({
    key, name, kind,
    source: result.source,
    url: result.url,
    attribution: result.attribution,
    attribution_url: result.attributionUrl,
    place_photo_name: photoName,
    meta,
    resolved_at: new Date().toISOString(),
  })
}

/* ── Tier 1: Wikipedia ── */

interface WikiCandidate {
  url: string
  verifyUrl: string
  attribution: string
  attributionUrl: string
  article: string
}

function titleVariants(name: string, kind: PhotoKind): string[] {
  if (kind === 'station') return [`${name} station`, name]
  if (kind === 'line') return [`${name} (MBTA)`, `${name} branch`, name]
  return [name, `${name} (Massachusetts)`]
}

interface WikiSummary {
  type?: string
  title?: string
  description?: string
  extract?: string
  coordinates?: { lat: number; lon: number }
  originalimage?: { source: string; width: number; height: number }
}

async function tryWikipedia(
  name: string,
  kind: PhotoKind,
  lat: number,
  lng: number,
): Promise<WikiCandidate | null> {
  for (const title of titleVariants(name, kind)) {
    let summary: WikiSummary | null = null
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
        { headers: { 'User-Agent': WIKI_UA, Accept: 'application/json' }, signal: AbortSignal.timeout(6000) }
      )
      if (!res.ok) continue
      summary = await res.json()
    } catch {
      continue
    }
    if (!summary || summary.type !== 'standard' || !summary.originalimage?.source) continue

    // SVGs are route maps / logos, never photos
    const source = summary.originalimage.source.split('?')[0]
    if (/\.svg$/i.test(source)) continue

    // The right name in the wrong state is the classic failure — require
    // either nearby coordinates or an explicit Massachusetts/Boston mention
    const geoOk = summary.coordinates
      ? haversineMeters(lat, lng, summary.coordinates.lat, summary.coordinates.lon) < GEO_MATCH_METERS
      : /Massachusetts|Boston/i.test(`${summary.description ?? ''} ${summary.extract ?? ''}`)
    if (!geoOk) continue

    const fileTitle = wikiFileTitle(source)
    const { attribution, attributionUrl } = await commonsAttribution(fileTitle)
    return {
      url: wikiThumbUrl(source, Math.min(1280, summary.originalimage.width)),
      verifyUrl: wikiThumbUrl(source, Math.min(640, summary.originalimage.width)),
      attribution,
      attributionUrl,
      article: summary.title ?? title,
    }
  }
  return null
}

/** Canonical File: name from an upload.wikimedia.org URL (thumb or original). */
function wikiFileTitle(source: string): string {
  const segments = source.split('?')[0].split('/')
  const thumbIdx = segments.indexOf('thumb')
  const raw = thumbIdx >= 0 ? segments[thumbIdx + 3] : segments[segments.length - 1]
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** Sized thumb URL; falls back to the original when it's already small. */
function wikiThumbUrl(source: string, width: number): string {
  const clean = source.split('?')[0]
  const thumbMatch = clean.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+)\/thumb\/(.+?)\/\d+px-([^/]+)$/)
  if (thumbMatch) return `${thumbMatch[1]}/thumb/${thumbMatch[2]}/${width}px-${thumbMatch[3]}`
  const plainMatch = clean.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+)\/(.+)\/([^/]+)$/)
  if (plainMatch) return `${plainMatch[1]}/thumb/${plainMatch[2]}/${plainMatch[3]}/${width}px-${plainMatch[3]}`
  return clean
}

async function commonsAttribution(fileTitle: string): Promise<{ attribution: string; attributionUrl: string }> {
  const attributionUrl = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileTitle)}`
  try {
    const res = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${fileTitle}`)}&prop=imageinfo&iiprop=extmetadata&format=json&formatversion=2`,
      { headers: { 'User-Agent': WIKI_UA }, signal: AbortSignal.timeout(6000) }
    )
    const data = await res.json()
    const meta = data?.query?.pages?.[0]?.imageinfo?.[0]?.extmetadata
    const artist = (meta?.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim()
    const license = (meta?.LicenseShortName?.value ?? '').trim()
    if (artist) {
      return { attribution: `Photo: ${artist} / Wikimedia Commons${license ? ` (${license})` : ''}`, attributionUrl }
    }
  } catch { /* generic attribution below */ }
  return { attribution: 'Photo via Wikimedia Commons', attributionUrl }
}

/* ── Tier 2: Google Places + vision pick ── */

interface PlacesResult {
  url: string
  attribution: string | null
  attributionUrl: string | null
  photoName: string
  meta: Record<string, unknown>
}

async function tryPlaces(
  name: string,
  kind: PhotoKind,
  lat: number,
  lng: number,
): Promise<PlacesResult | null | 'unavailable'> {
  if (!process.env.ANTHROPIC_API_KEY) return 'unavailable'
  if (!GOOGLE_KEY) return null

  interface PlacePhoto {
    name: string
    authorAttributions?: { displayName?: string; uri?: string }[]
  }
  let photos: PlacePhoto[] = []
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.photos',
      },
      body: JSON.stringify({
        textQuery: kind === 'station' ? `${name} station MBTA` : name,
        locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 5000 } },
        maxResultCount: 1,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    photos = (data.places?.[0]?.photos ?? []).slice(0, 6)
  } catch {
    return null
  }
  if (photos.length === 0) return null

  // Small renditions for the pick — enough to judge, cheap to send
  const images: VisionImage[] = []
  const imageIndexes: number[] = []
  for (let i = 0; i < photos.length; i++) {
    const img = await fetchPlacePhotoBase64(photos[i].name, 512)
    if (img) {
      images.push(img)
      imageIndexes.push(i)
    }
  }
  if (images.length === 0) return null

  const pick = await pickBestPhoto(name, KIND_DESCRIPTION[kind], images)
  if (pick === 'unavailable') return 'unavailable'
  if (pick < 0 || pick >= images.length) return null

  const chosen = photos[imageIndexes[pick]]
  const author = chosen.authorAttributions?.[0]
  return {
    url: `/api/nearby/corridor-photo?placephoto=${encodeURIComponent(chosen.name)}`,
    attribution: author?.displayName ? `Photo: ${author.displayName} / Google Maps` : 'Photo via Google Maps',
    attributionUrl: author?.uri ?? null,
    photoName: chosen.name,
    meta: { candidates: photos.length, picked: imageIndexes[pick] },
  }
}

async function fetchPlacePhotoBase64(photoName: string, maxWidth: number): Promise<VisionImage | null> {
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_KEY}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    return toVisionImage(await res.arrayBuffer(), res.headers.get('Content-Type'))
  } catch {
    return null
  }
}

/* ── Vision pick (Claude) ── */

interface VisionImage {
  data: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
}

async function fetchImageBase64(url: string, userAgent: string): Promise<VisionImage | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    return toVisionImage(await res.arrayBuffer(), res.headers.get('Content-Type'))
  } catch {
    return null
  }
}

function toVisionImage(buf: ArrayBuffer, contentType: string | null): VisionImage {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
  const mediaType = allowed.find(t => contentType?.startsWith(t)) ?? 'image/jpeg'
  return { data: Buffer.from(buf).toString('base64'), mediaType }
}

const PICK_SCHEMA = {
  type: 'object',
  properties: {
    best_index: {
      type: 'integer',
      description: 'Index of the best photo (0-based), or -1 if none qualify',
    },
    reason: { type: 'string' },
  },
  required: ['best_index', 'reason'],
  additionalProperties: false,
}

let anthropic: Anthropic | null = null

/**
 * Pick the most recognizable photo, or -1 to reject all.
 * Returns 'unavailable' when the vision model can't be reached (no key,
 * rate limit, network) — callers must degrade rather than cache a negative.
 */
async function pickBestPhoto(
  name: string,
  kindDescription: string,
  images: VisionImage[],
): Promise<number | 'unavailable'> {
  if (!process.env.ANTHROPIC_API_KEY) return 'unavailable'
  anthropic ??= new Anthropic()

  try {
    const response = await anthropic.messages.create({
      model: VISION_MODEL,
      max_tokens: 4000,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: PICK_SCHEMA },
      },
      messages: [{
        role: 'user',
        content: [
          ...images.map(img => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: img.mediaType, data: img.data },
          })),
          {
            type: 'text' as const,
            text:
              `You are choosing a photo for a neighborhood transit guide. The photo must help a newcomer RECOGNIZE "${name}" — ${kindDescription} in Greater Boston — on sight: a clear outdoor establishing shot of the place itself. ` +
              `Reject maps, diagrams, logos, screenshots, indoor close-ups, food, selfies or people-focused shots, night shots that obscure the place, seasonal decorations, and photos that are primarily of something else. ` +
              `The ${images.length} photo${images.length === 1 ? ' is' : 's are'} numbered 0 to ${images.length - 1} in order. Return the best index, or -1 if none qualify.`,
          },
        ],
      }],
    })

    if (response.stop_reason === 'refusal') return -1
    const text = response.content.find(b => b.type === 'text')?.text
    if (!text) return -1
    const parsed = JSON.parse(text) as { best_index?: number }
    return typeof parsed.best_index === 'number' ? parsed.best_index : -1
  } catch {
    return 'unavailable'
  }
}

/* ── Places photo byte proxy (used by the API route) ── */

export function isValidPlacePhotoName(name: string): boolean {
  return /^places\/[\w-]+\/photos\/[\w-]+$/.test(name) && name.length < 1000
}

export async function fetchPlacePhotoStream(photoName: string, maxWidth = 1200): Promise<Response | null> {
  if (!GOOGLE_KEY) return null
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_KEY}`,
      { signal: AbortSignal.timeout(10000) }
    )
    return res.ok ? res : null
  } catch {
    return null
  }
}
