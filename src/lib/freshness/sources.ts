/**
 * Canonical price/fare sources tracked by the monthly freshness-check
 * agent. When dollar amounts on these pages change, the agent emails the
 * diff plus the list of guides that may need updating.
 *
 * To add a source: add an entry with the URL, a human label, and the IDs
 * of any guides that quote prices from this page.
 */

export interface FreshnessSource {
  url: string
  label: string
  /** Guide IDs likely to need updating if this page's prices change. */
  affectedGuideIds: string[]
  /** Dot-notation paths into prices.json tracked by this source (e.g. "mbta.subwaySingle"). */
  priceKeys: string[]
}

/**
 * Mapping from prices.json dot paths to the flat keys in the `pricing_data`
 * Supabase table.  Only keys that exist in pricing_data are listed — many
 * prices.json keys have no DB counterpart and are only consumed via the
 * static import.
 */
export const PRICING_DATA_KEY_MAP: Record<string, string> = {
  'mbta.subwaySingle': 'mbta_subway_single',
  'mbta.busSingle': 'mbta_bus_single',
  'mbta.linkPassMonthly': 'mbta_subway_monthly',
  'mbta.busPassMonthly': 'mbta_bus_monthly',
  'driving.gasPerGallonMa': 'gas_price_ma',
  'driving.parkingDailyBoston': 'parking_daily_boston',
  'driving.maintPerMile': 'maint_per_mile',
}

export const SOURCES: FreshnessSource[] = [
  {
    url: 'https://www.mbta.com/fares',
    label: 'MBTA fares',
    affectedGuideIds: [
      'mg_pay_for_t',
      'mg_bus_transfers',
      'mg_subway_vs_bus',
      'mg_first_bus_ride',
      'mg_transit_time',
      'mg_transit_plus_walking',
    ],
    priceKeys: [
      'mbta.subwaySingle',
      'mbta.busSingle',
      'mbta.linkPassMonthly',
      'mbta.busPassMonthly',
      'mbta.dayPass',
      'mbta.weekPass',
      'mbta.commuterRailMin',
      'mbta.commuterRailMax',
    ],
  },
  {
    url: 'https://bluebikes.com/pricing',
    label: 'Bluebikes pricing',
    affectedGuideIds: ['mg_bluebikes', 'mg_bike_sweat'],
    priceKeys: [
      'bluebikes.singleRide',
      'bluebikes.dayPass',
      'bluebikes.monthly',
      'bluebikes.annual',
      'bluebikes.annualPerMonth',
      'bluebikes.ebikePerMinMember',
      'bluebikes.ebikePerMinNonMember',
      'bluebikes.ebikePerMinIncomeEligible',
    ],
  },
]

/** How old a guide can get before the freshness sweep flags it for review. */
export const STALE_AFTER_DAYS = 180
