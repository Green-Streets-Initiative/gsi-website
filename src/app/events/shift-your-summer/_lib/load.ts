import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { campaigns, type CampaignReports } from '@/content/sponsor-reports'
import { isPubliclyListed, type Sponsorship } from '@/lib/sponsors/roll'
import type { GroupStanding } from '../LeaderboardTabs'
import {
  brandLabel,
  type EligibilityCriteria,
  type Prize,
  type PrizeEntryType,
  type PrizeTier,
} from './prizes'

/*
 * Everything the Shift Your Summer page reads, in one place and free of
 * markup. The production route calls `loadEventPage()` with the real clock;
 * the staging routes under /preview/shift-your-summer/<state> call it with a
 * fake clock or a forced state so every state can be reviewed at any date.
 */

/* ── types ─────────────────────────────────────────────────── */

export interface Standing {
  user_id: string
  display_name: string
  avatar_url: string | null
  total_trips: number
  non_car_trips: number
  pct_non_car: number
}

export type { Sponsor, Sponsorship, SponsorTier } from '@/lib/sponsors/roll'

export interface Competition {
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

export interface ClaimedWinner {
  prizeDescription: string
  prizeTier: PrizeTier
  prizeImageUrl: string | null
  winnerFirstName: string
  productUrl: string | null
  brandName: string | null
}

export type PageState = 'upcoming' | 'active' | 'ended' | 'coming-soon'

export const PAGE_STATES: PageState[] = ['coming-soon', 'upcoming', 'active', 'ended']

export interface EventPageData {
  state: PageState
  competition: Competition | null
  standings: Standing[]
  geoStandings: GroupStanding[]
  corpStandings: GroupStanding[]
  schoolStandings: GroupStanding[]
  participantCount: number
  prizes: Prize[]
  sponsors: Sponsorship[]
  claimedWinners: ClaimedWinner[]
  aggregateLabel: string | null
  totalActiveTrips: number
  /** The written report for this competition, when one has been published. */
  report: CampaignReports | null
  /** Set only by the staging routes: the instant the page was rendered "as of". */
  fakeNow: string | null
}

/* ── helpers ───────────────────────────────────────────────── */

export function formatDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', timeZone: 'America/New_York' }
  const startStr = new Date(start).toLocaleDateString('en-US', opts)
  const endStr = new Date(end).toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  return `${startStr} – ${endStr}`
}

export function formatDollars(value: number): string {
  if (value >= 1000) {
    const k = (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)
    return `$${k}k`
  }
  return `$${Math.round(value).toLocaleString()}`
}

export function computeAggregateLabel(prizes: Prize[]): string | null {
  const totalValue = prizes.reduce((acc, p) => {
    if (p.value_amount == null) return acc
    const qty = p.quantity > 0 ? p.quantity : 1
    return acc + p.value_amount * qty
  }, 0)
  const roundedValue = Math.floor(totalValue / 100) * 100
  return totalValue > 0 ? `${formatDollars(roundedValue)}+ in prizes` : null
}

export function stateOf(competition: Competition | null, nowMs: number): PageState {
  if (!competition) return 'coming-soon'
  const startsAt = new Date(competition.starts_at).getTime()
  const endsAt = new Date(competition.ends_at).getTime()
  return endsAt < nowMs ? 'ended' : startsAt > nowMs ? 'upcoming' : 'active'
}

const PRIZE_SELECT =
  'id, place, prize_type, description, value_amount, funded_by_sponsorship_id, tier, display_order, brand_name_override, image_url, product_url, entry_type, eligibility_criteria, quantity, funder:funded_by_sponsorship_id(id, sponsors(id, name, logo_url, website_url))'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPrize(row: any): Prize {
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
    entry_type: (row.entry_type ?? 'achievement_gated') as PrizeEntryType,
    eligibility_criteria: (row.eligibility_criteria ?? null) as EligibilityCriteria | null,
    funder: funder ? { id: funder.id, sponsors: sponsor } : null,
  } as Prize
}

/* ── loaders ───────────────────────────────────────────────── */

/**
 * The competition the page is about: currently active, else next upcoming,
 * else most recently ended. Cached per request so generateMetadata and the
 * page body share one query.
 */
