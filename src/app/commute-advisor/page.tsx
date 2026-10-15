'use client'

import { useState } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import JsonLd from '@/components/JsonLd'
import AdvisorFlow, { PLAN_STEP } from '@/components/commute/AdvisorFlow'
import { PRICES } from '@/lib/facts/prices'

/*
 * The public Commute Advisor: the shared flow (AdvisorFlow) with the site's
 * hero, the methodology note and the FAQ that ranks for the questions
 * people type. The flow keeps its inputs and plan in sessionStorage under
 * `commute-advisor-state`, which is also how /nearby hands a trip over.
 */

const FAQ = [
  {
    q: 'How much money can I save by biking or walking to work in Boston?',
    a: 'On a typical 7-mile Boston-area commute, choosing to bike or walk three days a week puts roughly <strong>$900–$1,500 back in your pocket per year</strong> in fuel and maintenance savings, and more if you\'re paying for parking. The maintenance savings surprise people: oil changes, tire wear, and brake replacement accumulate meaningfully over a full year of daily driving. At roughly 10–11 cents per mile, three active commute days a week on a 7-mile route saves around $175–$190 in maintenance alone, before you touch the gas budget.',
  },
  {
    q: 'How does biking to work compare to driving in Boston traffic?',
    a: 'On many Boston-area routes, a bike commute is surprisingly competitive with driving. A cyclist averaging 10–12 mph on a 5–7 mile urban route can match or beat door-to-door driving time once parking and walking are included. For routes from neighborhoods like Somerville, Cambridge, or Jamaica Plain into the core, <strong>cycling often takes the same time or less</strong>. E-bikes close the gap further for hillier routes or longer distances.',
  },
  {
    q: 'What health benefits do I get from an active commute?',
    a: 'A 7-mile bike commute at a moderate pace is about 45 minutes of moderate-intensity cardiovascular exercise, the kind of effort that leaves you warm and a little breathless, not wrecked. Riding it three days a week puts you at <strong>roughly 135 minutes of moderate activity per week</strong>, most of the way to the American Heart Association\'s 150-minute guideline, without setting foot in a gym or finding a spare hour. Add a fourth day, or a walk to the T on the others, and you clear it comfortably. For people who struggle to find time to exercise, commuting actively is often the most sustainable way to build consistent movement into a structured day.',
  },
  {
    q: 'Is the MBTA a reliable alternative to driving for Boston-area commuters?',
    a: 'It depends heavily on your route. The Red, Orange, and Green lines serve dense corridors well and are genuinely competitive with driving for many downtown-bound commutes. Bus routes vary significantly in reliability, though key routes, particularly the 86, 1, 39, and Silver Line, have improved with dedicated bus lanes. The monthly LinkPass at $' + PRICES.mbta.linkPassMonthly + ' covers unlimited trips on all subway, bus, and Silver Line routes. For a commuter making 40+ trips a month, <strong>the pass pays for itself in under three weeks</strong> of use.',
  },
  {
    q: 'What\'s the best way to start commuting by bike if you\'re new to riding in traffic?',
    a: 'The most common approach is to start on lower-traffic parallel routes before gradually building confidence on main roads. The Boston region has an expanding network of protected bike lanes, and tools like the MassDOT bike map show low-stress routing options. Many new commuters find it helpful to do a dry run on a weekend first. <strong>E-bikes make a significant difference</strong> for hillier routes or longer distances — they remove the exertion concern and let you arrive without breaking a sweat. Green Streets Initiative\'s Shift app is designed to help people in exactly this situation: discover routes, build confidence, and see the real-world results of their choices.',
  },
  {
    q: 'How much does parking cost in Boston and Cambridge?',
    a: 'Daily parking rates in the Boston area vary significantly by neighborhood. Downtown Boston and the Seaport typically run <strong>$28–$35 per day</strong>. Back Bay and the South End average $22–$28. Cambridge near Kendall Square runs $18–$25. Somerville, Medford, and inner suburban areas typically range from $10–$16. Monthly garage parking in downtown Boston averages $350–$500/month. Many employers subsidize or provide free parking, which is why the advisor asks about your actual situation rather than assuming you pay market rate.',
  },
]

