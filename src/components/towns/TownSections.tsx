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
import { rich } from '@/components/towns/rich'
import { siteDate, translator, withLang, SITE_LOCALE_TAG, type SiteLocale } from '@/lib/site-i18n'
import { townsStrings } from '@/lib/site-strings/towns'
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
 *
 * Every section takes an optional `locale` (translation plan, batch 5); words
 * live in site-strings/towns.ts. Callers that pass none (the school pages,
 * the sign previews) stay English.
 */

const tt = (locale: SiteLocale) => translator(townsStrings, locale)

/** Whole numbers in the page's language; English keeps the server default. */
export function townNum(n: number, locale: SiteLocale = 'en'): string {
  return locale === 'en' ? n.toLocaleString() : n.toLocaleString(SITE_LOCALE_TAG[locale])
}

/** "This month" in the page's language: "November", "noviembre", "十一月". */
export function townMonth(locale: SiteLocale = 'en'): string {
  return siteDate(locale, new Date(), { month: 'long' })
}

/** "A, B and C" in the page's language. */
export function townList(items: string[], locale: SiteLocale = 'en'): string {
  const t = tt(locale)
  if (items.length < 2) return items.join('')
  return t('list.and', { rest: items.slice(0, -1).join(t('list.sep')), last: items[items.length - 1] })
}

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
  locale = 'en',
}: {
  stats: TownPageStats
  townName: string
  locale?: SiteLocale
  /** Null when the town is not on its state board this month. */
  rank: { rank: number; of: number; stateName: string } | null
  /** Why the town is unranked, shown first in the footnote when `rank` is null. */
  unrankedNote?: string
}) {
  const m = stats.month
  const t = tt(locale)
  const month = townMonth(locale)
  const cells = [
    ...(rank ? [{ value: t('stat.rank_value', { rank: rank.rank, of: rank.of }), label: t('stat.rank_label', { state: rank.stateName, month }) }] : []),
    { value: townNum(m.active_trips, locale), label: t('stat.trips', { month }) },
    { value: townNum(m.active_miles, locale), label: t('stat.miles') },
    { value: townNum(m.co2_lbs, locale), label: t('stat.co2') },
    { value: townNum(m.active_users, locale), label: t('stat.users', { month }) },
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
      <DataDisclaimer townName={townName} lead={unrankedNote} locale={locale} />
    </div>
  )
}

export function DataDisclaimer({ townName, lead, locale = 'en' }: { townName: string; lead?: string; locale?: SiteLocale }) {
  const now = new Date()
  const start = siteDate(locale, new Date(now.getFullYear(), now.getMonth(), 1), { month: 'long', day: 'numeric' })
  return (
    <p className="mt-4 max-w-[720px] text-[12px] leading-relaxed text-ink-soft">
      {lead ? `${lead} ` : ''}
      {rich(tt(locale)('stat.disclaimer', { start, town: townName }), {
        b: (c) => <b className="font-semibold text-navy">{c}</b>,
      })}
    </p>
  )
}

/* ── corridor heatmap ─────────────────────────────────────── */

export function HeatmapSection({
  layers,
  townName,
  centroid,
  locale = 'en',
}: {
  layers: TownHeatmapLayer[]
  townName: string
  centroid: { lat: number; lng: number } | null
  locale?: SiteLocale
}) {
  if (layers.length === 0) return null
  const t = tt(locale)
  const all = layers.find((l) => l.mode_group === 'all') ?? layers[0]
  const topNames = (all.named_corridors ?? []).slice(0, 3).map((c) => c.name)
  const trips = townNum(all.trip_count, locale)
  return (
    <div>
      <SectionHeading title={t('hm.title', { town: townName })} />
      {/* Server-rendered summary — crawlers and screen readers get the story
          (including the top corridor names) even though the map is client-only. */}
      <p className="-mt-2 mb-6 max-w-[680px] text-[15px] leading-relaxed text-ink-soft">
        {topNames.length > 0
          ? t('hm.summary_named', { town: townName, trips, names: townList(topNames, locale) })
          : t('hm.summary', { town: townName, trips })}
      </p>
      <TownHeatmap layers={layers} centroid={centroid} locale={locale} />
    </div>
  )
}

/* ── momentum sparkline ───────────────────────────────────── */

