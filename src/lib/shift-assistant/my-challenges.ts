import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  contactSentence, countingSentences, drawingSentence, effectiveRules, etDateRange, prizeSentence, topSentence,
  type ChallengeRulesInput, type CountingRules,
} from '@/lib/challenge-rules'
import { bikeShareBenefitLine } from '@/lib/employer/bike-share'
import { haversineMiles } from '@/lib/nearby/share'
import { excerptOf } from '@/lib/commute/try-it-event'
import type { EmployerBenefits } from '@/lib/types/commute'

// What the member assistant knows about the person's challenges, groups and
// workplace (Keith 2026-10-27: "Why aren't we giving the assistant all the
// data it needs?... challenge details or employer benefits"). Everything is
// read as the person, through the same functions the app's Rewards tab,
// challenge screen, Groups tab and commute plan use, so the assistant and
// the app can't disagree:
//   get_my_guaranteed_challenges (Shift 01385)  workplace challenges, prizes, offers
//   get_competition_standings (01183)           their place in a challenge
//   get_my_group_standings (01449)              their groups this month
//   get_my_commute_employer (01321)             employer benefits and offices
// Other people appear only as counts, never by name.

type Ctx = { user: SupabaseClient; admin: SupabaseClient; userId: string }

const WAY_WORDS: Record<string, string> = {
  walk: 'walking', bike: 'biking', escooter: 'e-scooter', carpool: 'carpool', transit_bus: 'bus', transit_train: 'subway',
  transit_commuter_rail: 'Commuter Rail', ferry: 'ferry',
}

type Win = { status: string; claimed: boolean; handed_out: boolean; received?: boolean; gift_card_status: string | null }
type Prize = {
  prize_id: string; name: string; award_mode?: 'guaranteed' | 'drawing' | 'merit'; metric?: string; goal: number; spots: number; spots_left: number
  funded: boolean; amount_cents: number | null; description: string | null; requires_work_email: boolean; closed: boolean; cancelled: boolean; my_win: Win | null
}
type Offer = Omit<Prize, 'goal' | 'closed' | 'cancelled' | 'my_win'>
type WorkChallenge = {
  ok: boolean; competition_id: string; name: string; employer?: string; contact_name?: string | null; contact_email?: string | null
  starts_at: string; ends_at: string; rules: CountingRules; my_count: number; trips_to_check: number
  work_email_verified: boolean; email_domains: string[]; prizes: Prize[]; offers?: Offer[]; my_new_modes?: string[]
}

/** Where a prize stands for them, in the app's own states (Shift lib/employer-challenge.ts prizeState). */
function prizeStatus(c: WorkChallenge, p: Prize): string {
  const w = p.my_win
  if (w) {
    if (w.status === 'forfeited') return 'won, but it expired before they picked it up'
    if (p.funded) return w.gift_card_status === 'earned' ? 'won: they pick their gift card in My rewards' : w.received ? 'won and received' : 'won: gift card picked, in My rewards'
    if (w.handed_out || w.received) return 'won and handed out'
    return w.claimed ? `won and claimed; ${c.employer ?? 'their employer'} hands it out` : 'won: they tap Claim on the challenge to get it'
  }
  const now = Date.now()
  if (new Date(c.starts_at).getTime() > now) return 'not started yet'
  if (p.closed || p.cancelled || new Date(c.ends_at).getTime() < now) return 'ended'
  if (p.award_mode !== 'merit' && p.spots_left <= 0) return 'every spot has been won'
  if (p.requires_work_email && !c.work_email_verified) return 'open, but they verify their work email in the app before they can win'
  return 'open'
}

