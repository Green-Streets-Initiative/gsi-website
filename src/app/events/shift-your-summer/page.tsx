import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import CountdownTimer from '@/components/CountdownTimer'
import RefreshButton from '@/components/RefreshButton'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { withUtm, slugify } from '@/lib/utm'
import LeaderboardTabs, { type GroupStanding } from './LeaderboardTabs'
import {
  brandLabel,
  EntryTypePill,
  type EligibilityCriteria,
  type Prize,
  type PrizeEntryType,
  type PrizeTier,
} from './_lib/prizes'

// This is a live leaderboard — always fetch fresh data, never use cached HTML.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Shift Your Summer — Live Leaderboard | Green Streets Initiative',
  description:
    'Track Massachusetts\u2019s biggest commuter challenge. See who\u2019s shifting the most trips to walking, biking, and transit this summer.',
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

type SponsorTier = 'presenting' | 'champion' | 'community'

interface Sponsor {
  id: string
  name: string
  logo_url: string | null
  website_url: string | null
}

interface Sponsorship {
  id: string
  sponsorship_level: string
  // New 3-tier source of truth. Falls back to mapping from sponsorship_level
  // when the new column hasn't been backfilled (shouldn't happen post-migration).
  tier: SponsorTier | null
  display_order: number
  sponsors: Sponsor | null
}

function tierFromLegacy(level: string): SponsorTier {
  switch (level) {
    case 'presenting': return 'presenting'
    case 'champion':   return 'champion'
    case 'community_partner':
    case 'supporting':
    default:           return 'community'
  }
}

function resolveSponsorTier(s: Sponsorship): SponsorTier {
  return s.tier ?? tierFromLegacy(s.sponsorship_level)
}

interface Competition {
  id: string
  name: string
  description: string
  metric: string
  starts_at: string
  ends_at: string
  is_public: boolean
  matchup_group_ids: string[] | null
  sponsor_name: string | null
  sponsor_logo_url: string | null
  prizes_json: unknown
  event_sponsorships: Sponsorship[]
}

type PageState = 'upcoming' | 'active' | 'ended' | 'coming-soon'

/* ── helpers ───────────────────────────────────────────────── */

// Mirrors the gate in /rules/page.tsx — keeps the "official rules" link out
// of the public UI until the legal [TBD] blocks on the rules page are
// populated. Flip both this and the rules page on by setting
// NEXT_PUBLIC_RULES_PUBLISHED=true.
const RULES_PUBLISHED = process.env.NEXT_PUBLIC_RULES_PUBLISHED === 'true'

function formatDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', timeZone: 'America/New_York' }
  const startStr = new Date(start).toLocaleDateString('en-US', opts)
  const endStr = new Date(end).toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  return `${startStr} \u2013 ${endStr}`
}

function shiftRateColor(pct: number) {
  if (pct >= 80) return 'text-[#EDB93C]'
  if (pct >= 60) return 'text-[#BAF14D]'
  if (pct >= 40) return 'text-[#2966E5]'
  return 'text-white'
}


/* ── page ──────────────────────────────────────────────────── */

