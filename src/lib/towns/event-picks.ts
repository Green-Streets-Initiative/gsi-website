import 'server-only'
import type { TownEvent } from '@/lib/towns/queries'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * The community events a town page (eight), the town digest email (three) and
 * the /nearby snapshot (four) feature.
 *
 * These surfaces used to take the top N of a town ranking whose first tier was
 * every Open Streets within ~3.5 miles. Cut to three, it was three Open
 * Streets days: Somerville's 2026-10-02 digest led with Memorial Drive, Open
 * Streets Allston/Brighton and Open Newbury, while the Annual Bow Tie Ride
 * (1.7 mi, free, family-friendly) and the Fall Cargo Bike Test Drive (2.1 mi,
 * beginner-friendly) went unmentioned, and missed the Somerville town page
 * too, which led with the same three Open Streets (Keith 2026-10-02).
 *
 * The list should be a mix of things someone new can show up to:
 *   - one pick per kind first (an outing, something to try, a street festival),
 *     then a per-kind cap, so the list is never mostly one kind. Open Streets
 *     is capped at one even when the list backfills.
 *   - within each kind: closer, sooner, and welcoming (beginner- or
 *     family-friendly, or an easy ride) wins. Paid events step back.
 *   - Rec rides (road, gravel, 20+ miles) stay out: the full calendar has
 *     them, and these picks are for people getting started.
 *   - contests and challenges are things you enter, not places you go.
 *   - inside the town line comes first (Keith 2026-11-02: "picking as many
 *     close to the town as possible"). Somerville's Nov 2 digest had one
 *     Somerville event and two from Boston and Cambridge, because each kind's
 *     reserved slot was filled from anywhere within 8 miles; the Elm-Beacon
 *     Connector Mini-Ride (1.3 mi, in Somerville) lost to a flat-fixing class
 *     at BU. In-town events now fill first, up to one more of a kind than the
 *     cap; the nearest variety fills what's left. Backtest that day across
 *     the 8 digest towns: 5 → 9 in-town picks of 24, no town worse off.
 *   - one pick per organizer before the backfill, so a weekly club's three
 *     differently-named rides don't take the whole list.
 *
 * Since 2026-11-13 the rule lives in the database, get_town_event_picks
 * (Shift 01786), so the app's town screen picks by it too (parity gap
 * gap-town-event-picks). It also measures "today" in Boston, leaves out
 * cancelled or postponed dates and today's events once they're over.
 */

type PickRow = Omit<TownEvent, 'occurrences'> & { occurrences: number | null; languages: string[] | null }

export async function getEventPicks(
  centroid: { lat: number; lng: number } | null,
  limit = 3,
  /**
   * Town pages only: when the area has too few other events to fill the list,
   * fill it with Rec rides rather than leave it short (Framingham's pool on
   * 2026-10-02 was three events, two of them Rec rides). The email and
   * /nearby leave them out regardless.
   */
  opts: {
    recRidesAsFill?: boolean
    /** Town pages and the digest: events inside this town's line come first. */
    town?: { name: string; state: string }
  } = {},
): Promise<TownEvent[]> {
  if (!centroid) return []
  const { data, error } = await createServerSupabaseClient().rpc('get_town_event_picks', {
    p_lat: centroid.lat,
    p_lng: centroid.lng,
    p_limit: limit,
    p_town: opts.town?.name ?? null,
    p_state: opts.town?.state ?? 'MA',
    p_rec_fill: !!opts.recRidesAsFill,
  })
  if (error) {
    console.error('[event-picks] get_town_event_picks failed:', error.message)
    return []
  }
  return ((data ?? []) as PickRow[]).map((r) => ({
    ...r,
    lat: Number(r.lat),
    lng: Number(r.lng),
    distance_miles: Number(r.distance_miles),
    tags: r.tags ?? [],
    occurrences: r.occurrences ?? 1,
  }))
}
