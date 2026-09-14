'use client'

import { Bicycle, Bus, PersonSimpleWalk, Train } from '@phosphor-icons/react'
import { Section, SectionHeading } from './_sections/Section'

/*
 * Mode split and weekly momentum for Shift Your Summer 2026. Static figures
 * from the Shift repo post-mortem (appendix-queries.md). Only rendered for the
 * 2026 campaign; the page gates on the report slug.
 *
 * Palette on cream: forest, teal, navy, gold. Percent labels are white on the
 * three dark fills and navy on gold; teal is only ever a fill here, never text.
 */
const MODE_META: Record<string, { label: string; color: string; ink: string; Icon: typeof Bicycle }> = {
  walk: { label: 'Walking', color: '#2D6A4F', ink: '#FFFFFF', Icon: PersonSimpleWalk },
  bike: { label: 'Biking', color: '#52B788', ink: '#191A2E', Icon: Bicycle },
  train: { label: 'Train and commuter rail', color: '#191A2E', ink: '#FFFFFF', Icon: Train },
  bus: { label: 'Bus and ferry', color: '#EDB93C', ink: '#191A2E', Icon: Bus },
}

const SYS_2026_MODES = [
  { mode_group: 'walk', trips: 5_759, miles: 3_902 },
  { mode_group: 'bike', trips: 3_483, miles: 11_978 },
  { mode_group: 'train', trips: 1_809, miles: 15_176 },
  { mode_group: 'bus', trips: 696, miles: 5_649 },
]

const SYS_2026_WEEKLY = [
  { week_start: '2026-06-15', active_trips: 901 },
  { week_start: '2026-06-22', active_trips: 988 },
  { week_start: '2026-06-29', active_trips: 1_062 },
  { week_start: '2026-07-06', active_trips: 1_285 },
  { week_start: '2026-07-13', active_trips: 1_132 },
  { week_start: '2026-07-20', active_trips: 1_474 },
  { week_start: '2026-07-27', active_trips: 1_580 },
  { week_start: '2026-08-03', active_trips: 1_781 },
  { week_start: '2026-08-10', active_trips: 1_544 },
]

function StackedBar({ label, field }: { label: string; field: 'trips' | 'miles' }) {
  const total = SYS_2026_MODES.reduce((s, r) => s + r[field], 0)
  if (total === 0) return null
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-forest">{label}</p>
      <div className="flex h-10 overflow-hidden rounded-[8px]">
        {SYS_2026_MODES.map((r) => {
          const share = r[field] / total
          if (share === 0) return null
          const meta = MODE_META[r.mode_group]
          const pct = Math.round(share * 100)
          return (
            <div
              key={r.mode_group}
              className="flex items-center justify-center overflow-hidden"
              style={{ width: `${share * 100}%`, backgroundColor: meta.color }}
              title={`${meta.label}: ${pct}% of ${field}`}
            >
              {share >= 0.08 && (
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

function ModeSplit() {
  return (
    <Section shape="straight" width="read">
      <SectionHeading title="How people got around" lede="11,747 active trips across four kinds of travel." />
      <div className="space-y-6">
        <StackedBar label="Share of trips" field="trips" />
        <StackedBar label="Share of miles" field="miles" />

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-navy/15 pt-5 md:grid-cols-4">
          {SYS_2026_MODES.map((r) => {
            const meta = MODE_META[r.mode_group]
            return (
              <div key={r.mode_group} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]" style={{ backgroundColor: meta.color }}>
                  <meta.Icon size={16} weight="bold" color={meta.ink} aria-hidden />
                </span>
                <span className="min-w-0">
                  <dt className="text-[14px] font-semibold text-navy">{meta.label}</dt>
                  <dd className="text-[13px] tabular-nums text-ink-soft">
                    {r.trips.toLocaleString()} trips &middot; {r.miles.toLocaleString()} mi
                  </dd>
                </span>
              </div>
            )
          })}
        </dl>

        <p className="max-w-[560px] text-[15px] leading-relaxed text-ink-soft">
          Walking made up half of all trips, while biking covered three times the miles. Fourteen of those trips were by ferry across Boston Harbor.
        </p>
      </div>
    </Section>
  )
}

function Momentum() {
  const weeks = SYS_2026_WEEKLY
  const w = 560
  const h = 130
  const pad = 10
  const max = Math.max(...weeks.map((d) => d.active_trips), 1)
  const step = (w - pad * 2) / (weeks.length - 1)
  const points = weeks.map((d, i) => ({
    x: pad + i * step,
    y: h - pad - (d.active_trips / max) * (h - pad * 2 - 14),
    value: d.active_trips,
  }))
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${path} L${points[points.length - 1].x.toFixed(1)},${h - pad} L${points[0].x.toFixed(1)},${h - pad} Z`
  const peakIdx = weeks.reduce((best, d, i) => (d.active_trips > weeks[best].active_trips ? i : best), 0)

  return (
    <Section shape="wanderLeft" width="read">
      <SectionHeading
        title="Momentum"
        lede="Active trips by week. Weekly trips nearly doubled from the opening week to the week of August 3."
      />
      <div className="border-y border-navy/15 py-6">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={`Weekly active trips: ${weeks.map((d) => d.active_trips).join(', ')}`}>
          <path d={area} fill="rgba(45,106,79,0.10)" />
          <path d={path} fill="none" stroke="#2D6A4F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === peakIdx ? 4.5 : 3} fill={i === peakIdx ? '#1B4332' : '#F4F8EE'} stroke="#2D6A4F" strokeWidth="2" />
          ))}
          <text x={points[peakIdx].x} y={points[peakIdx].y - 11} textAnchor="middle" fill="#191A2E" fontSize="12" fontWeight="600" fontFamily="var(--font-sans), system-ui, sans-serif">
            {weeks[peakIdx].active_trips.toLocaleString()}
          </text>
        </svg>
        <div className="mt-2 flex justify-between text-[11px] tabular-nums text-ink-soft">
          {weeks.map((d) => {
            const end = new Date(`${d.week_start}T00:00:00`)
            end.setDate(end.getDate() + 6)
            return <span key={d.week_start}>{end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          })}
        </div>
      </div>
    </Section>
  )
}

export default function CampaignDataViz() {
  return (
    <>
      <ModeSplit />
      <Momentum />
    </>
  )
}
