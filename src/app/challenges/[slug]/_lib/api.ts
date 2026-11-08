/**
 * Creative challenges: the website's side of the `creative-challenges`
 * function (Shift supabase/functions/creative-challenges). The tables have no
 * policies, so everything goes through the function. Every call carries the
 * page's preview key (while the switch is off) and, once the person has
 * confirmed their email, their person token.
 */
import { siteDate, translator, type SiteLocale } from '@/lib/site-i18n'
import { creativeStrings } from '@/lib/site-strings/challenges'

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
  platform: 'youtube' | 'vimeo' | 'tiktok' | 'upload'
  /** Null for an uploaded file. */
  link_url: string | null
  embed_url: string | null
  /** An uploaded file's short-lived play link (null for links). */
  video_url?: string | null
  video_codec?: string | null
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
//
// `locale` is the page's language (translation plan, batch 5). English is
// the default and reads exactly as before.

const ET = 'America/New_York'

/** "Sun, Jan 17" */
export function shortDay(iso: string, locale: SiteLocale = 'en'): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', timeZone: ET }
  if (locale !== 'en') return siteDate(locale, iso, opts)
  return new Date(iso).toLocaleDateString('en-US', opts)
}

/** "Sunday, January 17" */
export function longDay(iso: string, locale: SiteLocale = 'en'): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', timeZone: ET }
  if (locale !== 'en') return siteDate(locale, iso, opts)
  return new Date(iso).toLocaleDateString('en-US', opts)
}

/** "Sunday, January 17, 2027" */
export function fullDay(iso: string, locale: SiteLocale = 'en'): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: ET }
  if (locale !== 'en') return siteDate(locale, iso, opts)
  return new Date(iso).toLocaleDateString('en-US', opts)
}

/** The last day entries count: entries_close_at is 11:59 PM that night. */
export function lastDay(iso: string, locale: SiteLocale = 'en'): string {
  return shortDay(new Date(new Date(iso).getTime() - 60_000).toISOString(), locale)
}

export function withPreview(path: string, preview: string): string {
  if (!preview) return path
  return `${path}${path.includes('?') ? '&' : '?'}preview=${encodeURIComponent(preview)}`
}

export function categoryLabel(c: ChallengeView, key: string, locale: SiteLocale = 'en'): string {
  if (locale !== 'en' && isKnownCategory(key)) return translator(creativeStrings, locale)(`cat.${key}`)
  return c.categories.find((x) => x.key === key)?.label ?? key
}

/** The three categories the challenges use; any other keeps its database label. */
const KNOWN_CATEGORIES = ['walking', 'biking', 'transit'] as const
function isKnownCategory(key: string): key is (typeof KNOWN_CATEGORIES)[number] {
  return (KNOWN_CATEGORIES as readonly string[]).includes(key)
}

/** "walking, biking or transit", for the rules (a translated page uses its own words). */
export function categoryList(c: ChallengeView, locale: SiteLocale = 'en'): string {
  if (locale === 'en') {
    const cats = c.categories.map((k) => k.label.toLowerCase())
    return cats.length > 1 ? `${cats.slice(0, -1).join(', ')} or ${cats[cats.length - 1]}` : cats[0]
  }
  const t = translator(creativeStrings, locale)
  const cats = c.categories.map((k) => (isKnownCategory(k.key) ? t(`catl.${k.key}`) : k.label.toLowerCase()))
  return cats.length > 1 ? t('list.or', { rest: cats.slice(0, -1).join(t('list.sep')), last: cats[cats.length - 1] }) : cats[0]
}

/**
 * What to show for a failed call. English shows the server's own message,
 * as before. The other languages say the same thing in their words, by the
 * server's error code (creative-challenges/index.ts `fail(...)`); a code not
 * listed here keeps the server's English message.
 */
export function errorText(
  err: unknown,
  locale: SiteLocale,
  fallback: string,
  ctx: { action?: 'code' | 'verify' | 'enter' | 'vote'; maxEntries?: number; source?: 'upload' | 'link'; maxMb?: number } = {},
): string {
  if (!(err instanceof ApiError)) return fallback
  if (locale === 'en') return err.message
  const t = translator(creativeStrings, locale)
  const vote = ctx.action === 'vote'
  switch (err.code) {
    case 'network': return t('err.network')
    case 'error': return t('err.try_minute')
    case 'server_error':
    case 'not_found': return t('err.try_again')
    case 'invalid_email': return t('api.invalid_email')
    case 'slow_down': return t('api.slow_down')
    case 'send_failed': return t('api.send_failed')
    case 'expired': return t('api.expired')
    case 'wrong_code': return t('api.wrong_code')
    case 'name_required': return t('gate.name_required')
    case 'sign_in': return t(vote ? 'api.sign_in_vote' : 'api.sign_in_enter')
    case 'closed': return t(vote ? 'api.closed_vote' : 'api.closed_enter')
    case 'confirm': return t('api.confirm')
    case 'bad_link': return t('api.bad_link')
    case 'title': return t('api.title')
    case 'says': return t('api.says')
    case 'category': return t('api.category')
    case 'last_name': return t('api.last_name')
    case 'town': return t('api.town')
    case 'limit': return ctx.maxEntries ? t('api.limit', { n: ctx.maxEntries }) : err.message
    case 'cant_open': return t(ctx.source === 'upload' ? 'api.cant_open_upload' : 'api.cant_open_link')
    case 'too_long':
    case 'too_short': {
      // "Ads run 30 to 60 seconds. This one is 1:12."
      const m = err.message.match(/(\d+) to (\d+) seconds\. This one is (\d+:\d{2})/)
      return m ? t('api.length', { min: m[1], max: m[2], len: m[3] }) : err.message
    }
    case 'duplicate': return t('api.duplicate')
    case 'blocked': return t('api.blocked')
    case 'bad_type': return t('api.bad_type')
    case 'too_big': return ctx.maxMb ? t('api.too_big', { mb: ctx.maxMb }) : err.message
    case 'not_finalist': return t('api.not_finalist')
    default: return err.message
  }
}

export function prizeFor(c: ChallengeView, key: string | null): PrizeView | null {
  return key ? c.prizes.find((p) => p.key === key) ?? null : null
}
