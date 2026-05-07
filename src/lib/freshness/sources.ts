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
  },
  {
    url: 'https://bluebikes.com/pricing',
    label: 'Bluebikes pricing',
    affectedGuideIds: ['mg_bluebikes', 'mg_bike_sweat'],
  },
]

/** How old a guide can get before the freshness sweep flags it for review. */
export const STALE_AFTER_DAYS = 180
