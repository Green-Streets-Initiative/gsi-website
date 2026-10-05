// Plain-English rules for employer challenges.
//
// ONE source for how a challenge's counting rules are described: the portal
// form preview, the "Tell your team" announcement, the shareable rules page
// and the flyer all call describeChallengeRules. The Shift app renders the
// same sentences from the same fields (lib/challenge-rules.ts there, through
// i18n); both repos run the same cases in challenge-rules.test.ts so the two
// can't drift. drawingSentence and topSentence (drawing and leaderboard
// rewards, used only by the public rules page) are web-only and outside that
// parity set; they have their own cases in challenge-rules.test.ts. Server side the rules are applied by Shift 00970/00972
// (_counted_trips, effective_counting_rules) — keep the defaults in step.

export type CountingRules = {
  modes?: string[]
  min_walk_miles?: number
  max_trips_per_day?: number | null
  /** Only trips that start or end at one of this challenge's offices (Shift 01004). */
  commute_only?: boolean
  offices?: ChallengeOffice[]
}

export type ChallengeOffice = { address: string; lat: number; lng: number; radius_m?: number }

export const STANDARD_MODES = [
  'walk',
  'bike',
  'escooter',
  'transit_bus',
  'transit_train',
  'transit_commuter_rail',
  'ferry',
  // Carpools count by default (Keith 2026-09-28): for some people it's the
  // only practical option. Members mark them, since the phone can't tell.
  'carpool',
] as const

export const STANDARD_RULES: Required<CountingRules> = {
  modes: [...STANDARD_MODES],
  min_walk_miles: 0.5,
  max_trips_per_day: 2,
  commute_only: false,
  offices: [],
}

/** Same defaults as effective_counting_rules() in the database. */
export function effectiveRules(r: CountingRules | null | undefined): Required<CountingRules> {
  return {
    modes: r?.modes && r.modes.length > 0 ? r.modes : [...STANDARD_MODES],
    min_walk_miles: r?.min_walk_miles ?? 0.5,
    max_trips_per_day: r && 'max_trips_per_day' in r ? (r.max_trips_per_day ?? null) : 2,
    commute_only: r?.commute_only === true,
    offices: r?.offices ?? [],
  }
}

export function isStandardRules(r: CountingRules | null | undefined): boolean {
  const e = effectiveRules(r)
  return (
    e.min_walk_miles === 0.5 &&
    e.max_trips_per_day === 2 &&
    !e.commute_only &&
    e.modes.length === STANDARD_MODES.length &&
    STANDARD_MODES.every((m) => e.modes.includes(m))
  )
}

export type ChallengeRulesInput = {
  rules: CountingRules | null | undefined
  startsAt: string
  endsAt: string
  goal: number
  spots: number
  funded: boolean
  amountCents: number | null
  description: string | null
  requiresWorkEmail: boolean
  domains: string[]
  employer: string
  /** Office addresses, shown when the challenge counts commute trips only. */
  offices?: string[]
  contactName?: string | null
  contactEmail?: string | null
}

export function dollars(cents: number): string {
  const whole = cents % 100 === 0
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`
}

/** "Oct 6" in Eastern time (challenge days are Eastern days). */
export function etDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
}

function listAnd(items: string[]): string {
  if (items.length <= 1) return items.join('')
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function listOr(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`
}

function miles(n: number): string {
  return `${n} ${n === 1 ? 'mile' : 'miles'}`
}

/** A prize typed as "A company fleece" reads mid-sentence as "a company fleece". */
export function midSentence(text: string | null | undefined): string {
  const t = text?.trim() ?? ''
  return /^(A|An|The|One|Two|Three)\b/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t
}

export function prizeSentence(i: ChallengeRulesInput): string {
  const trips = `${i.goal} ${i.goal === 1 ? 'trip' : 'trips'}`
  const who = i.spots === 1 ? `The first person to reach ${trips} gets` : `The first ${i.spots} people to reach ${trips} each get`
  if (i.funded && i.amountCents) {
    return `${who} a ${dollars(i.amountCents)} gift card from ${i.employer}.`
  }
  return `${who} ${midSentence(i.description) || `a prize from ${i.employer}`}.`
}

/** What a winner gets: "a $25 gift card from Acme", or the prize as typed. */
function rewardPhrase(i: ChallengeRulesInput): string {
  if (i.funded && i.amountCents) return `a ${dollars(i.amountCents)} gift card from ${i.employer}`
  return midSentence(i.description) || `a prize from ${i.employer}`
}

