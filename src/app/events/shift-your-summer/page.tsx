import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import CountdownTimer from '@/components/CountdownTimer'
import RefreshButton from '@/components/RefreshButton'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { withUtm, slugify } from '@/lib/utm'
import LeaderboardTabs, { type GroupStanding } from './LeaderboardTabs'

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

type PrizeTier = 'grand' | 'featured' | 'standard'
type PrizeEntryType = 'weighted_entries' | 'achievement_gated' | 'event'
type SponsorTier = 'presenting' | 'champion' | 'community'

interface EligibilityCriteria {
  min_tier_id?: number
  min_active_trips?: number
  required_badges?: string[]
  // List of Roam IDs the user must complete during the campaign window.
  // roams_match controls whether all of them are required ("all", default)
  // or any one suffices ("any").
  required_roams?: string[]
  roams_match?: 'all' | 'any'
  // Number of approved What Moves Us video submissions required.
  required_wmu_submissions?: number
  min_age?: number
  residence?: string
}

interface Prize {
  id: string
  place: number
  prize_type: string
  description: string
  value_amount: number | null
  funded_by_sponsorship_id: string | null
  // Visual tiering + media for the public prize section.
  tier: PrizeTier
  display_order: number
  brand_name_override: string | null
  image_url: string | null
  product_url: string | null
  // Unit count drives the "×N" badge and the aggregate-value math.
  quantity: number
  // Drawing mechanic — drives the entry-type pill on each prize card.
  entry_type: PrizeEntryType
  // Eligibility rules feed into the achievement-gated pill copy
  // ("Earn 5-day streak to enter") instead of the generic "Complete to enter".
  eligibility_criteria: EligibilityCriteria | null
  funder: {
    id: string
    sponsors: { id: string; name: string; logo_url: string | null; website_url: string | null } | null
  } | null
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
  let groupStandings: GroupStanding[] = []
  let participantCount = 0
  let prizes: Prize[] = []

