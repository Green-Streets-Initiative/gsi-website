import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import { BUTTON, H3, SignHero, SignTop, Stats, StepSign, StreetHeading, StreetLink, StreetSection } from '@/components/street/Street'
import { weekdayDateET, shortDateET } from '@/lib/campaigns/format'
import { ANDROID_URL, IOS_URL, IS_LIVE } from '@/app/shift-your-semester/_lib/load'
import { loadPrizeShops, loadWalkRideDays, type WalkRideDayData } from './_lib/load'
import PrizeShops from './PrizeShops'

/*
 * Walk/Ride Day, in the street-sign look (2026-09-28): the flagship program page as
 * a sibling of the challenge and semester pages rather than a generic
 * program brochure. Lives at /programs/walk-ride-days. What it says is what the app and the
 * rules page say: the next date, that month's drawing, how a trip enters
 * you, and who to bring.
 */

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Walk/Ride Day — one Friday a month, Massachusetts moves together | Green Streets Initiative',
  description:
    'Walk, bike, or ride the T on Walk/Ride Day and the Shift app enters you in that month’s gift card drawing. Free, nothing to sign up for, since 2006.',
}

const STEPS: { title: string; body: string }[] = [
  { title: 'Get Shift', body: 'Free on iOS and Android. Sign up once and it quietly recognizes your walks, rides, and transit trips from then on.' },
  { title: 'Make a trip that day', body: 'Walk to the store, bike to work, take the bus to class. One trip is enough; more trips are more chances.' },
  { title: 'You’re in the drawing', body: 'Each trip that day enters you automatically. Winners are drawn the next morning and claim their gift card in the app.' },
]

const BRING: { title: string; body: string; href: string; label: string }[] = [
  { title: 'Your workplace', body: 'Shift for employers turns Walk/Ride Day into a team standings board, with your own prizes if you want them.', href: '/shift/employers', label: 'Shift for employers' },
  { title: 'Your school', body: 'Classrooms and campuses count every walk to school. Shift for Schools runs it with parent volunteers.', href: '/shift/schools', label: 'Shift for Schools' },
  { title: 'Your town', body: 'Every town has a page: what moved, who’s leading, and the events on the calendar that Friday.', href: '/shift/towns', label: 'Find your town' },
]

