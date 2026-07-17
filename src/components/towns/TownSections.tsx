import Link from 'next/link'
import { withUtm } from '@/lib/utm'
import { buildFeaturedCandidates, type FeaturedItem } from '@/lib/towns/civic-featured'
import type { TownCivicEvent } from '@/lib/towns/queries'
import ModeSplitChart from '@/components/towns/ModeSplitChart'
import RoamCard from '@/components/roams/RoamCard'
import TownEventsPanel from '@/components/towns/TownEventsPanel'
import TownHeatmap from '@/components/towns/TownHeatmap'
import TownLeaderboardBoard from '@/components/towns/TownLeaderboardBoard'
import type {
  TownEvent,
  TownHeatmapLayer,
  TownPageStats,
  TownPartner,
  TownResource,
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
  const month = new Date().toLocaleDateString('en-US', { month: 'long' })
  const cells = [
    { value: m.active_trips.toLocaleString(), label: `active trips so far in ${month}` },
    { value: m.active_miles.toLocaleString(), label: 'active miles' },
    { value: m.co2_lbs.toLocaleString(), label: 'lbs CO₂ avoided*' },
    { value: m.active_users.toLocaleString(), label: `neighbors active so far in ${month}` },
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
      Counts cover {new Date().toLocaleDateString('en-US', { month: 'long' })} 1 through today,
      based on trips logged by <b className="text-white">Shift users who live in {townName}</b> — a
      growing sample, meant as an interesting local signal, not an official or census-level count.
      *CO&#8322; avoided is estimated from active miles traveled (EPA 404&nbsp;g/mi baseline).
    </p>
  )
}

/* ── corridor heatmap ─────────────────────────────────────── */

export function HeatmapSection({
  layers,
  townName,
  centroid,
}: {
  layers: TownHeatmapLayer[]
  townName: string
  centroid: { lat: number; lng: number } | null
}) {
  if (layers.length === 0) return null
  const all = layers.find((l) => l.mode_group === 'all') ?? layers[0]
  const topNames = (all.named_corridors ?? []).slice(0, 3).map((c) => c.name)
  return (
    <section className="mx-auto max-w-[960px]">
      <h2 className="mb-1 text-center font-display text-2xl font-bold tracking-tight text-white">
        Where {townName} moves
      </h2>
      {/* Server-rendered summary — crawlers and screen readers get the story
          (including the top corridor names) even though the map is client-only. */}
      <p className="mx-auto mb-6 max-w-[640px] text-center text-sm leading-relaxed text-white/75">
        New to {townName}? You&apos;re joining a town that moves — neighbors logged{' '}
        {all.trip_count.toLocaleString()} trips on foot, by bike, and on transit in the last 90
        days{topNames.length > 0 ? (
          <>
            , and {topNames.slice(0, -1).join(', ')}
            {topNames.length > 1 ? ' and ' : ''}
            {topNames[topNames.length - 1]}{' '}are where you&apos;ll find them
          </>
        ) : (
          ''
        )}
        . A corridor appears only once three or more different people have traveled it — and it
        follows {townName} residents wherever they go, including into neighboring towns, within
        about six miles of the town center.
      </p>
      <TownHeatmap layers={layers} centroid={centroid} />
    </section>
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
        Active trips in {townName} by week ending, last {weeks.length} completed weeks
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
    </section>
  )
}

/* ── leaderboard ──────────────────────────────────────────── */

export function TownLeaderboard({
  directory,
  highlightGroupId,
  title = 'Friendly competition',
}: {
  directory: TownSummary[]
  highlightGroupId?: string
  title?: string
}) {
  const qualifying = directory.filter((t) => t.rank > 0)
  if (qualifying.length < 2) return null
  return (
    <section className="mx-auto max-w-[820px]">
      <TownLeaderboardBoard directory={directory} highlightGroupId={highlightGroupId} title={title} />
    </section>
  )
}

