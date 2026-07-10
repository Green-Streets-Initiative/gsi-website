'use client'

import { Bicycle, Bus, PersonSimpleWalk, Train } from '@phosphor-icons/react'
import type { TownPageStats } from '@/lib/towns/queries'

/**
 * "How {Town} moves" — two 100%-stacked bars (share of trips / share of
 * miles) with Phosphor mode icons, per Keith's July 9 direction: the
 * trips-vs-distance contrast should read directly from the chart, no legend
 * decoding. Percent labels render inside segments wide enough to hold them.
 */

const MODE_META: Record<string, { label: string; color: string; Icon: typeof Bicycle }> = {
  walk: { label: 'Walking', color: '#BAF14D', Icon: PersonSimpleWalk },
  bike: { label: 'Biking & scooting', color: '#2966E5', Icon: Bicycle },
  bus: { label: 'Bus', color: '#EDB93C', Icon: Bus },
  train: { label: 'Train', color: '#FF8A65', Icon: Train },
}

function StackedBar({
  label,
  rows,
  field,
}: {
  label: string
  rows: TownPageStats['mode_split']
  field: 'trips' | 'miles'
}) {
  const total = rows.reduce((s, r) => s + r[field], 0)
  if (total === 0) return null
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-white/70">{label}</p>
      <div className="flex h-9 overflow-hidden rounded-[10px]">
        {rows.map((r) => {
          const share = r[field] / total
          if (share === 0) return null
          const meta = MODE_META[r.mode_group]
          const pct = Math.round(share * 100)
          return (
            <div
              key={r.mode_group}
              className="flex items-center justify-center gap-1 overflow-hidden"
              style={{ width: `${share * 100}%`, backgroundColor: meta?.color ?? '#5d6a94' }}
              title={`${meta?.label ?? r.mode_group}: ${pct}% of ${field}`}
            >
              {share >= 0.08 && meta && (
                <>
                  <meta.Icon size={15} weight="bold" color="#191A2E" />
                  <span className="text-xs font-bold text-[#191A2E]">{pct}%</span>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ModeSplitChart({ stats, townName }: { stats: TownPageStats; townName: string }) {
  const rows = (stats.mode_split ?? []).filter((r) => r.trips > 0 || r.miles > 0)
  const totalTrips = rows.reduce((s, r) => s + r.trips, 0)
  if (totalTrips === 0) return null

  return (
    <section className="mx-auto max-w-[720px]">
      <h2 className="mb-1 text-center font-display text-2xl font-bold tracking-tight text-white">
        How {townName} moves
      </h2>
      <p className="mb-5 text-center text-sm text-white/75">Active trips and miles so far in {new Date().toLocaleDateString('en-US', { month: 'long' })}, by mode</p>
      <div className="space-y-5 rounded-[18px] border border-white/[0.08] bg-[#242538] p-6">
        <StackedBar label="Share of trips" rows={rows} field="trips" />
        <StackedBar label="Share of miles" rows={rows} field="miles" />

        {/* Per-mode key with raw numbers — doubles as the color key */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-1 md:grid-cols-4">
          {rows.map((r) => {
            const meta = MODE_META[r.mode_group]
            if (!meta) return null
            return (
              <div key={r.mode_group} className="flex items-center gap-2">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]"
                  style={{ backgroundColor: `${meta.color}29` }}
                >
                  <meta.Icon size={16} weight="bold" color={meta.color} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-white">{meta.label}</span>
                  <span className="block text-[11px] text-white/75">
                    {r.trips.toLocaleString()} trips · {r.miles.toLocaleString()} mi
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
