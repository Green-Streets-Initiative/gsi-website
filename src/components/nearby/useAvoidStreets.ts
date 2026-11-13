'use client'

import { useCallback, useState } from 'react'
import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase'
import type { BikeComfortData, ReachRow, ReachStep } from './types'
import type { TripRouteChanges } from '@/lib/nearby/saved-trips'

/**
 * "Avoid this street" and "Go through a place" (Around You v2, Keith
 * 2026-11-02 and 2026-11-13). A tapped street on a bike trip can be avoided,
 * and the ride can be sent through one place: the server re-plans the ride
 * (/api/nearby/trip/avoid) and the answer replaces the trip's bike route, so
 * the map, the time and the comfort rows all follow without knowing about it.
 * Every change keeps what came before it (avoided streets keep being avoided
 * when a place is added, and the reverse; a new place replaces the old one),
 * and Undo takes back the last change only, as the app and the ride planner
 * do. When the new route rides a same-named street in another town, the
 * server names both towns and the Avoiding line takes its town too.
 *
 * A saved trip keeps its changes (lib/saved-trips, 01787): changesFor reads
 * them off a trip for "Save this trip", and restore plans the ride again with
 * them in one call when the saved trip is opened.
 *
 * Twin of the Shift app's components/nearby/useAvoidStreets.ts.
 */

type Avoided = { key: string; label: string; polylines: string[] }

/** What /api/nearby/trip/avoid takes (MAX_STREETS, MAX_STRETCHES), as the ride planner caps it. */
export const MAX_AVOID_STREETS = 4
const MAX_AVOID_STRETCHES = 16
/** The one place the ride goes through. */
export type Through = { lat: number; lng: number; label: string }
type Route = { minutes: number; polyline: string; comfort: BikeComfortData | null; steps: ReachStep[] }
type Entry = {
  avoided: Avoided[]
  through: Through | null
  route: Route
  /** The minutes of the route shown before the first change. */
  baseMinutes: number
  /** The trip before this change, so Undo steps back one change, as in the app. */
  prev: Entry | null
}

export type AvoidState = {
  /** Streets being avoided on this trip, in the order they were asked. */
  avoiding: string[]
  /** The place the ride goes through, when there is one. */
  through: string | null
  throughAt: { lat: number; lng: number } | null
  /** Minutes against the route shown before (positive = longer). */
  deltaMin: number | null
  /** The street being re-planned around right now. */
  pendingKey: string | null
  /** A ride through a place is being found right now. */
  throughPending: boolean
  /** The street there was no reasonable way around. */
  noneKey: string | null
  failedKey: string | null
  /** As many streets avoided as the server takes: say so in place of the button. */
  full: boolean
}

/** How a re-plan came out. */
export type ThroughResult = 'ok' | 'none' | 'failed'

type Mark = { rowId: string; key: string } | null
const THROUGH_KEY = '~through'

/** "Cambridge Street, Boston" → "Cambridge Street". */
const streetOnly = (label: string) => label.split(',')[0].trim()