/* ── mode split ───────────────────────────────────────────── */

export function ModeSplit({ stats, townName }: { stats: TownPageStats; townName: string }) {
  return <ModeSplitChart stats={stats} townName={townName} />
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

/* ── get involved (civic / advocacy) ──────────────────────── */

/**
 * Get Involved v2 — one timely thing, three verbs, and a drawer.
 * A novice gets a 5-second read: what's happening now (if anything), the
 * easiest actions, and one expandable for everything else. The rendering
 * rule is deterministic: future happens_at within 30 days -> featured
 * (soonest wins); action_label set -> action row; otherwise -> drawer.
 */

const DRAWER_CATEGORY_META: Record<string, string> = {
  town_dept: 'Your transportation department',
  public_meetings: 'Meetings & comment pathways',
  bike_ped_committee: 'City committees you can join',
  advocacy_group: 'Advocacy groups',
  commuter_services: 'Free commuter perks & shuttles',
  bike_repair: 'Fix your own bike',
  report_issue: 'Report an issue',
}
const DRAWER_CATEGORY_ORDER = [
  'bike_ped_committee',
  'advocacy_group',
  'commuter_services',
  'bike_repair',
  'public_meetings',
  'town_dept',
  'report_issue',
]

// Timely-item selection + ET-safe date helpers moved to
// src/lib/towns/civic-featured.ts, shared with the town digest email so the
// page and the email can never drift.

export function GetInvolved({
  resources,
  civicEvents,
  townName,
  townSlug,
}: {
  resources: TownResource[]
  civicEvents: TownCivicEvent[]
  townName: string
  townSlug: string
}) {
  const civicUrl = (url: string | null) =>
    withUtm(url, { medium: 'town_page', campaign: townSlug, content: 'get_involved' }) ?? '#'
  if (resources.length === 0 && civicEvents.length === 0) return null

  const { candidates, civicDupIds } = buildFeaturedCandidates(civicEvents, resources, civicUrl)
  const featured = candidates[0] ?? null
  const upNext = candidates.slice(1, 3)
  const shownResourceIds = new Set(
    [featured, ...upNext].filter((c): c is FeaturedItem => Boolean(c && c.key.startsWith('res-'))).map((c) => c.key.slice(4)),
  )

  const actions = resources.filter((r) => r.action_label && !r.happens_at)
  const drawer = resources.filter((r) => !actions.includes(r) && !shownResourceIds.has(r.id) && !civicDupIds.has(r.id))
  // Town first, always visible; the shared regional/statewide tail (identical
  // on every town page) is the only part that collapses.
  const localResources = drawer.filter((r) => r.scope === 'local')
  const sharedResources = [
    ...drawer.filter((r) => r.scope === 'regional'),
    ...drawer.filter((r) => r.scope === 'statewide'),
  ]

  return (
    <section className="mx-auto max-w-[720px]">
      <h2 className="mb-1 text-center font-display text-2xl font-bold tracking-tight text-white">
        Get involved in {townName}
      </h2>
      <p className="mx-auto mb-6 max-w-[560px] text-center text-sm text-white/75">
        Safer streets are made by neighbors who speak up. Start small:
      </p>

      {/* 1. Happening now — zero or one */}
      {featured && (
        <a
          href={featured.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 block rounded-[16px] border border-[#EDB93C]/35 bg-[#EDB93C]/[0.07] p-5 transition-colors hover:bg-[#EDB93C]/[0.12]"
        >
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#EDB93C] px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[#191A2E]">
              Happening now
            </span>
            <span className="text-xs font-semibold text-[#EDB93C]">{featured.chip}</span>
          </div>
          <p className="font-display text-lg font-bold leading-snug text-white">{featured.title}</p>
          {featured.desc && (
            <p className="mt-1 text-sm leading-relaxed text-white/80">{featured.desc}</p>
          )}
          <span className="mt-3 inline-block rounded-full bg-[#EDB93C] px-4 py-2 text-sm font-bold text-[#191A2E]">
            {featured.label} &rarr;
          </span>
        </a>
      )}

      {/* Also coming up — at most two slim rows */}
      {upNext.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {upNext.map((c) => (
            <a
              key={c.key}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-baseline gap-2.5 rounded-[10px] border border-[#EDB93C]/[0.15] bg-[#EDB93C]/[0.03] px-4 py-2.5 transition-colors hover:bg-[#EDB93C]/[0.08]"
            >
              <span className="shrink-0 text-xs font-semibold text-[#EDB93C]">{c.chip}</span>
              <span className="min-w-0 truncate text-sm font-semibold text-white">{c.title}</span>
            </a>
          ))}
        </div>
      )}

      {/* 2. Action rows — verbs, not cards */}
      {actions.length > 0 && (
        <div className="space-y-2">
          {actions.map((r) => (
            <a
              key={r.id}
              href={civicUrl(r.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-[12px] border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 transition-colors hover:bg-white/[0.08]"
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold text-white">{r.action_label}</span>
                <span className="block text-xs text-white/70">{r.name}</span>
              </span>
              <span className="shrink-0 text-[#BAF14D]">&rarr;</span>
            </a>
          ))}
        </div>
      )}

      {/* 3. Town-level directory — ALWAYS visible (Keith 07-16: a user on a
          town page sees that town's content first; hidden ≠ ok for local). */}
      {localResources.length > 0 && (
        <div className="mt-4 space-y-4 rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#BAF14D]">
            In {townName}
          </p>
          {resourceGroups(localResources, civicUrl)}
        </div>
      )}

      {/* 4. Shared regional/statewide tail — the one list that's identical on
          every town page stays behind the drawer. */}
      {sharedResources.length > 0 && (
        <details className="group mt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[12px] border border-white/[0.12] bg-white/[0.04] px-4 py-3.5 transition-colors hover:bg-white/[0.08] [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="block text-sm font-bold text-white">Regional &amp; statewide groups</span>
              <span className="block text-xs text-white/70">
                {sharedResources.length}{' '}more &mdash; research, campaigns, and coalitions you can join
              </span>
            </span>
            <span className="shrink-0 text-[#BAF14D] transition-transform group-open:rotate-90">&rarr;</span>
          </summary>
          <div className="mt-3 space-y-4 rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4">
            {resourceGroups(sharedResources, civicUrl)}
          </div>
        </details>
      )}
    </section>
  )
}

/** Category-grouped resource list shared by the visible local block and the
 *  regional/statewide drawer. Input order is preserved within a category. */
function resourceGroups(list: TownResource[], civicUrl: (url: string | null) => string) {
  return DRAWER_CATEGORY_ORDER.map((cat) => {
    const inCat = list.filter((r) => r.category === cat)
    if (inCat.length === 0) return null
    return (
      <div key={cat}>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-white/60">
          {DRAWER_CATEGORY_META[cat] ?? cat}
        </p>
        <ul className="space-y-1.5">
          {inCat.map((r) => (
            <li key={r.id} className="text-sm leading-snug">
              {r.url ? (
                <a href={civicUrl(r.url)} target="_blank" rel="noopener noreferrer" className="font-semibold text-white underline decoration-white/30 underline-offset-2 hover:decoration-[#BAF14D]">
                  {r.name}
                </a>
              ) : (
                <span className="font-semibold text-white">{r.name}</span>
              )}
              {r.scope !== 'local' && (
                <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/70">
                  {r.scope}
                </span>
              )}
              {r.description && <span className="text-white/75"> &mdash; {r.description}</span>}
              {(r.contact_email || r.contact_phone) && (
                <span className="text-white/60">
                  {' '}({[r.contact_email, r.contact_phone].filter(Boolean).join(' · ')})
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    )
  })
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