export function MomentumSparkline({ stats, townName, locale = 'en' }: { stats: TownPageStats; townName: string; locale?: SiteLocale }) {
  const t = tt(locale)
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
        title={t('mom.title')}
        lede={t(rising ? 'mom.lede_rising' : 'mom.lede', { town: townName, count: weeks.length })}
      />
      <div className="border-y border-navy/15 py-6">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={t('mom.aria', { list: weeks.map((d) => d.active_trips).join(', ') })}>
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
                {siteDate(locale, end, { month: 'short', day: 'numeric' })}
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
  title,
  locale = 'en',
}: {
  directory: TownSummary[]
  /** Board is scoped to this state — towns only race towns in their own state. */
  state: string
  highlightGroupId?: string
  /** Defaults to "Friendly competition" in the page's language. */
  title?: string
  locale?: SiteLocale
}) {
  const qualifying = directory.filter((t) => t.rank > 0 && t.state === state)
  if (qualifying.length < 2) return null
  return (
    <TownLeaderboardBoard
      directory={directory}
      state={state}
      stateName={qualifying[0].stateName}
      highlightGroupId={highlightGroupId}
      title={title ?? tt(locale)('lb.title')}
      locale={locale}
    />
  )
}

/* ── mode split ───────────────────────────────────────────── */

export function ModeSplit({ stats, townName, locale = 'en' }: { stats: TownPageStats; townName: string; locale?: SiteLocale }) {
  return <ModeSplitChart stats={stats} townName={townName} locale={locale} />
}

/* ── explainer ────────────────────────────────────────────── */

