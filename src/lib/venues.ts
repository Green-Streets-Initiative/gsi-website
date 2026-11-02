/*
 * Venue parking pages (/parking/<slug>): Keith 2026-10-28. People search
 * "TD Garden parking", so each page answers that first, with the garages,
 * their walk and their price, then shows the other ways in. Prices are the
 * venue's or the garage's own published numbers with the page they came from
 * and the day we checked; nothing is copied from SpotHero or ParkWhiz, whose
 * terms don't allow it. Live parts (trains, alerts, Bluebikes docks) come
 * from /api/venue-live.
 *
 * Walk minutes: straight-line distance × 1.25 at 80 m a minute, from
 * OpenStreetMap addresses (checked 2026-10-28), rounded up.
 */

export type Garage = {
  name: string
  address: string
  lat: number
  lng: number
  /** 0 = in the building. */
  walkMin: number
  /** The venue's own garage. */
  official?: boolean
  /** Where it is, for the venue's own garage ("Under the arena"). */
  where?: string
  /** Published prices, largest first. Only from the venue or the garage. */
  prices?: { label: string; amount: string }[]
  facts?: string[]
  book: { label: string; url: string }
}

export type BikeDock = { ids: string[]; name: string; lat: number; lng: number; walkMin: number }

export type Venue = {
  slug: string
  name: string
  address: string
  lat: number
  lng: number
  /** The one-line answer in the hero. */
  lede: string
  garages: Garage[]
  /** Where the prices came from. */
  priceSource: { label: string; url: string; checked: string }
  /** Where a visitor compares the other garages, and who suggests it. */
  compare: { label: string; url: string; note: string }
  transit: {
    /** MBTA parent stop id for live departures and alerts. */
    stop: string
    stopName: string
    lat: number
    lng: number
    headline: string
    lines: string[]
    tips: string[]
  }
  bikes: { docks: BikeDock[]; note: string }
  rideshare: string
}

export const VENUES: Record<string, Venue> = {
  'td-garden': {
    slug: 'td-garden',
    name: 'TD Garden',
    address: '100 Legends Way, Boston',
    lat: 42.3663,
    lng: -71.06216,
    lede: 'The North Station Garage is right under the arena: $60 if you buy ahead, or $70 at the gate on game nights.',
    garages: [
      {
        name: 'North Station Garage',
        address: '121 Nashua St or 140 Causeway St',
        lat: 42.36652,
        lng: -71.06516,
        walkMin: 0,
        official: true,
        where: 'Under the arena',
        prices: [
          { label: 'Bought ahead', amount: '$60' },
          { label: 'Game nights', amount: '$70' },
          { label: 'Other events', amount: '$65' },
        ],
        facts: ['Elevator to the arena', 'Good for 8 hours, then $5 an hour', 'Height limit 6′8″', 'EV charging on levels 1 and 3'],
        book: {
          label: 'Buy parking on Ticketmaster',
          url: 'https://www.ticketmaster.com/venue/8337?tab=addOns&addOnType=PARKING',
        },
      },
      {
        name: 'Alcott Garage',
        address: '35 Lomasney Way',
        lat: 42.36539,
        lng: -71.0649,
        walkMin: 4,
        book: { label: 'Compare prices', url: 'https://spothero.com/destination/boston/td-garden-parking' },
      },
      {
        name: 'Longfellow Place Garage',
        address: '60 Staniford St',
        lat: 42.36283,
        lng: -71.06384,
        walkMin: 7,
        book: { label: 'Compare prices', url: 'https://spothero.com/destination/boston/td-garden-parking' },
      },
      {
        name: 'North End Garage',
        address: '600 Commercial St',
        lat: 42.36711,
        lng: -71.0573,
        walkMin: 7,
        book: { label: 'Compare prices', url: 'https://spothero.com/destination/boston/td-garden-parking' },
      },
      {
        name: 'Government Center Garage',
        address: '50 New Sudbury St',
        lat: 42.36232,
        lng: -71.05893,
        walkMin: 9,
        book: { label: 'Event rates', url: 'https://governmentcentergarage.com/parking-faq.html' },
      },
    ],
    priceSource: {
      label: 'tdgarden.com',
      url: 'https://www.tdgarden.com/plan-your-visit/directions-parking/north-station-garage',
      checked: 'October 28, 2026',
    },
    compare: {
      label: 'Compare garages on SpotHero',
      url: 'https://spothero.com/destination/boston/td-garden-parking',
      note: 'Prices change by event. TD Garden sends people to SpotHero to compare the garages nearby.',
    },
    transit: {
      stop: 'place-north',
      stopName: 'North Station',
      lat: 42.365577,
      lng: -71.06129,
      headline: 'North Station is under the arena',
      lines: ['Orange Line', 'Green Line D and E', 'Commuter Rail north of Boston'],
      tips: [
        'Commuter Rail from the south: get off at Back Bay and take the Orange Line to North Station.',
        'Red Line: change at Park Street to the Green Line, 3 stops.',
        'Blue Line: change at Government Center to the Green Line, 2 stops.',
      ],
    },
    bikes: {
      docks: [
        { ids: ['cf5f920f-b61d-4db0-b139-14aff04d577c'], name: 'Canal St at Causeway St', lat: 42.36519, lng: -71.06079, walkMin: 3 },
        {
          ids: ['f8351eb0-0de8-11e7-991c-3863bb43a7d0', '2076849845777355316'],
          name: 'Nashua St at Red Auerbach Way',
          lat: 42.36567,
          lng: -71.06426,
          walkMin: 3,
        },
        { ids: ['3a6d94a7-9fee-41c5-b8cc-a8487c5e691b'], name: 'Valenti Way at Haverhill St', lat: 42.36474, lng: -71.05935, walkMin: 5 },
        { ids: ['1999644268058967024'], name: 'Staniford St at Merrimac St', lat: 42.36358, lng: -71.06372, walkMin: 6 },
      ],
      note: 'North Station has bike racks outside.',
    },
    rideshare: 'Uber and Lyft pick up and drop off on Merrimac Street, 7 PM to 2 AM.',
  },
}

export const getVenue = (slug: string): Venue | null => VENUES[slug] ?? null
