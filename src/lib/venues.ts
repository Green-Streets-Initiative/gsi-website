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
 * OpenStreetMap addresses (TD Garden checked 2026-10-28, Fenway and
 * Gillette 2026-11-02), rounded up. Where the venue or garage publishes its
 * own walk time, that one is used and the entry says so.
 *
 * Prices, rules and event trains are in venue-facts.json, kept current by the
 * weekly venue-parking-prices routine; this file holds what rarely changes.
 */

import venueFacts from './venue-facts.json'

export type Garage = {
  name: string
  address: string
  lat: number
  lng: number
  /** 0 = in the building. */
  walkMin: number
  /** The venue's own garage, or the one the team points fans to. Shown as the big card. */
  official?: boolean
  /** Where it is, for the venue's own garage ("Under the arena"). */
  where?: string
  /** Published prices, largest first. Only from the venue or the garage. */
  prices?: { label: string; amount: string }[]
  facts?: string[]
  /** One line under the address in the list (a published rate, a catch). */
  note?: string
  /** Left off the map when it's far enough to squash the pins near the venue. */
  offMap?: boolean
  book?: { label: string; url: string }
}

export type BikeDock = { ids: string[]; name: string; lat: number; lng: number; walkMin: number }

/** A special event train (Gillette). Dates are Eastern, YYYY-MM-DD; past ones drop off the page. */
export type EventTrain = { date: string; event: string; times: string; onSale: string }

/** A T station with the team's free game-day shuttle (White Stadium). `stop` is the MBTA parent stop, for its live board. */
export type ShuttleStation = { stop: string; name: string; lines: string[]; where: string; lat: number; lng: number }

type Source = { label: string; url: string }

export type Venue = {
  slug: string
  name: string
  address: string
  lat: number
  lng: number
  /** The one-line answer in the hero. */
  lede: string
  garages: Garage[]
  /** Where the prices came from, and the day they were last confirmed there (YYYY-MM-DD, Eastern).
   *  The weekly price check moves it forward; after 45 days the page says the prices may be out of date. */
  priceSources: { label: string; url: string }[]
  checked: string
  /** Said before the sources line ("Buying ahead holds you a space."). */
  priceNote?: string
  /** The list under the big card: its heading and one line above it. Left out with no garages. */
  others?: { title: string; note: string }
  /** Where a visitor compares the other garages. Left out when there's nothing to compare. */
  compare?: { label: string; url: string }
  transit: {
    /** MBTA parent stop id for live departures and alerts. */
    stop: string
    stopName: string
    lat: number
    lng: number
    /** The section's heading, a full sentence. */
    headline: string
    lines: string[]
    tips: string[]
    /** 'alerts' when the station has no useful live board (Foxboro on a game day). */
    live: 'board' | 'alerts'
    eventTrains?: { fare: string; buy: string; trips: EventTrain[]; source: { label: string; url: string } }
  }
  bikes?: {
    docks: BikeDock[]
    note: string
    /** Bike parking at the venue, as numbers (White Stadium's valet, racks and new dock). */
    parking?: { tiles: { amount: string; label: string }[]; source: Source }
  }
  rideshare: string
  /** Where the team plays now, when it isn't here yet (White Stadium until 2028). From venue-facts.json. */
  notice?: { text: string; source: Source }
  /**
   * A venue with no fan parking (White Stadium): the answer card's tiles and
   * chips come from venue-facts.json `prices` and `facts`, `pending` lists what
   * isn't decided yet, and the shuttle stations take the garages' place.
   */
  noParking?: { title: string; tiles: { label: string; amount: string }[]; chips: string[]; pending: string[] }
  shuttles?: { stations: ShuttleStation[]; satellite: string; source: Source }
  /** Walking in: the nearest stations and stops with their walk, and the entrances. */
  walk?: { from: { name: string; lines: string; walkMin: number }[]; entrances: string }
}

