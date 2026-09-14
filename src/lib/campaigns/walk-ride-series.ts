/*
 * Walk/Ride Day recurrence.
 *
 * The series is hand-seeded in the app repo's migration
 * 00110_fix_walk_ride_day_competitions.sql as a literal twelve-element list
 * running out on 2027-03-26, and nothing anywhere computes "last Friday of
 * the month". Meanwhile /programs/walk-ride-days tells every visitor it
 * happens every last Friday, since 2006, unconditionally.
 *
 * So this synthesizes occurrences past the last seeded row, to keep the site
 * from contradicting itself about its own flagship program. Synthesized
 * occurrences carry no rules link and no prize implication, because there is
 * no competitions row behind them to enter.
 *
 * The durable fix is a database function that materializes real rows, cloning
 * the prior month's prizes. That belongs in the Shift repo; this is the
 * presentational stopgap and goes away when it lands.
 */

import type { Promotable } from './types'
import { ET } from './format'
import { FLAGSHIP_REGISTRY } from './routes'

/**
 * The UTC instant of local midnight on a given ET calendar date. The offset
 * comes from Intl rather than a hardcoded -04:00/-05:00: the seed migration
 * got the DST flip right by hand, which is exactly the kind of thing that
 * stops being right once nobody is checking.
 */
function etMidnight(year: number, month: number, day: number): Date {
  const guess = new Date(Date.UTC(year, month, day, 12))
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: ET, timeZoneName: 'longOffset' })
    .formatToParts(guess)
    .find((p) => p.type === 'timeZoneName')!.value // "GMT-04:00"
  const m = offset.match(/GMT([+-])(\d{2}):(\d{2})/)
  const sign = m && m[1] === '-' ? 1 : -1
  const mins = m ? sign * (Number(m[2]) * 60 + Number(m[3])) : 0
  return new Date(Date.UTC(year, month, day, 0, 0, 0) + mins * 60_000)
}

/** Last Friday of `month` (0-indexed) in `year`, at ET midnight. */
export function lastFridayET(year: number, month: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const dow = new Date(Date.UTC(year, month, lastDay)).getUTCDay()
  return etMidnight(year, month, lastDay - ((dow - 5 + 7) % 7))
}

function monthName(d: Date): string {
  return d.toLocaleDateString('en-US', { timeZone: ET, month: 'long' })
}

/**
 * Occurrences strictly after `lastSeeded`, within `horizonDays` of `now`.
 * With the current seed data this returns nothing until April 2027, at which
 * point it takes over without anyone touching the site.
 */
export function synthesizeWalkRideDays(
  now: Date,
  lastSeeded: Date | null,
  horizonDays: number,
): Promotable[] {
  const entry = FLAGSHIP_REGISTRY.find((f) => f.entry.seriesKey === 'walk-ride-day')?.entry
  if (!entry) return []

  const floor = lastSeeded && lastSeeded.getTime() > now.getTime() ? lastSeeded : now
  const horizon = new Date(now.getTime() + horizonDays * 86_400_000)
  const out: Promotable[] = []

  const cursor = new Date(Date.UTC(floor.getUTCFullYear(), floor.getUTCMonth(), 1))
  for (let i = 0; i < 18 && out.length < 6; i++) {
    const start = lastFridayET(cursor.getUTCFullYear(), cursor.getUTCMonth())
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    if (start.getTime() <= floor.getTime()) continue
    if (start.getTime() > horizon.getTime()) break
    const end = new Date(start.getTime() + 86_400_000 - 1000)
    out.push({
      id: `flagship:${entry.slug}:${start.toISOString().slice(0, 10)}`,
      kind: 'flagship',
      source: 'derived',
      title: `${monthName(start)} Walk/Ride Day`,
      icon: entry.icon,
      shortTitle: entry.shortTitle,
      blurb: entry.blurb,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      windowKind: 'event',
      singleDay: true,
      phase: 'upcoming',
      href: entry.href,
      // No rules link: there is no competitions row to enter.
      secondaryHref: null,
      secondaryLabel: null,
      event: { sponsorName: null, sponsorLogoUrl: null, seriesKey: 'walk-ride-day', seriesNextDates: [] },
      mechanic: null,
    })
  }
  return out
}
