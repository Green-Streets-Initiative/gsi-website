/**
 * The calm bike route for a commute, ported from the Shift app so the
 * website and the app describe the same ride the same way:
 *  - the call: supabase/functions/plan-ride-route (pins, mode bike, relaxed pace)
 *  - the ranking: app/(details)/ride-preview.tsx (calm-first within a
 *    reasonable detour of the quickest; a busier route only when it saves time)
 *  - the words: lib/concern-copy.ts (which concerns matter, the verdict
 *    sentence, the per-spot advice) with the app's English strings inline
 *  - the comfort maths: lib/comfort.ts (comfortable share, protected share)
 *
 * Pure functions apart from fetchCalmRoute. Keep the constants in step with
 * the app: CALM_DETOUR_RATIO / CALM_DETOUR_MINUTES / FASTER_BY_MINUTES.
 *
 * Words: English by default (the organizer console, rides and the
 * assistants call these with no locale). The Commute Advisor passes its
 * page's language; the translations live in src/lib/site-strings/advisor.ts
 * (calm.*) and follow the app's ride preview.
 */

import { translator, type SiteLocale } from '@/lib/site-i18n'
import { advisorStrings } from '@/lib/site-strings/advisor'
import { COMFORT_COLORS as SHARED_COMFORT_COLORS, COMFORT_COLORS_LIGHT } from '@/lib/comfort-colors'

const tr = (locale: SiteLocale) => translator(advisorStrings, locale)

export interface CrashDetail {
  count: number
  severe: number
  injury: number
  type: 'bicycle' | 'pedestrian'
  period: string
  streets: string[]
  meets: 'crossing_separated' | 'crossing' | 'along'
}

export interface CalmFlag {
  type: 'concern' | 'positive'
  description: string
  lat?: number
  lng?: number
  kind?: string
  crash?: CrashDetail
}

export interface CalmSegment {
  label: string
  rating: string
  distance_mi: number
  startIdx?: number
  endIdx?: number
  /** Datasets that decided this segment's rating (massdot, mapc, osm, none); newer planner answers only. */
  sources?: string[]
}

export interface CalmOption {
  score: number
  distanceMiles: number
  durationMinutes: number
  summary: string
  waypoints: { lat: number; lng: number }[]
  viaWaypoints: { lat: number; lng: number }[]
  flags: CalmFlag[]
  comfort_segments: CalmSegment[]
  comfort_rating: string
  comfort_summary: string
}

/** Lanes the route rides that MassDOT says opened in the last six months
 *  (plan-ride-route's new_facility notes): "New protected bike lane on
 *  Cummins Hwy (opened Aug 2026)". */
export function newLaneNotes(flags: CalmFlag[] | null | undefined): string[] {
  return (flags ?? []).filter((f) => f.type === 'positive' && f.kind === 'new_facility').map((f) => f.description)
}

export interface SafetyVerdict {
  tone: 'none' | 'ok' | 'shared'
  text: string
}

export interface CalmRoute {
  /** The route to lead with: the calmest within a reasonable detour of the quickest. */
  calm: CalmOption
  /** The quickest of every option the planner returned. */
  fastest: CalmOption
  /** Minutes the calm route adds over the quickest (0 when it is the quickest). */
  slowerBy: number
  /** The concerns worth a rider's attention on the calm route, one per place. */
  concerns: CalmFlag[]
  verdict: SafetyVerdict
  /** Share of the calm route on paths, lanes or quiet streets, 0–100. */
  comfortablePct: number
}

/** Same rule as the app's ride preview and mode-discovery suggestions. */
export const CALM_DETOUR_RATIO = 1.5
export const CALM_DETOUR_MINUTES = 8
/** A less calm route is offered only if it is at least this much faster. */
export const FASTER_BY_MINUTES = 2
/** Scoring weights for a newcomer: favor quiet streets. */
export const CALM_PACE = 'relaxed'
const OPTION_SLOTS = 3
/** Crossings in traffic below this many crashes are not worth a flag. */
const CROSSING_MIN_CRASHES = 10
/** Below this share on paths, lanes or quiet streets the verdict changes tone. */
export const COMFORTABLE_ENOUGH_PCT = 60
/** ~60 m: two flags this close, of the same kind, are one thing on the ground. */
const SAME_SPOT_MILES = 0.04

/* ── Comfort maths (lib/comfort.ts) ── */

const COMFORT_ORDER = ['path', 'protected', 'bike_lane', 'quiet_street', 'shared_road'] as const

