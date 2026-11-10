/**
 * What's new with Shift (gogreenstreets.org/shift/whats-new): the app and
 * site updates people can use today, newest first. Keith 2026-11-10: the GSI
 * newsletter leads with GSI programs and events and links here for the app
 * news, so readers who want all of it can find it.
 *
 * Adding an update with a release: put a new entry at the TOP of the list.
 * - Only what is live for everyone. Nothing behind a switch that's off, held
 *   for a launch, or on for a test group (check the product ledger,
 *   Shift docs/programs/product/state.json, and the launch ledger).
 * - Plain words: a `short` name for the list (two or three words), a title that says what a person can now do, and one
 *   sentence (about 25 words at most). Never "earn"; lead with trying
 *   something new, never "the way you already move".
 * - A picture that shows it: an app screenshot (`app`, saved 600px wide under
 *   public/images/whats-new), a screenshot of the web page (`web`), a real
 *   credited photo of the place it names (`photo`), or a `sign` / `languages`
 *   drawing when the fact itself is the picture. No stock photos.
 * - `link` goes to the feature's own page; app-only features go to /shift.
 *
 * The /shift page shows the newest entry's title as its "What's new" line.
 */

export type ShiftUpdatePicture =
  | { kind: 'app'; src: string; width: number; height: number; alt: string }
  | { kind: 'web'; src: string; width: number; height: number; alt: string; address: string }
  | { kind: 'photo'; src: string; width: number; height: number; alt: string; credit: string; creditUrl: string }
  | { kind: 'sign'; name: string; detail: string; place: string }
  | { kind: 'languages'; lines: { lang: string; text: string }[] }

export type ShiftUpdate = {
  id: string
  /** The day it reached everyone, YYYY-MM-DD (Eastern). */
  date: string
  where: 'app' | 'web' | 'both'
  /** Two or three words for the page's list of updates. */
  short: string
  title: string
  body: string
  link: { href: string; label: string }
  picture: ShiftUpdatePicture
  /** Persona ids from Shift docs/programs/personas.md. */
  personas?: string[]
}

