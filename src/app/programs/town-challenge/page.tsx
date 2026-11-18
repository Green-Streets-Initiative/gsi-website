import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Bike, Bus, CircleCheck, Footprints, Landmark, MapPin, Megaphone, Satellite, Ship, TrainFront } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { getTownBySlug, getTownDirectory } from '@/lib/towns/queries'
import { CONTAINER, GSI_FONT } from '../../move-in/sign'
import PhoneFrame from '../../shift/_components/PhoneFrame'
import Actions from './Actions'
import { BOOK_URL } from './book'

/**
 * The Town Challenge, for city and town staff (persona `town-staff`). The
 * rideshare-fee and past-client emails link here with the town's slug
 * (?town=revere-ma), so the page speaks to that town. It prints as the
 * one-pager an official forwards to a colleague or a board.
 *
 * Keith 2026-11-12: no price or cost breakdown here (that goes in the
 * proposal after a call); the button says "Book a call"; residents reach
 * monthly goals (trips in 30 days, or a new way on 5 days) in place of a
 * Walk/Ride Day drawing; tell the Bella Mossa story the program comes from.
 * Not indexed until Keith approves it.
 */

export const metadata: Metadata = {
  title: 'Town Challenge for Massachusetts cities and towns | Green Streets Initiative',
  description:
    'A three-month spring challenge that gets residents walking, biking and taking the bus and train, with gift cards from local shops and a summary of residents’ trips for your state report.',
  robots: { index: false, follow: false },
}

export const revalidate = 3600

const HEAD = '[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] font-extrabold text-navy'
const SLUG = /^[a-z]+(?:-[a-z]+)*-ma$/

/** Bologna, by Marek Ślusarczyk (Tupungato), CC BY 3.0, Wikimedia Commons. */
const BOLOGNA_PHOTO =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/29_City_life_in_Medieval_Bologna%2C_Italy_-_pedestrians_and_cyclists_in_Italian_town.jpg/1280px-29_City_life_in_Medieval_Bologna%2C_Italy_-_pedestrians_and_cyclists_in_Italian_town.jpg'
const BOLOGNA_PHOTO_PAGE =
  'https://commons.wikimedia.org/wiki/File:29_City_life_in_Medieval_Bologna,_Italy_-_pedestrians_and_cyclists_in_Italian_town.jpg'
const BELLA_MOSSA_SOURCE = 'https://toolsofchange.com/en/case-studies/detail/724/'

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

/** The trips goal as a punch card: 12 holes, a month's worth of trips, partway done. */
function PunchCard() {
  return (
    <div className="inline-block rounded-[12px] border-2 border-dashed border-forest/40 bg-forest/[0.06] px-4 py-3 print:px-2 print:py-1.5" aria-hidden>
      <div className="grid grid-cols-6 gap-2 print:gap-1">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className={`h-6 w-6 rounded-full print:h-4 print:w-4 ${i < 8 ? 'bg-forest' : 'border-2 border-forest/40 bg-white'}`} />
        ))}
      </div>
      <p className="mt-2 text-[14px] font-bold text-forest print:text-[0.7rem]">8 of 12 trips</p>
    </div>
  )
}

/** The new-way goal as a month page: five different days marked. */
function MonthDays() {
  const marked: Partial<Record<number, typeof Bike>> = { 3: Bike, 9: TrainFront, 12: Bike, 18: Footprints, 24: TrainFront }
  return (
    <div className="inline-block rounded-[12px] border border-navy/15 bg-white px-3 py-3 print:px-2 print:py-1.5" aria-hidden>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 28 }, (_, i) => {
          const Icon = marked[i]
          return (
            <span key={i} className={`flex h-6 w-6 items-center justify-center rounded-[6px] print:h-4 print:w-4 ${Icon ? 'bg-forest text-white' : 'bg-navy/[0.06]'}`}>
              {Icon && <Icon className="h-3.5 w-3.5 print:h-2.5 print:w-2.5" />}
            </span>
          )
        })}
      </div>
      <p className="mt-2 text-[14px] font-bold text-forest print:text-[0.7rem]">5 different days this month</p>
    </div>
  )
}

