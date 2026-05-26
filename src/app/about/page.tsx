import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import FadeIn from '@/components/FadeIn'

export const metadata = {
  title: 'About — Green Streets Initiative',
  description:
    'Founded in 2006. Twenty years of community. Now technology-enabled. How GSI is helping people shift trips to healthier, more affordable, and more fun alternatives.',
}

/* ═══════════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════════ */

const paradoxStats = [
  { value: '57%', label: 'of Massachusetts trips are under three miles' },
  { value: '80%', label: 'of those short trips are still made by car' },
  { value: '4.7M', label: 'Bluebikes trips in 2024 — double the 2019 level' },
  { value: '4×', label: 'MassCEC e-bike rebate applications vs. vouchers available' },
  { value: '#5', label: "Boston’s national rank for traffic congestion" },
  { value: '$850M', label: 'MBTA capital investment in bus and ferry upgrades' },
]

const researchStats = [
  { value: '30+', label: 'Stakeholder interviews' },
  { value: '42', label: 'Practitioner surveys' },
  { value: '74', label: 'Public surveys' },
  { value: '35+', label: 'Organizations mapped' },
]

const themes = [
  {
    num: '01',
    title: 'Behavior change is an underserved layer.',
    body: 'The advocacy ecosystem has matured around infrastructure and policy. What’s missing is the behavioral layer: helping people actually try alternatives, making it fun and rewarding, and building lasting habits.',
  },
  {
    num: '02',
    title: 'Schools are high-potential, underserved.',
    body: 'Both surveys ranked school-based active transportation programming as the area of greatest untapped potential. Multiple stakeholders pointed to K–12 as an impactful and highly fundable lane.',
  },
  {
    num: '03',
    title: 'Measurement is a priority.',
    body: 'Municipalities, MPOs, and foundations emphasized that measurable outcomes matter more than awareness. Data on actual trips shifted is what unlocks sustained support.',
  },
]

const ecosystemRows = [
  {
    layer: 'Advocacy & Policy',
    who: 'LivableStreets, MassBike, WalkMass, T4MA, TransitMatters, BCU',
    rel: 'We amplify their work. Our data strengthens their case.',
  },
  {
    layer: 'Employer Commutes',
    who: 'MassCommute, 17 TMAs, Agile Mile',
    rel: 'We complement TMAs — serving all trip types and all segments.',
  },
  {
    layer: 'School Infrastructure',
    who: 'MassDOT SRTS (1,300+ schools)',
    rel: 'We provide the sustained engagement infrastructure investments need.',
  },
  {
    layer: 'Community & Culture',
    who: 'Hubluv, Bikes Not Bombs, Memorial Drive Alliance',
    rel: 'Partners for events, cross-promotion, and shared audiences.',
  },
  {
    layer: 'Behavior Change',
    who: 'Green Streets Initiative',
    rel: 'This is our focus. Rewards, guides, challenges, storytelling, impact data.',
    highlight: true,
  },
]

const receptiveMoments = [
  { event: 'New job', channel: 'Employer onboarding' },
  { event: 'New home', channel: 'Realtor partnerships & welcome packets' },
  { event: 'School starts', channel: 'Shift for Schools & back-to-school campaigns' },
  { event: 'Summer begins', channel: 'Shift Your Summer' },
]

const journeySteps = [
  { title: 'Receptive\nMoment', sub: 'Life transitions, Commute Advisor' },
  { title: 'First\nTry', sub: 'School programs, Roams, group rides' },
  { title: 'First\nShift', sub: 'An active trip appears on your dashboard' },
  { title: 'Change\nCycle', sub: 'Barrier → nudge → resource → reinforce' },
  { title: 'Sustained\nShift', sub: 'Habit formation, ongoing engagement' },
]

