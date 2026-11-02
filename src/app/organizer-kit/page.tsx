import type { Metadata } from 'next'
import Image from 'next/image'
import type { ReactNode } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { CONTAINER, GSI_FONT, H3, SignHero, SignTop } from '../move-in/sign'

/**
 * The organizer kit (Keith 2026-11-01, decided calls 1-4): a private page for
 * the ~12 ride and walk organizers Keith invites to the pilot. Reached only
 * from his invitation, so it is noindex, unlisted and not in the sitemap. The
 * same page prints to the kit's PDF (Save as PDF; the print styles drop the
 * nav and footer and keep each card on one page).
 *
 * Every claim matches what the tools do on 2026-11-02 (pilot readiness
 * sweep): names are visible to people on the ride, web RSVPs are counted once
 * they say they made it, "new" means opened in the last six months. Plan:
 * Shift docs/programs/product/organizer-kit-plan-2026-11-01.md.
 * Pictures are from the made-up test rides (public/organizer-kit).
 */

export const metadata: Metadata = {
  title: 'Organizer kit | Shift by Green Streets',
  description: 'Free tools for people who lead group rides and walks in Massachusetts.',
  robots: { index: false, follow: false },
}

const SECTIONS = [
  { id: 'you', label: 'What you get' },
  { id: 'people', label: 'For the people who come' },
  { id: 'app', label: 'What needs the app' },
  { id: 'start', label: 'Get started' },
]

// Every picture sits in a same-height frame: a tall phone screen shows from its top, a short
// card is centered. dark = the picture is from the app, so the frame matches its navy.
type Card = { title: string; body: string; img?: { src: string; w: number; h: number; alt: string; dark?: boolean } }

const FOR_YOU: Card[] = [
  {
    title: 'Plan a comfortable route',
    body: 'Every stretch is rated: path, bike lane, quiet street or shared with traffic. Lanes that opened in the last six months are called out.',
    img: { src: '/organizer-kit/route-comfort.jpg', dark: true, w: 640, h: 793, alt: 'A ride’s route with its comfort bar and a new greenway on it' },
  },
  {
    title: 'Know who’s coming',
    body: 'Your rides are on GSI’s events calendar. People answer Going, Maybe or Can’t go on your ride page, no app needed.',
    img: { src: '/organizer-kit/rsvp.jpg', w: 640, h: 1224, alt: 'A ride page on a phone with its dates and Going, Maybe, Can’t go' },
  },
  {
    title: 'Changes reach everyone',
    body: 'Cancel, move or change one date. Everyone coming hears about it, by app or email.',
    img: { src: '/organizer-kit/cancel.jpg', w: 640, h: 528, alt: 'The cancel dialog saying who will hear about it' },
  },
  {
    title: 'Turnout counted for you',
    body: 'Shift counts who came from their trips, and asks people who answered on the web. No sign-in sheet.',
    img: { src: '/organizer-kit/counted.jpg', w: 640, h: 298, alt: 'Thanks. You’re counted.' },
  },
  {
    title: 'Spread the word',
    body: 'Put our QR code on your own flyer, or print ours. Captions and short links are ready to paste.',
    img: { src: '/organizer-kit/promote.jpg', w: 640, h: 1100, alt: 'The Promote tab with the QR code and flyer options' },
  },
  {
    title: 'On the day',
    body: 'In the Shift app, a check-in the evening before: one tap says it’s on, or change or cancel it.',
    img: { src: '/organizer-kit/checkin.jpg', dark: true, w: 640, h: 377, alt: 'The check-in card: Running as planned, Change time or place, Cancel this date' },
  },
]

const FOR_PEOPLE: Card[] = [
  {
    title: 'Know what they’re signing up for',
    body: 'Distance, hills, level and no-drop, before they go. Plus shops and cafés near the ride with Bicycle Benefits discounts.',
    img: { src: '/organizer-kit/ride-facts.jpg', dark: true, w: 640, h: 1045, alt: 'Ride facts: distance, hills, level, no-drop, and bike perks near the ride' },
  },
  {
    title: 'One tap to say they’re coming',
    body: 'Where to meet, directions there, and Going or Maybe. They hear if anything changes.',
    img: { src: '/organizer-kit/going.jpg', dark: true, w: 640, h: 557, alt: 'The next ride card with Directions, Maybe and I’m going' },
  },
  {
    title: 'Catch up if they’re late',
    body: 'Your route and the meeting spot on a map, with the group’s dot once you set off.',
    img: { src: '/organizer-kit/live-map.jpg', dark: true, w: 640, h: 1094, alt: 'The ride’s live map with the route and the meeting pin' },
  },
]

