/*
 * Phase, bucketing, and the nav pick.
 *
 * Ported from the Shift app's components/CampaignHomeCard.tsx, which is the
 * source of truth for this logic. Kept deliberately dependency-free — no
 * next/*, no @supabase/*, and `now` is always a parameter rather than
 * Date.now() — so that (a) every case is a table test with no clock mocking
 * and (b) the app repo can eventually share this file instead of forking it.
 */

import type { Promotable, PromotablePhase } from './types'

/** How far ahead the nav will look. The hub looks further. */
export const NAV_UPCOMING_DAYS = 14

export function phaseOf(w: { startsAt: string; endsAt: string }, now: Date): PromotablePhase {
  const t = now.getTime()
  if (new Date(w.endsAt).getTime() < t) return 'wrapped'
  if (new Date(w.startsAt).getTime() > t) return 'upcoming'
  return 'active'
}

/** Stable order for exact ties, so two renders in one request never disagree. */
function tiebreak(a: Promotable, b: Promotable): number {
  const s = new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
  if (s !== 0) return s // the later-starting, more specific event wins
  if (a.source !== b.source) return a.source === 'db' ? -1 : 1
  return a.id.localeCompare(b.id)
}

export function bucket(items: Promotable[], now: Date) {
  const withPhase = items.map((p) => ({ ...p, phase: phaseOf(p, now) }))
  return {
    // ENDING SOONEST FIRST. This is the load-bearing rule, ported verbatim in
    // spirit from CampaignHomeCard: a one-day Walk/Ride Day nested inside a
    // two-month campaign has to win its own day. Sorting by start date, or by
    // name, silently breaks that.
    active: withPhase
      .filter((p) => p.phase === 'active')
      .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime() || tiebreak(a, b)),
    upcoming: withPhase
      .filter((p) => p.phase === 'upcoming')
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() || tiebreak(a, b)),
    wrapped: withPhase
      .filter((p) => p.phase === 'wrapped')
      .sort((a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime() || tiebreak(a, b)),
  }
}

/**
 * Collapse a recurring series to its earliest live occurrence, moving the
 * later dates into seriesNextDates. Without this a 90-day horizon lists three
 * Walk/Ride Days as three equal entries.
 */
export function collapseSeries(items: Promotable[]): Promotable[] {
  const seen = new Map<string, Promotable>()
  const out: Promotable[] = []
  for (const p of items) {
    const key = p.event?.seriesKey
    if (!key) {
      out.push(p)
      continue
    }
    const first = seen.get(key)
    if (!first) {
      const clone = { ...p, event: { ...p.event!, seriesNextDates: [] as string[] } }
      seen.set(key, clone)
      out.push(clone)
    } else {
      first.event!.seriesNextDates.push(p.startsAt)
    }
  }
  return out
}

/**
 * What the nav shows: the thing happening now, else the next thing inside the
 * horizon, else NOTHING.
 *
 * Deliberately diverges from CampaignHomeCard's `active ?? upcoming ?? wrap`.
 * There is no wrap fallback, because a nav naming a finished campaign is the
 * exact bug this replaces — production promoted Shift Your Summer for thirty
 * days after it ended. Wrap belongs on the hub, under a heading that says so.
 */
export function pickNavPromo(
  items: Promotable[],
  now: Date,
  opts: { upcomingWindowDays?: number } = {},
): Promotable | null {
  const horizon = opts.upcomingWindowDays ?? NAV_UPCOMING_DAYS
  const b = bucket(items, now)
  if (b.active.length) return b.active[0]
  const cutoff = now.getTime() + horizon * 86_400_000
  return b.upcoming.find((p) => new Date(p.startsAt).getTime() <= cutoff) ?? null
}