export default async function ShiftYourSummerPage() {
  const supabase = createServerSupabaseClient()

  // Fetch recent public Shift-Your-Summer events (incl. ended ones) and pick
  // the most relevant: prefer currently-active, else next upcoming, else most
  // recently ended. Limit 5 is a generous ceiling — there should normally be
  // one or two matching rows.
  const { data: competitionsRaw } = await supabase
    .from('competitions')
    .select(`
      id, name, description, metric, starts_at, ends_at,
      is_public, matchup_group_ids, sponsor_name, sponsor_logo_url, prizes_json,
      event_sponsorships (
        id, sponsorship_level, tier, display_order,
        sponsors (
          id, name, logo_url, website_url
        )
      )
    `)
    .eq('is_public', true)
    .is('group_id', null)
    .like('name', '%Shift Your Summer%')
    .order('starts_at', { ascending: false })
    .limit(5)

  const competitions = (competitionsRaw ?? []) as unknown as Competition[]
  const nowMs = Date.now()
  const competition: Competition | null =
    competitions.find(c => {
      const s = new Date(c.starts_at).getTime()
      const e = new Date(c.ends_at).getTime()
      return s <= nowMs && e >= nowMs
    }) ??
    competitions.find(c => new Date(c.starts_at).getTime() > nowMs) ??
    competitions[0] ??
    null

  // Determine page state
  let state: PageState = 'coming-soon'
  if (competition) {
    const startsAt = new Date(competition.starts_at).getTime()
    const endsAt = new Date(competition.ends_at).getTime()
    state =
      endsAt < nowMs ? 'ended'
      : startsAt > nowMs ? 'upcoming'
      : 'active'
  }

  // Fetch additional data for active/upcoming states
  let standings: Standing[] = []
  let groupStandings: GroupStanding[] = []
  let participantCount = 0
  let prizes: Prize[] = []

  if (competition && (state === 'active' || state === 'ended')) {
    const groupIds = competition.matchup_group_ids ?? []
    const [standingsRes, groupStandingsRes, countRes, prizesRes] = await Promise.all([
      supabase.rpc('get_competition_standings', { p_competition_id: competition.id }),
      groupIds.length > 0
        ? supabase.rpc('get_event_standings', {
            p_competition_id: competition.id,
            p_group_ids: groupIds,
            p_days: 90,
            p_only_public: true,
          })
        : Promise.resolve({ data: [] }),
      supabase
        .from('competition_participants')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', competition.id),
      supabase
        .from('competition_prizes')
        .select('id, place, prize_type, description, value_amount, funded_by_sponsorship_id, tier, display_order, brand_name_override, image_url, product_url, entry_type, eligibility_criteria, quantity, funder:funded_by_sponsorship_id(id, sponsors(id, name, logo_url, website_url))')
        .eq('competition_id', competition.id)
        .eq('prize_type', 'individual')
        .order('place', { ascending: true }),
    ])
    standings = (standingsRes.data ?? []).slice(0, 25)
    groupStandings = ((groupStandingsRes as any).data ?? []).map((row: any) => ({
      groupId: row.group_id,
      groupName: row.group_name,
      groupType: row.group_type,
      logoUrl: row.logo_url ?? null,
      shiftRate: Number(row.shift_rate) || 0,
      activeTrips: Number(row.active_trips) || 0,
      memberCount: Number(row.member_count) || 0,
    }))
    participantCount = countRes.count ?? 0
    prizes = (prizesRes.data ?? []).map((row: any) => {
      // Supabase returns the !inner / foreign-key join as an array even when
      // cardinality is 1. Flatten so Prize.funder is the single record (or null).
      const funderRaw = row.funder
      const funder = Array.isArray(funderRaw) ? (funderRaw[0] ?? null) : (funderRaw ?? null)
      const sponsorRaw = funder?.sponsors
      const sponsor = Array.isArray(sponsorRaw) ? (sponsorRaw[0] ?? null) : (sponsorRaw ?? null)
      return {
        id: row.id,
        place: row.place,
        prize_type: row.prize_type,
        description: row.description,
        value_amount: row.value_amount,
        funded_by_sponsorship_id: row.funded_by_sponsorship_id ?? null,
        tier: (row.tier ?? 'standard') as PrizeTier,
        display_order: row.display_order ?? 0,
        brand_name_override: row.brand_name_override ?? null,
        image_url: row.image_url ?? null,
        product_url: row.product_url ?? null,
        quantity: row.quantity ?? 1,
        entry_type: (row.entry_type ?? "achievement_gated") as PrizeEntryType,
        eligibility_criteria: (row.eligibility_criteria ?? null) as EligibilityCriteria | null,
        funder: funder ? { id: funder.id, sponsors: sponsor } : null,
      } as Prize
    })
  } else if (competition && state === 'upcoming') {
    const { data } = await supabase
      .from('competition_prizes')
      .select('id, place, prize_type, description, value_amount, funded_by_sponsorship_id, tier, display_order, brand_name_override, image_url, product_url, entry_type, eligibility_criteria, quantity, funder:funded_by_sponsorship_id(id, sponsors(id, name, logo_url, website_url))')
      .eq('competition_id', competition.id)
      .eq('prize_type', 'individual')
      .order('place', { ascending: true })
    prizes = (data ?? []).map((row: any) => {
      const funderRaw = row.funder
      const funder = Array.isArray(funderRaw) ? (funderRaw[0] ?? null) : (funderRaw ?? null)
      const sponsorRaw = funder?.sponsors
      const sponsor = Array.isArray(sponsorRaw) ? (sponsorRaw[0] ?? null) : (sponsorRaw ?? null)
      return {
        id: row.id,
        place: row.place,
        prize_type: row.prize_type,
        description: row.description,
        value_amount: row.value_amount,
        funded_by_sponsorship_id: row.funded_by_sponsorship_id ?? null,
        tier: (row.tier ?? 'standard') as PrizeTier,
        display_order: row.display_order ?? 0,
        brand_name_override: row.brand_name_override ?? null,
        image_url: row.image_url ?? null,
        product_url: row.product_url ?? null,
        quantity: row.quantity ?? 1,
        entry_type: (row.entry_type ?? "achievement_gated") as PrizeEntryType,
        eligibility_criteria: (row.eligibility_criteria ?? null) as EligibilityCriteria | null,
        funder: funder ? { id: funder.id, sponsors: sponsor } : null,
      } as Prize
    })
  }

  const sponsors: Sponsorship[] = competition?.event_sponsorships ?? []
  const geoStandings = groupStandings.filter(s => s.groupType === 'town' || s.groupType === 'neighborhood')
  const corpStandings = groupStandings.filter(s => s.groupType === 'workplace' || s.groupType === 'school')
  const aggregateLabel = computeAggregateLabel(prizes)
  const totalActiveTrips = standings.reduce((sum, s) => sum + s.non_car_trips, 0)

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
            aggregateLabel={aggregateLabel}
          />
        )}
        {state === 'active' && competition && (
          <ActiveEvent
            competition={competition}
            standings={standings}
            geoStandings={geoStandings}
            corpStandings={corpStandings}
            participantCount={participantCount}
            prizes={prizes}
            sponsors={sponsors}
            aggregateLabel={aggregateLabel}
            totalActiveTrips={totalActiveTrips}
          />
        )}
        {state === 'ended' && competition && (
          <EndedEvent
            competition={competition}
            standings={standings}
            geoStandings={geoStandings}
            corpStandings={corpStandings}
            participantCount={participantCount}
            prizes={prizes}
            sponsors={sponsors}
            aggregateLabel={aggregateLabel}
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
            Shift flagship events bring Massachusetts commuters together to compete, move, and win real prizes. Download the app to get started.
          </p>
          <JoinChallengeCta phase="coming-soon" />
        </div>
      </section>

      {/* Explainer */}
      <section className="bg-[#242538] px-8 py-20">
        <div className="mx-auto max-w-[720px] text-center">
          <h2 className="mb-4 font-display text-2xl font-bold tracking-tight text-white">
            What are flagship events?
          </h2>
          <p className="mb-8 text-[1.0625rem] leading-[1.7] text-white">
            Multi-month, city-wide challenges where commuters across Massachusetts shift trips from driving to walking, biking, and transit. Local sponsors put up real prizes, awarded through drawings throughout the event.
          </p>
          <Link
            href="/shift"
            className="text-sm font-semibold text-[#BAF14D]"
          >
            Learn more about Shift &rarr;
          </Link>
        </div>
      </section>

      <RulesLink />
      <PartnerCrossLink />
    </>
  )
}

