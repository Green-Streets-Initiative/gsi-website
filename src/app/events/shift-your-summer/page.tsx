import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import CountdownTimer from '@/components/CountdownTimer'
import RefreshButton from '@/components/RefreshButton'
import WaitlistForm from '@/components/WaitlistForm'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// This is a live leaderboard — always fetch fresh data, never use cached HTML.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Shift Your Summer — Live Leaderboard | Green Streets Initiative',
  description:
    'Track Boston\u2019s biggest commuter challenge. See who\u2019s shifting the most trips to walking, biking, and transit this summer.',
}

/* ── types ─────────────────────────────────────────────────── */

interface Standing {
  user_id: string
  display_name: string
  avatar_url: string | null
  total_trips: number
  non_car_trips: number
  pct_non_car: number
}

interface Prize {
  id: string
  place: number
  prize_type: string
  description: string
  value_amount: number | null
}

interface Sponsor {
  id: string
  name: string
  logo_url: string | null
  website_url: string | null
}

interface Sponsorship {
  id: string
  sponsorship_level: string
  sponsors: Sponsor | null
}

interface Competition {
  id: string
  name: string
  description: string
  metric: string
  starts_at: string
  ends_at: string
  is_public: boolean
  sponsor_name: string | null
  sponsor_logo_url: string | null
  prizes_json: unknown
  event_sponsorships: Sponsorship[]
}

type PageState = 'upcoming' | 'active' | 'coming-soon'

/* ── helpers ───────────────────────────────────────────────── */

const APP_LAUNCHED = process.env.NEXT_PUBLIC_APP_LAUNCHED === 'true'

function formatDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', timeZone: 'America/New_York' }
  const startStr = new Date(start).toLocaleDateString('en-US', opts)
  const endStr = new Date(end).toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  return `${startStr} \u2013 ${endStr}`
}

function metricLabel(metric: string) {
  const map: Record<string, string> = {
    pct_non_car: 'Ranked by Shift Rate',
    trips: 'Ranked by active trips',
    miles: 'Ranked by miles shifted',
    active_days: 'Ranked by active days',
  }
  return map[metric] ?? 'Ranked by Shift Rate'
}

function shiftRateColor(pct: number) {
  if (pct >= 80) return 'text-[#EDB93C]'
  if (pct >= 60) return 'text-[#BAF14D]'
  if (pct >= 40) return 'text-[#2966E5]'
  return 'text-white'
}

function rankBorder(rank: number) {
  if (rank === 1) return 'border-l-[3px] border-l-[#EDB93C]'
  if (rank === 2) return 'border-l-[3px] border-l-[#C0C0C0]'
  if (rank === 3) return 'border-l-[3px] border-l-[#CD7F32]'
  return 'border-l-[3px] border-l-transparent'
}

/* ── page ──────────────────────────────────────────────────── */

export default async function ShiftYourSummerPage() {
  const supabase = createServerSupabaseClient()
  const now = new Date().toISOString()

  // Fetch the most relevant public flagship event
  // Cast to Competition: Supabase infers FK joins as arrays but PostgREST returns
  // a single object for forward FKs (event_sponsorships.sponsor_id → sponsors.id)
  const { data: competitionRaw } = await supabase
    .from('competitions')
    .select(`
      id, name, description, metric, starts_at, ends_at,
      is_public, sponsor_name, sponsor_logo_url, prizes_json,
      event_sponsorships (
        id, sponsorship_level,
        sponsors (
          id, name, logo_url, website_url
        )
      )
    `)
    .eq('is_public', true)
    .is('group_id', null)
    .gte('ends_at', now)
    .order('starts_at', { ascending: true })
    .limit(1)
    .single()
  const competition = competitionRaw as unknown as Competition | null

  // Determine page state
  let state: PageState = 'coming-soon'
  if (competition) {
    const startsAt = new Date(competition.starts_at).getTime()
    const nowMs = Date.now()
    state = startsAt > nowMs ? 'upcoming' : 'active'
  }

  // Fetch additional data for active/upcoming states
  let standings: Standing[] = []
  let participantCount = 0
  let prizes: Prize[] = []

  if (competition && state === 'active') {
    const [standingsRes, countRes, prizesRes] = await Promise.all([
      supabase.rpc('get_competition_standings', {
        p_competition_id: competition.id,
      }),
      supabase
        .from('competition_participants')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', competition.id),
      supabase
        .from('competition_prizes')
        .select('id, place, prize_type, description, value_amount')
        .eq('competition_id', competition.id)
        .eq('prize_type', 'individual')
        .order('place', { ascending: true }),
    ])
    standings = (standingsRes.data ?? []).slice(0, 25)
    participantCount = countRes.count ?? 0
    prizes = prizesRes.data ?? []
  } else if (competition && state === 'upcoming') {
    const { data } = await supabase
      .from('competition_prizes')
      .select('id, place, prize_type, description, value_amount')
      .eq('competition_id', competition.id)
      .eq('prize_type', 'individual')
      .order('place', { ascending: true })
    prizes = data ?? []
  }

  const sponsors: Sponsorship[] = competition?.event_sponsorships ?? []

  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>
        {state === 'coming-soon' && <ComingSoon />}
        {state === 'upcoming' && competition && (
          <UpcomingEvent
            competition={competition}
            prizes={prizes}
            sponsors={sponsors}
          />
        )}
        {state === 'active' && competition && (
          <ActiveEvent
            competition={competition}
            standings={standings}
            participantCount={participantCount}
            prizes={prizes}
            sponsors={sponsors}
          />
        )}
      </main>
      <Footer />
    </>
  )
}