export const SHIFT_UPDATES: ShiftUpdate[] = [
  {
    id: 'shift-together',
    short: 'Shift Together',
    date: '2026-11-09',
    where: 'both',
    title: 'Try it the first time with someone who knows the way',
    body: 'Want to bike or take the T somewhere new? Shift Together finds a neighbor who makes that trip and can go with you the first time.',
    link: { href: '/together', label: 'Find someone to go with' },
    // "Bicyclists boarding MBTA train in Concord", 4300streetcar, CC BY 4.0
    // (the photo the Shift Together pages use; see components/together/photos.tsx).
    picture: {
      kind: 'photo',
      src: '/images/together/concord-bikes-on-the-train.jpg',
      width: 1400,
      height: 933,
      alt: 'People with bikes stepping onto an MBTA commuter rail train in Concord',
      credit: 'Photo: 4300streetcar / Wikimedia Commons, CC BY 4.0',
      creditUrl: 'https://commons.wikimedia.org/wiki/File:Bicyclists_boarding_MBTA_train_in_Concord.jpg',
    },
    personas: ['first-timer', 'car-light-regular'],
  },
  {
    id: 'around-you-v2',
    short: 'Around You',
    date: '2026-11-09',
    where: 'both',
    title: 'Around You: tap "Where to?" and go',
    body: 'Live departures, Bluebikes and the places you go open first. Type where you\'re going for a bike or transit route, and skip any street you don\'t like.',
    link: { href: '/nearby', label: 'Try it on the web' },
    picture: {
      kind: 'app',
      src: '/images/whats-new/around-you.jpg',
      width: 600,
      height: 1116,
      alt: 'Around You in the Shift app: a map of East Somerville, a "Where to?" box, a Green Line alert and the next buses',
    },
  },
  {
    id: 'site-languages',
    short: 'Pages in four languages',
    date: '2026-11-08',
    where: 'web',
    title: 'Our Shift pages in Spanish, Portuguese and Chinese',
    body: 'Town pages, trails, Roams, bike lessons, parking and help now read in your language, like the app does.',
    link: { href: '/shift/towns?lang=es', label: 'See the town pages in Spanish' },
    picture: {
      kind: 'languages',
      // The town page title, word for word, from src/lib/site-strings/towns.ts.
      lines: [
        { lang: 'en', text: 'Walking, biking & transit in Malden' },
        { lang: 'es', text: 'Caminar, bici y transporte público en Malden' },
        { lang: 'pt-BR', text: 'A pé, de bicicleta e de transporte em Malden' },
        { lang: 'zh-Hans', text: 'Malden的步行、骑行和公共交通' },
      ],
    },
  },
  {
    id: 'free-bike-lesson',
    short: 'A free bike lesson',
    date: '2026-11-05',
    where: 'both',
    title: 'A free 1:1 bike lesson near Somerville',
    body: 'Nervous in traffic? An instructor from the Bicycle Riding School rides real streets with you for 90 minutes. Green Streets covers the cost.',
    link: { href: '/bike-lessons#street-lesson', label: 'Ask for a lesson' },
    picture: {
      kind: 'web',
      src: '/images/whats-new/bike-lessons.jpg',
      width: 600,
      height: 1116,
      address: 'gogreenstreets.org/bike-lessons',
      alt: 'The bike lessons page: "Where are you starting?" with a free 1:1 lesson for people who can ride but find traffic nervous',
    },
    personas: ['first-timer'],
  },
  {
    id: 'thursday-events-email',
    short: 'Thursday events email',
    date: '2026-11-04',
    where: 'both',
    title: 'The week\'s rides and walks, every Thursday',
    body: 'Pick the kinds of events and how far you\'ll go. Each Thursday we email what\'s coming up that matches. One tap in the app\'s Events tab.',
    link: { href: '/events', label: 'Get the Thursday email' },
    picture: {
      kind: 'web',
      src: '/images/whats-new/thursday-email.jpg',
      width: 600,
      height: 572,
      address: 'gogreenstreets.org/events',
      alt: 'The events calendar\'s "Get these by email" box with an "Email me every Thursday" button, above a group ride listing',
    },
  },
  {
    id: 'trail-pages',
    short: 'Trail pages',
    date: '2026-11-04',
    where: 'web',
    title: 'A page for each trail',
    body: 'Is it open? How long is it, what\'s underfoot, where do you get on, and which train gets you there and home?',
    link: { href: '/trails', label: 'See the trails' },
    picture: {
      kind: 'web',
      src: '/images/whats-new/trail-page.jpg',
      width: 600,
      height: 1168,
      address: 'gogreenstreets.org/trails',
      alt: 'The Minuteman Bikeway page: 10 miles, paved, 7 places to get on, open with no closures, and a photo of the path',
    },
  },
  {
    id: 'venue-parking',
    short: 'Game-day parking',
    date: '2026-11-02',
    where: 'web',
    title: 'Going to the game? Where to park, and the train right there',
    body: 'TD Garden, Fenway Park and Gillette Stadium: official garage prices, the walk from each one, and the next train.',
    link: { href: '/parking/td-garden', label: 'Parking at TD Garden' },
    // "Hub on Causeway and North Station entrance, October 2020",
    // Pi.1415926535, CC BY-SA 4.0; resized to 1000px.
    picture: {
      kind: 'photo',
      src: '/images/whats-new/north-station-entrance.jpg',
      width: 1000,
      height: 706,
      alt: 'The North Station entrance on Causeway Street in Boston, under the arena',
      credit: 'Photo: Pi.1415926535 / Wikimedia Commons, CC BY-SA 4.0',
      creditUrl: 'https://commons.wikimedia.org/wiki/File:Hub_on_Causeway_and_North_Station_entrance,_October_2020.jpg',
    },
    personas: ['event-goer'],
  },
  {
    id: 'new-in-your-town',
    short: 'New lanes near you',
    date: '2026-11-01',
    where: 'both',
    title: 'New lanes and paths near you',
    body: 'Town pages and group ride pages list the bike lanes and paths opened in the last six months, and street projects with a hearing coming up.',
    link: { href: '/shift/towns/malden-ma#new', label: 'See what\'s new in Malden' },
    picture: { kind: 'sign', name: 'Malden River Greenway', detail: 'Opened Oct 2026 · 0.3 mi', place: 'New in Malden' },
  },
  {
    id: 'saved-trips',
    short: 'Saved trips',
    date: '2026-10-29',
    where: 'app',
    title: 'Save a trip you make often',
    body: 'Plan it once and tap "Save this trip." Next time it\'s one tap from Home, by foot, bike or transit.',
    link: { href: '/shift', label: 'Get Shift' },
    picture: {
      kind: 'app',
      src: '/images/whats-new/saved-trips.jpg',
      width: 600,
      height: 726,
      alt: 'Your trips in the Shift app: Work by bike from Davis Square to Kendall Square, and transit to Harvard Square',
    },
  },
  {
    id: 'northern-strand-roam',
    short: 'Northern Strand Roam',
    date: '2026-10-22',
    where: 'both',
    title: 'A new Roam on the Northern Strand Trail',
    body: 'A self-guided bike ride on the old rail line from Everett to Lynn, across the Rumney Marsh. Suggested by Samantha LeBlanc.',
    link: { href: '/shift/roams/northern-strand-trail', label: 'See the Roam' },
    // The Roam's own hero (roams.hero_image_url), cropped from
    // "Northern Strand trail and MassDOT hopper cars ... July 2026", 4300streetcar, CC BY 4.0.
    picture: {
      kind: 'photo',
      src: 'https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/roam-images/northern-strand-trail.jpg',
      width: 1800,
      height: 900,
      alt: 'The Northern Strand Trail beside old MassDOT hopper cars on the Saugus Branch rail line',
      credit: 'Photo: 4300streetcar / Wikimedia Commons, CC BY 4.0 (cropped)',
      creditUrl: 'https://commons.wikimedia.org/wiki/File:Northern_Strand_trail_and_MassDOT_hopper_cars_on_Saugus_Branch_Railroad_remnant_July_2026.jpg',
    },
  },
  {
    id: 'closure-heads-up',
    short: 'T closure heads-up',
    date: '2026-10-19',
    where: 'app',
    title: 'A heads-up before the T closes your line',
    body: 'A day or two before a planned MBTA closure, people who ride that line get a note with their usual trip planned around it.',
    link: { href: '/shift', label: 'Get Shift' },
    picture: {
      kind: 'app',
      src: '/images/whats-new/closure-plan.jpg',
      width: 600,
      height: 1116,
      alt: 'Shift\'s plan for a usual trip during a Green Line closure: a shuttle bus, then the Orange Line, step by step',
    },
  },
  {
    id: 'commute-advisor',
    short: 'Commute Advisor',
    date: '2026-10-15',
    where: 'both',
    title: 'The Commute Advisor, rebuilt',
    body: 'Put in your commute and see each way to go: when to leave, the route on a map, and what it costs next to driving.',
    link: { href: '/commute-advisor', label: 'Try your commute' },
    picture: {
      kind: 'web',
      src: '/images/whats-new/commute-advisor.jpg',
      width: 600,
      height: 1116,
      address: 'gogreenstreets.org/commute-advisor',
      alt: 'The Commute Advisor: a bike route from Medford to Kendall Square on a map, with "Leave by 8:23 AM on a bike"',
    },
  },
]

/** "2026-11-09" -> a Date at noon UTC, so the Eastern day never shifts. */
export function updateDay(date: string): Date {
  return new Date(`${date}T12:00:00Z`)
}
