'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Who is planning, for the two things only a signed-in Shift member gets
 * (Shift 01758):
 *   - which ways they made a trip by in the last 60 days (get_my_ways), so
 *     help for a first try shows only when the way is new for them;
 *   - an open Try something new offer from their workplace's challenge
 *     (get_my_guaranteed_challenges), so the card can say the trip counts.
 * Signed out, or under 3 days of trips: we can't tell what's new ("unknown").
 */

export type TripWay = 'walk' | 'bike' | 'transit'
export type Novelty = 'new' | 'known' | 'unknown'

export type MyWays = {
  signedIn: boolean
  ways: TripWay[] | null
  tryNew: { employer: string } | null
}

type Challenge = { ok?: boolean; employer?: string; offers?: { metric?: string }[] }

export function useMyWays(): MyWays {
  const [state, setState] = useState<MyWays>({ signedIn: false, ways: null, tryNew: null })
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Local preview only (next dev): ?firsttry=new shows a member for whom
        // every way is new, with a workplace challenge running
        if (process.env.NODE_ENV === 'development' && new URLSearchParams(window.location.search).get('firsttry') === 'new') {
          if (!cancelled) setState({ signedIn: false, ways: [], tryNew: { employer: 'Test Co' } })
          return
        }
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const [w, c] = await Promise.all([
          supabase.rpc('get_my_ways'),
          supabase.rpc('get_my_guaranteed_challenges'),
        ])
        if (cancelled) return
        const mine = (w.data ?? null) as { ways?: TripWay[]; days?: number } | null
        const offer = ((c.data ?? []) as Challenge[]).find(x => x?.ok && (x.offers ?? []).some(o => o.metric === 'tried_new'))
        setState({
          signedIn: true,
          ways: mine && (mine.days ?? 0) >= 3 ? (mine.ways ?? []) : null,
          tryNew: offer?.employer ? { employer: offer.employer } : null,
        })
      } catch {
        // Signed-in extras only; the trip answer never waits on them
      }
    })()
    return () => { cancelled = true }
  }, [])
  return state
}

export function novelty(me: MyWays, way: TripWay): Novelty {
  if (!me.ways) return 'unknown'
  return me.ways.includes(way) ? 'known' : 'new'
}

/** Save or update one plan (a signed-in member only; the server checks). */
export function saveTripPlan(p: {
  id: string
  from: { lat: number; lng: number }
  to: { lat: number; lng: number; name: string }
  way: TripWay
  newWay: boolean | null
  ways: Record<string, number | null>
  directions?: boolean
}) {
  void supabase.rpc('save_trip_plan', {
    p_id: p.id,
    p_surface: 'web',
    p_from_lat: p.from.lat,
    p_from_lng: p.from.lng,
    p_to_lat: p.to.lat,
    p_to_lng: p.to.lng,
    p_to_name: p.to.name.slice(0, 120),
    p_way: p.way,
    p_new_way: p.newWay,
    p_ways: p.ways,
    p_directions: !!p.directions,
  }).then(() => {}, () => {})
}
