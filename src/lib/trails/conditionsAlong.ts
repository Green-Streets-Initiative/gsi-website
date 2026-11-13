/**
 * Path conditions along a route or near a place (Shift 01784,
 * get_path_conditions_along): the trails and protected bike lanes a route
 * runs along, or that are near a spot, that have something to say today: a
 * report in the last 24 hours from someone who used it, or snow or freezing
 * rain in the last three days. Used by the commute advisor's bike route,
 * Nearby's bike trips and Nearby's bike-route detail. Words and colors come
 * from conditionText.ts, the same ones the trail pages use.
 *
 * Client-safe (the anon Supabase client). Empty on any error, so a route
 * never breaks over conditions.
 */

import { supabase } from '@/lib/supabase'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { trailStrings } from '@/lib/site-strings/trails'
import {
  clearedShort, CONDITION_COLOR, reportLine, snowLine, timeOf,
  type Condition, type TrailWeather, type TrailWinter,
} from '@/lib/trails/conditionText'

export interface PathAlong {
  place_id: string
  place_kind: 'trail' | 'lane'
  name: string
  town: string | null
  winter: TrailWinter | null
  weather: TrailWeather | null
  report: { condition: Condition; rode_at: string; from_label: string | null; to_label: string | null } | null
  meters: number
  near_points: number
}

type Pt = { lat: number; lng: number }

/** At most `max` points, ends kept, for the RPC's 500-point limit. */
function thin(points: Pt[], max = 480): Pt[] {
  if (points.length <= max) return points
  const step = Math.ceil(points.length / max)
  return points.filter((_, i) => i % step === 0 || i === points.length - 1)
}

/** Along a route (in its order), or with `nearM`, near any of the points. */
export async function fetchPathsAlong(points: Pt[], nearM?: number): Promise<PathAlong[]> {
  const usable = points.filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
  if (usable.length < (nearM ? 1 : 2)) return []
  const p_points = thin(usable).map((p) => ({ lat: Number(p.lat.toFixed(5)), lng: Number(p.lng.toFixed(5)) }))
  try {
    const { data, error } = await supabase.rpc('get_path_conditions_along', nearM ? { p_points, p_near_m: nearM } : { p_points })
    if (error || !Array.isArray(data)) return []
    return data as PathAlong[]
  } catch {
    return []
  }
}

/** The place's name: "Minuteman Bikeway", "Cambridge Street bike lane, Cambridge". */
export function placeName(p: PathAlong, locale: SiteLocale = 'en'): string {
  if (p.place_kind !== 'lane') return p.name
  return translator(trailStrings, locale)('c.lane_name', { name: p.name, town: p.town ?? '' }).replace(/,\s*$/, '')
}

/**
 * One line: "Icy patches between Arlington Center and Lexington Center,
 * 7:40 AM", else "Under an inch of snow today. Plowed in winter."
 */
export function pathLine(p: PathAlong, now = new Date(), locale: SiteLocale = 'en'): { text: string; color: string } {
  const tr = translator(trailStrings, locale)
  if (p.report) {
    return {
      text: tr('along.at', { text: reportLine({ ...p.report, line: null }, locale), time: timeOf(p.report.rode_at, now, locale) }),
      color: CONDITION_COLOR[p.report.condition] ?? '#5B6475',
    }
  }
  const snow = p.weather ? snowLine(p.weather, now, locale) : ''
  const cleared = p.winter?.cleared ? clearedShort(p.winter.cleared, locale) : ''
  const join = locale === 'zh-Hans' ? '' : ' '
  return { text: [snow, cleared].filter(Boolean).map((s) => tr('along.sentence', { s })).join(join), color: '#5B6475' }
}
