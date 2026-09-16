/**
 * Shift Your Semester — school registry.
 *
 * Static data for the campaign hub and per-school pages. `groupSlug` is the
 * school's row in the Shift `groups` table (looked up live for the join
 * section). All twelve groups exist (Shift migration 00880); the same list,
 * with each school's email domains, lives server-side in `campaign_schools`.
 * Campus lat/lng feeds the nearby-events selector.
 *
 * Benefit facts are sourced from each school's own pages (researched
 * 2026-08-26). Content rules: no dollar prices or order deadlines that go
 * stale each term — describe the program and link the school's page instead.
 */

export type SchoolFact = { text: string; sourceUrl: string }

/**
 * A challenge the school runs itself, alongside ours. Shown on the school
 * page only while `startsAt` ≤ today < `endsAt`, with the prize for the
 * current month picked at render time, so nothing on the page goes stale as
 * the term moves on. Facts come from the school's own page (`sourceUrl`).
 */
export type CampusChallenge = {
  name: string
  /** Short label for the section nav, e.g. "Jumbo Footprint". */
  navLabel: string
  /** Human period, e.g. "August 28 – December 1, 2026". */
  period: string
  /** ISO dates; the block hides outside [startsAt, endsAt). */
  startsAt: string
  endsAt: string
  /** How trips are logged there, e.g. "GoMassCommute". */
  logsWith: string
  /** One or two sentences on the mechanic, in the school's terms. */
  summary: string
  /** Prize by calendar month (1–12); the current month's line renders. */
  monthly: { month: number; prize: string }[]
  url: string
  sourceUrl: string
}

export type School = {
  slug: string
  name: string
  shortName: string
  logo: string
  groupSlug: string | null
  lat: number
  lng: number
  /** One distinctive lead fact for the hub card / page hero. */
  highlight?: string
  /**
   * Search title/description, overriding the "Shift Your Semester at X"
   * template in the page's generateMetadata.
   *
   * These pages rank on page one for what students actually search — "bu cycle
   * kitchen", "mit t pass", "tufts safe ride", "northeastern blue bike
   * discount" — and drew 978 Google impressions for 1 click in the four weeks
   * to 2026-09-04. The content answered those questions; the title named the
   * campaign instead, so the answer never looked like an answer in the results
   * list. Same fix that took roam pages from 2 to 11 earning impressions.
   *
   * Rule when editing: every noun in a title must be backed by a sourced fact
   * in that school's arrays below. Do not title a page for a query it cannot
   * answer — "simmons student parking" gets impressions, but there is no
   * parking fact here, so the title does not promise one.
   */
  seoTitle?: string
  seoDescription?: string
  transit: SchoolFact[]
  bike: SchoolFact[]
  moving: SchoolFact[]
  /** A challenge the school runs itself, when one is on. */
  campusChallenge?: CampusChallenge
}

