import type { EmployerBenefits } from '@/lib/types/commute'

/** "What matters most to you?" on Setup step 1 (Keith 2026-09-30). */
export type EmployerGoalType = 'participation' | 'mode_shift' | 'parking' | 'wellness' | 'benefit_uptake'

export type EmployerChampion = { name: string; email: string }

// Onboarding intake captured on the kickoff call / setup page.
// Mirrors the groups.onboarding JSONB column (all keys optional).
export type EmployerOnboarding = {
  /** What matters most; drives which target the Impact page measures against. */
  goal_type?: EmployerGoalType | null
  /**
   * The target for that goal, 1–100: % of employees signed up (participation),
   * Shift Rate (mode_shift), % fewer drive-alone trips (parking), or % of
   * employees active each month (wellness, benefit_uptake).
   */
  goal_target_pct?: number | null
  /** "By when", ISO date. */
  goal_target_date?: string | null
  /** "Anything else?" today; older plans kept the whole success definition here. */
  success_definition?: string
  headcount?: number | null
  /** Mirror of goal_target_pct for participation goals (the weekly digest reads it); null for other goals. */
  target_signup_pct?: number | null
  target_weekly_active_pct?: number | null
  launch_date?: string | null
  key_dates?: Array<{ label: string; date: string }>
  /** Structured rows since 2026-09-30. Older plans stored "Name <email>" lines, or one free-text string. */
  champions?: EmployerChampion[] | string[] | string
  comms_channels?: string
  kickoff_at?: string | null
  notes?: string
}

export type JoinPolicy = 'open' | 'work_email' | 'approval'

export type Group = {
  id: string
  name: string
  slug: string | null
  status: string
  admin_name: string | null
  admin_email: string
  admin_phone: string | null
  website_url: string | null
  logo_url: string | null
  invite_code: string
  tier: string
  access_starts_at: string | null
  access_ends_at: string | null
  public_leaderboard: boolean
  /** Who can join the team: anyone with the code (default), only people who confirm a work email, or anyone once an admin approves them. */
  join_policy: JoinPolicy
  onboarding?: EmployerOnboarding | null
  agreement_required?: boolean
  agreement_version?: string | null
  agreement_accepted_at?: string | null
  agreement_accepted_by_email?: string | null
}

export type Challenge = {
  id: string
  name: string
  metric: string
  starts_at: string
  ends_at: string
  prize_description: string | null
  public_leaderboard: boolean
  is_flagship?: boolean
  counting_rules?: CountingRules | null
  contact_name?: string | null
  contact_email?: string | null
}

/** Stored on competitions.counting_rules; null = Shift standard. */
export type CountingRules = {
  modes?: string[]
  min_walk_miles?: number
  max_trips_per_day?: number | null
  /** Only trips that start or end at one of this challenge's offices (Shift 01004). */
  commute_only?: boolean
  offices?: { address: string; lat: number; lng: number; radius_m?: number }[]
}

/**
 * The same window, one period earlier (Shift 01038 `prior_period`). Every
 * figure uses the same method as the current period so the change is real.
 */
export type PriorPeriodStats = {
  window_start: string
  window_end: string
  trips: number
  active_trips: number
  miles_shifted: number
  shift_rate_trip_pct: number
  drive_alone_share_pct: number | null
  emissions_shifted_pct: number | null
  co2_avoided_kg_v2: number
  member_count: number
}

/**
 * get_employer_dashboard_data. The keys after `weekly_shift_rates` arrive
 * with Shift 01038; every one is optional so the page renders against the
 * database as it is today (00964) and simply says less.
 */
export type DashboardData = {
  period_days: number
  window_start?: string
  window_end?: string
  member_count: number
  trips_this_period: number
  active_trips_this_period: number
  miles_shifted: number
  /** Legacy figure: every non-drive mile × 0.404 kg. Kept for the digest and Home. */
  co2_avoided_kg: number
  mode_breakdown: Array<{ mode: string; trip_count: number; miles?: number }>
  shift_rate_trip_pct: number
  shift_rate_7d: number
  // 12 rolling weekly buckets, oldest first; shift_rate_pct is null
  // for weeks with no trips (distinct from a real 0%).
  weekly_shift_rates?: Array<{
    week_start: string
    trips: number
    active_trips: number
    shift_rate_pct: number | null
  }>
  /** Miles per mode key over the window. */
  miles_by_mode?: Record<string, number>
  /** Miles on foot, by bike, scooter or transit. */
  active_miles?: number
  /** EPA Hub 2025 factors, net of the mode used, carpool as half a car-mile. */
  co2_avoided_kg_v2?: number
  /** Share of travel emissions shifted: avoided ÷ (avoided + emitted). Null when too few trips. */
  emissions_shifted_pct?: number | null
  /** Share of recorded trips that were driving alone. */
  drive_alone_share_pct?: number
  /** groups.onboarding.headcount, when the employer gave one. */
  headcount?: number | null
  /** Members ÷ headcount, null without a headcount. */
  participation_pct?: number | null
  co2?: {
    avoided_kg_v2: number
    emissions_shifted_pct: number | null
    /** Plain-words method line from the database, shown on How we count. */
    method: string
  }
  prior_period?: PriorPeriodStats | null
}

