'use client'

import { Bicycle, Bus, Car, PersonSimpleWalk, Train, UsersThree } from '@phosphor-icons/react'
import { SectionHeading } from '@/components/org/Section'
import type { TownPageStats } from '@/lib/towns/queries'
import { siteDate, translator, SITE_LOCALE_TAG, type SiteLocale, type T } from '@/lib/site-i18n'
import { townsStrings } from '@/lib/site-strings/towns'

type TK = keyof (typeof townsStrings)['en']

/**
 * "How {Town} moves" — two 100%-stacked bars (share of trips / share of
 * miles) with Phosphor mode icons, per Keith's July 9 direction: the
 * trips-vs-distance contrast should read directly from the chart, no legend
 * decoding. Percent labels render inside segments wide enough to hold them.
 *
 * Palette on cream: forest, teal, navy, gold, blue, slate. Percent labels are
 * white on the dark fills and navy on teal, gold and slate; those three are
 * only ever fills.
 *
 * Carpool and driving sit after the active modes (Keith 2026-10-29) so people
 * who drive see themselves in the picture; the page's headline stats and
 * Shift Rate stay active-only.
 *
 * Labels come from site-strings/towns.ts (`ms.<mode>`) in the page's `locale`.
 */

const MODE_META: Record<string, { label: TK; color: string; ink: string; Icon: typeof Bicycle }> = {
  walk: { label: 'ms.walk', color: '#2D6A4F', ink: '#FFFFFF', Icon: PersonSimpleWalk },
  bike: { label: 'ms.bike', color: '#52B788', ink: '#191A2E', Icon: Bicycle },
  bus: { label: 'ms.bus', color: '#EDB93C', ink: '#191A2E', Icon: Bus },
  train: { label: 'ms.train', color: '#191A2E', ink: '#FFFFFF', Icon: Train },
  carpool: { label: 'ms.carpool', color: '#2966E5', ink: '#FFFFFF', Icon: UsersThree },
  drive: { label: 'ms.drive', color: '#B4B7C9', ink: '#191A2E', Icon: Car },
}

function StackedBar({
  label,
  rows,
  field,
  t,
}: {
  label: string
  rows: TownPageStats['mode_split']
  field: 'trips' | 'miles'
  t: T<TK>
}) {
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
              title={t(field === 'trips' ? 'ms.seg_trips' : 'ms.seg_miles', { mode: meta ? t(meta.label) : r.mode_group, pct })}
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

export default function ModeSplitChart({ stats, townName, locale = 'en' }: { stats: TownPageStats; townName: string; locale?: SiteLocale }) {
  const t = translator(townsStrings, locale)
  const num = (n: number) => (locale === 'en' ? n.toLocaleString() : n.toLocaleString(SITE_LOCALE_TAG[locale]))
  const rows = (stats.mode_split ?? []).filter((r) => r.trips > 0 || r.miles > 0)
  const totalTrips = rows.reduce((s, r) => s + r.trips, 0)
  if (totalTrips === 0) return null

  return (
    <div>
      <SectionHeading
        title={t('ms.title', { town: townName })}
        lede={t('ms.lede', { month: siteDate(locale, new Date(), { month: 'long' }) })}
      />
      <div className="space-y-6">
        <StackedBar label={t('ms.share_trips')} rows={rows} field="trips" t={t} />
        <StackedBar label={t('ms.share_miles')} rows={rows} field="miles" t={t} />

        {/* Per-mode key with raw numbers — doubles as the color key */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-navy/15 pt-5 md:grid-cols-3">
          {rows.map((r) => {
            const meta = MODE_META[r.mode_group]
            if (!meta) return null
            return (
              <div key={r.mode_group} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]" style={{ backgroundColor: meta.color }}>
                  <meta.Icon size={16} weight="bold" color={meta.ink} aria-hidden />
                </span>
                <span className="min-w-0">
                  <dt className="text-[14px] font-semibold text-navy">{t(meta.label)}</dt>
                  <dd className="text-[14px] tabular-nums text-ink-soft">
                    <span className="whitespace-nowrap">{t('ms.trips', { count: num(r.trips) })}</span> ·{' '}
                    <span className="whitespace-nowrap">{t('unit.mi', { n: num(r.miles) })}</span>
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