const TOP_METRIC: Record<string, string> = {
  trips: 'active trips',
  active_days: 'active days',
  miles: 'miles shifted',
  pct_non_car: 'Shift Rate',
}

function num(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

/**
 * Who is in the drawing, in the measure the reward is drawn on
 * (draw_employer_challenge_prizes compares prize.metric with min_threshold):
 * "Everyone with 8 or more active days", "Everyone with a Shift Rate of 50%
 * or more", "Everyone who takes part" when there is no minimum.
 */
function entryPhrase(goal: number, metric: string | null | undefined): string {
  if (!(goal > 0)) return 'Everyone who takes part'
  switch (metric) {
    case 'active_days':
      return goal === 1 ? 'Everyone with at least one active day' : `Everyone with ${num(goal)} or more active days`
    case 'miles':
      return goal === 1 ? 'Everyone with at least one mile shifted' : `Everyone with ${num(goal)} or more miles shifted`
    case 'pct_non_car':
      return `Everyone with a Shift Rate of ${num(goal)}% or more`
    default:
      return goal === 1 ? 'Everyone with at least one active trip' : `Everyone with ${num(goal)} or more active trips`
  }
}

/**
 * A random drawing among everyone who reaches the entry minimum. Web only
 * (the public rules page); not part of the app parity set.
 */
export function drawingSentence(i: ChallengeRulesInput, metric?: string | null): string {
  const n = i.spots
  const win = n === 1 ? `One winner, picked at random, gets ${rewardPhrase(i)}.` : `${n} winners, picked at random, each get ${rewardPhrase(i)}.`
  return `${entryPhrase(i.goal, metric)} by ${etDate(i.endsAt)} is entered in a drawing. ${win}`
}

/** Top of the leaderboard when the challenge ends. Web only, like drawingSentence. */
export function topSentence(i: ChallengeRulesInput, metric: string | null | undefined): string {
  const by = TOP_METRIC[metric ?? 'trips'] ?? 'active trips'
  const most = metric === 'pct_non_car' ? 'the highest Shift Rate' : `the most ${by}`
  return i.spots === 1
    ? `The person with ${most} when the challenge ends gets ${rewardPhrase(i)}.`
    : `The top ${i.spots} by ${by} when the challenge ends each get ${rewardPhrase(i)}.`
}

/**
 * What to do, from the challenge's own rules, for flyers and short copy:
 * "Walk, bike, ride an e-scooter, carpool or take transit to or from the office."
 */
export function whatToDo(rules: CountingRules | null | undefined): string {
  const r = effectiveRules(rules)
  const verbs: string[] = []
  if (r.modes.includes('walk')) verbs.push('walk')
  if (r.modes.includes('bike')) verbs.push('bike')
  if (r.modes.includes('escooter')) verbs.push('ride an e-scooter')
  if (r.modes.includes('carpool')) verbs.push('carpool')
  if (['transit_bus', 'transit_train', 'transit_commuter_rail', 'ferry'].some((m) => r.modes.includes(m))) {
    verbs.push('take transit')
  }
  const list = listOr(verbs)
  return `${list.charAt(0).toUpperCase()}${list.slice(1)}${r.commute_only ? ' to or from the office' : ''}.`
}

/** Commute-only challenges: which trips qualify. */
export function officeSentence(i: ChallengeRulesInput): string {
  const where = (i.offices ?? effectiveRules(i.rules).offices.map((o) => o.address)).filter(Boolean)
  const plural = where.length > 1
  const list = where.length > 0 ? ` (${listOr(where)})` : ''
  return `Only trips that start or end at ${i.employer}'s ${plural ? 'offices' : 'office'}${list} count.`
}

/** What counts, in the order a member needs it. */
export function countingSentences(i: ChallengeRulesInput): string[] {
  const r = effectiveRules(i.rules)
  const out: string[] = []

  const parts: string[] = []
  if (r.modes.includes('walk')) {
    parts.push(r.min_walk_miles > 0 ? `walks of at least ${miles(r.min_walk_miles)}` : 'walks')
  }
  if (r.modes.includes('bike')) parts.push('bike rides')
  if (r.modes.includes('escooter')) parts.push('e-scooter rides')
  if (r.modes.includes('carpool')) parts.push('carpools')
  // Transit goes last: it is itself a list ("bus, subway, and ferry trips").
  const transit = [
    r.modes.includes('transit_bus') && 'bus',
    r.modes.includes('transit_train') && 'subway',
    r.modes.includes('transit_commuter_rail') && 'commuter rail',
    r.modes.includes('ferry') && 'ferry',
  ].filter(Boolean) as string[]
  if (transit.length > 0) parts.push(`${listAnd(transit)} trips`)
  const counts = listAnd(parts)
  out.push(`${counts.charAt(0).toUpperCase()}${counts.slice(1)} count.`)
  if (r.commute_only) out.push(officeSentence(i))

  const excluded = ['driving alone']
  if (!r.modes.includes('carpool')) excluded.push('carpools')
  if (!r.modes.includes('escooter')) excluded.push('e-scooter rides')
  const ex = listAnd(excluded)
  out.push(`${ex.charAt(0).toUpperCase()}${ex.slice(1)} ${excluded.length === 1 ? "doesn't" : "don't"} count.`)

  out.push(
    r.max_trips_per_day == null
      ? 'There is no daily limit.'
      : `Up to ${r.max_trips_per_day} ${r.max_trips_per_day === 1 ? 'trip' : 'trips'} a day count.`,
  )

  out.push(
    `Trips taken from ${etDate(i.startsAt)} through ${etDate(i.endsAt)} count, including ones from before you joined.`,
  )
  out.push("Shift has to record the trip automatically. Trips added by hand don't count.")
  out.push(
    'If Shift guessed a trip wrong (a train ride marked as a drive, say), tap the trip and fix it, and it will count.',
  )
  if (r.modes.includes('carpool')) {
    out.push('For a carpool to count, tap the trip and mark it as a carpool.')
  }
  return out
}

export function eligibilitySentence(i: ChallengeRulesInput): string | null {
  if (!i.requiresWorkEmail) return null
  const d = i.domains.length > 0 ? listOr(i.domains.map((x) => `@${x}`)) : 'work'
  return `To win, verify your ${d} email in the Shift app. It takes about a minute.`
}

export function orderSentence(): string {
  return 'Spots go in the order people reach the goal. We check about every 10 minutes.'
}

/** "a GSI fleece" → "GSI fleece", so a line can say "GSI fleece winners". Long
 *  descriptions (a sentence, not a noun) fall back to plain "winners". */
function prizeNoun(description: string | null | undefined): string | null {
  const t = (description ?? '').trim().replace(/[.!]+$/, '')
  if (!t || t.length > 40) return null
  return t.replace(/^(a|an|the|one)\s+/i, '')
}

/** One line per prize, named by the prize, so two prizes never share a
 *  "Winners" line: "Gift card winners pick..." and "Fleece winners tap Claim...". */
export function deliverySentence(i: ChallengeRulesInput): string {
  if (i.funded) {
    return 'Gift card winners pick their card in the app: a local shop, or a digital card from a brand they like.'
  }
  const noun = prizeNoun(i.description)
  const who = noun ? `${capitalizeFirst(noun)} winners` : 'Winners'
  const what = noun ? `the ${noun}` : 'the prize'
  return `${who} tap Claim in the app to share their name and email with ${i.employer}, who hands out ${what}.`
}

/** "Sep 21 to Oct 18, 2026" (or "Dec 28, 2026 to Jan 8, 2027") in Eastern time. */
export function etDateRange(startIso: string, endIso: string): string {
  const y = (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', timeZone: 'America/New_York' })
  const ys = y(startIso)
  const ye = y(endIso)
  if (etDate(startIso) === etDate(endIso) && ys === ye) return `${etDate(startIso)}, ${ys}`
  return ys === ye
    ? `${etDate(startIso)} to ${etDate(endIso)}, ${ye}`
    : `${etDate(startIso)}, ${ys} to ${etDate(endIso)}, ${ye}`
}

/** Who at the employer answers questions about the challenge. */
export function contactSentence(i: ChallengeRulesInput): string | null {
  const email = i.contactEmail?.trim()
  if (!email) return null
  const name = i.contactName?.trim()
  return name ? `Questions? Contact ${name} at ${email}.` : `Questions? Email ${email}.`
}

/** Every sentence, in reading order. */
export function describeChallengeRules(i: ChallengeRulesInput): string[] {
  const out = [prizeSentence(i), ...countingSentences(i)]
  const elig = eligibilitySentence(i)
  if (elig) out.push(elig)
  out.push(orderSentence(), deliverySentence(i))
  const contact = contactSentence(i)
  if (contact) out.push(contact)
  return out
}

function capitalizeFirst(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** "the November Commute Challenge", unless the name already starts with "The". */
function theName(name: string): string {
  return /^the\b/i.test(name.trim()) ? name.trim() : `the ${name.trim()}`
}

export type Announcement = { subject: string; email: string; chat: string; short: string }

/** Which note in the challenge's life: the kickoff, the halfway reminder, or the thank-you at the end. */
export type AnnouncementMoment = 'kickoff' | 'halfway' | 'wrapup'

export type AnnouncementInput = ChallengeRulesInput & {
  challengeName: string
  joinUrl: string
  rulesUrl: string
  /** Who the note comes from: "the Green Council", "HR". Defaults to the employer. */
  host?: string | null
  /** Defaults to the kickoff. */
  moment?: AnnouncementMoment
  /** "Today", for the days-left arithmetic; defaults to now. */
  now?: Date
}

/** Whole days from `now` to the end of the challenge's last day, never below 0. */
function daysLeft(endsAt: string, now: Date): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now.getTime()) / 86400000))
}