/** Map and bar colours for the comfort tiers: the shared set
 *  (src/lib/comfort-colors.ts, the app's twin). MAP_ is the darker set for
 *  light street maps and light pages (the organizer console's route review,
 *  route choices, the ride page). */
export const COMFORT_COLORS: Record<string, string> = SHARED_COMFORT_COLORS
export const MAP_COMFORT_COLORS: Record<string, string> = COMFORT_COLORS_LIGHT

export const COMFORT_LABELS: Record<string, string> = {
  path: 'Path',
  protected: 'Protected',
  bike_lane: 'Bike lane',
  quiet_street: 'Quiet street',
  shared_road: 'Shared road',
}

const COMFORT_LABEL_KEYS = {
  path: 'calm.tier_path',
  protected: 'calm.tier_protected',
  bike_lane: 'calm.tier_bike_lane',
  quiet_street: 'calm.tier_quiet_street',
  shared_road: 'calm.tier_shared_road',
} as const

/** COMFORT_LABELS in the page's language; an unknown rating comes back as itself. */
export function comfortLabel(rating: string, locale: SiteLocale = 'en'): string {
  if (locale === 'en') return COMFORT_LABELS[rating] ?? rating
  const key = COMFORT_LABEL_KEYS[rating as keyof typeof COMFORT_LABEL_KEYS]
  return key ? tr(locale)(key) : rating
}

export function comfortBreakdown(segments: CalmSegment[] | null | undefined): { rating: string; miles: number; pct: number }[] {
  if (!segments || segments.length === 0) return []
  const miles: Record<string, number> = {}
  for (const seg of segments) {
    const d = Number(seg.distance_mi) || 0
    if (d <= 0) continue
    miles[seg.rating] = (miles[seg.rating] ?? 0) + d
  }
  const total = Object.values(miles).reduce((a, b) => a + b, 0)
  if (total <= 0) return []
  const known = COMFORT_ORDER.filter((r) => miles[r] > 0) as string[]
  const extra = Object.keys(miles).filter((r) => !(COMFORT_ORDER as readonly string[]).includes(r))
  const ordered = [...known, ...extra]
  const exact = ordered.map((r) => (miles[r] / total) * 100)
  const pcts = exact.map((v) => Math.floor(v))
  let leftover = 100 - pcts.reduce((a, b) => a + b, 0)
  const byRemainder = exact.map((v, i) => ({ i, rem: v - Math.floor(v) })).sort((a, b) => b.rem - a.rem)
  for (let k = 0; leftover > 0 && k < byRemainder.length; k++, leftover--) pcts[byRemainder[k].i] += 1
  return ordered.map((rating, i) => ({ rating, miles: miles[rating], pct: pcts[i] }))
}

/** Share of the route on paths, bike infrastructure or quiet streets (0–1). */
export function comfortableShare(segments: CalmSegment[] | null | undefined): number {
  const buckets = comfortBreakdown(segments)
  if (buckets.length === 0) return 0
  return buckets
    .filter((b) => b.rating === 'path' || b.rating === 'protected' || b.rating === 'bike_lane' || b.rating === 'quiet_street')
    .reduce((sum, b) => sum + b.pct, 0) / 100
}

export function protectedPct(segments: CalmSegment[] | null | undefined): number {
  return comfortBreakdown(segments).find((b) => b.rating === 'protected' || b.rating === 'path')?.pct ?? 0
}

/* ── Ranking (components/RouteOptionDeck.tsx rankOptions + ride-preview) ── */

type Rank = 'calmest' | 'fastest' | 'balanced'

export function rankOptions(options: Pick<CalmOption, 'distanceMiles' | 'durationMinutes' | 'comfort_segments'>[]): Rank[] {
  if (options.length === 0) return []
  let calmest = 0
  let fastest = 0
  for (let i = 1; i < options.length; i++) {
    const share = comfortableShare(options[i].comfort_segments)
    const best = comfortableShare(options[calmest].comfort_segments)
    const prot = protectedPct(options[i].comfort_segments)
    const bestProt = protectedPct(options[calmest].comfort_segments)
    if (
      share > best ||
      (share === best && prot > bestProt) ||
      (share === best && prot === bestProt && options[i].distanceMiles < options[calmest].distanceMiles)
    ) {
      calmest = i
    }
    if (options[i].durationMinutes < options[fastest].durationMinutes) fastest = i
  }
  return options.map((_, i) => (i === calmest ? 'calmest' : i === fastest ? 'fastest' : 'balanced'))
}

