import Link from 'next/link'
import { Calendar, TriangleAlert } from 'lucide-react'
import { ArrowLink, PILL, SectionHeading } from '@/components/org/Section'
import { EVENT_TYPE_ICONS } from '@/components/events/event-type-icons'
import NewInfraRow from '@/components/new-infra/NewInfraRow'
import { eventPath } from '@/lib/events-url'
import { getTypeMeta, parseEventDate, TYPE_FILTER_ORDER } from '@/lib/events'
import { withUtm } from '@/lib/utm'
import type { NewInfra } from '@/lib/new-infra'
import {
  buildFeaturedCandidates,
  isRecruitment,
  isVolunteerDrive,
  type FeaturedItem,
} from '@/lib/towns/civic-featured'
import type { TownCivicEvent, TownEvent, TownPageStats, TownPartner, TownResource, TownRoam } from '@/lib/towns/queries'
import type { TownTrail } from '@/lib/trails/town'
import { EVENT_TYPE_LABELS, RECURRING_DAY, ROAM_MODE_LABELS, tt, type TownKey } from '@/lib/towns/i18n'
import { INTL_TAG, dateET, monthName, num, type DraftLocale } from '@/lib/translated-pages'

/*
 * The server-rendered sections of a translated town page. Each mirrors its
 * English twin in src/components/towns/ (named on each function) with the
 * same data and markup; only the words, dates and units change. When an
 * English section changes, its twin here changes in the same edit.
 */

type T = (k: TownKey, repl?: Record<string, string | number>) => string
export const townT = (locale: DraftLocale): T => (k, repl) => tt(locale, k, repl)

const nowMs = () => Date.now()
const km = (mi: number) => Math.round(mi * 1.609)
const shortMi = (mi: number) => (mi < 10 ? Math.round(mi * 10) / 10 : Math.round(mi))

/* ── stat row (TownSections StatRow + DataDisclaimer) ── */

