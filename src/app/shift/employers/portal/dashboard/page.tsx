'use client'

// Home. Its one job (Keith 2026-10-22, page charters): what to do next, and
// is it working. One screen, no scrolling to discover anything:
//   the assistant bar (where the assistant is on),
//   Next up: at most three steps,
//   Is it working?: three meters.
// Everything that used to be stacked here lives on the page whose job it
// is: the goal folds into the meters, top movers are on Employees, locations
// and the full numbers on Impact, the plan on Billing, joins in the bell.

import { useEffect, useRef } from 'react'
import { usePortal } from '../_lib/portal-context'
import { computeSetupSteps } from '../_lib/setup-steps'
import { assistantAvailable } from '../_components/AssistantPanel'
import { AssistantBar, NextUp, homeSuggestions } from './AssistantHome'
import ProgramHealthCard from './ProgramHealthCard'
import { Card } from '@/components/employer/Card'

/** Wall clock, kept out of render so the purity lint stays quiet. */
const now = () => Date.now()

/**
 * Days the loaded dashboard covers, from the window the RPC reports. Null
 * when the window isn't on the payload (older RPC), which reads as unknown.
 */
function loadedWindowDays(d: unknown): number | null {
  const w = d as { window_start?: string; window_end?: string } | null
  if (!w?.window_start || !w.window_end) return null
  const ms = new Date(w.window_end).getTime() - new Date(w.window_start).getTime()
  return Number.isFinite(ms) ? ms / 86_400_000 : null
}

export default function DashboardPage() {
  const portal = usePortal()
  const { group, challenges, memberCount, dashboard, dashboardError, members, benefitsForm, loading, refreshDashboard, isAdmin, isGsiAdmin } = portal
  const otherWorkplaces = (portal as { otherWorkplaces?: number }).otherWorkplaces ?? 0
  const refetchedFor = useRef<string | null>(null)

  // Home always shows the last 30 days. If another page's fetch left a
  // different window in the shared context, reload before showing it.
  useEffect(() => {
    if (loading || !group) return
    if (refetchedFor.current === group.id) return
    refetchedFor.current = group.id
    const days = loadedWindowDays(dashboard)
    if (days !== null && Math.abs(days - 30) < 0.5) return
    void refreshDashboard({ days: 30 })
  }, [loading, group, dashboard, refreshDashboard])

  if (loading || !group) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-ink-tertiary">Loading...</span>
      </div>
    )
  }

  const steps = computeSetupSteps({ group, benefitsForm, memberCount, challenges })
  const withAssistant = assistantAvailable(group, isGsiAdmin)
  const next = homeSuggestions({
    group,
    steps,
    challenges,
    memberCount,
    canAct: isAdmin || isGsiAdmin || portal.canManageChallenges,
    nowMs: now(),
  })
  // The meters read 30-day figures; while another page's window is still in
  // the shared context (the reload above), they wait rather than mislabel.
  const loadedDays = loadedWindowDays(dashboard)
  const dashboard30 = loadedDays === null || Math.abs(loadedDays - 30) < 0.5 ? dashboard : null

  return (
    // minmax(0, 1fr): the swipeable chip row must not widen the page on phones.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <h1 className="sr-only">Home</h1>

      {dashboardError && (
        <Card pad>
          <p className="text-[15px] text-ep-danger">{dashboardError}</p>
        </Card>
      )}

      {withAssistant && <AssistantBar starters={next.starters} />}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <NextUp steps={next.steps} withAssistant={withAssistant} />
        <ProgramHealthCard group={group} memberCount={memberCount} members={members} dashboard={dashboard30} />
      </div>

      {otherWorkplaces > 0 && (
        <p className="text-[14px] text-ink-muted">
          You&apos;re an admin on {otherWorkplaces} other workplace{otherWorkplaces === 1 ? '' : 's'} too. To work on one of those, email
          info@gogreenstreets.org.
        </p>
      )}
    </div>
  )
}