export const loadCompetition = cache(async (nowMs: number): Promise<Competition | null> => {
  const supabase = createServerSupabaseClient()
  // Limit 5 is a generous ceiling — there should normally be one or two rows.
  const { data } = await supabase
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

  const competitions = (data ?? []) as unknown as Competition[]
  return (
    competitions.find(c => {
      const s = new Date(c.starts_at).getTime()
      const e = new Date(c.ends_at).getTime()
      return s <= nowMs && e >= nowMs
    }) ??
    competitions.find(c => new Date(c.starts_at).getTime() > nowMs) ??
    competitions[0] ??
    null
  )
})

export async function loadEventPage(opts: { nowMs?: number; forceState?: PageState } = {}): Promise<EventPageData> {
  const nowMs = opts.nowMs ?? Date.now()
  const supabase = createServerSupabaseClient()

  let competition = await loadCompetition(nowMs)
  let state = opts.forceState ?? stateOf(competition, nowMs)
  // A forced "coming soon" means "no competition", whatever the database says.
  if (state === 'coming-soon') competition = null
  if (!competition) state = 'coming-soon'

  let standings: Standing[] = []
  let groupStandings: GroupStanding[] = []
  let participantCount = 0
  let prizes: Prize[] = []
  let claimedWinners: ClaimedWinner[] = []

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
        .select(PRIZE_SELECT)
        .eq('competition_id', competition.id)
        .eq('prize_type', 'individual')
        .order('place', { ascending: true }),
    ])
    standings = (standingsRes.data ?? []).slice(0, 25)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    prizes = (prizesRes.data ?? []).map(rowToPrize)
  } else if (competition && state === 'upcoming') {
    const { data } = await supabase
      .from('competition_prizes')
      .select(PRIZE_SELECT)
      .eq('competition_id', competition.id)
      .eq('prize_type', 'individual')
      .order('place', { ascending: true })
    prizes = (data ?? []).map(rowToPrize)
  }

  if (competition && state === 'ended') {
    const { data: winnerRows } = await supabase
      .from('competition_prize_units')
      .select(`
        winner_user_id, claimed_at,
        competition_prizes!inner(
          description, tier, image_url, display_order, competition_id,
          product_url, brand_name_override,
          funder:funded_by_sponsorship_id(id, sponsors(id, name))
        ),
        users:winner_user_id(display_name)
      `)
      .eq('competition_prizes.competition_id', competition.id)
      .not('winner_user_id', 'is', null)
      .not('claimed_at', 'is', null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    claimedWinners = (winnerRows ?? []).map((row: any) => {
      const prize = row.competition_prizes
      const displayName: string | null = row.users?.display_name ?? null
      const firstName = displayName ? displayName.split(/\s+/)[0] : 'A Shift rider'
      const funderRaw = prize.funder
      const funder = Array.isArray(funderRaw) ? (funderRaw[0] ?? null) : (funderRaw ?? null)
      const sponsorRaw = funder?.sponsors
      const sponsor = Array.isArray(sponsorRaw) ? (sponsorRaw[0] ?? null) : (sponsorRaw ?? null)
      return {
        prizeDescription: prize.description,
        prizeTier: (prize.tier ?? 'standard') as PrizeTier,
        prizeImageUrl: prize.image_url ?? null,
        winnerFirstName: firstName,
        productUrl: prize.product_url ?? null,
        brandName: prize.brand_name_override ?? sponsor?.name ?? null,
      }
    })

    const tierOrder: Record<PrizeTier, number> = { grand: 0, featured: 1, standard: 2 }
    claimedWinners.sort((a, b) => tierOrder[a.prizeTier] - tierOrder[b.prizeTier])
  }

  // The public roll: sponsorships and prizes from organizations we list.
  const sponsors = (competition?.event_sponsorships ?? []).filter(s => isPubliclyListed(s.sponsors?.name))
  prizes = prizes.filter(p => isPubliclyListed(brandLabel(p)))
  claimedWinners = claimedWinners.filter(w => isPubliclyListed(w.brandName))

  const report = competition ? (campaigns.find(c => c.competitionId === competition.id) ?? null) : null

  return {
    state,
    competition,
    standings,
    geoStandings: groupStandings.filter(s => s.groupType === 'town' || s.groupType === 'neighborhood'),
    corpStandings: groupStandings.filter(s => s.groupType === 'workplace'),
    schoolStandings: groupStandings.filter(s => s.groupType === 'school'),
    participantCount,
    prizes,
    sponsors,
    claimedWinners,
    aggregateLabel: computeAggregateLabel(prizes),
    totalActiveTrips: standings.reduce((sum, s) => sum + s.non_car_trips, 0),
    report,
    fakeNow: opts.nowMs ? new Date(opts.nowMs).toISOString() : null,
  }
}
