import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import PageHero from '@/components/org/PageHero'
import ChallengeRow from '@/components/challenges/ChallengeRow'
import ChallengesEmpty from '@/components/challenges/ChallengesEmpty'
import ArchiveSection from '@/components/challenges/ArchiveSection'
import TrackedLink from '@/components/TrackedLink'
import { LANE, RouteSegment } from '@/components/home/RouteLine'
import { getPromotables } from '@/lib/campaigns'
import { bucket, collapseSeries } from '@/lib/campaigns/rank'
import type { Promotable, PromotablePhase } from '@/lib/campaigns/types'
import HtmlLang from '@/components/HtmlLang'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { siteLocale } from '@/lib/site-locale'
import { hubStrings, rich } from '@/lib/site-strings/challenges'

/*
 * The programme hub: everything running now or coming up, plus the archive
 * of past campaigns with a written report. Linked from the nav and footer,
 * in the sitemap, and the target of the old /shift/leaderboard redirect.
 *
 * In English, Spanish, Portuguese and Chinese (?lang=, else the browser's
 * language). The list itself stays cached (getPromotables); only the page
 * renders per request.
 */
export const revalidate = 600

type Search = Promise<{ lang?: string | string[] }>

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const t = translator(hubStrings, await siteLocale((await searchParams).lang))
  return { title: t('meta.title'), description: t('meta.description') }
}

function Section({
  title,
  shape,
  items,
  phase,
  locale,
}: {
  title: string
  shape: 'straight' | 'wanderLeft' | 'wanderRight'
  items: Promotable[]
  phase: PromotablePhase
  locale: SiteLocale
}) {
  if (!items.length) return null
  return (
    <section className="relative overflow-x-clip bg-cream">
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape={shape} />
        <div className="hidden md:block" />
        <div className="py-7 lg:py-8">
          <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
            {title}
          </h2>
          <ul className="mt-6 border-t border-navy/15">
            {items.map((p) => (
              // The section owns the phase, so heading and copy always agree.
              <ChallengeRow key={p.id} p={p} phase={phase} locale={locale} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export default async function ChallengesPage({ searchParams }: { searchParams: Search }) {
  const locale = await siteLocale((await searchParams).lang)
  const t = translator(hubStrings, locale)
  const now = new Date()
  const all = await getPromotables()
  const b = bucket(all, now)
  const active = collapseSeries(b.active)
  const upcoming = collapseSeries(b.upcoming)
  const wrapped = collapseSeries(b.wrapped)
  const isEmpty = !active.length && !upcoming.length && !wrapped.length

  const nextWalkRide =
    [...active, ...upcoming].find((p) => p.event?.seriesKey === 'walk-ride-day')?.startsAt ?? null

  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main className="bg-cream">
        <PageHero
          eyebrow={t('hero.eyebrow')}
          title={rich(t('hero.title'), { em: <em className="text-green-deep">{t('hero.title_em')}</em> })}
          lede={t('hero.lede')}
        >
          {isEmpty && <ChallengesEmpty nextWalkRideDay={nextWalkRide} locale={locale} />}
        </PageHero>

        <Section title={t('section.now')} shape="straight" items={active} phase="active" locale={locale} />
        <Section title={t('section.upcoming')} shape="wanderRight" items={upcoming} phase="upcoming" locale={locale} />
        <Section title={t('section.wrapped')} shape="wanderLeft" items={wrapped} phase="wrapped" locale={locale} />
        <ArchiveSection locale={locale} />

        {/* Always renders, so the page is never bare. */}
        <section className="relative overflow-x-clip bg-white">
          <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
            <RouteSegment shape="terminal" />
            <div className="hidden md:block" />
            <div className="pb-20 pt-8 lg:pb-24 lg:pt-10">
              <h2 className="max-w-[620px] font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.15] text-navy">
                {rich(t('closing.title'), { em: <em className="text-green-deep">{t('closing.title_em')}</em> })}
              </h2>
              <p className="mt-5 max-w-[560px] text-[1.0625rem] leading-[1.65] text-ink-soft">{t('closing.body')}</p>
              <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-[15px]">
                <TrackedLink
                  href={withLang('/shift', locale)}
                  placement="challenges_hub"
                  destination="closing:app"
                  className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline"
                >
                  {t('closing.app')}
                </TrackedLink>
                <TrackedLink
                  href={withLang('/events', locale)}
                  placement="challenges_hub"
                  destination="closing:events"
                  className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline"
                >
                  {t('closing.events')}
                </TrackedLink>
                <TrackedLink
                  href="/contact"
                  placement="challenges_hub"
                  audience="partner"
                  destination="closing:partner"
                  className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline"
                >
                  {t('closing.sponsor')}
                </TrackedLink>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
