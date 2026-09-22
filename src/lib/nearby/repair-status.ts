/**
 * "Is this repair place open?" from a stored weekly schedule.
 *
 * Ported VERBATIM from the Shift app (Shift repo lib/nearby/repair-status.ts).
 * Keep the two in step: a co-op must read the same way on the website and
 * in Around You. The rules are the point — see the honesty notes below.
 *
 * Community co-ops are places with recurring hours, so the useful line at the
 * top of a card is not the week, it is whether it is worth riding over now.
 * This module answers that and nothing else: pure, no i18n, no Supabase, so
 * the phrasing can change without touching the rules.
 *
 *   - Never claim "open now" for a schedule nobody has confirmed lately.
 *   - Never claim "open now" outside a window we can actually vouch for.
 *   - Distinguish "no hours on file" from "closed". Silence is not closure.
 *
 * Times are evaluated in the browser's local zone. Every place we list is in
 * Massachusetts and so is every reader who can usefully reach one.
 */

/** One opening block. `day` is 0=Sunday, matching Date#getDay. */
export interface RepairHoursBlock {
  day: number
  open: string
  close: string
  note?: string | null
}

export type RepairSeasonality = 'year_round' | 'academic_term' | 'seasonal'

export interface RepairSchedule {
  hours: RepairHoursBlock[] | null
  seasonality: RepairSeasonality | null
  /** YYYY-MM-DD, the window the published schedule is known to cover. */
  effectiveStart?: string | null
  effectiveEnd?: string | null
  /** ISO timestamp of the last time a human or agent checked the source. */
  verifiedAt?: string | null
}

export type RepairStatusKind =
  | 'open'
  | 'closing_soon'
  | 'opens_today'
  | 'opens_later'
  | 'not_yet'
  | 'out_of_season'
  | 'between_terms'
  | 'unknown'

export interface RepairStatus {
  kind: RepairStatusKind
  /** "HH:MM" the current block ends — set for open and closing_soon. */
  closesAt?: string
  /** Minutes until close, for the closing-soon window. */
  minutesToClose?: number
  /** The next opening: 0=Sunday, plus its start time. */
  nextDay?: number
  nextOpen?: string
  /** 0 = today, 1 = tomorrow, for callers that want "tomorrow". */
  daysUntilNext?: number
  /** YYYY-MM-DD the published schedule begins, for `not_yet`. */
  startsOn?: string
  /** 1-12, the month the season resumes, when we know it. */
  resumesMonth?: number
  /**
   * True when the verdict must be worded as a habit, not a fact:
   * "Usually open Wednesdays and Fridays" rather than "Open until 5:00 PM".
   * Set when the hours are unconfirmed, or when seasonality means we cannot
   * prove today is inside the operating window.
   */
  soft: boolean
  /** Why it is soft, for the caller that wants to say so. */
  softReason?: 'unconfirmed' | 'unbounded_season'
  /** The days the place is normally open, ascending — for soft phrasing. */
  usualDays: number[]
}

/** An open block ends within this many minutes → "closes at", not "open until". */
export const CLOSING_SOON_MINUTES = 60
/** Hours unchecked for longer than this stop being stated as fact. Matches
 *  the window the page uses to retire a stale transit closure. */
export const STALE_AFTER_DAYS = 90

/** Presumed university down-weeks, used only when no explicit window exists. */
const SUMMER_GAP_FROM = '06-01'
const SUMMER_GAP_TO = '08-31'
const WINTER_GAP_FROM = '12-20'
const WINTER_GAP_TO = '01-15'

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Local calendar date as YYYY-MM-DD — never toISOString, which shifts to UTC. */
export function localDate(at: Date): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

