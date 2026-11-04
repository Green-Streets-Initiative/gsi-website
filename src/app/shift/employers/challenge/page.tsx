import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Bicycle,
  Boat,
  Bus,
  ChartLineUp,
  ClipboardText,
  Clock,
  CurrencyCircleDollar,
  LetterCircleP,
  MapTrifold,
  PersonSimpleWalk,
  Scooter,
  Signpost,
  Ticket,
  Train,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { TEAM_CHALLENGE, roundEnded, signupOpen } from '@/lib/employer/team-challenge'
import SignupForm from './SignupForm'

// The landing page for the self-serve team challenge (Keith 2026-10-22):
// one ask, "get your invite code", for people arriving from the November
// outreach emails and the LinkedIn ad. Round two (Keith, same day): the
// reasons are the ones a VP already buys (office days, parking, commuter
// benefits, reporting), every way of getting around is named, "no manual
// logging" is said plainly, and the tools a team gets with its code
// (Commute Advisor, Nearby, the commute survey) sit beside the challenge.
// Pricing stays on /shift/employers, one quiet link at the bottom.
//
// Live 2026-10-26 (Keith). Kept out of search and the sitemap: it's a
// campaign page for outreach and ads, and it closes after the last join day.

export const revalidate = 3600

export const metadata: Metadata = {
  title: `A free team commute challenge, ${TEAM_CHALLENGE.label.range} — Green Streets Initiative`,
  description: `Bring your team to Green Streets Initiative’s statewide ${TEAM_CHALLENGE.label.monthName} commute challenge. Free for Massachusetts workplaces: staff join the free Shift app with your invite code, and walking, biking, scooters, transit, ferries and carpools all count, with nothing to log by hand.`,
  robots: { index: false, follow: false },
}

const H2 = 'font-headline text-[clamp(1.6rem,3vw,2.25rem)] font-extrabold leading-[1.1] tracking-[-0.01em] text-navy'
const H3 = 'font-headline text-[1.25rem] font-extrabold leading-tight text-navy'
const BODY = 'text-[1.0625rem] leading-[1.65] text-ink-soft'

// The ways of getting around that count, in the challenge rules' own terms
// (walks of half a mile or more, bikes and e-bikes, e-scooters, bus, subway,
// commuter rail, ferry, carpools). Carpools take one tap to confirm.
const MODES = [
  { icon: PersonSimpleWalk, label: 'Walking' },
  { icon: Bicycle, label: 'Bikes and e-bikes' },
  { icon: Scooter, label: 'Scooters' },
  { icon: Bus, label: 'Buses' },
  { icon: Train, label: 'Trains and subway' },
  { icon: Boat, label: 'Ferries' },
  { icon: UsersThree, label: 'Carpools' },
]

// What a VP is already paying for or reporting on (positioning, Keith
// 2026-10-06; the first line, Keith 2026-10-22: staff save time, money and
// commuting stress).
const OUTCOMES = [
  { icon: Clock, text: 'Helps staff save time, money and stress getting to work' },
  { icon: LetterCircleP, text: 'Less pressure on parking' },
  { icon: CurrencyCircleDollar, text: 'More use of the commuter benefits you already pay for' },
  { icon: ChartLineUp, text: 'Commute numbers for your sustainability report' },
]

const STEPS = [
  {
    title: 'Get your code',
    body: 'Sign up here and confirm your email. You get an invite code, a note to send your staff and a flyer to print.',
  },
  {
    title: 'Staff join the free app',
    body: 'They download Shift and enter the code. The app records their trips by itself, so nobody logs anything by hand. A carpool takes one tap.',
  },
  {
    title: 'See the results',
    body: `Staff follow the team standings in the app. ${TEAM_CHALLENGE.label.afterEnd}, you get your team’s numbers.`,
  },
]

