import type { Metadata } from 'next'
import { BarChart3, Bike, Coffee, HandCoins, ShieldCheck, Smartphone } from 'lucide-react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { BUTTON, CONTAINER, GSI_FONT } from '../move-in/sign'

/**
 * The Ride Fund for sponsors (Keith 2026-11-02: "The ride fund is an awesome
 * idea", "Yes, start both"). A bank, credit union or local business funds a
 * season of community rides in its towns; Green Streets buys a coffee at the
 * shop where each ride ends for everyone who checks in on Shift, supports
 * the organizers, and reports the season live (/ride-fund/[slug]).
 *
 * Acknowledgment, not advertising (IRS qualified sponsorship): the sponsor's
 * name, logo and link, with no claims about its products.
 *
 * Unlinked and noindex until Keith approves the copy and the package prices
 * (his call). No sponsor asks go out before Dec 1.
 */

export const metadata: Metadata = {
  title: 'Ride Fund: sponsor a season of community rides | Green Streets Initiative',
  description: 'Fund a season of community bike rides in your towns. Every rider gets a coffee at the local shop where the ride ends, and you get a live report.',
  robots: { index: false, follow: false },
}

const HEAD = '[font-family:var(--font-overpass),Trebuchet_MS,sans-serif] font-extrabold text-navy'
const ASK = 'mailto:info@gogreenstreets.org?subject=Ride%20Fund%20season'

const STEPS: { icon: typeof Bike; title: string; body: string }[] = [
  { icon: HandCoins, title: 'You fund a season', body: 'Pick your towns and months.' },
  { icon: Smartphone, title: 'People ride and check in', body: 'Each rider gets a coffee code in the Shift app.' },
  { icon: Coffee, title: 'The ride ends at a local shop', body: 'They show the code at the counter.' },
]

// Where each dollar goes, as one bar.
const SPLIT: [number, string, string][] = [
  [40, 'Coffee at local shops', 'bg-forest'],
  [30, 'Organizers’ lights, flyers, insurance', 'bg-[#4f8a6b]'],
  [30, 'Green Streets runs it', 'bg-navy/70'],
]

const PACKAGES: { name: string; price: string; body: string }[] = [
  { name: 'One ride', price: '$1,500', body: 'One regular ride in your town, for a season.' },
  { name: 'Town season', price: '$6,000', body: 'Every ride on Shift in your towns, spring to fall.' },
  { name: 'Summer partner', price: '$12,000', body: 'A region of towns, June through August.' },
]

const GET: { icon: typeof Bike; text: string }[] = [
  { icon: ShieldCheck, text: 'Your name on every ride and coffee' },
  { icon: Coffee, text: 'Money spent at local shops' },
  { icon: BarChart3, text: 'A live report of rides and miles' },
]

const QUESTIONS: [string, string][] = [
  ['Whose rides are these?', 'Community rides that volunteers already lead: café rides, family rides, social rides. They stay the organizer’s. Green Streets never runs or brands them.'],
  ['Who gets a coffee?', 'Everyone who checks in on the Shift app at the start of a funded ride, once per ride and once a day. The fund stops when the season’s budget is spent.'],
  ['Which shops?', 'The shop where each ride ends, picked by its organizer from shops near the finish. Green Streets buys the cards at full price, so shops don’t sign up for anything.'],
  ['Do we see riders’ details?', 'No. The report shows totals only. Nobody’s name or contact is shared.'],
  ['Is it a donation?', 'Green Streets Initiative is a 501(c)(3) nonprofit. Sponsors are thanked by name, logo and link, without advertising.'],
]

/** What a rider sees on a funded ride's page (the real RideCoffee line, with sample names). */
function Sample() {
  return (
    <div className="mx-auto w-full max-w-[400px] rounded-[18px] bg-white p-5 text-navy shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
      <p className="text-[14px] font-bold text-navy/75">On the ride page</p>
      <p className="mt-1 text-[1.25rem] font-extrabold leading-tight">Saturday Coffee Ride</p>
      <p className="text-[15px] text-navy/80">Sat 10:00 AM · 14 mi · Easy pace</p>
      <div className="mt-4 flex gap-3 rounded-[14px] border border-navy/10 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest"><Coffee className="h-[18px] w-[18px]" aria-hidden /></span>
        <div>
          <p className="text-[15px] font-bold leading-snug">Coffee at the corner café after the ride, on Your Credit Union</p>
          <p className="mt-1 text-[14px] leading-snug text-navy/80">Check in with the Shift app and a $5 code comes to your phone.</p>
        </div>
      </div>
    </div>
  )
}

