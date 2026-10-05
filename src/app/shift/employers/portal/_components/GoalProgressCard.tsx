'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { Compass, Megaphone, Printer, Share2, Trophy, UserPlus, type LucideIcon } from 'lucide-react'
import { Card, CardHead, CardBody } from '@/components/employer/Card'
import ProgressBar from '@/components/employer/ProgressBar'
import Badge from '@/components/employer/Badge'
import Button from '@/components/employer/Button'
import {
  countJoinsSince,
  goalSentence,
  goalSteps,
  modeShiftPace,
  paceWindow,
  participationPace,
  resolveGoal,
  type GoalStepKey,
  type GoalType,
} from '@/lib/employer/goal-pace'
import type { DashboardData, EmployerMember, Group } from '../_lib/portal-types'

const PORTAL = '/shift/employers/portal'

/** Wall clock, kept out of render so the purity lint stays quiet. */
const wallClock = () => new Date()

const STEP_ICON: Record<GoalStepKey, LucideIcon> = {
  invite: UserPlus,
  champions: Megaphone,
  challenge: Trophy,
  flyer: Printer,
  blurb: Share2,
  advisor: Compass,
}

type Verdict = { label: string; tone: 'success' | 'warn' } | null

/** The nearest number we track for goals we can't measure directly. */
type Proxy = { figure: string; caption: string } | null

/**
 * "Your goal" on Home: the goal the employer picked on Setup, how far along
 * they are, whether the recent pace gets them there, and the few things that
 * help most when it doesn't. The math lives in src/lib/employer/goal-pace.ts,
 * which the Monday digest shares, so the two always agree.
 *
 * `dashboard` must be the last-30-days payload (null while another window is
 * loaded); `members` are the context's members, whose `joined_at` gives the
 * recent join rate and whose `active_trips_in_period` covers the same 30 days.
 */