/** Their place in a challenge: "3 of 26", and how many trips pass the next person up. */
async function placeIn(ctx: Ctx, competitionId: string, byCounted: boolean) {
  const { data } = await ctx.user.rpc('get_competition_standings', { p_competition_id: competitionId })
  type Row = { user_id: string; total_trips: number; non_car_trips: number }
  const score = (r: Row) => Number(byCounted ? r.total_trips : r.non_car_trips) || 0
  const rows = ((data ?? []) as Row[]).slice().sort((a, b) => score(b) - score(a))
  const me = rows.find((r) => r.user_id === ctx.userId)
  if (!me) return null
  const mine = score(me)
  const above = rows.filter((r) => score(r) > mine)
  const next = above.length ? Math.min(...above.map(score)) : null
  return {
    place: `${above.length + 1} of ${rows.length}`,
    tied_with: rows.filter((r) => score(r) === mine).length - 1 || undefined,
    trips_to_pass_next: next != null ? next - mine + 1 : null,
  }
}

export async function myChallenges(ctx: Ctx) {
  const now = new Date()
  const nowIso = now.toISOString()
  const recent = new Date(now.getTime() - 14 * 864e5).toISOString()
  const soon = new Date(now.getTime() + 45 * 864e5).toISOString()
  // This month in Boston, as the Groups tab shows it.
  const [y, m] = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).split('-').map(Number)
  const guess = Date.UTC(y, m - 1, 1)
  const wall = (tz: string) => new Date(new Date(guess).toLocaleString('en-US', { timeZone: tz })).getTime()
  const monthStart = new Date(guess + wall('UTC') - wall('America/New_York')).toISOString()
  const [workQ, joinedQ, groupsQ, openQ] = await Promise.all([
    ctx.user.rpc('get_my_guaranteed_challenges'),
    ctx.user.from('competition_participants').select('competition_id').eq('user_id', ctx.userId),
    ctx.user.rpc('get_my_group_standings', { p_start_at: monthStart, p_end_at: nowIso }),
    ctx.user.from('competitions').select('id, name, description, starts_at, ends_at')
      .is('group_id', null).eq('is_public', true).gte('ends_at', nowIso).lte('starts_at', soon).order('starts_at').limit(3),
  ])
  const work = ((workQ.data ?? []) as WorkChallenge[])
    .filter((c) => c.ok !== false && c.ends_at >= recent)
  const joined = new Set(((joinedQ.data ?? []) as { competition_id: string }[]).map((r) => r.competition_id))
  const workIds = new Set(work.map((c) => c.competition_id))
  const otherIds = [...joined].filter((id) => !workIds.has(id))
  const { data: otherRows } = otherIds.length
    ? await ctx.user.from('competitions').select('id, name, description, starts_at, ends_at').in('id', otherIds).gte('ends_at', recent).order('starts_at')
    : { data: [] }
  type Comp = { id: string; name: string; description: string | null; starts_at: string; ends_at: string }
  const others = (otherRows ?? []) as Comp[]
  const started = (c: { starts_at: string }) => c.starts_at <= nowIso
  const [workPlaces, otherPlaces] = await Promise.all([
    Promise.all(work.map((c) => (joined.has(c.competition_id) && started(c) ? placeIn(ctx, c.competition_id, true) : null))),
    Promise.all(others.map((c) => (started(c) ? placeIn(ctx, c.id, false) : null))),
  ])

  type GroupRow = {
    group_id: string; rank: number | null; total: number | null; scope: string | null; scope_name: string | null
    gap_trips: number | null; next_name: string | null; your_trips: number; your_days: number; your_rank_days: number | null
    active_count: number | null; challenge_name: string | null; challenge_ends_at: string | null
  }
  const groupRows = (groupsQ.data ?? []) as GroupRow[]
  const { data: names } = groupRows.length
    ? await ctx.admin.from('groups').select('id, name, type').in('id', groupRows.map((g) => g.group_id))
    : { data: [] }
  const groupOf = new Map(((names ?? []) as { id: string; name: string; type: string }[]).map((g) => [g.id, g]))

  const status = (c: { starts_at: string; ends_at: string }) => (c.starts_at > nowIso ? 'starts soon' : c.ends_at < nowIso ? 'ended' : 'on now')
  return {
    workplace_challenges: work.map((c, i) => {
      const employer = c.employer ?? 'their employer'
      const base: ChallengeRulesInput = {
        rules: c.rules, startsAt: c.starts_at, endsAt: c.ends_at, goal: 0, spots: 1, funded: false, amountCents: null, description: null,
        requiresWorkEmail: false, domains: c.email_domains ?? [], employer, contactName: c.contact_name, contactEmail: c.contact_email,
        offices: effectiveRules(c.rules).offices.map((o) => o.address).filter(Boolean),
      }
      const as = (p: Offer & { goal?: number }): ChallengeRulesInput => ({
        ...base, goal: p.goal ?? 1, metric: p.metric, spots: p.spots, funded: p.funded, amountCents: p.amount_cents, description: p.description, requiresWorkEmail: p.requires_work_email,
      })
      const tripGoal = (p: Prize) => (p.metric ?? 'trips') === 'trips' && p.award_mode !== 'merit'
      const needsEmail = c.prizes.some((p) => p.requires_work_email) || (c.offers ?? []).some((o) => o.requires_work_email)
      return {
        id: c.competition_id,
        name: c.name,
        employer,
        when: etDateRange(c.starts_at, c.ends_at),
        status: status(c),
        their_trips_that_count: c.my_count,
        trips_being_checked: c.trips_to_check || undefined,
        their_place: workPlaces[i] ?? undefined,
        prizes: c.prizes.map((p) => ({
          how_to_win: p.award_mode === 'drawing' ? drawingSentence(as(p), p.metric) : p.award_mode === 'merit' ? topSentence(as(p), p.metric) : prizeSentence(as(p)),
          status: prizeStatus(c, p),
          trips_to_go: tripGoal(p) && !p.my_win ? Math.max(0, p.goal - c.my_count) : undefined,
          spots_left: p.award_mode === 'guaranteed' && !p.my_win ? p.spots_left : undefined,
        })),
        try_something_new: (c.offers ?? []).map((o) => ({
          how_to_win: o.award_mode === 'drawing' ? drawingSentence(as(o), 'tried_new') : prizeSentence(as(o)),
          spots_left: o.award_mode === 'guaranteed' ? o.spots_left : undefined,
        })),
        new_ways_they_tried: (c.my_new_modes ?? []).map((m) => WAY_WORDS[m] ?? m),
        what_counts: countingSentences(base),
        work_email: needsEmail ? (c.work_email_verified ? 'verified' : 'not verified yet; they verify it in the app to win') : undefined,
        questions: contactSentence(base) ?? undefined,
      }
    }),
    other_challenges_they_joined: others.map((c, i) => ({
      id: c.id, name: c.name, when: etDateRange(c.starts_at, c.ends_at), status: status(c),
      about: c.description ? excerptOf(c.description, 160) : null, their_place: otherPlaces[i] ?? undefined,
    })),
    open_to_join: ((openQ.data ?? []) as Comp[]).filter((c) => !joined.has(c.id)).map((c) => ({
      id: c.id, name: c.name, when: etDateRange(c.starts_at, c.ends_at), about: c.description ? excerptOf(c.description, 160) : null,
    })),
    groups_this_month: groupRows.map((g) => {
      const grp = groupOf.get(g.group_id)
      const among = g.scope === 'state' ? `towns in ${g.scope_name ?? 'the state'}` : g.scope === 'town' ? `neighborhoods in ${g.scope_name ?? 'the town'}` : g.scope === 'league' ? 'workplaces and schools in its league this week' : null
      return {
        group: grp?.name ?? 'A group', kind: grp?.type ?? null,
        group_place: g.rank != null && g.total != null && among ? `${g.rank} of ${g.total} ${among}, by Shift Rate (the share of trips walking, biking, transit or carpool)` : null,
        shifted_trips_to_pass_next: g.gap_trips ?? undefined, next_group_up: g.next_name ?? undefined,
        their_trips_there: g.your_trips, their_active_days: g.your_days,
        their_place_among_members: g.your_rank_days != null && g.active_count ? `${g.your_rank_days} of ${g.active_count} active members, by active days` : null,
        live_challenge: g.challenge_name ? { name: g.challenge_name, ends: g.challenge_ends_at ? etDateRange(g.challenge_ends_at, g.challenge_ends_at) : null } : undefined,
      }
    }),
    buttons: 'open_screen event with a challenge id opens it in the app: full rules, prizes, leaderboard, and Join for one that is open.',
  }
}