function dollars(n: number): string {
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`
}

function Ledger({ d }: { d: WalkRideDayData }) {
  const rows: { value: string; label: string }[] = [
    d.next
      ? { value: shortDateET(d.next.startsAt), label: d.next.active ? 'Today is Walk/Ride Day' : 'Next Walk/Ride Day' }
      : { value: 'Last Friday', label: 'of every month' },
    d.prizes
      ? { value: d.prizes.each ? `${d.prizes.count} × ${dollars(d.prizes.each)}` : `${dollars(d.prizes.total)}`, label: d.prizes.each ? 'Gift cards in the drawing' : 'In gift cards, in the drawing' }
      : { value: 'Gift cards', label: 'Drawn the next morning' },
    { value: '2006', label: 'The first Walk/Ride Day' },
    { value: 'Free', label: 'Nothing to sign up for' },
  ]
  return (
    <section className="bg-cream">
      <div className="mx-auto w-full max-w-[1120px] px-6 lg:px-8">
        <Stats
          cols={4}
          items={rows}
          note={
            <>
              Open to anyone 18 or older in Massachusetts with the Shift app. Up to three trips a day count toward the drawing.{' '}
              <Link href="/events/walk-ride-day/rules" className="font-bold text-forest underline-offset-4 hover:underline">Official rules</Link>
            </>
          }
        />
      </div>
    </section>
  )
}

export default async function WalkRideDayPage() {
  const d = await loadWalkRideDays()
  const shops = await loadPrizeShops(d.prizes)
  const nextLabel = d.next ? weekdayDateET(d.next.startsAt) : null

  return (
    <div className="street">
      <Nav variant="light" street />
      <main className="bg-cream">
        <SignHero
          top={
            d.next ? (
              <SignTop strong={d.next.active ? 'Today' : nextLabel}>Walk/Ride Day</SignTop>
            ) : (
              <SignTop strong="The last Friday of every month">Walk/Ride Day</SignTop>
            )
          }
          title="One Friday a month, Massachusetts moves together."
          lede={
            <p>
              Walk, bike, or ride the T on Walk/Ride Day. If you have the Shift app, every trip you take that day enters you in the month’s gift card drawing. Nothing to sign up for, and it’s free.
            </p>
          }
          after={
            <>
              {d.moved && <p className="mt-5 text-[16px] text-navy">Moved off the last Friday for the holiday.</p>}
              {IS_LIVE && <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} tone="light" className="mt-6 [&>a]:max-[420px]:basis-full" />}
            </>
          }
        />

        <Ledger d={d} />

        {shops && <PrizeShops data={shops} />}

        <StreetSection id="how" className="scroll-mt-28">
          <StreetHeading title="How it works" lede="Three steps, and the last one happens on its own." />
          <ol className="grid gap-8 md:grid-cols-3 md:gap-10">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <StepSign n={i + 1} />
                <div>
                  <h3 className={H3}>{s.title}</h3>
                  <p className="mt-2 text-[1.0625rem] leading-[1.65] text-ink-soft">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-[640px] text-[16px] leading-relaxed text-ink-soft">
            Walks, bike rides, buses, trains, and ferries all count, and carpools do too. The app detects them; there is nothing to log. Standings for the day live in the app’s Community tab.
          </p>
        </StreetSection>

        <StreetSection tone="white" width="read" id="dates" className="scroll-mt-28">
          <StreetHeading title="The next few" lede="Usually the last Friday of the month. When that lands on a holiday weekend, it moves a week earlier." />
          <ul className="border-t-2 border-navy/[0.14]">
            {[d.next, ...d.later].filter((x): x is NonNullable<typeof x> => !!x).map((day, i) => (
              <li key={day.startsAt} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-navy/[0.14] py-4">
                <span className={`text-[1.125rem] ${i === 0 ? 'font-bold text-navy' : 'text-navy'}`}>{weekdayDateET(day.startsAt)}</span>
                <span className="text-[15px] text-ink-soft">{i === 0 ? (day.active ? 'today' : 'next') : 'prizes announced closer to the day'}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2">
            <StreetLink href="/challenges">Everything running now</StreetLink>
            <StreetLink href="/events">Events that Friday</StreetLink>
          </div>
        </StreetSection>

        <StreetSection id="bring" className="scroll-mt-28">
          <StreetHeading title="Bring your people" lede="Walk/Ride Day started as a workplace thing in 2006. It still works best in groups." />
          <div className="grid gap-8 md:grid-cols-3 md:gap-10">
            {BRING.map((b) => (
              <div key={b.title}>
                <h3 className={H3}>{b.title}</h3>
                <p className="mt-2 text-[1.0625rem] leading-[1.65] text-ink-soft">{b.body}</p>
                <StreetLink href={b.href}>{b.label}</StreetLink>
              </div>
            ))}
          </div>
        </StreetSection>

        <StreetSection tone="white" width="read" closing id="join">
          <h2 className="font-headline text-[clamp(1.75rem,3.4vw,2.5rem)] font-extrabold leading-[1.1] tracking-[-0.01em] text-navy">
            {nextLabel ? <>See you {nextLabel}.</> : <>See you on the last Friday.</>}
          </h2>
          <p className="mt-4 max-w-[560px] text-[1.0625rem] leading-[1.65] text-ink-soft">
            Get the app before then and your first Walk/Ride Day trip counts. If you already have it, you’re set.
          </p>
          {IS_LIVE ? (
            <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} tone="light" className="mt-8 [&>a]:max-[420px]:basis-full" />
          ) : (
            <Link href="/shift" className={`${BUTTON} mt-8`}>Get the Shift app &rarr;</Link>
          )}
          <p className="mt-6 text-[15px] text-ink-soft">
            Questions, or want Walk/Ride Day at your workplace? <Link href="/contact?inquiry=general" className="font-bold text-forest underline-offset-4 hover:underline">Get in touch</Link>.
          </p>
        </StreetSection>
      </main>
      <Footer variant="light" street />
    </div>
  )
}
