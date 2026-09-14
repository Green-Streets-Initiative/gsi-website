/*
 * Date and label formatting for campaign surfaces. Pure; safe in client
 * components.
 *
 * TWO TRAPS LIVE HERE, both of which have bitten this codebase before.
 *
 * 1. Never derive a display date from `endsAt`. A Walk/Ride Day ends at
 *    2026-09-26T03:59:59Z, which is 23:59:59 on Friday Sep 25 in Eastern.
 *    Formatted without an explicit timeZone that prints "Sep 26" — a
 *    Saturday, for a Friday event. The same note is at
 *    src/app/events/walk-ride-day/rules/page.tsx.
 *
 * 2. Pin BOTH locale and timeZone on every format call. These strings render
 *    on the server and hydrate on the client; leaving locale to the device
 *    produces a different string for any visitor outside en-US and throws a
 *    hydration warning on every page load.
 */

import type { Promotable } from './types'

export const ET = 'America/New_York'
const LOCALE = 'en-US'

/** "Sep 25" */
export function shortDateET(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { timeZone: ET, month: 'short', day: 'numeric' })
}

/** "September 25" */
export function longDateET(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { timeZone: ET, month: 'long', day: 'numeric' })
}

/** "Friday, September 25" */
export function weekdayDateET(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { timeZone: ET, weekday: 'long', month: 'long', day: 'numeric' })
}

/** The ET calendar day, as YYYY-MM-DD, for same-day comparisons. */
export function calendarDayET(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: ET })
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/**
 * The date range a card shows. Always anchored on startsAt (trap 1); for a
 * single-day event the end instant is not shown at all.
 */
export function dateRangeET(p: Promotable): string {
  if (p.singleDay) return weekdayDateET(p.startsAt)
  return `${longDateET(p.startsAt)} – ${longDateET(p.endsAt)}`
}

const MAX_LABEL = 34

/**
 * The nav label: "Walk/Ride Day · Sep 25".
 *
 * The suffix depends on windowKind and singleDay — a three-month signup
 * window reading "Shift Your Semester · Dec 15" would be misread as a start
 * date. Over MAX_LABEL the suffix is dropped rather than truncated mid-word;
 * CSS truncation is the third and last line of defence.
 */
export function navPromoLabel(p: Promotable, now: Date): string {
  const suffix = (() => {
    if (p.phase === 'active') {
      if (p.singleDay) return 'today'
      const left = daysBetween(now, new Date(p.endsAt))
      if (left <= 2) return `ends ${shortDateET(p.endsAt)}`
      return p.windowKind === 'signup' ? `through ${shortDateET(p.endsAt)}` : `ends ${shortDateET(p.endsAt)}`
    }
    const until = daysBetween(now, new Date(p.startsAt))
    if (until <= 0) return 'today'
    if (until === 1) return 'tomorrow'
    return shortDateET(p.startsAt)
  })()

  const full = `${p.shortTitle} · ${suffix}`
  return full.length > MAX_LABEL ? p.shortTitle : full
}