export type Workplace = {
  name: string
  benefits: EmployerBenefits
  offices: { name: string | null; address: string; lat: number; lng: number; starts: string | null; theirs: boolean }[]
}

const clock = (t: string | null) => {
  const m = t ? /^(\d{1,2}):(\d{2})/.exec(t) : null
  if (!m) return null
  const h = +m[1]
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}

/** Their employer, when it runs Shift's commute program for them, else null. */
export async function myWorkplace(ctx: Ctx): Promise<Workplace | null> {
  const { data, error } = await ctx.user.rpc('get_my_commute_employer')
  if (error || !data) return null
  type Row = { name: string; employer_benefits: EmployerBenefits | null; locations: { id: string; name: string | null; address: string; lat: number; lng: number; typical_start_time: string | null }[] | null; matched_location_id: string | null }
  const row = (Array.isArray(data) ? data[0] : data) as Row | undefined
  if (!row?.name) return null
  const benefits = row.employer_benefits ?? {}
  let offices = (row.locations ?? []).filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng))
    .map((l) => ({ name: l.name, address: l.address, lat: l.lat, lng: l.lng, starts: clock(l.typical_start_time), theirs: l.id === row.matched_location_id }))
  if (!offices.length && benefits.destination_lat != null && benefits.destination_lng != null && benefits.destination_address) {
    offices = [{ name: null, address: benefits.destination_address, lat: benefits.destination_lat, lng: benefits.destination_lng, starts: null, theirs: true }]
  }
  return { name: row.name, benefits, offices }
}