/**
 * The scavenger-hunt add-on as a drawn loop. Keith 2026-11-13: it shows off the
 * town's walking, biking and transit (try the path, the bike lane, the bus or
 * shuttle, the ferry), not its sights.
 */
function RouteDrawing() {
  const stops: [number, number, typeof Bike, string, boolean][] = [
    [40, 110, Footprints, 'Path', true],
    [120, 34, Bike, 'Bike lane', true],
    [216, 64, Bus, 'Bus', true],
    [280, 140, Ship, 'Ferry', false],
  ]
  return (
    <figure className="mx-auto w-full max-w-[320px] print:max-w-[220px]" aria-hidden>
      <svg viewBox="0 0 320 190" className="w-full">
        <path d="M40 110 C 60 50, 90 30, 120 34 S 190 40, 216 64 S 300 100, 280 140 S 120 190, 40 110" fill="none" stroke="var(--color-forest)" strokeOpacity="0.45" strokeWidth="4" strokeDasharray="2 9" strokeLinecap="round" />
        {stops.map(([x, y, , label, done]) => (
          <g key={label}>
            <circle cx={x} cy={y} r="19" fill={done ? 'var(--color-forest)' : '#fff'} stroke="var(--color-forest)" strokeWidth="2.5" />
            <text x={x} y={y + 36} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-navy)">{label}</text>
          </g>
        ))}
      </svg>
      <div className="relative -mt-[calc(190/320*100%)] aspect-[320/190] w-full">
        {stops.map(([x, y, Icon, label, done]) => (
          <span key={label} className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center ${done ? 'text-white' : 'text-forest'}`} style={{ left: `${(x / 320) * 100}%`, top: `${(y / 190) * 100}%` }}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
        ))}
      </div>
      <p className="mt-1 text-center text-[14px] font-bold text-forest">3 of 4 tried</p>
    </figure>
  )
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
  const residents = town ? `${T} residents` : 'residents'

  const steps: [string, string][] = [
    ['Residents join Shift, our free app', 'Shift records their walks, bike rides and bus and train trips by GPS as they go.'],
    ['Each month, they go for a goal', `Residents who reach it get a gift card from a ${town ? T : 'local'} shop.`],
    ['In June, you get the results', `A one-page summary of the trips ${residents} made, for your state report or a grant.`],
  ]

  const goals: [ReactNode, string, string, string][] = [
    [<PunchCard key="p" />, '12 trips in a month', 'On foot, by bike or by bus and train: to work, to school, to the store.', 'For people who already walk, bike or take the bus sometimes and want to do it more.'],
    [<MonthDays key="m" />, 'A new way on 5 days', 'Walk, bike or take the bus somewhere on 5 different days, in a way they haven’t before: the first bike ride to the library, the first bus to work.', 'For people who usually get around another way.'],
  ]

  const app: [typeof TrainFront, string, string][] = [
    [TrainFront, 'Live bus and train times', 'The next departures from the stops near them.'],
    [Bike, 'Bike-friendly routes', 'The calmer streets and paths, and bike share where there is one.'],
    [MapPin, `What’s on in ${T}`, 'Local walks, rides and events, and a town page.'],
    [Satellite, 'Trips counted by GPS', 'Each trip with its distance and how they got there.'],
  ]

  const weDo = [
    `Set up the challenge with ${T}’s name and goals`,
    'Print about 500 posters and flyers with a QR code to join',
    'Promote it by email, app notices, social posts and free Google ads',
    `Bring a table to one ${T} event`,
    `Buy the gift cards from ${town ? T : 'local'} shops and send them`,
    'Write the results summary',
    `Set up a scavenger hunt of ${T}’s paths, bike lanes and buses, if you want one`,
  ]
  const youDo = [
    'Share the announcement on your website, newsletter and social media',
    'Pick one event for our table',
    'Choose the months and the goals with us',
  ]

  const questions: [string, ReactNode][] = [
    ['What does it cost?', 'It depends on the months, the goals and how many gift cards you want. After a call we send a short proposal with the cost.'],
    [
      'Can our Uber and Lyft fee money pay for it?',
      <>It can go in your December 31 report as a planned use. State law lets cities and towns spend it on &ldquo;programs that support alternative modes of transportation&rdquo; (Chapter 187 of the Acts of 2016, Section 8), and your finance office confirms what the fund pays for.</>,
    ],
    ['Which months?', 'Any three months in a row. Spring, March through May, is the next one.'],
    ['What’s in the summary?', `How many ${residents} took part, the trips they made and how far, and how they got around.`],
    ['What languages?', 'Posters and flyers come in English, Spanish and Portuguese. The app also works in Chinese.'],
    ['Can local businesses help?', `Yes. A bank, credit union or shop can give gift cards or sponsor the challenge, and we thank them by name on the posters and in the summary.`],
  ]

  return (
    <div className="street min-h-screen bg-cream text-navy print:[zoom:0.85]" style={{ fontFamily: GSI_FONT }}>
      <div className="print:hidden">
        <Nav variant="light" street />
      </div>

      {/* Hero: what it is, for whom, and the yes. */}
      <section className="bg-cream pt-[60px] print:pt-0">
        <div className={`${CONTAINER} pb-4 pt-6 md:pt-10 print:pb-0 print:pt-0`}>
          <div className="grid items-center gap-8 rounded-[24px] bg-forest px-5 pb-8 pt-7 text-white sm:px-10 sm:pb-10 sm:pt-9 md:grid-cols-[1fr_230px] lg:gap-12 print:block print:rounded-[14px] print:px-6 print:pb-5 print:pt-5">
            <div>
              <p className="text-[1rem] font-bold text-white/90">
                {town ? `For ${T} staff` : 'For Massachusetts city and town staff'} · Town Challenge
              </p>
              <h1 className="mt-4 [font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(2rem,4.4vw,3.125rem)] font-extrabold leading-[1.04] tracking-[-0.01em] text-white print:mt-2 print:text-[1.75rem]">
                A spring challenge that gets {town ? `${T} residents` : 'your residents'} walking, biking and taking the bus and train
              </h1>
              <p className="mt-5 max-w-[620px] text-[1.125rem] leading-[1.55] text-white/90 print:mt-2 print:text-[0.95rem]">
                Each month for three months, {residents} who reach a walking, biking or bus and train goal get a gift card
                from a {town ? T : 'local'} shop. Green Streets runs it, and in June you get a summary of their trips.
              </p>
              <div className="mt-7 print:hidden">
                <Actions town={town?.name ?? null} slug={town?.slug ?? null} light />
              </div>
            </div>
            {/* What a resident sees: a challenge in Shift with its gift card. */}
            <figure className="mx-auto w-[150px] md:w-[230px] print:hidden">
              <PhoneFrame
                src="/images/shift-app/employer-prizes-2026-10.png"
                alt="A challenge in Shift: a $15 gift card a member won for reaching the trip goal"
                className="w-full"
                priority
              />
              <figcaption className="mt-3 text-center text-[14px] leading-snug text-white/85">
                A challenge in Shift this fall. {town ? `${T}’s` : 'Your town’s'} shows {town ? 'its' : 'your'} name and goals.
              </figcaption>
            </figure>
          </div>
          <ul className="mt-4 flex flex-col gap-2 text-[15px] font-bold text-navy sm:flex-row sm:flex-wrap print:mt-2 print:flex-row print:text-[12px]">
            {[
              [Landmark, 'A planned use for your Uber and Lyft fee money', '#questions'],
              [Megaphone, 'Posters in English, Spanish and Portuguese', null],
              [CircleCheck, 'Green Streets does the work', '#who'],
            ].map(([I, t, href]) => {
              const Icon = I as typeof Landmark
              const inner = <><Icon className="h-4 w-4 shrink-0 text-forest" aria-hidden /> {t as string}</>
              return (
                <li key={t as string}>
                  {href ? (
                    <a href={href as string} className="flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 py-2.5 hover:underline print:py-1.5">{inner}</a>
                  ) : (
                    <span className="flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 py-2.5 print:py-1.5">{inner}</span>
                  )}
                </li>
              )
            })}
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
          {[['#how', 'How it works', 'inline-flex'], ['#goals', 'The goals', 'inline-flex'], ['#bologna', 'Bologna', 'hidden sm:inline-flex'], ['#who', 'Who does what', 'hidden sm:inline-flex'], ['#questions', 'Questions', 'inline-flex']].map(([href, label, display]) => (
            <a key={href} href={href} className={`${display} min-h-[44px] items-center font-bold text-forest underline-offset-4 hover:underline`}>{label}</a>
          ))}
          <a href={BOOK_URL} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex min-h-[44px] items-center font-bold text-navy underline underline-offset-4">Book a call</a>
        </div>
      </nav>

      <main className={CONTAINER}>
        <Section id="how" title="How it works">
          <ol className="grid gap-4 md:grid-cols-3 print:grid-cols-3 print:gap-3">
            {steps.map(([t, b], i) => (
              <li key={t} className="rounded-[18px] border border-navy/10 bg-white px-5 py-5 print:break-inside-avoid print:px-3 print:py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-forest text-[1.125rem] font-extrabold text-white print:h-7 print:w-7 print:text-[0.95rem]">{i + 1}</span>
                <p className="mt-4 text-[1.125rem] font-bold text-navy print:mt-2 print:text-[0.95rem]">{t}</p>
                <p className="mt-1 text-[1.0625rem] leading-[1.55] text-navy/80 print:text-[0.85rem] print:leading-snug">{b}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* The goals: what a resident sets out to do each month, and what reaching it looks like in the app. */}
        <Section
          id="goals"
          title="The goals"
          lede={`Each month residents can go for either goal, or both. Shift shows how close they are, and the gift card arrives in the app when they reach it.`}
          className="border-t border-navy/10"
        >
          <ul className="grid gap-4 md:grid-cols-2 print:grid-cols-2 print:gap-3">
            {goals.map(([picture, t, b, who]) => (
              <li key={t} className="rounded-[18px] bg-white px-6 py-6 print:break-inside-avoid print:px-4 print:py-3">
                {picture}
                <p className={`${HEAD} mt-5 text-[1.5rem] leading-tight print:mt-2 print:text-[1.1rem]`}>{t}</p>
                <p className="mt-2 text-[1.0625rem] leading-[1.55] text-navy/85 print:text-[0.85rem]">{b}</p>
                <p className="mt-3 text-[15px] leading-[1.5] text-navy/75 print:text-[0.75rem]">{who}</p>
              </li>
            ))}
          </ul>
          {/* The rec option: a scavenger hunt of the town's paths, bike lanes, buses, shuttles and ferry. */}
          <div className="mt-4 grid items-center gap-6 rounded-[18px] border-2 border-dashed border-forest/35 bg-white px-6 py-6 md:grid-cols-[1fr_320px] print:break-inside-avoid print:grid-cols-[1fr_220px] print:px-4 print:py-3">
            <div>
              <p className="text-[15px] font-bold text-forest">Optional, for weekends and families</p>
              <p className={`${HEAD} mt-1 text-[1.5rem] leading-tight print:text-[1.1rem]`}>A scavenger hunt of {town ? `${T}’s` : 'your town’s'} ways to get around</p>
              <p className="mt-2 max-w-[560px] text-[1.0625rem] leading-[1.55] text-navy/85 print:text-[0.85rem]">
                Walk or bike the path, try the new bike lane, ride a bus or shuttle, take the ferry. Shift checks off each one,
                and residents who try them all get a gift card.
              </p>
              <p className="mt-3 text-[15px] leading-[1.5] text-navy/75 print:text-[0.75rem]">For people who don’t commute, and for anyone new in town.</p>
            </div>
            <RouteDrawing />
          </div>
        </Section>

        {/* Where the idea comes from. */}
        <section id="bologna" className="scroll-mt-28 -mx-6 bg-[#191A2E] px-6 py-12 text-white sm:mx-0 sm:rounded-[24px] sm:px-10 md:py-14 print:mx-0 print:rounded-[14px] print:px-6 print:py-4 print:break-inside-avoid">
          <div className="grid items-center gap-10 md:grid-cols-[1fr_300px] print:grid-cols-[1fr]">
            <div>
              <p className="text-[15px] font-bold text-[#BAF14D]">The inspiration</p>
              <h2 className="mt-2 [font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(1.75rem,3.4vw,2.375rem)] font-extrabold leading-[1.08] text-white print:text-[1.375rem]">
                Bologna’s Bella Mossa
              </h2>
              <p className="mt-4 max-w-[600px] text-[1.0625rem] leading-[1.65] text-white/85 print:mt-1 print:text-[0.85rem]">
                In 2017, Bologna, Italy asked its residents to walk, bike and take the bus more for six months. An app called
                Bella Mossa (&ldquo;good move&rdquo;) recorded their trips, and every trip added points they could spend at 85
                local businesses, from bike shops and bookstores to movie theaters.
              </p>
              <dl className="mt-7 grid max-w-[600px] grid-cols-3 gap-4 print:mt-2">
                {[['15,000', 'residents took part'], ['895,000', 'trips on foot, by bike and by bus'], ['77%', 'said it got them walking more']].map(([n, l]) => (
                  <div key={l}>
                    <dt className="[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(1.5rem,3vw,2.125rem)] font-extrabold text-[#BAF14D] print:text-[1.2rem]">{n}</dt>
                    <dd className="mt-1 text-[15px] leading-snug text-white/80 print:text-[0.75rem]">{l}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-7 max-w-[600px] text-[1.0625rem] leading-[1.65] text-white/85 print:mt-2 print:text-[0.85rem]">
                The Town Challenge brings the same idea to a Massachusetts city or town, with Shift as the app and gift cards from
                {town ? ` ${T}` : ' your'} shops as the reward.
              </p>
              <p className="mt-4 text-[14px] text-white/75 print:hidden">
                Results from the{' '}
                <a href={BELLA_MOSSA_SOURCE} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Tools of Change case study</a>.
              </p>
            </div>
            <figure className="print:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BOLOGNA_PHOTO} alt="People walking and biking down a narrow street in Bologna" className="aspect-[2/3] w-full rounded-[18px] object-cover" loading="lazy" />
              <figcaption className="mt-2 text-[13px] text-white/75">
                Bologna. Photo:{' '}
                <a href={BOLOGNA_PHOTO_PAGE} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Marek Ślusarczyk, CC BY 3.0</a>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* What residents get: the app is the reason a resident joins, so show it. */}
        <Section id="app" title="What residents get in Shift" lede={`A free app that makes the buses, trains and bike routes ${town ? `${T} already has` : 'you already have'} easier to use.`}>
          <div className="grid items-center gap-10 md:grid-cols-[1fr_auto] print:grid-cols-[1fr] print:gap-3">
            <ul className="grid gap-5 sm:grid-cols-2 print:grid-cols-4 print:gap-2">
              {app.map(([I, t, b]) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest print:h-7 print:w-7"><I className="h-5 w-5 print:h-4 print:w-4" aria-hidden /></span>
                  <div>
                    <p className="text-[1.0625rem] font-bold text-navy print:text-[0.85rem]">{t}</p>
                    <p className="mt-0.5 text-[15px] leading-[1.5] text-navy/80 print:hidden">{b}</p>
                  </div>
                </li>
              ))}
            </ul>
            <figure className="mx-auto print:hidden">
              <PhoneFrame
                src="/images/shift-app/around-you.png"
                alt="Shift's What's near you screen: a map of nearby stops and paths, and the next buses and trains"
                className="w-[220px]"
              />
              <figcaption className="mt-3 max-w-[220px] text-center text-[14px] leading-snug text-navy/75">What&rsquo;s near you, in Shift</figcaption>
            </figure>
          </div>
          <p className="mt-6 text-[15px] text-navy/75 print:hidden">On iPhone and Android, in English, Spanish, Portuguese and Chinese.</p>
        </Section>

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

        <Section id="questions" title="Questions" className="border-t border-navy/10">
          <dl className="grid gap-x-10 gap-y-6 md:grid-cols-2 print:grid-cols-2 print:gap-x-6 print:gap-y-2">
            {questions.map(([q, a]) => (
              <div key={q} className="print:break-inside-avoid">
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
            Book a call and we’ll talk through the months, the goals and the event for our table. Then we send a short proposal.
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