/* ── State A: Upcoming Event ──────────────────────────────── */

function UpcomingEvent({
  competition,
  prizes,
  sponsors,
  aggregateLabel,
}: {
  competition: Competition
  prizes: Prize[]
  sponsors: Sponsorship[]
  aggregateLabel: string | null
}) {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#191A2E] px-8 pt-24 md:pt-32 pb-4 md:pb-6">
        <GradientBg />
        <div className="relative mx-auto max-w-[1120px]">
          <div className="flex max-w-[640px] flex-col">
            <Eyebrow>
              Flagship Event &middot; {new Date(competition.starts_at).getFullYear()}
            </Eyebrow>
            <h1 className="order-1 mb-4 font-display text-[clamp(2.5rem,5vw,3.75rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              {competition.name}
            </h1>
            <p className="order-2 mb-5 text-lg leading-[1.7] text-white">
              {competition.description}
            </p>
            <p className="order-3 mb-3 text-sm font-semibold text-white">
              {formatDateRange(competition.starts_at, competition.ends_at)}
            </p>
            {aggregateLabel && (
              <div className="order-4 mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#BAF14D]/30 bg-[#BAF14D]/10 px-3.5 py-1.5">
                <span className="text-sm font-bold text-[#BAF14D]">{aggregateLabel}</span>
              </div>
            )}

            {/* Download card — directly under the date */}
            <div className="order-5 mt-6">
              <div className="rounded-[18px] border border-white/[0.08] bg-[#242538] px-8 py-10 text-center">
                <h2 className="mb-3 font-display text-2xl font-bold tracking-tight text-white">
                  Be the first on the board
                </h2>
                <p className="mb-8 text-[1.0625rem] leading-[1.7] text-white">
                  The challenge hasn&apos;t started yet. Download Shift and be ready to compete from day one.
                </p>
                <JoinChallengeCta phase="upcoming" />
              </div>
            </div>

            {/* Secondary links */}
            <div className="order-6 mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <ShareChallengeLink />
              <Link
                href="/shift/employers"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/75 transition-colors hover:text-white"
              >
                Running a team? <span className="text-[#BAF14D]">Employer platform &rarr;</span>
              </Link>
            </div>

            {/* Countdown — below the download card */}
            <div className="order-7 mt-8">
              <CountdownTimer targetDate={competition.starts_at} />
            </div>
          </div>
        </div>
      </section>

      {prizes.length > 0 && <PrizeSection prizes={prizes} eventCampaign={slugify(competition.name)} aggregateLabel={aggregateLabel} />}
      <SponsorSection sponsors={sponsors} eventCampaign={slugify(competition.name)} />
      <HowToJoin />
      <RulesLink />
      <PartnerCrossLink />
      <CtaSection phase="upcoming" />
    </>
  )
}

/* ── State B: Active Event ────────────────────────────────── */

function ActiveEvent({
  competition,
  standings,
  geoStandings,
  corpStandings,
  participantCount,
  prizes,
  sponsors,
  aggregateLabel,
  totalActiveTrips,
}: {
  competition: Competition
  standings: Standing[]
  geoStandings: GroupStanding[]
  corpStandings: GroupStanding[]
  participantCount: number
  prizes: Prize[]
  sponsors: Sponsorship[]
  aggregateLabel: string | null
  totalActiveTrips: number
}) {
  const leader = standings[0]
  const isEarlyState = totalActiveTrips === 0

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#191A2E] px-8 py-16 md:py-24">
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
            {aggregateLabel && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#BAF14D]/30 bg-[#BAF14D]/10 px-3.5 py-1.5">
                <span className="text-sm font-bold text-[#BAF14D]">{aggregateLabel}</span>
              </div>
            )}
            <div className="mt-8 space-y-3">
              <JoinChallengeCta phase="active" />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <ShareChallengeLink />
                <Link
                  href="/shift/employers"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/75 transition-colors hover:text-white"
                >
                  Running a team? <span className="text-[#BAF14D]">Employer platform &rarr;</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Leaderboard */}
      <section className="bg-[#191A2E] px-8 pb-16 pt-4">
        <div className="mx-auto max-w-[900px]">
          {isEarlyState ? (
            <EarlyStateCard participantCount={participantCount} />
          ) : (
            <>
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                    Live standings
                  </h2>
                  <p className="mt-1 text-sm text-white/75">
                    Updated when you load this page.
                  </p>
                </div>
                <RefreshButton />
              </div>

              <div className="mb-4 flex flex-wrap gap-3">
                <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5">
                  <span className="font-display text-lg font-extrabold text-white">
                    {participantCount.toLocaleString()}
                  </span>
                  <span className="ml-1.5 text-sm text-white/60">people participating</span>
                </div>
                {leader && leader.pct_non_car > 0 && (
                  <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5">
                    <span className="text-sm text-white/60">#1 right now: </span>
                    <span className="font-display text-sm font-bold text-white">
                      {leader.display_name || 'Shift user'}
                    </span>
                    <span className="ml-1.5 text-sm text-[#EDB93C]">
                      {Math.round(leader.pct_non_car)}% Shift Rate
                    </span>
                  </div>
                )}
              </div>

              <LeaderboardTabs
                geoStandings={geoStandings}
                corpStandings={corpStandings}
                individualStandings={standings}
                participantCount={participantCount}
              />
            </>
          )}
        </div>
      </section>

      {prizes.length > 0 && <PrizeSection prizes={prizes} eventCampaign={slugify(competition.name)} aggregateLabel={aggregateLabel} />}
      <SponsorSection sponsors={sponsors} eventCampaign={slugify(competition.name)} />
      <HowToJoin />
      <RulesLink />
      <PartnerCrossLink />
      <CtaSection phase="active" />
    </>
  )
}