const YES = 'Yes'
const ROWS: [string, string, string, string][] = [
  ['Plan the route: comfort, crash spots, hills', 'Yes, on the web', 'Sees the route on the ride page', YES],
  ['Get to the start', '', 'Bike or transit directions on the ride page', 'Plus a comfortable way from home'],
  ['Listed on the calendar', YES, 'On the web calendar', 'In the app too'],
  ['Say Going, Maybe or Can’t go', 'Sees the list', 'Name and email on the ride page', 'One tap'],
  ['Hear about changes', 'Sends once', 'Email, plus a reminder the evening before if they said Going', 'A phone notice'],
  ['Counted at the ride', 'Sees the count', 'When they tell us they made it', 'From their trip, automatically'],
  ['Where’s the group, on the day', 'Shares from the app', '“Rolling now” on the ride page', 'The group on a map'],
  ['Ride counts toward Walk/Ride Day, challenges and rewards', '', '', 'Automatically'],
  ['Ask the assistant', 'In the console and the app', '', '“When’s my next ride?”'],
]

function Pictured({ card }: { card: Card }) {
  return (
    <article className="flex break-inside-avoid flex-col overflow-hidden rounded-[20px] border border-navy/10 bg-white">
      <div className="px-6 pb-4 pt-6">
        <h3 className={H3}>{card.title}</h3>
        <p className="mt-2 text-[1.0625rem] leading-[1.55] text-navy/80">{card.body}</p>
      </div>
      {card.img && (
        <div className={`mt-auto flex h-[340px] items-start justify-center overflow-hidden border-t border-navy/10 print:h-[190px] ${card.img.dark ? 'bg-[#1b1c30]' : 'bg-[#f3f5ee]'}`}>
          <Image
            src={card.img.src}
            width={card.img.w}
            height={card.img.h}
            alt={card.img.alt}
            className={card.img.h / card.img.w > 1 ? 'h-auto w-full' : 'my-auto h-auto max-h-full w-full object-contain'}
            sizes="(min-width: 1024px) 340px, 100vw"
          />
        </div>
      )}
    </article>
  )
}

function Section({ id, title, lede, children }: { id: string; title: string; lede?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-navy/10 py-14 print:border-0 print:py-4">
      <h2 className="print:break-after-avoid [font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(1.75rem,3.6vw,2.5rem)] font-extrabold leading-[1.08] text-navy">
        {title}
      </h2>
      {lede && <div className="mt-3 max-w-[720px] print:break-inside-avoid print:break-after-avoid text-[1.0625rem] leading-[1.6] text-navy/80">{lede}</div>}
      <div className="mt-8">{children}</div>
    </section>
  )
}

