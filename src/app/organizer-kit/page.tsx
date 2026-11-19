import type { Metadata } from 'next'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { Check, MessageSquareText, X } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { BUTTON, CONTAINER, GSI_FONT } from '../move-in/sign'
import KitNav from './KitNav'

/**
 * The organizer kit: a private page for the ride and walk organizers Green
 * Streets invites to the pilot. Reached only from the invitation, so it is
 * noindex, unlisted and not in the sitemap. It speaks as Green Streets, never
 * as one person (Keith 2026-11-18).
 *
 * Shape (rebuilt 2026-11-09, polished 2026-11-18):
 *  - The ride from start to finish: the questions every organizer fields,
 *    each with what Shift does and a picture. Ride day (where the group is)
 *    is the wide band in the middle, written as today vs with Shift, since
 *    it saves the most work: today the organizer shares a location in the
 *    group chat by hand, or riders ask each other to.
 *  - What only Shift does, with real data: the route's bike lanes street by
 *    street, real Bicycle Benefits members near Davis Square, the assistant.
 *  - How it fits with the tools they use, the pilot, short facts.
 *
 * Words are concrete (Keith 2026-11-18): name the bike lane (protected,
 * painted, none), never "calm"; say what a feature does, not a label for it.
 * Body text is 17px.
 *
 * The invitation links here with the organizer's personal console link
 * (/organizer-kit?link=…), so the button opens their ride, filled in from
 * their calendar listing (01588). Quotes come from organizers who said yes
 * to being quoted after their first date (01595, get_organizer_quotes).
 * Screenshots are from made-up test rides with made-up people.
 */

