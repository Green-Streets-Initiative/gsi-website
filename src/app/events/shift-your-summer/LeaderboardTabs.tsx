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
  individualStandings: IndividualStanding[]
  participantCount: number
}

function shiftRateColor(pct: number) {
  if (pct >= 80) return 'text-[#EDB93C]'
  if (pct >= 60) return 'text-[#BAF14D]'
  if (pct >= 40) return 'text-[#2966E5]'
  return 'text-white'
}

function GroupStandingsTable({
  standings,
  showLogo = false,
  sortBy,
}: {
  standings: GroupStanding[]
  showLogo?: boolean
  sortBy: SortBy
}) {
  if (standings.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-white/50">
        No standings yet. Check back once the event is underway.
      </p>
    )
  }
  const sorted = [...standings].sort((a, b) =>
    sortBy === 'active_trips'
      ? b.activeTrips - a.activeTrips || b.shiftRate - a.shiftRate
      : b.shiftRate - a.shiftRate || b.activeTrips - a.activeTrips,
  )
  const rateActive = sortBy === 'shift_rate'
  const tripsActive = sortBy === 'active_trips'
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-xs font-semibold uppercase tracking-wider text-white/50">
            <th className="w-16 py-3.5 pl-5 pr-2 text-right">Rank</th>
            <th className="px-4 py-3.5">Team</th>
            <th className={`px-4 py-3.5 text-right ${rateActive ? 'text-white' : ''}`}>Shift Rate</th>
            <th className={`hidden px-4 py-3.5 text-right md:table-cell pr-5 ${tripsActive ? 'text-white' : ''}`}>Active Trips</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr
              key={s.groupId}
              className={`border-b border-white/[0.05] last:border-b-0 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
            >
              <td className="py-3 pl-5 pr-2 text-right">
                <span className={`font-display text-base font-bold ${i < 3 ? 'text-[#EDB93C]' : 'text-white/50'}`}>
                  {i + 1}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {showLogo && (
                    s.logoUrl ? (
                      <Image
                        src={s.logoUrl}
                        alt={s.groupName}
                        width={28}
                        height={28}
                        className="h-7 w-7 flex-shrink-0 rounded-full bg-white/10 object-contain"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#BAF14D] text-xs font-bold text-[#191A2E]">
                        {s.groupName.charAt(0).toUpperCase()}
                      </span>
                    )
                  )}
                  <span>
                    <span className="font-medium text-white">{s.groupName}</span>
                    <span className="ml-2 text-xs text-white/60">{s.memberCount} members</span>
                  </span>
                </div>
              </td>
              <td className={`px-4 py-3 text-right font-display font-bold ${shiftRateColor(s.shiftRate)} ${tripsActive ? 'opacity-75' : ''}`}>
                {Math.round(s.shiftRate)}%
              </td>
              <td className={`hidden px-4 py-3 text-right md:table-cell pr-5 ${tripsActive ? 'font-display font-bold text-white' : 'text-white/60'}`}>
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
  participantCount,
  sortBy,
}: {
  standings: IndividualStanding[]
  participantCount: number
  sortBy: SortBy
}) {
  const sorted = [...standings].sort((a, b) =>
    sortBy === 'active_trips'
      ? b.non_car_trips - a.non_car_trips || b.pct_non_car - a.pct_non_car
      : b.pct_non_car - a.pct_non_car || b.non_car_trips - a.non_car_trips,
  )
  const rateActive = sortBy === 'shift_rate'
  const tripsActive = sortBy === 'active_trips'
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-xs font-semibold uppercase tracking-wider text-white/50">
            <th className="w-16 py-3.5 pl-5 pr-2 text-right">Rank</th>
            <th className="px-4 py-3.5">Name</th>
            <th className={`px-4 py-3.5 text-right ${rateActive ? 'text-white' : ''}`}>Shift Rate</th>
            <th className={`hidden px-4 py-3.5 text-right md:table-cell pr-5 ${tripsActive ? 'text-white' : ''}`}>Active Trips</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, i) => {
            const rank = i + 1
            return (
              <tr
                key={entry.user_id}
                className={`border-b border-white/[0.05] last:border-b-0 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
              >
                <td className="py-3 pl-5 pr-2 text-right">
                  <span className={`font-display text-base font-bold ${rank <= 3 ? 'text-[#EDB93C]' : 'text-white/50'}`}>
                    {rank}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-white">{entry.display_name}</td>
                <td className={`px-4 py-3 text-right font-display font-bold ${shiftRateColor(entry.pct_non_car)} ${tripsActive ? 'opacity-75' : ''}`}>
                  {Math.round(entry.pct_non_car)}%
                </td>
                <td className={`hidden px-4 py-3 text-right md:table-cell pr-5 ${tripsActive ? 'font-display font-bold text-white' : 'text-white/60'}`}>
                  {entry.non_car_trips.toLocaleString()}
                </td>
              </tr>
            )
          })}
          {standings.length < 10 &&
            Array.from({ length: Math.max(0, 10 - standings.length) }).map((_, i) => (
              <tr
                key={`filler-${i}`}
                className={`border-b border-white/[0.05] last:border-b-0 ${(standings.length + i) % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
              >
                <td className="py-3 pl-5 pr-2 text-right text-white/40">{standings.length + i + 1}</td>
                <td className="px-4 py-3 text-white/40">&mdash;</td>
                <td className="px-4 py-3 text-right text-white/40">&mdash;</td>
                <td className="hidden px-4 py-3 text-right text-white/40 md:table-cell pr-5">&mdash;</td>
              </tr>
            ))}
        </tbody>
      </table>
      {standings.length < 10 && (
        <p className="border-t border-white/[0.06] px-6 py-4 text-center text-sm text-white/60">
          The board is just getting started. Be one of the first.
        </p>
      )}
    </div>
  )
}

type Tab = 'towns' | 'corporate' | 'individual'
type SortBy = 'shift_rate' | 'active_trips'

export default function LeaderboardTabs({ geoStandings, corpStandings, individualStandings, participantCount }: Props) {
  const showCorporate = corpStandings.length > 0
  const [activeTab, setActiveTab] = useState<Tab>('towns')
  const [sortBy, setSortBy] = useState<SortBy>('shift_rate')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'towns', label: 'Towns' },
    ...(showCorporate ? [{ id: 'corporate' as Tab, label: 'Corporate Challenge' }] : []),
    { id: 'individual', label: 'Individual' },
  ]

  const sorts: { id: SortBy; label: string }[] = [
    { id: 'shift_rate', label: 'Shift rate' },
    { id: 'active_trips', label: 'Active trips' },
  ]

  return (
    <div>
      {/* Sort toggle */}
      <div className="mb-3 inline-flex gap-1 rounded-full bg-white/[0.06] p-1">
        {sorts.map(s => (
          <button
            key={s.id}
            onClick={() => setSortBy(s.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              sortBy === s.id
                ? 'bg-white/[0.16] text-white'
                : 'text-white/75 hover:text-white'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-xl bg-white/[0.05] p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-[#BAF14D] text-[#191A2E]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#242538]">
        {activeTab === 'towns' && <GroupStandingsTable standings={geoStandings} sortBy={sortBy} />}
        {activeTab === 'corporate' && <GroupStandingsTable standings={corpStandings} showLogo sortBy={sortBy} />}
        {activeTab === 'individual' && (
          <IndividualStandingsTable standings={individualStandings} participantCount={participantCount} sortBy={sortBy} />
        )}
      </div>
    </div>
  )
}