export default function GoalProgressCard({
  group,
  memberCount,
  members,
  dashboard,
  canEdit,
  setupNagging,
}: {
  group: Group
  memberCount: number
  members: EmployerMember[]
  dashboard: DashboardData | null
  canEdit: boolean
  /** True when the hero is already asking them to set a goal; the no-goal prompt stays out of its way. */
  setupNagging: boolean
}) {
  const router = useRouter()

  const view = useMemo(() => {
    const now = wallClock()
    const goal = resolveGoal(group.onboarding)
    if (!goal) return null

    const headline = goalSentence(goal, now)
    let verdict: Verdict = null
    let progress: { pct: number; left: string; right: string } | null = null
    let sentence: string | null = null
    let proxy: Proxy = null
    let incomplete: string | null = null
    let showSteps = true

    const trips = dashboard?.trips_this_period ?? 0

    if (goal.type === 'participation') {
      const win = paceWindow({ now, launchDate: goal.launchDate, accessStartsAt: group.access_starts_at })
      const pace = participationPace({
        goal,
        current: memberCount,
        joinsInWindow: countJoinsSince(
          members.map((m) => m.joined_at),
          win.startMs,
        ),
        window: win,
        now,
      })
      if (!pace) {
        incomplete = 'Add your headcount and a target on Setup to see your progress here.'
      } else {
        progress = {
          pct: pace.progressPct,
          left: `${pace.current} of ${pace.goalCount} joined`,
          right: `${pace.progressPct}%`,
        }
        sentence = pace.sentence
        if (pace.status === 'reached') verdict = { label: 'Reached', tone: 'success' }
        else if (pace.status === 'on_track') verdict = { label: 'On track', tone: 'success' }
        else if (pace.status === 'behind' || pace.status === 'past_due') verdict = { label: 'Behind', tone: 'warn' }
        showSteps = pace.status !== 'reached' && pace.status !== 'on_track'
      }
    } else if (goal.type === 'mode_shift') {
      const pace = dashboard
        ? modeShiftPace({
            goal,
            currentPct: dashboard.shift_rate_trip_pct,
            trips,
            windowLabel: 'the last 30 days',
            now,
          })
        : null
      if (!goal.targetPct) {
        incomplete = 'Add a target Shift Rate on Setup to see your progress here.'
      } else if (pace && pace.status !== 'no_data') {
        progress = {
          pct: pace.progressPct,
          left: `Shift Rate ${pace.currentPct}%, last 30 days`,
          right: `Target ${pace.targetPct}%`,
        }
        sentence = pace.sentence
        verdict = pace.status === 'on_track' ? { label: 'On track', tone: 'success' } : { label: 'Behind', tone: 'warn' }
        showSteps = pace.status === 'behind'
      } else if (pace) {
        sentence = pace.sentence
      }
    } else {
      proxy = proxyFigure(goal.type, dashboard, members, trips)
    }

    const steps = showSteps ? goalSteps(goal.type) : []
    return { type: goal.type, headline, verdict, progress, sentence, proxy, incomplete, steps }
  }, [group.onboarding, group.access_starts_at, memberCount, members, dashboard])

  if (!view) {
    // No goal picked. The hero already asks when "say what success looks
    // like" is the next setup step; viewers can't set one.
    if (setupNagging || !canEdit) return null
    return (
      <Card pad>
        <p className="text-[14px] leading-[1.5] text-ink-muted">
          <Link href={`${PORTAL}/setup`} className="font-semibold text-accent no-underline hover:underline">
            Set a goal on Setup
          </Link>{' '}
          and Home will show whether your team is on pace, and what to do if it isn&apos;t.
        </p>
      </Card>
    )
  }

  const flyerHref = `/shift/employers/flyer?group=${encodeURIComponent(group.slug ?? group.invite_code)}`

  function go(key: GoalStepKey, path: string) {
    if (key === 'flyer') {
      window.open(flyerHref, '_blank', 'noopener')
      return
    }
    router.push(`${PORTAL}${path}`)
  }

  return (
    <Card>
      <CardHead
        title="Your goal"
        sub={view.headline}
        action={view.verdict ? <Badge tone={view.verdict.tone} dot>{view.verdict.label}</Badge> : undefined}
      />
      <CardBody className="space-y-4">
        {view.progress && (
          <div>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[14px] font-semibold text-ink">{view.progress.left}</span>
              <span className="text-[13px] font-semibold text-ink-muted">{view.progress.right}</span>
            </div>
            <ProgressBar pct={view.progress.pct} />
          </div>
        )}

        {view.sentence && <p className="text-[14px] leading-[1.55] text-ink">{view.sentence}</p>}

        {view.incomplete && <p className="text-[14px] leading-[1.55] text-ink-muted">{view.incomplete}</p>}

        {view.type !== 'participation' && view.type !== 'mode_shift' && (
          <div className="rounded-[10px] bg-surface-2 px-4 py-3">
            {view.proxy ? (
              <>
                <div className="text-[12.5px] font-semibold text-ink-muted">Closest figure we track</div>
                <div className="mt-1 text-[15px] font-semibold text-ink">{view.proxy.figure}</div>
                <p className="mt-1 text-[13px] leading-[1.5] text-ink-muted">{view.proxy.caption}</p>
              </>
            ) : (
              <p className="text-[13.5px] leading-[1.5] text-ink-muted">
                We can&apos;t measure this one directly yet. These steps are the ones that help most.
              </p>
            )}
          </div>
        )}

        {view.steps.length > 0 && (
          <div>
            <div className="mb-2 text-[13px] font-semibold text-ink">
              {view.verdict?.label === 'Behind' ? 'To catch up' : 'What helps'}
            </div>
            <div className="flex flex-wrap gap-2">
              {view.steps.map((s) => (
                <Button key={s.key} variant="secondary" size="sm" icon={STEP_ICON[s.key]} onClick={() => go(s.key, s.path)}>
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {canEdit && (
          <Link
            href={`${PORTAL}/setup`}
            className="inline-block text-[13px] font-medium text-accent no-underline hover:underline"
          >
            Change the goal on Setup →
          </Link>
        )}
      </CardBody>
    </Card>
  )
}

/**
 * The nearest thing we measure for parking, wellness and commuter-benefit
 * goals, from data Home already has. Null when there's nothing to show.
 */
function proxyFigure(
  type: GoalType,
  dashboard: DashboardData | null,
  members: EmployerMember[],
  trips: number,
): Proxy {
  if (type === 'parking') {
    if (!dashboard || trips <= 0) return null
    const drive = dashboard.mode_breakdown.find((m) => m.mode === 'drive')?.trip_count ?? 0
    const share = dashboard.drive_alone_share_pct ?? (drive / trips) * 100
    const now = Math.round(share)
    const prior = dashboard.prior_period
    let change = ''
    if (prior && prior.trips > 0 && prior.drive_alone_share_pct != null) {
      const before = Math.round(prior.drive_alone_share_pct)
      change =
        before === now ? ` Same as the 30 days before.` : ` ${now < before ? 'Down' : 'Up'} from ${before}% the 30 days before.`
    }
    return {
      figure: `${now}% of trips were driving alone`,
      caption: `Last 30 days, lower is better.${change}`,
    }
  }
  if (type === 'wellness') {
    if (members.length === 0) return null
    const active = members.filter((m) => m.active_trips_in_period > 0).length
    const pct = Math.round((active / members.length) * 100)
    return {
      figure: `${active} of ${members.length} people who joined logged an active trip (${pct}%)`,
      caption: 'Last 30 days. An active trip is one on foot, by bike or scooter, or by transit.',
    }
  }
  if (type === 'benefit_uptake') {
    if (!dashboard || trips <= 0) return null
    const transit = dashboard.mode_breakdown
      .filter((m) => m.mode.startsWith('transit'))
      .reduce((sum, m) => sum + m.trip_count, 0)
    return {
      figure: `${Math.round((transit / trips) * 100)}% of trips were by bus, train or commuter rail`,
      caption: 'Last 30 days, across everyone who has joined.',
    }
  }
  return null
}
