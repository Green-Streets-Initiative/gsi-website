import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Bike, CalendarDays, Landmark, MapPin, Megaphone, ReceiptText, Satellite, ShieldCheck, Store, TrainFront } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { getTownBySlug, getTownDirectory } from '@/lib/towns/queries'
import { CONTAINER, GSI_FONT } from '../../move-in/sign'
import PhoneFrame from '../../shift/_components/PhoneFrame'
import Actions from './Actions'
import { BOOK_URL } from './book'

/**
 * The Town Challenge, for city and town staff (persona `town-staff`; Keith
 * 2026-11-03). The rideshare-fee and past-client emails link here with the
 * town's slug (?town=revere-ma), so the page speaks to that town. The same page
 * prints as the one-page description an official forwards to a colleague or a
 * board, which is why it stays short: what it is, who does what, what it
 * costs and how to pay, the first questions, one way to say yes (book a call).
 *
 * Every price and promise comes from docs/programs/municipalities/brief.md
 * ("What we sell", settled by Keith 2026-10-30). Not indexed until Keith
 * approves it.
 */

export const metadata: Metadata = {
  title: 'Town Challenge for Massachusetts cities and towns | Green Streets Initiative',
  description:
    'A three-month spring program that gets residents walking, biking and riding transit, with monthly prize drawings and a results summary for your state report. $2,500.',
  robots: { index: false, follow: false },
}

export const revalidate = 3600

const HEAD = '[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] font-extrabold text-navy'
const SLUG = /^[a-z]+(?:-[a-z]+)*-ma$/

/** The town the email was for: its proper name, and its town page when it has one. */
async function townFrom(raw: string | string[] | undefined): Promise<{ name: string; slug: string; page: string | null } | null> {
  const slug = Array.isArray(raw) ? raw[0] : raw
  if (!slug || !SLUG.test(slug)) return null
  try {
    const published = await getTownBySlug(slug)
    if (published) return { name: published.town.town_name, slug, page: `/shift/towns/${slug}` }
    const listed = (await getTownDirectory()).find((t) => t.slug === slug)
    if (listed) return { name: listed.town_name, slug, page: null }
  } catch { /* fall through to the name in the link */ }
  const name = slug.replace(/-ma$/, '').split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
  return { name, slug, page: null }
}