  if (competition && state === 'active') {
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
        .select('id, place, prize_type, description, value_amount, funded_by_sponsorship_id, tier, display_order, brand_name_override, image_url, product_url, entry_type, eligibility_criteria, funder:funded_by_sponsorship_id(id, sponsors(id, name, logo_url, website_url)), competition_prize_units(id)')
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
        quantity: Array.isArray(row.competition_prize_units)
          ? row.competition_prize_units.length
          : 0,
        entry_type: (row.entry_type ?? "achievement_gated") as PrizeEntryType,
        eligibility_criteria: (row.eligibility_criteria ?? null) as EligibilityCriteria | null,
        funder: funder ? { id: funder.id, sponsors: sponsor } : null,
      } as Prize
    })
  } else if (competition && state === 'upcoming') {
    const { data } = await supabase
      .from('competition_prizes')
      .select('id, place, prize_type, description, value_amount, funded_by_sponsorship_id, tier, display_order, brand_name_override, image_url, product_url, entry_type, eligibility_criteria, funder:funded_by_sponsorship_id(id, sponsors(id, name, logo_url, website_url)), competition_prize_units(id)')
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
        quantity: Array.isArray(row.competition_prize_units)
          ? row.competition_prize_units.length
          : 0,
        entry_type: (row.entry_type ?? "achievement_gated") as PrizeEntryType,
        eligibility_criteria: (row.eligibility_criteria ?? null) as EligibilityCriteria | null,
        funder: funder ? { id: funder.id, sponsors: sponsor } : null,
      } as Prize
    })
  }

  const sponsors: Sponsorship[] = competition?.event_sponsorships ?? []
  const geoStandings = groupStandings.filter(s => s.groupType === 'town' || s.groupType === 'neighborhood')
  const corpStandings = groupStandings.filter(s => s.groupType === 'workplace' || s.groupType === 'school')

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
            geoStandings={geoStandings}
            corpStandings={corpStandings}
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
            Shift flagship events bring Massachusetts commuters together to compete, move, and win real prizes. Download the app to get started.
          </p>
          <Link
            href="/shift"
            className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
          >
            Download the app
          </Link>
        </div>
      </section>

      {/* Explainer */}
      <section className="bg-[#242538] px-8 py-20">
        <div className="mx-auto max-w-[720px] text-center">
          <h2 className="mb-4 font-display text-2xl font-bold tracking-tight text-white">
            What are flagship events?
          </h2>
          <p className="mb-8 text-[1.0625rem] leading-[1.7] text-white">
            Multi-month, city-wide challenges where commuters across Massachusetts compete to shift trips from driving to walking, biking, and transit. Top finishers win real prizes from local sponsors.
          </p>
          <Link
            href="/shift"
            className="text-sm font-semibold text-[#BAF14D]"
          >
            Learn more about Shift &rarr;
          </Link>
        </div>
      </section>

      <PartnerCrossLink />
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
      <section className="relative overflow-hidden bg-[#191A2E] px-8 pt-24 md:pt-32 pb-10 md:pb-12">
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
        </div>
      </section>

      {/* Placeholder leaderboard */}
      <section className="bg-[#191A2E] px-8 pt-6 pb-12">
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

      <SponsorSection sponsors={sponsors} eventCampaign={slugify(competition.name)} />
      {prizes.length > 0 && <PrizeSection prizes={prizes} eventCampaign={slugify(competition.name)} />}
      <HowToJoin />
      <PartnerCrossLink />
      <CtaSection />
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
}: {
  competition: Competition
  standings: Standing[]
  geoStandings: GroupStanding[]
  corpStandings: GroupStanding[]
  participantCount: number
  prizes: Prize[]
  sponsors: Sponsorship[]
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
        </div>
      </section>

      {/* Leaderboard */}
      <section className="bg-[#191A2E] px-8 pb-16 pt-4">
        <div className="mx-auto max-w-[900px]">
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

          {/* Stats row above leaderboard */}
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5">
              <span className="font-display text-lg font-extrabold text-white">
                {participantCount.toLocaleString()}
              </span>
              <span className="ml-1.5 text-sm text-white/60">people participating</span>
            </div>
            {leader && (
              <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-4 py-2.5">
                <span className="text-sm text-white/60">#1 right now: </span>
                <span className="font-display text-sm font-bold text-white">
                  {leader.display_name}
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

      <SponsorSection sponsors={sponsors} eventCampaign={slugify(competition.name)} />
      {prizes.length > 0 && <PrizeSection prizes={prizes} eventCampaign={slugify(competition.name)} />}
      <HowToJoin />
      <PartnerCrossLink />
      <CtaSection />
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
          Made possible by these Greater Boston organizations
        </p>

        {/* Presenting */}
        <div className="mb-10">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/70">
            Presenting Sponsor
          </p>
          {presenting.length > 0 ? (
            <div className="grid gap-4">
              {presenting.map(s => (
                <SponsorTile key={s.id} sponsor={s.sponsors!} size="presenting" eventCampaign={eventCampaign} />
              ))}
            </div>
          ) : (
            <Link
              href="/events/shift-your-summer/partners"
              className="block rounded-[14px] border border-dashed border-[#BAF14D]/40 bg-[#BAF14D]/[0.06] px-6 py-7 text-center text-sm font-semibold text-[#BAF14D] hover:bg-[#BAF14D]/[0.12] transition-colors"
            >
              Open · become the presenting sponsor →
            </Link>
          )}
        </div>

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
}: {
  prizes: Prize[]
  eventCampaign: string
}) {
  const grand = prizes.filter(p => p.tier === 'grand').sort(sortPrizesByDisplay)
  const featured = prizes.filter(p => p.tier === 'featured').sort(sortPrizesByDisplay)
  const standard = prizes.filter(p => p.tier === 'standard').sort(sortPrizesByDisplay)

  if (grand.length === 0 && featured.length === 0 && standard.length === 0) return null

  // Aggregate value: sum(value × quantity), rounded down to nearest $100.
  const totalValue = prizes.reduce((acc, p) => {
    if (p.value_amount == null) return acc
    const qty = p.quantity > 0 ? p.quantity : 1
    return acc + p.value_amount * qty
  }, 0)
  const roundedValue = Math.floor(totalValue / 100) * 100
  const aggregateLabel = totalValue > 0 ? `${formatDollars(roundedValue)}+ in prizes` : null

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

function brandLabel(p: Prize): string | null {
  return p.funder?.sponsors?.name ?? p.brand_name_override
}

function formatDollars(value: number): string {
  if (value >= 1000) {
    const k = (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)
    return `$${k}k`
  }
  return `$${Math.round(value).toLocaleString()}`
}

const BADGE_PILL_LABELS: Record<string, string> = {
  streak_5: '5-day streak',
  streak_10: '10-day streak',
  streak_25: '25-day streak',
  streak_50: '50-day streak',
  streak_100: '100-day streak',
  trip_10: '10 trips',
  trip_50: '50 trips',
  trip_100: '100 trips',
  pedal_power: 'Pedal Power',
  sole_patrol: 'Sole Patrol',
  rail_rider: 'Rail Rider',
  squad_goals: 'Squad Goals',
}

const TIER_PILL_LABELS: Record<number, string> = {
  2: 'Mover',
  3: 'Shifter',
  4: 'Pacesetter',
  5: 'Trailblazer',
}

function achievementGatedLabel(c: EligibilityCriteria | null): string {
  if (!c) return 'Open to all participants'
  const parts: string[] = []
  if (c.required_badges?.length) {
    for (const b of c.required_badges) {
      parts.push(`Earn ${BADGE_PILL_LABELS[b] ?? b}`)
    }
  }
  if (c.required_roams?.length) {
    const n = c.required_roams.length
    const matchAny = c.roams_match === 'any'
    if (n === 1) parts.push('Complete the Roam')
    else if (matchAny) parts.push(`Complete 1 of ${n} Roams`)
    else parts.push(`Complete all ${n} Roams`)
  }
  if (c.required_wmu_submissions != null && c.required_wmu_submissions > 0) {
    parts.push(
      c.required_wmu_submissions === 1
        ? 'Submit a What Moves Us video'
        : `Submit ${c.required_wmu_submissions} What Moves Us videos`,
    )
  }
  if (c.min_active_trips != null && c.min_active_trips > 0) {
    parts.push(`${c.min_active_trips} active trips`)
  }
  if (c.min_tier_id != null && c.min_tier_id > 1) {
    parts.push(`Reach ${TIER_PILL_LABELS[c.min_tier_id] ?? `Tier ${c.min_tier_id}`}`)
  }
  if (parts.length === 0) return 'Complete to enter'
  return `${parts.join(' + ')} to enter`
}

function EntryTypePill({ prize }: { prize: Pick<Prize, 'entry_type' | 'eligibility_criteria'> }) {
  const config: Record<PrizeEntryType, { label: string; className: string }> = {
    weighted_entries: {
      label: '1 entry per active trip',
      className: 'bg-[#BAF14D] text-[#191A2E]',
    },
    achievement_gated: {
      label: achievementGatedLabel(prize.eligibility_criteria),
      className: 'bg-[#2966E5]/20 text-[#84B4FF]',
    },
    event: {
      label: 'Celebration event',
      className: 'bg-[#52B788]/20 text-[#7AD8A2]',
    },
  }
  const c = config[prize.entry_type]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${c.className}`}>
      {c.label}
    </span>
  )
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
  const imageHeight = layout === 1 ? 'h-[180px]' : layout === 2 ? 'h-[140px]' : 'h-[120px]'
  const card = (
    <div className="overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.04] transition-colors hover:bg-white/[0.06]">
      <div className={`relative ${imageHeight} bg-[#1A2240]`}>
        {prize.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={prize.image_url}
            alt={prize.description}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/60">
            <svg viewBox="0 0 24 24" fill="none" className="h-12 w-12">
              <path d="M12 2L3 7v6c0 5 3.5 9.5 9 11 5.5-1.5 9-6 9-11V7l-9-5z" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-md bg-[#BAF14D] px-2 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#191A2E]">
          Grand prize
        </span>
        {brand && (
          <span className="absolute right-3 top-3 rounded-md bg-white px-2 py-1 text-[11px] font-bold text-[#191A2E]">
            {brand}
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[1.0625rem] font-semibold leading-tight text-white">
            {prize.description}
          </p>
          {prize.value_amount != null && (
            <span className="shrink-0 text-sm font-bold text-[#BAF14D]">
              ~{formatDollars(prize.value_amount)} value
            </span>
          )}
        </div>
        {brand && (
          <p className="text-sm text-white/75">
            From <span className="font-semibold text-white">{brand}</span>
          </p>
        )}
        <div className="pt-1">
          <EntryTypePill prize={prize} />
        </div>
        {prize.product_url && (
          <p className="pt-1 text-sm font-semibold text-[#2966E5]">
            View product details →
          </p>
        )}
      </div>
    </div>
  )
  const taggedProductUrl = withUtm(prize.product_url, {
    medium: 'event_page',
    campaign: eventCampaign,
    content: 'grand_prize_card',
  })
  return taggedProductUrl ? (
    <a href={taggedProductUrl} target="_blank" rel="noopener noreferrer" className="block">
      {card}
    </a>
  ) : (
    card
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
              Shift launches this summer. Download the app now so you&apos;re ready when the challenge goes live.
            </p>
            <Link
              href="/shift"
              className="inline-block rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
            >
              Download the app
            </Link>
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
    <span className="group relative inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold text-white cursor-default">
      <svg viewBox="0 0 12 12" width="12" height="12" fill="currentColor">
        <path d="M6 0l1.76 3.57L12 4.14 8.82 7.02l.94 4.98L6 10.02 2.24 12l.94-4.98L0 4.14l4.24-.57z" />
      </svg>
      {metricLabel(metric)}
      <span className="ml-0.5 text-white/60">?</span>
      {/* Tooltip */}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-lg border border-white/[0.1] bg-[#1a1b30] px-3.5 py-2.5 text-xs font-normal leading-relaxed text-white/80 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
        Shift Rate is the percentage of your trips taken by active modes — walking, biking, or transit. Higher is better.
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#1a1b30]" />
      </span>
    </span>
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