function daysLeftWords(n: number): string {
  if (n <= 0) return 'it ends today'
  return `${n} ${n === 1 ? 'day is' : 'days are'} left`
}

/**
 * Copy-ready text an employer sends their team. It explains what this is
 * before the mechanics (Keith 2026-09-28: opening on "the first 25 people to
 * reach 10 trips" is incoherent to someone who has never heard of Shift).
 *
 * Three moments (Keith 2026-09-30): the kickoff, a reminder halfway through
 * (what counts, days left, a nudge to keep logging, the reward), and a
 * wrap-up (thanks, check your award and rank in the app, next one coming).
 */
export function buildAnnouncement(i: AnnouncementInput): Announcement {
  const moment = i.moment ?? 'kickoff'
  if (moment === 'halfway') return buildHalfway(i)
  if (moment === 'wrapup') return buildWrapUp(i)
  return buildKickoff(i)
}

function buildKickoff(i: AnnouncementInput): Announcement {
  const counting = countingSentences(i)
  const elig = eligibilitySentence(i)
  const prize = prizeSentence(i)
  const host = i.host?.trim() || i.employer
  const hostIsEmployer = host === i.employer
  const dates = `${etDate(i.startsAt)} to ${etDate(i.endsAt)}`
  const r = effectiveRules(i.rules)
  const officeNote = r.commute_only ? ' This one is about getting to and from the office.' : ''

  const intro = `${capitalizeFirst(host)} is running ${theName(i.challengeName)}, a friendly commute challenge for everyone at ${i.employer}, from ${dates}. The goal is to help all of us explore the options for getting to and from work, like walking, biking, transit and carpooling, and to find what works for each of us.${officeNote}`
  const shiftLine = `We're using Shift, a free app from Green Streets Initiative, a Boston-area nonprofit. It records your walks, bike rides, transit trips and carpools on its own, so there's nothing to log. ${i.employer} sees your name and your trip totals, never your routes or where you go.`
  const steps = [
    `Download Shift and join our group: ${i.joinUrl}`,
    'Turn on trip tracking. Shift records your trips on its own from then on.',
    ...(elig ? [elig] : []),
  ]
  const email = [
    'Hi everyone,',
    '',
    intro,
    '',
    shiftLine,
    '',
    `${i.spots === 1 ? "There's a prize, too." : 'There are prizes, too.'} ${prize} ${orderSentence()}`,
    '',
    `How to join (about two minutes):`,
    ...steps.map((st, n) => `${n + 1}. ${st}`),
    '',
    'What counts:',
    ...counting.map((st) => `- ${st}`),
    '',
    deliverySentence(i),
    '',
    `Full rules: ${i.rulesUrl}`,
    ...(contactSentence(i) ? [contactSentence(i) as string] : []),
  ].join('\n')
  const chat = [
    `*${i.challengeName}* (${dates}): a friendly commute challenge for everyone at ${i.employer}, run by ${hostIsEmployer ? 'us' : host}. The idea is to try walking, biking, transit or carpooling for more of your trips to work and see what works for you.${officeNote}`,
    `It uses Shift, a free app that records your trips on its own. ${prize}`,
    `Join here: ${i.joinUrl}`,
    ...(elig ? [elig] : []),
    `Rules and what counts: ${i.rulesUrl}`,
    ...(contactSentence(i) ? [contactSentence(i) as string] : []),
  ].join('\n')
  const short = `${i.challengeName}, ${dates}: a friendly commute challenge for everyone at ${i.employer}. Try walking, biking, transit or carpooling to work, and Shift (a free app) records it for you. ${prize} Join: ${i.joinUrl}`
  return {
    subject: `Join ${theName(i.challengeName)}: a commute challenge for all of us at ${i.employer}`,
    email,
    chat,
    short,
  }
}