function Section({ id, title, lede, children, className = '' }: { id: string; title: string; lede?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-28 py-12 md:py-14 print:py-2 ${className}`}>
      <div className="print:break-after-avoid">
        <h2 className={`${HEAD} text-[clamp(1.75rem,3.4vw,2.375rem)] leading-[1.08] print:text-[1.375rem]`}>{title}</h2>
        {lede && <div className="mt-3 max-w-[680px] text-[1.0625rem] leading-[1.6] text-navy/80 print:mt-1 print:text-[0.9rem]">{lede}</div>}
      </div>
      <div className="mt-8 print:mt-3">{children}</div>
    </section>
  )
}

export default async function TownChallengePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const town = await townFrom((await searchParams).town)
  const T = town?.name ?? 'your town'
  const Tcap = town?.name ?? 'Your town'

  const steps: [string, string, string][] = [
    ['Residents join Shift, our free app', 'It records their walking, biking and transit trips by GPS, on its own.', 'Nothing self-reported'],
    ['A prize drawing each month', `On Walk/Ride Day, one Friday a month, every ${town ? `${T} ` : ''}resident who walks, bikes or rides transit is entered.`, '$250 in local gift cards'],
    ['Results for your report', 'In June, a one-page summary of residents’ trips, totals only.', 'Ready for your state report'],
  ]

  const app: [typeof TrainFront, string, string][] = [
    [TrainFront, 'Live bus and train times', 'The next departures from the stops near them.'],
    [Bike, 'Bike-friendly routes', 'The calmer streets and paths, and bike share where there is one.'],
    [MapPin, `What’s on in ${T}`, 'Local walks, rides and events, and a town page.'],
    [Satellite, 'Trips counted by GPS', 'Shift records each trip itself, so no one types in miles.'],
  ]

  const weDo = [
    `Set up the season with ${T}’s name and a town leaderboard`,
    'Print about 500 posters and flyers with a QR code to join',
    'Promote it by email, app notices, social posts and free Google ads',
    `Bring a table to one ${T} event`,
    'Run the drawings and send the gift cards',
    'Write the results summary',
  ]
  const youDo = [
    'Share the announcement on your website, newsletter and social media',
    'Pick one event for our table',
    'One short call to choose the months',
  ]

  const cost: [string, string, string][] = [
    ['Prizes for residents', '$750', 'Three drawings of $250 in gift cards from local businesses, for example one $50 and twenty $10.'],
    ['Posters, flyers and a table kit', '$250', 'About 500 printed pieces with the QR code.'],
    ['Green Streets’ time', '$1,500', 'About 20 hours: setup, promotion, the drawings, the table and the summary.'],
  ]

  const questions: [string, ReactNode, string?][] = [
    [
      'How would a sponsor work?',
      `If a bank, credit union or business already works with ${T}, tell us on the call and we’ll make the ask with a one-page note. We thank the sponsor by name on the posters, the flyers and the results summary. Local shops can also give gift cards for the drawings. If no one comes to mind, we can ask a few local businesses, but the season doesn’t depend on it.`,
      'sponsor',
    ],
    [
      `What does ${T} see about residents?`,
      'Town totals only: trips, miles and how people traveled. Never names, and never where any one person went. We leave out any number that would come from fewer than 10 residents.',
    ],
    ['Which months?', 'Any three months in a row. Spring (March, April and May) is the next full season. Walk/Ride Day is usually the last Friday of the month.'],
    ['Do hand-entered trips count?', 'Residents can add a trip the app missed, but only GPS-recorded trips enter the drawings and go in your summary.'],
    ['What languages?', 'Posters and flyers come in English, Spanish and Portuguese. The app also works in Chinese.'],
    ['What isn’t included?', 'Paid advertising, printing beyond the kit, events we don’t attend, and translation into other languages. We can price any of these if you need them.'],
    ['How do we buy it?', 'We send a short agreement and one invoice, sized for a purchase order.'],
  ]

  // Printed, it's zoomed to two pages: the program, then the cost and questions.
  return (
    <div className="street min-h-screen bg-cream text-navy print:[zoom:0.85]" style={{ fontFamily: GSI_FONT }}>
      <div className="print:hidden">
        <Nav variant="light" street />
      </div>

      {/* Hero: what it is, for whom, the price, and the yes. */}
      <section className="bg-cream pt-[60px] print:pt-0">
        <div className={`${CONTAINER} pb-4 pt-6 md:pt-10 print:pb-0 print:pt-0`}>
          <div className="rounded-[24px] bg-forest px-5 pb-8 pt-7 text-white sm:px-10 sm:pb-10 sm:pt-9 print:rounded-[14px] print:px-6 print:pb-5 print:pt-5">
            <p className="text-[1rem] font-bold text-white/90">
              {town ? `For ${T} staff` : 'For Massachusetts city and town staff'} · Town Challenge
            </p>
            <h1 className="mt-4 [font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(2rem,4.8vw,3.375rem)] font-extrabold leading-[1.04] tracking-[-0.01em] text-white print:mt-2 print:text-[1.75rem]">
              Three spring months that get {town ? `${T} residents` : 'your residents'} walking, biking and riding transit
            </h1>
            <p className="mt-5 max-w-[640px] text-[1.125rem] leading-[1.55] text-white/90 print:mt-2 print:text-[0.95rem]">
              Residents get a free app and a prize drawing each month. You get a summary of their GPS-recorded trips for your
              state report or a grant. It costs $2,500, and Green Streets does the work.
            </p>
            <div className="mt-7 print:hidden">
              <Actions town={town?.name ?? null} slug={town?.slug ?? null} light />
            </div>
          </div>
          <ul className="mt-4 grid gap-2 text-[15px] font-bold text-navy sm:grid-cols-3 print:mt-2 print:grid-cols-3 print:text-[12px]">
            {['$2,500, no quotes needed', 'Payable with rideshare fee money', 'GPS-recorded, not self-reported'].map((t) => (
              <li key={t} className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 print:py-1.5">
                <ShieldCheck className="h-4 w-4 shrink-0 text-forest" aria-hidden /> {t}
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-[760px] text-[1rem] leading-[1.55] text-navy/80 print:mt-2 print:text-[0.8rem]">
            <b className="text-navy">From Green Streets Initiative</b>, a Somerville nonprofit that has helped people across
            Massachusetts walk, bike and take transit since 2006. The City of Everett hired us for its{' '}
            <a href="/programs/what-moves-us/everett-schools" className="font-bold text-forest underline underline-offset-2">school travel study</a>,
            and Cambridge’s Public Health Department funded our{' '}
            <a href="/programs/what-moves-us/frisoli-youth-center" className="font-bold text-forest underline underline-offset-2">Frisoli Youth Center study</a>.
          </p>
        </div>
      </section>

      {/* In-page navigation, kept in reach under the site header while scrolling. */}
      <nav aria-label="On this page" className="sticky top-[60px] z-40 mt-4 border-y border-navy/10 bg-cream/95 backdrop-blur print:hidden">
        <div className={`${CONTAINER} flex gap-x-4 overflow-x-auto whitespace-nowrap text-[15px] [scrollbar-width:none] sm:gap-x-6 [&::-webkit-scrollbar]:hidden`}>
          {/* Phones keep the four that fit: where to read, and the call. */}
          {[['#how', 'How it works', 'inline-flex'], ['#app', 'The app', 'hidden sm:inline-flex'], ['#who', 'Who does what', 'hidden sm:inline-flex'], ['#cost', 'Cost', 'inline-flex'], ['#questions', 'Questions', 'inline-flex']].map(([href, label, display]) => (
            <a key={href} href={href} className={`${display} min-h-[44px] items-center font-bold text-forest underline-offset-4 hover:underline`}>{label}</a>
          ))}
          <a href={BOOK_URL} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex min-h-[44px] items-center font-bold text-navy underline underline-offset-4">Book a call</a>
        </div>
      </nav>

      <main className={CONTAINER}>
        <Section id="how" title="How it works">
          <ol className="grid gap-4 md:grid-cols-3 print:grid-cols-3 print:gap-3">
            {steps.map(([t, b, c], i) => (
              <li key={t} className="rounded-[18px] border border-navy/10 bg-white px-5 py-5 print:break-inside-avoid print:px-3 print:py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-forest text-[1.125rem] font-extrabold text-white print:h-7 print:w-7 print:text-[0.95rem]">{i + 1}</span>
                <p className="mt-4 text-[1.125rem] font-bold text-navy print:mt-2 print:text-[0.95rem]">{t}</p>
                <p className="mt-1 text-[1.0625rem] leading-[1.55] text-navy/80 print:text-[0.85rem] print:leading-snug">{b}</p>
                <p className="mt-3 inline-flex rounded-full bg-forest/10 px-3 py-1 text-[15px] font-bold text-forest print:mt-1 print:text-[0.75rem]">{c}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* What residents get: the app is the reason a resident joins, so show it. */}
        <section id="app" className="scroll-mt-28 -mx-6 bg-[#191A2E] px-6 py-12 text-white sm:mx-0 sm:rounded-[24px] sm:px-10 md:py-14 print:mx-0 print:rounded-[14px] print:px-6 print:py-4 print:break-inside-avoid">
          <div className="grid items-center gap-10 md:grid-cols-[1fr_auto] print:grid-cols-[1fr] print:gap-3">
            <div>
              <h2 className="[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(1.75rem,3.4vw,2.375rem)] font-extrabold leading-[1.08] text-white print:text-[1.375rem]">
                What residents get in Shift
              </h2>
              <p className="mt-3 max-w-[560px] text-[1.0625rem] leading-[1.6] text-white/80 print:mt-1 print:text-[0.85rem]">
                A free app that makes the buses, trains and bike routes {town ? `${T} already has` : 'you already have'} easier to use.
              </p>
              <ul className="mt-7 grid gap-5 sm:grid-cols-2 print:mt-2 print:grid-cols-4 print:gap-2">
                {app.map(([I, t, b]) => (
                  <li key={t} className="flex gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#BAF14D] print:h-7 print:w-7"><I className="h-5 w-5 print:h-4 print:w-4" aria-hidden /></span>
                    <div>
                      <p className="text-[1.0625rem] font-bold text-white print:text-[0.85rem]">{t}</p>
                      <p className="mt-0.5 text-[15px] leading-[1.5] text-white/80 print:hidden">{b}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-[15px] text-white/80 print:hidden">On iPhone and Android, in English, Spanish, Portuguese and Chinese.</p>
            </div>
            <div className="mx-auto flex gap-4 print:hidden" aria-hidden="true">
              <PhoneFrame src="/images/shift-app/around-you.png" alt="" className="w-[230px] sm:w-[200px]" />
              <PhoneFrame src="/images/shift-app/rewards-perks-current.png" alt="" className="mt-10 hidden w-[200px] sm:block" />
            </div>
          </div>
        </section>

        <Section id="who" title="Who does what" className="border-t border-navy/10">
          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr] print:break-inside-avoid print:grid-cols-[1.4fr_1fr] print:gap-3">
            <div className="rounded-[18px] bg-white px-6 py-6 print:px-4 print:py-3">
              <p className="flex items-center gap-2 text-[1.125rem] font-bold text-navy print:text-[0.95rem]">
                <Megaphone className="h-5 w-5 text-forest" aria-hidden /> Green Streets
              </p>
              <ul className="mt-3 space-y-2 text-[1.0625rem] leading-[1.5] text-navy/85 print:mt-1 print:space-y-0.5 print:text-[0.85rem]">
                {weDo.map((x) => <li key={x} className="flex gap-2"><span aria-hidden className="text-forest">•</span>{x}</li>)}
              </ul>
            </div>
            <div className="rounded-[18px] border-2 border-forest/30 bg-white px-6 py-6 print:px-4 print:py-3">
              <p className="flex items-center gap-2 text-[1.125rem] font-bold text-navy print:text-[0.95rem]">
                <Landmark className="h-5 w-5 text-forest" aria-hidden /> {Tcap}
              </p>
              <ul className="mt-3 space-y-2 text-[1.0625rem] leading-[1.5] text-navy/85 print:mt-1 print:space-y-0.5 print:text-[0.85rem]">
                {youDo.map((x) => <li key={x} className="flex gap-2"><span aria-hidden className="text-forest">•</span>{x}</li>)}
              </ul>
            </div>
          </div>
        </Section>

        <Section id="cost" title="What it costs, and how to pay" className="border-t border-navy/10 print:break-before-page print:border-t-0">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-start print:grid-cols-[1.1fr_1fr] print:gap-4">
            <table className="w-full overflow-hidden rounded-[18px] bg-white text-left">
              <tbody>
                {cost.map(([what, amount, note]) => (
                  <tr key={what} className="border-b border-navy/10 align-top">
                    <td className="px-5 py-4 print:px-3 print:py-1.5">
                      <p className="text-[1.0625rem] font-bold text-navy print:text-[0.85rem]">{what}</p>
                      <p className="mt-0.5 text-[15px] leading-snug text-navy/75 print:text-[0.75rem]">{note}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-[1.125rem] font-bold tabular-nums text-navy print:px-3 print:py-1.5 print:text-[0.9rem]">{amount}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-5 py-4 text-[1.125rem] font-extrabold text-navy print:px-3 print:py-1.5 print:text-[0.95rem]">Total, one season</td>
                  <td className="px-5 py-4 text-right text-[1.375rem] font-extrabold tabular-nums text-forest print:px-3 print:py-1.5 print:text-[1.05rem]">$2,500</td>
                </tr>
              </tbody>
            </table>
            <ul className="space-y-5 print:space-y-2">
              {[
                [ReceiptText, 'Your Uber and Lyft fee money can pay for it', <>State law lets cities and towns spend it on &ldquo;programs that support alternative modes of transportation&rdquo; (Chapter 187 of the Acts of 2016, Section 8).</>],
                [CalendarDays, 'A line for your December 31 report', <>&ldquo;Planned: Town Challenge with Green Streets Initiative, a three-month resident walking, biking and transit program, spring 2027, $2,500.&rdquo;</>],
                [Store, 'A local sponsor can cover the prizes', <>A bank, credit union or business can fund the $750, and {T} pays $1,750. <a href="#sponsor" className="font-bold text-forest underline underline-offset-2">How a sponsor works</a></>],
              ].map(([Icon, t, b]) => {
                const I = Icon as typeof ReceiptText
                return (
                  <li key={t as string} className="flex gap-3 print:break-inside-avoid">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest print:h-7 print:w-7"><I className="h-5 w-5 print:h-4 print:w-4" aria-hidden /></span>
                    <div>
                      <p className="text-[1.0625rem] font-bold text-navy print:text-[0.85rem]">{t as string}</p>
                      <p className="mt-0.5 text-[1rem] leading-[1.5] text-navy/80 print:text-[0.78rem] print:leading-snug">{b as ReactNode}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </Section>

        <Section id="questions" title="Questions" className="border-t border-navy/10">
          <dl className="grid gap-x-10 gap-y-6 md:grid-cols-2 print:grid-cols-2 print:gap-x-6 print:gap-y-2">
            {questions.map(([q, a, id]) => (
              <div key={q} id={id} className="scroll-mt-28 print:break-inside-avoid">
                <dt className="text-[1.0625rem] font-bold text-navy print:text-[0.85rem]">{q}</dt>
                <dd className="mt-1 text-[1.0625rem] leading-[1.55] text-navy/80 print:text-[0.78rem] print:leading-snug">{a}</dd>
              </div>
            ))}
          </dl>
          {town?.page && (
            <p className="mt-8 text-[1.0625rem] leading-[1.55] text-navy/80 print:hidden">
              Every Massachusetts town with residents on Shift has a free page, with local events, ways to get involved and
              residents’ trips.{' '}
              <a href={town.page} className="font-bold text-forest underline underline-offset-2">See {T}’s page</a>.
            </p>
          )}
        </Section>

        <section className="mb-14 rounded-[24px] bg-forest px-6 py-8 text-white sm:px-10 print:mb-0 print:rounded-[14px] print:px-6 print:py-4">
          <h2 className="[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(1.5rem,3vw,2.125rem)] font-extrabold leading-[1.1] text-white print:text-[1.2rem]">
            Would {town ? T : 'your town'} like to take part this spring?
          </h2>
          <p className="mt-3 max-w-[620px] text-[1.0625rem] leading-[1.55] text-white/90 print:mt-1 print:text-[0.85rem]">
            Pick a time for a short call with Keith, or reply “yes” to his email. On the call you choose the months and the event for our table.
          </p>
          <div className="mt-6"><Actions town={town?.name ?? null} slug={town?.slug ?? null} light /></div>
          <p className="mt-5 hidden text-[0.85rem] text-white print:block">
            Keith Anderson, Executive Director · keith@gogreenstreets.org · Book a call: {BOOK_URL.replace('https://', '')}
          </p>
        </section>
      </main>

      <div className="print:hidden">
        <Footer variant="light" />
      </div>
    </div>
  )
}