export function WhatIsShift({ townName, locale = 'en' }: { townName: string; locale?: SiteLocale }) {
  const t = tt(locale)
  return (
    <div className="max-w-[720px] border-t border-navy/15 pt-6">
      <h2 className="font-serif text-[1.375rem] leading-tight text-navy">{t('wis.title')}</h2>
      <p className="mt-3 text-[1.0625rem] leading-[1.65] text-ink-soft">
        {rich(t('wis.body', { town: townName }), {
          nodes: {
            gsi: (
              <Link href={withLang('/', locale)} className="font-semibold text-forest underline-offset-4 hover:underline">
                Green Streets Initiative
              </Link>
            ),
          },
        })}
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
  roamsFrom,
  locale = 'en',
}: {
  events: TownEvent[]
  roams: TownRoam[]
  townName: string
  tone?: 'dark' | 'light'
  /** How a roam's start distance reads: a town page measures from the
   *  town's centroid, a school page passes "on campus" / "from campus". */
  roamsFrom?: { near: string; from: string }
  locale?: SiteLocale
}) {
  if (events.length === 0 && roams.length === 0) return null
  const both = events.length > 0 && roams.length > 0
  const t = PANEL_THEME[tone]
  const tr = tt(locale)
  const from = roamsFrom ?? { near: tr('roams.near', { town: townName }), from: tr('roams.from', { town: townName }) }
  return (
    <section className="mx-auto max-w-[960px]">
      <div className={`grid gap-5 ${both ? 'md:grid-cols-2' : ''}`}>
        {events.length > 0 && <TownEventsPanel events={events} townName={townName} tone={tone} locale={locale} />}
        {roams.length > 0 && (
          <div className={t.panel}>
            <h3 className={t.h3}>
              {tr('roams.title')}
            </h3>
            <p className={t.sub}>
              {tr('roams.sub')}
            </p>
            <div className="space-y-3">
              {roams.map((r) => (
                <RoamCard
                  key={r.id}
                  roam={r}
                  tone={tone}
                  start={r.start_distance_miles != null ? { miles: r.start_distance_miles, ...from } : undefined}
                  locale={locale}
                />
              ))}
            </div>
            <Link href="/shift/roams" className={t.all}>
              {tr('roams.all')}
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

// Category headings: site-strings/towns.ts `cat.<category>`.
const DRAWER_CATEGORY_KEY = {
  town_dept: 'cat.town_dept',
  public_meetings: 'cat.public_meetings',
  bike_ped_committee: 'cat.bike_ped_committee',
  advocacy_group: 'cat.advocacy_group',
  commuter_services: 'cat.commuter_services',
  bike_share: 'cat.bike_share',
  bike_repair: 'cat.bike_repair',
  community_group: 'cat.community_group',
  construction_info: 'cat.construction_info',
  get_updates: 'cat.get_updates',
  report_issue: 'cat.report_issue',
} as const satisfies Record<string, keyof (typeof townsStrings)['en']>
const DRAWER_CATEGORY_ORDER = [
  'bike_ped_committee',
  'advocacy_group',
  'community_group',
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
  locale = 'en',
}: {
  resources: TownResource[]
  civicEvents: TownCivicEvent[]
  townName: string
  townSlug: string
  locale?: SiteLocale
}) {
  const t = tt(locale)
  const civicUrl = (url: string | null) =>
    withUtm(url, { medium: 'town_page', campaign: townSlug, content: 'get_involved' }) ?? '#'
  if (resources.length === 0 && civicEvents.length === 0) return null

  const { candidates, civicDupIds } = buildFeaturedCandidates(civicEvents, resources, civicUrl, undefined, undefined, locale)
  const featured = candidates[0] ?? null
  // Undated asks (a coalition's petition) sort after every dated meeting, so
  // a busy town would never show one; the first open-ended item not already
  // shown gets its own row (Fenway Missing Link petition, Keith 2026-11-09).
  const isOpenEnded = (c: FeaturedItem) => !!c.civic && !c.civic.hearing_date && !c.civic.comment_deadline
  const upNext = candidates.slice(1, 3)
  const ongoing = [featured, ...upNext].some((c) => c && isOpenEnded(c))
    ? undefined
    : candidates.slice(3).find(isOpenEnded)
  if (ongoing) upNext.push(ongoing)
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
      <SectionHeading title={t('inv.title', { town: townName })} lede={t('inv.lede')} />

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
                {t('inv.happening')}
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

      {/* Also coming up — at most two rows, plus one ongoing ask. A closing window gets a
          Deadline badge and a countdown so it can't fade behind the lead. */}
      {upNext.length > 0 && (
        <ul className="mb-4 border-t border-navy/15">
          {upNext.map((c) => {
            const linked = c.href !== '#'
            const daysLeft = c.deadline ? Math.max(0, Math.ceil((c.sort - Date.now()) / 86400000)) : null
            const countdown = daysLeft === null ? null : daysLeft === 0 ? t('inv.today') : daysLeft === 1 ? t('inv.day_left') : t('inv.days_left', { count: daysLeft })
            const inner = (
              <>
                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  {c.deadline && (
                    <span className="rounded-full border border-gold bg-gold/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-navy">
                      {t('inv.deadline')}
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
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-forest">{t('inv.in_town', { town: townName })}</p>
          {resourceGroups(localResources, civicUrl, locale)}
        </div>
      )}

      {/* 4. Shared regional/statewide tail — the one list that's identical on
          every town page stays behind the drawer. */}
      {sharedResources.length > 0 && (
        <details className="group mt-6">
          <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[15px] font-semibold text-forest underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
            {t('inv.shared', { count: sharedResources.length })}{' '}
            <span aria-hidden className="transition-transform group-open:rotate-90">&rsaquo;</span>
          </summary>
          <div className="mt-4 space-y-5 border-t border-navy/15 pt-5">
            {resourceGroups(sharedResources, civicUrl, locale)}
          </div>
        </details>
      )}
    </div>
  )
}

/** Category-grouped resource list shared by the visible local block and the
 *  regional/statewide drawer. Input order is preserved within a category. */
function resourceGroups(list: TownResource[], civicUrl: (url: string | null) => string, locale: SiteLocale) {
  const t = tt(locale)
  return DRAWER_CATEGORY_ORDER.map((cat) => {
    const inCat = list.filter((r) => r.category === cat)
    if (inCat.length === 0) return null
    return (
      <div key={cat}>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
          {cat in DRAWER_CATEGORY_KEY ? t(DRAWER_CATEGORY_KEY[cat as keyof typeof DRAWER_CATEGORY_KEY]) : cat}
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
                  {r.scope === 'regional' ? t('inv.scope_regional') : r.scope === 'statewide' ? t('inv.scope_statewide') : r.scope}
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

export function RewardsPartners({ partners, townName, locale = 'en' }: { partners: TownPartner[]; townName: string; locale?: SiteLocale }) {
  if (partners.length === 0) return null
  const t = tt(locale)
  return (
    <div>
      <SectionHeading title={t('rw.title', { town: townName })} lede={t('rw.lede')} />
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
