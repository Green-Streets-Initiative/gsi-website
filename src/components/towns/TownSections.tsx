import Link from 'next/link'
import { PILL, SectionHeading } from '@/components/org/Section'
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

/**
 * The month's numbers as a ledger: hairlines, serif numerals. When the town
 * is ranked, its standing leads; the disclaimer is the ledger's footnote so
 * the numbers and their caveat never separate.
 */
export function StatRow({
  stats,
  townName,
  rank,
  unrankedNote,
}: {
  stats: TownPageStats
  townName: string
  /** Null when the town is not on its state board this month. */
  rank: { rank: number; of: number; stateName: string } | null
  /** Why the town is unranked, shown first in the footnote when `rank` is null. */
  unrankedNote?: string
}) {
  const m = stats.month
  const month = new Date().toLocaleDateString('en-US', { month: 'long' })
  const cells = [
    ...(rank ? [{ value: `#${rank.rank} of ${rank.of}`, label: `${rank.stateName} towns by shift rate in ${month}` }] : []),
    { value: m.active_trips.toLocaleString(), label: `active trips so far in ${month}` },
    { value: m.active_miles.toLocaleString(), label: 'active miles' },
    { value: m.co2_lbs.toLocaleString(), label: 'lbs CO₂ avoided*' },
    { value: m.active_users.toLocaleString(), label: `neighbors active so far in ${month}` },
  ]
  return (
    <div className="border-y border-navy/15 py-7">
      <dl className={`grid grid-cols-2 gap-x-8 gap-y-5 ${cells.length === 5 ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
        {cells.map((c) => (
          <div key={c.label}>
            <dd className="font-serif text-[2rem] leading-none tracking-[-0.01em] text-navy md:text-[2.25rem]">{c.value}</dd>
            <dt className="mt-1 text-[13px] leading-snug text-ink-soft">{c.label}</dt>
          </div>
        ))}
      </dl>
      <DataDisclaimer townName={townName} lead={unrankedNote} />
    </div>
  )
}

export function DataDisclaimer({ townName, lead }: { townName: string; lead?: string }) {
  return (
    <p className="mt-4 max-w-[720px] text-[12px] leading-relaxed text-ink-soft">
      {lead ? `${lead} ` : ''}
      Shift Rate is the share of trips taken actively (walk, micromobility, transit). Counts cover{' '}
      {new Date().toLocaleDateString('en-US', { month: 'long' })} 1 through today, based on trips logged by Shift community members that{' '}
      <b className="font-semibold text-navy">start or end in {townName}</b> — a growing sample, meant as an interesting local signal, not an
      official or census-level count. *CO&#8322; avoided is estimated from active miles traveled (EPA 404&nbsp;g/mi baseline).
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
    <div>
      <SectionHeading title={`Where ${townName} moves`} />
      {/* Server-rendered summary — crawlers and screen readers get the story
          (including the top corridor names) even though the map is client-only. */}
      <p className="-mt-2 mb-6 max-w-[680px] text-[15px] leading-relaxed text-ink-soft">
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
    </div>
  )
}

/* ── momentum sparkline ───────────────────────────────────── */

export function MomentumSparkline({ stats, townName }: { stats: TownPageStats; townName: string }) {
  const weeks = stats.momentum ?? []
  const total = weeks.reduce((s, w) => s + w.active_trips, 0)
  if (weeks.length < 3 || total === 0) return null

  const w = 560
  const h = 130
  const pad = 10
  const max = Math.max(...weeks.map((d) => d.active_trips), 1)
  const step = (w - pad * 2) / (weeks.length - 1)
  const points = weeks.map((d, i) => ({
    x: pad + i * step,
    y: h - pad - (d.active_trips / max) * (h - pad * 2 - 14),
  }))
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${path} L${points[points.length - 1].x.toFixed(1)},${h - pad} L${points[0].x.toFixed(1)},${h - pad} Z`
  const first = weeks[0].active_trips
  const last = weeks[weeks.length - 1].active_trips
  const rising = last > first

  return (
    <div>
      <SectionHeading
        title="Momentum"
        lede={`Active trips in ${townName} by week ending, last ${weeks.length} completed weeks${rising ? ', and climbing' : ''}.`}
      />
      <div className="border-y border-navy/15 py-6">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={`Weekly active trips: ${weeks.map((d) => d.active_trips).join(', ')}`}>
          <path d={area} fill="rgba(45,106,79,0.10)" />
          <path d={path} fill="none" stroke="#2D6A4F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4.5 : 3} fill={i === points.length - 1 ? '#1B4332' : '#F4F8EE'} stroke="#2D6A4F" strokeWidth="2" />
          ))}
        </svg>
        <div className="mt-2 flex justify-between text-[11px] tabular-nums text-ink-soft">
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
  )
}

/* ── leaderboard ──────────────────────────────────────────── */

