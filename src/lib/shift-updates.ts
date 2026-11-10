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
 * - Lead with what people get, in plain words: the title is the thing a
 *   person can now do or have ("A free bike lesson near Somerville"), not the
 *   feature's name. One sentence under it (about 25 words at most). `short`
 *   is two or three words for the page's list. Never "earn"; lead with
 *   trying something new, never "the way you already move".
 * - The page doesn't show dates (Keith 2026-11-10: "I don't think anybody
 *   cares about the date features were released on"); `date` only keeps the
 *   list honest about order.
 * - A real picture of what it names: a credited photo of the place, vehicle
 *   or people (`photo`; Wikimedia Commons or our own, saved ~1200px wide
 *   under public/images/whats-new), an app screenshot when the screen itself
 *   is the news (`app`, 600px wide), or a `sign` / `languages` drawing when
 *   the fact itself is the picture. No posed stock photos.
 * - `link` goes to the feature's own page; app-only features go to /shift.
 *
 * The /shift page shows the newest entry's title as its "What's new" line.
 */

export type ShiftUpdatePicture =
  | { kind: 'app'; src: string; width: number; height: number; alt: string }
  | { kind: 'photo'; src: string; width: number; height: number; alt: string; credit: string; creditUrl: string }
  | { kind: 'sign'; name: string; detail: string; place: string }
  | { kind: 'languages'; lines: { lang: string; text: string }[] }

export type ShiftUpdate = {
  id: string
  /** The day it reached everyone, YYYY-MM-DD (Eastern). Not shown; keeps the order honest. */
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
    short: 'Someone to go with',
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
    short: 'Next bus, train and bike',
    date: '2026-11-09',
    where: 'both',
    title: 'Your next bus, train and bike, and the way anywhere',
    body: 'Open Shift and the next departures and Bluebikes near you come first. Type where you\'re going for a bike or transit route, and skip any street you don\'t like.',
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
    short: 'In your language',
    date: '2026-11-08',
    where: 'web',
    title: 'Read our pages in Spanish, Portuguese or Chinese',
    body: 'Town pages, trails, Roams, bike lessons, parking and help, in your language, like the app.',
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
    // "Older woman with flowers protected bike lane boston" (a parking-protected
    // lane in Cambridge, per its description), Adam Coppola, CC0.
    picture: {
      kind: 'photo',
      src: '/images/whats-new/cambridge-protected-lane.jpg',
      width: 1200,
      height: 720,
      alt: 'A woman with flowers in her bike basket rides a parking-protected bike lane in Cambridge',
      credit: 'Photo: Adam Coppola / Wikimedia Commons, CC0',
      creditUrl: 'https://commons.wikimedia.org/wiki/File:Older_woman_with_flowers_protected_bike_lane_boston.jpg',
    },
    personas: ['first-timer'],
  },
  {
    id: 'thursday-events-email',
    short: 'Rides and walks by email',
    date: '2026-11-04',
    where: 'both',
    title: 'This week\'s group rides and walks, every Thursday',
    body: 'Pick the kinds of events and how far you\'ll go, and each Thursday we email what\'s coming up near you. One tap in the app\'s Events tab.',
    link: { href: '/events', label: 'Get the Thursday email' },
    // Unsplash, mood only (not a named place): "people riding bicycle on road
    // during daytime", Leo_Visions.
    picture: {
      kind: 'photo',
      src: '/images/whats-new/group-ride.jpg',
      width: 1200,
      height: 800,
      alt: 'A group of people riding bikes together down a city street',
      credit: 'Photo by Leo_Visions on Unsplash',
      creditUrl: 'https://unsplash.com/photos/people-riding-bicycle-on-road-during-daytime-O7EOZ-yd8qk',
    },
  },
  {
    id: 'trail-pages',
    short: 'Trail pages',
    date: '2026-11-04',
    where: 'web',
    title: 'Know a trail before you go',
    body: 'Is it open, how long is it, what\'s underfoot, where do you get on, and which train gets you there and home.',
    link: { href: '/trails', label: 'See the trails' },
    // "Minuteman Bikeway - Arlington, MA - 01", Daderot, public domain; cropped.
    picture: {
      kind: 'photo',
      src: '/images/whats-new/minuteman-bikeway.jpg',
      width: 1000,
      height: 667,
      alt: 'A rider on the Minuteman Bikeway in Arlington, under green trees',
      credit: 'Photo: Daderot / Wikimedia Commons, public domain (cropped)',
      creditUrl: 'https://commons.wikimedia.org/wiki/File:Minuteman_Bikeway_-_Arlington,_MA_-_01.jpg',
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
    title: 'See the bike lanes and paths that just opened near you',
    body: 'Town pages and group ride pages list what opened in the last six months, and street projects with a hearing coming up.',
    link: { href: '/shift/towns/malden-ma#new', label: 'See what\'s new in Malden' },
    picture: { kind: 'sign', name: 'Malden River Greenway', detail: 'Opened Oct 2026 · 0.3 mi', place: 'New in Malden' },
  },
  {
    id: 'saved-trips',
    short: 'Your trips, one tap away',
    date: '2026-10-29',
    where: 'app',
    title: 'Your regular trips, one tap away',
    body: 'Plan a trip once and tap "Save this trip." Next time it\'s on Home, on foot, by bike or by transit.',
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
    short: 'Northern Strand ride',
    date: '2026-10-22',
    where: 'both',
    title: 'A new self-guided ride on the Northern Strand Trail',
    body: 'Ride the old rail line from Everett to Lynn, across the Rumney Marsh, with stops along the way. Suggested by Samantha LeBlanc.',
    link: { href: '/shift/roams/northern-strand-trail', label: 'See the ride' },
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
    short: 'T closure plans',
    date: '2026-10-19',
    where: 'app',
    title: 'A plan for your usual trip when the T closes your line',
    body: 'A day or two before a planned MBTA closure, people who ride that line get their usual trip planned around it: which shuttle, then which train.',
    link: { href: '/shift', label: 'Get Shift' },
    // "MBTA D branch shuttle bus at Reservoir September 2026", 4300streetcar, CC BY 4.0.
    picture: {
      kind: 'photo',
      src: '/images/whats-new/shuttle-bus-reservoir.jpg',
      width: 1200,
      height: 800,
      alt: 'Riders board a Green Line shuttle bus to Kenmore at Reservoir at night',
      credit: 'Photo: 4300streetcar / Wikimedia Commons, CC BY 4.0',
      creditUrl: 'https://commons.wikimedia.org/wiki/File:MBTA_D_branch_shuttle_bus_at_Reservoir_September_2026.jpg',
    },
  },
  {
    id: 'commute-advisor',
    short: 'Compare your commute',
    date: '2026-10-15',
    where: 'both',
    title: 'Every way to get to work, side by side',
    body: 'Put in your commute and see when to leave, the route on a map, and what each way costs next to driving.',
    link: { href: '/commute-advisor', label: 'Try your commute' },
    picture: {
      kind: 'app',
      src: '/images/whats-new/commute-advisor.jpg',
      width: 600,
      height: 1116,
      alt: 'The Commute Advisor: a bike route from Medford to Kendall Square on a map, with "Leave by 8:23 AM on a bike"',
    },
  },
]
