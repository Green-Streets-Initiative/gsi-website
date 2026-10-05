/**
 * Goal pace for employers: is the team on track for the goal they picked on
 * Setup, and what would help. Pure math and plain-words sentences, shared by
 * the portal's Home card (GoalProgressCard) and the Monday digest email.
 * No React, no Supabase, no imports: callers pass in what they already have.
 *
 * Dates are calendar days in Eastern time. A target date of Nov 15 means
 * "by the end of Nov 15".
 */

export type GoalType = 'participation' | 'mode_shift' | 'parking' | 'wellness' | 'benefit_uptake'

/** The groups.onboarding keys this file reads (all optional). */
export type GoalOnboardingLike = {
  goal_type?: GoalType | null
  goal_target_pct?: number | null
  goal_target_date?: string | null
  headcount?: number | null
  /** Older plans (and the digest mirror) keep the participation target here. */
  target_signup_pct?: number | null
  launch_date?: string | null
}

export type ResolvedGoal = {
  type: GoalType
  /** 1–100, or null when the target was left blank. */
  targetPct: number | null
  /** YYYY-MM-DD, or null. */
  targetDate: string | null
  headcount: number | null
  /** YYYY-MM-DD, or null. */
  launchDate: string | null
}

const DAY_MS = 86_400_000
const TZ = 'America/New_York'
/** How far back the recent join rate looks. */
export const PACE_WINDOW_DAYS = 28
/** Shorter than this since launch and the rate is too noisy for a verdict. */
const MIN_PACE_DAYS = 7

const GOAL_TYPES: GoalType[] = ['participation', 'mode_shift', 'parking', 'wellness', 'benefit_uptake']

function isoDay(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

function positive(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null
}

/** The goal on the plan, or null when none was picked. Older plans count as participation. */
export function resolveGoal(ob: GoalOnboardingLike | null | undefined): ResolvedGoal | null {
  if (!ob) return null
  const picked = ob.goal_type && GOAL_TYPES.includes(ob.goal_type) ? ob.goal_type : null
  const type: GoalType | null = picked ?? (positive(ob.target_signup_pct) ? 'participation' : null)
  if (!type) return null
  const pct =
    type === 'participation' ? (positive(ob.goal_target_pct) ?? positive(ob.target_signup_pct)) : positive(ob.goal_target_pct)
  const headcount = positive(ob.headcount)
  return {
    type,
    targetPct: pct == null ? null : Math.min(100, pct),
    targetDate: isoDay(ob.goal_target_date),
    headcount: headcount == null ? null : Math.round(headcount),
    launchDate: isoDay(ob.launch_date),
  }
}

// ── Dates (Eastern) ──────────────────────────────────────────────────────

/** Today's date in Eastern time, YYYY-MM-DD. */
export function todayEt(now: Date): string {
  return now.toLocaleDateString('en-CA', { timeZone: TZ })
}

function dayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY_MS
}

/** Whole calendar days from today (Eastern) to the date: 0 = today, negative = past. */
export function daysUntil(isoDate: string, now: Date): number {
  return dayIndex(isoDate) - dayIndex(todayEt(now))
}

/** "Nov 15", or "Nov 15, 2027" when it isn't this year. */
export function formatGoalDate(isoDate: string, now: Date): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  const sameYear = isoDate.slice(0, 4) === todayEt(now).slice(0, 4)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  })
}

/** Midnight Eastern at the start of that calendar day, close enough for counting joins. */
function startOfEtDay(isoDate: string): number {
  // 05:00 UTC is midnight EST and 1am EDT; an hour either way doesn't move a weekly rate.
  return Date.parse(`${isoDate}T05:00:00Z`)
}

// ── Participation ────────────────────────────────────────────────────────

/**
 * The stretch the recent join rate is measured over: the last 4 weeks, or
 * since launch (or since the account opened) when that is more recent.
 */
