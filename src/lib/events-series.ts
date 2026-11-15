/**
 * A repeating event's lasting address (calendar plan bet 4, SEO hyp-15).
 *
 * A weekly ride gets a new page every week ("…-2026-11-19", "…-2026-11-26"),
 * so whatever rank one date earns is gone the day after. The series page
 * (/events/series/<host>/<name>) always shows the next date, and every dated
 * page names it as its canonical, so the rank builds on one address.
 *
 * No table: an event's slug is "<title>-<YYYY-MM-DD>" (Shift 01037), so the
 * dates of one series share the slug up to the date. Two hosts can both run a
 * "Walking Group", so the host's name is the other half of the address.
 */

const SLUG_DATE = /-\d{4}-\d{2}-\d{2}(-\d+)?$/
const SLUG_PART = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** At least this many dates in all, or UPCOMING_FOR_SERIES still ahead. */
export const DATES_FOR_SERIES = 3
export const UPCOMING_FOR_SERIES = 2

/** "wednesday-wheelers-2026-11-18" → "wednesday-wheelers"; null when the slug carries no date. */
export function seriesNameSlug(eventSlug: string | null | undefined): string | null {
  if (!eventSlug || !SLUG_DATE.test(eventSlug)) return null
  const name = eventSlug.replace(SLUG_DATE, '')
  return SLUG_PART.test(name) ? name : null
}

/** "Charles River Wheelers" → "charles-river-wheelers"; events with no host share "community". */
export function seriesHostSlug(organizerName: string | null | undefined): string {
  const slug = (organizerName ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘"“”]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  return slug || 'community'
}

export function isSeriesSlugPart(part: string): boolean {
  return SLUG_PART.test(part) && part.length <= 80
}

/** The series address an event would live under, whether or not it repeats often enough to have one. */
export function seriesPath(e: { slug?: string | null; organizer_name?: string | null }): string | null {
  const name = seriesNameSlug(e.slug)
  return name ? `/events/series/${seriesHostSlug(e.organizer_name)}/${name}` : null
}

/** Is this event's slug one of the dates of the series called `name`? */
export function isDateOfSeries(eventSlug: string | null | undefined, name: string): boolean {
  return seriesNameSlug(eventSlug) === name
}

export function seriesQualifies(total: number, upcoming: number): boolean {
  return total >= DATES_FOR_SERIES || upcoming >= UPCOMING_FOR_SERIES
}