const programs = [
  {
    num: '01',
    name: 'Shift Platform',
    desc: 'A free mobile app that detects and classifies trips automatically, rewards active choices with XP and local discounts, and shows your personal impact in real time. Includes the Commute Advisor and curated Roam adventures.',
  },
  {
    num: '02',
    name: 'Shift for Schools',
    desc: 'K–12 classroom challenges, volunteer-led walk and bike buses, route planning assistance, and safe route maps. Includes SRTS pipeline integration. Free to every participating school.',
  },
  {
    num: '03',
    name: 'Employer & Community',
    desc: 'Private groups, customized Commute Advisor, funded reward pools, ESG reporting. Plus Shift Your Summer and Shift Your September flagship campaigns.',
  },
  {
    num: '04',
    name: 'What Moves Us',
    desc: 'First-person video paired with Shift trip data to illuminate why habits change. Commissioned by cities, planning agencies, TMAs, and developers.',
  },
]

const supportRows = [
  {
    who: 'Municipalities',
    give: 'Commission a What Moves Us campaign · Sponsor a community challenge · Include Shift in welcome packets',
    get: 'Mode-shift data for grant applications · Polished campaign deliverables & impact reports',
  },
  {
    who: 'Peer Organizations',
    give: 'Use Shift for your challenges · Run a What Moves Us campaign · Promote the Commute Advisor',
    get: 'Cross-promote events in the app · Help running challenges on Shift',
  },
  {
    who: 'TMAs',
    give: 'Offer Shift as a complement to commute programs · Help us reach employers',
    get: 'All-trip-type data for your reporting · A platform that serves beyond commutes',
  },
  {
    who: 'Employers',
    give: 'Sponsor a flagship campaign · Set up a private Shift group · Fund prizes',
    get: 'ESG-ready impact reporting · Co-branded visibility · Sustainability summaries',
  },
  {
    who: 'Foundations',
    give: 'Fund school programming · Underwrite a What Moves Us campaign · Support core operations',
    get: 'Measurable outcomes from a technology-enabled model',
  },
]

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main>
        {/* ────────────────────────────────────────────────
            1 · HERO
        ──────────────────────────────────────────────── */}
        <section className="relative flex min-h-screen flex-col justify-end overflow-hidden bg-[#1a3a2a] px-[clamp(1.5rem,5vw,6rem)] pb-16 pt-[60px]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_70%,rgba(59,165,122,0.08)_0%,transparent_60%)]" />
          <div className="relative z-10 max-w-[800px]">
            <FadeIn>
              <p className="mb-8 font-sans text-[0.7rem] font-medium uppercase tracking-[0.25em] text-white/60">
                Strategic Vision &nbsp;&middot;&nbsp; Spring 2026
              </p>
            </FadeIn>
            <FadeIn delay={0.15}>
              <h1 className="mb-8 font-serif text-[clamp(3rem,8vw,6rem)] font-normal leading-[1.05] text-[#f8f6f1]">
                2026<br />and <em className="text-[#b8e6ce]">Beyond</em>
              </h1>
            </FadeIn>
            <FadeIn delay={0.3}>
              <p className="max-w-[540px] font-serif text-[clamp(1.1rem,2.5vw,1.4rem)] italic leading-relaxed text-white/75">
                Helping people shift trips to healthier, more affordable, and more fun
                alternatives. Measuring the impact, trip by trip, community by community.
              </p>
            </FadeIn>
            <FadeIn delay={0.45}>
              <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3">
                <a
                  href="/GSI_Strategic_Vision_2026.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-sans text-[0.8rem] font-medium text-[#b8e6ce] underline underline-offset-2 transition-opacity hover:opacity-80"
                >
                  Download the Strategic Vision (PDF)
                </a>
                <span className="hidden items-center gap-4 sm:flex">
                  <span className="font-sans text-[0.75rem] uppercase tracking-[0.15em] text-white/60">
                    gogreenstreets.org
                  </span>
                  <span className="h-px w-10 bg-white/20" />
                  <span className="flex items-center gap-1.5">
                    <span className="font-sans text-[1.1rem] font-bold text-[#b8e6ce]">Green Streets</span>
                    <span className="font-sans text-[1.1rem] font-light text-white/80">Initiative</span>
                  </span>
                </span>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ────────────────────────────────────────────────
            2 · OUR STORY
        ──────────────────────────────────────────────── */}
        <section className="bg-[#f8f6f1] px-[clamp(1.5rem,5vw,6rem)] py-16">
          <div className="mx-auto max-w-[960px]">
            <FadeIn>
              <div className="grid grid-cols-[3px_1fr] items-start gap-6">
                <div className="mt-1 h-full w-[3px] rounded-sm bg-[#3BA57A]" />
                <div>
                  <p className="mb-4 font-serif text-[clamp(1.15rem,2.5vw,1.4rem)] leading-relaxed text-[#1a1a1a]">
                    Green Streets Initiative was founded in 2006 by Janie Katz-Christy to make
                    active transportation a visible, celebrated part of daily life in Greater Boston.
                    For twenty years, GSI built community around walking, biking, and transit through
                    events, storytelling, and grassroots advocacy.
                  </p>
                  <p className="font-sans text-[0.95rem] leading-[1.7] text-[#3a3f48]">
                    Now under new leadership, GSI is bringing that foundation into a
                    technology-enabled model designed to scale &mdash; anchored by <strong>Shift</strong>,
                    a mobile platform that makes active transportation fun, rewarding, and
                    measurable. The mission hasn&apos;t changed. The tools have.
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ────────────────────────────────────────────────
            3 · THE PARADOX
        ──────────────────────────────────────────────── */}
        <section className="bg-[#fdfcf9] px-[clamp(1.5rem,5vw,6rem)] py-20">
          <div className="mx-auto max-w-[960px]">
            <FadeIn>
              <p className="mb-2 font-sans text-[0.7rem] font-medium uppercase tracking-[0.2em] text-[#3BA57A]">
                Part One &middot; The Landscape
              </p>
              <h2 className="mb-6 font-serif text-[clamp(2rem,5vw,3.2rem)] font-normal leading-[1.1] tracking-tight text-[#1a1a1a]">
                The Paradox
              </h2>
            </FadeIn>
            <FadeIn delay={0.1}>
              <p className="mb-2 max-w-[700px] font-serif text-[clamp(1.3rem,3vw,1.8rem)] italic leading-[1.4] text-[#1a1a1a]">
                It has never been easier to choose active transportation.
              </p>
              <p className="mb-12 font-sans text-base text-[#6b7280]">
                The question is why more people don&apos;t &mdash; and what would help them start.
              </p>
            </FadeIn>
            <FadeIn delay={0.15}>
              <hr className="m-0 border-t border-[#d4d0c8]" />
              <div className="grid grid-cols-2 lg:grid-cols-3">
                {paradoxStats.map((s, i) => (
                  <div key={i} className="p-6 text-center">
                    <div className="mb-1 font-serif text-[clamp(2rem,4vw,3rem)] font-normal leading-none text-[#3BA57A]">
                      {s.value}
                    </div>
                    <div className="mx-auto max-w-[180px] font-sans text-[0.8rem] leading-[1.4] text-[#6b7280]">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
              <hr className="m-0 border-t border-[#d4d0c8]" />
            </FadeIn>
          </div>
        </section>

        {/* ────────────────────────────────────────────────
            4 · WHAT WE HEARD
        ──────────────────────────────────────────────── */}
        <section className="bg-[#f8f6f1] px-[clamp(1.5rem,5vw,6rem)] py-20">
          <div className="mx-auto max-w-[960px]">
            <FadeIn>
              <p className="mb-2 font-sans text-[0.7rem] font-medium uppercase tracking-[0.2em] text-[#3BA57A]">
                Part One &middot; The Landscape
              </p>
              <h2 className="mb-4 font-serif text-[clamp(2rem,5vw,3.2rem)] font-normal leading-[1.1] tracking-tight text-[#1a1a1a]">
                What We Heard
              </h2>
              <p className="mb-4 font-serif text-[1.25rem] italic text-[#1a1a1a]">
                Three months of listening.
              </p>
              <p className="mb-10 max-w-[640px] font-sans text-[0.95rem] leading-[1.7] text-[#3a3f48]">
                A structured research process to assess the Greater Boston active transportation
                landscape: key challenges, where the gaps are, and where we can best help.
              </p>
            </FadeIn>
            <FadeIn delay={0.1}>
              <div className="mb-12 grid grid-cols-2 gap-6 lg:grid-cols-4">
                {researchStats.map((s, i) => (
                  <div key={i} className="p-6 text-center">
                    <div className="mb-1 font-serif text-[clamp(2rem,4vw,3rem)] font-normal leading-none text-[#3BA57A]">
                      {s.value}
                    </div>
                    <div className="mx-auto max-w-[180px] font-sans text-[0.8rem] leading-[1.4] text-[#6b7280]">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </FadeIn>
            <hr className="m-0 border-t border-[#d4d0c8]" />
            <div className="mt-10">
              {themes.map((t, i) => (
                <FadeIn key={i} delay={0.1 * i}>
                  <div className="mb-8 grid grid-cols-[3rem_1fr] items-start gap-4">
                    <span className="font-serif text-[2rem] leading-none text-[#3BA57A]">
                      {t.num}
                    </span>
                    <div>
                      <h3 className="mb-1 font-sans text-[1.05rem] font-semibold text-[#1a1a1a]">
                        {t.title}
                      </h3>
                      <p className="font-sans text-[0.9rem] leading-[1.7] text-[#3a3f48]">
                        {t.body}
                      </p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ────────────────────────────────────────────────
            5 · WHERE WE FIT
        ──────────────────────────────────────────────── */}
        <section className="bg-[#fdfcf9] px-[clamp(1.5rem,5vw,6rem)] py-20">
          <div className="mx-auto max-w-[960px]">
            <FadeIn>
              <p className="mb-2 font-sans text-[0.7rem] font-medium uppercase tracking-[0.2em] text-[#3BA57A]">
                Part One &middot; The Landscape
              </p>
              <h2 className="mb-4 font-serif text-[clamp(2rem,5vw,3.2rem)] font-normal leading-[1.1] tracking-tight text-[#1a1a1a]">
                Where We Fit
              </h2>
              <p className="mb-10 font-serif text-[1.25rem] italic text-[#1a1a1a]">
                A complementary layer.
              </p>
            </FadeIn>
            <FadeIn delay={0.1}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse font-sans text-[0.85rem]">
                  <thead>
                    <tr className="border-b-2 border-[#1a1a1a]">
                      <th className="p-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
                        Layer
                      </th>
                      <th className="p-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
                        Who&apos;s Active
                      </th>
                      <th className="p-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
                        GSI&apos;s Relationship
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ecosystemRows.map((r, i) => (
                      <tr
                        key={i}
                        className={`border-b border-[#d4d0c8] ${r.highlight ? 'bg-[#3BA57A]/[0.06]' : ''}`}
                      >
                        <td className={`whitespace-nowrap p-3 ${r.highlight ? 'font-semibold text-[#3BA57A]' : 'font-medium text-[#1a1a1a]'}`}>
                          {r.layer}
                        </td>
                        <td className="p-3 text-[#3a3f48]">{r.who}</td>
                        <td className={`p-3 text-[#3a3f48] ${r.highlight ? 'font-semibold' : ''}`}>
                          {r.rel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ────────────────────────────────────────────────
            6 · THEORY OF CHANGE
        ──────────────────────────────────────────────── */}
        <section className="bg-[#1a3a2a] px-[clamp(1.5rem,5vw,6rem)] py-20">
          <div className="mx-auto max-w-[960px]">
            <FadeIn>
              <p className="mb-2 font-sans text-[0.7rem] font-medium uppercase tracking-[0.2em] text-[#3BA57A]">
                Part Two &middot; How It Works
              </p>
              <h2 className="mb-6 font-serif text-[clamp(2rem,5vw,3.2rem)] font-normal leading-[1.1] tracking-tight text-[#f8f6f1]">
                The journey to<br /><em className="text-[#b8e6ce]">first shift.</em>
              </h2>
              <p className="mb-12 max-w-[640px] font-sans text-[0.95rem] leading-[1.7] text-white/75">
                Behavior change starts with a receptive moment. GSI meets people at that moment
                with a first experience &mdash; and keeps them engaged after the first shift.
              </p>
            </FadeIn>

            {/* Receptive moments */}
            <FadeIn delay={0.1}>
              <p className="mb-3 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-white/60">
                Receptive Moments We Target
              </p>
              <div className="mb-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {receptiveMoments.map((m, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="mb-1 font-sans text-[0.9rem] font-semibold text-[#f8f6f1]">
                      {m.event}
                    </div>
                    <div className="font-sans text-[0.75rem] leading-[1.4] text-white/60">
                      {m.channel}
                    </div>
                  </div>
                ))}
              </div>
            </FadeIn>

            {/* Journey steps */}
            <FadeIn delay={0.15}>
              <div className="no-scrollbar flex items-start gap-0 overflow-x-auto pb-4">
                {journeySteps.map((s, i) => (
                  <div key={i} className="flex shrink-0 items-center">
                    <div
                      className="w-[130px] rounded-lg border border-[#3BA57A]/20 p-4 text-center"
                      style={{ background: `rgba(59,165,122,${0.08 + i * 0.04})` }}
                    >
                      <div className="mb-2 whitespace-pre-line font-sans text-[0.85rem] font-bold leading-[1.3] text-[#f8f6f1]">
                        {s.title}
                      </div>
                      <div className="font-sans text-[0.7rem] leading-[1.4] text-white/60">
                        {s.sub}
                      </div>
                    </div>
                    {i < journeySteps.length - 1 && (
                      <span className="mx-1.5 shrink-0 text-[1.2rem] text-[#3BA57A]">&rsaquo;</span>
                    )}
                  </div>
                ))}
              </div>
            </FadeIn>

            {/* North Star */}
            <FadeIn delay={0.25}>
              <div className="mt-12 rounded-r-md border-l-[3px] border-[#3BA57A] bg-[#3BA57A]/[0.08] p-6">
                <p className="mb-2 font-sans text-[0.85rem] font-semibold uppercase tracking-[0.1em] text-[#3BA57A]">
                  North Star Metric
                </p>
                <p className="font-serif text-[1.15rem] leading-relaxed text-[#f8f6f1]">
                  Our north star is <strong>trips shifted</strong>. Every trip generates outcomes we can
                  report: money saved, fitness gained, emissions avoided, congestion reduced.
                </p>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ────────────────────────────────────────────────
            7 · OUR PROGRAMS
        ──────────────────────────────────────────────── */}
        <section className="bg-[#f8f6f1] px-[clamp(1.5rem,5vw,6rem)] py-20">
          <div className="mx-auto max-w-[960px]">
            <FadeIn>
              <p className="mb-2 font-sans text-[0.7rem] font-medium uppercase tracking-[0.2em] text-[#3BA57A]">
                Part Two &middot; How It Works
              </p>
              <h2 className="mb-6 font-serif text-[clamp(2rem,5vw,3.2rem)] font-normal leading-[1.1] tracking-tight text-[#1a1a1a]">
                Four programs, working together.
              </h2>
            </FadeIn>
            <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-2">
              {programs.map((p, i) => (
                <FadeIn key={i} delay={0.08 * i}>
                  <div className="h-full rounded-lg border border-[#d4d0c8] bg-[#fdfcf9] p-6">
                    <span className="mb-2 block font-serif text-[1.8rem] text-[#3BA57A]">
                      {p.num}
                    </span>
                    <h3 className="mb-2 font-sans text-[1.05rem] font-bold text-[#1a1a1a]">
                      {p.name}
                    </h3>
                    <p className="font-sans text-[0.85rem] leading-[1.7] text-[#3a3f48]">
                      {p.desc}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ────────────────────────────────────────────────
            8 · FLAGSHIP CAMPAIGNS
        ──────────────────────────────────────────────── */}
        <section className="bg-[#fdfcf9] px-[clamp(1.5rem,5vw,6rem)] py-20">
          <div className="mx-auto max-w-[960px]">
            <FadeIn>
              <p className="mb-2 font-sans text-[0.7rem] font-medium uppercase tracking-[0.2em] text-[#3BA57A]">
                Part Three &middot; The Year Ahead
              </p>
              <h2 className="mb-6 font-serif text-[clamp(2rem,5vw,3.2rem)] font-normal leading-[1.1] tracking-tight text-[#1a1a1a]">
                Two seasonal windows.
              </h2>
            </FadeIn>
            <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-2">
              <FadeIn delay={0.1}>
                <div className="rounded-lg border-t-[3px] border-t-[#3BA57A] bg-[#f8f6f1] p-8">
                  <h3 className="mb-1 font-serif text-[1.6rem] text-[#1a1a1a]">
                    Shift Your Summer
                  </h3>
                  <p className="mb-4 font-sans text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[#3BA57A]">
                    June &ndash; August 2026
                  </p>
                  <p className="mb-4 font-sans text-[0.9rem] leading-[1.7] text-[#3a3f48]">
                    The season when active transportation is most accessible. A community-wide
                    challenge with neighborhood leaderboards, employer team challenges, and
                    prizes.
                  </p>
                  <p className="font-sans text-[0.8rem] italic leading-relaxed text-[#6b7280]">
                    Curated Roams: The Bakery Run &middot; The Emerald Necklace Ride &middot;
                    The Charles Loop &middot; Harbor Walk to Eastie Eats &middot; The Freedom Trail
                  </p>
                </div>
              </FadeIn>
              <FadeIn delay={0.2}>
                <div className="rounded-lg border-t-[3px] border-t-[#3BA57A] bg-[#f8f6f1] p-8">
                  <h3 className="mb-1 font-serif text-[1.6rem] text-[#1a1a1a]">
                    Shift Your September
                  </h3>
                  <p className="mb-4 font-sans text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[#3BA57A]">
                    September 2026
                  </p>
                  <p className="font-sans text-[0.9rem] leading-[1.7] text-[#3a3f48]">
                    September 1 is move-in day across the region. Back-to-school is when families
                    establish new routines and school programs launch. These are receptive moments &mdash;
                    Shift Your September brings schools, employers, and communities together under
                    one banner.
                  </p>
                </div>
              </FadeIn>
            </div>
            <FadeIn delay={0.25}>
              <p className="mt-8 font-sans text-[0.85rem] font-semibold leading-[1.7] text-[#1a1a1a]">
                Both campaigns are open for presenting sponsors and community partners.
                Each includes co-branded visibility, social content, and a post-campaign
                impact report with measurable outcomes.
              </p>
            </FadeIn>
          </div>
        </section>

        {/* ────────────────────────────────────────────────
            9 · HOW YOU CAN SUPPORT US
        ──────────────────────────────────────────────── */}
        <section className="bg-[#1a3a2a] px-[clamp(1.5rem,5vw,6rem)] py-20">
          <div className="mx-auto max-w-[960px]">
            <FadeIn>
              <p className="mb-2 font-sans text-[0.7rem] font-medium uppercase tracking-[0.2em] text-[#3BA57A]">
                Part Three &middot; The Year Ahead
              </p>
              <h2 className="mb-6 font-serif text-[clamp(2rem,5vw,3.2rem)] font-normal leading-[1.1] tracking-tight text-[#f8f6f1]">
                How you can support GSI &mdash;<br />
                <em className="text-[#b8e6ce]">and how we can support you.</em>
              </h2>
            </FadeIn>

            {/* Desktop: grid table */}
            <div className="mt-4 hidden md:block">
              {/* Header row */}
              <div className="grid grid-cols-[160px_1fr_1fr] gap-6 border-b border-white/25 py-3">
                <span />
                <span className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-white/60">
                  How you can support us
                </span>
                <span className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-white/60">
                  How we can support you
                </span>
              </div>
              {/* Data rows */}
              {supportRows.map((a, i) => (
                <FadeIn key={i} delay={0.06 * i}>
                  <div className="grid grid-cols-[160px_1fr_1fr] items-start gap-6 border-b border-white/10 py-5">
                    <span className="font-sans text-[0.85rem] font-semibold text-[#f8f6f1]">
                      {a.who}
                    </span>
                    <p className="font-sans text-[0.8rem] leading-[1.7] text-white/75">
                      {a.give}
                    </p>
                    <p className="font-sans text-[0.8rem] leading-[1.7] text-[#b8e6ce]">
                      {a.get}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>

            {/* Mobile: stacked cards */}
            <div className="mt-4 flex flex-col gap-6 md:hidden">
              {supportRows.map((a, i) => (
                <FadeIn key={i} delay={0.06 * i}>
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                    <h3 className="mb-3 font-sans text-[0.95rem] font-semibold text-[#f8f6f1]">
                      {a.who}
                    </h3>
                    <p className="mb-1 font-sans text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-white/60">
                      How you can support us
                    </p>
                    <p className="mb-4 font-sans text-[0.8rem] leading-[1.7] text-white/75">
                      {a.give}
                    </p>
                    <p className="mb-1 font-sans text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-white/60">
                      How we can support you
                    </p>
                    <p className="font-sans text-[0.8rem] leading-[1.7] text-[#b8e6ce]">
                      {a.get}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ────────────────────────────────────────────────
            10 · FOOTER CTA
        ──────────────────────────────────────────────── */}
        <section className="border-t border-white/10 bg-[#1a3a2a] px-[clamp(1.5rem,5vw,6rem)] py-16">
          <div className="mx-auto max-w-[960px] text-center">
            <FadeIn>
              <h2 className="mb-1 font-serif text-[clamp(2rem,5vw,3.5rem)] font-normal text-[#f8f6f1]">
                Help make <em className="text-[#b8e6ce]">shift</em> happen.
              </h2>
              <p className="mt-5 font-sans text-base text-white/75">
                Looking for ways to get involved?
              </p>
              <p className="mx-auto mb-10 mt-2 max-w-[480px] font-sans text-[0.9rem] leading-[1.7] text-white/60">
                Download Shift and start tracking your trips. Tell a school, an employer, or
                a local business. Become a Rewards Partner. Join the Board. Make a tax-deductible donation.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="https://www.gogreenstreets.org/app"
                  className="inline-block rounded-md bg-[#b8e6ce] px-6 py-3 font-sans text-[0.85rem] font-semibold text-[#1a3a2a] no-underline transition-opacity hover:opacity-85"
                >
                  Download Shift
                </Link>
                <Link
                  href="/donate"
                  className="inline-block rounded-md border border-white/30 bg-transparent px-6 py-3 font-sans text-[0.85rem] font-semibold text-[#f8f6f1] no-underline transition-opacity hover:opacity-85"
                >
                  Support GSI
                </Link>
              </div>
              <a
                href="/GSI_Strategic_Vision_2026.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-block font-sans text-[0.8rem] text-white/60 underline underline-offset-2 transition-opacity hover:opacity-80"
              >
                Download the full Strategic Vision (PDF)
              </a>
            </FadeIn>

            {/* Branding footer */}
            <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-8">
              <div>
                <span className="font-sans text-base font-bold text-[#b8e6ce]">Green Streets </span>
                <span className="font-sans text-base font-light text-white/75">Initiative</span>
              </div>
              <div className="font-sans text-[0.75rem] text-white/60">
                501(c)(3) nonprofit &nbsp;&middot;&nbsp; keith@gogreenstreets.org
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