export function paceWindow(args: {
  now: Date
  launchDate: string | null
  accessStartsAt?: string | null
}): { startMs: number; days: number; sinceLaunch: boolean } {
  const nowMs = args.now.getTime()
  let startMs = nowMs - PACE_WINDOW_DAYS * DAY_MS
  let sinceLaunch = false
  const launchMs = args.launchDate ? startOfEtDay(args.launchDate) : NaN
  if (Number.isFinite(launchMs) && launchMs <= nowMs && launchMs > startMs) {
    startMs = launchMs
    sinceLaunch = true
  }
  const accessMs = args.accessStartsAt ? Date.parse(args.accessStartsAt) : NaN
  if (Number.isFinite(accessMs) && accessMs <= nowMs && accessMs > startMs) {
    startMs = accessMs
    sinceLaunch = false
  }
  return { startMs, days: (nowMs - startMs) / DAY_MS, sinceLaunch }
}

/** Joins inside the window, from join timestamps the caller already has. */
export function countJoinsSince(joinedAt: Array<string | null | undefined>, startMs: number): number {
  let n = 0
  for (const iso of joinedAt) {
    if (!iso) continue
    const t = Date.parse(iso)
    if (Number.isFinite(t) && t >= startMs) n++
  }
  return n
}

export type ParticipationStatus =
  /** Goal met. */
  | 'reached'
  /** The recent rate, carried to the target date, gets there. */
  | 'on_track'
  /** It doesn't. */
  | 'behind'
  /** Target date has passed and the goal wasn't met. */
  | 'past_due'
  /** No target date: progress only. */
  | 'no_date'
  /** Launch date still ahead. */
  | 'not_launched'
  /** Under a week since launch: too soon to judge. */
  | 'early'
  /** The caller had no join counts. */
  | 'unknown_rate'

export type ParticipationPace = {
  status: ParticipationStatus
  goalCount: number
  current: number
  remaining: number
  /** current ÷ goal, 0–100. */
  progressPct: number
  targetDate: string | null
  daysLeft: number | null
  /** People a week still needed, rounded up; null without a date ahead. */
  neededPerWeek: number | null
  /** People a week over the window; null when unknown. */
  recentPerWeek: number | null
  windowDays: number | null
  /** The verdict in one or two plain sentences. */
  sentence: string
}

const people = (n: number) => (n === 1 ? 'person' : 'people')

function rateWords(perWeek: number): string {
  if (perWeek <= 0) return 'no one'
  if (perWeek < 1) return 'fewer than 1 person'
  const r = Math.round(perWeek)
  return `about ${r} ${people(r)}`
}

function windowWords(days: number, sinceLaunch: boolean, launchLabel: string | null): string {
  if (days >= PACE_WINDOW_DAYS - 0.5) return 'the last 4 weeks'
  if (sinceLaunch && launchLabel) return `the ${Math.round(days)} days since launch on ${launchLabel}`
  return `the last ${Math.round(days)} days`
}

/** The number of people the participation goal works out to. */
export function participationGoalCount(goal: ResolvedGoal): number | null {
  if (goal.type !== 'participation' || !goal.targetPct || !goal.headcount) return null
  return Math.max(1, Math.ceil((goal.headcount * goal.targetPct) / 100))
}

/**
 * Where a participation goal stands. `joinsInWindow` is how many current
 * members joined inside `window`; pass null when unknown (no verdict then).
 * Returns null when the goal has no headcount or target to count against.
 */