/* ── State D: Ended Event ─────────────────────────────────── */

function EndedEvent({
  competition,
  standings,
  geoStandings,
  corpStandings,
  participantCount,
  prizes,
  sponsors,
  aggregateLabel,
}: {
  competition: Competition
  standings: Standing[]
  geoStandings: GroupStanding[]
  corpStandings: GroupStanding[]
  participantCount: number
  prizes: Prize[]
  sponsors: Sponsorship[]
  aggregateLabel: string | null
}) {
  const leader = standings[0]
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#191A2E] px-8 py-16 md:py-24">
        <GradientBg />
        <div className="relative mx-auto max-w-[1120px]">
          <div className="max-w-[640px]">
            <Eyebrow>
              Flagship Event &middot; {new Date(competition.starts_at).getFullYear()}
            </Eyebrow>
            <h1 className="mb-4 font-display text-[clamp(2.5rem,5vw,3.75rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              {competition.name}
            </h1>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#BAF14D]/40 bg-[#BAF14D]/[0.08] px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-[#BAF14D]">
              Challenge complete
            </div>
            <p className="mb-5 text-lg leading-[1.7] text-white">
              {competition.description}
            </p>
            <p className="mb-3 text-sm font-semibold text-white">
              {formatDateRange(competition.starts_at, competition.ends_at)}
            </p>
            {aggregateLabel && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#BAF14D]/30 bg-[#BAF14D]/10 px-3.5 py-1.5">
                <span className="text-sm font-bold text-[#BAF14D]">{aggregateLabel}</span>
              </div>
            )}
            <p className="mt-2 text-xs font-medium text-white/60">
              Green Streets Initiative &middot; moving Massachusetts since 2006
            </p>
            <div className="mt-8 space-y-3">
              <JoinChallengeCta phase="ended" />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <ShareChallengeLink />
                <Link
                  href="/shift/employers"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/75 transition-colors hover:text-white"
                >
                  Running a team? <span className="text-[#BAF14D]">Employer platform &rarr;</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final standings */}
      <section className="bg-[#191A2E] px-8 pb-16 pt-4">
        <div className="mx-auto max-w-[900px]">
          <div className="mb-4">
            <h2 className="font-display text-2xl font-bold tracking-tight text-white">
              Final standings
            </h2>
            <p className="mt-1 text-sm text-white/75">
              Challenge complete. Shift Your September is up next.
            </p>
          </div>

          <div className="mb-4 flex flex-wrap gap-3">
            <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5">
              <span className="font-display text-lg font-extrabold text-white">
                {participantCount.toLocaleString()}
              </span>
              <span className="ml-1.5 text-sm text-white/75">people participated</span>
            </div>
            {leader && (
              <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5">
                <span className="text-sm text-white/75">Winner: </span>
                <span className="font-display text-sm font-bold text-white">
                  {leader.display_name || 'Shift user'}
                </span>
                <span className="ml-1.5 text-sm text-[#EDB93C]">
                  {Math.round(leader.pct_non_car)}% Shift Rate
                </span>
              </div>
            )}
          </div>

          <LeaderboardTabs
            geoStandings={geoStandings}
            corpStandings={corpStandings}
            individualStandings={standings}
            participantCount={participantCount}
          />
        </div>
      </section>

      {prizes.length > 0 && <PrizeSection prizes={prizes} eventCampaign={slugify(competition.name)} aggregateLabel={aggregateLabel} />}
      <SponsorSection sponsors={sponsors} eventCampaign={slugify(competition.name)} />
      <RulesLink />
      <PartnerCrossLink />
      <CtaSection phase="ended" />
    </>
  )
}

/* ── Shared Sections ──────────────────────────────────────── */

/* ── SponsorSection ─────────────────────────────────────────
 * Three-tier display: Presenting (full-width hero card) → Champion
 * (2-up grid, larger logos) → Community (4-up grid, smaller logos).
 * White-card logo treatment so dark marks read on the navy bg.
 * Empty Presenting tier shows a soft "become the presenting sponsor"
 * CTA. Empty Champion / Community tiers hide entirely.
 */