export function useAvoidStreets(center: { lat: number; lng: number }) {
  const [entries, setEntries] = useState<Record<string, Entry>>({})
  const [pending, setPending] = useState<Mark>(null)
  const [none, setNone] = useState<Mark>(null)
  const [failed, setFailed] = useState<Mark>(null)

  /** The trip as it should be drawn: its re-planned route, when it has one. */
  const apply = useCallback((row: ReachRow): ReachRow => {
    const e = entries[row.id]
    if (!e) return row
    return {
      ...row,
      bike_minutes: e.route.minutes,
      bike_is_estimate: false,
      bike_polyline: e.route.polyline,
      bike_comfort: e.route.comfort,
      bike_steps: e.route.steps,
      bike_alt: null,
      // Matched along the old line; the new one may pass none of them
      bike_perks: [],
    }
  }, [entries])

  /** One re-plan with these streets avoided and this place gone through.
   *  On "ok" the new route is in place. */
  const replan = useCallback(async (
    row: ReachRow,
    shownMinutes: number,
    avoided: Avoided[],
    through: Through | null,
    key: string,
  ): Promise<ThroughResult> => {
    const prev = entries[row.id] ?? null
    setPending({ rowId: row.id, key })
    setNone(null)
    setFailed(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/nearby/trip/avoid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          from: center,
          to: { lat: row.lat, lng: row.lng },
          avoid: avoided.map(a => a.polylines),
          names: avoided.map(a => streetOnly(a.label)),
          ...(through ? { through: { lat: through.lat, lng: through.lng } } : {}),
        }),
      })
      if (!resp.ok) throw new Error(String(resp.status))
      const { route, avoided_towns: towns } = await resp.json() as {
        route: Route | null
        avoided_towns?: (string | null)[]
      }
      if (!route) {
        setNone({ rowId: row.id, key })
        return 'none'
      }
      const named = avoided.map((a, i) => (towns?.[i] ? { ...a, label: `${streetOnly(a.label)}, ${towns[i]}` } : a))
      setEntries(e => ({ ...e, [row.id]: { avoided: named, through, route, baseMinutes: prev?.baseMinutes ?? shownMinutes, prev } }))
      return 'ok'
    } catch {
      setFailed({ rowId: row.id, key })
      return 'failed'
    } finally {
      setPending(p => (p?.rowId === row.id && p.key === key ? null : p))
    }
  }, [center, entries])

  /** `row` and `comfort` are what's on screen: the stretches to avoid are the
   *  ones that street row lights on the map. */
  const avoid = useCallback(async (row: ReachRow, comfort: BikeComfortData, shownMinutes: number, key: string, label: string): Promise<boolean> => {
    const polylines = comfort.segments.filter(s => s.street_key === key).map(s => s.polyline).slice(0, MAX_AVOID_STRETCHES)
    if (polylines.length === 0) return false
    const prev = entries[row.id]
    if ((prev?.avoided.length ?? 0) >= MAX_AVOID_STREETS) return false
    const avoided = [...(prev?.avoided ?? []), { key, label, polylines }]
    posthog.capture('nearby_avoid_street', { destination: row.id, streets: avoided.length, through: !!prev?.through })
    const result = await replan(row, shownMinutes, avoided, prev?.through ?? null, key)
    if (result === 'none') posthog.capture('nearby_avoid_street_none', { destination: row.id })
    return result === 'ok'
  }, [entries, replan])

  /** Send the ride through one place (a new place replaces the old one),
   *  still avoiding every street avoided so far. */
  const goThrough = useCallback(async (row: ReachRow, shownMinutes: number, place: Through, via: 'tap' | 'search'): Promise<ThroughResult> => {
    const avoided = entries[row.id]?.avoided ?? []
    posthog.capture('nearby_through_place', { destination: row.id, via, avoiding: avoided.length })
    const result = await replan(row, shownMinutes, avoided, place, THROUGH_KEY)
    if (result !== 'ok') posthog.capture('nearby_through_place_failed', { destination: row.id, result })
    return result
  }, [entries, replan])

  /** A saved trip's changes, planned again in one call (opening a saved
   *  trip). Resolves true when the new route is in place. */
  const restore = useCallback(
    async (
      row: ReachRow,
      shownMinutes: number,
      changes: TripRouteChanges,
    ): Promise<boolean> => {
      const avoided = changes.avoid
        .slice(0, MAX_AVOID_STREETS)
        .map((a) => ({ key: a.key, label: a.label, polylines: a.polylines.slice(0, MAX_AVOID_STRETCHES) }))
        .filter((a) => a.polylines.length > 0)
      if (avoided.length === 0 && !changes.through) return false
      posthog.capture('nearby_saved_changes_restored', { destination: row.id, streets: avoided.length, through: !!changes.through })
      const result = await replan(row, shownMinutes, avoided, changes.through, changes.through ? THROUGH_KEY : avoided[0].key)
      return result === 'ok'
    },
    [replan],
  )

  /** What has been changed about a trip, as a saved trip keeps it; null = nothing. */
  const changesFor = useCallback(
    (rowId: string): TripRouteChanges | null => {
      const e = entries[rowId]
      if (!e || (e.avoided.length === 0 && !e.through)) return null
      return { avoid: e.avoided.map((a) => ({ key: a.key, label: a.label, polylines: a.polylines })), through: e.through }
    },
    [entries],
  )

  /** Take back the last change (parity gap-undo-all; the planner and the
   *  app undo one change at a time). */
  const undo = useCallback((rowId: string) => {
    setEntries(e => {
      const cur = e[rowId]
      if (!cur) return e
      const next = { ...e }
      if (cur.prev) next[rowId] = cur.prev
      else delete next[rowId]
      return next
    })
    setNone(null)
    setFailed(null)
  }, [])

  const stateFor = useCallback((rowId: string): AvoidState => {
    const e = entries[rowId]
    const pendingKey = pending?.rowId === rowId ? pending.key : null
    return {
      avoiding: e?.avoided.map(a => a.label) ?? [],
      through: e?.through?.label ?? null,
      throughAt: e?.through ? { lat: e.through.lat, lng: e.through.lng } : null,
      deltaMin: e ? e.route.minutes - e.baseMinutes : null,
      pendingKey: pendingKey === THROUGH_KEY ? null : pendingKey,
      throughPending: pendingKey === THROUGH_KEY,
      noneKey: none?.rowId === rowId ? none.key : null,
      failedKey: failed?.rowId === rowId ? failed.key : null,
      full: (e?.avoided.length ?? 0) >= MAX_AVOID_STREETS,
    }
  }, [entries, pending, none, failed])

  return { apply, avoid, goThrough, undo, stateFor, restore, changesFor }
}
