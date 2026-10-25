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

import { withUtm } from '@/lib/utm'

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
    slug: 'fallcolors',
    label: 'Fall Colors Ride: register (free)',
    sublabel: 'Sun Oct 25, Everett. Bike to the Sea, about 15 miles',
    url: 'https://forms.gle/j2bxXt2BAMJF3Heo9',
    until: '2026-10-25T11:00:00-04:00',
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
  // Halloween week (Social Lead W44). The card prints /links/halloween, which is
  // not a slug on purpose: unknown slugs land on this page, where these five show.
  {
    slug: 'trekortreat',
    label: 'Trek or Treat Ride, Concord',
    sublabel: 'Tue Oct 27, 4 PM. Minuteman Bike Share, 2 miles of rail trail',
    url: 'https://www.gogreenstreets.org/events/trek-or-treat-ride-bruce-freeman-rail-trail-2026-10-27',
    until: '2026-10-27T16:00:00-04:00',
  },
  {
    slug: 'halloweenwalk',
    label: 'Halloween walk, Beacon Hill',
    sublabel: 'Wed Oct 28, 6 PM. Boston Women over 40 Walking Group',
    url: 'https://www.meetup.com/women-over-40-walk/events/317037706/',
    until: '2026-10-28T18:00:00-04:00',
  },
  {
    slug: 'commuterchallenge',
    label: 'Great Commuter Challenge: RSVP',
    sublabel: 'Sat Oct 31, 10 AM, Jamaica Plain. Bikes Not Bombs',
    url: 'https://docs.google.com/forms/d/e/1FAIpQLScqEab8MwWgLvjKZkSnaE0_QUOL_CPoQoN6arhOKS16Rz5qlA/viewform',
    until: '2026-10-31T10:00:00-04:00',
  },
  {
    slug: 'scarierthanmassave',
    label: "Costume ride: What's Scarier Than Mass Ave?",
    sublabel: 'Sat Oct 31, 11 AM, Central Square. Boston Cafe Bikers',
    url: 'https://partiful.com/e/2lujnt4TCoLinzEYBvVC',
    until: '2026-10-31T11:00:00-04:00',
  },
  {
    slug: 'hallowheels',
    label: 'SCUL Hallowheels',
    sublabel: 'Sat Oct 31, 8:30 PM, Allston Pump Track',
    url: 'https://www.gogreenstreets.org/events/scul-hallowheels-2026-10-31',
    until: '2026-10-31T20:30:00-04:00',
  },
  {
    slug: 'lights',
    label: 'Free bike lights in Everett',
    sublabel: 'Mon Nov 2, 5 to 7 PM, Northern Strand at West and Wellington',
    url: 'https://www.gogreenstreets.org/events/light-up-your-ride-free-bike-lights-in-everett-2026-11-02',
    until: '2026-11-02T19:00:00-05:00',
  },
  {
    slug: 'smartnav',
    label: 'Smart Navigation class: register',
    sublabel: 'Wed Nov 4, 6:30 PM, Wellesley Free Library or online',
    url: 'https://wellesleyfreelibrary.libcal.com/event/16890530',
    until: '2026-11-04T18:30:00-05:00',
  },
  {
    slug: 'semester',
    label: 'Students: Shift Your Semester, unlock $15',
    sublabel: 'Code SEMESTER and your school email, through Dec 15',
    url: 'https://shift.gogreenstreets.org/go/semester',
    until: '2026-12-15T23:59:00-05:00',
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

// UTM tags for links that leave gogreenstreets.org, so partners (and our own
// Shift web/app split on shift.gogreenstreets.org) can see the traffic came
// from the bio links. Internal gogreenstreets.org links stay untagged: UTMs on
// an internal link restart the GA4 session and wipe its real source.
const INTERNAL_HOSTS = new Set(['gogreenstreets.org', 'www.gogreenstreets.org'])

export const BIO_LINKS_UTM = { source: 'gsi_links', medium: 'social', campaign: 'bio_links' } as const

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

function isInternal(url: string): boolean {
  try {
    return INTERNAL_HOSTS.has(new URL(url).hostname.toLowerCase())
  } catch {
    return true
  }
}

/** Where a button on /links sends people, with our UTM tags when it leaves the site. */
export function taggedBioLinkUrl(link: BioLink): string {
  if (isInternal(link.url)) return link.url
  return withUtm(link.url, { ...BIO_LINKS_UTM, content: link.slug }) ?? link.url
}

/**
 * Where /links/<slug> redirects. If the incoming request carries its own utm_*
 * (e.g. a Facebook post tagged utm_source=facebook), those pass through in
 * place of our defaults so the channel survives the redirect. That applies to
 * internal destinations too, since the destination page is the first hit GA4
 * sees. With no incoming utm_*, internal destinations stay untagged.
 * Tags already on the destination url are never overwritten.
 */
export function bioLinkRedirectUrl(link: BioLink, incoming: URLSearchParams): string {
  const passed = UTM_KEYS.filter((k) => incoming.get(k))
  if (passed.length === 0) return taggedBioLinkUrl(link)
  let dest: URL
  try {
    dest = new URL(link.url)
  } catch {
    return link.url
  }
  if (UTM_KEYS.some((k) => dest.searchParams.has(k))) return link.url
  for (const k of passed) dest.searchParams.set(k, incoming.get(k)!)
  return dest.toString()
}
