// The note an organizer forwards to staff, as the ready screen (TeamReady)
// shows it and the ready email carries it: one text, built here so the two
// never drift. "What counts" comes from the shared rules library
// (challenge-rules.ts), the same sentences the app, the flyer and the
// challenge's rules page use, with the round's standard rules.

import { countingSentences, type ChallengeRulesInput } from '@/lib/challenge-rules'
import { etEndOfDayIso, etStartOfDayIso } from '@/app/shift/employers/portal/_lib/portal-utils'
import { TEAM_CHALLENGE, challengeRulesPath } from './team-challenge'

const SITE = 'gogreenstreets.org'

/** The round's counting rules as the library wants them. The reward fields are unused by countingSentences. */
function roundRules(company: string): ChallengeRulesInput {
  return {
    rules: null,
    startsAt: etStartOfDayIso(TEAM_CHALLENGE.startsOn),
    endsAt: etEndOfDayIso(TEAM_CHALLENGE.endsOn),
    goal: 0,
    spots: 0,
    funded: false,
    amountCents: null,
    description: null,
    requiresWorkEmail: false,
    domains: [],
    employer: company,
  }
}

/** "Walks of at least 0.5 miles, bike rides, ... count. Up to 2 trips a day count." */
export function whatCountsSentence(company: string): string {
  const lines = countingSentences(roundRules(company))
  // The first line names what counts; the daily limit follows it. The rest
  // (how Shift records trips, fixing a guess) is on the rules page.
  const limit = lines.find((l) => /a day count|no daily limit/i.test(l))
  return [lines[0], limit].filter(Boolean).join(' ')
}

export function staffNote(team: { company: string; code: string; challengeId: string | null }): string {
  const c = TEAM_CHALLENGE
  const rules = challengeRulesPath(team.challengeId)
  return [
    `Our team commute challenge runs ${c.label.range}, and every trip counts for ${team.company}’s team. ${whatCountsSentence(team.company)} On ${c.label.wrd}, Walk/Ride Day, every trip also enters you in a gift card drawing.`,
    '',
    `1. Get the free Shift app and join our team: shift.gogreenstreets.org/join/${team.code}`,
    `   (or enter our invite code ${team.code} when you sign up)`,
    '2. Turn on trip tracking. The app records your trips by itself, so there’s nothing to log by hand. A carpool takes one tap.',
    '3. Check our team board in the app.',
    '',
    ...(rules ? [`Our challenge’s rules: ${SITE}${rules}`] : []),
    `The drawing is open to anyone 18 or older in Massachusetts. Walk/Ride Day rules: ${SITE}${c.rulesPath}`,
  ].join('\n')
}
