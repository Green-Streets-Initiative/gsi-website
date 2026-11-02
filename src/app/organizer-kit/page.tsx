import type { Metadata } from 'next'
import Image from 'next/image'
import type { ReactNode } from 'react'
import {
  BellRing, Bike, CalendarPlus, Download, Gift, MessagesSquare, QrCode, ShieldCheck, Trophy, Users,
} from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { BUTTON, CONTAINER, GSI_FONT } from '../move-in/sign'

/**
 * The organizer kit (Keith 2026-11-01 calls 1-4; reworked 2026-11-02 after
 * his landing-page review): a private page for the ~12 ride and walk
 * organizers Keith invites to the pilot. Reached only from his invitation,
 * so it is noindex, unlisted and not in the sitemap. The same page prints
 * to the kit's PDF.
 *
 * Keith's email links here with the organizer's personal console link
 * (/organizer-kit?link=…), so "Make your first ride" opens their ride,
 * filled in from their calendar listing (01588). Without one, the button
 * goes to the console's sign-in.
 *
 * Proof comes from the pilot itself: after a ride's first date the console
 * asks the organizer how it went, and answers they let us share show here
 * (01595, get_organizer_quotes). Until then the section explains the ask.
 *
 * Every claim matches what the tools do on 2026-11-02. Pictures are from a
 * made-up, invite-only test ride with made-up people (public/organizer-kit).
 */