export function participationPace(args: {
  goal: ResolvedGoal
  current: number
  joinsInWindow: number | null
  window: { startMs: number; days: number; sinceLaunch: boolean }
  now: Date
}): ParticipationPace | null {
  const { goal, current, joinsInWindow, window, now } = args
  const goalCount = participationGoalCount(goal)
  if (goalCount == null) return null

  const remaining = Math.max(0, goalCount - current)
  const progressPct = Math.min(100, Math.round((current / goalCount) * 100))
  const targetDate = goal.targetDate
  const daysLeft = targetDate ? daysUntil(targetDate, now) : null
  const dateLabel = targetDate ? formatGoalDate(targetDate, now) : null
  const launchLabel = goal.launchDate ? formatGoalDate(goal.launchDate, now) : null
  const launchAhead = goal.launchDate ? daysUntil(goal.launchDate, now) > 0 : false

  const base = {
    goalCount,
    current,
    remaining,
    progressPct,
    targetDate,
    daysLeft,
    neededPerWeek: null as number | null,
    recentPerWeek: null as number | null,
    windowDays: null as number | null,
  }

  if (current >= goalCount) {
    return {
      ...base,
      status: 'reached',
      sentence: `You've reached your goal of ${goalCount} ${people(goalCount)}. ${current} have joined so far.`,
    }
  }

  if (!targetDate || daysLeft == null || !dateLabel) {
    return {
      ...base,
      status: 'no_date',
      sentence: `${remaining} more ${people(remaining)} to reach your goal of ${goalCount}.`,
    }
  }

  if (daysLeft < 0) {
    return {
      ...base,
      status: 'past_due',
      sentence: `Your target date, ${dateLabel}, has passed with ${current} of ${goalCount} joined. Set a new date on Setup to see your pace again.`,
    }
  }

  // People a week still needed. Within the last week, say the total instead.
  const weeksLeft = Math.max(daysLeft, 1) / 7
  const neededPerWeek = Math.max(1, Math.ceil(remaining / weeksLeft))
  const needSentence =
    daysLeft < 7
      ? `You need ${remaining} more ${people(remaining)} by ${dateLabel}.`
      : `You need about ${neededPerWeek} more ${people(neededPerWeek)} a week to reach ${goalCount} by ${dateLabel}.`

  if (launchAhead && launchLabel) {
    const daysAfterLaunch = daysLeft - daysUntil(goal.launchDate!, now)
    const perWeekFromLaunch = Math.max(1, Math.ceil(remaining / (daysAfterLaunch / 7)))
    const fromLaunch =
      daysAfterLaunch >= 7
        ? ` From then, about ${perWeekFromLaunch} ${people(perWeekFromLaunch)} a week will get you to ${goalCount} by ${dateLabel}.`
        : ''
    return {
      ...base,
      status: 'not_launched',
      neededPerWeek,
      sentence: `You launch on ${launchLabel}.${fromLaunch}`.trim(),
    }
  }

  if (joinsInWindow == null) {
    return { ...base, status: 'unknown_rate', neededPerWeek, sentence: needSentence }
  }

  if (window.days < MIN_PACE_DAYS) {
    const since = window.sinceLaunch && launchLabel ? `since launch on ${launchLabel}` : 'so far'
    return {
      ...base,
      status: 'early',
      neededPerWeek,
      windowDays: window.days,
      sentence: `${needSentence} ${joinsInWindow} ${joinsInWindow === 1 ? 'has' : 'have'} joined ${since}; your pace shows after the first week.`,
    }
  }

  const recentPerWeek = joinsInWindow / (window.days / 7)
  const projected = current + recentPerWeek * (daysLeft / 7)
  const span = windowWords(window.days, window.sinceLaunch, launchLabel)
  const recent =
    recentPerWeek <= 0
      ? `No one has joined in ${span}.`
      : `In ${span}, ${rateWords(recentPerWeek)} a week joined.`

  if (projected >= goalCount) {
    return {
      ...base,
      status: 'on_track',
      neededPerWeek,
      recentPerWeek,
      windowDays: window.days,
      sentence: `At the recent pace of ${rateWords(recentPerWeek)} a week, you're on track to reach ${goalCount} by ${dateLabel}.`,
    }
  }
  return {
    ...base,
    status: 'behind',
    neededPerWeek,
    recentPerWeek,
    windowDays: window.days,
    sentence: `${needSentence} ${recent}`,
  }
}

// ── Shift Rate ───────────────────────────────────────────────────────────

export type ModeShiftPace = {
  status: 'on_track' | 'behind' | 'no_data'
  currentPct: number | null
  targetPct: number
  /** Points short of the target; 0 when at or above. */
  gapPts: number
  /** current ÷ target, 0–100. */
  progressPct: number
  sentence: string
}

