'use client'

import { Bicycle, Bus, PersonSimpleWalk, Train } from '@phosphor-icons/react'
import { SectionHeading } from '@/components/org/Section'
import type { TownPageStats } from '@/lib/towns/queries'

/**
 * "How {Town} moves" — two 100%-stacked bars (share of trips / share of
 * miles) with Phosphor mode icons, per Keith's July 9 direction: the
 * trips-vs-distance contrast should read directly from the chart, no legend
 * decoding. Percent labels render inside segments wide enough to hold them.
 *
 * Palette on cream: forest, teal, navy, gold. Percent labels are white on the
 * dark fills and navy on teal and gold; teal and gold are only ever fills.
 */

const MODE_META: Record<string, { label: string; color: string; ink: string; Icon: typeof Bicycle }> = {
  walk: { label: 'Walking', color: '#2D6A4F', ink: '#FFFFFF', Icon: PersonSimpleWalk },
  bike: { label: 'Biking & scooting', color: '#52B788', ink: '#191A2E', Icon: Bicycle },
  bus: { label: 'Bus', color: '#EDB93C', ink: '#191A2E', Icon: Bus },
  train: { label: 'Train', color: '#191A2E', ink: '#FFFFFF', Icon: Train },
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
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-forest">{label}</p>
      <div className="flex h-10 overflow-hidden rounded-[8px]">
        {rows.map((r) => {
          const share = r[field] / total
          if (share === 0) return null
          const meta = MODE_META[r.mode_group]
          const pct = Math.round(share * 100)
          return (
            <div
              key={r.mode_group}
              className="flex items-center justify-center overflow-hidden"
              style={{ width: `${share * 100}%`, backgroundColor: meta?.color ?? '#4A4D68' }}
              title={`${meta?.label ?? r.mode_group}: ${pct}% of ${field}`}
            >
              {share >= 0.08 && meta && (
                <span className="text-[13px] font-semibold tabular-nums" style={{ color: meta.ink }}>
                  {pct}%
                </span>
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
    <div>
      <SectionHeading
        title={`How ${townName} moves`}
        lede={`Active trips and miles so far in ${new Date().toLocaleDateString('en-US', { month: 'long' })}, by mode.`}
      />
      <div className="space-y-6">
        <StackedBar label="Share of trips" rows={rows} field="trips" />
        <StackedBar label="Share of miles" rows={rows} field="miles" />

        {/* Per-mode key with raw numbers — doubles as the color key */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-navy/15 pt-5 md:grid-cols-4">
          {rows.map((r) => {
            const meta = MODE_META[r.mode_group]
            if (!meta) return null
            return (
              <div key={r.mode_group} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]" style={{ backgroundColor: meta.color }}>
                  <meta.Icon size={16} weight="bold" color={meta.ink} aria-hidden />
                </span>
                <span className="min-w-0">
                  <dt className="text-[14px] font-semibold text-navy">{meta.label}</dt>
                  <dd className="text-[13px] tabular-nums text-ink-soft">
                    {r.trips.toLocaleString()} trips · {r.miles.toLocaleString()} mi
                  </dd>
                </span>
              </div>
            )
          })}
        </dl>
      </div>
    </div>
  )
}