export default function RideFundPage() {
  return (
    <div className="street min-h-screen bg-cream text-navy" style={{ fontFamily: GSI_FONT }}>
      <Nav variant="light" street />

      <section className="bg-cream pt-[60px]">
        <div className={`${CONTAINER} pb-6 pt-6 md:pt-10`}>
          <div className="grid items-center gap-8 rounded-[24px] bg-forest px-5 pb-8 pt-7 text-white sm:px-10 sm:pb-10 sm:pt-9 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div>
              <p className="text-[1rem] font-bold text-white/90">The Ride Fund, from Green Streets Initiative</p>
              <h1 className="mt-4 [font-family:var(--font-overpass),Trebuchet_MS,sans-serif] text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-[1.03] tracking-[-0.01em] text-white">
                Buy the coffee after the ride.
              </h1>
              <p className="mt-5 max-w-[560px] text-[1.125rem] leading-[1.55] text-white/90">
                Fund a season of community bike rides in your towns. Everyone who rides gets a coffee at the local shop where the ride ends.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                <a href={ASK} className={`${BUTTON} !bg-white !text-navy`}>Talk to us about a season</a>
                <a href="#seasons" className="text-[1rem] font-bold text-white underline-offset-4 hover:underline">Seasons from $1,500</a>
              </div>
            </div>
            <Sample />
          </div>
          <ul className="mt-4 grid gap-2 text-[15px] font-bold text-navy sm:grid-cols-3">
            {GET.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5">
                <Icon className="h-4 w-4 shrink-0 text-forest" aria-hidden /> {text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <main className={CONTAINER}>
        <section className="py-12 md:py-16">
          <h2 className={`${HEAD} text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.08]`}>How it works</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="flex items-start gap-4 rounded-[18px] bg-white p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest"><Icon className="h-5 w-5" aria-hidden /></span>
                <span>
                  <span className="block text-[14px] font-bold text-navy/75">Step {i + 1}</span>
                  <span className="block text-[1.125rem] font-bold text-navy">{title}</span>
                  <span className="mt-1 block text-[15px] leading-snug text-navy/80">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section id="seasons" className="scroll-mt-24 border-t border-navy/10 py-12 md:py-16">
          <h2 className={`${HEAD} text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.08]`}>Seasons</h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {PACKAGES.map((p) => (
              <li key={p.name} className="rounded-[18px] bg-white p-6">
                <p className="text-[1.0625rem] font-bold text-navy">{p.name}</p>
                <p className={`${HEAD} mt-2 text-[2rem] leading-none`}>{p.price}</p>
                <p className="mt-3 text-[15px] leading-snug text-navy/80">{p.body}</p>
              </li>
            ))}
          </ul>
          <h3 className="mt-10 text-[1.125rem] font-bold text-navy">Where each dollar goes</h3>
          <div className="mt-3 flex h-4 overflow-hidden rounded-full" aria-hidden>
            {SPLIT.map(([pct, , color]) => <div key={pct + color} className={color} style={{ width: `${pct}%` }} />)}
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {SPLIT.map(([pct, label, color]) => (
              <li key={label} className="flex items-center gap-2 text-[15px] text-navy/85">
                <span className={`h-3 w-3 shrink-0 rounded-full ${color}`} aria-hidden /><span className="font-bold text-navy">{pct}%</span> {label}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-navy/10 py-12 md:py-16">
          <h2 className={`${HEAD} text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.08]`}>Questions</h2>
          <div className="mt-6 divide-y divide-navy/10 rounded-[18px] bg-white">
            {QUESTIONS.map(([q, a]) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex min-h-[28px] cursor-pointer list-none items-center justify-between gap-4 text-[1.0625rem] font-bold text-navy">
                  {q}<span className="text-navy/60 transition group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-2 text-[15px] leading-relaxed text-navy/80">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mb-16 rounded-[24px] bg-white px-6 py-8 sm:px-10">
          <h2 className={`${HEAD} text-[1.75rem] leading-tight`}>Start a season in your towns</h2>
          <p className="mt-2 max-w-[620px] text-[1.0625rem] leading-[1.55] text-navy/80">Tell us the towns and months. We&rsquo;ll send back the rides there now and what a season would cover.</p>
          <a href={ASK} className={`${BUTTON} mt-5`}>Talk to us about a season</a>
        </section>
      </main>
      <Footer variant="light" />
    </div>
  )
}
