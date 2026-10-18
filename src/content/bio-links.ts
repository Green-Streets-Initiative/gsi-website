// The links page at gogreenstreets.org/links (the link in our Instagram bio).
//
// HOW TO ADD A LINK: copy one entry below and change it.
//   slug     short, lowercase, words joined with dashes (e.g. 'fallrailride').
//            It also makes a short address: gogreenstreets.org/links/<slug>
//            sends people straight to `url`, even after the link leaves the page.
//   label    the button text. Plain words. Say "unlock", never "earn".
//   sublabel optional second line (date, place, one detail).
//   url      where the button goes.
//   until    when the link disappears from the page, with the Boston offset:
//            -04:00 through the first Sunday of November, -05:00 after that.
//            Dated links show under "This week", soonest first.
//   pinned   true = always shown under "Always here" (no `until` needed).
// Expired links drop off by themselves within five minutes; no redeploy needed.
// Old entries can be deleted any time, but keep a slug if it was printed on a
// post, so the short address keeps working.

export type BioLink = {
  slug: string
  label: string
  sublabel?: string
  url: string
  until?: string
  pinned?: boolean
}

export const BIO_LINKS: BioLink[] = [
  // ── This week (dated) ──
  {
    slug: 'tourdestreets',
    label: 'Tour de Streets: register',
    sublabel: "Sat Oct 24, Cambridge. LivableStreets' walking tour or guided bike ride",
    url: 'https://secure.qgiv.com/event/tourdestreets2026',
    until: '2026-10-24T14:30:00-04:00',
  },
  {
    slug: 'rideforyourlife',
    label: 'Ride For Your Life: register (free)',
    sublabel: 'Sun Oct 25, Boston Common to the State House',
    url: 'https://register.hakuapp.com/?event=c3f750069b59c4734efa',
    until: '2026-10-25T13:00:00-04:00',
  },
  {
    slug: 'winthrop-parade',
    label: "Kids' Costume Bike Parade, Winthrop",
    sublabel: 'Sat Oct 24, 10 AM to 1 PM, Ingleside Park',
    url: 'https://www.gogreenstreets.org/events/bike-winthrop-halloween-kids-costume-bike-parade-2026-10-24',
    until: '2026-10-24T13:00:00-04:00',
  },
  {
    slug: 'fallrailride',
    label: 'MBTA Fall Rail Ride: get tickets',
    sublabel: 'Sat Nov 7, train and bike to Newburyport, $20 in the mTicket app',
    url: 'https://www.mbta.com/destinations/fall-rail-ride',
    until: '2026-11-07T11:00:00-05:00',
  },
  {
    slug: 'linkbus',
    label: "Boston's five free Link Bus routes",
    sublabel: 'Coming early 2027',
    url: 'https://www.boston.gov/news/city-boston-prepares-launch-five-free-bus-routes-across-city',
    until: '2026-11-01T00:00:00-04:00',
  },
  {
    slug: 'walkrideday',
    label: 'Walk/Ride Day: Fri Oct 30',
    sublabel: 'Walk, bike or ride transit for a chance at a gift card',
    url: 'https://www.gogreenstreets.org/programs/walk-ride-days',
    until: '2026-10-30T23:59:00-04:00',
  },

  // ── Always here (pinned) ──
  {
    slug: 'newroutes',
    label: 'New in town? New Routes: unlock $15',
    sublabel: 'New Shift members, code NEWROUTES',
    url: 'https://shift.gogreenstreets.org/go/newroutes',
    pinned: true,
  },
  {
    slug: 'shift',
    label: 'Get the Shift app',
    url: 'https://www.gogreenstreets.org/shift',
    pinned: true,
  },
  {
    slug: 'events',
    label: 'Events calendar',
    url: 'https://www.gogreenstreets.org/events',
    pinned: true,
  },
  {
    slug: 'newsletter',
    label: 'Newsletter',
    url: 'https://www.gogreenstreets.org/newsletter',
    pinned: true,
  },
]

/** Dated links still in the future, soonest first. */
export function currentDatedLinks(now: Date = new Date()): BioLink[] {
  return BIO_LINKS.filter((l) => !l.pinned && l.until && new Date(l.until).getTime() > now.getTime()).sort(
    (a, b) => new Date(a.until!).getTime() - new Date(b.until!).getTime(),
  )
}

export function pinnedLinks(): BioLink[] {
  return BIO_LINKS.filter((l) => l.pinned)
}

export function findBioLink(slug: string): BioLink | undefined {
  const s = slug.toLowerCase()
  return BIO_LINKS.find((l) => l.slug === s)
}