/** Halfway through: thanks so far, days left, a nudge to keep logging, the reward, how to join late. */
function buildHalfway(i: AnnouncementInput): Announcement {
  const prize = prizeSentence(i)
  const host = i.host?.trim() || i.employer
  const hostIsEmployer = host === i.employer
  const left = daysLeft(i.endsAt, i.now ?? new Date())
  const leftWords = daysLeftWords(left)
  const end = etDate(i.endsAt)
  const start = etDate(i.startsAt)
  const doIt = whatToDo(i.rules)
  const fixLine = 'If Shift guessed a trip wrong (a train ride marked as a drive, say), tap the trip and fix it so it counts.'

  const email = [
    'Hi everyone,',
    '',
    `We're about halfway through ${theName(i.challengeName)}, and ${leftWords} (it runs through ${end}). Thank you to everyone who has walked, biked, taken transit or carpooled so far: every one of those trips counts.`,
    '',
    `Not in yet? There's still time. Download Shift and join our group: ${i.joinUrl}. Trips from ${start} on count, including ones from before you joined, so starting today doesn't put you behind.`,
    '',
    `Already in? Open Shift to see where you stand and how many trips count so far. What counts hasn't changed: ${doIt.charAt(0).toLowerCase()}${doIt.slice(1)} ${fixLine}`,
    '',
    `A reminder on the reward: ${prize} ${orderSentence()}`,
    '',
    `Full rules: ${i.rulesUrl}`,
    ...(contactSentence(i) ? [contactSentence(i) as string] : []),
  ].join('\n')
  const chat = [
    `*${i.challengeName}*: halfway there, and ${leftWords} (through ${end}). Thanks to everyone logging trips so far${hostIsEmployer ? '' : `, from ${host}`}.`,
    `Not in yet? Join here: ${i.joinUrl}. Trips from ${start} on count, even from before you joined.`,
    `Already in? Open Shift to see where you stand. ${fixLine}`,
    `${prize}`,
    `Rules and what counts: ${i.rulesUrl}`,
    ...(contactSentence(i) ? [contactSentence(i) as string] : []),
  ].join('\n')
  const short = `${i.challengeName}: halfway there, ${leftWords} (through ${end}). Open Shift to see where you stand. Not in yet? Join: ${i.joinUrl}; trips from ${start} on count. ${prize}`
  return {
    subject: `Halfway through ${theName(i.challengeName)}: ${left <= 0 ? 'last day' : `${left} ${left === 1 ? 'day' : 'days'} left`}`,
    email,
    chat,
    short,
  }
}

