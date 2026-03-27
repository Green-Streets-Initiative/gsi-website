'use client'

import { useState } from 'react'

export interface GroupStanding {
  groupId: string
  groupName: string
  groupType: string
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

function GroupStandingsTable({ standings }: { standings: GroupStanding[] }) {
  if (standings.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-white/50">
        No standings yet. Check back once the event is underway.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-xs font-semibold uppercase tracking-wider text-white/50">
            <th className="w-16 py-3.5 pl-5 pr-2 text-right">Rank</th>
            <th className="px-4 py-3.5">Team</th>
            <th className="px-4 py-3.5 text-right">Shift Rate</th>
            <th className="hidden px-4 py-3.5 text-right md:table-cell pr-5">Members</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
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
                <span className="font-medium text-white">{s.groupName}</span>
                <span className="ml-2 text-xs text-white/40">{s.activeTrips} active trips</span>
              </td>
              <td className={`px-4 py-3 text-right font-display font-bold ${shiftRateColor(s.shiftRate)}`}>
                {Math.round(s.shiftRate)}%
              </td>
              <td className="hidden px-4 py-3 text-right text-white/60 md:table-cell pr-5">
                {s.memberCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IndividualStandingsTable({ standings, participantCount }: { standings: IndividualStanding[], participantCount: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-xs font-semibold uppercase tracking-wider text-white/50">
            <th className="w-16 py-3.5 pl-5 pr-2 text-right">Rank</th>
            <th className="px-4 py-3.5">Name</th>
            <th className="px-4 py-3.5 text-right">Shift Rate</th>
            <th className="hidden px-4 py-3.5 text-right md:table-cell pr-5">Active Trips</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((entry, i) => {
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
                <td className={`px-4 py-3 text-right font-display font-bold ${shiftRateColor(entry.pct_non_car)}`}>
                  {Math.round(entry.pct_non_car)}%
                </td>
                <td className="hidden px-4 py-3 text-right text-white/60 md:table-cell pr-5">
                  {entry.non_car_trips}
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
                <td className="py-3 pl-5 pr-2 text-right text-white/30">{standings.length + i + 1}</td>
                <td className="px-4 py-3 text-white/30">&mdash;</td>
                <td className="px-4 py-3 text-right text-white/30">&mdash;</td>
                <td className="hidden px-4 py-3 text-right text-white/30 md:table-cell pr-5">&mdash;</td>
              </tr>
            ))}
        </tbody>
      </table>
      {standings.length < 10 && (
        <p className="border-t border-white/[0.06] px-6 py-4 text-center text-sm text-white/40">
          The board is just getting started. Be one of the first.
        </p>
      )}
    </div>
  )
}

type Tab = 'towns' | 'corporate' | 'individual'

export default function LeaderboardTabs({ geoStandings, corpStandings, individualStandings, participantCount }: Props) {
  const showCorporate = corpStandings.length > 0
  const [activeTab, setActiveTab] = useState<Tab>('towns')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'towns', label: 'Towns' },
    ...(showCorporate ? [{ id: 'corporate' as Tab, label: 'Corporate Challenge' }] : []),
    { id: 'individual', label: 'Individual' },
  ]

  return (
    <div>
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
        {activeTab === 'towns' && <GroupStandingsTable standings={geoStandings} />}
        {activeTab === 'corporate' && <GroupStandingsTable standings={corpStandings} />}
        {activeTab === 'individual' && (
          <IndividualStandingsTable standings={individualStandings} participantCount={participantCount} />
        )}
      </div>
    </div>
  )
}
