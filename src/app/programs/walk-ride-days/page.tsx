import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import PageHero from '@/components/org/PageHero'
import StoreButtons from '@/components/StoreButtons'
import { LANE, RouteSegment } from '@/components/home/RouteLine'
import { ArrowLink, PILL, Section, SectionHeading } from '@/components/org/Section'
import { weekdayDateET, shortDateET } from '@/lib/campaigns/format'
import { ANDROID_URL, IOS_URL, IS_LIVE } from '@/app/shift-your-semester/_lib/load'
import { loadWalkRideDays, type WalkRideDayData } from './_lib/load'

/*
 * Walk/Ride Day, on the site's cream system — the flagship program page as
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
  { title: 'Make a trip on the day', body: 'Walk to the store, bike to work, take the bus to class. One trip is enough; more trips are more chances.' },
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
      ? { value: shortDateET(d.next.startsAt), label: d.next.active ? 'today — Walk/Ride Day' : 'next Walk/Ride Day' }
      : { value: 'Last Friday', label: 'of every month' },
    d.prizes
      ? { value: d.prizes.each ? `${d.prizes.count} × ${dollars(d.prizes.each)}` : `${dollars(d.prizes.total)}`, label: d.prizes.each ? 'gift cards in the drawing' : 'in gift cards, in the drawing' }
      : { value: 'Gift cards', label: 'drawn the next morning' },
    { value: '2006', label: 'the first Walk/Ride Day' },
    { value: 'Free', label: 'nothing to sign up for' },
  ]
  return (
    <section className="relative overflow-x-clip bg-cream">
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="straight" />
        <div className="hidden md:block" />
        <div className="border-y border-navy/15 py-7">
          <dl className="grid grid-cols-2 gap-x-10 gap-y-5 md:grid-cols-4">
            {rows.map((r) => (
              <div key={r.label}>
                <dd className="font-serif text-[2rem] leading-none tracking-[-0.01em] text-navy md:text-[2.5rem]">{r.value}</dd>
                <dt className="mt-1 text-[13px] leading-snug text-ink-soft">{r.label}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[12px] text-ink-soft">
            Open to anyone 18 or older in Massachusetts with the Shift app. Up to three trips a day count toward the drawing.{' '}
            <Link href="/events/walk-ride-day/rules" className="font-semibold text-forest underline-offset-4 hover:underline">Official rules</Link>
          </p>
        </div>
      </div>
    </section>
  )
}

export default async function WalkRideDayPage() {
  const d = await loadWalkRideDays()
  const nextLabel = d.next ? weekdayDateET(d.next.startsAt) : null

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream">
        <PageHero
          eyebrow="Walk/Ride Day · since 2006"
          title={
            <>
              One Friday a month, Massachusetts <em className="text-green-deep">moves together.</em>
            </>
          }
          lede={
            <>
              Walk, bike, or ride the T on Walk/Ride Day. If you have the Shift app, every trip you take that day enters you in the month’s gift card drawing. Nothing to sign up for, and it’s free.
            </>
          }
        >
          {nextLabel && (
            <p className="mt-6 text-[1.0625rem] text-navy">
              <span className="font-semibold">{d.next?.active ? 'Today is Walk/Ride Day.' : `The next one is ${nextLabel}.`}</span>
              {d.moved && <span className="text-ink-soft"> Moved off the last Friday for the holiday.</span>}
            </p>
          )}
          {IS_LIVE && <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} tone="light" className="mt-6 [&>a]:max-[420px]:basis-full" />}
        </PageHero>

        <Ledger d={d} />

        <Section shape="wanderRight" id="how" className="scroll-mt-28">
          <SectionHeading title="How it works" lede="Three steps, and the last one happens on its own." />
          <ol className="grid gap-8 md:grid-cols-3 md:gap-10">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-forest/50 font-serif text-[1.1rem] text-forest">{i + 1}</span>
                <div>
                  <h3 className="font-serif text-[1.375rem] leading-tight text-navy">{s.title}</h3>
                  <p className="mt-2 text-[1.0625rem] leading-[1.65] text-ink-soft">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-[640px] text-[15px] leading-relaxed text-ink-soft">
            Walks, bike rides, buses, trains, and ferries all count, and carpools do too. The app detects them; there is nothing to log. Standings for the day live in the app’s Community tab.
          </p>
        </Section>

        <Section shape="wanderLeft" tone="white" width="read" id="dates" className="scroll-mt-28">
          <SectionHeading title="The next few" lede="Usually the last Friday of the month. When that lands on a holiday weekend, it moves a week earlier." />
          <ul className="border-t border-navy/15">
            {[d.next, ...d.later].filter((x): x is NonNullable<typeof x> => !!x).map((day, i) => (
              <li key={day.startsAt} className="flex items-baseline justify-between gap-4 border-b border-navy/15 py-4">
                <span className={`text-[1.0625rem] ${i === 0 ? 'font-semibold text-navy' : 'text-navy'}`}>{weekdayDateET(day.startsAt)}</span>
                <span className="shrink-0 text-[13px] text-ink-soft">{i === 0 ? (day.active ? 'today' : 'next') : 'prizes announced closer to the day'}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2">
            <ArrowLink href="/challenges">Everything running now</ArrowLink>
            <ArrowLink href="/events">Events that Friday</ArrowLink>
          </div>
        </Section>

        <Section shape="wanderRight" id="bring" className="scroll-mt-28">
          <SectionHeading title="Bring your people" lede="Walk/Ride Day started as a workplace thing in 2006. It still works best in groups." />
          <div className="grid gap-8 md:grid-cols-3 md:gap-10">
            {BRING.map((b) => (
              <div key={b.title}>
                <h3 className="font-serif text-[1.375rem] leading-tight text-navy">{b.title}</h3>
                <p className="mt-2 text-[1.0625rem] leading-[1.65] text-ink-soft">{b.body}</p>
                <ArrowLink href={b.href}>{b.label}</ArrowLink>
              </div>
            ))}
          </div>
        </Section>

        <Section shape="terminal" tone="white" width="read" closing id="join">
          <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.1] text-navy">
            {nextLabel ? <>See you {nextLabel}.</> : <>See you on the last Friday.</>}
          </h2>
          <p className="mt-4 max-w-[560px] text-[1.0625rem] leading-[1.65] text-ink-soft">
            Get the app before then and your first Walk/Ride Day trip counts. If you already have it, you’re set.
          </p>
          {IS_LIVE ? (
            <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} tone="light" className="mt-8 [&>a]:max-[420px]:basis-full" />
          ) : (
            <Link href="/shift" className={`${PILL} mt-8`}>Get the Shift app &rarr;</Link>
          )}
          <p className="mt-6 text-[13px] text-ink-soft">
            Questions, or want Walk/Ride Day at your workplace? <Link href="/contact?inquiry=general" className="font-semibold text-forest underline-offset-4 hover:underline">Get in touch</Link>.
          </p>
        </Section>
      </main>
      <Footer variant="light" />
    </>
  )
}