/** After it ends: thanks, check your rank and award in the app, winners' next step, next one coming. */
function buildWrapUp(i: AnnouncementInput): Announcement {
  const host = i.host?.trim() || i.employer
  const hostIsEmployer = host === i.employer
  const end = etDate(i.endsAt)
  const thanks = hostIsEmployer ? 'Thank you' : `Thank you from ${host}`

  const email = [
    'Hi everyone,',
    '',
    `${capitalizeFirst(theName(i.challengeName))} wrapped up on ${end}. ${thanks} to everyone who took part: every walk, bike ride, transit trip and carpool counted, and together they added up.`,
    '',
    'Open Shift to see how you finished and to check your challenge award. Your rank and your trip count for the challenge are on the challenge page in the app.',
    '',
    deliverySentence(i),
    '',
    "We'll run another challenge soon. Keep Shift tracking in the meantime so your trips keep adding up, and keep an eye out for the next one.",
    '',
    ...(contactSentence(i) ? [contactSentence(i) as string] : []),
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim()
  const chat = [
    `*${i.challengeName}* wrapped up on ${end}. ${thanks} to everyone who took part: every walk, bike ride, transit trip and carpool counted.`,
    'Open Shift to see how you finished and to check your challenge award.',
    deliverySentence(i),
    "Another challenge is coming; keep Shift tracking in the meantime.",
    ...(contactSentence(i) ? [contactSentence(i) as string] : []),
  ].filter(Boolean).join('\n')
  const short = `${i.challengeName} is a wrap. Thank you to everyone who took part. Open Shift to see how you finished and to check your challenge award. Another one is coming soon.`
  return {
    subject: `${capitalizeFirst(theName(i.challengeName))} is a wrap: thank you`,
    email,
    chat,
    short,
  }
}