/* ── State C: Coming Soon ─────────────────────────────────── */

function ComingSoon() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#191A2E] px-8 py-24 md:py-32">
        <GradientBg />
        <div className="relative mx-auto max-w-[720px] text-center">
          <Eyebrow>Flagship Events</Eyebrow>
          <h1 className="mb-6 font-display text-[clamp(2.5rem,5vw,3.75rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
            The next challenge is coming.
          </h1>
          <p className="mx-auto mb-10 max-w-[580px] text-lg leading-[1.7] text-white">
            Shift flagship events bring Greater Boston commuters together to compete, move, and win real prizes. Join the waitlist to be first to know when the next event launches.
          </p>
          <WaitlistForm />
        </div>
      </section>

      {/* Explainer */}
      <section className="bg-[#242538] px-8 py-20">
        <div className="mx-auto max-w-[720px] text-center">
          <h2 className="mb-4 font-display text-2xl font-bold tracking-tight text-white">
            What are flagship events?
          </h2>
          <p className="mb-8 text-[1.0625rem] leading-[1.7] text-white">
            Multi-month, city-wide challenges where commuters across Greater Boston compete to shift trips from driving to walking, biking, and transit. Top finishers win real prizes from local sponsors.
          </p>
          <Link
            href="/shift"
            className="text-sm font-semibold text-[#BAF14D]"
          >
            Learn more about Shift &rarr;
          </Link>
        </div>
      </section>
    </>
  )
}

/* ── State A: Upcoming Event ──────────────────────────────── */

function UpcomingEvent({
  competition,
  prizes,
  sponsors,
}: {
  competition: Competition
  prizes: Prize[]
  sponsors: Sponsorship[]
}) {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#191A2E] px-8 py-24 md:py-32">
        <GradientBg />
        <div className="relative mx-auto max-w-[1120px]">
          <div className="max-w-[640px]">
            <Eyebrow>
              Flagship Event &middot; {new Date(competition.starts_at).getFullYear()}
            </Eyebrow>
            <h1 className="mb-4 font-display text-[clamp(2.5rem,5vw,3.75rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              {competition.name}
            </h1>
            <p className="mb-5 text-lg leading-[1.7] text-white">
              {competition.description}
            </p>
            <p className="mb-3 text-sm font-semibold text-white">
              {formatDateRange(competition.starts_at, competition.ends_at)}
            </p>
            <MetricBadge metric={competition.metric} />
            <div className="mt-8">
              <CountdownTimer targetDate={competition.starts_at} />
            </div>
          </div>
          <PresentedBy sponsors={sponsors} />
        </div>
      </section>

      {/* Placeholder leaderboard */}
      <section className="bg-[#191A2E] px-8 py-20">
        <div className="mx-auto max-w-[800px] text-center">
          <div className="rounded-[18px] border border-white/[0.08] bg-[#242538] px-8 py-16">
            <h2 className="mb-3 font-display text-2xl font-bold tracking-tight text-white">
              Be the first on the board
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-[1.7] text-white">
              The challenge hasn&apos;t started yet. Download Shift and be ready to compete from day one.
            </p>
            <CtaButtons />
          </div>
        </div>
      </section>

      {prizes.length > 0 && <PrizesSection prizes={prizes} />}
      {sponsors.length > 0 && <SponsorsSection sponsors={sponsors} />}
      <HowToJoin />
      <CtaSection />
    </>
  )
}

