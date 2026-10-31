/**
 * Path conditions after snow, in words and colors (Keith 2026-10-31): one
 * picture per trail, shared by the trail pages, /trails/conditions and the
 * open feed. Data from get_path_conditions() (Shift migration 01568); see
 * lib/trails/conditions.ts. No server imports, so client maps can use it.
 */

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

export const CONDITION_LABEL: Record<Condition, string> = {
  clear: 'Clear',
  snowy: 'Some snow or slush',
  icy: 'Icy',
  not_cleared: 'Not cleared',
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

function inches(cm: number): string {
  const n = Math.round(cm / 2.54)
  return n < 1 ? 'Under an inch' : n === 1 ? '1 inch' : `${n} inches`
}

const tz = 'America/New_York'
function dayName(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const key = (x: Date) => x.toLocaleDateString('en-US', { timeZone: tz })
  if (key(d) === key(now)) return 'today'
  if (key(d) === key(new Date(now.getTime() - 86_400_000))) return 'yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz })
}

export function timeOf(iso: string, now = new Date()): string {
  const t = new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })
  const day = dayName(iso, now)
  return day === 'today' ? t : `${day} ${t}`
}

/** "4 inches of snow since Tuesday", "Freezing rain since yesterday", "Snow on the ground". */
export function snowLine(w: TrailWeather, now = new Date()): string {
  if (w.snow_72h_cm >= 1) {
    const day = w.last_snow_at ? dayName(w.last_snow_at, now) : null
    return `${inches(w.snow_72h_cm)} of snow${day ? (day === 'today' ? ' today' : ` since ${day}`) : ' in the last three days'}`
  }
  if (w.freezing_72h) return 'Freezing rain in the last three days'
  return 'Snow on the ground'
}

/** "between Arlington Center and Lexington Center", "near Davis Square", or "". */
export function stretchWords(r: Pick<ConditionReport, 'from_label' | 'to_label'>): string {
  if (r.from_label && r.to_label) return `between ${r.from_label} and ${r.to_label}`
  if (r.from_label) return `near ${r.from_label}`
  return ''
}

/** "Icy between X and Y" */
export function reportLine(r: ConditionReport): string {
  const where = stretchWords(r)
  return where ? `${CONDITION_LABEL[r.condition]} ${where}` : CONDITION_LABEL[r.condition]
}

/** The one line a trail shows now: the newest report, else recent snow, else nothing. */
export function headline(c: TrailConditions | null, now = new Date()):
  | { kind: 'report'; text: string; when: string; condition: Condition }
  | { kind: 'snow'; text: string }
  | null {
  if (!c) return null
  const r = c.reports[0]
  if (r) return { kind: 'report', text: reportLine(r), when: timeOf(r.rode_at, now), condition: r.condition }
  if (isWintry(c.weather)) return { kind: 'snow', text: `${snowLine(c.weather, now)}. No reports from riders yet` }
  return null
}
