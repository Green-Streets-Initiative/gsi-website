'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import type { BikeComfortData, BikeElevation, BikePlanOption, ReachRow } from './types'

/**
 * The opened bike trip, from the Shift ride planner (parity gap-two-engines,
 * gap-around-you-no-hills, gap-around-you-one-route; 2026-11-13).
 *
 * Around You's rows are rated by the website's own lane matcher (reach.ts);
 * the ride planner, the organizer console and the assistants by
 * plan-ride-route. When someone opens a trip, this asks the planner
 * (/api/nearby/trip/bike) and, when it answers, the trip shows the planner's
 * route, its street-by-street rating and its hills, with the planner's other
 * ways to pick from. A trip re-planned around a street or through a place is
 * rated by the planner too (POST, the drawn line), so a street reads the same
 * before and after.
 *
 * The planner takes 4 to 40 s for a trip it hasn't seen and under a second
 * after, so the trip shows its own route first and changes once, when the
 * answer lands. No answer, or one planned without OpenStreetMap: the trip
 * keeps the route it has.
 *
 * Rows go through `choose` first (the picked way), then useAvoidStreets'
 * apply (a re-planned route), then `rate` (the planner's rating of whatever
 * line is drawn).
 *
 * Twin of the Shift app's components/nearby/useBikePlanner.ts.
 */

type Plan = { status: 'pending' } | { status: 'ready'; options: BikePlanOption[] } | { status: 'none' }
type Rating = { comfort: BikeComfortData; elevation: BikeElevation | null } | 'pending' | 'none'

export type BikePlanState = {
  /** The planner is working on this trip. */
  checking: boolean
  /** Its ways, best first; empty until it answers. */
  options: BikePlanOption[]
  /** The way being shown. */
  chosen: number
}

const NO_PLAN: BikePlanState = { checking: false, options: [], chosen: 0 }

export function useBikePlanner(center: { lat: number; lng: number }) {
  const [plans, setPlans] = useState<Record<string, Plan>>({})
  const [chosen, setChosen] = useState<Record<string, number>>({})
  const [ratings, setRatings] = useState<Record<string, Rating>>({})
  const asked = useRef(new Set<string>())
  const from = `${center.lat.toFixed(3)},${center.lng.toFixed(3)}`

  // A new start is a new trip: forget the answers for the old one
  useEffect(() => {
    asked.current = new Set()
    setPlans({})
    setChosen({})
  }, [from])

  /** Ask the planner about a trip, once. */
  const ensure = useCallback((row: ReachRow | null | undefined) => {
    if (!row || !row.bike_polyline) return
    if (asked.current.has(row.id)) return
    asked.current.add(row.id)
    const started = Date.now()
    setPlans(p => ({ ...p, [row.id]: { status: 'pending' } }))
    fetch(`/api/nearby/trip/bike?from=${from}&to=${row.lat},${row.lng}`)
      .then(r => (r.ok ? r.json() : null))
      .then((json: { options?: BikePlanOption[]; degraded?: boolean } | null) => {
        const options = Array.isArray(json?.options) ? json!.options : []
        posthog.capture('nearby_bike_plan', {
          destination: row.id.startsWith('trip:') ? 'trip' : row.id,
          ms: Date.now() - started,
          ways: options.length,
          degraded: !!json?.degraded,
        })
        if (options.length === 0) {
          setPlans(p => ({ ...p, [row.id]: { status: 'none' } }))
          return
        }
        // The planner's ways are rated already: no second ask for those lines
        setRatings(r => {
          const next = { ...r }
          for (const o of options) next[o.polyline] = { comfort: o.comfort, elevation: o.elevation }
          return next
        })
        setPlans(p => ({ ...p, [row.id]: { status: 'ready', options } }))
      })
      .catch(() => setPlans(p => ({ ...p, [row.id]: { status: 'none' } })))
  }, [from])

  /** Rate a drawn line the planner didn't plan (a re-planned trip), once. */
  const ensureRating = useCallback((row: ReachRow | null | undefined) => {
    const line = row?.bike_polyline
    if (!row || !line) return
    if (plans[row.id]?.status !== 'ready') return
    if (ratings[line]) return
    setRatings(r => ({ ...r, [line]: 'pending' }))
    fetch('/api/nearby/trip/bike', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polyline: line }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then((json: { rating?: { comfort: BikeComfortData; elevation: BikeElevation | null } | null } | null) => {
        const got = json?.rating
        setRatings(r => ({ ...r, [line]: got?.comfort ? { comfort: got.comfort, elevation: got.elevation ?? null } : 'none' }))
      })
      .catch(() => setRatings(r => ({ ...r, [line]: 'none' })))
  }, [plans, ratings])

  /** The trip with the planner's way in place, when it has answered. */
  const choose = useCallback((row: ReachRow): ReachRow => {
    const plan = plans[row.id]
    if (plan?.status !== 'ready') return row
    const o = plan.options[Math.min(chosen[row.id] ?? 0, plan.options.length - 1)]
    return {
      ...row,
      bike_minutes: o.minutes,
      bike_is_estimate: false,
      bike_polyline: o.polyline,
      bike_comfort: o.comfort,
      bike_steps: o.steps,
      bike_elevation: o.elevation,
      // The planner's other ways replace the one faster route
      bike_alt: null,
      // Matched along reach.ts's line; this one may pass others
      bike_perks: o.polyline === row.bike_polyline ? row.bike_perks : [],
    }
  }, [plans, chosen])

  /** The drawn line's planner rating, when the trip was re-planned. */
  const rate = useCallback((row: ReachRow): ReachRow => {
    if (plans[row.id]?.status !== 'ready' || !row.bike_polyline) return row
    const r = ratings[row.bike_polyline]
    // Not rated (yet): the re-planned route's own rating, and no hills
    if (!r || typeof r === 'string') return { ...row, bike_elevation: null }
    return { ...row, bike_comfort: r.comfort, bike_elevation: r.elevation }
  }, [plans, ratings])

  const pick = useCallback((rowId: string, index: number) => {
    setChosen(c => ({ ...c, [rowId]: index }))
    posthog.capture('nearby_bike_way_picked', { index })
  }, [])

  const stateFor = useCallback((rowId: string): BikePlanState => {
    const plan = plans[rowId]
    if (!plan) return NO_PLAN
    if (plan.status === 'pending') return { ...NO_PLAN, checking: true }
    if (plan.status === 'none') return NO_PLAN
    return { checking: false, options: plan.options, chosen: Math.min(chosen[rowId] ?? 0, plan.options.length - 1) }
  }, [plans, chosen])

  return { ensure, ensureRating, choose, rate, pick, stateFor }
}
