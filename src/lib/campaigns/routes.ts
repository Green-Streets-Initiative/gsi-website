/*
 * The copy and destination registry.
 *
 * Adding a campaign to the public site is a deliberate one-entry edit here.
 * That is the point: `campaigns` is an admin-only table whose primary key is
 * a redemption code, and an unreviewed row should not be able to publish its
 * own mechanic to a public page. Flagship events get the opposite default —
 * an unrecognised one still renders, from its own name and description, as a
 * self-contained entry.
 */

/**
 * Icon names, resolved to components in components/challenges/icons.ts.
 * Kept as strings here so this module stays free of React imports — Nav is a
 * client component and reads from it.
 *
 * Compass and GraduationCap match what the Shift app already ships for these
 * two campaigns (lib/campaigns.ts in the app repo). Do not diverge.
 */
export type CampaignIcon = 'compass' | 'graduation-cap' | 'calendar' | 'flag'

export interface RegistryEntry {
  /** The public slug. Becomes the second half of Promotable.id. */
  slug: string
  /** Overrides the DB name, which has drifted between two formats. */
  title?: string
  /** Max 22 characters — the nav depends on it. */
  shortTitle: string
  blurb: string
  icon: CampaignIcon
  href: string | null
  secondaryHref?: string
  secondaryLabel?: string
  /** Curated, so live rationing changes cannot surprise the public page. */
  supplyLabel?: string
  gateLabel?: string
  seriesKey?: 'walk-ride-day'
}

/** Matched against competitions.name, first hit wins. */
export const FLAGSHIP_REGISTRY: { match: RegExp; entry: RegistryEntry }[] = [
  {
    match: /walk\/ride day/i,
    entry: {
      slug: 'walk-ride-day',
      title: 'Walk/Ride Day',
      shortTitle: 'Walk/Ride Day',
      blurb:
        'One Friday a month, people all over Massachusetts walk, bike, and ride together. It has been running since 2006.',
      icon: 'calendar',
      href: '/programs/walk-ride-days',
      secondaryHref: '/events/walk-ride-day/rules',
      secondaryLabel: 'Official rules',
      seriesKey: 'walk-ride-day',
    },
  },
  {
    match: /shift your summer/i,
    entry: {
      slug: 'shift-your-summer',
      title: 'Shift Your Summer',
      shortTitle: 'Shift Your Summer',
      blurb: 'A summer-long, town-against-town push to see which neighborhoods move best.',
      icon: 'flag',
      href: '/events/shift-your-summer',
      secondaryHref: '/events/shift-your-summer/rules',
      secondaryLabel: 'Official rules',
    },
  },
]

/** Keyed by campaigns.code / the newroutes sentinel. Unlisted codes are skipped. */
export const UNLOCK_REGISTRY: Record<string, RegistryEntry> = {
  SEMESTER: {
    slug: 'semester',
    title: 'Shift Your Semester',
    shortTitle: 'Shift Your Semester',
    blurb:
      'For students: take ten trips on foot, on two wheels, or on transit during the semester and pick a reward.',
    icon: 'graduation-cap',
    href: '/shift-your-semester',
    supplyLabel: 'First 200 students',
    gateLabel: 'Verify a school email',
  },
  NEWROUTES: {
    slug: 'new-routes',
    title: 'New Routes',
    shortTitle: 'New Routes',
    blurb:
      'New to the neighborhood, or just after a better way in? Try ten trips a different way and pick a reward.',
    icon: 'compass',
    // No page of its own. The hub entry carries its own detail and links out.
    href: null,
    supplyLabel: 'First 200',
  },
}

/** 22 chars is what the nav bar can carry beside seven links and two pills. */
export const SHORT_TITLE_MAX = 22

if (process.env.NODE_ENV !== 'production') {
  const tooLong = [
    ...FLAGSHIP_REGISTRY.map((f) => f.entry),
    ...Object.values(UNLOCK_REGISTRY),
  ].filter((e) => e.shortTitle.length > SHORT_TITLE_MAX)
  if (tooLong.length) {
    console.warn(
      '[campaigns/routes] shortTitle over %d chars, the nav will fall back: %s',
      SHORT_TITLE_MAX,
      tooLong.map((e) => e.shortTitle).join(', '),
    )
  }
}
