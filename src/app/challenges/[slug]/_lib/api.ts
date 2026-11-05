/**
 * Creative challenges: the website's side of the `creative-challenges`
 * function (Shift supabase/functions/creative-challenges). The tables have no
 * policies, so everything goes through the function. Every call carries the
 * page's preview key (while the switch is off) and, once the person has
 * confirmed their email, their person token.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const FN = `${SUPABASE_URL}/functions/v1/creative-challenges`

export type Phase = 'soon' | 'open' | 'judging' | 'voting' | 'counting' | 'results'

export interface PrizeView {
  key: string
  label: string
  amount: string
  amount_cents: number
  category: string | null
}

export interface ChallengeView {
  slug: string
  title: string
  tagline: string
  brief: string[]
  format: 'video_link'
  min_seconds: number | null
  max_seconds: number | null
  categories: { key: string; label: string }[]
  prizes: PrizeView[]
  total_prizes: string
  max_entries_per_person: number
  finalist_count: number
  sponsor_name: string | null
  opens_at: string
  entries_close_at: string
  judging_close_at: string
  voting_close_at: string
  results_at: string
  phase: Phase
  finalists_ready: boolean
  results_ready: boolean
  share_url: string
}

export interface EntryView {
  id: string
  title: string
  says: string
  category: string
  credit_name: string
  platform: 'youtube' | 'vimeo' | 'tiktok'
  link_url: string
  embed_url: string | null
  thumbnail_url: string | null
  duration_s: number | null
  finalist_rank: number | null
  award: string | null
  vote_count: number | null
  share_url: string
  created_at: string
  /** Only on the person's own entries. */
  status?: 'pending' | 'ok' | 'blocked'
  mine?: boolean
}

export interface Me {
  first_name: string
  last_name: string | null
  town: string | null
  email: string
  entries: EntryView[]
  can_enter: boolean
  voted_entry_id: string | null
}

export interface ChallengeResponse {
  challenge: ChallengeView
  entries: EntryView[]
  count: number
  judges: { name: string; affiliation: string | null }[]
  me: Me | null
}

export interface EntryResponse {
  challenge: ChallengeView
  entry: EntryView
  me: { voted_entry_id: string | null } | null
}

export interface Person {
  token: string
  first_name: string
  last_name: string | null
  town: string | null
  email: string
}

function headers(token?: string | null): Record<string, string> {
  return {
    apikey: ANON,
    Authorization: `Bearer ${ANON}`,
    'Content-Type': 'application/json',
    ...(token ? { 'x-person-token': token } : {}),
  }
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message)
  }
}

const FALLBACK = 'Something went wrong. Try again in a minute.'

async function getJson<T>(q: Record<string, string>, token?: string | null, init?: RequestInit): Promise<T | null> {
  const res = await fetch(`${FN}?${new URLSearchParams(q)}`, { headers: headers(token), cache: 'no-store', ...init })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`creative-challenges ${res.status}`)
  return (await res.json()) as T
}

/** The challenge page's data, or null when it isn't there for this visitor. */
export function fetchChallenge(slug: string, preview: string, token?: string | null) {
  return getJson<ChallengeResponse>({ slug, ...(preview ? { preview } : {}) }, token)
}

export function fetchEntry(id: string, preview: string, token?: string | null) {
  return getJson<EntryResponse>({ entry: id, ...(preview ? { preview } : {}) }, token)
}

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

// ---- The person token, kept in this browser only ----

const STORE_KEY = 'gsi-creative-person'

export function readPerson(): Person | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<Person>
    return p.token ? { token: p.token, first_name: p.first_name ?? '', last_name: p.last_name ?? null, town: p.town ?? null, email: p.email ?? '' } : null
  } catch {
    return null
  }
}

export function writePerson(p: Person | null) {
  try {
    if (p) localStorage.setItem(STORE_KEY, JSON.stringify(p))
    else localStorage.removeItem(STORE_KEY)
  } catch { /* private mode: they'll confirm again next time */ }
}

/** Signs the person up for the GSI newsletter (the site's own form route). */
export async function joinNewsletter(email: string, firstName: string) {
  try {
    await fetch('/api/newsletter-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, firstName, source: 'creative_challenge' }),
    })
  } catch { /* not worth stopping the entry or the vote for */ }
}

// ---- Words ----

const ET = 'America/New_York'

/** "Sun, Jan 17" */
export function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: ET })
}

/** "Sunday, January 17" */
export function longDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: ET })
}

/** "Sunday, January 17, 2027" */
export function fullDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: ET })
}

/** The last day entries count: entries_close_at is 11:59 PM that night. */
export function lastDay(iso: string): string {
  return shortDay(new Date(new Date(iso).getTime() - 60_000).toISOString())
}

export function withPreview(path: string, preview: string): string {
  if (!preview) return path
  return `${path}${path.includes('?') ? '&' : '?'}preview=${encodeURIComponent(preview)}`
}

export function categoryLabel(c: ChallengeView, key: string): string {
  return c.categories.find((x) => x.key === key)?.label ?? key
}

export function prizeFor(c: ChallengeView, key: string | null): PrizeView | null {
  return key ? c.prizes.find((p) => p.key === key) ?? null : null
}
