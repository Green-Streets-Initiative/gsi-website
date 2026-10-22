// How far along a workplace is in getting people into Shift, as stages
// rather than a done/not-done check (Keith 2026-10-22: "Employees have
// joined" read as done with 1 of 350). One definition for Home's Program
// health card and the Setup checklist.
//
// The thresholds are deliberately modest: most people at a workplace drive,
// and a challenge about walking, biking and transit speaks to a minority at
// first (Keith: "10% of headcount honestly seems like a stretch"). Revisit
// with the driver-inclusion positioning work.

import type { EmployerOnboarding, Group } from './portal-types'

/** Share of headcount that makes a first challenge worth running. */
export const READY_PCT = 3
/** ...and never fewer people than this, so a leaderboard has a field. */
export const READY_MIN_PEOPLE = 10
/** Share of headcount that counts as a strong start. */
export const STRONG_PCT = 10

export type StageTone = 'success' | 'warn' | 'info' | 'neutral'
export type Stage = { key: 'none' | 'just_started' | 'getting_going' | 'ready' | 'strong' | 'goal_met'; label: string; tone: StageTone }

export type Participation = {
  joined: number
  headcount: number | null
  /** Joined as a share of headcount, or null without a headcount. */
  pct: number | null
  /** Where the meter's marker sits: their own participation goal, else READY_PCT. */
  targetPct: number | null
  /** How many people that marker means, when there's a headcount. */
  readyAt: number
  /** Their own participation goal, when they set one on Setup. */
  goalPct: number | null
  stage: Stage
}

export function participation(group: Group, joined: number): Participation {
  const ob = (group.onboarding ?? {}) as EmployerOnboarding
  const headcount = ob.headcount && ob.headcount > 0 ? ob.headcount : null
  const goalPct = ob.goal_type === 'participation' && ob.goal_target_pct ? ob.goal_target_pct : null
  const pct = headcount ? (joined / headcount) * 100 : null
  const targetPct = headcount ? (goalPct ?? READY_PCT) : null
  const readyAt = headcount ? Math.max(READY_MIN_PEOPLE, Math.ceil((headcount * (goalPct ?? READY_PCT)) / 100)) : READY_MIN_PEOPLE

  let stage: Stage
  if (joined === 0) stage = { key: 'none', label: 'Nobody yet', tone: 'neutral' }
  else if (goalPct && pct != null && pct >= goalPct) stage = { key: 'goal_met', label: 'Goal reached', tone: 'success' }
  else if (pct != null && pct >= STRONG_PCT && joined >= READY_MIN_PEOPLE) stage = { key: 'strong', label: 'Strong', tone: 'success' }
  else if (joined >= readyAt) stage = { key: 'ready', label: 'Ready for a challenge', tone: 'success' }
  else if ((pct != null && pct >= 1) || joined >= 5) stage = { key: 'getting_going', label: 'Getting going', tone: 'info' }
  else stage = { key: 'just_started', label: 'Just started', tone: 'warn' }

  return { joined, headcount, pct, targetPct, readyAt, goalPct, stage }
}

/** Of the people who joined, how many logged a trip in the window. */
export function activity(active: number, joined: number): { pct: number | null; stage: Stage } {
  if (joined === 0) return { pct: null, stage: { key: 'none', label: 'Nobody yet', tone: 'neutral' } }
  const pct = (active / joined) * 100
  if (pct >= 50) return { pct, stage: { key: 'strong', label: 'Strong', tone: 'success' } }
  if (pct >= 25) return { pct, stage: { key: 'getting_going', label: 'Steady', tone: 'info' } }
  return { pct, stage: { key: 'just_started', label: 'Quiet', tone: 'warn' } }
}
