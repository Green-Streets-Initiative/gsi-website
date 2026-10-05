'use client'

import { useEffect, useState } from 'react'
import { Footprints } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/employer/Card'

/**
 * Steps-equivalent for the team's walks and bike rides (Shift 01027), so HR
 * can add Shift to a step challenge or wellness report. One stated rate,
 * because step converters disagree by about two to one for cycling:
 * 2,000 steps per walking mile (the common step-challenge figure) and 800
 * per bike mile (PEHP Utah's 133 steps a minute at an easy 10 mph). No
 * calorie figures, on purpose.
 *
 * Nothing to show (no walks or rides yet) renders nothing; a failed load
 * says so in one line rather than vanishing (Keith 2026-09-30).
 */
const STEPS_PER_WALK_MILE = 2000
const STEPS_PER_BIKE_MILE = 800

type Miles = { walk_miles: number; bike_miles: number }

export default function StepsEquivalentCard({ groupId, days }: { groupId: string; days: number }) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ok'; miles: Miles }>({
    status: 'loading',
  })

  useEffect(() => {
    let cancelled = false
    supabase
      .rpc('get_employer_walk_bike_miles', {
        p_group_id: groupId,
        p_start: new Date(Date.now() - days * 86_400_000).toISOString(),
      })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data || 'error' in data) {
          setState({ status: 'error' })
          return
        }
        setState({ status: 'ok', miles: data as Miles })
      })
    return () => {
      cancelled = true
    }
  }, [groupId, days])

  if (state.status === 'loading') return null

  if (state.status === 'error') {
    return (
      <Card pad>
        <p className="text-[13.5px] leading-[1.5] text-ink-muted">
          The steps figure for walks and bike rides didn&apos;t load. Refresh the page to try again.
        </p>
      </Card>
    )
  }

  const { miles } = state
  const steps = Math.round(miles.walk_miles * STEPS_PER_WALK_MILE + miles.bike_miles * STEPS_PER_BIKE_MILE)
  if (steps <= 0) return null

  return (
    <Card pad>
      <div className="flex flex-col items-start gap-3.5 sm:flex-row">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-accent-soft text-accent">
          <Footprints size={20} weight="bold" aria-hidden />
        </div>
        <div className="grid min-w-0 gap-1">
          <strong className="text-[15px] text-ink">
            About {steps.toLocaleString()} steps from walks and bike rides this period
          </strong>
          <p className="text-[13.5px] leading-[1.55] text-ink-muted">
            {miles.walk_miles.toLocaleString()} walking miles and {miles.bike_miles.toLocaleString()} biking miles. Running a
            step challenge? Share this number with whoever runs it. We count 2,000 steps per walking mile and 800 per bike
            mile, the rate many step challenges use for an easy ride.
          </p>
        </div>
      </div>
    </Card>
  )
}