export function TownLeaderboard({
  directory,
  state,
  highlightGroupId,
  title = 'Friendly competition',
}: {
  directory: TownSummary[]
  /** Board is scoped to this state — towns only race towns in their own state. */
  state: string
  highlightGroupId?: string
  title?: string
}) {
  const qualifying = directory.filter((t) => t.rank > 0 && t.state === state)
  if (qualifying.length < 2) return null
  return (
    <TownLeaderboardBoard
      directory={directory}
      state={state}
      stateName={qualifying[0].stateName}
      highlightGroupId={highlightGroupId}
      title={title}
    />
  )
}

/* ── mode split ───────────────────────────────────────────── */

export function ModeSplit({ stats, townName }: { stats: TownPageStats; townName: string }) {
  return <ModeSplitChart stats={stats} townName={townName} />
}

/* ── explainer ────────────────────────────────────────────── */

export function WhatIsShift({ townName }: { townName: string }) {
  return (
    <div className="max-w-[720px] border-t border-navy/15 pt-6">
      <h2 className="font-serif text-[1.375rem] leading-tight text-navy">What is this?</h2>
      <p className="mt-3 text-[1.0625rem] leading-[1.65] text-ink-soft">
        Shift is a free app from{' '}
        <Link href="/" className="font-semibold text-forest underline-offset-4 hover:underline">
          Green Streets Initiative
        </Link>
        , a nonprofit that has celebrated walking, biking, and transit since 2006. Shift
        automatically counts your walks, rides, and transit trips — every trip adds to{' '}
        {townName}&apos;s totals on this page, earns you rewards at local businesses, and enters
        you into seasonal prize drawings.
      </p>
    </div>
  )
}

/* ── events & roams ───────────────────────────────────────── */

// `light` is the cream campaign pages; `dark` (default) keeps the town pages
// byte-identical.
const PANEL_THEME = {
  dark: {
    panel: 'rounded-[18px] border border-white/[0.08] bg-[#242538] p-6',
    h3: 'mb-1 font-display text-lg font-bold tracking-tight text-white',
    sub: 'mb-4 text-xs text-white/75',
    all: 'mt-4 inline-block text-sm font-semibold text-[#BAF14D]',
  },
  light: {
    panel: 'rounded-[18px] border border-navy/10 bg-white p-6',
    h3: 'mb-1 font-serif text-[1.375rem] leading-tight text-navy',
    sub: 'mb-4 text-[13px] text-ink-soft',
    all: 'mt-4 inline-block text-[15px] font-semibold text-forest underline-offset-4 hover:underline',
  },
} as const

