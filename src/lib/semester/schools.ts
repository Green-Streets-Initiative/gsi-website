/**
 * Shift Your Semester — school registry.
 *
 * Static data for the campaign hub and per-school pages. `groupSlug` is the
 * school's row in the Shift `groups` table (looked up live for the join
 * section); null means the group hasn't been created yet and the page renders
 * its "coming" state. Campus lat/lng feeds the nearby-events selector.
 *
 * Benefit facts are sourced from each school's own pages (researched
 * 2026-08-26). Content rules: no dollar prices or order deadlines that go
 * stale each term — describe the program and link the school's page instead.
 */

export type SchoolFact = { text: string; sourceUrl: string }

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
  transit: SchoolFact[]
  bike: SchoolFact[]
  moving: SchoolFact[]
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
    transit: [
      { text: 'Discounted semester MBTA passes for on- and off-campus students, picked up on campus near the start of term.', sourceUrl: 'https://emerson.edu/departments/off-campus-student-services/programs' },
      { text: 'The campus sits at the junction of the Green and Orange Lines plus several bus routes — most of Boston is a one-seat ride away.', sourceUrl: 'https://emerson.edu/about/sustainability/' },
    ],
    bike: [
      { text: 'Two free indoor bike rooms — Boylston Place and the Ansin Building — for students, faculty, and staff (register your bike first).', sourceUrl: 'https://emerson.edu/policies/bicycle-registration-policies' },
      { text: 'Bluebikes stations sit right at the edge of campus on Boylston and Stuart Streets.', sourceUrl: 'https://emerson.edu/emerson-life/campus/sustainability/what-were-doing/sustainability-campus' },
    ],
    moving: [
      { text: 'The Theatre District campus is one of the most walkable college addresses in the country — Chinatown, Downtown Crossing, and the Common are all minutes on foot.', sourceUrl: 'https://emerson.edu/about/sustainability/' },
    ],
  },
  {
    slug: 'boston-college',
    name: 'Boston College',
    shortName: 'BC',
    logo: '/images/schools/boston-college.png',
    groupSlug: null,
    lat: 42.3355,
    lng: -71.1685,
    highlight: 'The Green Line B ends at the foot of campus — BC is literally the end of the line.',
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
    groupSlug: null,
    lat: 42.3505,
    lng: -71.1054,
    highlight: 'Home of the BU Cycle Kitchen — a free DIY bike shop that teaches you to fix your own ride.',
    transit: [
      { text: 'BU’s transportation office publishes refreshingly honest guidance on when a semester pass beats paying per ride — worth reading before you buy.', sourceUrl: 'https://www.bu.edu/transportation/public-transit/student-mbta-options/' },
      { text: 'The BUS — BU’s free shuttle — runs seven days a week with late-night service, with live tracking in the Terrier Transit app.', sourceUrl: 'https://www.bu.edu/transportation/bus/' },
    ],
    bike: [
      { text: 'The BU Cycle Kitchen at 1019 Comm Ave is a free, self-service repair space — staff teach, you wrench. It has helped 900+ riders.', sourceUrl: 'https://www.bu.edu/transportation/bicycling/buck/' },
      { text: 'Discounted Bluebikes membership for students, faculty, and staff, plus secure bike rooms, air pumps, and repair stations across campus.', sourceUrl: 'https://www.bu.edu/transportation/bicycling/' },
      { text: 'A live calendar of bike events: the Comm Ave Slow Roll, bike swap meets, and how-to workshops.', sourceUrl: 'https://www.bu.edu/transportation/bicycling/' },
    ],
    moving: [
      { text: 'The Charles River Esplanade runs the length of campus — the prettiest walk or ride to class in Boston.', sourceUrl: 'https://www.bu.edu/transportation/bicycling/' },
    ],
  },
  {
    slug: 'northeastern',
    name: 'Northeastern University',
    shortName: 'Northeastern',
    logo: '/images/schools/northeastern.png',
    groupSlug: null,
    lat: 42.3398,
    lng: -71.0892,
    highlight: 'Free on-demand night shuttle covers everything within 1.5 miles of Snell Library.',
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
    groupSlug: null,
    lat: 42.3744,
    lng: -71.1169,
    highlight: 'Quad Bikes: a student-run shop with free repairs and group rides.',
    transit: [
      { text: 'Harvard Square is a Red Line hub with bus connections in every direction — the campus was built around not driving.', sourceUrl: 'https://www.hupd.harvard.edu/transportation' },
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
    groupSlug: null,
    lat: 42.3601,
    lng: -71.0942,
    highlight: 'MIT covers 50–70% of students’ MBTA pass costs — the deepest transit subsidy in Boston.',
    transit: [
      { text: 'MIT covers 50–70% of the cost of MBTA passes for students — bus, subway, commuter rail, and boat. No other Boston school comes close.', sourceUrl: 'https://web.mit.edu/facilities/transportation/students.html' },
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
    groupSlug: null,
    lat: 42.4075,
    lng: -71.119,
    highlight: 'Free bike checkout at the library desk, and a free repair shop with student mechanics.',
    transit: [
      { text: 'The Green Line Extension’s Medford/Tufts station puts the Hill one stop from Davis Square and a straight shot downtown.', sourceUrl: 'https://access.tufts.edu/commuter-benefits-discounts' },
      { text: 'Campus shuttles cover Davis Square, the SMFA campus, Saturday groceries, and TUPD SafeRide for late nights.', sourceUrl: 'https://access.tufts.edu/shuttles-sharing-services' },
    ],
    bike: [
      { text: 'Tufts Bikes runs a free repair shop at 28 Sawyer Ave — a student mechanic fixes your bike with you, at no cost.', sourceUrl: 'https://tuftsbikes.com/' },
      { text: 'Free bike share: check out a bike and helmet at the Tisch Library circulation desk with your Tufts ID.', sourceUrl: 'https://tuftsbikes.com/' },
      { text: '“Bike Check!” reimburses repairs, helmets, and safety gear twice a year, and Tufts affiliates get a discounted Bluebikes membership.', sourceUrl: 'https://access.tufts.edu/commuter-benefits-discounts' },
    ],
    moving: [
      { text: 'GoMassCommute tracks car-free commutes for prizes, with Emergency Ride Home as a backstop.', sourceUrl: 'https://access.tufts.edu/commuter-benefits-discounts' },
    ],
  },
  {
    slug: 'umass-boston',
    name: 'UMass Boston',
    shortName: 'UMass Boston',
    logo: '/images/schools/umass-boston.png',
    groupSlug: null,
    lat: 42.3134,
    lng: -71.0386,
    highlight: 'A student-funded 50% T-pass subsidy — it sells out fast every term.',
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
    groupSlug: null,
    lat: 42.3588,
    lng: -71.0616,
    highlight: 'A downtown campus deliberately designed around walking and transit.',
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
    groupSlug: null,
    lat: 42.3465,
    lng: -71.0878,
    highlight: 'A card-access bike pavilion in the heart of Back Bay.',
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
    groupSlug: null,
    lat: 42.3391,
    lng: -71.0997,
    highlight: 'Free Longwood-area shuttles every 8–10 minutes.',
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
    groupSlug: null,
    lat: 42.3888,
    lng: -71.1225,
    highlight: 'Porter Square campus, right on the Red Line and commuter rail.',
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

export function getSchool(slug: string): School | null {
  return SCHOOLS.find((s) => s.slug === slug) ?? null
}