export default function OrganizerKitPage() {
  return (
    <div className="street min-h-screen bg-cream text-navy" style={{ fontFamily: GSI_FONT }}>
      <div className="print:hidden">
        <Nav variant="light" street />
      </div>

      <SignHero
        top={<SignTop strong="For people who lead group rides and walks in Massachusetts" />}
        title="Run your rides with less work, and bring more people along."
        lede={
          <p>
            Free tools from Green Streets Initiative, in our Shift app and on the web. Plan a comfortable route, know
            who&rsquo;s coming, tell everyone about changes and see who came. The people who come don&rsquo;t need to
            install anything.
          </p>
        }
        after={
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ['Free, and yours', 'Your name, your rules, your channels. GSI never runs or brands your event.'],
              ['No app needed to join', 'People answer on your ride page with a name and email.'],
              ['Ready in a few minutes', 'Your personal link opens a ride filled in from your calendar listing.'],
            ].map(([t, b]) => (
              <div key={t} className="rounded-[16px] bg-white px-5 py-4">
                <p className="text-[1.0625rem] font-bold text-navy">{t}</p>
                <p className="mt-1 text-[1rem] leading-[1.5] text-navy/80">{b}</p>
              </div>
            ))}
          </div>
        }
      />

      <nav aria-label="On this page" className="sticky top-[60px] z-20 border-y border-navy/10 bg-cream/95 backdrop-blur print:hidden">
        <div className={`${CONTAINER} flex gap-2 overflow-x-auto py-3`}>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="shrink-0 rounded-full border border-navy/20 bg-white px-4 py-2 text-[15px] font-bold text-navy hover:border-navy">
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <main className={CONTAINER}>
        <Section
          id="you"
          title="What you get"
          lede="Comfort ratings come from MassDOT’s and OpenStreetMap’s street data, mile by mile, with crash hot spots and hills on the map. Turnout comes from trips people already record, not a clipboard."
        >
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
            {FOR_YOU.map((c) => <Pictured key={c.title} card={c} />)}
          </div>
        </Section>

        <Section id="people" title="For the people who come" lede="Everything a newcomer needs to decide to come, and to find you on the day.">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
            {FOR_PEOPLE.map((c) => <Pictured key={c.title} card={c} />)}
            <article className="break-inside-avoid rounded-[20px] border border-navy/10 bg-white px-6 py-6 md:col-span-2 lg:col-span-3 print:col-span-2">
              <h3 className={H3}>Their ride counts</h3>
              <p className="mt-2 text-[1.0625rem] leading-[1.55] text-navy/80">
                People on Shift get Walk/Ride Day entries, challenges and rewards from your ride, automatically.
              </p>
            </article>
          </div>
        </Section>

        <Section
          id="app"
          title="What needs the app"
          lede="You run everything on the web. Nobody coming has to install anything; people who already use Shift get more."
        >
          <div className="overflow-x-auto rounded-[20px] border border-navy/10 bg-white">
            <table className="w-full min-w-[720px] border-collapse text-left text-[1rem] leading-[1.45] print:min-w-0 print:text-[0.875rem]">
              <thead>
                <tr className="border-b border-navy/10 text-[0.9375rem] text-navy/75">
                  <th className="px-5 py-4 font-bold" scope="col"></th>
                  <th className="px-5 py-4 font-bold" scope="col">You, the organizer</th>
                  <th className="px-5 py-4 font-bold" scope="col">People coming, no app</th>
                  <th className="px-5 py-4 font-bold" scope="col">People coming, with Shift</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([what, ...cells]) => (
                  <tr key={what} className="break-inside-avoid border-b border-navy/10 last:border-0">
                    <th scope="row" className="px-5 py-3.5 font-bold text-navy">{what}</th>
                    {cells.map((c, i) => (
                      <td key={i} className="px-5 py-3.5 text-navy/80">{c || <span className="text-navy/40">&ndash;</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="start" title="Get started">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] print:break-inside-avoid">
            <ol className="grid gap-4">
              {[
                ['Check your listing', 'Look at your rides on GSI’s events calendar. Tell us anything that’s wrong, and where else you post rides.'],
                ['Put one ride on Shift', 'Open the personal link in Keith’s email. Your ride comes filled in from your calendar listing; check it and save. Then share the link or the QR code.'],
                ['Tell us how it went', 'A 15-minute call after your first ride. What you tell us shapes what we build next.'],
              ].map(([t, b], i) => (
                <li key={t} className="flex gap-4 rounded-[20px] border border-navy/10 bg-white px-6 py-5 break-inside-avoid">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-[1rem] font-bold text-white">{i + 1}</span>
                  <div>
                    <p className="text-[1.125rem] font-bold text-navy">{t}</p>
                    <p className="mt-1 text-[1.0625rem] leading-[1.55] text-navy/80">{b}</p>
                  </div>
                </li>
              ))}
            </ol>
            <aside className="rounded-[20px] bg-forest px-6 py-6 text-white break-inside-avoid">
              <h3 className="text-[1.25rem] font-bold">Who sees what</h3>
              <p className="mt-3 text-[1.0625rem] leading-[1.55] text-white/90">
                You, and anyone who joined the ride in the Shift app, see the first name and last initial of everyone who
                says they&rsquo;re coming. Email addresses stay private.
              </p>
              <p className="mt-3 text-[1.0625rem] leading-[1.55] text-white/90">
                Shift counts who came: people whose Shift app recorded the ride, and people who answered on your ride page
                and then tell us they made it.
              </p>
              <p className="mt-5 text-[1rem] leading-[1.5] text-white/90">
                Questions? Reply to Keith&rsquo;s email, or write to{' '}
                <a href="mailto:info@gogreenstreets.org" className="font-bold text-white underline underline-offset-2">info@gogreenstreets.org</a>.
              </p>
            </aside>
          </div>
        </Section>
      </main>

      <div className="mt-10 print:hidden">
        <Footer variant="light" />
      </div>
    </div>
  )
}
