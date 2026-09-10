/**
 * Shift Your Semester — web-side campaign glue.
 *
 * The in-app mechanic (Shift migration 00881): verify a .edu address at a
 * Massachusetts college → enrolled → 10 qualifying trips in 30 days unlock
 * a $15 rewards-catalog reward. This file is the single source of the
 * numbers and links the pages print, so the copy can't drift from the app.
 *
 * SEMESTER_CODE_LIVE gates every surface that prints the code: until the app
 * update that accepts SEMESTER has reached phones and the campaign is
 * switched on, a typed code is rejected and a stored one wiped. Flip
 * NEXT_PUBLIC_SEMESTER_CODE_LIVE=1 in Vercel at launch (no rebuild needed for
 * the env, but the pages are ISR — redeploy or wait for revalidation).
 */
export const SEMESTER_CODE = 'SEMESTER'
export const SEMESTER_CAMPAIGN = 'semester'
export const SEMESTER_REWARD_DOLLARS = 15
export const SEMESTER_TRIPS = 10
export const SEMESTER_WINDOW_DAYS = 30
export const SEMESTER_CAP = 200
export const SEMESTER_OPENS = 'September 15, 2026'
export const SEMESTER_CLOSES = 'December 15, 2026'

export const SEMESTER_CODE_LIVE = process.env.NEXT_PUBLIC_SEMESTER_CODE_LIVE === '1'

/** Reward phrasing used everywhere: "$15" */
export const SEMESTER_REWARD = `$${SEMESTER_REWARD_DOLLARS}`

export function isSemesterContext(search: string): boolean {
  const p = new URLSearchParams(search)
  return (p.get('utm_campaign') ?? '').toLowerCase() === SEMESTER_CAMPAIGN
}

/**
 * The app-open link for a school page CTA. Installed users land in the app
 * with the campaign recorded (the worker resolves /go/semester to
 * shift://campaign/semester); everyone else hits the worker's no-app
 * fallback (the campaign hub, which shows the code). The school is NOT in
 * the link — the school-email check decides it — so utm_content is for web
 * analytics only.
 */
export function buildSemesterAppHref(opts: { school?: string; source: string; medium: string }): string {
  const p = new URLSearchParams({
    utm_source: opts.source,
    utm_medium: opts.medium,
    utm_campaign: SEMESTER_CAMPAIGN,
  })
  if (opts.school) p.set('utm_content', opts.school)
  return `https://shift.gogreenstreets.org/go/semester?${p.toString()}`
}
