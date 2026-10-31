// The self-serve team challenge (Keith 2026-10-22): a company signs up on
// /shift/employers/challenge, confirms its work email, and gets an invite
// code and its own team challenge built on GSI's statewide challenge for the
// month. One object per round; the page, the API and the emails read it, so
// the next round is a change here (and a new template run id).
//
// November 2026: three weeks, November 2 to 20, ending on Walk/Ride Day.
// It is built on GSI's statewide "Commute Month" (Shift 01024, run
// e8675612) so the portal shows it as part of the season. A team that joins
// late gets a shorter window; sign-ups close after `lastJoinOn`.

export const TEAM_CHALLENGE = {
  /** Stored on the group (onboarding.signup.key) so a second confirm finds the first team. */
  key: 'nov-2026',
  startsOn: '2026-11-02',
  endsOn: '2026-11-20',
  walkRideDay: '2026-11-20',
  lastJoinOn: '2026-11-13',
  templateSlug: 'commute-month',
  templateRunId: 'e8675612-c111-4353-958b-fd07599d8775',
  /** The challenge's name in the app and the portal. */
  challengeName: 'November commute challenge',
  /** Staff-facing words on the challenge, shown in the app. */
  description:
    'Every walk, bike or scooter ride, bus, train, ferry or carpool counts for the team, November 2 to 20. On Friday, November 20, Walk/Ride Day, every trip also enters you in GSI’s gift card drawing, which GSI pays for.',
  /** Plain labels, so copy never has to format a date. */
  label: {
    range: 'November 2 to 20',
    wrd: 'Friday, November 20',
    lastJoin: 'Friday, November 13',
    /** The round's month, for "Sign-ups for November have closed". */
    monthName: 'November',
    /** "After November 20", for what happens once the round ends. */
    afterEnd: 'After November 20',
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
