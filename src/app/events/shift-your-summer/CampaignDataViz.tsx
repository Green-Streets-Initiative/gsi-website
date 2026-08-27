'use client'

import { Bicycle, Bus, PersonSimpleWalk, Train } from '@phosphor-icons/react'

const MODE_META: Record<string, { label: string; color: string; Icon: typeof Bicycle }> = {
  walk: { label: 'Walking', color: '#BAF14D', Icon: PersonSimpleWalk },
  bike: { label: 'Biking', color: '#2966E5', Icon: Bicycle },
  bus: { label: 'Bus & ferry', color: '#EDB93C', Icon: Bus },
  train: { label: 'Train & commuter rail', color: '#FF8A65', Icon: Train },
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
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-white/70">{label}</p>
      <div className="flex h-9 overflow-hidden rounded-[10px]">
        {SYS_2026_MODES.map((r) => {
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

function ModeSplitSection() {
  return (
    <section className="bg-[#191A2E] px-8 pt-6 pb-8 border-t border-white/[0.08]">
      <div className="mx-auto max-w-[900px]">
        <h2 className="mb-1 font-display text-2xl font-bold tracking-tight text-white">
          How people got around
        </h2>
        <p className="mb-5 text-sm text-white/75">
          11,747 active trips across four modes — walking, biking, bus, and rail
        </p>
        <div className="space-y-5 rounded-[18px] border border-white/[0.08] bg-[#242538] p-6">
          <StackedBar label="Share of trips" field="trips" />
          <StackedBar label="Share of miles" field="miles" />

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-1 md:grid-cols-4">
            {SYS_2026_MODES.map((r) => {
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
                      {r.trips.toLocaleString()} trips &middot; {r.miles.toLocaleString()} mi
                    </span>
                  </span>
                </div>
              )
            })}
          </div>

          <p className="pt-1 text-sm text-white/75">
            Walking made up half of all trips — but biking covered 3&times; the miles.
            <span className="ml-1 text-white/60">14 of those trips were by ferry across Boston Harbor.</span>
          </p>
        </div>
      </div>
    </section>
  )
}

function MomentumSection() {
  const weeks = SYS_2026_WEEKLY
  const w = 560
  const h = 120
  const pad = 8
  const max = Math.max(...weeks.map((d) => d.active_trips), 1)
  const step = (w - pad * 2) / (weeks.length - 1)
  const points = weeks.map((d, i) => ({
    x: pad + i * step,
    y: h - pad - (d.active_trips / max) * (h - pad * 2),
    value: d.active_trips,
  }))
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${path} L${points[points.length - 1].x.toFixed(1)},${h - pad} L${points[0].x.toFixed(1)},${h - pad} Z`

  const peakIdx = weeks.reduce((best, d, i) => d.active_trips > weeks[best].active_trips ? i : best, 0)

  return (
    <section className="bg-[#191A2E] px-8 pt-4 pb-8 border-t border-white/[0.08]">
      <div className="mx-auto max-w-[900px]">
        <h2 className="mb-1 font-display text-2xl font-bold tracking-tight text-white">
          Momentum
        </h2>
        <p className="mb-5 text-sm text-white/75">
          Active trips by week — most campaigns fade after launch. This one grew.
        </p>
        <div className="rounded-[18px] border border-white/[0.08] bg-[#242538] px-6 pb-4 pt-6">
          <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={`Weekly active trips: ${weeks.map((d) => d.active_trips).join(', ')}`}>
            <path d={area} fill="rgba(186,241,77,0.10)" />
            <path d={path} fill="none" stroke="#BAF14D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={i === peakIdx ? 4 : 2.5} fill={i === peakIdx ? '#BAF14D' : 'rgba(186,241,77,0.6)'} />
            ))}
            <text
              x={points[peakIdx].x}
              y={points[peakIdx].y - 10}
              textAnchor="middle"
              fill="#BAF14D"
              fontSize="11"
              fontWeight="700"
              fontFamily="var(--font-display), system-ui, sans-serif"
            >
              {weeks[peakIdx].active_trips.toLocaleString()}
            </text>
          </svg>
          <div className="mt-1 flex justify-between text-[11px] font-medium text-white/70">
            {weeks.map((d) => {
              const end = new Date(`${d.week_start}T00:00:00`)
              end.setDate(end.getDate() + 6)
              return (
                <span key={d.week_start}>
                  {end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function CampaignDataViz() {
  return (
    <>
      <ModeSplitSection />
      <MomentumSection />
    </>
  )
}