/** Lead with the calmest route within a reasonable detour of the quickest. */
export function pickCalmRoute(all: CalmOption[], locale: SiteLocale = 'en'): CalmRoute | null {
  const options = all.slice(0, OPTION_SLOTS).filter((o) => o.waypoints.length >= 2)
  if (options.length === 0) return null
  const quickest = Math.min(...options.map((o) => o.durationMinutes))
  const limit = Math.max(quickest * CALM_DETOUR_RATIO, quickest + CALM_DETOUR_MINUTES)
  const reasonable = options.filter((o) => o.durationMinutes <= limit)
  const ranks = rankOptions(reasonable)
  const calm = reasonable[Math.max(0, ranks.indexOf('calmest'))] ?? options[0]
  const fastest = options.reduce((best, o) => (o.durationMinutes < best.durationMinutes ? o : best), options[0])
  const concerns = relevantConcerns(calm.flags)
  const comfortablePct = Math.round(comfortableShare(calm.comfort_segments) * 100)
  return {
    calm,
    fastest,
    slowerBy: Math.max(0, Math.round(calm.durationMinutes - fastest.durationMinutes)),
    concerns,
    verdict: safetyVerdict(concerns, calm.comfort_segments.length > 0 ? comfortablePct : null, false, locale),
    comfortablePct,
  }
}

/* ── Concern copy (lib/concern-copy.ts) ── */

export function concernMatters(flag: CalmFlag, mode?: 'bike' | 'walk'): boolean {
  if (flag.type !== 'concern') return false
  const c = flag.crash
  // How the group travels (the app's lib/concern-copy, Keith 2026-11-07): a
  // bike ride isn't warned about crossings where pedestrians were hit, nor
  // told a street has no sidewalk; a walk isn't warned about bike crashes.
  if (mode && c && (c.type === 'pedestrian') !== (mode === 'walk')) return false
  if (mode === 'bike' && flag.kind === 'sidewalks') return false
  if (!c) return true
  if (c.meets === 'along') return true
  if (c.severe >= 1) return true
  if (c.meets === 'crossing') return c.count >= CROSSING_MIN_CRASHES
  return false
}

function nearEachOther(a: CalmFlag, b: CalmFlag): boolean {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return false
  const cos = Math.cos((a.lat * Math.PI) / 180)
  const dLat = (a.lat - b.lat) * 69
  const dLng = (a.lng - b.lng) * 69 * cos
  return dLat * dLat + dLng * dLng < SAME_SPOT_MILES * SAME_SPOT_MILES
}

function sameConcern(a: CalmFlag, b: CalmFlag): boolean {
  if ((a.kind ?? '') !== (b.kind ?? '')) return false
  if (nearEachOther(a, b)) return true
  if (a.lat == null || b.lat == null) return a.description === b.description
  if (a.kind === 'wrong_way') {
    const street = (f: CalmFlag) => /on (.+?) for \d/.exec(f.description)?.[1] ?? null
    const s = street(a)
    return !!s && s === street(b)
  }
  return false
}

function stronger(a: CalmFlag, b: CalmFlag): CalmFlag {
  const ca = a.crash
  const cb = b.crash
  if (!ca || !cb) return a
  if ((ca.meets === 'along') !== (cb.meets === 'along')) return ca.meets === 'along' ? a : b
  if (ca.severe !== cb.severe) return ca.severe > cb.severe ? a : b
  return ca.count >= cb.count ? a : b
}

/** The concerns worth a rider's attention on this route, one per place. */
export function relevantConcerns(flags: CalmFlag[] | null | undefined, mode?: 'bike' | 'walk'): CalmFlag[] {
  const out: CalmFlag[] = []
  for (const f of flags ?? []) {
    if (!concernMatters(f, mode)) continue
    const i = out.findIndex((o) => sameConcern(o, f))
    if (i < 0) out.push(f)
    else out[i] = stronger(out[i], f)
  }
  return out
}

/**
 * Headline for one concern: the place, not the body count. A text-only
 * flag's description is the planner's own (English) words.
 * `locale` also accepts the index `.map(concernTitle)` passes, read as English.
 */