/** The benefits as the person reads them, leaving out what the employer didn't fill in. */
export function workplaceFacts(w: Workplace) {
  const b = w.benefits
  const money = (n: number) => `$${Math.round(n)}`
  const transit = b.transit_subsidy_label?.trim()
    || (b.transit_subsidy_monthly ? (b.transit_subsidy_type === 'pre_tax'
      ? `Pay for transit before taxes, up to ${money(b.transit_subsidy_monthly)} a month`
      : `${w.name} pays ${money(b.transit_subsidy_monthly)} a month toward transit`) : null)
  return {
    employer: w.name,
    transit: transit ? { benefit: transit, monthly_dollars: b.transit_subsidy_monthly ?? null, kind: b.transit_subsidy_type === 'pre_tax' ? 'pre-tax (comes out of pay before taxes)' : b.transit_subsidy_type === 'direct' ? 'paid by the employer' : null } : null,
    bike_share: b.bikeshare_subsidized ? bikeShareBenefitLine(b, w.name) : null,
    bike_parking: b.bike_parking ? (b.bike_parking_details?.trim() || 'Bike parking at work') : null,
    showers: b.showers ? (b.shower_details?.trim() || 'Showers at work') : null,
    parking: b.free_parking ? 'Free parking at work' : b.parking_cost_monthly ? `Parking at work costs ${money(b.parking_cost_monthly)} a month` : null,
    shuttles: (b.shuttle_routes ?? []).filter((s) => s.name).map((s) => ({ name: s.name, from: s.from_stop, when: s.schedule, details: s.details || undefined })),
    other: b.other_benefits?.trim() || null,
    questions_to: b.hr_contact_email ? `${b.hr_contact_name ? `${b.hr_contact_name}, ` : ''}${b.hr_contact_email}` : null,
    offices: w.offices.map((o) => ({ name: o.name, address: o.address, usual_start: o.starts, theirs: o.theirs || undefined })),
  }
}

/** The office a place is at (within about 400 m), for a trip to work. */
export function officeAt(w: Workplace, lat: number, lng: number) {
  return w.offices.find((o) => haversineMiles(o.lat, o.lng, lat, lng) <= 0.25) ?? null
}
