/**
 * Turns a RepairStatus into the line a reader sees, in their language.
 *
 * Ported from the Shift app (lib/nearby/repair-format.ts) — same branches,
 * same tones, so a co-op reads one way on /nearby and the same way in Around
 * You. Kept apart from repair-status.ts so the rules stay pure.
 */
import type { RepairStatus } from './repair-status'

type Translate = (key: string, replacements?: Record<string, string | number | null | undefined>) => string

/** Drives the colour: open is affirmative, soon is a nudge, muted is neither. */
export type RepairTone = 'open' | 'soon' | 'muted'

export interface RepairStatusLine {
  /** The headline. Never claims "open now" when the status is soft. */
  text: string
  tone: RepairTone
  /** Second line: the caveat, or when we last checked. Often absent. */
  sub?: string
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/** "6:00 PM" from "18:00", in the reader's locale. */
export function formatClock(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm)
  if (!m) return hhmm
  const d = new Date(2000, 0, 1, Number(m[1]), Number(m[2]))
  try {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch {
    return hhmm
  }
}

function dayName(tr: Translate, day: number): string {
  return tr(`repair.day_${DAY_KEYS[day] ?? 'sun'}`)
}

function monthName(month: number): string {
  try {
    return new Date(2000, Math.max(0, month - 1), 1)
      .toLocaleDateString(undefined, { month: 'long' })
  } catch {
    return String(month)
  }
}

function shortDate(isoDate: string): string {
  try {
    return new Date(`${isoDate}T12:00:00`)
      .toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return isoDate
  }
}

/** "Tue & Thu", "Wed, Thu & Sat" — the days a place is normally open. */
function dayList(tr: Translate, days: number[]): string {
  const names = days.map(d => dayName(tr, d))
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

export function repairStatusLine(
  status: RepairStatus,
  tr: Translate,
  opts: { note?: string | null } = {},
): RepairStatusLine {
  const note = opts.note?.trim() || undefined

  // A soft verdict describes a habit, not this minute. Anything we cannot
  // vouch for right now lands here rather than in the confident branch.
  const softLine = (): RepairStatusLine => ({
    text: tr('repair.usually_open', { days: dayList(tr, status.usualDays) }),
    tone: 'muted',
    sub: note,
  })

  switch (status.kind) {
    case 'unknown':
      return { text: tr('repair.hours_unknown'), tone: 'muted', sub: note }

    case 'out_of_season':
      return {
        text: status.resumesMonth
          ? tr('repair.out_of_season_until', { month: monthName(status.resumesMonth) })
          : tr('repair.out_of_season'),
        tone: 'muted',
        sub: note,
      }

    case 'between_terms':
      return { text: tr('repair.between_terms'), tone: 'muted', sub: note }

    case 'not_yet':
      return {
        text: status.startsOn
          ? tr('repair.not_yet', { date: shortDate(status.startsOn) })
          : tr('repair.usually_open', { days: dayList(tr, status.usualDays) }),
        tone: 'muted',
        sub: note,
      }

    case 'open':
      if (status.soft) return softLine()
      return {
        text: tr('repair.open_until', { time: formatClock(status.closesAt ?? '') }),
        tone: 'open',
        sub: note,
      }

    case 'closing_soon':
      if (status.soft) return softLine()
      return {
        text: tr('repair.closes_at', { time: formatClock(status.closesAt ?? '') }),
        tone: 'soon',
        sub: note,
      }

    case 'opens_today':
      if (status.soft) return softLine()
      return {
        text: tr('repair.opens_today', { time: formatClock(status.nextOpen ?? '') }),
        tone: 'soon',
        sub: note,
      }

    case 'opens_later': {
      if (status.soft) return softLine()
      const time = formatClock(status.nextOpen ?? '')
      return {
        text:
          status.daysUntilNext === 1
            ? tr('repair.opens_tomorrow', { time })
            : tr('repair.opens_on', { day: dayName(tr, status.nextDay ?? 0), time }),
        tone: 'muted',
        sub: note,
      }
    }
  }
}

/** "Last confirmed Sep 14" — shown only when the hours are unconfirmed. */
export function lastConfirmedLine(
  status: RepairStatus,
  verifiedAt: string | null,
  tr: Translate,
): string | null {
  if (status.softReason !== 'unconfirmed' || !verifiedAt) return null
  const d = new Date(verifiedAt)
  if (Number.isNaN(d.getTime())) return null
  try {
    return tr('repair.last_confirmed', {
      date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    })
  } catch {
    return null
  }
}

/** "Wed · 11:30 AM – 5:00 PM" rows for the detail card. */
export function weekRows(
  hours: Array<{ day: number; open: string; close: string }> | null,
  tr: Translate,
): Array<{ day: string; range: string }> {
  return (hours ?? [])
    .slice()
    .sort((a, b) => a.day - b.day)
    .map(b => ({
      day: dayName(tr, b.day),
      range: `${formatClock(b.open)} – ${formatClock(b.close)}`,
    }))
}