function SponsorSection({
  sponsors,
  eventCampaign,
}: {
  sponsors: Sponsorship[]
  eventCampaign: string
}) {
  const tiered = sponsors
    .filter(s => s.sponsors)
    .map(s => ({ ...s, _tier: resolveSponsorTier(s) }))
    .sort((a, b) => a.display_order - b.display_order)

  const presenting = tiered.filter(s => s._tier === 'presenting')
  const champion = tiered.filter(s => s._tier === 'champion')
  const community = tiered.filter(s => s._tier === 'community')

  if (sponsors.length === 0 && presenting.length === 0) return null

  return (
    <section className="bg-[#191A2E] px-8 pt-12 pb-12 border-t border-white/[0.08]">
      <div className="mx-auto max-w-[1120px]">
        <h2 className="mb-2 font-display text-2xl font-bold tracking-tight text-white">
          Partners &amp; sponsors
        </h2>
        <p className="mb-10 text-sm text-white/75">
          Made possible by these organizations
        </p>

        {/* Presenting */}
        {presenting.length > 0 && (
          <div className="mb-10">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/70">
              Presenting Sponsor
            </p>
            <div className="grid gap-4">
              {presenting.map(s => (
                <SponsorTile key={s.id} sponsor={s.sponsors!} size="presenting" eventCampaign={eventCampaign} />
              ))}
            </div>
          </div>
        )}

        {/* Champion */}
        {champion.length > 0 && (
          <div className="mb-10">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/70">
              Champion
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {champion.map(s => (
                <SponsorTile key={s.id} sponsor={s.sponsors!} size="champion" eventCampaign={eventCampaign} />
              ))}
            </div>
          </div>
        )}

        {/* Community */}
        {community.length > 0 && (
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/70">
              Community
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {community.map(s => (
                <SponsorTile key={s.id} sponsor={s.sponsors!} size="community" eventCampaign={eventCampaign} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function SponsorTile({
  sponsor,
  size,
  eventCampaign,
}: {
  sponsor: Sponsor
  size: 'presenting' | 'champion' | 'community'
  eventCampaign: string
}) {
  const tileHeight =
    size === 'presenting' ? 'h-[120px]' : size === 'champion' ? 'h-[80px]' : 'h-[64px]'
  const logoMax =
    size === 'presenting'
      ? 'max-h-[88px] max-w-[85%]'
      : size === 'champion'
        ? 'max-h-[56px] max-w-[85%]'
        : 'max-h-[44px] max-w-[85%]'
  const inner = sponsor.logo_url ? (
    <img
      src={sponsor.logo_url}
      alt={sponsor.name}
      className={`${logoMax} object-contain`}
    />
  ) : (
    <span className="px-3 text-center text-sm font-semibold text-[#191A2E]">
      {sponsor.name}
    </span>
  )
  const tile = (
    <div
      className={`${tileHeight} flex items-center justify-center rounded-[14px] bg-white px-4 py-3`}
    >
      {inner}
    </div>
  )
  const taggedUrl = withUtm(sponsor.website_url, {
    medium: 'event_page',
    campaign: eventCampaign,
    content: `sponsor_${size}`,
  })
  return taggedUrl ? (
    <a href={taggedUrl} target="_blank" rel="noopener noreferrer">
      {tile}
    </a>
  ) : (
    tile
  )
}

/* ── PrizeSection ───────────────────────────────────────────
 * Public "What's at stake" display. Three tiers: Grand (image hero
 * cards), Featured (2-up mid-weight), Standard (compact rows). Hides
 * empty tiers. Aggregate value subhead = sum(value_amount × quantity)
 * rounded down to nearest $100, hidden when no values populated.
 */
function PrizeSection({
  prizes,
  eventCampaign,
  aggregateLabel,
}: {
  prizes: Prize[]
  eventCampaign: string
  aggregateLabel: string | null
}) {
  const grand = prizes.filter(p => p.tier === 'grand').sort(sortPrizesByDisplay)
  const featured = prizes.filter(p => p.tier === 'featured').sort(sortPrizesByDisplay)
  const standard = prizes.filter(p => p.tier === 'standard').sort(sortPrizesByDisplay)

  if (grand.length === 0 && featured.length === 0 && standard.length === 0) return null

  if (grand.length > 4) {
    // Spec: 4+ Grand prizes is a misconfiguration. Falls back to 3-up + remainder
    // visually, but admin should demote weaker ones to Featured.
    console.warn(`[shift-your-summer] ${grand.length} Grand prizes — UI scales to 3-up; admin should re-tier.`)
  }

  const grandLayoutCols =
    grand.length === 1 ? 'grid-cols-1' : grand.length === 2 ? 'sm:grid-cols-2' : 'lg:grid-cols-3'

  return (
    <section className="bg-[#191A2E] px-8 pt-10 pb-16">
      <div className="mx-auto max-w-[1120px]">
        <h2 className="mb-2 font-display text-2xl font-bold tracking-tight text-white">
          What&apos;s at stake
        </h2>
        {aggregateLabel && (
          <p className="mb-10 text-sm text-white/75">{aggregateLabel}</p>
        )}

        {grand.length > 0 && (
          <div className={`mb-8 grid gap-5 ${grandLayoutCols}`}>
            {grand.map(p => (
              <GrandPrizeCard key={p.id} prize={p} layout={grand.length} eventCampaign={eventCampaign} />
            ))}
          </div>
        )}

        {featured.length > 0 && (
          <div className="mb-8 grid gap-5 sm:grid-cols-2">
            {featured.map(p => (
              <FeaturedPrizeCard key={p.id} prize={p} eventCampaign={eventCampaign} />
            ))}
          </div>
        )}

        {standard.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {standard.map(p => (
              <StandardPrizeRow key={p.id} prize={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function sortPrizesByDisplay(a: Prize, b: Prize): number {
  if (a.display_order !== b.display_order) return a.display_order - b.display_order
  const av = a.value_amount ?? -1
  const bv = b.value_amount ?? -1
  return bv - av
}

function formatDollars(value: number): string {
  if (value >= 1000) {
    const k = (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)
    return `$${k}k`
  }
  return `$${Math.round(value).toLocaleString()}`
}

function computeAggregateLabel(prizes: Prize[]): string | null {
  const totalValue = prizes.reduce((acc, p) => {
    if (p.value_amount == null) return acc
    const qty = p.quantity > 0 ? p.quantity : 1
    return acc + p.value_amount * qty
  }, 0)
  const roundedValue = Math.floor(totalValue / 100) * 100
  return totalValue > 0 ? `${formatDollars(roundedValue)}+ in prizes` : null
}

// ─── Enriched grand-prize content for the Segway MUXI ───────────────
// Hardcoded because the Prize schema doesn't carry feature specs,
// accessory bundles, or donor logos. Falls back to the simple card for
// any other grand prize.
const SEGWAY_GRAND_PRIZE = {
  description:
    "Segway’s compact short-tail utility e-bike — a step-through commuter that’s part beach cruiser, part Dutch cargo. Pull up to work on schedule, coffee in style, and hit the bike path on Saturday. One bike, every kind of trip.",
  valueSubtext: 'Bike + bundle',
  heroTagline: 'Plus a 3-piece accessory bundle',
  features: [
    { icon: 'route', label: 'Up to 80-mi range', sub: '716Wh removable battery' },
    { icon: 'zap', label: '20 mph top speed', sub: '750W rear hub motor' },
    { icon: 'package', label: '418 lb payload', sub: 'Cargo, passenger, both' },
    { icon: 'smartphone', label: 'Apple Find My', sub: 'AirLock + GPS tracking' },
  ],
  accessories: [
    { name: 'Middle basket', blurb: 'Frame-mounted storage between the knees', img: '/assets/prizes/acc-middle-basket.png' },
    { name: 'Passenger kit', blurb: 'Cushioned rear seat with foot pegs', img: '/assets/prizes/acc-passenger-kit.png' },
    { name: 'Fender kit', blurb: 'Front + rear fenders for rain and road spray', img: '/assets/prizes/acc-fender.png' },
  ],
  donorLogoUrl: '/assets/prizes/segway-logo.png',
}

// Lucide-style inline SVG icons for the feature tiles.
function FeatureIcon({ name }: { name: string }) {
  const shared = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'route':
      return <svg {...shared} aria-hidden="true"><circle cx="6" cy="19" r="3" /><circle cx="18" cy="5" r="3" /><path d="M6 16V8a4 4 0 0 1 4-4h4" /><path d="M18 8v8a4 4 0 0 1-4 4h-4" /></svg>
    case 'zap':
      return <svg {...shared} aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
    case 'package':
      return <svg {...shared} aria-hidden="true"><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="M3.3 7 12 12l8.7-5" /><path d="M12 22V12" /></svg>
    case 'smartphone':
      return <svg {...shared} aria-hidden="true"><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></svg>
    default:
      return null
  }
}

function GrandPrizeCard({
  prize,
  layout,
  eventCampaign,
}: {
  prize: Prize
  layout: number
  eventCampaign: string
}) {
  const brand = brandLabel(prize)

  // ── Enriched "Hero stack" card for the Segway MUXI ──
  // Matches when brand is "Segway" and there's enriched content to show.
  const isEnriched = brand === 'Segway'

  if (!isEnriched) {
    // Fallback: simple card for any non-enriched grand prize
    const simpleCard = (
      <div className="overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.04] transition-colors hover:bg-white/[0.06]">
        <div
          className="relative flex items-center justify-center bg-[#1A2240] p-6"
          style={{ minHeight: layout === 1 ? 220 : layout === 2 ? 180 : 160 }}
        >
          {prize.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={prize.image_url} alt={prize.description} className="max-h-[260px] w-auto max-w-full object-contain" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/60">
              <svg viewBox="0 0 24 24" fill="none" className="h-12 w-12"><path d="M12 2L3 7v6c0 5 3.5 9.5 9 11 5.5-1.5 9-6 9-11V7l-9-5z" stroke="currentColor" strokeWidth="1" /></svg>
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-md bg-[#BAF14D] px-2 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#191A2E]">Grand prize</span>
          {brand && <span className="absolute right-3 top-3 rounded-md bg-white px-2 py-1 text-[11px] font-bold text-[#191A2E]">{brand}</span>}
        </div>
        <div className="space-y-1.5 p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[1.0625rem] font-semibold leading-tight text-white">{prize.description}</p>
            {prize.value_amount != null && <span className="shrink-0 text-sm font-bold text-[#BAF14D]">~{formatDollars(prize.value_amount)} value</span>}
          </div>
          {brand && <p className="text-sm text-white/75">From <span className="font-semibold text-white">{brand}</span></p>}
          <div className="pt-1"><EntryTypePill prize={prize} /></div>
          {prize.product_url && <p className="pt-1 text-sm font-semibold text-[#2966E5]">View product details →</p>}
        </div>
      </div>
    )
    const taggedUrl = withUtm(prize.product_url, { medium: 'event_page', campaign: eventCampaign, content: 'grand_prize_card' })
    return taggedUrl ? <a href={taggedUrl} target="_blank" rel="noopener noreferrer" className="block">{simpleCard}</a> : simpleCard
  }

  // ── Enriched Hero Stack card ──
  const gp = SEGWAY_GRAND_PRIZE
  const taggedProductUrl = withUtm(prize.product_url, {
    medium: 'event_page',
    campaign: eventCampaign,
    content: 'grand_prize_card',
  })

  return (
    <article className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-[#242538] font-display text-white">
      {/* ── Region 1: Hero band ── */}
      <div className="relative h-[280px] overflow-hidden bg-gradient-to-b from-[#1c2348] to-[#181f3e] md:h-[440px]">
        {/* Grand prize pill */}
        <div className="absolute left-3.5 top-3.5 z-10 md:left-[22px] md:top-[22px]">
          <span className="inline-flex items-center rounded-full bg-[#BAF14D] px-3.5 py-[7px] text-xs font-bold uppercase tracking-[0.12em] text-[#191A2E]">
            Grand prize
          </span>
        </div>

        {/* Donor lockup — logo only on mobile, "DONATED BY" + logo on desktop */}
        <div className="absolute right-3.5 top-3.5 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-2.5 py-1.5 md:right-[22px] md:top-[22px] md:gap-2 md:px-3.5 md:py-2">
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75 md:inline">
            Donated by
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gp.donorLogoUrl}
            alt="Segway"
            className="h-3 w-auto md:h-4"
            style={{ filter: 'invert(1) brightness(2)' }}
          />
        </div>

        {/* Bike photo — large, shifted up slightly so tires clear the bottom */}
        {prize.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={prize.image_url}
            alt={prize.description}
            className="absolute left-1/2 top-[44%] h-auto w-[92%] max-w-[720px] -translate-x-1/2 -translate-y-1/2 md:w-[70%]"
          />
        )}

        {/* Tagline — bottom-left */}
        <div className="absolute bottom-3.5 left-4 z-10 text-[10px] font-semibold uppercase tracking-[0.04em] text-white/75 md:bottom-[22px] md:left-7 md:text-[13px]">
          {gp.heroTagline}
        </div>
      </div>

      {/* ── Region 2: Title bar ── */}
      <div className="px-[18px] pt-5 md:flex md:items-end md:justify-between md:gap-6 md:px-8 md:pt-7">
        <div>
          <h3 className="text-2xl font-extrabold leading-[1.05] tracking-tight text-white md:text-[34px]">
            {prize.description}
          </h3>
          {brand && (
            <p className="mt-1.5 text-sm text-white/75 md:mt-2 md:text-base">
              From <span className="font-semibold text-white">{brand}</span>
            </p>
          )}
          {/* Mobile-only value pill */}
          {prize.value_amount != null && (
            <div className="mt-3 inline-flex items-baseline gap-2 rounded-full border border-[#BAF14D]/25 bg-[#BAF14D]/10 px-3 py-1.5 md:hidden">
              <span className="text-lg font-extrabold tracking-tight text-[#BAF14D]">
                ~{formatDollars(prize.value_amount)}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/75">
                value · {gp.valueSubtext}
              </span>
            </div>
          )}
        </div>
        {/* Desktop-only value block */}
        {prize.value_amount != null && (
          <div className="hidden shrink-0 text-right md:block">
            <div className="text-[28px] font-extrabold tracking-tight text-[#BAF14D]">
              ~{formatDollars(prize.value_amount)} value
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-white/75">
              {gp.valueSubtext}
            </div>
          </div>
        )}
      </div>

      {/* ── Region 3: Description ── */}
      <p className="mx-[18px] mt-4 max-w-[880px] text-[15px] leading-relaxed text-white/[0.78] md:mx-8 md:mt-5 md:text-[17px]" style={{ textWrap: 'pretty' }}>
        {gp.description}
      </p>

      {/* ── Region 4: Feature tile grid ── */}
      <div className="mx-[18px] mt-5 grid grid-cols-2 gap-2.5 md:mx-8 md:mt-6 md:grid-cols-4 md:gap-3">
        {gp.features.map(f => (
          <div key={f.label} className="flex flex-col gap-1.5 rounded-[10px] border border-white/[0.07] bg-white/[0.04] p-3.5 md:p-4">
            <div className="text-[#BAF14D]">
              <FeatureIcon name={f.icon} />
            </div>
            <div className="text-[15px] font-bold tracking-tight text-white">{f.label}</div>
            <div className="text-xs leading-snug text-white/75">{f.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Region 5: Accessory bundle ── */}
      <div className="mx-[18px] mt-5 md:mx-8 md:mt-7">
        {/* Section heading */}
        <div className="mb-3 md:flex md:items-baseline md:justify-between md:mb-3.5">
          <h4 className="text-base font-bold tracking-tight text-white md:text-lg">
            Includes a 3-piece accessory bundle
          </h4>
          <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-white/75 md:mt-0">
            All three, free
          </span>
        </div>

        {/* Desktop: 3-column vertical cards */}
        <div className="hidden gap-3 md:grid md:grid-cols-3">
          {gp.accessories.map(a => (
            <div key={a.name} className="overflow-hidden rounded-[10px] border border-white/[0.07] bg-white/[0.04]">
              <div className="flex h-[180px] items-center justify-center bg-[#FDFDFB] p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.img} alt={a.name} loading="lazy" className="max-h-full max-w-full object-contain" />
              </div>
              <div className="p-3 pb-3.5">
                <div className="text-sm font-bold text-white">{a.name}</div>
                <div className="mt-0.5 text-xs leading-snug text-white/75">{a.blurb}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: stacked row cards */}
        <div className="flex flex-col gap-2.5 md:hidden">
          {gp.accessories.map(a => (
            <div key={a.name} className="flex items-center gap-3.5 rounded-[10px] border border-white/[0.07] bg-white/[0.04] p-2.5 pr-3">
              <div className="flex h-14 w-16 shrink-0 items-center justify-center rounded-md bg-[#FDFDFB]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.img} alt={a.name} loading="lazy" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">{a.name}</div>
                <div className="mt-0.5 text-xs leading-snug text-white/75">{a.blurb}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Region 6: Footer ── */}
      <div className="mx-0 mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] bg-black/[0.12] px-[18px] py-5 md:mt-6 md:flex-nowrap md:gap-4 md:px-8 md:py-6">
        <EntryTypePill prize={prize} />
        {taggedProductUrl && (
          <a
            href={taggedProductUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-[#4A82F0] transition-colors hover:text-[#6699FF]"
          >
            View product details
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </a>
        )}
      </div>
    </article>
  )
}

function FeaturedPrizeCard({
  prize,
  eventCampaign,
}: {
  prize: Prize
  eventCampaign: string
}) {
  const brand = brandLabel(prize)
  const card = (
    <div className="flex gap-4 rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.06]">
      {prize.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={prize.image_url}
          alt={prize.description}
          className="h-20 w-20 shrink-0 rounded-[10px] bg-[#1A2240] object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            Featured
          </span>
          {prize.quantity > 1 && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white">
              ×{prize.quantity}
            </span>
          )}
        </div>
        <p className="text-sm font-medium leading-snug text-white">
          {prize.description}
        </p>
        {brand && (
          <p className="mt-1 text-sm text-white/75">
            Donated by <span className="font-semibold text-white">{brand}</span>
          </p>
        )}
        <div className="mt-1.5">
          <EntryTypePill prize={prize} />
        </div>
        {prize.product_url && (
          <p className="mt-1.5 text-sm font-semibold text-[#2966E5]">
            View product details →
          </p>
        )}
      </div>
    </div>
  )
  const taggedProductUrl = withUtm(prize.product_url, {
    medium: 'event_page',
    campaign: eventCampaign,
    content: 'featured_prize_card',
  })
  return taggedProductUrl ? (
    <a href={taggedProductUrl} target="_blank" rel="noopener noreferrer" className="block">
      {card}
    </a>
  ) : (
    card
  )
}

function StandardPrizeRow({ prize }: { prize: Prize }) {
  const brand = brandLabel(prize)
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{prize.description}</p>
        {brand && (
          <p className="mt-0.5 text-xs text-white/75">{brand}</p>
        )}
      </div>
      {prize.quantity > 1 && (
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white">
          ×{prize.quantity}
        </span>
      )}
    </div>
  )
}

function HowToJoin() {
  const steps: Array<{ num: string; title: string; body: React.ReactNode }> = [
    {
      num: '1',
      title: 'Download Shift',
      body: 'Available on iOS and Android. Join the challenge from the Community → Events tab.',
    },
    {
      num: '2',
      title: 'Take active trips',
      body: 'Walk, bike, or ride transit. Shift detects your trips automatically.',
    },
    {
      num: '3',
      title: 'Win prizes',
      body: 'Every active trip is a prize entry. Earn bonus entries by referring friends, completing Roams, and submitting What Moves Us videos.',
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

function RulesLink() {
  if (!RULES_PUBLISHED) return null
  return (
    <section className="bg-[#191A2E] px-8 py-10">
      <div className="mx-auto max-w-[800px] rounded-2xl border border-white/[0.08] bg-white/[0.04] px-8 py-8 text-center">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/70">Sweepstakes</p>
        <h3 className="mb-3 font-display text-xl font-bold text-white">Official Rules</h3>
        <p className="mb-5 text-[0.9375rem] leading-[1.6] text-white/75">
          Eligibility, entry mechanics, prize details, and the free mail-in entry process.
        </p>
        <Link
          href="/events/shift-your-summer/rules"
          className="group inline-flex items-center gap-2 text-sm font-semibold text-[#BAF14D] transition-colors hover:text-white"
        >
          Read the official rules
          <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
        </Link>
      </div>
    </section>
  )
}

function PartnerCrossLink() {
  return (
    <section className="bg-[#191A2E] px-8 pb-2">
      <div className="mx-auto max-w-[1120px] border-t border-white/[0.08] pt-8">
        <Link
          href="/events/shift-your-summer/partners"
          className="group inline-flex items-center gap-2 text-sm text-white/75 hover:text-white transition-colors"
        >
          Interested in sponsoring? Learn about partnership opportunities
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </section>
  )
}

function CtaSection({ phase }: { phase: PageState }) {
  const heading =
    phase === 'ended' ? 'Ready for the next one?' : 'Ready to compete?'
  const body =
    phase === 'active'
      ? 'Download Shift, join the challenge, and start earning your spot on the board.'
      : phase === 'ended'
        ? "Shift Your September is up next. Download Shift and be ready when it launches."
        : "Download Shift so you’re ready when the challenge goes live."
  return (
    <section className="bg-[#191A2E] px-8 py-24">
      <div className="mx-auto max-w-[560px] text-center">
        <h2 className="mb-4 font-display text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
          {heading}
        </h2>
        <p className="mb-10 text-lg leading-relaxed text-white">{body}</p>
        <JoinChallengeCta phase={phase} />
      </div>
    </section>
  )
}

function EarlyStateCard({ participantCount }: { participantCount: number }) {
  return (
    <div className="rounded-[18px] border border-white/[0.08] bg-[#242538] px-8 py-12 text-center">
      <div className="mx-auto max-w-[420px]">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#BAF14D]/15">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#BAF14D" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <p className="mb-2 font-display text-lg font-bold text-white">
          {participantCount.toLocaleString()} {participantCount === 1 ? 'person has' : 'people have'} joined
        </p>
        <p className="mb-8 text-[0.9375rem] leading-[1.6] text-white/75">
          The first trips are being logged — check back soon to see the board come alive.
        </p>
        <JoinChallengeCta phase="active" />
      </div>
    </div>
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

function ShareChallengeLink() {
  return (
    <Link
      href="/events/shift-your-summer/share"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/75 transition-colors hover:text-white"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      Share with your team
    </Link>
  )
}

// Phase-aware download/join CTA. All variants point at /app, where the existing
// IS_LIVE gate decides between dual store buttons and the waitlist email form
// based on the NEXT_PUBLIC_IOS_URL / NEXT_PUBLIC_ANDROID_URL env vars.
function JoinChallengeCta({ phase }: { phase: PageState }) {
  const label =
    phase === 'active' ? 'Join the challenge' : 'Download Shift'
  return (
    <Link
      href="/app"
      className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
    >
      {label} &rarr;
    </Link>
  )
}