/** A Shift Rate goal against the measured rate. `windowLabel` e.g. "the last 30 days". */
export function modeShiftPace(args: {
  goal: ResolvedGoal
  currentPct: number | null | undefined
  trips: number
  windowLabel: string
  now: Date
}): ModeShiftPace | null {
  const { goal, trips, windowLabel, now } = args
  if (goal.type !== 'mode_shift' || !goal.targetPct) return null
  const targetPct = goal.targetPct
  const by = goal.targetDate ? ` by ${formatGoalDate(goal.targetDate, now)}` : ''
  if (trips <= 0 || args.currentPct == null || !Number.isFinite(args.currentPct)) {
    return {
      status: 'no_data',
      currentPct: null,
      targetPct,
      gapPts: 0,
      progressPct: 0,
      sentence: `No trips recorded in ${windowLabel} yet, so there's no Shift Rate to compare with your ${targetPct}% target.`,
    }
  }
  const current = Math.round(args.currentPct)
  const gapPts = Math.max(0, targetPct - current)
  const progressPct = Math.min(100, Math.round((current / targetPct) * 100))
  if (gapPts === 0) {
    return {
      status: 'on_track',
      currentPct: current,
      targetPct,
      gapPts,
      progressPct,
      sentence: `Your Shift Rate over ${windowLabel} is ${current}%, at or above your ${targetPct}% target${by}.`,
    }
  }
  return {
    status: 'behind',
    currentPct: current,
    targetPct,
    gapPts,
    progressPct,
    sentence: `Your Shift Rate over ${windowLabel} is ${current}%, ${gapPts} ${gapPts === 1 ? 'point' : 'points'} below your ${targetPct}% target${by}.`,
  }
}

// ── Goal wording and next steps ─────────────────────────────────────────

/** The goal in one line: "Less pressure on parking: 15% fewer drive-alone trips by Jun 30". */
export function goalSentence(goal: ResolvedGoal, now: Date): string {
  const by = goal.targetDate ? ` by ${formatGoalDate(goal.targetDate, now)}` : ''
  const pct = goal.targetPct
  switch (goal.type) {
    case 'participation': {
      const count = participationGoalCount(goal)
      if (pct && goal.headcount && count) {
        return `${pct}% of about ${goal.headcount} employees signed up (${count} ${people(count)})${by}`
      }
      return `Getting employees to join and log trips${by}`
    }
    case 'mode_shift':
      return pct ? `A Shift Rate of ${pct}%${by}` : `A mode-shift number for your sustainability report${by}`
    case 'parking':
      return `Less pressure on parking${pct ? `: ${pct}% fewer drive-alone trips` : ''}${by}`
    case 'wellness':
      return `A wellness benefit people use${pct ? `: ${pct}% of employees active each month` : ''}${by}`
    case 'benefit_uptake':
      return `More use of your commuter benefits${pct ? `: ${pct}% of employees active each month` : ''}${by}`
  }
}

export type GoalStepKey = 'invite' | 'champions' | 'challenge' | 'flyer' | 'blurb' | 'advisor'

export type GoalStep = {
  key: GoalStepKey
  label: string
  /** Path under the employer portal ("/employees"), or the flyer (built by the caller). */
  path: string
}

export const GOAL_STEPS: Record<GoalStepKey, GoalStep> = {
  invite: { key: 'invite', label: "Email an invite to people who haven't joined", path: '/employees' },
  champions: { key: 'champions', label: 'Ask your champions to share', path: '/setup' },
  challenge: { key: 'challenge', label: 'Start a challenge', path: '/challenges?new=1' },
  flyer: { key: 'flyer', label: 'Print the flyer', path: 'flyer' },
  blurb: { key: 'blurb', label: 'Share the team blurb', path: '/share-kit' },
  advisor: { key: 'advisor', label: 'Show your commute benefits', path: '/advisor' },
}

const STEPS_BY_GOAL: Record<GoalType, GoalStepKey[]> = {
  participation: ['invite', 'champions', 'flyer', 'blurb'],
  mode_shift: ['challenge', 'blurb', 'champions'],
  parking: ['challenge', 'blurb', 'flyer'],
  wellness: ['challenge', 'invite', 'champions'],
  benefit_uptake: ['advisor', 'blurb', 'challenge'],
}

/** The 2–4 things that help most with this kind of goal, best first. */
export function goalSteps(type: GoalType): GoalStep[] {
  return STEPS_BY_GOAL[type].map((k) => GOAL_STEPS[k])
}
