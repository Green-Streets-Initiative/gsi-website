import type { PrizeFormState } from './portal-types'

export const BRAND_ASSETS_BASE =
  'https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets'

export const BRAND_ASSETS_VERSION = '20260422'

export const SHIFT_WORDMARK_WHITE_URL =
  `${BRAND_ASSETS_BASE}/shift-wordmark-white.png?v=${BRAND_ASSETS_VERSION}`

export const GSI_WORDMARK_URL =
  `${BRAND_ASSETS_BASE}/gsi-wordmark.png?v=${BRAND_ASSETS_VERSION}`

export const PRIZE_METRIC_LABELS: Record<string, string> = {
  pct_non_car: 'Shift Rate',
  trips: 'Active trips',
  active_days: 'Active days',
  miles: 'Miles shifted',
}

export const PRIZE_METRIC_UNITS: Record<string, string> = {
  pct_non_car: '%',
  trips: 'trips',
  active_days: 'days',
  miles: 'mi',
}

export const DEFAULT_METRIC_THRESHOLD: Record<string, string> = {
  pct_non_car: '25',
  trips: '10',
  active_days: '5',
  miles: '10',
}

export const EMPTY_PRIZE_FORM: PrizeFormState = {
  id: null,
  name: 'Gift Card Drawing',
  award_mode: 'drawing',
  metric: 'pct_non_car',
  min_threshold: '25',
  winner_count: '3',
  funded_from_pool: false,
  amount_dollars: '25',
  tremendous_product_id: '',
  prize_description: '',
  auto_draw: true,
}

export const MODE_LABEL: Record<string, string> = {
  walk: 'Walking',
  bike: 'Biking',
  transit_bus: 'Bus',
  transit_train: 'Train',
  transit_commuter_rail: 'Commuter rail',
  escooter: 'E-scooter',
  carpool: 'Carpool',
  drive: 'Drive',
  other: 'Other',
}

export const METRIC_LABELS: Record<string, string> = {
  pct_non_car: 'Shift Rate',
  trips: 'Total active trips',
  active_days: 'Active days',
  miles: 'Miles shifted',
}

export const TIER_LABEL: Record<string, string> = {
  starter: 'Starter',
  basic: 'Basic',
  standard: 'Standard',
  premium: 'Premium',
}

export const TIER_ANNUAL_PRICE: Record<string, number> = {
  starter: 500,
  basic: 1000,
  standard: 3000,
  premium: 5000,
}

export const TIER_ORDER: Record<string, number> = {
  starter: 0,
  basic: 1,
  standard: 2,
  premium: 3,
}
