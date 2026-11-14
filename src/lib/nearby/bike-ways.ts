/**
 * Which of the ride planner's ways Around You lists for an opened bike trip,
 * and in what order (app and website alike: both read /api/nearby/trip/bike).
 * Pure, so it runs under `node --test`.
 */

/** A way is "out of the way" past this many times the quickest way's
 *  minutes, or this many minutes more, whichever is longer. Same limit as
 *  the app's calm-route lead (Shift lib/calm-route.ts CALM_DETOUR_*). */
const DETOUR_RATIO = 1.5
const DETOUR_MINUTES = 8

type Way = { minutes: number; calm_pct: number }

/** Another way is at least as quick and at least as calm, and better on one. */
function beatenBy<T extends Way>(options: T[], o: T): boolean {
  return options.some(x => x !== o && x.minutes <= o.minutes && x.calm_pct >= o.calm_pct && (x.minutes < o.minutes || x.calm_pct > o.calm_pct))
}

/**
 * The planner's order, except that a way another way beats on both time and
 * calm streets goes after the ones nothing beats, and is left out when it is
 * also far out of the way. The planner's score leans hard toward paths:
 * Central Square to Davis opened on a 39-minute, 5.7-mile ride over the hills
 * on the Community Path, while the way listed under it was 18 minutes, 3.1
 * miles and calmer (2026-11-13); Union Square to Davis listed a 29-minute,
 * 4.5-mile way under a 14-minute one that was calmer (2026-11-14). Across the
 * planner's 65 cached trips that week, 14 of 175 ways were dropped, each one
 * slower and no calmer than a way that stays. A calmer way is never dropped.
 */
export function orderWays<T extends Way>(options: T[]): T[] {
  if (options.length === 0) return options
  const quickest = Math.min(...options.map(o => o.minutes))
  const limit = Math.max(quickest * DETOUR_RATIO, quickest + DETOUR_MINUTES)
  const beaten = options.filter(o => beatenBy(options, o))
  return [
    ...options.filter(o => !beaten.includes(o)),
    ...beaten.filter(o => o.minutes <= limit),
  ]
}
