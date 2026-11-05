/**
 * Green Streets offers that ride along in a town digest (Keith 2026-11-05:
 * the free street lesson goes in the town emails now). A promo never makes
 * an email on its own: it only appears when a civic item already triggers
 * the send, so the digest's 3-per-30-days cap is untouched. One promo per
 * email, shown after the featured item.
 *
 * Copy is the launch's approved text (Shift repo docs/programs/launches/
 * confidence-path/plan.md, "Town digest item"); change it there first.
 */

export interface DigestPromo {
  key: string
  towns: string[]
  /** First and last ET dates (inclusive) it may appear. */
  from: string
  until: string
  title: string
  body: string
  label: string
  /** Absolute URL; the digest fills in medium, campaign (the town) and content. */
  url: string
}

export const DIGEST_PROMOS: DigestPromo[] = [
  {
    key: 'free_lesson_2026',
    towns: ['somerville-ma', 'cambridge-ma', 'arlington-ma', 'medford-ma', 'watertown-ma'],
    from: '2026-11-05',
    until: '2026-12-31',
    title: 'Free 1:1 street lessons near Somerville',
    body:
      'Can ride, but busy streets make you nervous? Green Streets is covering the cost of a 90-minute lesson on real streets with an instructor from the Bicycle Riding School. For adults who live near Somerville. Rather wait for spring? Sign up for an email when classes start again.',
    label: 'See bike lessons',
    url: 'https://www.gogreenstreets.org/bike-lessons?utm_source=digest',
  },
]

/** The promo for this town on this ET date, if any. */
export function promoFor(slug: string, todayEt: string): DigestPromo | null {
  return DIGEST_PROMOS.find((p) => p.towns.includes(slug) && p.from <= todayEt && todayEt <= p.until) ?? null
}
