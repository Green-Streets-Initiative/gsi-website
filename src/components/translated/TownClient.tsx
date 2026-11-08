'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Bicycle, Bus, Car, PersonSimpleWalk, Train, UsersThree } from '@phosphor-icons/react'
import { SectionHeading } from '@/components/org/Section'
import type { TownPageStats, TownSummary } from '@/lib/towns/queries'
import { tt, type TownKey } from '@/lib/towns/i18n'
import { INTL_TAG, TRANSLATED_TOWNS, translatedPath, type DraftLocale } from '@/lib/translated-pages'

/*
 * The interactive parts of a translated town page, each the twin of an
 * English component in src/components/towns/ (named on each function):
 * the digest sign-up, the section chips, the leaderboard and the mode chart.
 * Same behavior and markup; only the words, dates and units change.
 */

const tr = (locale: DraftLocale) => (k: TownKey, repl?: Record<string, string | number>) => tt(locale, k, repl)
const month = (locale: DraftLocale) => new Date().toLocaleDateString(INTL_TAG[locale], { month: 'long' })
const numF = (locale: DraftLocale, n: number) => n.toLocaleString(INTL_TAG[locale])

/* ── TownDigestSignup (inline variant) ── */

export function DigestSignupT({ locale, townName, townSlug }: { locale: DraftLocale; townName: string; townSlug: string }) {
  const t = tr(locale)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (state === 'busy' || state === 'done') return
    setState('busy')
    try {
      const res = await fetch('/api/towns/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, town: townSlug }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }
  return (
    <div className="max-w-[600px]">
      <p className="text-[15px] leading-relaxed text-ink-soft">
        <span className="font-semibold text-navy">{t('digest_lead', { town: townName })}</span> {t('digest_body', { town: townName })}
      </p>
      {state === 'done' ? (
        <p className="mt-4 text-[15px] font-semibold text-green-deep">{t('digest_done', { town: townName })}</p>
      ) : (
        <form onSubmit={submit} className="mt-3 flex max-w-[440px] flex-wrap gap-2" data-ph-capture-attribute-entry="town_digest_signup">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('digest_placeholder')}
            className="min-w-[180px] flex-1 rounded-full border border-navy/20 bg-white px-4 py-2.5 text-[15px] text-navy outline-none placeholder:text-ink-soft focus:border-forest"
          />
          <button
            type="submit"
            disabled={state === 'busy'}
            className="shrink-0 rounded-full bg-navy px-5 py-2.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {state === 'busy' ? t('digest_busy') : t('digest_button')}
          </button>
        </form>
      )}
      {state === 'error' && <p className="mt-2 text-[14px] text-red-700">{t('digest_error')}</p>}
    </div>
  )
}

/* ── TownToc (light tone) ── */

export function TocT({ locale, sections }: { locale: DraftLocale; sections: Array<[href: string, label: string]> }) {
  const t = tr(locale)
  const [activeId, setActiveId] = useState<string | null>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-15% 0px -65% 0px' },
    )
    for (const [href] of sections) {
      const el = document.getElementById(href.slice(1))
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [sections])
  return (
    <nav aria-label={t('toc_aria')} className="sticky top-[60px] z-20 border-b border-navy/10 bg-cream/95 backdrop-blur">
      <div className="relative mx-auto max-w-[960px]">
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="hidden shrink-0 pr-1 text-[12px] font-bold uppercase tracking-widest text-forest sm:inline">{t('toc_label')}</span>
          {sections.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className={
                activeId === href.slice(1)
                  ? 'rounded-full bg-navy px-3.5 py-2 text-sm font-bold text-white'
                  : 'rounded-full bg-navy/[0.06] px-3.5 py-2 text-sm font-semibold text-navy transition-colors hover:bg-navy/[0.12]'
              }
            >
              {label}
            </a>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-cream to-transparent" />
      </div>
    </nav>
  )
}

/* ── TownLeaderboardBoard ── */

type Metric = 'shift_rate' | 'active_trips'

/** A town in the board links to its translated draft when there is one. */
function townHref(locale: DraftLocale, slug: string) {
  return (TRANSLATED_TOWNS as readonly string[]).includes(slug) ? translatedPath(locale, `town:${slug}`) : `/shift/towns/${slug}`
}

export function LeaderboardT({
  locale, directory, state, highlightGroupId,
}: {
  locale: DraftLocale
  directory: TownSummary[]
  state: string
  highlightGroupId?: string
}) {
  const t = tr(locale)
  const [metric, setMetric] = useState<Metric>('shift_rate')
  const m = month(locale)
  const qualifying = directory.filter((x) => x.rank > 0 && x.state === state)
  if (qualifying.length < 2) return null
  const stateName = qualifying[0].stateName
  const value = (x: TownSummary) => (metric === 'shift_rate' ? x.shift_rate : x.active_trips_month)
  const sorted =
    metric === 'shift_rate'
      ? [...qualifying].sort((a, b) => a.rank - b.rank)
      : [...qualifying].sort((a, b) => b.active_trips_month - a.active_trips_month)
  const maxVal = Math.max(...sorted.map(value), 1)
  const highlighted = highlightGroupId ? sorted.find((x) => x.group_id === highlightGroupId) : undefined
  const pos = highlighted ? sorted.indexOf(highlighted) + 1 : 0
  const gap = highlighted && pos > 1 ? value(sorted[0]) - value(highlighted) : 0
  const behind = !highlighted || gap <= 0
    ? null
    : metric === 'shift_rate'
      ? gap === 1 ? t('lb_behind_point', { town: highlighted.town_name }) : t('lb_behind_points', { town: highlighted.town_name, n: numF(locale, gap) })
      : t('lb_behind_trips', { town: highlighted.town_name, n: numF(locale, gap) })

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.1] text-navy">{t('lb_title')}</h2>
          <p className="mt-2 max-w-[600px] text-[15px] leading-relaxed text-ink-soft">
            {metric === 'shift_rate' ? t('lb_rate_lede', { state: stateName, month: m }) : t('lb_trips_lede', { state: stateName, month: m })}{' '}
            {t('lb_dir')}
            {behind && <> <span className="font-semibold text-forest">{behind}</span></>}
          </p>
        </div>
        <div className="inline-flex rounded-full border border-navy/20 p-0.5" aria-label={t('lb_aria')}>
          {([['shift_rate', t('lb_rate')], ['active_trips', t('lb_trips')]] as [Metric, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setMetric(k)}
              aria-pressed={metric === k}
              className={`rounded-full px-3 py-1 text-[14px] font-semibold transition-colors ${metric === k ? 'bg-navy text-white' : 'text-navy hover:bg-navy/[0.05]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <ol className="border-t border-navy/15">
        {sorted.map((x, i) => {
          const isMe = x.group_id === highlightGroupId
          const pct = Math.max(4, Math.round((value(x) / maxVal) * 100))
          return (
            <li key={x.group_id}>
              <Link
                href={townHref(locale, x.slug)}
                className={`group grid grid-cols-[1.75rem_minmax(0,1fr)_3.75rem_1rem] items-center gap-3 border-b border-navy/15 px-2 py-3 transition-colors hover:bg-navy/[0.03] md:grid-cols-[2.5rem_13rem_1fr_5.5rem_1rem] ${isMe ? 'bg-forest/[0.07]' : ''}`}
              >
                <span className={`text-right font-serif text-[1.125rem] ${i < 3 ? 'text-forest' : 'text-ink-soft'}`}>{i + 1}</span>
                <span className="truncate">
                  <span className={`font-medium group-hover:underline group-hover:underline-offset-4 ${isMe ? 'text-green-deep' : 'text-navy'}`}>{x.town_name}</span>
                  <span className="ml-2 hidden text-[13px] text-ink-soft md:inline">{t('lb_active', { n: numF(locale, x.active_users_month), month: m })}</span>
                </span>
                <span className="hidden h-2 overflow-hidden rounded-full bg-navy/[0.08] md:block">
                  <span className={`block h-full rounded-full ${isMe ? 'bg-forest' : 'bg-navy/25'}`} style={{ width: `${pct}%` }} />
                </span>
                <span className="text-right text-[15px] font-semibold tabular-nums text-navy">
                  {metric === 'shift_rate' ? `${x.shift_rate}%` : numF(locale, x.active_trips_month)}
                </span>
                <ArrowRight size={16} className="text-forest transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ── ModeSplitChart ── */

const MODE_META: Record<string, { key: TownKey; color: string; ink: string; Icon: typeof Bicycle }> = {
  walk: { key: 'm_walk', color: '#2D6A4F', ink: '#FFFFFF', Icon: PersonSimpleWalk },
  bike: { key: 'm_bike', color: '#52B788', ink: '#191A2E', Icon: Bicycle },
  bus: { key: 'm_bus', color: '#EDB93C', ink: '#191A2E', Icon: Bus },
  train: { key: 'm_train', color: '#191A2E', ink: '#FFFFFF', Icon: Train },
  carpool: { key: 'm_carpool', color: '#2966E5', ink: '#FFFFFF', Icon: UsersThree },
  drive: { key: 'm_drive', color: '#B4B7C9', ink: '#191A2E', Icon: Car },
}

export function ModeSplitT({ locale, stats, townName }: { locale: DraftLocale; stats: TownPageStats; townName: string }) {
  const t = tr(locale)
  const rows = (stats.mode_split ?? []).filter((r) => r.trips > 0 || r.miles > 0)
  const totalTrips = rows.reduce((s, r) => s + r.trips, 0)
  if (totalTrips === 0) return null
  const bar = (label: string, field: 'trips' | 'miles') => {
    const total = rows.reduce((s, r) => s + r[field], 0)
    if (total === 0) return null
    return (
      <div>
        <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-forest">{label}</p>
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
                title={`${meta ? t(meta.key) : r.mode_group}: ${pct}%`}
              >
                {share >= 0.08 && meta && <span className="text-[13px] font-semibold tabular-nums" style={{ color: meta.ink }}>{pct}%</span>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  return (
    <div>
      <SectionHeading title={t('modes_title', { town: townName })} lede={t('modes_lede', { month: month(locale) })} />
      <div className="space-y-6">
        {bar(t('share_trips'), 'trips')}
        {bar(t('share_miles'), 'miles')}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-navy/15 pt-5 md:grid-cols-3">
          {rows.map((r) => {
            const meta = MODE_META[r.mode_group]
            if (!meta) return null
            return (
              <div key={r.mode_group} className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]" style={{ backgroundColor: meta.color }}>
                  <meta.Icon size={16} weight="bold" color={meta.ink} aria-hidden />
                </span>
                <span className="min-w-0">
                  <dt className="text-[14px] font-semibold text-navy">{t(meta.key)}</dt>
                  <dd className="text-[14px] tabular-nums text-ink-soft">
                    <span className="whitespace-nowrap">{t(r.trips === 1 ? 'n_trip' : 'n_trips', { n: numF(locale, r.trips) })}</span> ·{' '}
                    <span className="whitespace-nowrap">{numF(locale, r.miles)} mi ({numF(locale, Math.round(r.miles * 1.609))} km)</span>
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