export function concernTitle(flag: CalmFlag, locale: SiteLocale | number = 'en'): string {
  const c = flag.crash
  if (!c) return flag.description
  const t = tr(typeof locale === 'string' ? locale : 'en')
  const streets = c.streets.length > 0 ? c.streets.join(' & ') : null
  if (c.meets === 'along') return streets ? t('calm.concern_along', { street: c.streets[0] }) : t('calm.concern_along_unnamed')
  return streets ? t('calm.concern_crossing', { streets }) : t('calm.concern_crossing_unnamed')
}

/** What to do about it, one line; empty for text-only flags with no advice. */
export function concernAdvice(flag: CalmFlag, walk = false, locale: SiteLocale = 'en'): string | null {
  const c = flag.crash
  const t = tr(locale)
  if (walk) {
    // On foot: the same spots, said for someone walking (organizer walks, Shift 01660).
    if (c?.meets === 'crossing_separated') return t('calm.advice_walk_crossing_separated')
    if (c) return c.meets === 'crossing'
      ? t('calm.advice_walk_crossing')
      : t('calm.advice_walk_along')
    if (flag.kind === 'steep') return t('calm.advice_walk_steep')
    return null
  }
  if (c) {
    if (c.meets === 'crossing_separated') return t('calm.advice_crossing_separated')
    if (c.meets === 'crossing') return t('calm.advice_crossing')
    return t('calm.advice_along')
  }
  if (flag.kind === 'steep') return t('calm.advice_steep')
  if (flag.kind === 'wrong_way') return t('calm.advice_wrong_way')
  return null
}

type CalmKey = Parameters<ReturnType<typeof tr>>[0]

/** One of a pair of keys (`<base>_one` / `<base>_other`) by count, {n} filled. */
const plural = (t: ReturnType<typeof tr>, n: number, one: CalmKey, other: CalmKey) => t(n === 1 ? one : other, { n })

/** The "so what" for a whole route, from the same list the map markers use. */
export function safetyVerdict(concerns: CalmFlag[], comfortablePct: number | null, walk = false, locale: SiteLocale = 'en'): SafetyVerdict {
  const t = tr(locale)
  if (comfortablePct != null && comfortablePct < COMFORTABLE_ENOUGH_PCT) {
    return { tone: 'shared', text: t('calm.verdict_shared') }
  }
  const list = concerns.filter((f) => f.type === 'concern')
  if (list.length === 0) return { tone: 'none', text: t('calm.verdict_none') }

  const isCrash = (f: CalmFlag) => !!f.crash || /crashes reported/i.test(f.description)
  const along = list.filter((f) => isCrash(f) && f.crash?.meets === 'along')
  const crossings = list.filter((f) => isCrash(f) && f.crash?.meets !== 'along')
  const others = list.filter((f) => !isCrash(f))
  const sep = t('calm.list_sep')
  const streets = Array.from(new Set(along.map((f) => f.crash?.streets[0] || f.description))).join(sep)

  if (others.length === 0 && crossings.length === 0) {
    return {
      tone: 'ok',
      text: along.length === 1
        ? t(walk ? 'calm.verdict_along_one_walk' : 'calm.verdict_along_one', { streets })
        : t(walk ? 'calm.verdict_along_other_walk' : 'calm.verdict_along_other', { streets }),
    }
  }
  if (others.length === 0 && along.length === 0) {
    return { tone: 'ok', text: plural(t, crossings.length, 'calm.verdict_crossings_one', 'calm.verdict_crossings_other') }
  }

  const parts: string[] = []
  if (crossings.length > 0) parts.push(plural(t, crossings.length, 'calm.part_crossings_one', 'calm.part_crossings_other'))
  if (along.length > 0) parts.push(t(along.length === 1 ? 'calm.part_along_one' : 'calm.part_along_other', { streets }))
  const byKind = new Map<string, number>()
  for (const f of others) {
    const k = f.kind === 'wrong_way' || f.kind === 'steep' || f.kind === 'sidewalks' ? f.kind : 'other'
    byKind.set(k, (byKind.get(k) ?? 0) + 1)
  }
  const kindWords: Record<string, [CalmKey, CalmKey]> = {
    wrong_way: ['calm.part_wrong_way_one', 'calm.part_wrong_way_other'],
    steep: ['calm.part_steep_one', 'calm.part_steep_other'],
    sidewalks: ['calm.part_sidewalks_one', 'calm.part_sidewalks_other'],
    other: ['calm.part_other_one', 'calm.part_other_other'],
  }
  for (const [k, count] of byKind) parts.push(plural(t, count, kindWords[k][0], kindWords[k][1]))

  const last = parts.pop() as string
  const joined = parts.length ? t('calm.list_and', { list: parts.join(sep), last }) : last
  return { tone: 'ok', text: t('calm.verdict_summary', { list: joined }) }
}

