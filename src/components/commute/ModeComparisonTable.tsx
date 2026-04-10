'use client'

import type { ModeComparison } from '@/lib/types/commute'

const MODE_LABELS: Record<string, string> = {
  drive: 'Drive', walk: 'Walk', bike: 'Bike', ebike: 'E-bike', transit: 'Transit', bus: 'Bus',
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`

interface ModeComparisonTableProps {
  comparisons: ModeComparison[]
  winnerMode: string
  routeTimes?: Record<string, number> // Google Maps times keyed by mode: { drive: 25, bike: 22, transit: 40 }
}

export default function ModeComparisonTable({ comparisons, winnerMode, routeTimes }: ModeComparisonTableProps) {
  if (comparisons.length < 2) return null

  return (
    <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-6">
      <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
        All options compared
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[0.8125rem]">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <th className="pb-2.5 pr-4 text-[10px] font-bold uppercase tracking-wider text-white/40">Mode</th>
              <th className="pb-2.5 pr-4 text-right text-[10px] font-bold uppercase tracking-wider text-white/40">Time</th>
              <th className="pb-2.5 pr-4 text-right text-[10px] font-bold uppercase tracking-wider text-white/40">Daily cost</th>
              <th className="pb-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-white/40">Annual cost</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c) => {
              const isWinner = c.mode === winnerMode
              return (
                <tr key={c.mode} className={`border-b border-white/[0.04] ${isWinner ? 'bg-[rgba(186,241,77,0.06)]' : ''}`}>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${isWinner ? 'text-[#BAF14D]' : 'text-white'}`}>
                        {MODE_LABELS[c.mode] || c.label}
                      </span>
                      {isWinner && (
                        <span className="rounded-full bg-[#BAF14D]/[0.15] px-2 py-0.5 text-[9px] font-bold uppercase text-[#BAF14D]">Best</span>
                      )}
                    </div>
                  </td>
                  <td className={`py-2.5 pr-4 text-right font-semibold ${isWinner ? 'text-white' : 'text-white/70'}`}>
                    {routeTimes?.[c.mode] ?? c.time_minutes} min
                  </td>
                  <td className={`py-2.5 pr-4 text-right font-semibold ${isWinner ? 'text-white' : 'text-white/70'}`}>
                    {c.daily_cost === 0 ? 'Free' : `$${c.daily_cost.toFixed(2)}`}
                  </td>
                  <td className={`py-2.5 text-right font-semibold ${isWinner ? 'text-white' : 'text-white/70'}`}>
                    {c.annual_cost === 0 ? 'Free' : fmt(c.annual_cost)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