export const SCHOOLS: School[] = [
  {
    slug: 'emerson',
    name: 'Emerson College',
    shortName: 'Emerson',
    logo: '/images/schools/emerson.png',
    groupSlug: 'emerson-college',
    lat: 42.3521,
    lng: -71.0658,
    highlight: 'Campus on Boston Common, steps from the Green and Orange Lines.',
    seoTitle: 'Emerson MBTA pass discount, free bike rooms & the Theatre District campus | Shift',
    seoDescription:
      'Emerson\'s discounted semester MBTA passes, the two free indoor bike rooms at Boylston Place and Ansin, and Bluebikes at the edge of campus. Plus Shift, which logs your walks, rides and T trips automatically.',
    transit: [
      { text: 'Discounted semester MBTA passes for on- and off-campus students, picked up on campus near the start of term.', sourceUrl: 'https://emerson.edu/departments/off-campus-student-services/programs' },
      { text: 'The campus sits at the junction of the Green and Orange Lines plus several bus routes — most of Boston is a one-seat ride away.', sourceUrl: 'https://emerson.edu/about/sustainability/' },
    ],
    bike: [
      { text: 'Two free indoor bike rooms — Boylston Place and the Ansin Building — for students, faculty, and staff (register your bike first).', sourceUrl: 'https://emerson.edu/policies/bicycle-registration-policies' },
      { text: 'Bluebikes stations sit right at the edge of campus on Boylston and Stuart Streets.', sourceUrl: 'https://emerson.edu/emerson-life/campus/sustainability/what-were-doing/sustainability-campus' },
    ],
    moving: [
      { text: 'The Theatre District campus is one of the most walkable campuses in Boston — Chinatown, Downtown Crossing, and the Common are all minutes on foot.', sourceUrl: 'https://emerson.edu/about/sustainability/' },
    ],
  },
  {
    slug: 'boston-college',
    name: 'Boston College',
    shortName: 'BC',
    logo: '/images/schools/boston-college.png',
    groupSlug: 'boston-college',
    lat: 42.3355,
    lng: -71.1685,
    highlight: 'The Green Line B ends at the foot of campus — BC is literally the end of the line.',
    seoTitle: 'BC MBTA pass discount, bike parking & the Green Line B to campus | Shift',
    seoDescription:
      'BC\'s discounted semester MBTA passes, roughly 300 bike parking spaces across 15 locations, showers for bike commuters, and the Green Line B ending at campus. Plus Shift, which logs your trips automatically.',
    transit: [
      { text: 'Discounted semester MBTA passes through Student Services — they open in summer and close early, so order ahead.', sourceUrl: 'https://www.bc.edu/bc-web/offices/student-services/billing-student-accounts/mbta-passes-parking-permits.html' },
      { text: 'The Green Line B branch terminates at the foot of campus on Comm Ave.', sourceUrl: 'https://www.bc.edu/bc-web/offices/aux-services/sites/transportation-parking/commuting.html' },
    ],
    bike: [
      { text: 'Roughly 300 bike parking spaces across 15 locations on the Chestnut Hill and Brighton campuses, with free bike registration.', sourceUrl: 'https://www.bc.edu/bc-web/offices/aux-services/sites/transportation-parking/commuting.html' },
      { text: 'Locker rooms with showers for bike commuters — ride in, clean up, get to class.', sourceUrl: 'https://www.bc.edu/bc-web/offices/aux-services/sites/transportation-parking/commuting.html' },
    ],
    moving: [
      { text: 'Free shuttles link the campuses, nearby transit hubs (including the Green Line C at Cleveland Circle), and weekend shopping runs.', sourceUrl: 'https://www.bc.edu/bc-web/offices/aux-services/sites/transportation-parking/shuttles.html' },
    ],
  },
  {
    slug: 'boston-university',
    name: 'Boston University',
    shortName: 'BU',
    logo: '/images/schools/boston-university.png',
    groupSlug: 'boston-university',
    lat: 42.3505,
    lng: -71.1054,
    highlight: 'Home of the BU Cycle Kitchen — a free DIY bike shop that teaches you to fix your own ride.',
    seoTitle: 'BU Cycle Kitchen, the Bluebikes discount & The BUS shuttle | Shift',
    seoDescription:
      'The BU Cycle Kitchen at 1019 Comm Ave — free, self-service, staff teach and you wrench — plus BU\'s discounted Bluebikes membership, secure bike rooms, and The BUS running seven days a week.',
    transit: [
      { text: 'BU’s transportation office publishes clear guidance on when a semester pass beats paying per ride — worth reading before you buy.', sourceUrl: 'https://www.bu.edu/transportation/public-transit/student-mbta-options/' },
      { text: 'The BUS — BU’s free shuttle — runs seven days a week with late-night service, with live tracking in the Terrier Transit app.', sourceUrl: 'https://www.bu.edu/transportation/bus/' },
    ],
    bike: [
      { text: 'The BU Cycle Kitchen at 1019 Comm Ave is a free, self-service repair space — staff teach, you wrench. It has helped 900+ riders.', sourceUrl: 'https://www.bu.edu/transportation/bicycling/buck/' },
      { text: 'Discounted Bluebikes membership for students, faculty, and staff, plus secure bike rooms, air pumps, and repair stations across campus.', sourceUrl: 'https://www.bu.edu/transportation/bicycling/' },
      { text: 'A live calendar of bike events: the Comm Ave Slow Roll, bike swap meets, and how-to workshops.', sourceUrl: 'https://www.bu.edu/transportation/bicycling/' },
    ],
    moving: [
      { text: 'The Charles River Esplanade runs the length of campus — a riverside walk or ride to class.', sourceUrl: 'https://www.bu.edu/transportation/bicycling/' },
    ],
  },
  {
    slug: 'northeastern',
    name: 'Northeastern University',
    shortName: 'Northeastern',
    logo: '/images/schools/northeastern.png',
    groupSlug: 'northeastern-university',
    lat: 42.3398,
    lng: -71.0892,
    highlight: 'Free on-demand night shuttle covers everything within 1.5 miles of Snell Library.',
    seoTitle: 'Northeastern Bluebikes discount, the RedEye night shuttle & bike storage | Shift',
    seoDescription:
      'Northeastern\'s discounted Bluebikes membership (deeper for Pell Grant recipients), free NUPD bike registration with a metal security plate, secure indoor storage, and the free RedEye night shuttle.',
    transit: [
      { text: 'The campus touches the Green Line E and the Orange Line at Ruggles, with five Bluebikes stations in the campus area.', sourceUrl: 'https://pref.northeastern.edu/bike' },
    ],
    bike: [
      { text: 'Discounted Bluebikes membership for the Northeastern community, with extra discounts for Pell Grant recipients.', sourceUrl: 'https://pref.northeastern.edu/bike' },
      { text: 'Free NUPD bike registration includes a tamper-resistant metal security plate — stronger theft protection than a sticker.', sourceUrl: 'https://pref.northeastern.edu/bike' },
      { text: 'Secure indoor bike storage in two garages plus bike rooms in several residence halls.', sourceUrl: 'https://pref.northeastern.edu/bike' },
    ],
    moving: [
      { text: 'RedEye, the free on-demand night shuttle, runs 5 p.m.–6 a.m. during the academic year within 1.5 miles of Snell Library.', sourceUrl: 'https://nupd.northeastern.edu/our-services/safety-escort-services/' },
    ],
  },
  {
    slug: 'harvard',
    name: 'Harvard University',
    shortName: 'Harvard',
    logo: '/images/schools/harvard.png',
    groupSlug: 'harvard-university',
    lat: 42.3744,
    lng: -71.1169,
    highlight: 'Quad Bikes: a student-run shop with free repairs and group rides.',
    seoTitle: 'Harvard Quad Bikes, the Evening Van & campus fix-it stations | Shift',
    seoDescription:
      'Quad Bikes at Cabot House — free repairs during open-stand hours, plus group rides — the nightly free Evening Van across Cambridge and Allston, and fix-it stations with pumps and tools around campus.',
    transit: [
      { text: 'Harvard Square is a Red Line hub with bus connections in every direction — most of Cambridge and Boston is a one-seat ride.', sourceUrl: 'https://www.hupd.harvard.edu/transportation' },
      { text: 'The free Evening Van runs nightly across Cambridge and Allston during the academic year, 7 p.m.–3 a.m.', sourceUrl: 'https://transportation.harvard.edu/harvard-shuttle/evening-van' },
    ],
    bike: [
      { text: 'Quad Bikes, the student-run shop at Cabot House, offers free repairs during open-stand hours plus maintenance teaching and group rides.', sourceUrl: 'https://www.thecrimson.com/article/2025/9/16/quad-bikes-kickoff-event/' },
      { text: 'Fix-it stations with pumps and tools around campus, each with a QR code linking to repair instructions.', sourceUrl: 'https://www.transportation.harvard.edu/commuterchoice/bike/bike-programsresources' },
    ],
    moving: [
      { text: 'HUCEP walking escorts cover the Yard, River, Quad, and North Yard late nights Thursday–Saturday — flag down a bright vest or call.', sourceUrl: 'https://www.hupd.harvard.edu/transportation' },
    ],
  },
  {
    slug: 'mit',
    name: 'MIT',
    shortName: 'MIT',
    logo: '/images/schools/mit.png',
    groupSlug: 'mit',
    lat: 42.3601,
    lng: -71.0942,
    highlight: 'MIT covers 50–70% of students’ MBTA pass costs.',
    seoTitle: 'MIT T pass subsidy, SafeRide & the Bike Lab — getting around MIT | Shift',
    seoDescription:
      'MIT covers 50–70% of students\' MBTA pass costs, plus free SafeRide night routes, subsidized Bluebikes, the volunteer-run Bike Lab, and grocery-run shuttles.',
    transit: [
      { text: 'MIT covers 50–70% of the cost of MBTA passes for students — bus, subway, commuter rail, and boat.', sourceUrl: 'https://web.mit.edu/facilities/transportation/students.html' },
      { text: 'Free shuttles run early to late — including named grocery runs to Trader Joe’s, Market Basket, and Costco — with live tracking.', sourceUrl: 'https://web.mit.edu/facilities/transportation/students.html' },
    ],
    bike: [
      { text: 'A deeply subsidized Bluebikes membership for Cambridge-based students, plus the free volunteer-run MIT Bike Lab and eight fix-it stations.', sourceUrl: 'https://web.mit.edu/facilities/transportation/pw/bicycle_benefits.html' },
      { text: 'A published campus bike map covers racks, cages, and the Charles River path.', sourceUrl: 'https://web.mit.edu/facilities/transportation/docs/Getting_Around_by_Bike.pdf' },
    ],
    moving: [
      { text: 'SafeRide runs free night routes on both sides of the river, with door-to-door on-demand service after 11 p.m.', sourceUrl: 'https://police.mit.edu/saferide-shuttle' },
    ],
  },
  {
    slug: 'tufts',
    name: 'Tufts University',
    shortName: 'Tufts',
    logo: '/images/schools/tufts.png',
    groupSlug: 'tufts-university',
    lat: 42.4075,
    lng: -71.119,
    highlight: 'The Green Line Extension stops right at campus, one stop from Davis Square.',
    seoTitle: 'Tufts SafeRide, the Medford/Tufts Green Line stop & student bike checkout | Shift',
    seoDescription:
      'The Medford/Tufts Green Line stop, TUPD SafeRide and the Davis Square and Saturday grocery shuttles, free bike-and-helmet checkout for students at the Tisch Library desk, and Bike Check reimbursements.',
    transit: [
      { text: 'The Green Line Extension’s Medford/Tufts station puts the Hill one stop from Davis Square and a straight shot downtown.', sourceUrl: 'https://access.tufts.edu/commuter-benefits-discounts' },
      { text: 'Campus shuttles cover Davis Square, the SMFA campus, Saturday groceries, and TUPD SafeRide for late nights.', sourceUrl: 'https://access.tufts.edu/shuttles-sharing-services' },
    ],
    bike: [
      // Tufts Bikes (2026-09-16, Orion, president): the bikeshare is students only, and the shop is a
      // small volunteer crew with limited capacity. Say so, and don't sell it as a drop-in service.
      { text: 'Students can check out a bike and helmet free at the Tisch Library circulation desk with a Tufts ID (students only, not faculty or staff).', sourceUrl: 'https://tuftsbikes.com/' },
      { text: 'Tufts Bikes, a small crew of student volunteers, runs a repair shop at 28 Sawyer Ave with limited hours. Check tuftsbikes.com before you go.', sourceUrl: 'https://tuftsbikes.com/' },
      { text: '“Bike Check!” reimburses repairs, helmets, and safety gear twice a year, and Tufts affiliates get a discounted Bluebikes membership.', sourceUrl: 'https://access.tufts.edu/commuter-benefits-discounts' },
    ],
    moving: [
      { text: 'GoMassCommute tracks walking, biking, transit, and carpool commutes for prizes, with Emergency Ride Home as a backstop.', sourceUrl: 'https://access.tufts.edu/commuter-benefits-discounts' },
    ],
    // Tufts' own fall challenge (read 2026-09-14 from access.tufts.edu).
    campusChallenge: {
      name: 'Jumbo Footprint Challenge',
      navLabel: 'Jumbo Footprint',
      period: 'August 28 – December 1, 2026',
      startsAt: '2026-08-28',
      endsAt: '2026-12-02',
      logsWith: 'GoMassCommute',
      summary:
        'Tufts students and employees log walks, bike rides, transit, and carpools in GoMassCommute. Every 10 trips is an entry, and 30 trips gets you into the December grand prize drawing.',
      monthly: [
        { month: 9, prize: 'bike service, up to $100, for earning the Pedal Prodigy badge' },
        { month: 10, prize: 'Bluetooth headphones for riding the MBTA as a Transit Trooper' },
        { month: 11, prize: 'a commuter goodies basket for carpooling as a Carpool Cruiser' },
        { month: 12, prize: 'the grand prize drawing, for everyone with 30 or more trips' },
      ],
      url: 'https://go.tufts.edu/jumbofootprint',
      sourceUrl: 'https://access.tufts.edu/jumbo-footprint-challenge',
    },
  },
  {
    slug: 'umass-boston',
    name: 'UMass Boston',
    shortName: 'UMass Boston',
    logo: '/images/schools/umass-boston.png',
    groupSlug: 'umass-boston',
    lat: 42.3134,
    lng: -71.0386,
    highlight: 'A student-funded 50% T pass subsidy — it sells out fast every term.',
    seoTitle: 'UMass Boston T pass subsidy, free bike parking & the JFK/UMass shuttle | Shift',
    seoDescription:
      'The student-funded 50% semester T-pass subsidy (first-come, and it sells out), 740+ free bike parking spaces including a secured indoor shelter, and free shuttles from JFK/UMass every few minutes.',
    transit: [
      { text: 'A student-government-funded subsidy covers 50% of semester T passes for undergrads, first-come first-served — it sells out early, so act fast each term.', sourceUrl: 'https://www.umb.edu/transportation/mbta/students/' },
      { text: 'Free campus shuttles run from JFK/UMass station into campus every few minutes.', sourceUrl: 'https://www.umb.edu/transportation/' },
    ],
    bike: [
      { text: '740+ free bike parking spaces campus-wide, including a 125-space secured indoor shelter in the West Garage with a maintenance station.', sourceUrl: 'https://www.umb.edu/transportation/biking/' },
      { text: 'Bluebikes stations at JFK/UMass and the Campus Center connect the harbor campus to the network.', sourceUrl: 'https://www.umb.edu/transportation/' },
    ],
    moving: [
      { text: 'The HarborWalk wraps the entire Columbia Point campus — a waterfront walk or ride between classes.', sourceUrl: 'https://www.umb.edu/transportation/biking/' },
    ],
  },
  {
    slug: 'suffolk',
    name: 'Suffolk University',
    shortName: 'Suffolk',
    logo: '/images/schools/suffolk.png',
    groupSlug: 'suffolk-university',
    lat: 42.3588,
    lng: -71.0616,
    highlight: 'A downtown campus deliberately designed around walking and transit.',
    seoTitle: 'Suffolk MBTA pass discount & getting around the Beacon Hill campus | Shift',
    seoDescription:
      'Suffolk\'s discounted semester MBTA passes for undergrads and grad students, indoor bike storage in the residence halls, outdoor racks at six locations, and Park Street and Government Center on foot.',
    transit: [
      { text: 'Discounted semester MBTA passes for undergrads and grad students through the university’s online store.', sourceUrl: 'https://www.suffolk.edu/student-life/housing-dining/student-resources/discount-mbta-program' },
      { text: 'The Beacon Hill campus has several MBTA lines within a short walk — Park Street, Government Center, and Bowdoin are all close.', sourceUrl: 'https://www.suffolk.edu/about/directory/department-of-facilities/sustainability/transportation' },
    ],
    bike: [
      { text: 'Indoor bike storage in residence halls (ask your Residence Director) plus outdoor racks at six campus locations.', sourceUrl: 'https://www.suffolk.edu/about/directory/department-of-facilities/sustainability/transportation' },
    ],
    moving: [
      { text: 'Suffolk deliberately limits campus parking to keep the neighborhood walkable — the campus is built for getting around on foot.', sourceUrl: 'https://www.suffolk.edu/about/directory/department-of-facilities/sustainability/transportation' },
    ],
  },
  {
    slug: 'berklee',
    name: 'Berklee College of Music',
    shortName: 'Berklee',
    logo: '/images/schools/berklee.png',
    groupSlug: 'berklee-college-of-music',
    lat: 42.3465,
    lng: -71.0878,
    highlight: 'A card-access bike pavilion in the heart of Back Bay.',
    seoTitle: 'Berklee semester MBTA pass & the card-access bike pavilion | Shift',
    seoDescription:
      'Berklee\'s full-term semester MBTA passes, the gated bike pavilion at Cambria and Boylston with card access on your Berklee ID, and Hynes and Back Bay Station both minutes from campus.',
    transit: [
      { text: 'Semester MBTA passes covering the full fall or spring term, ordered through the college.', sourceUrl: 'https://berklee.helpscoutdocs.com/article/5112-transportation' },
      { text: 'Campus is steps from Hynes (Green Line) and near Back Bay Station (Orange Line, commuter rail, Amtrak) — one of the most transit-dense addresses in Boston.', sourceUrl: 'https://berklee.helpscoutdocs.com/article/5112-transportation' },
    ],
    bike: [
      { text: 'A gated bike pavilion at Cambria and Boylston Streets — secure, free parking with card access via your Berklee ID.', sourceUrl: 'https://berklee.helpscoutdocs.com/article/5112-transportation' },
    ],
    moving: [
      { text: 'With gear on your back, the walkable Back Bay location means rehearsal spaces, venues, and the Esplanade are all minutes away.', sourceUrl: 'https://berklee.helpscoutdocs.com/article/5112-transportation' },
    ],
  },
  {
    slug: 'simmons',
    name: 'Simmons University',
    shortName: 'Simmons',
    logo: '/images/schools/simmons.png',
    groupSlug: 'simmons-university',
    lat: 42.3391,
    lng: -71.0997,
    highlight: 'Free Longwood-area shuttles every 8–10 minutes.',
    seoTitle: 'Simmons MBTA pass, the free Longwood shuttles & bike repair stations | Shift',
    seoDescription:
      'Free MASCO shuttles through the Longwood Medical Area every 8–10 minutes, discounted semester MBTA passes, self-service bike repair stations, and CommuteFit rewards for walking commutes.',
    transit: [
      { text: 'Free MASCO shuttles run the Longwood Medical Area every 8–10 minutes and connect to Ruggles and JFK/UMass stations.', sourceUrl: 'https://www.simmons.edu/maps-directions/commuting-alternatives' },
      { text: 'Discounted semester MBTA passes ordered through Student Financial Services.', sourceUrl: 'https://www.simmons.edu/maps-directions/commuting-alternatives' },
    ],
    bike: [
      { text: 'Two self-service repair stations with pumps and tools — at One Palace Road and the Bartol Hall racks — plus covered bike parking at Bartol Hall.', sourceUrl: 'https://www.simmons.edu/maps-directions/commuting-alternatives' },
    ],
    moving: [
      { text: 'CommuteFit logs walking commutes for incentives — one of the only walking-specific reward programs at any Boston school.', sourceUrl: 'https://www.simmons.edu/maps-directions/commuting-alternatives' },
    ],
  },
  {
    slug: 'lesley',
    name: 'Lesley University',
    shortName: 'Lesley',
    logo: '/images/schools/lesley.png',
    groupSlug: 'lesley-university',
    lat: 42.3888,
    lng: -71.1225,
    highlight: 'Porter Square campus, right on the Red Line and commuter rail.',
    seoTitle: 'Lesley MBTA pass, the campus shuttle & Porter Square transit | Shift',
    seoDescription:
      'Lesley\'s discounted semester MBTA passes, the free shuttle linking all three campuses every 10–15 minutes, covered bike racks with a repair stand, and the Red Line and Fitchburg line at Porter.',
    transit: [
      { text: 'Discounted semester MBTA passes ordered through the Office of Student Activities.', sourceUrl: 'https://lesley.edu/students/transportation-parking-and-shuttle/bike-services' },
      { text: 'The free Lesley shuttle links all three campuses every 10–15 minutes during the academic year.', sourceUrl: 'https://lesley.edu/students/transportation-parking-and-shuttle/shuttle-schedule' },
    ],
    bike: [
      { text: 'Covered bike racks across the campuses and a repair stand behind Stebbins Hall on the Doble Campus.', sourceUrl: 'https://lesley.edu/students/transportation-parking-and-shuttle/bike-services' },
    ],
    moving: [
      { text: 'The Porter campus sits on the Red Line and the Fitchburg commuter rail line — Davis, Harvard, and downtown are minutes away.', sourceUrl: 'https://support.lesley.edu/support/solutions/articles/4000225603-getting-around-cambridge' },
    ],
  },
]

