/**
 * The reporting windows the employer Impact page and the printable report
 * agree on. Pure date maths, no React, no browser: the portal (client) and
 * the report page (server) both import it, so a report link always shows
 * the same dates the admin was looking at.
 */

export type ImpactRangeKey = 'last_7' | 'last_30' | 'this_quarter' | 'ytd'

export const IMPACT_RANGE_KEYS: ImpactRangeKey[] = ['last_7', 'last_30', 'this_quarter', 'ytd']

export const IMPACT_RANGE_LABEL: Record<ImpactRangeKey, string> = {
  last_7: 'Last 7 days',
  last_30: 'Last 30 days',
  this_quarter: 'This quarter',
  ytd: 'Year to date',
}

export function isImpactRangeKey(v: unknown): v is ImpactRangeKey {
  return typeof v === 'string' && (IMPACT_RANGE_KEYS as string[]).includes(v)
}

export type ImpactWindow = {
  key: ImpactRangeKey
  start: Date
  end: Date
  /** Whole days covered, at least 1. The RPC's p_days. */
  days: number
  /** How the page names the range ("Last 30 days", "Q3 2026", "2026 year-to-date"). */
  label: string
  /** Quarter and year-to-date send explicit dates; the rolling ranges rely on p_days. */
  explicit: boolean
}

/** The dates a range covers, and how the page names it. `nowMs` is injected so render stays pure. */
export function impactWindow(key: ImpactRangeKey, nowMs: number): ImpactWindow {
  const end = new Date(nowMs)
  if (key === 'last_7' || key === 'last_30') {
    const days = key === 'last_7' ? 7 : 30
    return {
      key,
      start: new Date(nowMs - days * 86_400_000),
      end,
      days,
      label: IMPACT_RANGE_LABEL[key],
      explicit: false,
    }
  }
  const year = end.getFullYear()
  const month = end.getMonth()
  if (key === 'this_quarter') {
    const quarterStartMonth = Math.floor(month / 3) * 3
    const start = new Date(year, quarterStartMonth, 1)
    const q = Math.floor(quarterStartMonth / 3) + 1
    return { key, start, end, days: daysBetween(start, end), label: `Q${q} ${year}`, explicit: true }
  }
  const start = new Date(year, 0, 1)
  return { key, start, end, days: daysBetween(start, end), label: `${year} year-to-date`, explicit: true }
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000))
}

/** Arguments for get_employer_dashboard_data for this window. */
export function dashboardRpcParams(groupId: string, win: ImpactWindow): Record<string, unknown> {
  const params: Record<string, unknown> = { p_group_id: groupId, p_days: win.days }
  if (win.explicit) {
    params.p_starts_at = win.start.toISOString()
    params.p_ends_at = win.end.toISOString()
  }
  return params
}

/** "September 1 – September 30, 2026", in Eastern time like the rest of the portal. */
export function formatWindowDates(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', timeZone: 'America/New_York' }
  const sameYear = start.getFullYear() === end.getFullYear()
  const startStr = start.toLocaleDateString('en-US', sameYear ? opts : { ...opts, year: 'numeric' })
  const endStr = end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  return `${startStr} – ${endStr}`
}

/** "September 1 – 30" style short form for tables. */
export function formatWindowDatesShort(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'America/New_York' }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`
}

/**
 * The calendar days a window covers, for labels: a window that starts
 * part-way through a day is labelled from the next day (rolling "last 30
 * days" ending now covers the 30 days ending today), and the end is the
 * last moment inside it. So two back-to-back windows never share a date:
 * "Aug 3 – Sep 1" then "Sep 2 – Oct 1".
 */
export function windowDays(start: Date, end: Date): { first: Date; last: Date } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(start)
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  const first = h === 0 && m === 0 ? start : new Date(start.getTime() + 86_400_000)
  const last = new Date(Math.max(first.getTime(), end.getTime() - 1))
  return { first, last }
}

/** "Sep 2 – Oct 1" (no year), for column headers. */
export function windowLabelShort(start: Date, end: Date): string {
  const { first, last } = windowDays(start, end)
  return formatWindowDatesShort(first, last)
}

/** "September 2 – October 1, 2026", for a sentence or a cover. */
export function windowLabelLong(start: Date, end: Date): string {
  const { first, last } = windowDays(start, end)
  return formatWindowDates(first, last)
}

/**
 * CO₂e in the unit a reader takes in at a glance: kilograms below a tonne
 * ("11 kg", "8.4 kg"), tonnes from there ("1.2 t"). Metric throughout
 * (Keith 2026-09-30); never "0.01 t".
 */
export function formatCo2(kg: number): string {
  if (kg >= 1000) {
    return `${(kg / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t`
  }
  return `${kg.toLocaleString('en-US', { maximumFractionDigits: kg < 10 ? 1 : 0 })} kg`
}

/** Kilograms to tonnes of CO₂-equivalent, shown to two places ("1.24 tCO₂e"). */
export function formatTonnes(kg: number): string {
  const t = kg / 1000
  return t.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Signed percentage-point change, "+3 pts" / "−2 pts" / "no change". */
export function formatPtsChange(now: number | null | undefined, before: number | null | undefined): string | null {
  if (now == null || before == null) return null
  const d = Math.round(now - before)
  if (d === 0) return 'no change'
  return `${d > 0 ? '+' : '−'}${Math.abs(d)} pts`
}

/** Signed percentage change of a count, "+12%" / "−8%" / "no change". */
export function formatPctChange(now: number | null | undefined, before: number | null | undefined): string | null {
  if (now == null || before == null) return null
  if (before === 0) return now === 0 ? 'no change' : 'new'
  const d = Math.round(((now - before) / before) * 100)
  if (d === 0) return 'no change'
  return `${d > 0 ? '+' : '−'}${Math.abs(d)}%`
}