export function StatRowT({
  locale, stats, townName, rank, unrankedNote,
}: {
  locale: DraftLocale
  stats: TownPageStats
  townName: string
  rank: { rank: number; of: number; stateName: string } | null
  unrankedNote?: string
}) {
  const t = townT(locale)
  const m = stats.month
  const month = monthName(locale)
  const cells = [
    ...(rank ? [{ value: t('rank_value', { rank: rank.rank, of: rank.of }), label: t('rank_label', { state: rank.stateName, month }) }] : []),
    { value: num(locale, m.active_trips), label: t('trips_label', { month }) },
    { value: num(locale, m.active_miles), label: `${t('miles_label')} (${num(locale, km(m.active_miles))} km)` },
    { value: num(locale, m.co2_lbs), label: `${t('co2_label')} (${num(locale, Math.round(m.co2_lbs * 0.4536))} kg)` },
    { value: num(locale, m.active_users), label: t('users_label', { month }) },
  ]
  return (
    <div className="border-y border-navy/15 py-7">
      <dl className={`grid grid-cols-2 gap-x-8 gap-y-5 ${cells.length === 5 ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
        {cells.map((c) => (
          <div key={c.label} className="min-w-0">
            <dd className="font-serif text-[2rem] leading-none tracking-[-0.01em] text-navy md:text-[2.25rem]">{c.value}</dd>
            <dt className="mt-1 text-[14px] leading-snug text-ink-soft">{c.label}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-4 max-w-[720px] text-[13px] leading-relaxed text-ink-soft">
        {unrankedNote ? `${unrankedNote} ` : ''}
        {t('disc_a', { month })}
        <b className="font-semibold text-navy">{t('disc_bold', { town: townName })}</b>
        {t('disc_b')}
      </p>
    </div>
  )
}

/* ── heatmap lead (TownSections HeatmapSection) ── */

export function heatmapLead(locale: DraftLocale, townName: string, tripCount: number, names: string[]): string {
  const t = townT(locale)
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')}${t('and')}${names[names.length - 1]}` : names[0]
  return (
    t('moves_a', { town: townName, n: num(locale, tripCount) }) +
    (names.length > 0 ? t('moves_names', { names: list }) : '') +
    t('moves_b', { town: townName })
  )
}

/* ── momentum (TownSections MomentumSparkline) ── */

export function MomentumT({ locale, stats, townName }: { locale: DraftLocale; stats: TownPageStats; townName: string }) {
  const t = townT(locale)
  const weeks = stats.momentum ?? []
  const total = weeks.reduce((s, w) => s + w.active_trips, 0)
  if (weeks.length < 3 || total === 0) return null
  const w = 560
  const h = 130
  const pad = 10
  const max = Math.max(...weeks.map((d) => d.active_trips), 1)
  const step = (w - pad * 2) / (weeks.length - 1)
  const points = weeks.map((d, i) => ({ x: pad + i * step, y: h - pad - (d.active_trips / max) * (h - pad * 2 - 14) }))
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${path} L${points[points.length - 1].x.toFixed(1)},${h - pad} L${points[0].x.toFixed(1)},${h - pad} Z`
  const rising = weeks[weeks.length - 1].active_trips > weeks[0].active_trips
  return (
    <div>
      <SectionHeading title={t('mom_title')} lede={`${t('mom_lede', { town: townName, n: weeks.length })}${rising ? t('mom_rising') : ''}.`} />
      <div className="border-y border-navy/15 py-6">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={t('mom_aria', { list: weeks.map((d) => d.active_trips).join(', ') })}>
          <path d={area} fill="rgba(45,106,79,0.10)" />
          <path d={path} fill="none" stroke="#2D6A4F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4.5 : 3} fill={i === points.length - 1 ? '#1B4332' : '#F4F8EE'} stroke="#2D6A4F" strokeWidth="2" />
          ))}
        </svg>
        <div className="mt-2 flex justify-between text-[12px] tabular-nums text-ink-soft">
          {weeks.map((d) => {
            const end = new Date(`${d.week_start}T00:00:00`)
            end.setDate(end.getDate() + 6)
            return <span key={d.week_start}>{end.toLocaleDateString(INTL_TAG[locale], { month: 'short', day: 'numeric' })}</span>
          })}
        </div>
      </div>
    </div>
  )
}

/* ── explainer (TownSections WhatIsShift) ── */

export function WhatIsShiftT({ locale, townName }: { locale: DraftLocale; townName: string }) {
  const t = townT(locale)
  return (
    <div className="max-w-[720px] border-t border-navy/15 pt-6">
      <h2 className="font-serif text-[1.375rem] leading-tight text-navy">{t('what_title')}</h2>
      <p className="mt-3 text-[1.0625rem] leading-[1.65] text-ink-soft">
        {t('what_a')}
        <Link href="/" className="font-semibold text-forest underline-offset-4 hover:underline">Green Streets Initiative</Link>
        {t('what_b', { town: townName })}
      </p>
    </div>
  )
}

/* ── events and roams (TownSections EventsRoamsPanels + TownEventsPanel) ── */

const KNOWN_TYPES = new Set<string>(TYPE_FILTER_ORDER)
const normalizeType = (type: string | null) => (type && KNOWN_TYPES.has(type) ? type : 'other')

function EventsPanelT({ locale, events, townName }: { locale: DraftLocale; events: TownEvent[]; townName: string }) {
  const t = townT(locale)
  const order = ['open_streets', ...TYPE_FILTER_ORDER.filter((x) => x !== 'open_streets')]
  const groups = order
    .map((type) => ({ type, items: events.filter((e) => normalizeType(e.event_type) === type) }))
    .filter((g) => g.items.length > 0)
  return (
    <div className="rounded-[18px] border border-navy/10 bg-white p-6">
      <h3 className="mb-1 font-serif text-[1.375rem] leading-tight text-navy">{t('events_title', { town: townName })}</h3>
      <p className="mb-4 text-[14px] text-ink-soft">{t('events_sub')}</p>
      <div className="space-y-5">
        {groups.map(({ type, items }) => {
          const meta = getTypeMeta(type)
          const Icon = EVENT_TYPE_ICONS[meta.icon] ?? Calendar
          return (
            <div key={type}>
              <div className="mb-2 flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-[8px]" style={{ backgroundColor: `${meta.color}29` }}>
                  <Icon size={16} style={{ color: meta.color }} />
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-navy">
                  {EVENT_TYPE_LABELS[locale][type] ?? meta.label}
                  {items.length > 1 ? ` · ${items.length}` : ''}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((e) => {
                  const day = parseEventDate(e.event_date).toLocaleDateString(INTL_TAG[locale], { weekday: 'short', month: 'short', day: 'numeric' })
                  const every = e.recurring_weekday ? t('events_every', { day: RECURRING_DAY[locale][e.recurring_weekday] ?? e.recurring_weekday }) : ''
                  return (
                    <Link key={e.id} href={eventPath(e)} className="block rounded-[12px] border border-navy/10 bg-cream px-4 py-3 transition-colors hover:border-navy/30">
                      <p className="text-[15px] font-semibold leading-snug text-navy">{e.title}</p>
                      <p className="mt-0.5 text-[14px] text-ink-soft">
                        {every}
                        {day}
                        {e.location_name ? ` · ${e.location_name}` : ''}
                        {` · ${t('events_away', { d: `${num(locale, shortMi(e.distance_miles))} mi (${num(locale, shortMi(e.distance_miles * 1.609))} km)` })}`}
                      </p>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <Link href="/events" className="mt-5 inline-block text-[15px] font-semibold text-forest underline-offset-4 hover:underline">
        {t('events_all')} &rarr;
      </Link>
    </div>
  )
}

function RoamsPanelT({ locale, roams, townName }: { locale: DraftLocale; roams: TownRoam[]; townName: string }) {
  const t = townT(locale)
  return (
    <div className="rounded-[18px] border border-navy/10 bg-white p-6">
      <h3 className="mb-1 font-serif text-[1.375rem] leading-tight text-navy">{t('roams_title')}</h3>
      <p className="mb-4 text-[14px] text-ink-soft">{t('roams_sub')}</p>
      <ul className="space-y-3">
        {roams.map((r) => {
          const bits = [
            ROAM_MODE_LABELS[locale][r.mode] ?? r.mode,
            r.distance_miles != null ? `${num(locale, r.distance_miles)} mi (${num(locale, shortMi(r.distance_miles * 1.609))} km)` : null,
            r.estimated_minutes != null ? `${num(locale, r.estimated_minutes)} min` : null,
          ].filter(Boolean)
          return (
            <li key={r.id}>
              <Link href={`/shift/roams/${encodeURIComponent(r.id)}`} className="block rounded-[12px] border border-navy/10 bg-cream px-4 py-3 transition-colors hover:border-navy/30">
                <p className="text-[15px] font-semibold leading-snug text-navy">{r.name}</p>
                <p className="mt-0.5 text-[14px] text-ink-soft">{bits.join(' · ')}</p>
                {r.start_distance_miles != null && r.start_distance_miles >= 0.3 && (
                  <p className="text-[14px] text-ink-soft">
                    {t('roams_from', { d: `${num(locale, shortMi(r.start_distance_miles))} mi`, town: townName })}
                  </p>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
      <Link href="/shift/roams" className="mt-4 inline-block text-[15px] font-semibold text-forest underline-offset-4 hover:underline">
        {t('roams_all')} &rarr;
      </Link>
    </div>
  )
}

export function EventsRoamsT({ locale, events, roams, townName }: { locale: DraftLocale; events: TownEvent[]; roams: TownRoam[]; townName: string }) {
  if (events.length === 0 && roams.length === 0) return null
  const both = events.length > 0 && roams.length > 0
  return (
    <section className="mx-auto max-w-[960px]">
      <div className={`grid gap-5 ${both ? 'md:grid-cols-2' : ''}`}>
        {events.length > 0 && <EventsPanelT locale={locale} events={events} townName={townName} />}
        {roams.length > 0 && <RoamsPanelT locale={locale} roams={roams} townName={townName} />}
      </div>
    </section>
  )
}

/* ── trails (TownTrails) ── */

export function TrailsT({ locale, trails, townName }: { locale: DraftLocale; trails: TownTrail[]; townName: string }) {
  const t = townT(locale)
  return (
    <div>
      <SectionHeading
        title={t('trails_title', { town: townName })}
        lede={t('trails_lede')}
        aside={<ArrowLink href="/trails">{t('trails_all')}</ArrowLink>}
      />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {trails.map((tr) => (
          <li key={tr.id} className="min-w-0">
            <Link
              href={`/trails/${tr.id}`}
              className="group flex min-h-[96px] items-center gap-4 rounded-[16px] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)] transition-shadow hover:shadow-[0_4px_14px_rgba(25,26,46,0.08),0_0_0_1px_rgba(25,26,46,0.08)]"
            >
              <span className="flex h-[72px] w-[96px] shrink-0 items-center justify-center rounded-[10px] bg-cream">
                {tr.path ? (
                  <svg viewBox="0 0 120 72" className="h-[64px] w-[88px]" aria-hidden>
                    <path d={tr.path} fill="none" stroke="#2D6A4F" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-semibold leading-snug text-navy group-hover:underline group-hover:underline-offset-4">{tr.name}</span>
                {tr.fromTo && <span className="mt-0.5 line-clamp-2 block text-[0.875rem] leading-snug text-ink-soft">{tr.fromTo}</span>}
                <span className="mt-1.5 flex flex-wrap items-center gap-2">
                  {tr.miles ? (
                    <span className="rounded-full bg-cream px-2.5 py-0.5 text-[0.8125rem] font-semibold tabular-nums text-navy">
                      {num(locale, shortMi(tr.miles))} mi ({num(locale, shortMi(tr.miles * 1.609))} km)
                    </span>
                  ) : null}
                  {tr.closed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF6F0] px-2.5 py-0.5 text-[0.8125rem] font-semibold text-[#9A3412]">
                      <TriangleAlert size={12} aria-hidden /> {t('part_closed')}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── new bike lanes and paths (NewInTown); the rows are the shared English ones ── */

export function NewInTownT({ locale, info, townName, hasInvolved }: { locale: DraftLocale; info: NewInfra; townName: string; hasInvolved: boolean }) {
  const t = townT(locale)
  const shown = info.opened.slice(0, 6)
  return (
    <div className="max-w-[720px]">
      <SectionHeading title={t('new_title', { town: townName })} lede={t('new_lede')} />
      <ul lang="en" className="divide-y divide-navy/10 border-y border-navy/15">
        {shown.map((o) => (
          <li key={`${o.name}|${o.facility}`} className="py-3">
            <NewInfraRow o={o} onRoute={false} showTown={false} tone="town" />
          </li>
        ))}
      </ul>
      {info.opened.length > shown.length && <p className="mt-3 text-[14px] text-ink-soft">{t('new_more', { n: info.opened.length - shown.length })}</p>}
      {info.coming.length > 0 && hasInvolved && (
        <p className="mt-4 text-[15px]">
          <a href="#involved" className="font-semibold text-green-deep underline-offset-4 hover:underline">{t('new_coming')}</a>
        </p>
      )}
    </div>
  )
}

/* ── rewards partners (TownSections RewardsPartners) ── */

export function RewardsPartnersT({ locale, partners, townName }: { locale: DraftLocale; partners: TownPartner[]; townName: string }) {
  const t = townT(locale)
  if (partners.length === 0) return null
  return (
    <div>
      <SectionHeading title={t('rewards_title', { town: townName })} lede={t('rewards_lede')} />
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
              {p.discount_description && <p lang="en" className="mt-1 text-[14px] leading-snug text-green-deep">{p.discount_description}</p>}
              {p.address && <p className="mt-1 text-[13px] leading-snug text-ink-soft">{p.address}</p>}
            </div>
          )
          return p.website_url ? (
            <a key={p.id} href={p.website_url} target="_blank" rel="noopener noreferrer" className="block h-full">{card}</a>
          ) : (
            <div key={p.id} className="h-full">{card}</div>
          )
        })}
      </div>
    </div>
  )
}

/* ── get involved (TownSections GetInvolved) ── */

const CATEGORY_ORDER = [
  'bike_ped_committee', 'advocacy_group', 'community_group', 'commuter_services', 'bike_share',
  'bike_repair', 'construction_info', 'get_updates', 'public_meetings', 'town_dept', 'report_issue',
]

/** The featured row's date chip and button, in the page's language (civic-featured.ts builds them in English). */
function localizeFeatured(locale: DraftLocale, f: FeaturedItem): { chip: string; label: string } {
  const t = townT(locale)
  const dateOnly = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(INTL_TAG[locale], { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
  const time = (hhmm: string | null) => {
    const m = hhmm?.match(/^(\d{2}):(\d{2})/)
    return m ? `${Number(m[1])}:${m[2]}` : null
  }
  const label = (raw: string) =>
    ({ 'See details': t('label_see_details'), Register: t('label_register'), 'Email to comment': t('label_email_comment'), 'Email to volunteer': t('label_email_volunteer') } as Record<string, string>)[raw] ??
    `${raw} ${locale === 'es' ? '(en inglés)' : '(em inglês)'}`
  const ce = f.civic
  if (ce) {
    const tm = time(ce.hearing_time)
    const chip = ce.hearing_date
      ? dateOnly(ce.hearing_date) + (tm ? ` · ${tm}` : '') + (ce.hearing_type === 'virtual' ? ` · ${t('virtual')}` : '')
      : ce.comment_deadline
        ? isVolunteerDrive(ce) ? t('sign_up_by', { date: dateOnly(ce.comment_deadline) }) : t('comment_by', { date: dateOnly(ce.comment_deadline) })
        : isRecruitment(ce) ? t('applications_open') : t('open_for_feedback')
    return { chip, label: label(f.label) }
  }
  const r = f.resource
  const chip = r?.happens_at
    ? `${dateET(locale, r.happens_at, { weekday: 'short', month: 'short', day: 'numeric' })} · ${new Date(r.happens_at).toLocaleTimeString(INTL_TAG[locale], { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}`
    : f.chip
  return { chip, label: label(f.label) }
}

export function GetInvolvedT({
  locale, resources, civicEvents, townName, townSlug,
}: {
  locale: DraftLocale
  resources: TownResource[]
  civicEvents: TownCivicEvent[]
  townName: string
  townSlug: string
}) {
  const t = townT(locale)
  const civicUrl = (url: string | null) => withUtm(url, { medium: 'town_page', campaign: townSlug, content: 'get_involved' }) ?? '#'
  if (resources.length === 0 && civicEvents.length === 0) return null

  const { candidates, civicDupIds } = buildFeaturedCandidates(civicEvents, resources, civicUrl)
  const featured = candidates[0] ?? null
  const upNext = candidates.slice(1, 3)
  const shownResourceIds = new Set(
    [featured, ...upNext].filter((c): c is FeaturedItem => Boolean(c && c.key.startsWith('res-'))).map((c) => c.key.slice(4)),
  )
  const actions = resources.filter((r) => r.action_label && !r.happens_at)
  const drawer = resources.filter((r) => !actions.includes(r) && !shownResourceIds.has(r.id) && !civicDupIds.has(r.id))
  const localResources = drawer.filter((r) => r.scope === 'local')
  const sharedResources = [...drawer.filter((r) => r.scope === 'regional'), ...drawer.filter((r) => r.scope === 'statewide')]
  const ext = (href: string) => (href.startsWith('mailto:') ? {} : { target: '_blank', rel: 'noopener noreferrer' })

  const groups = (list: TownResource[]) =>
    CATEGORY_ORDER.map((cat) => {
      const inCat = list.filter((r) => r.category === cat)
      if (inCat.length === 0) return null
      return (
        <div key={cat}>
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{t(`cat_${cat}` as TownKey)}</p>
          <ul lang="en" className="space-y-2">
            {inCat.map((r) => (
              <li key={r.id} className="text-[15px] leading-snug text-ink-soft">
                {r.url ? (
                  <a href={civicUrl(r.url)} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy underline decoration-navy/30 underline-offset-2 hover:text-forest hover:decoration-forest">{r.name}</a>
                ) : (
                  <span className="font-semibold text-navy">{r.name}</span>
                )}
                {r.scope !== 'local' && (
                  <span lang={locale} className="ml-1.5 rounded-full bg-navy/[0.06] px-1.5 py-0.5 text-[12px] font-semibold text-ink-soft">
                    {r.scope === 'regional' ? t('scope_regional') : t('scope_statewide')}
                  </span>
                )}
                {r.description && <span> &mdash; {r.description}</span>}
                {(r.contact_email || r.contact_phone) && <span> ({[r.contact_email, r.contact_phone].filter(Boolean).join(' · ')})</span>}
              </li>
            ))}
          </ul>
        </div>
      )
    })

  return (
    <div className="max-w-[720px]">
      <SectionHeading title={t('involved_title', { town: townName })} lede={t('involved_lede')} />
      <p className="-mt-2 mb-5 text-[14px] text-ink-soft">{t('involved_english')}</p>

      {featured && (() => {
        const { chip, label } = localizeFeatured(locale, featured)
        const linked = featured.href !== '#'
        const Card = linked ? 'a' : 'div'
        return (
          <Card
            {...(linked ? { href: featured.href, ...ext(featured.href) } : {})}
            className={`mb-4 block rounded-[16px] border border-gold/60 bg-white p-5 ${linked ? 'transition-colors hover:border-gold' : ''}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gold px-2.5 py-0.5 text-[12px] font-bold uppercase tracking-wider text-navy">{t('happening_now')}</span>
              <span className="text-[14px] font-semibold text-green-deep">{chip}</span>
            </div>
            <p lang="en" className="font-serif text-[1.375rem] leading-tight text-navy">{featured.title}</p>
            {featured.desc && <p lang="en" className="mt-2 text-[15px] leading-relaxed text-ink-soft">{featured.desc}</p>}
            {linked && <span className={`mt-4 ${PILL} min-h-[44px] px-5 text-[14px]`}>{label} &rarr;</span>}
          </Card>
        )
      })()}

      {upNext.length > 0 && (
        <ul className="mb-4 border-t border-navy/15">
          {upNext.map((c) => {
            const { chip } = localizeFeatured(locale, c)
            const linked = c.href !== '#'
            const daysLeft = c.deadline ? Math.max(0, Math.ceil((c.sort - nowMs()) / 86400000)) : null
            const countdown = daysLeft === null ? null : daysLeft === 0 ? t('today') : daysLeft === 1 ? t('one_day_left') : t('days_left', { n: daysLeft })
            const inner = (
              <>
                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  {c.deadline && (
                    <span className="rounded-full border border-gold bg-gold/15 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider text-navy">{t('deadline')}</span>
                  )}
                  <span className="text-[14px] font-semibold text-green-deep">
                    {chip}
                    {countdown && <span className="text-navy"> · {countdown}</span>}
                  </span>
                </span>
                <span lang="en" className="min-w-0 overflow-hidden text-[15px] font-semibold leading-snug text-navy [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]">{c.title}</span>
              </>
            )
            const rowClass = 'flex min-h-[44px] flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-3'
            return (
              <li key={c.key} className="border-b border-navy/15">
                {linked ? <a href={c.href} {...ext(c.href)} className={`${rowClass} hover:text-forest`}>{inner}</a> : <div className={rowClass}>{inner}</div>}
              </li>
            )
          })}
        </ul>
      )}

      {actions.length > 0 && (
        <ul lang="en" className="border-t border-navy/15">
          {actions.map((r) => (
            <li key={r.id} className="border-b border-navy/15">
              <a href={civicUrl(r.url)} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-3 py-3.5">
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-navy group-hover:underline group-hover:underline-offset-4">{r.action_label}</span>
                  <span className="block text-[14px] text-ink-soft">{r.name}</span>
                </span>
                <span className="shrink-0 text-forest transition-transform group-hover:translate-x-0.5">&rarr;</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {localResources.length > 0 && (
        <div className="mt-6 space-y-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-forest">{t('in_town', { town: townName })}</p>
          {groups(localResources)}
        </div>
      )}

      {sharedResources.length > 0 && (
        <details className="group mt-6">
          <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[15px] font-semibold text-forest underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
            {t('shared_more', { n: sharedResources.length })} <span aria-hidden className="transition-transform group-open:rotate-90">&rsaquo;</span>
          </summary>
          <div className="mt-4 space-y-5 border-t border-navy/15 pt-5">{groups(sharedResources)}</div>
        </details>
      )}
    </div>
  )
}
