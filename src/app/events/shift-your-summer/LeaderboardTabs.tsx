'use client'

import Image from 'next/image'
import { useState } from 'react'

export interface GroupStanding {
  groupId: string
  groupName: string
  groupType: string
  logoUrl: string | null
  shiftRate: number
  activeTrips: number
  memberCount: number
}

export interface IndividualStanding {
  user_id: string
  display_name: string
  total_trips: number
  non_car_trips: number
  pct_non_car: number
}

interface Props {
  geoStandings: GroupStanding[]
  corpStandings: GroupStanding[]
  schoolStandings?: GroupStanding[]
  individualStandings: IndividualStanding[]
  participantCount: number
  initialRowLimit?: number
}

// Two greens and navy: teal fails contrast as text on white, so the ramp
// stops at forest.
function shiftRateColor(pct: number) {
  if (pct >= 80) return 'text-green-deep'
  if (pct >= 60) return 'text-forest'
  return 'text-navy'
}

const TH = 'py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft'
const ROW = 'border-b border-navy/10 last:border-b-0'

function GroupStandingsTable({
  standings,
  showLogo = false,
  sortBy,
  rowLimit,
}: {
  standings: GroupStanding[]
  showLogo?: boolean
  sortBy: SortBy
  rowLimit?: number
}) {
  if (standings.length === 0) {
    return <p className="py-10 text-center text-[15px] text-ink-soft">No standings yet. Check back once the event is underway.</p>
  }
  const sorted = [...standings].sort((a, b) =>
    sortBy === 'active_trips'
      ? b.activeTrips - a.activeTrips || b.shiftRate - a.shiftRate
      : b.shiftRate - a.shiftRate || b.activeTrips - a.activeTrips,
  )
  const display = rowLimit ? sorted.slice(0, rowLimit) : sorted
  const rateActive = sortBy === 'shift_rate'
  const tripsActive = sortBy === 'active_trips'
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[15px]">
        <thead>
          <tr className="border-b border-navy/20">
            <th className={`${TH} w-12 pr-2 text-right`}>Rank</th>
            <th className={`${TH} px-4`}>Team</th>
            <th className={`${TH} px-4 text-right ${rateActive ? 'text-navy' : ''}`}>Shift rate</th>
            <th className={`${TH} hidden px-4 text-right md:table-cell ${tripsActive ? 'text-navy' : ''}`}>Active trips</th>
          </tr>
        </thead>
        <tbody>
          {display.map((s, i) => (
            <tr key={s.groupId} className={ROW}>
              <td className="py-3 pr-2 text-right">
                <span className={`font-serif text-[1.125rem] ${i < 3 ? 'text-forest' : 'text-ink-soft'}`}>{i + 1}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {showLogo &&
                    (s.logoUrl ? (
                      <span className="flex h-7 w-auto max-w-[80px] flex-shrink-0 items-center justify-center rounded-md border border-navy/10 bg-white px-1.5">
                        <Image src={s.logoUrl} alt={s.groupName} width={72} height={28} className="h-5 w-auto max-w-full object-contain" unoptimized />
                      </span>
                    ) : (
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                        {s.groupName.charAt(0).toUpperCase()}
                      </span>
                    ))}
                  <span>
                    <span className="font-medium text-navy">{s.groupName}</span>
                    <span className="ml-2 text-[13px] text-ink-soft">{s.memberCount} members</span>
                  </span>
                </div>
              </td>
              <td className={`px-4 py-3 text-right font-semibold tabular-nums ${shiftRateColor(s.shiftRate)} ${tripsActive ? 'opacity-70' : ''}`}>
                {Math.round(s.shiftRate)}%
              </td>
              <td className={`hidden px-4 py-3 text-right tabular-nums md:table-cell ${tripsActive ? 'font-semibold text-navy' : 'text-ink-soft'}`}>
                {s.activeTrips.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IndividualStandingsTable({
  standings,
  sortBy,
  rowLimit,
}: {
  standings: IndividualStanding[]
  participantCount: number
  sortBy: SortBy
  rowLimit?: number
}) {
  const sorted = [...standings].sort((a, b) =>
    sortBy === 'active_trips'
      ? b.non_car_trips - a.non_car_trips || b.pct_non_car - a.pct_non_car
      : b.pct_non_car - a.pct_non_car || b.non_car_trips - a.non_car_trips,
  )
  const display = rowLimit ? sorted.slice(0, rowLimit) : sorted
  const rateActive = sortBy === 'shift_rate'
  const tripsActive = sortBy === 'active_trips'
  const filler = !rowLimit && standings.length < 10 ? Math.max(0, 10 - standings.length) : 0
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[15px]">
        <thead>
          <tr className="border-b border-navy/20">
            <th className={`${TH} w-12 pr-2 text-right`}>Rank</th>
            <th className={`${TH} px-4`}>Name</th>
            <th className={`${TH} px-4 text-right ${rateActive ? 'text-navy' : ''}`}>Shift rate</th>
            <th className={`${TH} hidden px-4 text-right md:table-cell ${tripsActive ? 'text-navy' : ''}`}>Active trips</th>
          </tr>
        </thead>
        <tbody>
          {display.map((entry, i) => {
            const rank = i + 1
            return (
              <tr key={entry.user_id} className={ROW}>
                <td className="py-3 pr-2 text-right">
                  <span className={`font-serif text-[1.125rem] ${rank <= 3 ? 'text-forest' : 'text-ink-soft'}`}>{rank}</span>
                </td>
                <td className="px-4 py-3 font-medium text-navy">{entry.display_name || 'Shift user'}</td>
                <td className={`px-4 py-3 text-right font-semibold tabular-nums ${shiftRateColor(entry.pct_non_car)} ${tripsActive ? 'opacity-70' : ''}`}>
                  {Math.round(entry.pct_non_car)}%
                </td>
                <td className={`hidden px-4 py-3 text-right tabular-nums md:table-cell ${tripsActive ? 'font-semibold text-navy' : 'text-ink-soft'}`}>
                  {entry.non_car_trips.toLocaleString()}
                </td>
              </tr>
            )
          })}
          {Array.from({ length: filler }).map((_, i) => (
            <tr key={`filler-${i}`} className={`${ROW} text-ink-soft`}>
              <td className="py-3 pr-2 text-right font-serif text-[1.125rem]">{standings.length + i + 1}</td>
              <td className="px-4 py-3">&mdash;</td>
              <td className="px-4 py-3 text-right">&mdash;</td>
              <td className="hidden px-4 py-3 text-right md:table-cell">&mdash;</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filler > 0 && (
        <p className="border-t border-navy/10 px-4 py-4 text-center text-[15px] text-ink-soft">The board is just getting started. Be one of the first.</p>
      )}
    </div>
  )
}

type Tab = 'towns' | 'corporate' | 'schools' | 'individual'
type SortBy = 'shift_rate' | 'active_trips'

export default function LeaderboardTabs({ geoStandings, corpStandings, schoolStandings = [], individualStandings, participantCount, initialRowLimit }: Props) {
  const showCorporate = corpStandings.length > 0
  const showSchools = schoolStandings.length > 0
  const [activeTab, setActiveTab] = useState<Tab>('towns')
  const [sortBy, setSortBy] = useState<SortBy>('shift_rate')
  const [expanded, setExpanded] = useState(false)
  const rowLimit = !initialRowLimit || expanded ? undefined : initialRowLimit

  const tabs: { id: Tab; label: string }[] = [
    { id: 'towns', label: 'Towns' },
    ...(showCorporate ? [{ id: 'corporate' as Tab, label: 'Workplaces' }] : []),
    ...(showSchools ? [{ id: 'schools' as Tab, label: 'Schools' }] : []),
    { id: 'individual', label: 'Individuals' },
  ]

  const sorts: { id: SortBy; label: string }[] = [
    { id: 'shift_rate', label: 'Shift rate' },
    { id: 'active_trips', label: 'Active trips' },
  ]

  const totalForTab =
    activeTab === 'towns' ? geoStandings.length
    : activeTab === 'corporate' ? corpStandings.length
    : activeTab === 'schools' ? schoolStandings.length
    : individualStandings.length

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-navy/15">
        {/* Tabs: text with an underline, the way a table of contents reads. */}
        <div role="tablist" className="-mb-px flex gap-6 overflow-x-auto">
          {tabs.map((tab) => {
            const on = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={on}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[44px] whitespace-nowrap border-b-2 pb-2 pt-2 text-[15px] font-semibold transition-colors ${
                  on ? 'border-navy text-navy' : 'border-transparent text-ink-soft hover:text-navy'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        {/* Sort: a segmented pair. */}
        <div className="mb-2 inline-flex rounded-full border border-navy/20 p-0.5" aria-label="Sort by">
          {sorts.map((s) => (
            <button
              key={s.id}
              onClick={() => setSortBy(s.id)}
              aria-pressed={sortBy === s.id}
              className={`rounded-full px-3 py-1 text-[13px] font-semibold transition-colors ${
                sortBy === s.id ? 'bg-navy text-white' : 'text-navy hover:bg-navy/[0.05]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2">
        {activeTab === 'towns' && <GroupStandingsTable standings={geoStandings} sortBy={sortBy} rowLimit={rowLimit} />}
        {activeTab === 'corporate' && <GroupStandingsTable standings={corpStandings} showLogo sortBy={sortBy} rowLimit={rowLimit} />}
        {activeTab === 'schools' && <GroupStandingsTable standings={schoolStandings} showLogo sortBy={sortBy} rowLimit={rowLimit} />}
        {activeTab === 'individual' && (
          <IndividualStandingsTable standings={individualStandings} participantCount={participantCount} sortBy={sortBy} rowLimit={rowLimit} />
        )}
      </div>

      {initialRowLimit && !expanded && totalForTab > initialRowLimit && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-forest underline-offset-4 hover:underline"
        >
          Show all {totalForTab} entries <span aria-hidden>&darr;</span>
        </button>
      )}
    </div>
  )
}