/* ── State B: Active Event ────────────────────────────────── */

function ActiveEvent({
  competition,
  standings,
  participantCount,
  prizes,
  sponsors,
}: {
  competition: Competition
  standings: Standing[]
  participantCount: number
  prizes: Prize[]
  sponsors: Sponsorship[]
}) {
  const leader = standings[0]

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#191A2E] px-8 py-24 md:py-32">
        <GradientBg />
        <div className="relative mx-auto max-w-[1120px]">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <Eyebrow>
                Flagship Event &middot; {new Date(competition.starts_at).getFullYear()}
              </Eyebrow>
              <h1 className="mb-4 font-display text-[clamp(2.5rem,5vw,3.75rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
                {competition.name}
              </h1>
              <p className="mb-5 text-lg leading-[1.7] text-white">
                {competition.description}
              </p>
              <p className="mb-3 text-sm font-semibold text-white">
                {formatDateRange(competition.starts_at, competition.ends_at)}
              </p>
              <MetricBadge metric={competition.metric} />
              <div className="mt-8">
                <CtaButtons />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-6 py-5">
                <span className="font-display text-3xl font-extrabold text-white">
                  {participantCount.toLocaleString()}
                </span>
                <span className="ml-2 text-sm text-white">people competing</span>
              </div>
              {leader && (
                <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-6 py-5">
                  <span className="text-sm text-white">#1 right now: </span>
                  <span className="font-display text-lg font-bold text-white">
                    {leader.display_name}
                  </span>
                  <span className="ml-2 text-sm text-[#EDB93C]">
                    {Math.round(leader.pct_non_car)}% Shift Rate
                  </span>
                </div>
              )}
              <PresentedBy sponsors={sponsors} />
            </div>
          </div>
        </div>
      </section>

      {/* Leaderboard */}
      <section className="bg-[#191A2E] px-8 py-20">
        <div className="mx-auto max-w-[900px]">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                Live standings
              </h2>
              <p className="mt-1 text-sm text-white">
                Updated when you load this page.
              </p>
            </div>
            <RefreshButton />
          </div>

          <div className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#242538]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs font-semibold uppercase tracking-wider text-white">
                    <th className="w-16 py-3.5 pr-2 text-right pl-5">Rank</th>
                    <th className="py-3.5 px-4">Name</th>
                    <th className="py-3.5 px-4 text-right">Shift Rate</th>
                    <th className="hidden py-3.5 px-4 text-right md:table-cell pr-5">
                      Active Trips
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((entry, i) => {
                    const rank = i + 1
                    return (
                      <tr
                        key={entry.user_id}
                        className={`${rankBorder(rank)} ${
                          i % 2 === 1 ? 'bg-white/[0.02]' : ''
                        } border-b border-white/[0.05] last:border-b-0`}
                      >
                        <td className="py-3 pr-2 text-right pl-5">
                          <span
                            className={`font-display text-base font-bold ${
                              rank <= 3 ? 'text-[#EDB93C]' : 'text-white'
                            }`}
                          >
                            {rank}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-white">
                          {entry.display_name}
                        </td>
                        <td className={`py-3 px-4 text-right font-display font-bold ${shiftRateColor(entry.pct_non_car)}`}>
                          {Math.round(entry.pct_non_car)}%
                        </td>
                        <td className="hidden py-3 px-4 text-right text-white md:table-cell pr-5">
                          {entry.non_car_trips}
                        </td>
                      </tr>
                    )
                  })}

                  {/* Filler rows if fewer than 10 entries */}
                  {standings.length < 10 &&
                    Array.from({ length: Math.max(0, 10 - standings.length) }).map(
                      (_, i) => (
                        <tr
                          key={`filler-${i}`}
                          className={`border-l-[3px] border-l-transparent ${
                            (standings.length + i) % 2 === 1
                              ? 'bg-white/[0.02]'
                              : ''
                          } border-b border-white/[0.05] last:border-b-0`}
                        >
                          <td className="py-3 pr-2 text-right text-white pl-5">
                            {standings.length + i + 1}
                          </td>
                          <td className="py-3 px-4 text-white">&mdash;</td>
                          <td className="py-3 px-4 text-right text-white">
                            &mdash;
                          </td>
                          <td className="hidden py-3 px-4 text-right text-white md:table-cell pr-5">
                            &mdash;
                          </td>
                        </tr>
                      )
                    )}
                </tbody>
              </table>
            </div>

            {standings.length < 10 && (
              <p className="border-t border-white/[0.06] px-6 py-4 text-center text-sm text-white">
                The board is just getting started. Be one of the first.
              </p>
            )}
          </div>
        </div>
      </section>

      {prizes.length > 0 && <PrizesSection prizes={prizes} />}
      {sponsors.length > 0 && <SponsorsSection sponsors={sponsors} />}
      <HowToJoin />
      <CtaSection />
    </>
  )
}

