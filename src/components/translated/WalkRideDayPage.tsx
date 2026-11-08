import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import HtmlLang from '@/components/HtmlLang'
import Footer from '@/components/Footer'
import PageHero from '@/components/org/PageHero'
import StoreButtons from '@/components/StoreButtons'
import { LANE, RouteSegment } from '@/components/home/RouteLine'
import { ArrowLink, PILL, Section, SectionHeading } from '@/components/org/Section'
import { ANDROID_URL, IOS_URL, IS_LIVE } from '@/app/shift-your-semester/_lib/load'
import { loadWalkRideDays, type WalkRideDayData } from '@/app/programs/walk-ride-days/_lib/load'
import { wt, type WalkRideDayKey } from '@/lib/walk-ride-day/i18n'
import { withLang } from '@/lib/site-i18n'
import { HTML_LANG, dollars, num, shortDate, translatedPath, weekdayDate, type DraftLocale } from '@/lib/translated-pages'
import { AiNote, ReadInEnglish } from './TranslationNotes'

/*
 * The Walk/Ride Day page (/programs/walk-ride-days) in Spanish or Portuguese.
 * Same layout and the same live data as the English page as it is live today
 * (the cream system); only the words change. Strings: src/lib/walk-ride-day/i18n.ts.
 */

export function walkRideDayMetadata(locale: DraftLocale): Metadata {
  return { title: wt(locale, 'meta_title'), description: wt(locale, 'meta_desc') }
}