export const metadata: Metadata = {
  title: 'Organizer kit | Shift by Green Streets',
  description: 'Free tools for people who lead group rides and walks in Massachusetts.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const HEAD = '[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] font-extrabold text-navy'
const BODY = 'text-[17px] leading-[1.5] text-navy/85'

const SECTIONS: [string, string][] = [
  ['start', 'Start to finish'],
  ['only', 'Only on Shift'],
  ['tools', 'Your other tools'],
  ['pilot', 'The pilot'],
  ['facts', 'Good to know'],
]

/** The route in route.jpg (Mattapan to Roslindale, 4.8 mi: 2.1 protected, 2.1 painted, 0.5 with no bike lane). Same colors as the ride page. */
const LANES: { label: string; pct: number; color: string }[] = [
  { label: 'Protected bike lane', pct: 45, color: '#2DD4BF' },
  { label: 'Painted bike lane', pct: 45, color: '#7FB5FF' },
  { label: 'No bike lane', pct: 10, color: '#B4BAD2' },
]

/** Bicycle Benefits members within a few blocks of Davis Square (the program's own list, 2026-11-09). */
const PERKS: { name: string; perk: string }[] = [
  { name: 'Redbones', perk: 'Free soft drink' },
  { name: 'Flatbread Company', perk: '10% off' },
  { name: 'Bike Boom', perk: '10% off accessories' },
  { name: 'Dave’s Fresh Pasta', perk: '5% off' },
]

/** How Shift sits next to what organizers use now. */
const TOOLS: { tool: string; keep: string; shift: string }[] = [
  { tool: 'Meetup or a Facebook event', keep: 'Getting found by members', shift: 'Put your Shift link in the event for the route and the turnout count.' },
  { tool: 'Instagram', keep: 'Getting seen by your followers', shift: 'Shift makes a post or Story image with a QR code.' },
  { tool: 'Partiful', keep: 'Invites and RSVPs', shift: 'Keep them there. Add your Shift link for the route and live map, and a head count after the ride.' },
  { tool: 'Your group chat', keep: 'Talking with your regulars', shift: 'Shift sends newcomers your chat link once they RSVP.' },
  { tool: 'Strava, Ride with GPS, Komoot, Garmin', keep: 'Drawing and recording rides', shift: 'Bring a route in, or send it out as a GPX file.' },
]

/** Ride day, the way it goes today and the way it goes with Shift. */
/** The three benefits under the headline, each with what delivers it. */
const BENEFITS: [string, string][] = [
  ['More people find your ride.', 'It goes on our events calendar and on the home screen of Shift members who live nearby.'],
  ['Less time planning.', 'Ask the assistant for a 10-mile loop on bike lanes and it draws the route. Post a change once and everyone coming gets it.'],
  ['Easier for everyone who comes.', 'People say they’re coming from any browser, late riders see on the map where the group is, and everyone adds photos to one album.'],
]

const TODAY = [
  'You open your map app and share your location by hand.',
  'You paste it in the group chat, every ride.',
  'Late riders text the group, or ask someone else to share theirs.',
]
const WITH_SHIFT = [
  'Turn sharing on once. Every ride day, your phone shares the group’s spot from start to finish.',
  'Everyone going sees the group on the ride page, in the app or a web browser.',
  'Running late? Shift shows a spot on the route to meet the group, with directions.',
]

/** Free here, paid on other ride apps (checked on their own pages, November 2026). */
const FREE = ['RSVPs and reminders', 'Weekly ride dates', 'The group’s location for everyone going', 'A page for your group']

/** A personal console link from the invitation, passed through to the button. */
function linkFrom(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v
  return s && /^[A-Za-z0-9_-]{8,128}$/.test(s) ? s : null
}

async function sharedQuotes(): Promise<{ quote: string; shown_name: string }[]> {
  try {
    const { data } = await createServerSupabaseClient().rpc('get_organizer_quotes')
    return (data as { quote: string; shown_name: string }[] | null) ?? []
  } catch {
    return []
  }
}

/*
 * Each step's picture is the screen it stands for, drawn at card size with
 * the numbers from the real screens (public/organizer-kit/*.jpg): a full
 * screenshot shrunk to 200px can't be read (polish pass 2026-11-09).
 */
const ART = 'flex h-[176px] flex-col justify-center gap-2.5 rounded-[12px] bg-cream px-4'

/** The week before: a planned route and its bike lanes. */
function RouteArt() {
  return (
    <div className={ART} aria-hidden>
      <svg viewBox="0 0 200 64" className="h-[70px] w-full">
        <rect width="200" height="64" rx="8" fill="#EEF2E6" />
        <path d="M18 50 L46 40 L70 42 L96 24 L128 28 L152 14 L182 12" fill="none" stroke="#2DD4BF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M128 28 L152 14" fill="none" stroke="#7FB5FF" strokeWidth="5" strokeLinecap="round" />
        <circle cx="18" cy="50" r="6" fill="#191A2E" />
        <circle cx="182" cy="12" r="5" fill="#191A2E" />
      </svg>
      <div className="flex items-baseline justify-between text-navy">
        <span className="text-[17px] font-bold">4.8 mi</span>
        <span className="text-[17px] font-extrabold text-forest">90% in bike lanes</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        <span className="w-[45%] bg-[#2DD4BF]" /><span className="w-[45%] bg-[#7FB5FF]" /><span className="w-[10%] bg-[#B4BAD2]" />
      </div>
    </div>
  )
}

/** The week before: one list of who's coming. */
function ListArt() {
  return (
    <div className={ART} aria-hidden>
      <div className="grid grid-cols-2 gap-1 text-center text-navy">
        {[['7', 'Going'], ['2', 'Maybe']].map(([n, k]) => (
          <p key={k}><span className="block text-[26px] font-extrabold leading-none">{n}</span><span className="text-[15px] font-semibold">{k}</span></p>
        ))}
      </div>
      <ul className="flex flex-col gap-1.5 border-t border-navy/10 pt-2.5">
        {['Maria G.', 'Aisha K.'].map((n) => (
          <li key={n} className="flex items-center gap-2 text-[16px] text-navy">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy/[0.08] text-[13px] font-bold">{n[0]}</span>{n}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Ride morning: the update people get, drawn like the notification. */
function NoticeArt() {
  return (
    <div className="flex h-[176px] flex-col justify-center gap-2.5 rounded-[12px] bg-navy px-4 text-white" aria-hidden>
      <div className="rounded-[12px] bg-white/[0.12] px-3.5 py-3">
        <p className="text-[15px] font-bold text-white/75">Shift · now</p>
        <p className="mt-0.5 text-[17px] font-bold leading-snug">It&rsquo;s on!</p>
        <p className="text-[16px] leading-snug text-white/85">See you at Davis Square at 10.</p>
      </div>
      <p className="px-1 text-[15px] text-white/75">Sent to 9 people</p>
    </div>
  )
}

/** After: turnout, counted for you. */
function TurnoutArt() {
  return (
    <div className={ART} aria-hidden>
      <p className="px-1 text-[16px] font-bold text-navy/80">October</p>
      {[['14', 'came', 'bg-lime'], ['9', 'came for the first time', 'bg-navy/[0.06]']].map(([n, k, c]) => (
        <p key={k} className={`flex items-baseline gap-2 rounded-[10px] px-3 py-2 text-navy ${c}`}>
          <span className="text-[28px] font-extrabold leading-none">{n}</span><span className="text-[16px] font-bold leading-tight">{k}</span>
        </p>
      ))}
    </div>
  )
}

/** After: the date's shared album, drawn like the ride page's photos card with real ride and walk photos (credited at the foot of the page). */
const ALBUM = ['album-group-ride.jpg', 'album-common-walk.jpg', 'album-city-hall.jpg', 'album-minuteman.jpg', 'album-comm-ave.jpg']
function AlbumArt() {
  return (
    <div className={ART} aria-hidden>
      <p className="flex items-baseline justify-between px-1 text-navy">
        <span className="text-[16px] font-bold">Saturday&rsquo;s photos</span>
        <span className="text-[15px] font-semibold text-navy/75">23</span>
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {ALBUM.map((f) => (
          <span key={f} className="relative h-[56px] overflow-hidden rounded-[6px]">
            <Image src={`/organizer-kit/${f}`} alt="" fill className="object-cover" sizes="120px" />
          </span>
        ))}
        <span className="flex h-[56px] items-center justify-center rounded-[6px] border border-dashed border-navy/30 text-[15px] font-bold text-navy">+ Add</span>
      </div>
    </div>
  )
}

/** Pilot step 2: one link, posted where the group already looks. */
function ShareArt() {
  return (
    <div className={ART} aria-hidden>
      <p className="truncate rounded-full border border-navy/15 bg-white px-3.5 py-2 text-[15px] font-bold text-navy">gogreenstreets.org/rides/your-ride</p>
      {['Your Meetup event', 'An Instagram Story', 'The group chat'].map((p) => (
        <p key={p} className="flex items-center gap-2 px-1 text-[16px] font-semibold text-navy">
          <Check className="h-4 w-4 text-forest" aria-hidden />{p}
        </p>
      ))}
    </div>
  )
}

/** The pilot's three steps, each with the screen it happens on (made-up ride; real console screens). */
const PILOT: { title: string; body: string; art: ReactNode }[] = [
  {
    title: 'Set up one ride',
    body: 'Your link opens it filled in. Add the route and save.',
    art: (
      <span className="relative block h-[176px] overflow-hidden rounded-[12px] border border-navy/10">
        <Image src="/organizer-kit/setup-step.jpg" alt="The organizer console's ride form on step 1 of 6, with the ride's page shown beside it as you type" fill className="object-cover object-left-top" sizes="(min-width: 768px) 340px, 90vw" />
      </span>
    ),
  },
  {
    title: 'Share your ride’s link',
    body: 'Wherever you post now: Meetup, Instagram, the group chat.',
    art: <ShareArt />,
  },
  {
    title: 'Tell us how it went',
    body: 'Three questions after your first ride. Your answers shape what we build.',
    art: (
      <span className="relative block h-[176px] overflow-hidden rounded-[12px] border border-navy/10">
        <Image src="/organizer-kit/feedback.jpg" alt="The feedback card after a first ride: how did it go, what should we fix, what would you tell another organizer" fill className="object-cover object-top" sizes="(min-width: 768px) 340px, 90vw" />
      </span>
    ),
  },
]

type Stage = { when: string; ask: string; does: string; art: ReactNode }

/** Before ride day. */
const BEFORE: Stage[] = [
  {
    when: 'The week before',
    ask: 'Which streets are OK for beginners?',
    does: 'Plan a route on bike lanes and paths, or bring yours and see which streets have them.',
    art: <RouteArt />,
  },
  {
    when: 'The week before',
    ask: 'Who’s actually coming?',
    does: 'People answer on your ride page with a name and email. No app needed.',
    art: <ListArt />,
  },
  {
    when: 'Ride morning',
    ask: 'Is it still on?',
    does: 'Post “It’s on” or a change once, and everyone coming gets a notification or an email.',
    art: <NoticeArt />,
  },
]

/** After the ride. */
const AFTER: Stage[] = [
  {
    when: 'After',
    ask: 'How many came this year?',
    does: 'Shift counts who came and who was new, month by month.',
    art: <TurnoutArt />,
  },
  {
    when: 'After',
    ask: 'Can someone send me the photos?',
    does: 'Each date gets one shared album that everyone who came can add to.',
    art: <AlbumArt />,
  },
]

function StageCard({ s }: { s: Stage }) {
  return (
    <li className="flex w-[80vw] max-w-[320px] shrink-0 snap-start flex-col gap-3 rounded-[18px] border border-navy/10 bg-white p-3 pb-5 sm:w-auto sm:max-w-none print:break-inside-avoid">
      {s.art}
      <div className="px-1">
        <p className="text-[15px] font-bold text-forest">{s.when}</p>
        <p className="mt-1 text-[1.25rem] font-extrabold leading-snug text-navy">&ldquo;{s.ask}&rdquo;</p>
        <p className={`mt-1.5 ${BODY}`}>{s.does}</p>
      </div>
    </li>
  )
}

/** A row of stage cards: a swipe row on phones (the next card peeks in), a grid from tablet width. */
const ROW = '-mx-6 flex snap-x snap-mandatory scroll-pl-6 gap-4 overflow-x-auto px-6 pb-2 [scrollbar-width:thin] sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 print:grid'

function Start({ link, light }: { link: string | null; light?: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
      <a href={consoleHref(link)} className={`${BUTTON} ${light ? '!bg-white !text-navy' : ''} shrink-0 print:hidden`}>
        Set up my ride
      </a>
      <p className={`max-w-[460px] text-[17px] leading-snug ${light ? 'text-white/85' : 'text-navy/80'}`}>
        {link
          ? 'It opens filled in from our events calendar.'
          : 'Use the link in your invitation. It opens your ride filled in.'}
      </p>
    </div>
  )
}

function consoleHref(link: string | null): string {
  return link ? `/organizers?link=${encodeURIComponent(link)}` : '/organizers'
}

function Section({ id, title, children, className = '' }: { id: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-[124px] border-t border-navy/10 py-10 md:py-14 print:py-6 ${className}`}>
      <h2 className={`${HEAD} text-[clamp(1.75rem,3.4vw,2.5rem)] leading-[1.1] print:break-after-avoid`}>{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  )
}

export default async function OrganizerKitPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const link = linkFrom((await searchParams).link)
  const quotes = await sharedQuotes()

  return (
    <div className="street min-h-screen bg-white text-navy" style={{ fontFamily: GSI_FONT }}>
      <div className="print:hidden">
        <Nav variant="light" street />
      </div>

      {/* Room for the fixed site nav; the section menu sticks under it. */}
      <div className="h-[60px] print:hidden" />
      <KitNav sections={SECTIONS} href={consoleHref(link)} />

      {/*
        Hero, in the website's Nov 17 look (Direction A): white ground, the
        green sign only as a short label, and on the first phone screen what
        it is, one button and a photo of people meeting up for a ride.
      */}
      {/*
        Benefits first, each with the thing that delivers it (Keith
        2026-11-19: "orient around the benefits more than the features").
        The photo carries why GSI builds this, so the reason sits on the
        first screen next to a real group ride. On phones the photo comes
        right after the headline; the sticky bar carries the button.
      */}
      <header className={`${CONTAINER} pt-6 md:pt-10`}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:gap-x-12 lg:gap-y-5">
          <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
            <p className="inline-block rounded-[8px] bg-forest px-3 py-1 text-[16px] font-bold text-white">Free for ride and walk organizers</p>
            <h1 className={`${HEAD} mt-3 text-[clamp(2.125rem,4.8vw,3.125rem)] leading-[1.05] tracking-[-0.01em]`}>
              Rides that are easier to find, easier to plan and easier to join
            </h1>
          </div>
          <figure className="overflow-hidden rounded-[18px] border border-navy/10 bg-white lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
            <div className="relative h-[190px] sm:h-[280px] lg:h-[330px]">
              <Image src="/organizer-kit/walk-ride-day-2014.jpg" alt="Riders meeting up on Boston City Hall Plaza before a Walk/Ride Day ride" fill priority className="object-cover object-[50%_60%]" sizes="(min-width: 1024px) 480px, 100vw" />
            </div>
            <figcaption className="px-4 pb-3 pt-2.5">
              <p className="text-[17px] leading-snug text-navy">
                <strong>Why we build this:</strong> a group ride is one of the best ways people get comfortable and confident biking to work, school and errands.
              </p>
              <p className="mt-1 text-[14px] text-navy/75">Walk/Ride Day, Boston. Photo: MassDOT</p>
            </figcaption>
          </figure>
          <div className="lg:col-start-1 lg:row-start-2">
            <ul className="flex max-w-[580px] flex-col gap-3">
              {BENEFITS.map(([lead, rest]) => (
                <li key={lead} className="text-[18px] leading-[1.45] text-navy/85">
                  <strong className="text-navy">{lead}</strong> {rest}
                </li>
              ))}
            </ul>
            <div className="mt-5"><Start link={link} /></div>
          </div>
        </div>
      </header>

      <main className={CONTAINER}>
        {/* The framework the page leads with: the ride from start to finish. */}
        <section id="start" className="scroll-mt-[124px] pb-10 pt-8 md:pt-12 print:py-4">
          <h2 className={`${HEAD} text-[clamp(1.75rem,3.4vw,2.5rem)] leading-[1.1]`}>Your ride, start to finish</h2>
          <ol className={`${ROW} mt-6 sm:grid-cols-3 print:grid-cols-3`}>
            {BEFORE.map((s) => <StageCard key={s.ask} s={s} />)}
          </ol>

          {/* Ride day: what it takes today, and what Shift does on its own. */}
          <div className="mt-5 rounded-[18px] border border-navy/10 bg-white p-5 sm:p-7 print:break-inside-avoid">
            <p className="text-[15px] font-bold text-forest">At the meetup</p>
            <h3 className={`${HEAD} mt-1 text-[clamp(1.5rem,2.8vw,2rem)] leading-[1.15]`}>Nobody has to text &ldquo;where are you guys?&rdquo;</h3>
            <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,250px)] md:items-start lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,280px)]">
              <div className="rounded-[14px] bg-navy/[0.05] p-5">
                <p className="text-[19px] font-extrabold text-navy">Today</p>
                <ul className="mt-3 flex flex-col gap-3">
                  {TODAY.map((t) => (
                    <li key={t} className="flex gap-2.5 text-[17px] leading-[1.45] text-navy/85">
                      <X className="mt-1 h-5 w-5 shrink-0 text-navy/60" aria-hidden />{t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[14px] bg-lime/40 p-5">
                <p className="text-[19px] font-extrabold text-navy">With Shift, on its own</p>
                <ul className="mt-3 flex flex-col gap-3">
                  {WITH_SHIFT.map((t) => (
                    <li key={t} className="flex gap-2.5 text-[17px] leading-[1.45] text-navy">
                      <Check className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />{t}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-navy/10 pt-3 text-[16px] leading-[1.45] text-navy/85">Whoever leads carries a phone with the Shift app. Nobody else needs it.</p>
              </div>
              <figure className="mx-auto w-full max-w-[250px] overflow-hidden rounded-[22px] border-[6px] border-navy bg-navy md:max-w-none">
                <Image src="/organizer-kit/live-group.jpg" width={640} height={723} alt="The Shift app's live ride screen: the group's bike marker on the route map, marked Live and updated 8 seconds ago" className="h-auto w-full" sizes="280px" />
              </figure>
            </div>
          </div>

          <ol className={`${ROW} mt-5 sm:grid-cols-2 print:grid-cols-2`}>
            {AFTER.map((s) => <StageCard key={s.ask} s={s} />)}
          </ol>
        </section>

        {/* What only Shift does, each shown with real data. */}
        <Section id="only" title="What you get only on Shift">
          {/* Side by side; on phones one row that scrolls sideways, so the page stays short. */}
          <div className="-mx-6 flex snap-x snap-mandatory scroll-pl-6 gap-4 overflow-x-auto px-6 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-5 lg:overflow-visible lg:px-0 print:grid print:grid-cols-3">
            <div className="w-[84vw] max-w-[380px] shrink-0 snap-start rounded-[18px] border border-navy/10 bg-white p-5 lg:w-auto lg:max-w-none print:break-inside-avoid">
              <p className="text-[1.375rem] font-extrabold leading-snug">The bike lanes on every street of your route</p>
              <p className={`mt-2 ${BODY}`}>
                Protected, painted or none, from MassDOT and OpenStreetMap, with busy crossings and hills marked.
              </p>
              <div className="relative mt-4 h-[170px] overflow-hidden rounded-[14px] border border-navy/10">
                <Image src="/organizer-kit/route.jpg" alt="A route planned in the organizer console, each stretch colored by its kind of bike lane" fill className="object-cover object-[50%_58%]" sizes="(min-width: 1024px) 340px, 90vw" />
              </div>
              <div className="mt-3 rounded-[14px] bg-cream p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[17px] font-bold">Mattapan to Roslindale</p>
                  <p className="text-[17px] font-bold text-navy/80">4.8 mi</p>
                </div>
                <p className="mt-0.5 text-[1.375rem] font-extrabold text-forest">90% in bike lanes</p>
                <div className="mt-3 flex h-3 overflow-hidden rounded-full" role="img" aria-label="45% protected bike lane, 45% painted bike lane, 10% no bike lane">
                  {LANES.map((c) => <span key={c.label} style={{ width: `${c.pct}%`, background: c.color }} />)}
                </div>
                <ul className="mt-2.5 flex flex-col gap-1 text-[16px] text-navy/85">
                  {LANES.map((c) => (
                    <li key={c.label} className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: c.color }} aria-hidden />{c.label} {c.pct}%
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="w-[84vw] max-w-[380px] shrink-0 snap-start rounded-[18px] border border-navy/10 bg-white p-5 lg:w-auto lg:max-w-none print:break-inside-avoid">
              <p className="text-[1.375rem] font-extrabold leading-snug">Discounts near your meeting spot</p>
              <p className={`mt-2 ${BODY}`}>
                Shops in the Bicycle Benefits program show on your ride page.
              </p>
              <div className="mt-4 rounded-[14px] bg-cream p-4">
                <p className="text-[17px] font-bold">Near Davis Square</p>
                <ul className="mt-2 divide-y divide-navy/10">
                  {PERKS.map((p) => (
                    <li key={p.name} className="flex items-center justify-between gap-3 py-2.5 text-[17px]">
                      <span className="min-w-0 truncate">{p.name}</span>
                      <span className="shrink-0 rounded-full bg-lime px-3 py-0.5 text-[15px] font-bold text-navy">{p.perk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="w-[84vw] max-w-[380px] shrink-0 snap-start rounded-[18px] border border-navy/10 bg-white p-5 lg:w-auto lg:max-w-none print:break-inside-avoid">
              <p className="text-[1.375rem] font-extrabold leading-snug">Ask the assistant to do it for you</p>
              <p className={`mt-2 ${BODY}`}>
                It asks before it changes anything.
              </p>
              <div className="mt-4 flex flex-col gap-2 rounded-[14px] bg-cream p-4">
                {[
                  'Plan a 10-mile loop from Davis Square with a coffee stop halfway.',
                  'Who’s coming Saturday, and what’s the forecast?',
                  'Rain is coming. Cancel Saturday and tell everyone.',
                ].map((q) => (
                  <p key={q} className="ml-6 rounded-[14px] rounded-br-[4px] bg-navy px-3.5 py-2.5 text-[17px] leading-snug text-white">{q}</p>
                ))}
                <p className="mt-1 flex items-center gap-2 text-[16px] font-bold text-navy/80">
                  <MessageSquareText className="h-5 w-5 text-forest" aria-hidden /> On your rides page
                </p>
              </div>
            </div>
          </div>

          {/* Free, including what other ride apps put in a paid plan. */}
          <div className="mt-6 rounded-[18px] bg-navy px-5 py-6 text-white sm:px-7 print:break-inside-avoid">
            <p className="text-[1.375rem] font-extrabold leading-snug">Free, including what other ride apps charge for</p>
            <ul className="mt-4 flex flex-wrap gap-2.5">
              {FREE.map((f) => (
                <li key={f} className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[17px] font-bold">
                  <Check className="h-5 w-5 text-lime" aria-hidden />{f}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* How Shift fits next to what they use, tool by tool. */}
        <Section id="tools" title="Keep your other tools">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <div className="overflow-hidden rounded-[18px] border border-navy/10 bg-white">
              <div className="hidden grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.6fr)] gap-6 border-b border-navy/10 bg-navy/[0.04] px-6 py-3 text-[16px] font-bold text-navy/80 md:grid">
                <span>What you use</span><span>Keep it for</span><span>With Shift</span>
              </div>
              <ul className="divide-y divide-navy/10">
                {TOOLS.map((t) => (
                  <li key={t.tool} className="grid gap-1.5 px-5 py-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.6fr)] md:gap-6 md:px-6 print:break-inside-avoid">
                    <p className="text-[18px] font-bold">{t.tool}</p>
                    <p className="hidden text-[17px] leading-[1.5] text-navy/80 md:block">{t.keep}</p>
                    <p className="text-[17px] leading-[1.5] text-navy">{t.shift}</p>
                  </li>
                ))}
              </ul>
            </div>
            {/* The thing they post everywhere: the ride page their link opens. */}
            <figure className="overflow-hidden rounded-[18px] border border-navy/10 bg-white">
              <div className="relative h-[260px] lg:h-[380px]">
                <Image src="/organizer-kit/ride-page.jpg" alt="A ride page: pick a date, then Going, Maybe or Can’t go, with distance, pace, hills and level" fill className="object-cover object-top" sizes="(min-width: 1024px) 280px, 90vw" />
              </div>
              <figcaption className="border-t border-navy/10 px-4 py-3 text-[16px] leading-snug text-navy/85">
                The page your link opens. People RSVP here, in any browser.
              </figcaption>
            </figure>
          </div>
        </Section>

        {/* The pilot: three steps, and who we are. */}
        <Section id="pilot" title="Be one of the first">
          {/* Each step shows the screen it happens on (polish 2026-11-19: the
              steps were the only text-only cards above the facts). */}
          <ol className="grid gap-3 md:grid-cols-3">
            {PILOT.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-3 rounded-[18px] border border-navy/10 bg-white p-3 pb-4 print:break-inside-avoid">
                {s.art}
                <div className="flex gap-3 px-1">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-[17px] font-bold text-white">{i + 1}</span>
                  <div>
                    <p className="text-[1.25rem] font-bold leading-snug">{s.title}</p>
                    <p className={`mt-0.5 ${BODY}`}>{s.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <p className={`mt-4 ${BODY}`}>Green Streets Initiative has run Walk/Ride Day since 2006 and keeps the events calendar your rides are on.</p>

          {quotes.length > 0 && (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {quotes.map((q) => (
                <blockquote key={q.quote} className="rounded-[18px] border border-navy/10 bg-white px-6 py-5 print:break-inside-avoid">
                  <p className="text-[1.125rem] leading-[1.5]">&ldquo;{q.quote}&rdquo;</p>
                  <footer className="mt-3 text-[16px] font-bold text-navy/80">{q.shown_name}</footer>
                </blockquote>
              ))}
            </div>
          )}
        </Section>

        {/* Short facts, not a Q&A. */}
        <Section id="facts" title="Good to know">
          <dl className="grid gap-x-8 gap-y-5 rounded-[18px] border border-navy/10 bg-white p-5 sm:grid-cols-2 sm:p-6">
            {[
              ['Why it’s free', 'Helping people start riding and walking is our mission.'],
              ['The people who come', 'They answer in any browser and get changes by email.'],
              ['Names', 'Others see a first name and last initial.'],
              ['Our calendar', 'Public rides you make on Shift show on our events calendar.'],
              ['Co-leaders', 'People going can sign up to ride at the back, or to wait at a busy crossing until everyone is through.'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[18px] font-bold">{k}</dt>
                <dd className={`mt-0.5 ${BODY}`}>{v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <section className="mb-8 rounded-[24px] bg-navy px-6 py-8 text-white sm:px-10 print:break-inside-avoid">
          <h2 className="[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(1.625rem,3.2vw,2.25rem)] font-extrabold leading-[1.1] text-white">Set up your next ride</h2>
          <div className="mt-5"><Start link={link} light /></div>
          <p className="mt-5 text-[17px] text-white/85">
            Questions? Reply to your invitation, or write to{' '}
            <a href="mailto:info@gogreenstreets.org" className="font-bold text-white underline underline-offset-2">info@gogreenstreets.org</a>.
          </p>
        </section>

        <p className="mb-12 text-[14px] leading-[1.5] text-navy/75">
          Photos: MassDOT (public domain); Leo_Visions on Unsplash; Sarah Nichols, CC BY-SA 2.0; Daderot, public domain;
          4300streetcar, CC BY 4.0 (all cropped). Screens show made-up rides.
        </p>
      </main>

      <div className="print:hidden">
        <Footer variant="light" />
      </div>
    </div>
  )
}
