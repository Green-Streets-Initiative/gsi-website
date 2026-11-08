/**
 * Path conditions after snow, in words and colors (Keith 2026-10-31): one
 * picture per trail, shared by the trail pages, /trails/conditions and the
 * open feed. Data from get_path_conditions() (Shift migration 01568); see
 * lib/trails/conditions.ts. No server imports, so client maps can use it.
 * Words take an optional page language (site-strings/trails.ts); English is the default.
 */

import { siteDate, siteTime, translator, type SiteLocale } from '@/lib/site-i18n'
import { trailStrings } from '@/lib/site-strings/trails'

export type Condition = 'clear' | 'snowy' | 'icy' | 'not_cleared'
export type Cleared = 'yes' | 'partly' | 'no'

export interface TrailWinter {
  cleared: Cleared
  note: string
  source: string
  /** When the source said so, if it is dated. */
  as_of?: string
  checked_on?: string
}

export interface TrailWeather {
  snow_72h_cm: number
  snow_depth_cm: number
  freezing_72h: boolean
  last_snow_at: string | null
  checked_at: string
}

export interface ConditionReport {
  condition: Condition
  rode_at: string
  from_label: string | null
  to_label: string | null
  /** The stretch, as pieces of the trail's line, [lng, lat]. */
  line: [number, number][][] | null
}

export interface TrailConditions {
  trail_id: string
  winter: TrailWinter | null
  /** Null when snow was not checked in the last three hours (April to October). */
  weather: TrailWeather | null
  /** The last 24 hours, newest first. */
  reports: ConditionReport[]
}

/** A protected (separated) bike lane, from MassDOT's bike inventory (Shift
 *  01614, get_lane_conditions). No clearing policy: towns don't publish one
 *  lane by lane, so a lane shows only snow and what riders said. */
export interface LaneConditions {
  lane_id: string
  /** The street, as OpenStreetMap names it. */
  name: string
  town: string
  lines: [number, number][][]
  miles: number
  weather: TrailWeather | null
  reports: ConditionReport[]
}

/** Protected lanes on the conditions map: thin and violet, under the report colors. */
export const LANE_STYLE = { color: '#6D4AC9', width: 2.6, label: 'Protected bike lane' } as const

export const CONDITION_LABEL: Record<Condition, string> = {
  clear: 'Clear',
  snowy: 'Some snow or slush',
  icy: 'Icy patches',
  not_cleared: 'Not plowed or blocked',
}

export const CONDITION_COLOR: Record<Condition, string> = {
  clear: '#2D6A4F',
  snowy: '#B45309',
  icy: '#1D4ED8',
  not_cleared: '#B91C1C',
}

export type ClearedKey = Cleared | 'unknown'

/** Who clears it, as a line style: the paths are navy, plain to dotted, so
 *  the report colors on top read first. */
export const CLEARED_STYLE: Record<ClearedKey, { color: string; width: number; dash?: number[]; label: string }> = {
  yes: { color: '#191A2E', width: 3.4, label: 'Plowed' },
  partly: { color: '#191A2E', width: 3.4, dash: [2, 1.4], label: 'Partly plowed' },
  no: { color: '#5B6475', width: 3, dash: [0.4, 1.6], label: 'Not plowed' },
  unknown: { color: '#8E99A5', width: 2.8, label: 'Not known yet' },
}

export const CLEARED_SHORT: Record<Cleared, string> = {
  yes: 'Plowed in winter',
  partly: 'Partly plowed in winter',
  no: 'Not plowed in winter',
}

/** A centimeter of snow, snow still on the ground, or freezing rain. Same rule as path-conditions. */
export function isWintry(w: TrailWeather | null): w is TrailWeather {
  return !!w && (w.snow_72h_cm >= 1 || w.snow_depth_cm >= 1 || w.freezing_72h)
}

/* The words below take the page's language; English (the default) is what the
   open feed and every untranslated caller get, unchanged. */

export function conditionLabel(c: Condition, locale: SiteLocale = 'en'): string {
  return locale === 'en' ? CONDITION_LABEL[c] : translator(trailStrings, locale)(`cond.${c}`)
}

export function clearedLabel(k: ClearedKey, locale: SiteLocale = 'en'): string {
  return locale === 'en' ? CLEARED_STYLE[k].label : translator(trailStrings, locale)(`cleared.${k}`)
}