/* ── The route split into coloured stretches, for the map and the leg chips ── */

/** Three words a reader can act on, from the five comfort tiers. */
export type ComfortGroup = 'path' | 'calm' | 'busy'

export function comfortGroup(rating: string): ComfortGroup {
  if (rating === 'path' || rating === 'protected') return 'path'
  if (rating === 'bike_lane' || rating === 'quiet_street') return 'calm'
  return 'busy'
}

export interface ComfortPiece {
  coords: [number, number][]
  rating: string
  /** Index into option.comfort_segments (-1 for the whole-route fallback). */
  index: number
  /** The street, or "Path" / "Side streets" when the planner named none. */
  label: string
  /** Measured along the polyline, so the chips add up to the route. */
  distanceMi: number
  /** The datasets behind this stretch's rating, for "Report a problem with this route". */
  sources: string[]
}

/** "Webster Ave", else "Path" on a path or protected lane, else "Side streets". */
export function stretchLabel(label: string | null | undefined, rating: string, locale: SiteLocale = 'en'): string {
  const name = (label ?? '').trim()
  if (name && !/^route$/i.test(name)) return name
  return tr(locale)(comfortGroup(rating) === 'path' ? 'calm.stretch_path' : 'calm.stretch_side_streets')
}

/** "0.3 mi", "0.05 mi": one decimal, two under a tenth. */
export function formatStretchMiles(mi: number, locale: SiteLocale = 'en'): string {
  const miles = mi >= 0.095 ? mi.toFixed(1) : Math.max(0.01, mi).toFixed(2)
  return tr(locale)('calm.miles', { miles })
}

const EARTH_MILES = 3958.8
function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return EARTH_MILES * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

const sameStreet = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === b.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * The calm route as stretches in route order, one per comfort segment the
 * planner returned, each with its coordinates and its measured length.
 * The drawer's chips and the map's coloured runs are built from this one
 * list, so a chip and its stretch are the same thing (`bike:<index>`).
 *
 * Every segment gets its own piece: by the polyline indices the planner
 * records, else by walking the polyline by distance (the app's
 * splitPolylineByComfort fallback). Only consecutive segments on the same
 * street with the same comfort are merged. The whole route is one piece
 * only when the planner sent no segments at all.
 *
 * How many stretches there are is the planner's call: plan-ride-route
 * merges runs shorter than min(0.25 mi, route / 5) into their neighbour
 * and names the survivor after its dominant street
 * (supabase/functions/_shared/comfort-segments.ts). Nothing here collapses
 * further.
 */
export function comfortPieces(option: CalmOption, locale: SiteLocale = 'en'): ComfortPiece[] {
  const w = option.waypoints
  const segs = option.comfort_segments.filter((s) => s && typeof s.rating === 'string')
  if (w.length < 2) return []
  const toCoords = (pts: { lat: number; lng: number }[]) => pts.map((p) => [p.lng, p.lat] as [number, number])
  const length = (pts: { lat: number; lng: number }[]) => {
    let mi = 0
    for (let i = 1; i < pts.length; i++) mi += milesBetween(pts[i - 1], pts[i])
    return mi
  }
  if (segs.length === 0) {
    const rating = option.comfort_rating && option.comfort_rating !== 'mixed' ? option.comfort_rating : 'shared_road'
    return [{ coords: toCoords(w), rating, index: -1, label: stretchLabel(option.summary, rating, locale), distanceMi: length(w), sources: [] }]
  }

  const runs: { pts: { lat: number; lng: number }[]; seg: CalmSegment }[] = []
  if (segs.every((s) => s.startIdx != null && s.endIdx != null)) {
    for (const seg of segs) {
      const start = Math.max(0, Math.min(w.length - 1, seg.startIdx as number))
      const end = Math.max(start, Math.min(w.length - 1, seg.endIdx as number))
      if (end <= start) continue
      runs.push({ pts: w.slice(start, end + 1), seg })
    }
  }
  if (runs.length === 0) {
    // Distance fallback: rounding drifts a little, so it is second choice.
    let segIdx = 0
    let remaining = Number(segs[0].distance_mi) || 0
    let current = [w[0]]
    for (let i = 1; i < w.length; i++) {
      remaining -= milesBetween(w[i - 1], w[i])
      current.push(w[i])
      if (remaining <= 0 && segIdx < segs.length - 1) {
        runs.push({ pts: current, seg: segs[segIdx] })
        segIdx++
        remaining = Number(segs[segIdx].distance_mi) || 0
        current = [w[i]]
      }
    }
    if (current.length >= 2) runs.push({ pts: current, seg: segs[segIdx] })
  }

  // Merge only consecutive runs on the same street with the same comfort.
  const out: ComfortPiece[] = []
  for (const run of runs) {
    const label = stretchLabel(run.seg.label, run.seg.rating, locale)
    const last = out[out.length - 1]
    if (last && last.rating === run.seg.rating && sameStreet(last.label, label)) {
      const joined = [...last.coords, ...toCoords(run.pts.slice(1))]
      last.coords = joined
      last.distanceMi += length(run.pts)
      for (const src of run.seg.sources ?? []) if (!last.sources.includes(src)) last.sources.push(src)
      continue
    }
    out.push({ coords: toCoords(run.pts), rating: run.seg.rating, index: out.length, label, distanceMi: length(run.pts), sources: [...new Set(run.seg.sources ?? [])] })
  }
  return out
}

