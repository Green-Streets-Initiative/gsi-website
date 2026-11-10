/**
 * Ride photos: the website's side of the `event-photos` function (Shift
 * supabase/functions/event-photos). The bucket is private and the tables have
 * no policies, so everything goes through the function: every call carries
 * web=1 and the page's preview key, and, once the person has confirmed their
 * email, their contributor token.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const FN = `${SUPABASE_URL}/functions/v1/event-photos`

export type AlbumState = 'none' | 'soon' | 'open' | 'closed'

/**
 * Which album: a calendar event, or one date of a Shift ride reached by its
 * link code (/rides/<code>/photos/<date>; `latest` is its newest date that
 * has started). The code is what lets the web open an invite-only ride's album.
 */
export type AlbumRef = { event: string } | { ride: string; date: string }

export interface AlbumPhoto {
  id: string
  kind: 'photo' | 'video'
  /** The original, signed for a few hours. */
  url: string | null
  /** A 480 square; may be null for a video. */
  thumb_url: string | null
  poster_name: string
  taken_at: string | null
  created_at?: string | null
  duration_s: number | null
  width: number | null
  height: number | null
  status: 'pending' | 'ok' | 'app_only' | 'blocked'
  mine: boolean
  can_remove: boolean
}

export interface AlbumResponse {
  event: { id: string; kind?: 'content' | 'occurrence'; title: string; date: string; organizer_name: string | null; ride_code?: string | null; invite_only?: boolean }
  album: {
    state: AlbumState
    count: number
    people: number
    can_add: boolean
    needs_code: boolean
    starts_at: string
    ends_at: string
    add_closes_at: string | null
    mine_count: number
    max_per_person: number
    max_video_seconds: number
    /**
     * An invite-only Shift ride's date, on the web: "code" until the person
     * confirms their email, "not_on_list" when that email never said Going
     * (or was removed). Photos stay empty; `count` still says how many.
     */
    locked?: 'code' | 'not_on_list' | null
  }
  photos: AlbumPhoto[]
  /** Before a date starts, or while its album is empty: the last date with photos. */
  last_ride?: { event_id: string; date: string; count: number; photos: { id: string; thumb_url: string | null }[] } | null
  share_url: string | null
}

export interface Guest {
  token: string
  first_name: string
  email: string
}

function headers(token?: string | null): Record<string, string> {
  return {
    apikey: ANON,
    Authorization: `Bearer ${ANON}`,
    'Content-Type': 'application/json',
    ...(token ? { 'x-guest-token': token } : {}),
  }
}

/** The album, or null when the server says there's nothing here (404). */
export async function fetchAlbum(ref: AlbumRef | string, preview: string, token?: string | null): Promise<AlbumResponse | null> {
  const r: AlbumRef = typeof ref === 'string' ? { event: ref } : ref
  const q = new URLSearchParams({ ...r, web: '1', preview })
  const res = await fetch(`${FN}?${q}`, { headers: headers(token), cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`event-photos ${res.status}`)
  return (await res.json()) as AlbumResponse
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message)
  }
}

const FALLBACK = 'Something went wrong. Try again in a minute.'

/** A POST to the function; a non-2xx answer throws its plain `message`. */
export async function post<T>(body: Record<string, unknown>, token?: string | null): Promise<T> {
  let res: Response
  try {
    res = await fetch(FN, { method: 'POST', headers: headers(token), body: JSON.stringify(body) })
  } catch {
    throw new ApiError('network', 'Check your connection and try again.', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(String(data?.error ?? 'error'), String(data?.message ?? FALLBACK), res.status)
  return data as T
}

// ---- The contributor token, kept in this browser only ----

const STORE_KEY = 'gsi-event-photos-guest'

export function readGuest(): Guest | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const g = JSON.parse(raw) as Partial<Guest>
    return g.token ? { token: g.token, first_name: g.first_name ?? '', email: g.email ?? '' } : null
  } catch {
    return null
  }
}

export function writeGuest(g: Guest | null) {
  try {
    if (g) localStorage.setItem(STORE_KEY, JSON.stringify(g))
    else localStorage.removeItem(STORE_KEY)
  } catch { /* private mode: they'll confirm again next time */ }
}

// ---- Words ----

/** "Sat, Oct 31" from YYYY-MM-DD. */
export function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** "Nov 7" for an instant, in Boston. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
}

/** "12:18 PM" for an instant, in Boston. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
}

/** "38 photos and videos from 12 people". */
export function countLine(photos: AlbumPhoto[], people: number): string {
  const n = photos.length
  const videos = photos.filter((p) => p.kind === 'video').length
  const noun = videos === 0 ? (n === 1 ? 'photo' : 'photos') : videos === n ? (n === 1 ? 'video' : 'videos') : 'photos and videos'
  return `${n} ${noun} from ${people} ${people === 1 ? 'person' : 'people'}`
}

/** "0:12" from seconds. */
export function duration(s: number | null): string {
  if (s == null || !Number.isFinite(s)) return ''
  const t = Math.round(s)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

/** A file name for one saved photo or video, from its URL's own extension. */
export function fileName(p: AlbumPhoto, i: number): string {
  let ext = p.kind === 'video' ? 'mp4' : 'jpg'
  try {
    const m = new URL(p.url ?? '').pathname.match(/\.([a-z0-9]{2,5})$/i)
    if (m) ext = m[1].toLowerCase()
  } catch { /* keep the default */ }
  return `ride-${p.kind}-${String(i + 1).padStart(2, '0')}.${ext}`
}