function Ledger({ d, locale }: { d: WalkRideDayData; locale: DraftLocale }) {
  const t = (k: WalkRideDayKey) => wt(locale, k)
  const rows: { value: string; label: string }[] = [
    d.next
      ? { value: shortDate(locale, d.next.startsAt), label: d.next.active ? t('l_today') : t('l_next') }
      : { value: t('l_last_friday'), label: t('l_of_every_month') },
    d.prizes
      ? {
          value: d.prizes.each ? `${num(locale, d.prizes.count)} × ${dollars(locale, d.prizes.each)}` : dollars(locale, d.prizes.total),
          label: d.prizes.each ? t('l_cards_each') : t('l_cards_total'),
        }
      : { value: t('l_gift_cards'), label: t('l_drawn') },
    { value: '2006', label: t('l_first') },
    { value: t('l_free'), label: t('l_nothing') },
  ]
  return (
    <section className="relative overflow-x-clip bg-cream">
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="straight" />
        <div className="hidden md:block" />
        <div className="border-y border-navy/15 py-7">
          <dl className="grid grid-cols-2 gap-x-10 gap-y-5 md:grid-cols-4">
            {rows.map((r) => (
              <div key={r.label} className="min-w-0">
                <dd className="break-words font-serif text-[2rem] leading-none tracking-[-0.01em] text-navy md:text-[2.5rem]">{r.value}</dd>
                <dt className="mt-1 text-[14px] leading-snug text-ink-soft">{r.label}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[14px] leading-relaxed text-ink-soft">
            {t('ledger_note')}{' '}
            <Link href={translatedPath(locale, 'walk-ride-day-rules')} className="font-semibold text-forest underline-offset-4 hover:underline">
              {t('rules_link')}
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}

export default async function TranslatedWalkRideDayPage({ locale }: { locale: DraftLocale }) {
  const t = (k: WalkRideDayKey, repl?: Record<string, string>) => wt(locale, k, repl)
  const d = await loadWalkRideDays()
  const nextLabel = d.next ? weekdayDate(locale, d.next.startsAt) : null

  const steps = [
    { title: t('s1_title'), body: t('s1_body') },
    { title: t('s2_title'), body: t('s2_body') },
    { title: t('s3_title'), body: t('s3_body') },
  ]
  const bring = [
    { title: t('b1_title'), body: t('b1_body'), href: '/shift/employers', label: t('b1_link') },
    { title: t('b2_title'), body: t('b2_body'), href: '/shift/schools', label: t('b2_link') },
    { title: t('b3_title'), body: t('b3_body'), href: withLang('/shift/towns', locale), label: t('b3_link') },
  ]

  return (
    <>
      <Nav variant="light" locale={locale} />
      <HtmlLang locale={locale} />
      <main lang={HTML_LANG[locale]} className="bg-cream">
        <PageHero
          eyebrow={t('eyebrow')}
          title={
            <>
              {t('title_a')}
              <em className="text-green-deep">{t('title_b')}</em>
            </>
          }
          lede={<>{t('lede')}</>}
        >
          {nextLabel && (
            <p className="mt-6 text-[1.0625rem] text-navy">
              <span className="font-semibold">{d.next?.active ? t('today_is') : t('next_is', { date: nextLabel })}</span>
              {d.moved && <span className="text-ink-soft"> {t('moved')}</span>}
            </p>
          )}
          {IS_LIVE && <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} tone="light" className="mt-6 [&>a]:max-[420px]:basis-full" />}
          <div className="mt-6 flex flex-col gap-1">
            <AiNote locale={locale} />
            <p>
              <ReadInEnglish page="walk-ride-day" />
            </p>
          </div>
        </PageHero>

        <Ledger d={d} locale={locale} />

        <Section shape="wanderRight" id="how" className="scroll-mt-28">
          <SectionHeading title={t('how_title')} lede={t('how_lede')} />
          <ol className="grid gap-8 md:grid-cols-3 md:gap-10">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-forest/50 font-serif text-[1.1rem] text-forest">{i + 1}</span>
                <div className="min-w-0">
                  <h3 className="font-serif text-[1.375rem] leading-tight text-navy">{s.title}</h3>
                  <p className="mt-2 text-[1.0625rem] leading-[1.65] text-ink-soft">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-[640px] text-[15px] leading-relaxed text-ink-soft">{t('how_note')}</p>
        </Section>

        <Section shape="wanderLeft" tone="white" width="read" id="dates" className="scroll-mt-28">
          <SectionHeading title={t('dates_title')} lede={t('dates_lede')} />
          <ul className="border-t border-navy/15">
            {[d.next, ...d.later].filter((x): x is NonNullable<typeof x> => !!x).map((day, i) => (
              <li key={day.startsAt} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-navy/15 py-4">
                <span className={`text-[1.0625rem] ${i === 0 ? 'font-semibold text-navy' : 'text-navy'}`}>{weekdayDate(locale, day.startsAt)}</span>
                <span className="text-[14px] text-ink-soft">{i === 0 ? (day.active ? t('row_today') : t('row_next')) : t('row_later')}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2">
            <ArrowLink href="/challenges">{t('link_challenges')}</ArrowLink>
            <ArrowLink href="/events">{t('link_events')}</ArrowLink>
          </div>
        </Section>

        <Section shape="wanderRight" id="bring" className="scroll-mt-28">
          <SectionHeading title={t('bring_title')} lede={t('bring_lede')} />
          <div className="grid gap-8 md:grid-cols-3 md:gap-10">
            {bring.map((b) => (
              <div key={b.title} className="min-w-0">
                <h3 className="font-serif text-[1.375rem] leading-tight text-navy">{b.title}</h3>
                <p className="mt-2 text-[1.0625rem] leading-[1.65] text-ink-soft">{b.body}</p>
                <ArrowLink href={b.href}>{b.label}</ArrowLink>
              </div>
            ))}
          </div>
        </Section>

        <Section shape="terminal" tone="white" width="read" closing id="join">
          <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.1] text-navy">
            {nextLabel ? t('see_you', { date: nextLabel }) : t('see_you_last')}
          </h2>
          <p className="mt-4 max-w-[560px] text-[1.0625rem] leading-[1.65] text-ink-soft">{t('join_body')}</p>
          {IS_LIVE ? (
            <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} tone="light" className="mt-8 [&>a]:max-[420px]:basis-full" />
          ) : (
            <Link href="/shift" className={`${PILL} mt-8`}>{t('get_app')} &rarr;</Link>
          )}
          <p className="mt-6 text-[15px] text-ink-soft">
            {t('contact_q')}{' '}
            <a href="mailto:info@gogreenstreets.org" className="font-semibold text-forest underline-offset-4 hover:underline">
              info@gogreenstreets.org
            </a>
            .
          </p>
        </Section>
      </main>
      <Footer variant="light" />
    </>
  )
}
