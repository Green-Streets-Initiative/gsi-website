'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardHead } from '@/components/employer/Card'
import { useEmployerLocations, locationTitle } from '../_lib/use-employer-locations'

type Row = { id?: string; name: string | null; address?: string; members: number; active_members: number; active_trips: number }
type Breakdown = {
  min_group_size: number
  locations: Row[]
  other: Omit<Row, 'name'> | null
  hidden_small: boolean
}

/**
 * Totals per location for employers with two or more locations (item 7).
 * Members are matched to a location nightly from where their weekday
 * commute trips start or end; the portal only ever gets totals, and a
 * location shows only with 5 or more people (get_employer_location_breakdown).
 */
export default function LocationBreakdownCard({
  groupId,
  days,
  rangeLabel,
}: {
  groupId: string
  days: number
  /** How the page names the period ("Q3 2026"); falls back to "Last {days} days". */
  rangeLabel?: string
}) {
  const { locations } = useEmployerLocations(groupId)
  const [data, setData] = useState<Breakdown | null>(null)
  const [failed, setFailed] = useState(false)
  const multiSite = locations.length > 1

  useEffect(() => {
    if (!multiSite) return
    let cancelled = false
    supabase
      .rpc('get_employer_location_breakdown', { p_group_id: groupId, p_days: days })
      .then(({ data: d, error }) => {
        if (cancelled) return
        if (error || !d || 'error' in d) {
          setFailed(true)
          return
        }
        setFailed(false)
        setData(d as Breakdown)
      })
    return () => {
      cancelled = true
    }
  }, [groupId, days, multiSite])

  if (!multiSite) return null

  const min = data?.min_group_size ?? 5
  const rows: Row[] = data
    ? [...data.locations, ...(data.other ? [{ ...data.other, name: 'Everyone else' }] : [])]
    : []

  return (
    <Card>
      <CardHead
        title="By location"
        sub={`${rangeLabel ?? `Last ${days} days`} · walk, bike and transit trips`}
      />
      {failed ? (
        <p className="px-6 pb-6 text-[14px] text-ink-muted">Location numbers didn&apos;t load. Refresh the page to try again.</p>
      ) : !data ? (
        <p className="px-6 pb-6 text-[14px] text-ink-tertiary">Loading...</p>
      ) : data.locations.length === 0 ? (
        <p className="px-6 pb-6 text-[14px] leading-[1.6] text-ink-muted">
          Numbers by location appear once a location has at least {min} people matched to it. We match people by where their weekday
          commute trips start or end, and update it every night. Until then your team shows as one group, to protect privacy.
        </p>
      ) : (
        <div className="px-4 pb-5 sm:px-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-line text-[12.5px] font-semibold text-ink-tertiary">
                  <th className="py-2 pr-3">Location</th>
                  <th className="py-2 pr-3 text-right">People</th>
                  <th className="py-2 pr-3 text-right">Active</th>
                  <th className="py-2 text-right">Trips</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((r, i) => (
                  <tr key={r.id ?? `other-${i}`} className="border-b border-line-2 last:border-0">
                    <td className="py-2.5 pr-3 font-semibold text-ink">
                      {r.id ? locationTitle({ name: r.name, address: r.address ?? '' }) : r.name}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-ink">{r.members}</td>
                    <td className="py-2.5 pr-3 text-right text-ink">{r.active_members}</td>
                    <td className="py-2.5 text-right text-ink">{r.active_trips}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12.5px] leading-[1.5] text-ink-muted">
            People are matched to a location by where their weekday commute trips start or end.
            {data.hidden_small ? ` Locations with fewer than ${min} people aren't shown separately, to protect privacy.` : ''}
          </p>
        </div>
      )}
    </Card>
  )
}