/**
 * One figure compared with the peer set (get_employer_peer_benchmark, Shift
 * 01039). Each figure has its own privacy floor: with fewer than three peers
 * reporting it, the RPC sends only the count.
 */
export type PeerBenchmarkStat =
  | {
      yours: number | null
      median: number
      /** Share of peer workplaces this one is above, 0–100; null when yours is null. */
      percentile: number | null
      peer_count: number
      too_few_peers?: false
    }
  | { too_few_peers: true; peer_count: number }

export type PeerBenchmark =
  | {
      period_days: number
      window_start: string
      window_end: string
      peer_count: number
      /** False until this workplace has 5 members and a recorded trip; the medians still show. */
      you_qualify: boolean
      too_few_peers?: false
      shift_rate_trip_pct: PeerBenchmarkStat
      active_trips_per_member: PeerBenchmarkStat
      participation_pct: PeerBenchmarkStat
    }
  | { peer_count: number; too_few_peers: true; you_qualify?: boolean; period_days?: number }

export type EmployerMember = {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  joined_at: string
  trips_in_period: number
  active_trips_in_period: number
  miles_in_period: number
  co2_avoided_in_period: number
}

export type RewardPool = {
  id: string
  name: string
  balance_cents: number
  lifetime_funded_cents: number
  lifetime_spent_cents: number
  held_cents: number
  active: boolean
}

export type PrizeMetric = 'pct_non_car' | 'trips' | 'active_days' | 'miles'
export type AwardMode = 'merit' | 'drawing' | 'guaranteed'

export type ChallengePrize = {
  id: string
  competition_id: string
  group_id: string
  name: string
  award_mode: AwardMode
  metric: PrizeMetric
  min_threshold: number | null
  winner_count: number
  funded_from_pool: boolean
  amount_cents: number | null
  prize_description: string | null
  tremendous_product_id: string | null
  auto_draw: boolean
  draw_status: 'pending' | 'drawn' | 'fulfilled'
  drawn_at: string | null
  display_order: number
  budget_cap_cents: number | null
  requires_work_email: boolean
  hold_cents: number
  published_at: string | null
  closed_at: string | null
  cancelled_at: string | null
}

export type PrizeWinner = {
  id: string
  prize_id: string
  user_id: string
  metric: string
  metric_value: number
  amount_cents: number | null
  drawn_at: string
  fulfillment_status: 'pending' | 'fulfilled' | 'forfeited'
  fulfilled_at: string | null
  tremendous_order_id: string | null
}

export type PrizeFormState = {
  id: string | null
  name: string
  award_mode: AwardMode
  metric: PrizeMetric
  min_threshold: string
  winner_count: string
  funded_from_pool: boolean
  amount_dollars: string
  tremendous_product_id: string
  prize_description: string
  auto_draw: boolean
  budget_cap_dollars: string
  requires_work_email: boolean
  /** Server state carried through the editor (read-only there). */
  published_at?: string | null
  /** Server state: a drawn prize no longer needs money from the balance (Keith 2026-10-05 funding gate). */
  draw_status?: 'pending' | 'drawn' | 'fulfilled'
}

/** get_challenge_admin_progress (Shift 00972). */
export type GuaranteedWinner = {
  winner_id: string
  name: string
  email: string | null
  reached_at: string | null
  status: 'pending' | 'fulfilled' | 'forfeited'
  claimed_at: string | null
  handed_out_at: string | null
  /** The winner confirmed in the app that it arrived (Shift 01113). */
  received_at?: string | null
  gift_card_status: string | null
}

export type GuaranteedPrizeProgress = {
  prize_id: string
  name: string
  goal: number
  spots: number
  winners: number
  funded: boolean
  amount_cents: number | null
  description: string | null
  requires_work_email: boolean
  published_at: string | null
  closed_at: string | null
  cancelled_at: string | null
  held_cents: number
  spent_cents: number
  counting: number
  within_two: number
  winner_list: GuaranteedWinner[]
}

export type ChallengeAdminProgress = {
  ok: boolean
  reason?: string
  rules: Required<CountingRules>
  members: number
  work_emails_verified: number
  prizes: GuaranteedPrizeProgress[]
}

export type TremendousProduct = {
  id: string
  name: string
  image_url: string | null
  min_value: number
  max_value: number
  currency_codes: string[]
  category: string
}

export type ImpactPreset =
  | 'last_30'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'ytd'
  | 'custom'

export type NotificationPrefs = {
  weekly_impact: boolean
  new_employee: boolean
  challenge_milestones: boolean
}

export type GroupAdmin = {
  id: string
  group_id: string
  email: string
  /** 'manager' arrives with Shift migration 01081. */
  role: 'admin' | 'manager' | 'viewer'
  name: string | null
  created_at: string
  notification_prefs: NotificationPrefs | null
  /** The account owner (01081). Undefined until that migration is applied; see isOwnerRow(). */
  is_owner?: boolean
}

export type { EmployerBenefits }