/**
 * Human name for a citation host, so a fact credits "Boston University" rather
 * than a bare lowercase "source".
 *
 * Keyed on hostname rather than the full URL so a school reorganizing its site
 * doesn't silently drop the label. Most entries are just the institution: the
 * ones that aren't are the cases where the publisher genuinely differs from the
 * school — a student newspaper, a student-run shop, a campus police department
 * — and saying so is the honest citation.
 */
const SOURCE_NAMES: Record<string, string> = {
  'www.bu.edu': 'Boston University',
  'www.bc.edu': 'Boston College',
  'emerson.edu': 'Emerson College',
  'www.umb.edu': 'UMass Boston',
  'www.suffolk.edu': 'Suffolk University',
  'www.simmons.edu': 'Simmons University',
  'lesley.edu': 'Lesley University',
  'support.lesley.edu': 'Lesley University',
  'web.mit.edu': 'MIT',
  'police.mit.edu': 'MIT Police',
  'pref.northeastern.edu': 'Northeastern University',
  'nupd.northeastern.edu': 'Northeastern University Police',
  'berklee.helpscoutdocs.com': 'Berklee College of Music',
  'access.tufts.edu': 'Tufts University',
  'tuftsbikes.com': 'Tufts Bikes',
  'transportation.harvard.edu': 'Harvard Transportation',
  'www.transportation.harvard.edu': 'Harvard Transportation',
  'www.hupd.harvard.edu': 'Harvard University Police',
  'www.thecrimson.com': 'The Harvard Crimson',
}

/**
 * Display name for a fact's citation. Falls back to the bare domain (minus
 * `www.`) for any host not in the map, so a new source still reads like a
 * citation instead of breaking the layout or going unlabeled.
 */
export function sourceName(url: string): string {
  try {
    const host = new URL(url).hostname
    return SOURCE_NAMES[host] ?? host.replace(/^www\./, '')
  } catch {
    return 'Source'
  }
}

export function getSchool(slug: string): School | null {
  return SCHOOLS.find((s) => s.slug === slug) ?? null
}