export const metadata: Metadata = {
  title: 'Organizer kit | Shift by Green Streets',
  description: 'Free tools for people who lead group rides and walks in Massachusetts.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const HEAD = '[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] font-extrabold text-navy'

type Pic = { src: string; w: number; h: number; alt: string }

const BENEFITS: { title: string; body: string; chips?: string[]; pic: Pic }[] = [
  {
    title: 'Bring your route. We’ll rate it.',
    body: 'Paste a Ride with GPS link, upload a GPX file, or plan it here. Shift rates every stretch for comfort and flags crash hot spots and hills.',
    chips: ['Ride with GPS', 'GPX from Strava, Komoot or Garmin', 'Plan it here'],
    pic: { src: '/organizer-kit/route.jpg', w: 640, h: 800, alt: 'A ride’s route on the map, with distance, climbing, riding time and how much is on calm streets' },
  },
  {
    title: 'Know who’s coming, with no app needed.',
    body: 'People answer Going, Maybe or Can’t go on your ride page with a name and email. You see the list, and Shift emails them if anything changes.',
    pic: { src: '/organizer-kit/whos-coming.jpg', w: 640, h: 668, alt: 'The organizer’s list for one date: 7 going, 2 maybe, 1 can’t go, with first names and last initials' },
  },
  {
    title: 'Turnout, counted for you.',
    body: 'Shift counts people whose app recorded the ride, and asks people who answered on your ride page if they made it. Monthly numbers and a spreadsheet for your funders.',
    pic: { src: '/organizer-kit/turnout.jpg', w: 640, h: 596, alt: 'Turnout: dates run, said going, came, first-timers, by month' },
  },
]

const ALSO: { icon: typeof Bike; title: string; body: string }[] = [
  { icon: BellRing, title: 'Changes reach everyone', body: 'Cancel or move one date, and everyone coming hears.' },
  { icon: MessagesSquare, title: 'Your group chat too', body: 'Updates also post to your Discord or GroupMe, set up in the app.' },
  { icon: QrCode, title: 'Flyer and QR code', body: 'Plus ready captions and four calendars to post on.' },
  { icon: Download, title: 'GPX for bike computers', body: 'People load your route with one tap.' },
  { icon: CalendarPlus, title: 'Add to calendar', body: 'Google, Apple or Outlook, from the ride page.' },
  { icon: Users, title: 'Co-organizers', body: 'Share the work with your ride leaders.' },
  { icon: Gift, title: 'Bike shop perks', body: 'Shops and cafés near the ride with Bicycle Benefits discounts.' },
  { icon: Trophy, title: 'Their ride counts', body: 'People on Shift get Walk/Ride Day entries and challenges.' },
]

const PEOPLE: Pic[] = [
  { src: '/organizer-kit/ride-facts.jpg', w: 640, h: 1045, alt: 'Ride facts in the app: distance, hills, level, no-drop, beginner friendly' },
  { src: '/organizer-kit/live-map.jpg', w: 640, h: 1094, alt: 'The ride’s map with the route and the meeting spot' },
]

const QUESTIONS: [string, string][] = [
  ['Do the people who come need the app?', 'No. They answer on your ride page with a name and email, and hear about changes by email. People who already use Shift get a phone notice, directions from home and the group on a map.'],
  ['Who sees names?', 'You, and anyone who joined the ride in the Shift app, see the first name and last initial of everyone coming. Email addresses stay private.'],
  ['Can I keep Meetup, Facebook or our group chat?', 'Yes. Post your Shift ride link wherever you post now, so every answer lands on one list.'],
  ['What about waivers?', 'Your ride’s registration link can point to your own waiver form.'],
  ['What does it cost?', 'Nothing. It’s your ride, under your name: Green Streets never runs or brands it.'],
]

/** A personal console link from Keith's email, passed through to the button. */
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

function Start({ link, light }: { link: string | null; light?: boolean }) {
  return (
    <div>
      <a
        href={link ? `/organizers?link=${encodeURIComponent(link)}` : '/organizers'}
        className={`${BUTTON} ${light ? '!bg-white !text-navy' : ''} print:hidden`}
      >
        Make your first ride
      </a>
      <p className={`mt-3 text-[15px] leading-snug ${light ? 'text-white/85' : 'text-navy/75'} print:mt-0`}>
        {link
          ? 'Opens your ride, filled in from your calendar listing. It takes a few minutes.'
          : 'Use the personal link in Keith’s email. It opens your ride, filled in from your calendar listing.'}
      </p>
    </div>
  )
}

function Section({ id, title, lede, children, className = '' }: { id: string; title: string; lede?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-24 py-12 md:py-16 print:py-6 ${className}`}>
      <div className="print:break-inside-avoid print:break-after-avoid">
        <h2 className={`${HEAD} text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.08]`}>{title}</h2>
        {lede && <div className="mt-3 max-w-[680px] text-[1.0625rem] leading-[1.6] text-navy/80">{lede}</div>}
      </div>
      <div className="mt-8">{children}</div>
    </section>
  )
}

export default async function OrganizerKitPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const link = linkFrom((await searchParams).link)
  const quotes = await sharedQuotes()

  return (
    <div className="street min-h-screen bg-cream text-navy" style={{ fontFamily: GSI_FONT }}>
      <div className="print:hidden">
        <Nav variant="light" street />
      </div>

      {/* Hero: the promise, the button, and the product. */}
      <section className="bg-cream pt-[60px] print:pt-0">
        <div className={`${CONTAINER} pb-6 pt-6 md:pt-10`}>
          <div className="grid items-center gap-8 overflow-hidden rounded-[24px] bg-forest px-5 pb-8 pt-7 text-white sm:px-10 sm:pb-10 sm:pt-9 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] print:grid-cols-[1.2fr_0.8fr] print:gap-6">
            <div>
              <p className="text-[1rem] font-bold text-white/90">For people who lead group rides and walks in Massachusetts</p>
              <h1 className={`mt-4 [font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-[1.03] tracking-[-0.01em] text-white`}>
                Run your rides with less work, and bring more people along.
              </h1>
              <p className="mt-5 max-w-[560px] text-[1.125rem] leading-[1.55] text-white/90">
                Free tools from Green Streets Initiative. Bring your route, see who&rsquo;s coming, and let Shift count who came.
              </p>
              <div className="mt-7"><Start link={link} light /></div>
            </div>
            <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[18px] bg-white shadow-[0_18px_40px_rgba(0,0,0,0.25)] print:max-w-[280px]">
              <Image src="/organizer-kit/ride-page.jpg" width={640} height={848} priority alt="A ride page: pick a date, then Going, Maybe or Can’t go, with distance, pace, hills and level" className="h-auto w-full" sizes="(min-width: 1024px) 420px, 100vw" />
            </div>
          </div>
          <ul className="mt-4 grid gap-2 text-[15px] font-bold text-navy sm:grid-cols-3 print:grid-cols-3">
            {['Free, under your name', 'No app needed to join', 'Ready in a few minutes'].map((t) => (
              <li key={t} className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5">
                <ShieldCheck className="h-4 w-4 shrink-0 text-forest" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <main className={CONTAINER}>
        {/* The three things that change an organizer's week, each with its picture. */}
        <Section id="benefits" title="What changes for you">
          <div className="space-y-10 md:space-y-16 print:space-y-6">
            {BENEFITS.map((b, i) => (
              <article key={b.title} className="grid items-center gap-6 md:grid-cols-2 md:gap-12 print:break-inside-avoid print:grid-cols-2 print:gap-6">
                <div className={i % 2 ? 'md:order-2' : ''}>
                  <h3 className={`${HEAD} text-[clamp(1.5rem,2.6vw,2rem)] leading-[1.1]`}>{b.title}</h3>
                  <p className="mt-3 text-[1.125rem] leading-[1.55] text-navy/85">{b.body}</p>
                  {b.chips && (
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {b.chips.map((c) => <li key={c} className="rounded-full border border-navy/15 bg-white px-3 py-1.5 text-[14px] font-bold text-navy">{c}</li>)}
                    </ul>
                  )}
                </div>
                <div className="overflow-hidden rounded-[18px] border border-navy/10 bg-white shadow-[0_10px_30px_rgba(25,26,46,0.08)]">
                  <Image src={b.pic.src} width={b.pic.w} height={b.pic.h} alt={b.pic.alt} className="h-auto w-full" sizes="(min-width: 768px) 520px, 100vw" />
                </div>
              </article>
            ))}
          </div>
        </Section>

        <Section id="also" title="Also included" className="border-t border-navy/10">
          <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 print:gap-4">
            {ALSO.map(({ icon: Icon, title, body }) => (
              <li key={title} className="print:break-inside-avoid">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest/10 text-forest"><Icon className="h-5 w-5" aria-hidden /></span>
                <p className="mt-3 text-[1.0625rem] font-bold text-navy">{title}</p>
                <p className="mt-1 text-[15px] leading-snug text-navy/80">{body}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="people"
          title="What the people who come see"
          lede="Distance, hills, pace and no-drop before they decide. One tap to say they’re coming. Your route and meeting spot on the day."
          className="border-t border-navy/10"
        >
          <div className="grid max-w-[760px] grid-cols-2 gap-3 sm:gap-6 print:gap-4">
            {PEOPLE.map((p) => (
              <div key={p.src} className="h-[300px] overflow-hidden rounded-[16px] border border-navy/10 bg-white sm:h-[460px] print:h-[230px]">
                <Image src={p.src} width={p.w} height={p.h} alt={p.alt} className="h-auto w-full" sizes="(min-width: 768px) 360px, 33vw" />
              </div>
            ))}
          </div>
        </Section>
      </main>

      {/* Reach and why: the calendar's size, and what Green Streets is after. */}
      <section className="bg-navy py-12 text-white md:py-16 print:break-inside-avoid print:py-8">
        <div className={`${CONTAINER} grid gap-10 md:grid-cols-2`}>
          <div>
            <p className={`[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(2.5rem,6vw,4rem)] font-extrabold leading-none text-lime`}>600+</p>
            <p className="mt-3 text-[1.125rem] leading-[1.55] text-white/90">
              rides, walks and events from 200+ Massachusetts organizers on our events calendar in the last six months. Your ride
              joins them, on a page built to show up in Google.
            </p>
          </div>
          <div>
            <h2 className={`[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.1] text-white`}>Why we&rsquo;re doing this</h2>
            <p className="mt-3 text-[1.125rem] leading-[1.55] text-white/90">
              We want a friendly group ride or walk within reach of everyone in Massachusetts, so getting around by bike or on
              foot is easy to start. Organizers like you are how most people take their first ride.
            </p>
          </div>
        </div>
      </section>

      <div className={CONTAINER}>
        {/* The pilot's journey, with the feedback ask built in. */}
        <Section
          id="pilot"
          title="Build it with us"
          lede="You’re one of about a dozen organizers trying this first. Here’s the whole ask."
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-start print:grid-cols-[1fr_0.8fr]">
            <ol className="space-y-4">
              {[
                ['Put one ride on Shift', 'Your ride comes filled in from your calendar listing. Check it, save it, and share the link.'],
                ['Tell us how it went', 'After your first date, your rides page asks three quick questions. Say what to fix, and what you’d tell another organizer.'],
                ['A 15-minute call, if you like', 'Keith will ask what to build next. Pilot organizers shape what comes after.'],
              ].map(([t, b], i) => (
                <li key={t} className="flex gap-4 rounded-[18px] border border-navy/10 bg-white px-5 py-5 print:break-inside-avoid">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-[1rem] font-bold text-white">{i + 1}</span>
                  <div>
                    <p className="text-[1.125rem] font-bold text-navy">{t}</p>
                    <p className="mt-1 text-[1.0625rem] leading-[1.55] text-navy/80">{b}</p>
                  </div>
                </li>
              ))}
            </ol>
            <figure className="overflow-hidden rounded-[18px] border border-navy/10 bg-white shadow-[0_10px_30px_rgba(25,26,46,0.08)] print:break-inside-avoid">
              <Image src="/organizer-kit/feedback.jpg" width={640} height={622} alt="The rides page asking how the first date went, what to fix, and what they would tell another organizer, with a box to share it" className="h-auto w-full" sizes="(min-width: 1024px) 460px, 100vw" />
              <figcaption className="border-t border-navy/10 px-5 py-3 text-[15px] text-navy/80">With your OK, what you&rsquo;d tell another organizer goes on this page.</figcaption>
            </figure>
          </div>

          {quotes.length > 0 && (
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {quotes.map((q) => (
                <blockquote key={q.quote} className="rounded-[18px] bg-white px-6 py-5 print:break-inside-avoid">
                  <p className="text-[1.125rem] leading-[1.5] text-navy">&ldquo;{q.quote}&rdquo;</p>
                  <footer className="mt-3 text-[15px] font-bold text-navy/80">{q.shown_name}</footer>
                </blockquote>
              ))}
            </div>
          )}
        </Section>

        <Section id="questions" title="Questions" className="border-t border-navy/10">
          <dl className="grid gap-x-10 gap-y-6 md:grid-cols-2 print:grid-cols-2 print:gap-y-4">
            {QUESTIONS.map(([q, a]) => (
              <div key={q} className="print:break-inside-avoid">
                <dt className="text-[1.0625rem] font-bold text-navy">{q}</dt>
                <dd className="mt-1 text-[1.0625rem] leading-[1.55] text-navy/80">{a}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <section className="mb-12 rounded-[24px] bg-forest px-6 py-8 text-white sm:px-10 print:break-inside-avoid">
          <h2 className={`[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(1.5rem,3vw,2.125rem)] font-extrabold leading-[1.1] text-white`}>Ready when you are</h2>
          <div className="mt-5"><Start link={link} light /></div>
          <p className="mt-5 text-[15px] text-white/85">
            Questions? Reply to Keith&rsquo;s email, or write to{' '}
            <a href="mailto:info@gogreenstreets.org" className="font-bold text-white underline underline-offset-2">info@gogreenstreets.org</a>.
          </p>
        </section>
      </div>

      <div className="print:hidden">
        <Footer variant="light" />
      </div>
    </div>
  )
}