/* ── Structured data ── */
// This page is the site's largest impression source and ranks on
// question-shaped queries. The six answers below are the ones visible on
// the page; the markup only describes them to search and answer engines.
// Both blocks are derived from the same constants the page renders, so the
// markup cannot drift from the visible copy. Never hand-write a question or
// answer here.
const PAGE_URL = 'https://www.gogreenstreets.org/commute-advisor'

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((item) => ({
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
  name: 'Commute Advisor',
  url: PAGE_URL,
  applicationCategory: 'TravelApplication',
  browserRequirements: 'Requires JavaScript.',
  operatingSystem: 'Any',
  description:
    'Compares how long a trip takes walking, biking, on transit, and driving in Massachusetts, with when to leave and the daily and yearly cost of each.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  areaServed: { '@type': 'AdministrativeArea', name: 'Massachusetts' },
  publisher: { '@id': 'https://www.gogreenstreets.org/#organization' },
}

const PUBLIC_TRACK_PROPS = {}

export default function CommuteAdvisorPage() {
  // On the plan (step 3) the hero steps aside: the headline, the grid and
  // the map are the page, and they belong above the fold (Keith 2026-10-15).
  const [step, setStep] = useState(1)
  const onPlan = step === PLAN_STEP
  return (
    <div className="advisor-root">
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        {/* Hero */}
        {onPlan ? (
          <div className="pt-5">
            <h1 className="sr-only">Find your best commute</h1>
          </div>
        ) : (
          <div className="mx-auto max-w-[640px] px-6 pb-5 pt-7 text-center lg:px-8 lg:pt-9">
            <h1 className="mb-2.5 font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
              Find your <em className="not-italic text-forest">best commute</em>
            </h1>
            <p className="text-[17px] leading-relaxed text-ink-soft">
              Tell us where you are going and when you need to be there. You get a plan: when to leave, how long each way in takes, and what it costs.
            </p>
          </div>
        )}

        <AdvisorFlow variant="public" persistSession trackProps={PUBLIC_TRACK_PROPS} onStepChange={setStep} />

        {/* Methodology */}
        <div className="mx-auto mt-8 max-w-[860px] px-6 lg:px-8">
          <div className="rounded-xl border border-navy/10 bg-navy/[0.04] px-5 py-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">How this is calculated</div>
            <div className="text-[0.8125rem] leading-[1.65] text-ink-soft">
              Door-to-door times come from Google Maps for a weekday morning, with parking and the walk in added to driving and a minute to lock up added to biking. Driving costs use the current Massachusetts gas price (or home charging for an electric car) plus the AAA rate for maintenance, repairs and tires, about 12 cents a mile (AAA Your Driving Costs 2026). <strong className="font-semibold text-navy">Fixed costs like insurance, depreciation and registration are left out</strong>, since they do not change with how many days you drive. MBTA fares come from{' '}
              <a href="https://www.mbta.com/fares" target="_blank" rel="noopener noreferrer" className="text-forest underline">mbta.com/fares</a>, counting a monthly pass when it works out cheaper than paying per ride. Bike upkeep is counted at about 10 cents a mile. Emissions are shown as the share of your own commute emissions each way in shifts, from EPA figures per mile. Gas prices, fares and parking costs are updated regularly from public sources.
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mx-auto max-w-[780px] px-6 pb-16 pt-10 lg:px-8 lg:pb-20 lg:pt-14">
          <h2 className="mb-6 font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy">
            Common questions about active commuting in Massachusetts
          </h2>
          {FAQ.map((item, i) => (
            <div key={i} className="border-t border-navy/10 py-6 last:border-b">
              <div className="mb-2.5 font-serif text-[1.25rem] leading-tight text-navy">{item.q}</div>
              <div className="text-[15px] leading-[1.75] text-ink-soft" dangerouslySetInnerHTML={{ __html: item.a }} />
            </div>
          ))}
        </div>
      </main>
      <Footer variant="light" />
      <JsonLd data={[faqSchema, appSchema]} />
    </div>
  )
}