const BASE: Record<string, VenueBase> = {
  'td-garden': {
    slug: 'td-garden',
    name: 'TD Garden',
    address: '100 Legends Way, Boston',
    lat: 42.3663,
    lng: -71.06216,
    lede: 'The North Station Garage is right under the arena.',
    garages: [
      {
        name: 'North Station Garage',
        address: '121 Nashua St or 140 Causeway St',
        lat: 42.36652,
        lng: -71.06516,
        walkMin: 0,
        official: true,
        where: 'Under the arena',
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
    priceSources: [{ label: 'tdgarden.com', url: 'https://www.tdgarden.com/plan-your-visit/directions-parking/north-station-garage' }],
    priceNote: 'Buying ahead holds you a space.',
    others: {
      title: 'A short walk away',
      note: 'Prices change by event. TD Garden sends people to SpotHero to compare the garages nearby.',
    },
    compare: { label: 'Compare garages on SpotHero', url: 'https://spothero.com/destination/boston/td-garden-parking' },
    transit: {
      stop: 'place-north',
      stopName: 'North Station',
      lat: 42.365577,
      lng: -71.06129,
      headline: 'Or take the T: North Station is under the arena.',
      live: 'board',
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

  // Red Sox rates are for the 2026 season (it ended in September); mlb.com
  // can't be read by a script, so the rates come from the garage's own page
  // and WBUR's Aug 21, 2026 guide, which agree.
  'fenway-park': {
    slug: 'fenway-park',
    name: 'Fenway Park',
    address: '4 Jersey St, Boston',
    lat: 42.34646,
    lng: -71.0971,
    lede: 'The Red Sox rate is at the Prudential Center Garage, a 15-minute walk, for night and weekend games.',
    garages: [
      {
        name: 'Prudential Center Garage',
        address: 'Enter from Boylston St, Huntington Ave, Dalton St, Exeter St or Belvidere St',
        // The Prudential Center's and WBUR's walk time (0.9 mi), from the Dalton St side.
        lat: 42.34837,
        lng: -71.07934,
        walkMin: 15,
        official: true,
        offMap: true,
        where: 'Red Sox discount garage · 15 min walk',
      },
      { name: 'Van Ness Garage', address: '1341 Boylston St', lat: 42.34469, lng: -71.09932, walkMin: 5 },
      { name: 'Fenway Center Bower Garage', address: '771 Beacon St, enter on David Ortiz Dr', lat: 42.34722, lng: -71.10131, walkMin: 6 },
      { name: 'Fenway Triangle Garage', address: '180 Brookline Ave', lat: 42.34426, lng: -71.10131, walkMin: 7 },
      { name: 'Landmark Center Garage', address: '401 Park Dr', lat: 42.34461, lng: -71.10267, walkMin: 8 },
      {
        name: '100 Clarendon Garage',
        address: '100 Clarendon St, Back Bay',
        lat: 42.34805,
        lng: -71.07508,
        walkMin: 29,
        offMap: true,
      },
    ],
    priceSources: [
      { label: 'prudentialcenter.com', url: 'https://www.prudentialcenter.com/visit/parking/' },
      { label: 'WBUR', url: 'https://www.wbur.org/news/2026/08/21/fenway-park-guide-food-transportation-parking' },
    ],
    others: {
      title: 'A short walk away',
      note: '',
    },
    compare: { label: 'Compare garages on SpotHero', url: 'https://spothero.com/destination/boston/fenway-park-parking' },
    transit: {
      stop: 'place-kencl',
      stopName: 'Kenmore',
      lat: 42.348949,
      lng: -71.095169,
      headline: 'Or take the T: Kenmore station is a 5-minute walk.',
      live: 'board',
      lines: ['Green Line B, C and D', 'Commuter Rail at Lansdowne'],
      tips: [
        'Worcester Line Commuter Rail: Lansdowne is 3 minutes from the park.',
        'Green Line D: the Fenway stop is about 8 minutes on foot.',
        'Red Line: change at Park Street to a B, C or D train to Kenmore.',
      ],
    },
    bikes: {
      docks: [
        { ids: ['2123672938202825324'], name: 'Ipswich St at Van Ness St', lat: 42.34581, lng: -71.09549, walkMin: 3 },
        { ids: ['47c44bb1-d065-41f5-ad79-c18aee60af34'], name: 'Boylston St at Jersey St', lat: 42.34465, lng: -71.09733, walkMin: 4 },
        { ids: ['f8347ccd-0de8-11e7-991c-3863bb43a7d0'], name: 'Kenmore Square', lat: 42.34871, lng: -71.09701, walkMin: 4 },
        { ids: ['99675a11-a92c-465c-bf5a-434b08ba5fc6'], name: 'Lansdowne T Stop', lat: 42.34734, lng: -71.10017, walkMin: 5 },
      ],
      note: 'On game days there’s free bike valet at Gate D, Van Ness St at Jersey St. It closes 30 minutes after the game.',
    },
    rideshare: 'Fenway has no set pick-up zone. Walk a few blocks from the park and the app shows where to meet your driver.',
  },

  // Lot positions from OpenStreetMap (Lot 50A for the free lots across
  // Route 1, which run Lots 41 to 55: 10 to 17 minutes' walk; Lot 55 for Be
  // Paid to Park; Lot 4B for the stadium-side lots).
  'gillette-stadium': {
    slug: 'gillette-stadium',
    name: 'Gillette Stadium',
    address: '1 Patriot Place, Foxborough',
    lat: 42.09089,
    lng: -71.26417,
    lede: 'The general lots are across Route 1, a 10 to 17 minute walk to the stadium.',
    garages: [
      {
        name: 'Free lots across Route 1',
        address: '',
        lat: 42.09198,
        lng: -71.27264,
        walkMin: 10,
        official: true,
        where: 'For every ticket holder · 10 to 17 min walk',
        book: { label: 'Lot maps and rules', url: 'https://www.gillettestadium.com/parking/' },
      },
      {
        name: 'Be Paid to Park: Lots 45 and 55B',
        address: 'Across Route 1',
        lat: 42.09725,
        lng: -71.26988,
        walkMin: 14,
      },
      {
        name: 'Stadium-side lots',
        address: 'Next to the stadium',
        lat: 42.0939,
        lng: -71.26329,
        walkMin: 6,
      },
    ],
    priceSources: [{ label: 'gillettestadium.com', url: 'https://www.gillettestadium.com/parking/' }],
    others: { title: 'Other lots', note: 'Closer to the stadium, or paid to wait.' },
    transit: {
      stop: 'place-FS-0049',
      stopName: 'Foxboro',
      lat: 42.0951,
      lng: -71.26151,
      headline: 'Or take the train: the event train stops at the stadium.',
      live: 'alerts',
      lines: ['From South Station, Back Bay and Dedham', 'From Providence on some dates'],
      tips: [
        'Trains get in about an hour before kickoff and leave 30 minutes after the game ends.',
        'Regular Commuter Rail tickets and passes don’t work on event trains.',
        'On weekdays the regular Franklin/Foxboro Line stops here too, but the last train can leave before the event ends.',
      ],
      eventTrainSource: { label: 'mbta.com', url: 'https://www.mbta.com/destinations/gillette-stadium' },
    },
    rideshare: 'Uber and Lyft pick up in Lot 15 or 16, next to Bass Pro Shops at Patriot Place; the event guide says which. No drop-offs on Route 1.',
  },

  // Boston Legacy FC (NWSL) from the 2028 season (Keith 2026-11-05, for the
  // partnership pitch). No fan parking: the City's Transportation Access Plan
  // Agreement with the team (signed 2026-05-07) has free shuttles from three
  // stations and satellite lots instead. Shuttle stops from its Exhibits
  // D.1-D.3 (April 2026, "subject to revision"); bike parking from section 3.C;
  // entrances from 3.B. Walks to Green Street (1.18 km) and Stony Brook
  // (1.25 km) are OpenStreetMap foot routes at 80 m a minute; the bus stop and
  // docks are straight-line × 1.25. Stadium point from OpenStreetMap.
  'white-stadium': {
    slug: 'white-stadium',
    name: 'White Stadium',
    address: '450 Walnut Ave, Boston',
    lat: 42.30948,
    lng: -71.09594,
    lede: 'There’s no fan parking at the stadium. Free shuttles run from Forest Hills, Ruggles and JFK/UMass.',
    garages: [],
    priceSources: [
      { label: 'boston.gov', url: 'https://www.boston.gov/news/transportation-access-plan-agreement-white-stadium-update' },
      { label: 'the City’s agreement with the team', url: 'https://drive.google.com/file/d/1Q_FJfjN2FbtRUbrXPG_KyB7-dhq7G7aa/view' },
    ],
    shuttles: {
      stations: [
        { stop: 'place-forhl', name: 'Forest Hills', lines: ['Orange Line', 'Needham, Franklin and Providence trains'], where: 'On the Arborway side of the station', lat: 42.300713, lng: -71.113943 },
        { stop: 'place-rugg', name: 'Ruggles', lines: ['Orange Line', 'Needham, Franklin and Providence trains'], where: 'On Columbus Ave, by the station entrance', lat: 42.336377, lng: -71.088961 },
        { stop: 'place-jfk', name: 'JFK/UMass', lines: ['Red Line', 'Kingston, Greenbush and Fall River/New Bedford trains'], where: 'On Columbia Rd, by the station entrance', lat: 42.320685, lng: -71.052391 },
      ],
      satellite: 'Lots outside Boston. Buy parking with your ticket and ride the free shuttle in.',
      source: { label: 'the City’s agreement with the team', url: 'https://drive.google.com/file/d/1Q_FJfjN2FbtRUbrXPG_KyB7-dhq7G7aa/view' },
    },
    transit: {
      stop: 'place-forhl',
      stopName: 'Forest Hills',
      lat: 42.300713,
      lng: -71.113943,
      headline: 'Take the T to a free shuttle.',
      live: 'board',
      lines: [],
      tips: ['Every shuttle is wheelchair accessible.', 'Bus 16 from Forest Hills stops on Circuit Drive, an 8-minute walk from the stadium.'],
    },
    bikes: {
      docks: [
        { ids: ['2327cb08-fa9f-459b-9ab0-1a319b0f2f4c'], name: 'Walnut Ave at School St', lat: 42.311877, lng: -71.0964068, walkMin: 5 },
        { ids: ['f8350cc1-0de8-11e7-991c-3863bb43a7d0'], name: 'Seaver St at Humboldt Ave', lat: 42.309796, lng: -71.092225, walkMin: 5 },
        { ids: ['f834e244-0de8-11e7-991c-3863bb43a7d0'], name: 'Egleston Square', lat: 42.315692, lng: -71.098634, walkMin: 12 },
        { ids: ['f834f036-0de8-11e7-991c-3863bb43a7d0'], name: 'Green Street T Stop', lat: 42.310579, lng: -71.107341, walkMin: 15 },
      ],
      note: '',
      parking: {
        tiles: [
          { amount: '1,000', label: 'Bike valet spaces on game days' },
          { amount: '16', label: 'Docks at a new Bluebikes station in the park' },
          { amount: '10', label: 'Bike racks at the stadium' },
        ],
        source: { label: 'the City’s agreement with the team', url: 'https://drive.google.com/file/d/1Q_FJfjN2FbtRUbrXPG_KyB7-dhq7G7aa/view' },
      },
    },
    walk: {
      from: [
        { name: 'Seaver St at Humboldt Ave', lines: 'Buses 22 and 29', walkMin: 5 },
        { name: 'Green Street', lines: 'Orange Line', walkMin: 15 },
        { name: 'Stony Brook', lines: 'Orange Line', walkMin: 16 },
      ],
      entrances: 'Walk in from Walnut Ave at School St or Park Lane, or from Pierpont Rd at Circuit Drive.',
    },
    rideshare: 'On game days Uber and Lyft drop off and pick up at the Seaver Street lot. Free wheelchair-accessible carts run from there to the stadium.',
  },
}

/** The parts that go out of date live in venue-facts.json (see its _comment). */
type Facts = {
  checked: string
  priceNote?: string
  othersNote?: string
  prices: { label: string; amount: string }[]
  facts?: string[]
  notes?: Record<string, string>
  trains?: { fare: string; buy: string; trips: EventTrain[] }
  notice?: { text: string; source: Source }
  pending?: string[]
}
type VenueBase = Omit<Venue, 'checked' | 'transit' | 'notice' | 'noParking'> & {
  transit: Omit<Venue['transit'], 'eventTrains'> & { eventTrainSource?: { label: string; url: string } }
}
const FACTS = venueFacts as unknown as Record<string, Facts>

const withFacts = ({ transit: { eventTrainSource, ...transit }, ...b }: VenueBase): Venue => {
  const f = FACTS[b.slug]
  return {
    ...b,
    checked: f.checked,
    priceNote: f.priceNote ?? b.priceNote,
    others: b.others && { ...b.others, note: f.othersNote ?? b.others.note },
    garages: b.garages.map((g) => (g.official ? { ...g, prices: f.prices, facts: f.facts } : { ...g, note: f.notes?.[g.name] ?? g.note })),
    transit: { ...transit, eventTrains: f.trains && eventTrainSource ? { ...f.trains, source: eventTrainSource } : undefined },
    notice: f.notice,
    // No garages: the tiles and chips answer the parking question instead.
    noParking:
      b.garages.length === 0
        ? { title: `No fan parking at ${b.name}`, tiles: f.prices, chips: f.facts ?? [], pending: f.pending ?? [] }
        : undefined,
  }
}

export const VENUES: Record<string, Venue> = Object.fromEntries(Object.entries(BASE).map(([slug, b]) => [slug, withFacts(b)]))

export const getVenue = (slug: string): Venue | null => VENUES[slug] ?? null
