import 'server-only'

import { unstable_cache } from 'next/cache'
import { loadPromotables } from './queries'
import type { Promotable } from './types'

export const PROMOTABLES_TAG = 'promotables'
const TTL_SECONDS = 600

/*
 * `now` deliberately does NOT enter the cache key or the cached payload. What
 * is cached is the raw window-filtered list; phase and ranking are computed
 * per render against a live clock. So a Walk/Ride Day ending at midnight
 * clears on the next render rather than lingering for up to ten minutes.
 */
const loadCached = unstable_cache(
  async () => loadPromotables(new Date()),
  ['promotables-v1'],
  { revalidate: TTL_SECONDS, tags: [PROMOTABLES_TAG] },
)

/** One request renders both the layout and the page; this spares a second trip. */
let memo: { value: Promotable[]; expires: number } | null = null

/**
 * NEVER THROWS. The root layout awaits this, so an unhandled rejection here
 * would fail the build and 500 every route on the site.
 *
 * There is deliberately no fabricated fallback. The correct answer to "we
 * cannot tell what is running" is silence, not a guess.
 */
export async function getPromotables(): Promise<Promotable[]> {
  try {
    if (memo && memo.expires > Date.now()) return memo.value
    const value = await loadCached()
    memo = { value, expires: Date.now() + 60_000 }
    return value
  } catch (err) {
    console.error('[campaigns] promotables unavailable:', err)
    return []
  }
}

/*
 * The nav deliberately carries a stable "Challenges" label rather than the
 * name of whichever campaign is running — a section name cannot go stale, and
 * a rotating one is an embellishment that earns nothing. If a dated label is
 * ever wanted, pickNavPromo() and navPromoLabel() are what to build it from.
 */

export type { NavPromo, Promotable } from './types'
