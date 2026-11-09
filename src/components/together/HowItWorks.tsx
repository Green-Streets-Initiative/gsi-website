'use client'

import type { ReactNode } from 'react'
import { Briefcase, House } from 'lucide-react'
import ExampleMatch from '@/components/together/ExampleMatch'
import PinMap from '@/components/together/PinMap'
import { Chip, WAY_ICON } from '@/components/together/bits'
import { PHOTOS, PhotoBand } from '@/components/together/photos'
import { cx } from '@/components/organizers/ui'
import { translator, type SiteLocale, type T } from '@/lib/site-i18n'
import { TIME_KEY, WAY_KEY, togetherStrings, type TogetherKey } from '@/lib/site-strings/together'
import { WAYS } from '@/lib/together'

/**
 * "How it works" on the /together sign-in page, as three pictured steps
 * (enrich pass, Keith 2026-11-09): what you fill in, the match card you get
 * (the real card with made-up data, marked Example), and where you'd meet
 * (a real map of Somerville with two made-up homes, and the real Gilman
 * Square stop in a credited photo). Rows alternate sides on wide screens.
 */

/** Made-up homes about 1.1 miles apart (residential blocks near Magoun Square and Prospect Hill); the stop is real (MBTA place-gilmn). */
const MEET_PINS = (t: T<TogetherKey>) => [
  { lat: 42.3952, lng: -71.1068, kind: 'home' as const, label: t('how.map_you') },
  { lat: 42.3826, lng: -71.0942, kind: 'match' as const, label: t('how.map_match') },
  { lat: 42.387928, lng: -71.096766, kind: 'rail' as const, label: t('how.map_meet'), color: '#00843D' },
]

function ExamplePill({ t }: { t: T<TogetherKey> }) {
  return <span className="absolute -top-3 left-4 z-10 rounded-full bg-(--ev-ink) px-3 py-1 text-[13px] font-bold text-white">{t('how.example')}</span>
}

/** Step 1's picture: the sign-up's own fields and chips, filled in with an example trip. */
function TripSketch({ t }: { t: T<TogetherKey> }) {
  const on = new Set(['bike', 'transit'])
  return (
    <figure className="relative m-0">
      <ExamplePill t={t} />
      <div inert aria-hidden className="pointer-events-none grid select-none grid-cols-1 gap-4 rounded-2xl border border-(--ev-line) bg-white p-5 pt-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { label: t('signup.from_home'), value: 'Highland Ave, Somerville', Icon: House },
            { label: t('signup.to_work'), value: 'Kendall Square, Cambridge', Icon: Briefcase },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="grid grid-cols-1 gap-1">
              <span className="text-[14px] font-bold">{label}</span>
              <span className="flex min-h-[44px] items-center gap-2 rounded-[10px] border border-(--ev-line-strong) px-3 text-[15px]">
                <Icon className="h-4 w-4 shrink-0 text-(--ev-accent)" aria-hidden /> {value}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {WAYS.map((w) => {
            const Icon = WAY_ICON[w.id]
            return <Chip key={w.id} on={on.has(w.id)} onClick={() => {}} tabIndex={-1}><Icon className="h-4 w-4" aria-hidden /> {t(WAY_KEY[w.id])}</Chip>
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip on onClick={() => {}} tabIndex={-1}>{t('days.weekdays')}</Chip>
          <Chip on onClick={() => {}} tabIndex={-1}>{t(TIME_KEY.morning)}</Chip>
        </div>
      </div>
      <figcaption className="sr-only">{t('how.trip_aria')}</figcaption>
    </figure>
  )
}

function Row({ n, title, hint, extra, picture, flip = false }: { n: number; title: string; hint: string; extra?: string; picture: ReactNode; flip?: boolean }) {
  return (
    <li className={cx('grid grid-cols-1 gap-5 md:items-center md:gap-10', flip ? 'md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]' : 'md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]')}>
      <div className={cx('min-w-0', flip && 'md:order-2')}>
        <h3 className="font-display text-[22px] font-extrabold leading-tight">{n}. {title}</h3>
        <p className="mt-2 text-[17px] leading-snug text-(--ev-ink-85)">{hint}</p>
        {extra ? <p className="mt-2 text-[16px] leading-snug text-(--ev-ink-80)">{extra}</p> : null}
      </div>
      <div className={cx('min-w-0', flip && 'md:order-1')}>{picture}</div>
    </li>
  )
}

export default function HowItWorks({ locale = 'en' }: { locale?: SiteLocale }) {
  const t = translator(togetherStrings, locale)
  return (
    <ol className="grid grid-cols-1 gap-10 md:gap-14" aria-label={t('step.aria')}>
      <Row n={1} title={t('step.trip')} hint={t('step.trip_hint')} picture={<TripSketch t={t} />} />
      <Row n={2} title={t('step.match')} hint={t('step.match_hint')} extra={t('signin.free')} flip
        picture={<ExampleMatch side="newcomer" locale={locale} heading={false} />} />
      <Row
        n={3}
        title={t('step.yes')}
        hint={t('step.yes_hint')}
        extra={t('matches.safety')}
        picture={(
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <PinMap pins={MEET_PINS(t)} title={t('how.map_alt')} caption={t('how.meet')} boxClassName="aspect-[4/3]" width={360} height={270} quiet />
            <PhotoBand photo={PHOTOS.gilman} alt={t('how.gilman_alt')} place={t('how.gilman_place')} creditLabel={t('photo.by', { who: PHOTOS.gilman.credit })}
              className="aspect-[4/3]" sizes="(min-width: 920px) 220px, (min-width: 640px) 40vw, 100vw" />
          </div>
        )}
      />
    </ol>
  )
}
