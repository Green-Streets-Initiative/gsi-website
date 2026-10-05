'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardBody, CardHead } from '@/components/employer/Card'
import { locationTitle } from '../_lib/use-employer-locations'

type Usage = {
  ok: boolean
  reason?: string
  days: number
  runs: number
  prior_runs: number
  by_mode: { mode: string; runs: number }[]
  by_location: { location_id: string | null; runs: number }[]
}

const MODE_LABEL: Record<string, string> = {
  walk: 'Walking',
  bike: 'Biking',
  ebike: 'E-bike',
  transit: 'Bus or train',
  bus: 'Bus',
  drive: 'Driving',
  unknown: 'Not recorded',
}

function changeLine(runs: number, prior: number): string {
  if (prior === 0) return 'First runs in this window'
  const diff = runs - prior
  if (diff === 0) return 'Same as the 30 days before'
  return `${diff > 0 ? 'Up' : 'Down'} ${Math.abs(diff)} from ${prior} the 30 days before`
}

/**
 * How employees use the Commute Advisor page (Keith 2026-09-30): runs in
 * the last 30 days, the change against the 30 days before, the mode the
 * engine recommended most, and runs per office. Data comes from
 * get_advisor_usage (Shift 01048), which counts completed recommendations
 * only; it never has an address or a person in it.
 */
export default function AdvisorUsageCard({
  groupId,
  locations,
}: {
  groupId: string
  locations: { id: string; name: string | null; address: string }[]
}) {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_advisor_usage', { p_group_id: groupId, p_days: 30 }).then(({ data, error }) => {
      if (cancelled) return
      const u = data as Usage | null
      // Before migration 01048 lands the function does not exist: that is
      // "no runs yet", not a failure.
      const notThereYet = !!error && /PGRST202|PGRST205|42P01|42883|does not exist|schema cache/i.test(`${error.code} ${error.message}`)
      if (notThereYet) {
        setUsage({ ok: true, days: 30, runs: 0, prior_runs: 0, by_mode: [], by_location: [] } as Usage)
        return
      }
      if (error || !u || !u.ok) {
        setFailed(true)
        return
      }
      setUsage(u)
    })
    return () => {
      cancelled = true
    }
  }, [groupId])

  const topMode = usage?.by_mode?.[0]
  const locationName = (id: string | null) => {
    if (id === null) return locations.length > 1 ? 'Location not chosen' : 'Main location'
    const l = locations.find((x) => x.id === id)
    return l ? locationTitle(l) : 'A location since removed'
  }

  return (
    <Card>
      <CardHead title="How employees use it" sub="Last 30 days on your Commute Advisor page" />
      <CardBody>
        {!usage && !failed && <p className="text-[13.5px] text-ink-muted">Loading...</p>}
        {failed && (
          <p className="text-[13.5px] leading-[1.5] text-ink-muted">
            Couldn&apos;t load usage right now. Reload to try again.
          </p>
        )}
        {usage && usage.runs === 0 && (
          <p className="text-[13.5px] leading-[1.55] text-ink">
            Nobody has used your Commute Advisor page yet. Share the link from your Share Kit; each use shows
            here within a few minutes.
          </p>
        )}
        {usage && usage.runs > 0 && (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                <div className="text-[12px] font-semibold text-ink-muted">Commutes checked</div>
                <div className="mt-0.5 text-[24px] font-bold tracking-[-0.02em] text-ink">{usage.runs}</div>
                <div className="mt-0.5 text-[12px] leading-snug text-ink-muted">{changeLine(usage.runs, usage.prior_runs)}</div>
              </div>
              <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                <div className="text-[12px] font-semibold text-ink-muted">Recommended most</div>
                <div className="mt-0.5 text-[18px] font-bold leading-tight tracking-[-0.01em] text-ink">
                  {topMode ? (MODE_LABEL[topMode.mode] ?? topMode.mode) : 'Not yet'}
                </div>
                {topMode && (
                  <div className="mt-0.5 text-[12px] leading-snug text-ink-muted">
                    {topMode.runs} of {usage.runs} {usage.runs === 1 ? 'commute' : 'commutes'}
                  </div>
                )}
              </div>
            </div>
            {usage.by_location.length > 0 && (
              <div>
                <div className="mb-1.5 text-[12px] font-semibold text-ink-muted">By location</div>
                <ul className="grid gap-1 text-[13px]">
                  {usage.by_location.map((l) => (
                    <li key={l.location_id ?? 'none'} className="flex items-center justify-between gap-3 border-t border-line-2 py-1.5">
                      <span className="min-w-0 truncate text-ink">{locationName(l.location_id)}</span>
                      <span className="whitespace-nowrap font-semibold text-ink">{l.runs}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[12px] leading-[1.5] text-ink-muted">
              One run is one person getting their options. Nothing about who they are or where they live is kept.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
