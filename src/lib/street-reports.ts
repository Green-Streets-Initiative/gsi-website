/**
 * One street-report framework (Shift 01818; plan Shift docs/programs/
 * launches/route-notes/plan.md, "One street-report framework").
 *
 * The shared list of choices for Add a note (bike) and Report a spot
 * (walk), read once per page load from get_street_report_kinds (granted to
 * anon), each tagged with what it does (second tap, town work order,
 * OpenStreetMap, which routes show it). FALLBACK is the same list as of
 * 01818, used until the read lands or if it fails, so the sheets never wait
 * on it. Labels stay in this site's words files, keyed by kind; a choice
 * the site has no words for is left out.
 *
 * Twin of Shift lib/street-reports.ts (and supabase/functions/_shared/
 * street-report-kinds.ts). The app checks a label with i18n.exists; here
 * the caller passes a `has(key)` check against its own strings.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ReportKind {
  kind: string
  family: string
  sheet: string[]
  shows_on: string[]
  lowers: string[]
  fade_days: number
  details: string[]
  town: 'yes' | 'no'
  not_for_town: string[]
  town_on_state_road: string[]
  osm: boolean
  sort: number
}

const k = (
  kind: string, sheet: string[], shows_on: string[], details: string[] = [], town: 'yes' | 'no' = 'no',
  extra: Partial<ReportKind> = {},
): ReportKind => ({
  kind, family: kind, sheet, shows_on, lowers: [], fade_days: 365, details, town,
  not_for_town: [], town_on_state_road: [], osm: false, sort: 0, ...extra,
})

/** 01818's rows (only what the site uses), in the sheets' order. */
export const FALLBACK: ReportKind[] = [
  k('lane_blocked', ['bike'], ['bike'], ['car', 'bins', 'construction', 'snow'], 'yes', { town_on_state_road: ['car', 'bins', 'snow'] }),
  k('lane_ends', ['bike'], ['bike'], [], 'no', { osm: true }),
  k('hard_turn', ['bike'], ['bike']),
  k('fast_traffic', ['bike'], ['bike']),
  k('rough_pavement', ['bike'], ['bike'], [], 'yes'),
  k('construction', ['bike'], ['bike', 'walk']),
  k('nice_here', ['bike'], ['bike']),
  k('note_other', ['bike'], ['bike']),
  k('sidewalk_broken', ['walk'], ['walk'], [], 'yes'),
  k('sidewalk_blocked', ['walk'], ['walk'], ['car', 'bins', 'construction', 'plants'], 'yes', { town_on_state_road: ['car', 'bins'] }),
  k('snow_ice', ['walk'], ['walk'], [], 'yes', { town_on_state_road: ['*'] }),
  k('curb_ramp', ['walk'], ['walk'], ['missing', 'broken'], 'yes'),
  k('crossing_unsafe', ['walk'], ['walk', 'bike'], ['speeding', 'no_yield', 'hard_to_see', 'no_crosswalk'], 'yes'),
  k('walk_signal', ['walk'], ['walk'], ['button', 'no_walk', 'too_short', 'beacon'], 'yes'),
  k('crosswalk_faded', ['walk'], ['walk'], [], 'yes'),
  k('dark_at_night', ['walk'], ['walk'], ['light_out', 'no_light'], 'yes', { not_for_town: ['no_light'] }),
  k('spot_other', ['walk'], ['walk'], [], 'yes'),
  k('map_wrong', ['bike', 'walk'], [], [], 'no', { osm: true }),
].map((r, i) => ({ ...r, sort: (i + 1) * 10 }))

let cached: ReportKind[] | null = null
let loading: Promise<ReportKind[]> | null = null

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** The shared list; FALLBACK on any error. Read once per page load. */
export function loadReportKinds(): Promise<ReportKind[]> {
  if (cached) return Promise.resolve(cached)
  if (loading) return loading
  loading = (async () => {
    try {
      const { data, error } = await supabase.rpc('get_street_report_kinds')
      if (error || !Array.isArray(data) || data.length === 0) return FALLBACK
      const rows: ReportKind[] = (data as Record<string, unknown>[])
        .filter((r) => r && typeof r.kind === 'string')
        .map((r) => ({
          kind: r.kind as string,
          family: String(r.family ?? r.kind),
          sheet: arr(r.sheet),
          shows_on: arr(r.shows_on),
          lowers: arr(r.lowers),
          fade_days: Number(r.fade_days) || 365,
          details: arr(r.details),
          town: r.town === 'yes' ? 'yes' : 'no',
          not_for_town: arr(r.not_for_town),
          town_on_state_road: arr(r.town_on_state_road),
          osm: r.osm === true,
          sort: Number(r.sort) || 0,
        }))
      // Only a browser keeps it: a server render must not hold it for the life of the process.
      const out = rows.length > 0 ? rows : FALLBACK
      if (typeof window !== 'undefined') cached = out
      return out
    } catch {
      return FALLBACK
    } finally {
      loading = null
    }
  })()
  return loading
}

/** The shared list, FALLBACK until the read lands. */
export function useReportKinds(): ReportKind[] {
  const [kinds, setKinds] = useState<ReportKind[]>(cached ?? FALLBACK)
  useEffect(() => {
    let live = true
    void loadReportKinds().then((r) => {
      if (live) setKinds(r)
    })
    return () => {
      live = false
    }
  }, [])
  return kinds
}

/** The choices one sheet offers, in order, leaving out map_wrong (its own row) and any the site has no words for. */
export function sheetChoices(kinds: ReportKind[], sheet: 'bike' | 'walk', has: (kind: string) => boolean): string[] {
  return kinds
    .filter((r) => r.kind !== 'map_wrong' && r.sheet.includes(sheet) && has(r.kind))
    .sort((a, b) => a.sort - b.sort)
    .map((r) => r.kind)
}

/** A kind's second tap, leaving out answers the site has no words for. */
export function detailsOf(kinds: ReportKind[], kind: string | null, has: (kind: string, detail: string) => boolean): string[] {
  if (!kind) return []
  const row = kinds.find((r) => r.kind === kind)
  return (row?.details ?? []).filter((d) => has(kind, d))
}

export function kindRow(kinds: ReportKind[], kind: string | null): ReportKind | undefined {
  return kind ? kinds.find((r) => r.kind === kind) : undefined
}

/** A town work order: the kind is one, and this answer isn't excluded ("no streetlight"). */
export function forTown(row: ReportKind | undefined, detail: string | null): boolean {
  return !!row && row.town === 'yes' && !(detail && row.not_for_town.includes(detail))
}

/** A town's page only when it's a web address (the same check as Report a spot's sheet). */
export function safeUrl(u: string | null | undefined): string | null {
  return u && /^https?:\/\//i.test(u) ? u : null
}

/** Copies the words for a town's form; false when the browser won't (the sheet then shows them to copy by hand).
 *  The same steps as Report a spot's sheet (components/spot/ReportSpotSheet.tsx). */
export function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true, () => legacyCopy(text))
  } catch { /* fall back */ }
  return Promise.resolve(legacyCopy(text))
}

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}
