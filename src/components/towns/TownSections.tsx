import Link from 'next/link'
import RoamCard from '@/components/roams/RoamCard'
import TownEventsPanel from '@/components/towns/TownEventsPanel'
import type {
  TownEvent,
  TownPageStats,
  TownPartner,
  TownRoam,
  TownSummary,
} from '@/lib/towns/queries'

/**
 * Server-rendered sections for the public town pages. Every optional section
 * returns null when its data is absent (degradation contract) — the base
 * skeleton (hero, stats, disclaimer, explainer, CTA) always renders.
 *
 * Framing rules (non-negotiable, see shift-town-pages-spec.md):
 *  - "active miles", never "car-free miles"; CO2 is "avoided, estimated
 *    from active miles traveled", never framed against driving.
 *  - Shift-user-sample disclaimer near the stats and in the footer note.
 *  - "Rewards Partner", never "sponsor".
 */

/* ── stat row ─────────────────────────────────────────────── */

export function StatRow({ stats }: { stats: TownPageStats }) {
  const m = stats.month
  const cells = [
    { value: m.active_trips.toLocaleString(), label: 'active trips this month' },
    { value: m.active_miles.toLocaleString(), label: 'active miles' },
    { value: m.co2_lbs.toLocaleString(), label: 'lbs CO₂ avoided*' },
    { value: m.active_users.toLocaleString(), label: 'neighbors moving this month' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {cells.map((c) => (
        <div
          key={c.label}
          className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-5 py-5 text-center"
        >
          <div className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold tracking-tight text-[#BAF14D]">
            {c.value}
          </div>
          <div className="mt-1 text-xs font-medium text-white/75">{c.label}</div>
        </div>
      ))}
    </div>
  )
}

export function DataDisclaimer({ townName }: { townName: string }) {
  return (
    <p className="mx-auto mt-4 max-w-[620px] text-center text-[12.5px] leading-relaxed text-white/75">
      Based on trips logged by <b className="text-white">Shift users who live in {townName}</b> — a
      growing sample, meant as an interesting local signal, not an official or census-level count.
      *CO&#8322; avoided is estimated from active miles traveled (EPA 404&nbsp;g/mi baseline).
    </p>
  )
}

/* ── momentum sparkline ───────────────────────────────────── */

export function MomentumSparkline({ stats, townName }: { stats: TownPageStats; townName: string }) {
  const weeks = stats.momentum ?? []
  const total = weeks.reduce((s, w) => s + w.active_trips, 0)
  if (weeks.length < 3 || total === 0) return null

  const w = 560
  const h = 120
  const pad = 8
  const max = Math.max(...weeks.map((d) => d.active_trips), 1)
  const step = (w - pad * 2) / (weeks.length - 1)
  const points = weeks.map((d, i) => ({
    x: pad + i * step,
    y: h - pad - (d.active_trips / max) * (h - pad * 2),
  }))
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${path} L${points[points.length - 1].x.toFixed(1)},${h - pad} L${points[0].x.toFixed(1)},${h - pad} Z`
  const first = weeks[0].active_trips
  const last = weeks[weeks.length - 1].active_trips
  const rising = last > first

  return (
    <section className="mx-auto max-w-[720px]">
      <h2 className="mb-1 text-center font-display text-2xl font-bold tracking-tight text-white">
        Momentum
      </h2>
      <p className="mb-5 text-center text-sm text-white/75">
        Weekly active trips in {townName}, last {weeks.length} completed weeks
        {rising ? ' — and climbing' : ''}
      </p>
      <div className="rounded-[18px] border border-white/[0.08] bg-[#242538] px-6 pb-4 pt-6">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={`Weekly active trips: ${weeks.map((d) => d.active_trips).join(', ')}`}>
          <path d={area} fill="rgba(186,241,77,0.10)" />
          <path d={path} fill="none" stroke="#BAF14D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 2.5} fill={i === points.length - 1 ? '#BAF14D' : 'rgba(186,241,77,0.6)'} />
          ))}
        </svg>
        <div className="mt-1 flex justify-between text-[11px] font-medium text-white/70">
          {weeks.map((d) => (
            <span key={d.week_start}>
              {new Date(`${d.week_start}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── leaderboard ──────────────────────────────────────────── */

export function TownLeaderboard({
  directory,
  highlightGroupId,
  title = 'The friendly race',
}: {
  directory: TownSummary[]
  highlightGroupId?: string
  title?: string
}) {
  const qualifying = directory.filter((t) => t.rank > 0)
  if (qualifying.length < 2) return null
  const maxTrips = Math.max(...qualifying.map((t) => t.active_trips_month), 1)
  const highlighted = qualifying.find((t) => t.group_id === highlightGroupId)
  const leader = qualifying[0]
  const gap =
    highlighted && highlighted.rank > 1
      ? leader.active_trips_month - highlighted.active_trips_month
      : 0

  return (
    <section className="mx-auto max-w-[820px]">
      <h2 className="mb-1 text-center font-display text-2xl font-bold tracking-tight text-white">
        {title}
      </h2>
      <p className="mb-5 text-center text-sm text-white/75">
        Active trips this month, town vs. town
        {highlighted && gap > 0 && (
          <>
            {' '}&middot;{' '}
            <span className="font-semibold text-[#EDB93C]">
              {highlighted.town_name} is {gap.toLocaleString()} trips from #1
            </span>
          </>
        )}
      </p>
      <div className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#242538]">
        {qualifying.map((t) => {
          const isMe = t.group_id === highlightGroupId
          const pct = Math.max(4, Math.round((t.active_trips_month / maxTrips) * 100))
          return (
            <Link
              key={t.group_id}
              href={`/shift/towns/${t.slug}`}
              className={`grid grid-cols-[2.5rem_8.5rem_1fr_4.5rem] items-center gap-3 border-b border-white/[0.05] px-5 py-3 transition-colors last:border-b-0 hover:bg-white/[0.04] md:grid-cols-[2.5rem_11rem_1fr_5.5rem] ${
                isMe ? 'bg-[#BAF14D]/[0.07]' : ''
              }`}
            >
              <span className={`text-right font-display text-base font-bold ${t.rank <= 3 ? 'text-[#EDB93C]' : 'text-white/60'}`}>
                {t.rank}
              </span>
              <span className="truncate">
                <span className={`font-medium ${isMe ? 'text-[#BAF14D]' : 'text-white'}`}>{t.town_name}</span>
                <span className="ml-2 hidden text-xs text-white/60 md:inline">{t.member_count} on Shift</span>
              </span>
              <span className="block h-2.5 overflow-hidden rounded-lg bg-white/[0.07]">
                <span
                  className="block h-full rounded-lg"
                  style={{ width: `${pct}%`, backgroundColor: isMe ? '#BAF14D' : '#5d6a94' }}
                />
              </span>
              <span className="text-right font-display text-sm font-bold text-white">
                {t.active_trips_month.toLocaleString()}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

/* ── mode split ───────────────────────────────────────────── */

const MODE_META: Record<string, { label: string; color: string }> = {
  walk: { label: 'Walking', color: '#BAF14D' },
  bike: { label: 'Biking & scooting', color: '#2966E5' },
  transit: { label: 'Transit', color: '#EDB93C' },
}

export function ModeSplit({ stats, townName }: { stats: TownPageStats; townName: string }) {
  const rows = stats.mode_split ?? []
  const totalTrips = rows.reduce((s, r) => s + r.trips, 0)
  if (totalTrips === 0) return null
  const maxTrips = Math.max(...rows.map((r) => r.trips), 1)
  const maxMiles = Math.max(...rows.map((r) => r.miles), 1)

  return (
    <section className="mx-auto max-w-[720px]">
      <h2 className="mb-1 text-center font-display text-2xl font-bold tracking-tight text-white">
        How {townName} moves
      </h2>
      <p className="mb-5 text-center text-sm text-white/75">Active trips and miles this month, by mode</p>
      <div className="space-y-4 rounded-[18px] border border-white/[0.08] bg-[#242538] p-6">
        {rows.map((r) => {
          const meta = MODE_META[r.mode_group] ?? { label: r.mode_group, color: '#5d6a94' }
          return (
            <div key={r.mode_group}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-white">{meta.label}</span>
                <span className="text-xs text-white/75">
                  {r.trips.toLocaleString()} trips &middot; {r.miles.toLocaleString()} mi
                </span>
              </div>
              <div className="space-y-1">
                <span className="block h-2.5 overflow-hidden rounded-lg bg-white/[0.07]">
                  <span
                    className="block h-full rounded-lg"
                    style={{ width: `${Math.max(3, Math.round((r.trips / maxTrips) * 100))}%`, backgroundColor: meta.color }}
                  />
                </span>
                <span className="block h-1.5 overflow-hidden rounded-lg bg-white/[0.05]">
                  <span
                    className="block h-full rounded-lg opacity-50"
                    style={{ width: `${Math.max(3, Math.round((r.miles / maxMiles) * 100))}%`, backgroundColor: meta.color }}
                  />
                </span>
              </div>
            </div>
          )
        })}
        <p className="pt-1 text-[11px] text-white/70">
          Thick bar = trips &middot; thin bar = miles. Transit trips cover the most ground; walking
          trips happen most often.
        </p>
      </div>
    </section>
  )
}

/* ── explainer ────────────────────────────────────────────── */

export function WhatIsShift({ townName }: { townName: string }) {
  return (
    <section className="mx-auto max-w-[720px]">
      <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] px-8 py-8 text-center">
        <h2 className="mb-3 font-display text-xl font-bold tracking-tight text-white">
          What is this?
        </h2>
        <p className="text-[0.9375rem] leading-[1.7] text-white/75">
          Shift is a free app from{' '}
          <Link href="/" className="font-semibold text-[#BAF14D]">
            Green Streets Initiative
          </Link>
          , a nonprofit that has celebrated walking, biking, and transit since 2006. Shift
          automatically counts your walks, rides, and transit trips — every trip adds to{' '}
          {townName}&apos;s totals on this page, earns you rewards at local businesses, and enters
          you into seasonal prize drawings.
        </p>
      </div>
    </section>
  )
}

/* ── events & roams ───────────────────────────────────────── */

export function EventsRoamsPanels({
  events,
  roams,
  townName,
}: {
  events: TownEvent[]
  roams: TownRoam[]
  townName: string
}) {
  if (events.length === 0 && roams.length === 0) return null
  const both = events.length > 0 && roams.length > 0
  return (
    <section className="mx-auto max-w-[960px]">
      <div className={`grid gap-5 ${both ? 'md:grid-cols-2' : ''}`}>
        {events.length > 0 && <TownEventsPanel events={events} townName={townName} />}
        {roams.length > 0 && (
          <div className="rounded-[18px] border border-white/[0.08] bg-[#242538] p-6">
            <h3 className="mb-1 font-display text-lg font-bold tracking-tight text-white">
              Roams to try
            </h3>
            <p className="mb-4 text-xs text-white/75">
              Guided routes — preview the full route here, then check in at each stop in the Shift
              app to earn the badge.
            </p>
            <div className="space-y-3">
              {roams.map((r) => (
                <RoamCard key={r.id} roam={r} />
              ))}
            </div>
            <Link href="/shift/roams" className="mt-4 inline-block text-sm font-semibold text-[#BAF14D]">
              All roams &rarr;
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

/* ── rewards partners ─────────────────────────────────────── */

export function RewardsPartners({ partners, townName }: { partners: TownPartner[]; townName: string }) {
  if (partners.length === 0) return null
  return (
    <section className="mx-auto max-w-[960px]">
      <h2 className="mb-1 text-center font-display text-2xl font-bold tracking-tight text-white">
        Shift Rewards in {townName}
      </h2>
      <p className="mb-6 text-center text-sm text-white/75">
        Local businesses that reward people for moving actively
      </p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {partners.map((p) => {
          const card = (
            <div className="flex h-full flex-col rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.06]">
              <div className="mb-3 flex h-[64px] items-center justify-center rounded-[10px] bg-white px-3">
                {p.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logo_url} alt={p.name} className="max-h-[44px] max-w-[85%] object-contain" />
                ) : (
                  <span className="text-center text-sm font-semibold text-[#191A2E]">{p.name}</span>
                )}
              </div>
              <p className="text-sm font-semibold leading-snug text-white">{p.name}</p>
              {p.discount_description && (
                <p className="mt-1 text-xs leading-snug text-[#BAF14D]">{p.discount_description}</p>
              )}
              {p.address && <p className="mt-1 text-[11px] leading-snug text-white/70">{p.address}</p>}
            </div>
          )
          return p.website_url ? (
            <a key={p.id} href={p.website_url} target="_blank" rel="noopener noreferrer" className="block h-full">
              {card}
            </a>
          ) : (
            <div key={p.id} className="h-full">{card}</div>
          )
        })}
      </div>
    </section>
  )
}