export default function TeamChallengePage() {
  const open = signupOpen()
  const ended = roundEnded()
  const c = TEAM_CHALLENGE

  return (
    <div className="street">
      <Nav variant="light" street />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        {/* Summary and the form, side by side from lg. */}
        <section className="px-4 pb-12 pt-10 sm:px-6 md:pt-14 lg:px-8 lg:pb-16">
          <div className="mx-auto grid max-w-[1120px] gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
            <div>
              <div className="inline-flex flex-col rounded-[18px] bg-forest px-6 pb-7 pt-5 text-white sm:px-8">
                <p className="text-[16px] leading-snug">
                  <b className="block sm:inline">{c.label.range}</b>
                  <span className="sm:ml-3">Free for Massachusetts workplaces</span>
                </p>
                <h1 className="mt-3 max-w-[620px] font-headline text-[clamp(2.1rem,5vw,3.4rem)] font-extrabold leading-[1.04] tracking-[-0.01em]">
                  {ended ? 'This round has ended' : 'A three-week commute challenge for your team'}
                </h1>
                {ended && (
                  <Link href="/shift/employers" className="mt-4 inline-flex min-h-[48px] w-fit items-center rounded-full bg-white px-6 text-[16px] font-bold text-navy hover:opacity-90">
                    See Shift for Employers &rarr;
                  </Link>
                )}
              </div>
              <p className={`mt-7 max-w-[620px] ${BODY}`}>
                Your team joins Green Streets Initiative&rsquo;s statewide {c.label.monthName} challenge, which ends on Walk/Ride Day, {c.label.wrd}. Staff download the free Shift app and join with your invite code. The app records their trips by itself, so nobody logs anything by hand.
              </p>

              {open && (
                <a
                  href="#sign-up"
                  className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-navy px-7 text-[17px] font-bold text-white hover:opacity-90 sm:w-auto lg:hidden"
                >
                  Get your invite code &rarr;
                </a>
              )}

              <ul className="mt-5 flex flex-wrap gap-2" aria-label="What counts">
                {MODES.map(({ icon: Icon, label }) => (
                  <li key={label} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border-2 border-forest/25 bg-white px-3 text-[15px] font-bold text-navy">
                    <Icon size={18} weight="bold" className="shrink-0 text-forest" aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>

              <h2 className="mt-8 text-[16px] font-bold text-navy">What it does for your workplace</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {OUTCOMES.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 rounded-[12px] bg-white px-4 py-3 text-[16px] font-bold leading-snug text-navy">
                    <Icon size={24} weight="duotone" className="mt-px shrink-0 text-forest" aria-hidden />
                    {text}
                  </li>
                ))}
              </ul>

            </div>

            <div id="sign-up" className="scroll-mt-24">
              {open ? (
                <SignupForm />
              ) : (
                <div className="rounded-[16px] border-2 border-navy/[0.12] bg-white p-6 sm:p-8">
                  <h2 className={H3}>Sign-ups for {c.label.monthName} have closed</h2>
                  <p className={`mt-3 ${BODY}`}>
                    Walk/Ride Day happens every month. Tell us you&rsquo;d like your team in the next one and we&rsquo;ll send a code.
                  </p>
                  <Link
                    href="/shift/employers#inquiry"
                    className="mt-5 inline-flex min-h-[48px] items-center rounded-full bg-navy px-7 text-[16px] font-bold text-white hover:opacity-90"
                  >
                    Ask about the next one &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t-2 border-navy/[0.1] bg-white px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
          <div className="mx-auto max-w-[1120px]">
            <h2 className={H2}>How it works</h2>
            <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-forest font-headline text-[18px] font-extrabold text-white" aria-hidden>
                    {i + 1}
                  </span>
                  <div>
                    <h3 className={H3}>{s.title}</h3>
                    <p className={`mt-2 ${BODY}`}>{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* What comes with the code: the challenge is the way in, not the whole program. */}
        <section className="px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
          <div className="mx-auto max-w-[1120px]">
            <h2 className={H2}>What comes with your invite code</h2>
            <p className={`mt-3 max-w-[680px] ${BODY}`}>The challenge is the start. Your invite code also opens these, at no cost. Add your office address in your portal and the office tools are set up for you.</p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <Tool icon={ChartLineUp} title="Your team’s numbers">
                {c.label.afterEnd}: how many took part, the trips they made, how they got there and the emissions they saved. Each person&rsquo;s trips stay private.
              </Tool>
              <Tool icon={Signpost} title="Commute Advisor for your office" href="/commute-advisor/demo" linkLabel="See an example">
                Each person compares ways to get to work, with the time and cost of each.
              </Tool>
              <Tool icon={MapTrifold} title="Nearby page for your office" href="/nearby" linkLabel="Open Nearby">
                Live transit, Bluebikes and bike paths around your office, with a printable version for the lobby.
              </Tool>
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-[14px] border-2 border-navy/[0.12] bg-white px-5 py-4">
              <ClipboardText size={24} weight="duotone" className="mt-0.5 shrink-0 text-forest" aria-hidden />
              <p className="text-[16px] leading-[1.55] text-navy">
                <b>Filing a commute plan with Cambridge, Boston or MassDEP?</b> We also run the employee commute survey it needs.{' '}
                <Link href="/shift/employers#inquiry" className="font-bold text-forest underline-offset-4 hover:underline">Ask us</Link>
              </p>
            </div>
          </div>
        </section>

        {/* For staff: GSI's drawing. Joining late. The year-round link. */}
        <section className="border-t-2 border-navy/[0.1] bg-white px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-[1120px] gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center md:gap-10">
            <div className="flex gap-3">
              <Ticket size={28} weight="duotone" className="mt-0.5 shrink-0 text-forest" aria-hidden />
              <div>
                <h2 className={H3}>A drawing for your staff</h2>
                <p className={`mt-2 ${BODY}`}>
                  On {c.label.wrd}, every trip also enters them in GSI&rsquo;s gift card drawing, which GSI pays for.{' '}
                  <Link href={c.rulesPath} className="font-bold text-forest underline-offset-4 hover:underline">Official rules</Link>
                </p>
              </div>
            </div>
            <div>
              <h2 className={H3}>Joining late is fine</h2>
              <p className={`mt-2 ${BODY}`}>Teams can join part-way through, up to {c.label.lastJoin}.</p>
            </div>
            {open && (
              <a
                href="#sign-up"
                className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-full bg-navy px-7 text-[16px] font-bold text-white hover:opacity-90"
              >
                Get your invite code &rarr;
              </a>
            )}
          </div>
          <p className="mx-auto mt-10 max-w-[1120px] text-[15px] text-ink-soft">
            Want this all year?{' '}
            <Link href="/shift/employers" className="font-bold text-forest underline-offset-4 hover:underline">
              See Shift for Employers
            </Link>
          </p>
        </section>
      </main>
      <Footer variant="light" />
    </div>
  )
}

function Tool({
  icon: Icon,
  title,
  href,
  linkLabel,
  children,
}: {
  icon: typeof ChartLineUp
  title: string
  href?: string
  linkLabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col rounded-[14px] border-2 border-navy/[0.12] bg-white p-5">
      <Icon size={30} weight="duotone" className="text-forest" aria-hidden />
      <h3 className={`mt-3 ${H3}`}>{title}</h3>
      <p className={`mt-2 flex-1 ${BODY}`}>{children}</p>
      {href && (
        <Link href={href} className="mt-3 text-[15px] font-bold text-forest underline-offset-4 hover:underline">
          {linkLabel} &rarr;
        </Link>
      )}
    </div>
  )
}