/**
 * Where to stand the Street View camera for one stretch: its midpoint,
 * facing along the road (the same rule Nearby's BikeComfortBlock uses: the
 * midpoint beats an endpoint, which lands you in the intersection).
 */
export function legPhotoSpec(option: CalmOption, segmentIndex: number): { lat: number; lng: number; heading?: number } | null {
  const piece = comfortPieces(option).find((p) => p.index === segmentIndex) ?? (segmentIndex === -1 ? comfortPieces(option)[0] : undefined)
  if (!piece || piece.coords.length === 0) return null
  const pts = piece.coords
  const mid = Math.floor(pts.length / 2)
  const [lng, lat] = pts[mid]
  const before = pts[Math.max(0, mid - 1)]
  const after = pts[Math.min(pts.length - 1, mid + 1)]
  if (pts.length < 2 || (before[0] === after[0] && before[1] === after[1])) return { lat, lng }
  const toRad = Math.PI / 180
  const dLng = (after[0] - before[0]) * toRad
  const y = Math.sin(dLng) * Math.cos(after[1] * toRad)
  const x = Math.cos(before[1] * toRad) * Math.sin(after[1] * toRad) - Math.sin(before[1] * toRad) * Math.cos(after[1] * toRad) * Math.cos(dLng)
  const heading = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  return { lat, lng, heading }
}

/* ── The call ── */

/**
 * Ask the Shift planner for the ride from home to the office. The anon key
 * is enough; the function takes 4–10 s, so callers show the row without it
 * and fill it in when it lands.
 */
export async function fetchCalmRoute(
  home: { lat: number; lng: number },
  office: { lat: number; lng: number },
  signal?: AbortSignal,
  locale: SiteLocale = 'en',
): Promise<CalmRoute | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !anon) return null
  const res = await fetch(`${base}/functions/v1/plan-ride-route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
    body: JSON.stringify({
      pins: [{ lat: home.lat, lng: home.lng, label: 'Home' }, { lat: office.lat, lng: office.lng, label: 'Work' }],
      mode: 'bike',
      pace: CALM_PACE,
    }),
    signal,
  })
  if (!res.ok) return null
  const data = (await res.json()) as { legs?: { options?: Partial<CalmOption>[] }[] }
  const raw = data.legs?.[0]?.options ?? []
  const options: CalmOption[] = raw
    .filter((o): o is Partial<CalmOption> & { waypoints: { lat: number; lng: number }[] } => Array.isArray(o.waypoints))
    .map((o) => ({
      score: Number(o.score) || 0,
      distanceMiles: Number(o.distanceMiles) || 0,
      durationMinutes: Number(o.durationMinutes) || 0,
      summary: o.summary ?? '',
      waypoints: o.waypoints,
      viaWaypoints: Array.isArray(o.viaWaypoints) ? o.viaWaypoints : [],
      flags: Array.isArray(o.flags) ? (o.flags as CalmFlag[]) : [],
      comfort_segments: Array.isArray(o.comfort_segments) ? (o.comfort_segments as CalmSegment[]) : [],
      comfort_rating: o.comfort_rating ?? '',
      comfort_summary: o.comfort_summary ?? '',
    }))
  return pickCalmRoute(options, locale)
}
