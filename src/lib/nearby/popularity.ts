import { supabase } from '@/lib/supabase'
import { canonicalStreetKey } from './street-names'

/**
 * "Popular with Shift riders" — the streets near this location that Shift
 * users actually ride, from the same k-anonymized nightly heatmap that powers
 * the public /shift/towns pages (every segment already aggregates ≥3 riders,
 * so this surfaces no new privacy exposure). Anon-readable; plain TS so both
 * the interactive page (client) and the print page (server) can import it.
 *
 * Badge data ONLY: popularity must never feed the corridor ranking. Riders
 * skew confident, so raw ridership would amplify stress roads (Mass Ave)
 * over the comfortable network the list is built to teach.
 */

/** A town's bike layer needs this many distinct riders before "popular"
 *  reads as a community pattern rather than a few people's commutes. */
const MIN_LAYER_USERS = 50

/** Corridor-score floor within a qualifying layer. Somerville reference:
 *  Washington St 106, Somerville Ave 77, Beacon St 38 all clear it; the
 *  long tail of once-ridden streets does not. */
const MIN_CORRIDOR_SCORE = 30

interface HeatmapNamedCorridor {
  name: string
  score: number
}

/**
 * Canonical street keys (see canonicalStreetKey — both pipelines share the
 * naming idiom) of this town's well-ridden bike corridors. Fails soft: no
 * town group, no bike layer, thin data, or any query error → empty set,
 * and the bike section renders exactly as before.
 */
export async function fetchPopularBikeStreets(town: string | null | undefined): Promise<Set<string>> {
  const none = new Set<string>()
  if (!town) return none
  try {
    // Town groups are unique on (name, state), and town names collide across
    // states (Somerville NJ exists). /nearby is a Greater Boston product, so
    // MA is the disambiguator.
    const { data: groups } = await supabase
      .from('groups')
      .select('id')
      .eq('type', 'town')
      .eq('state', 'MA')
      .eq('name', town)
      .limit(1)
    const groupId = groups?.[0]?.id
    if (!groupId) return none

    const { data: layers } = await supabase
      .from('town_corridor_heatmap')
      .select('distinct_users, named_corridors')
      .eq('town_group_id', groupId)
      .eq('mode_group', 'bike')
      .limit(1)
    const layer = layers?.[0]
    if (!layer || (layer.distinct_users ?? 0) < MIN_LAYER_USERS) return none

    const corridors = (layer.named_corridors ?? []) as HeatmapNamedCorridor[]
    return new Set(
      corridors
        .filter(c => c.name && c.score >= MIN_CORRIDOR_SCORE)
        .map(c => canonicalStreetKey(c.name)),
    )
  } catch {
    return none
  }
}
