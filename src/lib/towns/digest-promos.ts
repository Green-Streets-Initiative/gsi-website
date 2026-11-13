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
  /** Hide it once the offer runs out: 'free_lesson' = every active
   *  free_lesson_programs row has issued all its codes (closedPromos). */
  until_full?: 'free_lesson'
}

export const DIGEST_PROMOS: DigestPromo[] = [
  // Shift Together launch week (product item 34; Shift repo docs/programs/
  // launches/buddy-pairing/plan.md, "Newsletter section and town digest
  // item"). First, so it wins over the free-lesson line for these two weeks;
  // that line comes back on its own Nov 26.
  {
    key: 'shift_together_2026',
    towns: ['boston-ma', 'somerville-ma', 'cambridge-ma', 'medford-ma', 'arlington-ma'],
    from: '2026-11-12',
    until: '2026-11-25',
    title: 'Start biking or taking the T with someone who already does',
    body:
      'Shift Together introduces people who want to start biking or taking the T to someone nearby who already does, and they go together the first time. You both say yes before you share an email, and you meet somewhere public. Bike or take the T most days? Offer to go with a neighbor the first time they try it.',
    label: 'Find someone to go with',
    url: 'https://www.gogreenstreets.org/together?utm_source=digest',
  },
  {
    key: 'free_lesson_2026',
    towns: ['boston-ma', 'somerville-ma', 'cambridge-ma', 'arlington-ma', 'medford-ma', 'watertown-ma'],
    from: '2026-11-05',
    until: '2026-12-31',
    title: 'Free 1:1 street lessons in Boston and nearby towns',
    body:
      'Can ride, but busy streets make you nervous? Green Streets is covering the cost of a 90-minute lesson on real streets with a local instructor. For adults who live in Boston and nearby towns. Rather wait for spring? Sign up for an email when classes start again.',
    label: 'See bike lessons',
    url: 'https://www.gogreenstreets.org/bike-lessons?utm_source=digest',
    until_full: 'free_lesson',
  },
]

/** The promo for this town on this ET date, if any, leaving out closed ones. */
export function promoFor(slug: string, todayEt: string, closed: string[] = []): DigestPromo | null {
  return (
    DIGEST_PROMOS.find(
      (p) => p.towns.includes(slug) && p.from <= todayEt && todayEt <= p.until && !closed.includes(p.key),
    ) ?? null
  )
}

/** Minimal shape of the service-role client this needs. */
interface CountClient {
  from: (table: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Keys of promos whose offer has run out, checked once per digest run. A
 * failed read counts as closed: better to leave the line out than send
 * readers to a full offer.
 */
export async function closedPromos(sb: CountClient): Promise<string[]> {
  const gated = DIGEST_PROMOS.filter((p) => p.until_full === 'free_lesson')
  if (!gated.length) return []
  const { data: programs, error } = await sb.from('free_lesson_programs').select('id, max_codes').eq('active', true)
  let open = false
  if (!error) {
    for (const pr of (programs ?? []) as { id: string; max_codes: number }[]) {
      const { count, error: e } = await sb
        .from('free_lesson_codes')
        .select('id', { count: 'exact', head: true })
        .eq('program_id', pr.id)
      if (!e && (count ?? 0) < pr.max_codes) open = true
    }
  }
  return open ? [] : gated.map((p) => p.key)
}