export function parseClock(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

function inAcademicGap(at: Date): boolean {
  const md = `${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
  if (md >= SUMMER_GAP_FROM && md <= SUMMER_GAP_TO) return true
  // The winter gap wraps the year end.
  if (md >= WINTER_GAP_FROM || md <= WINTER_GAP_TO) return true
  return false
}

function isStale(verifiedAt: string | null | undefined, now: Date): boolean {
  if (!verifiedAt) return true
  const t = Date.parse(verifiedAt)
  if (Number.isNaN(t)) return true
  return now.getTime() - t > STALE_AFTER_DAYS * 86400000
}

/** Valid blocks, sorted by day then opening time. */
function cleanBlocks(hours: RepairHoursBlock[] | null | undefined): RepairHoursBlock[] {
  return (hours ?? [])
    .filter(b =>
      Number.isInteger(b?.day) && b.day >= 0 && b.day <= 6 &&
      parseClock(b?.open) !== null && parseClock(b?.close) !== null)
    .sort((a, b) => a.day - b.day || (parseClock(a.open)! - parseClock(b.open)!))
}

function uniqueDays(blocks: RepairHoursBlock[]): number[] {
  return Array.from(new Set(blocks.map(b => b.day))).sort((a, b) => a - b)
}

/** The next opening at or after `now`, searching a full week. */
function nextOpening(
  blocks: RepairHoursBlock[],
  now: Date,
): { day: number; open: string; daysAhead: number } | null {
  if (blocks.length === 0) return null
  const today = now.getDay()
  const minutesNow = now.getHours() * 60 + now.getMinutes()
  for (let ahead = 0; ahead < 8; ahead++) {
    const day = (today + ahead) % 7
    for (const b of blocks) {
      if (b.day !== day) continue
      if (ahead === 0 && parseClock(b.open)! <= minutesNow) continue
      return { day, open: b.open, daysAhead: ahead }
    }
  }
  return null
}

/**
 * Where today sits relative to a published window.
 * "unbounded" means the place is seasonal but never told us the dates.
 */
function windowState(
  schedule: RepairSchedule,
  now: Date,
): 'inside' | 'before' | 'after' | 'unbounded' {
  const today = localDate(now)
  const { effectiveStart, effectiveEnd, seasonality } = schedule
  if (effectiveStart && today < effectiveStart) return 'before'
  if (effectiveEnd && today > effectiveEnd) return 'after'
  if (!seasonality || seasonality === 'year_round') return 'inside'

  // A start date alone does not vouch for every term or season after it.
  const bounded = Boolean(effectiveStart && effectiveEnd)
  if (bounded) return 'inside'
  if (seasonality === 'academic_term') return inAcademicGap(now) ? 'after' : 'inside'
  // Seasonal with no closing date: we cannot prove today is in season.
  return 'unbounded'
}

export function repairStatus(schedule: RepairSchedule, now: Date = new Date()): RepairStatus {
  const blocks = cleanBlocks(schedule.hours)
  const usualDays = uniqueDays(blocks)

  if (blocks.length === 0) {
    return { kind: 'unknown', soft: true, usualDays: [] }
  }

  const stale = isStale(schedule.verifiedAt, now)
  const where = windowState(schedule, now)

  if (where === 'before') {
    return {
      kind: 'not_yet',
      startsOn: schedule.effectiveStart ?? undefined,
      soft: true,
      softReason: stale ? 'unconfirmed' : undefined,
      usualDays,
    }
  }

  if (where === 'after') {
    const resumesMonth = schedule.effectiveStart
      ? Number(schedule.effectiveStart.slice(5, 7))
      : undefined
    return {
      kind: schedule.seasonality === 'academic_term' ? 'between_terms' : 'out_of_season',
      resumesMonth: Number.isFinite(resumesMonth) ? resumesMonth : undefined,
      soft: true,
      usualDays,
    }
  }

  // Seasonal with no published dates never speaks with confidence, and a
  // schedule nobody has checked in three months does not either.
  const soft = where === 'unbounded' || stale
  const softReason = where === 'unbounded' ? 'unbounded_season' : stale ? 'unconfirmed' : undefined

  const today = now.getDay()
  const minutesNow = now.getHours() * 60 + now.getMinutes()
  const openBlock = blocks.find(
    b => b.day === today && parseClock(b.open)! <= minutesNow && minutesNow < parseClock(b.close)!,
  )

  if (openBlock) {
    const minutesToClose = parseClock(openBlock.close)! - minutesNow
    return {
      kind: minutesToClose <= CLOSING_SOON_MINUTES ? 'closing_soon' : 'open',
      closesAt: openBlock.close,
      minutesToClose,
      soft,
      softReason,
      usualDays,
    }
  }

  const next = nextOpening(blocks, now)
  if (!next) return { kind: 'unknown', soft: true, usualDays }

  return {
    kind: next.daysAhead === 0 ? 'opens_today' : 'opens_later',
    nextDay: next.day,
    nextOpen: next.open,
    daysUntilNext: next.daysAhead,
    soft,
    softReason,
    usualDays,
  }
}

/** Sort key for a list: open first, then opening soonest, then the rest. */
export function statusRank(s: RepairStatus): number {
  switch (s.kind) {
    case 'open': return 0
    case 'closing_soon': return 1
    case 'opens_today': return 2
    case 'opens_later': return 3 + (s.daysUntilNext ?? 7)
    case 'not_yet': return 20
    case 'between_terms':
    case 'out_of_season': return 21
    case 'unknown': return 22
  }
}