export function clearedShort(k: Cleared, locale: SiteLocale = 'en'): string {
  return locale === 'en' ? CLEARED_SHORT[k] : translator(trailStrings, locale)(`cleared_short.${k}`)
}

export function laneLabel(locale: SiteLocale = 'en'): string {
  return locale === 'en' ? LANE_STYLE.label : translator(trailStrings, locale)('cond.lane')
}

/** `upTo`: "Up to 4 inches", for the regional line on /trails/conditions. */
function inches(cm: number, locale: SiteLocale, upTo = false): string {
  const t = translator(trailStrings, locale)
  const n = Math.round(cm / 2.54)
  if (upTo) return n < 1 ? t('inch.up_to_under') : n === 1 ? t('inch.up_to_one') : t('inch.up_to_other', { n })
  return n < 1 ? t('inch.under') : n === 1 ? t('inch.one') : t('inch.other', { n })
}

const tz = 'America/New_York'
function dayKey(iso: string, now = new Date()): 'today' | 'yesterday' | null {
  const d = new Date(iso)
  const key = (x: Date) => x.toLocaleDateString('en-US', { timeZone: tz })
  if (key(d) === key(now)) return 'today'
  if (key(d) === key(new Date(now.getTime() - 86_400_000))) return 'yesterday'
  return null
}
function weekdayName(iso: string, locale: SiteLocale): string {
  return siteDate(locale, iso, { weekday: 'long', timeZone: tz })
}

export function timeOf(iso: string, now = new Date(), locale: SiteLocale = 'en'): string {
  const t = siteTime(locale, iso, { hour: 'numeric', minute: '2-digit', timeZone: tz })
  const k = dayKey(iso, now)
  if (k === 'today') return t
  const tr = translator(trailStrings, locale)
  return k === 'yesterday' ? tr('time.yesterday', { time: t }) : tr('time.weekday', { day: weekdayName(iso, locale), time: t })
}

/** "4 inches of snow since Tuesday", "Freezing rain since yesterday", "Snow on the ground". */
export function snowLine(w: TrailWeather, now = new Date(), locale: SiteLocale = 'en', upTo = false): string {
  const t = translator(trailStrings, locale)
  if (w.snow_72h_cm >= 1) {
    const amount = inches(w.snow_72h_cm, locale, upTo)
    if (!w.last_snow_at) return t('snow.recent', { amount })
    const k = dayKey(w.last_snow_at, now)
    if (k === 'today') return t('snow.today', { amount })
    if (k === 'yesterday') return t('snow.yesterday', { amount })
    return t('snow.since', { amount, day: weekdayName(w.last_snow_at, locale) })
  }
  if (w.freezing_72h) return t('snow.freezing')
  return t('snow.ground')
}

/** "between Arlington Center and Lexington Center", "near Davis Square", or "". */
export function stretchWords(r: Pick<ConditionReport, 'from_label' | 'to_label'>, locale: SiteLocale = 'en'): string {
  const t = translator(trailStrings, locale)
  if (r.from_label && r.to_label) return t('stretch.between', { from: r.from_label, to: r.to_label })
  if (r.from_label) return t('stretch.near', { from: r.from_label })
  return ''
}

/** "Icy between X and Y" */
export function reportLine(r: ConditionReport, locale: SiteLocale = 'en'): string {
  const where = stretchWords(r, locale)
  const condition = conditionLabel(r.condition, locale)
  return where ? translator(trailStrings, locale)('report.line', { condition, where }) : condition
}

/** The one line a trail shows now: the newest report, else recent snow, else nothing. */
export function headline(c: TrailConditions | null, now = new Date(), locale: SiteLocale = 'en'):
  | { kind: 'report'; text: string; when: string; condition: Condition }
  | { kind: 'snow'; text: string }
  | null {
  if (!c) return null
  const r = c.reports[0]
  if (r) return { kind: 'report', text: reportLine(r, locale), when: timeOf(r.rode_at, now, locale), condition: r.condition }
  if (isWintry(c.weather)) return { kind: 'snow', text: translator(trailStrings, locale)('head.snow', { snow: snowLine(c.weather, now, locale) }) }
  return null
}