/* ── Shared Sections ──────────────────────────────────────── */

function PrizesSection({ prizes }: { prizes: Prize[] }) {
  const placeLabel = (n: number) => {
    if (n === 1) return '1st place'
    if (n === 2) return '2nd place'
    if (n === 3) return '3rd place'
    return `${n}th place`
  }
  const placeColor = (n: number) => {
    if (n === 1) return 'text-[#EDB93C] border-[#EDB93C]/20 bg-[#EDB93C]/5'
    if (n === 2) return 'text-[#C0C0C0] border-[#C0C0C0]/20 bg-[#C0C0C0]/5'
    if (n === 3) return 'text-[#CD7F32] border-[#CD7F32]/20 bg-[#CD7F32]/5'
    return 'text-white border-white/10 bg-white/[0.03]'
  }

  return (
    <section className="bg-[#191A2E] px-8 py-20">
      <div className="mx-auto max-w-[900px]">
        <h2 className="mb-10 font-display text-2xl font-bold tracking-tight text-white">
          What&apos;s at stake
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {prizes.map(prize => (
            <div
              key={prize.id}
              className={`rounded-[14px] border p-6 ${placeColor(prize.place)}`}
            >
              <div className="mb-3 text-sm font-bold uppercase tracking-wider">
                {placeLabel(prize.place)}
              </div>
              <p className="text-[0.9375rem] leading-[1.6] text-white">
                {prize.description}
              </p>
              {prize.value_amount != null && prize.value_amount > 0 && (
                <p className="mt-2 text-sm text-white">
                  ~${prize.value_amount}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SponsorLogo({ sponsor, className }: { sponsor: Sponsor; className: string }) {
  const inner = sponsor.logo_url ? (
    <img
      src={sponsor.logo_url}
      alt={sponsor.name}
      className={`object-contain brightness-0 invert opacity-70 hover:opacity-100 transition-opacity ${className}`}
    />
  ) : (
    <span className="font-semibold text-white">{sponsor.name}</span>
  )
  return sponsor.website_url ? (
    <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    <div>{inner}</div>
  )
}

function SponsorsSection({ sponsors }: { sponsors: Sponsorship[] }) {
  const presenting = sponsors.filter(s => s.sponsorship_level === 'presenting' && s.sponsors)
  const communityPartners = sponsors.filter(s => s.sponsorship_level === 'community_partner' && s.sponsors)
  const supporting = sponsors.filter(s => s.sponsorship_level === 'supporting' && s.sponsors)

  if (sponsors.length === 0) return null

  return (
    <section className="bg-[#191A2E] px-8 py-20 border-t border-white/[0.08]">
      <div className="mx-auto max-w-[900px] space-y-12">
        {presenting.length > 0 && (
          <div>
            <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-white/50">
              Presenting Sponsor
            </p>
            <div className="flex flex-wrap items-center gap-10">
              {presenting.map(s => (
                <SponsorLogo key={s.id} sponsor={s.sponsors!} className="h-14 max-w-[200px]" />
              ))}
            </div>
          </div>
        )}
        {communityPartners.length > 0 && (
          <div>
            <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-white/50">
              Community Partners
            </p>
            <div className="flex flex-wrap items-center gap-8">
              {communityPartners.map(s => (
                <SponsorLogo key={s.id} sponsor={s.sponsors!} className="h-9 max-w-[140px]" />
              ))}
            </div>
          </div>
        )}
        {supporting.length > 0 && (
          <div>
            <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-white/50">
              Supporting Partners
            </p>
            <div className="flex flex-wrap items-center gap-6">
              {supporting.map(s => (
                <SponsorLogo key={s.id} sponsor={s.sponsors!} className="h-6 max-w-[100px]" />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function HowToJoin() {
  const steps = [
    {
      num: '1',
      title: 'Download Shift',
      body: 'Available on iOS and Android. Join the challenge from the Events tab.',
    },
    {
      num: '2',
      title: 'Take active trips',
      body: 'Walk, bike, or ride transit. Shift detects your trips automatically.',
    },
    {
      num: '3',
      title: 'Climb the board',
      body: 'Your Shift Rate updates in real time. Top finishers win prizes.',
    },
  ]

  return (
    <section className="bg-[#242538] px-8 py-20">
      <div className="mx-auto max-w-[900px]">
        <h2 className="mb-10 font-display text-2xl font-bold tracking-tight text-white">
          How to join
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map(s => (
            <div key={s.num} className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-7">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#BAF14D]/15 font-display text-sm font-extrabold text-[#BAF14D]">
                {s.num}
              </div>
              <h3 className="mb-2 font-display text-base font-bold text-white">
                {s.title}
              </h3>
              <p className="text-[0.9375rem] leading-[1.6] text-white">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CtaSection() {
  return (
    <section className="bg-[#191A2E] px-8 py-24">
      <div className="mx-auto max-w-[560px] text-center">
        <h2 className="mb-4 font-display text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
          Ready to compete?
        </h2>
        {APP_LAUNCHED ? (
          <>
            <p className="mb-10 text-lg leading-relaxed text-white">
              Download Shift, join the challenge, and start earning your spot on the board.
            </p>
            <AppStoreButtons />
          </>
        ) : (
          <>
            <p className="mb-10 text-lg leading-relaxed text-white">
              Shift launches this summer. Join the waitlist and we&apos;ll notify you the moment the challenge goes live.
            </p>
            <WaitlistForm />
          </>
        )}
      </div>
    </section>
  )
}

/* ── Small shared components ──────────────────────────────── */

function GradientBg() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(186,241,77,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(186,241,77,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="absolute -right-[10%] top-[10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(186,241,77,0.07)_0%,transparent_70%)]" />
      <div className="absolute -left-[5%] bottom-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(237,185,60,0.05)_0%,transparent_70%)]" />
    </div>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 inline-flex items-center gap-2">
      <svg viewBox="0 0 36 28" width="20" height="13" className="shrink-0">
        <path d="M0,1 L16,14 L0,27 L0,20 L10,14 L0,8Z" fill="#BAF14D" />
        <path d="M19,1 L35,14 L19,27 L19,20 L29,14 L19,8Z" fill="#2966E5" />
      </svg>
      <span className="font-display text-xs font-bold uppercase tracking-[0.15em] text-[#BAF14D]">
        {children}
      </span>
    </div>
  )
}

function MetricBadge({ metric }: { metric: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold text-white">
      <svg viewBox="0 0 12 12" width="12" height="12" fill="currentColor">
        <path d="M6 0l1.76 3.57L12 4.14 8.82 7.02l.94 4.98L6 10.02 2.24 12l.94-4.98L0 4.14l4.24-.57z" />
      </svg>
      {metricLabel(metric)}
    </span>
  )
}

function PresentedBy({ sponsors }: { sponsors: Sponsorship[] }) {
  if (sponsors.length === 0) return null
  const presenting = sponsors.find(s => s.sponsorship_level === 'presenting')
  const sponsor = presenting?.sponsors ?? sponsors[0]?.sponsors
  if (!sponsor) return null

  return (
    <div className="mt-6 flex items-center gap-3 text-sm text-white">
      <span>Presented by</span>
      {sponsor.logo_url ? (
        <img
          src={sponsor.logo_url}
          alt={sponsor.name}
          className="h-6 max-w-[120px] object-contain brightness-0 invert opacity-60"
        />
      ) : (
        <span className="font-semibold text-white">{sponsor.name}</span>
      )}
    </div>
  )
}

function CtaButtons() {
  if (APP_LAUNCHED) return <AppStoreButtons />
  return (
    <Link
      href="#cta"
      className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
    >
      Join the challenge &rarr;
    </Link>
  )
}

function AppStoreButtons() {
  return (
    <div className="flex items-center justify-center gap-4">
      <a
        href="#"
        className="inline-flex items-center gap-2 rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#191A2E">
          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
        Download for iOS
      </a>
      <a
        href="#"
        className="inline-flex items-center gap-2 rounded-full border border-white/[0.15] bg-white/[0.06] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
          <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.832l2.46 1.42c.55.32.55 1.09 0 1.41l-2.46 1.42-2.534-2.534 2.534-2.534v.818zm-3.906-2.54L4.864 3.378l10.928 6.328-2.302 2.302.303.327z" />
        </svg>
        Download for Android
      </a>
    </div>
  )
}
