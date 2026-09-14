import type { CampusChallenge, School } from '@/lib/semester/schools'

/**
 * The school's own challenge, if one is running today (Eastern time), with
 * this month's prize resolved. Null outside the window, so the block and its
 * nav entry disappear on their own the day after it ends.
 */
export function activeCampusChallenge(school: School): (CampusChallenge & { thisMonth: string | null }) | null {
  const c = school.campusChallenge
  if (!c) return null
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) // YYYY-MM-DD
  if (today < c.startsAt || today >= c.endsAt) return null
  const month = Number(today.slice(5, 7))
  return { ...c, thisMonth: c.monthly.find((m) => m.month === month)?.prize ?? null }
}