export function EventsRoamsPanels({
  events,
  roams,
  townName,
  tone = 'dark',
}: {
  events: TownEvent[]
  roams: TownRoam[]
  townName: string
  tone?: 'dark' | 'light'
}) {
  if (events.length === 0 && roams.length === 0) return null
  const both = events.length > 0 && roams.length > 0
  const t = PANEL_THEME[tone]
  return (
    <section className="mx-auto max-w-[960px]">
      <div className={`grid gap-5 ${both ? 'md:grid-cols-2' : ''}`}>
        {events.length > 0 && <TownEventsPanel events={events} townName={townName} tone={tone} />}
        {roams.length > 0 && (
          <div className={t.panel}>
            <h3 className={t.h3}>
              Roams to try
            </h3>
            <p className={t.sub}>
              Guided routes — preview the full route here, then check in at each stop in the Shift
              app to earn the badge.
            </p>
            <div className="space-y-3">
              {roams.map((r) => (
                <RoamCard key={r.id} roam={r} tone={tone} />
              ))}
            </div>
            <Link href="/shift/roams" className={t.all}>
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
  commuter_services: 'Commuter perks & fare help',
  bike_share: 'Bike share',
  bike_repair: 'Fix your own bike',
  construction_info: 'Construction & closures',
  get_updates: 'Get updates',
  report_issue: 'Report an issue',
}
const DRAWER_CATEGORY_ORDER = [
  'bike_ped_committee',
  'advocacy_group',
  'commuter_services',
  'bike_share',
  'bike_repair',
  'construction_info',
  'get_updates',
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
    <div className="max-w-[720px]">
      <SectionHeading title={`Get involved in ${townName}`} lede="Safer streets are made by neighbors who speak up. Start small:" />

      {/* 1. Happening now — zero or one. An item with nowhere to send
          people is a plain card: no button that leads back to this page. */}
      {featured && (() => {
        const linked = featured.href !== '#'
        const Card = linked ? 'a' : 'div'
        const linkProps = linked
          ? featured.href.startsWith('mailto:')
            ? { href: featured.href }
            : { href: featured.href, target: '_blank', rel: 'noopener noreferrer' }
          : {}
        return (
          <Card
            {...linkProps}
            className={`mb-4 block rounded-[16px] border border-gold/60 bg-white p-5 ${linked ? 'transition-colors hover:border-gold' : ''}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-navy">
                Happening now
              </span>
              <span className="text-[13px] font-semibold text-green-deep">{featured.chip}</span>
            </div>
            <p className="font-serif text-[1.375rem] leading-tight text-navy">{featured.title}</p>
            {featured.desc && (
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{featured.desc}</p>
            )}
            {linked && (
              <span className={`mt-4 ${PILL} min-h-[44px] px-5 text-[14px]`}>
                {featured.label} &rarr;
              </span>
            )}
          </Card>
        )
      })()}

      {/* Also coming up — at most two rows. A closing window gets a
          Deadline badge and a countdown so it can't fade behind the lead. */}
      {upNext.length > 0 && (
        <ul className="mb-4 border-t border-navy/15">
          {upNext.map((c) => {
            const linked = c.href !== '#'
            const daysLeft = c.deadline ? Math.max(0, Math.ceil((c.sort - Date.now()) / 86400000)) : null
            const countdown = daysLeft === null ? null : daysLeft === 0 ? 'Today' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`
            const inner = (
              <>
                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  {c.deadline && (
                    <span className="rounded-full border border-gold bg-gold/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-navy">
                      Deadline
                    </span>
                  )}
                  <span className="text-[13px] font-semibold text-green-deep">
                    {c.chip}
                    {countdown && <span className="text-navy"> · {countdown}</span>}
                  </span>
                </span>
                <span className="min-w-0 text-[15px] font-semibold leading-snug text-navy [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">{c.title}</span>
              </>
            )
            const rowClass = 'flex min-h-[44px] flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-3'
            return (
              <li key={c.key} className="border-b border-navy/15">
                {linked ? (
                  <a href={c.href} {...(c.href.startsWith('mailto:') ? {} : { target: '_blank', rel: 'noopener noreferrer' })} className={`${rowClass} hover:text-forest`}>
                    {inner}
                  </a>
                ) : (
                  <div className={rowClass}>{inner}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* 2. Action rows — verbs, not cards */}
      {actions.length > 0 && (
        <ul className="border-t border-navy/15">
          {actions.map((r) => (
            <li key={r.id} className="border-b border-navy/15">
              <a
                href={civicUrl(r.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3 py-3.5"
              >
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-navy group-hover:underline group-hover:underline-offset-4">{r.action_label}</span>
                  <span className="block text-[13px] text-ink-soft">{r.name}</span>
                </span>
                <span className="shrink-0 text-forest transition-transform group-hover:translate-x-0.5">&rarr;</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* 3. Town-level directory — ALWAYS visible (Keith 07-16: a user on a
          town page sees that town's content first; hidden ≠ ok for local). */}
      {localResources.length > 0 && (
        <div className="mt-6 space-y-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-forest">In {townName}</p>
          {resourceGroups(localResources, civicUrl)}
        </div>
      )}

      {/* 4. Shared regional/statewide tail — the one list that's identical on
          every town page stays behind the drawer. */}
      {sharedResources.length > 0 && (
        <details className="group mt-6">
          <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[15px] font-semibold text-forest underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
            Regional &amp; statewide groups, {sharedResources.length} more{' '}
            <span aria-hidden className="transition-transform group-open:rotate-90">&rsaquo;</span>
          </summary>
          <div className="mt-4 space-y-5 border-t border-navy/15 pt-5">
            {resourceGroups(sharedResources, civicUrl)}
          </div>
        </details>
      )}
    </div>
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
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
          {DRAWER_CATEGORY_META[cat] ?? cat}
        </p>
        <ul className="space-y-2">
          {inCat.map((r) => (
            <li key={r.id} className="text-[15px] leading-snug text-ink-soft">
              {r.url ? (
                <a href={civicUrl(r.url)} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy underline decoration-navy/30 underline-offset-2 hover:decoration-forest hover:text-forest">
                  {r.name}
                </a>
              ) : (
                <span className="font-semibold text-navy">{r.name}</span>
              )}
              {r.scope !== 'local' && (
                <span className="ml-1.5 rounded-full bg-navy/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                  {r.scope}
                </span>
              )}
              {r.description && <span> &mdash; {r.description}</span>}
              {(r.contact_email || r.contact_phone) && (
                <span>
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
    <div>
      <SectionHeading title={`Shift Rewards in ${townName}`} lede="Local businesses that reward people for moving actively." />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {partners.map((p) => {
          const card = (
            <div className="flex h-full flex-col rounded-[14px] border border-navy/10 bg-white p-4 transition-colors hover:border-navy/30">
              <div className="mb-3 flex h-[64px] items-center justify-center rounded-[10px] bg-cream px-3">
                {p.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logo_url} alt={p.name} className="max-h-[44px] max-w-[85%] object-contain" />
                ) : (
                  <span className="text-center text-sm font-semibold text-navy">{p.name}</span>
                )}
              </div>
              <p className="text-[15px] font-semibold leading-snug text-navy">{p.name}</p>
              {p.discount_description && (
                <p className="mt-1 text-[13px] leading-snug text-green-deep">{p.discount_description}</p>
              )}
              {p.address && <p className="mt-1 text-[12px] leading-snug text-ink-soft">{p.address}</p>}
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
    </div>
  )
}
