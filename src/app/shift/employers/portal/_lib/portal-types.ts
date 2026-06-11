import type { EmployerBenefits } from '@/lib/types/commute'

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
}

export type Challenge = {
  id: string
  name: string
  metric: string
  starts_at: string
  ends_at: string
  prize_description: string | null
  public_leaderboard: boolean
}

export type DashboardData = {
  period_days: number
  member_count: number
  trips_this_period: number
  active_trips_this_period: number
  miles_shifted: number
  co2_avoided_kg: number
  mode_breakdown: Array<{ mode: string; trip_count: number }>
  shift_rate_trip_pct: number
  shift_rate_7d: number
}

export type EmployerMember = {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  joined_at: string
  trips_in_period: number
  active_trips_in_period: number
}

export type RewardPool = {
  id: string
  name: string
  balance_cents: number
  lifetime_funded_cents: number
  lifetime_spent_cents: number
  active: boolean
}

export type PrizeMetric = 'pct_non_car' | 'trips' | 'active_days' | 'miles'
export type AwardMode = 'merit' | 'drawing'

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

export type GroupAdmin = {
  id: string
  group_id: string
  email: string
  role: 'admin' | 'viewer'
  name: string | null
  created_at: string
}

export type { EmployerBenefits }
