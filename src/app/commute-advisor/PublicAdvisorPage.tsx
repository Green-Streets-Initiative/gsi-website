'use client'

import { useState } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import JsonLd from '@/components/JsonLd'
import AdvisorFlow, { PLAN_STEP } from '@/components/commute/AdvisorFlow'
import AskAboutTrip from '@/components/commute/AskAboutTrip'
import { PRICES } from '@/lib/facts/prices'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { advisorStrings } from '@/lib/site-strings/advisor'

/*
 * The public Commute Advisor: the shared flow (AdvisorFlow) with the site's
 * hero, the methodology note and the FAQ that ranks for the questions
 * people type. The flow keeps its inputs and plan in sessionStorage under
 * `commute-advisor-state`, which is also how /nearby hands a trip over.
 * page.tsx resolves the language (?lang=, then the browser's) and renders this.
 */

const FAQ_KEYS = [1, 2, 3, 4, 5, 6] as const

/* ── Structured data ── */
// This page is the site's largest impression source and ranks on
// question-shaped queries. The six answers below are the ones visible on
// the page; the markup only describes them to search and answer engines.
// Both blocks are derived from the same strings the page renders, so the
// markup cannot drift from the visible copy. Never hand-write a question or
// answer here.
const PAGE_URL = 'https://www.gogreenstreets.org/commute-advisor'

const PUBLIC_TRACK_PROPS = {}

const METHOD_LINK = '<a href="https://www.mbta.com/fares" target="_blank" rel="noopener noreferrer" class="text-forest underline">'

export default function PublicAdvisorPage({ locale = 'en' }: { locale?: SiteLocale }) {
  const t = translator(advisorStrings, locale)
  const faq = FAQ_KEYS.map((n) => ({
    q: t(`page.faq${n}_q` as const),
    a: t(`page.faq${n}_a` as const, { price: PRICES.mbta.linkPassMonthly }),
  }))
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        // The rendered answer is HTML; schema.org text wants the words only.
        text: item.a.replace(/<[^>]*>/g, ''),
      },
    })),
  }
  const appSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: t('page.app_name'),
    url: PAGE_URL,
    applicationCategory: 'TravelApplication',
    browserRequirements: 'Requires JavaScript.',
    operatingSystem: 'Any',
    description: t('page.app_description'),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    areaServed: { '@type': 'AdministrativeArea', name: 'Massachusetts' },
    publisher: { '@id': 'https://www.gogreenstreets.org/#organization' },
  }

  // On the plan (step 3) the hero steps aside: the headline, the grid and
  // the map are the page, and they belong above the fold (Keith 2026-10-15).
  const [step, setStep] = useState(1)
  const onPlan = step === PLAN_STEP
  const [titleBefore, titleAfter = ''] = t('page.hero_title').split('{em}')
  return (
    <div className="advisor-root">
      <Nav variant="light" locale={locale} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        {/* Hero */}
        {onPlan ? (
          <div className="pt-5">
            <h1 className="sr-only">{t('page.hero_sr')}</h1>
          </div>
        ) : (
          <div className="mx-auto max-w-[640px] px-6 pb-5 pt-7 text-center lg:px-8 lg:pt-9">
            <h1 className="mb-2.5 font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              {titleBefore}{t('page.hero_title_em')}{titleAfter}
            </h1>
            <p className="text-[17px] leading-relaxed text-ink-soft">
              {t('page.hero_body')}
            </p>
          </div>
        )}

        <AdvisorFlow
          variant="public"
          persistSession
          trackProps={PUBLIC_TRACK_PROPS}
          onStepChange={setStep}
          locale={locale}
          // Off unless its switch is on (or ?ask=1); keyed by the trip so a new plan starts fresh.
          askAboutTrip={(trip) => <AskAboutTrip key={`${trip.from.lat},${trip.from.lng}-${trip.to.lat},${trip.to.lng}`} trip={trip} locale={locale} />}
        />

        {/* Methodology */}
        <div className="mx-auto mt-8 max-w-[860px] px-6 lg:px-8">
          <div className="rounded-xl border border-navy/10 bg-navy/[0.04] px-5 py-4">
            <div className="mb-2 text-[0.8125rem] font-semibold uppercase tracking-[0.14em] text-forest">{t('page.method_title')}</div>
            {locale === 'en' ? (
              <div className="text-[0.9375rem] leading-[1.65] text-ink-soft">
                Door-to-door times come from Google Maps for a weekday morning, with parking and the walk in added to driving and a minute to lock up added to biking. Driving costs use the current Massachusetts gas price (or home charging for an electric car) plus the AAA rate for maintenance, repairs and tires, about 12 cents a mile (AAA Your Driving Costs 2026). <strong className="font-semibold text-navy">Fixed costs like insurance, depreciation and registration are left out</strong>, since they do not change with how many days you drive. MBTA fares come from{' '}
                <a href="https://www.mbta.com/fares" target="_blank" rel="noopener noreferrer" className="text-forest underline">mbta.com/fares</a>, counting a monthly pass when it works out cheaper than paying per ride. Bike upkeep is counted at about 10 cents a mile. Emissions are shown as the share of your own commute emissions each way in shifts, from EPA figures per mile. Gas prices, fares and parking costs are updated regularly from public sources.
              </div>
            ) : (
              <div
                className="text-[0.9375rem] leading-[1.65] text-ink-soft"
                dangerouslySetInnerHTML={{
                  __html: t('page.method_body')
                    .replace('<strong>', '<strong class="font-semibold text-navy">')
                    .replace('<a>', METHOD_LINK),
                }}
              />
            )}
          </div>
        </div>

        {/* FAQ */}
        <div className="mx-auto max-w-[780px] px-6 pb-16 pt-10 lg:px-8 lg:pb-20 lg:pt-14">
          <h2 className="mb-6 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
            {t('page.faq_title')}
          </h2>
          {faq.map((item, i) => (
            <div key={i} className="border-t border-navy/10 py-6 last:border-b">
              <div className="mb-2.5 font-serif text-[1.25rem] leading-tight text-navy">{item.q}</div>
              <div className="text-[15px] leading-[1.75] text-ink-soft" dangerouslySetInnerHTML={{ __html: item.a }} />
            </div>
          ))}
        </div>
      </main>
      <Footer variant="light" locale={locale} />
      <JsonLd data={[faqSchema, appSchema]} />
    </div>
  )
}
