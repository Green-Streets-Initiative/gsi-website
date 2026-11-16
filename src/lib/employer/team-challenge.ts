// The self-serve team challenge (Keith 2026-10-22): a company signs up on
// /shift/employers/challenge, confirms its work email, and gets an invite
// code and its own team challenge built on GSI's statewide challenge for the
// month. One object per round; the page, the API and the emails read it, so
// the next round is a change here (and a new template run id).
//
// January 2027: three weeks, January 11 to 29, ending on Walk/Ride Day
// (employer item 23, Keith 2026-11-10). Built on GSI's statewide "Commute
// Month" January run (Shift 01738, run 26fbc69d) so the portal shows it as
// part of the season. A team that joins late gets a shorter window; sign-ups
// close after `lastJoinOn`. November 2026 was key nov-2026, run e8675612.

export const TEAM_CHALLENGE = {
  /** Stored on the group (onboarding.signup.key) so a second confirm finds the first team. */
  key: 'jan-2027',
  startsOn: '2027-01-11',
  endsOn: '2027-01-29',
  walkRideDay: '2027-01-29',
  lastJoinOn: '2027-01-22',
  templateSlug: 'commute-month',
  templateRunId: '26fbc69d-8e01-4597-a97b-50f900560960',
  /** The challenge's name in the app and the portal. */
  challengeName: 'January commute challenge',
  /** Staff-facing words on the challenge, shown in the app. */
  description:
    'Every walk, bike or scooter ride, bus, train, ferry or carpool counts for the team, January 11 to 29. On Friday, January 29, Walk/Ride Day, every trip also enters you in GSI’s gift card drawing, which GSI pays for.',
  /** Plain labels, so copy never has to format a date. */
  label: {
    range: 'January 11 to 29',
    wrd: 'Friday, January 29',
    lastJoin: 'Friday, January 22',
    /** The round's month, for "Sign-ups for January have closed". */
    monthName: 'January',
    /** "After January 29", for what happens once the round ends. */
    afterEnd: 'After January 29',
  },
  rulesPath: '/events/walk-ride-day/rules',
} as const

/** Today as an Eastern calendar date, 'YYYY-MM-DD'. */
export function todayEt(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

/** Sign-ups are open through the last join day (Eastern). */
export function signupOpen(now = new Date()): boolean {
  return todayEt(now) <= TEAM_CHALLENGE.lastJoinOn
}

/** The round is over: today (Eastern) is past its last day. */
export function roundEnded(now = new Date()): boolean {
  return todayEt(now) > TEAM_CHALLENGE.endsOn
}

/** The challenge's own rules page on this site, when the team has one. */
export function challengeRulesPath(challengeId: string | null): string | null {
  return challengeId ? `/shift/challenge/${challengeId}` : null
}

/** The printable flyer for a team, with its challenge when there is one. */
export function flyerPath(team: { slug: string | null; code: string; challengeId: string | null }): string {
  return `/shift/employers/flyer?group=${encodeURIComponent(team.slug ?? team.code)}${team.challengeId ? `&challenge=${team.challengeId}` : ''}`
}

// Free mail providers. The team belongs to a company, so the person signing
// up uses their work address; anyone without one writes to info@.
const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'aol.com', 'icloud.com', 'me.com', 'mac.com', 'comcast.net', 'verizon.net', 'att.net', 'proton.me',
  'protonmail.com', 'pm.me', 'gmx.com', 'mail.com', 'zoho.com', 'fastmail.com', 'hey.com',
])

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split('@')[1] ?? ''
}

export function isPersonalEmail(email: string): boolean {
  return PERSONAL_DOMAINS.has(emailDomain(email))
}

/** A team made by the self-serve sign-up, as the confirm screen shows it. */
export type TeamResult = {
  groupId: string
  company: string
  slug: string | null
  code: string
  challengeId: string | null
  /** The organizer's work email domain. */
  domain: string
  /**
   * Whether the sign-up email's domain matched the company website at
   * sign-up (team-challenge-domain.ts). When it did not, the Shift server
   * limits the team's invitations to its own domain until an admin adds
   * more in Settings, and the ready screen says so.
   */
  domainVerified: boolean
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
