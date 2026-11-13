'use client'

import { useCallback, useState } from 'react'
import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase'
import type { BikeComfortData, ReachRow, ReachStep } from './types'

/**
 * "Avoid this street" (Around You v2, Keith 2026-11-02). A tapped street on a
 * bike trip can be avoided: the server re-plans the ride around it
 * (/api/nearby/trip/avoid) and the answer replaces the trip's bike route, so
 * the map, the time and the comfort rows all follow without knowing about it.
 * Several streets can be avoided in turn; Undo puts the first answer back.
 * When the new route rides a same-named street in another town, the server
 * names both towns and the Avoiding line takes its town too.
 */

type Avoided = { key: string; label: string; polylines: string[] }

/** What /api/nearby/trip/avoid takes (MAX_STREETS, MAX_STRETCHES), as the ride planner caps it. */
export const MAX_AVOID_STREETS = 4
const MAX_AVOID_STRETCHES = 16
type Entry = {
  avoided: Avoided[]
  route: { minutes: number; polyline: string; comfort: BikeComfortData | null; steps: ReachStep[] }
  /** The minutes of the route shown before the first avoid. */
  baseMinutes: number
  /** The trip before this change, so Undo steps back one street, as in the app. */
  prev: Entry | null
}

export type AvoidState = {
  /** Streets being avoided on this trip, in the order they were asked. */
  avoiding: string[]
  /** Minutes against the route shown before (positive = longer). */
  deltaMin: number | null
  /** The street being re-planned around right now. */
  pendingKey: string | null
  /** The street there was no reasonable way around. */
  noneKey: string | null
  failedKey: string | null
  /** As many streets avoided as the server takes: say so in place of the button. */
  full: boolean
}

/** "Cambridge Street, Boston" → "Cambridge Street". */
const streetOnly = (label: string) => label.split(',')[0].trim()

export function useAvoidStreets(center: { lat: number; lng: number }) {
  const [entries, setEntries] = useState<Record<string, Entry>>({})
  const [pending, setPending] = useState<{ rowId: string; key: string } | null>(null)
  const [none, setNone] = useState<{ rowId: string; key: string } | null>(null)
  const [failed, setFailed] = useState<{ rowId: string; key: string } | null>(null)

  /** The trip as it should be drawn: its avoiding route, when it has one. */
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

  /** `row` and `comfort` are what's on screen: the stretches to avoid are the
   *  ones that street row lights on the map. */
  const avoid = useCallback(async (row: ReachRow, comfort: BikeComfortData, shownMinutes: number, key: string, label: string): Promise<boolean> => {
    const polylines = comfort.segments.filter(s => s.street_key === key).map(s => s.polyline).slice(0, MAX_AVOID_STRETCHES)
    if (polylines.length === 0) return false
    const prev = entries[row.id]
    if ((prev?.avoided.length ?? 0) >= MAX_AVOID_STREETS) return false
    const avoided = [...(prev?.avoided ?? []), { key, label, polylines }]
    setPending({ rowId: row.id, key })
    setNone(null)
    setFailed(null)
    posthog.capture('nearby_avoid_street', { destination: row.id, streets: avoided.length })
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
        }),
      })
      if (!resp.ok) throw new Error(String(resp.status))
      const { route, avoided_towns: towns } = await resp.json() as {
        route: Entry['route'] | null
        avoided_towns?: (string | null)[]
      }
      if (!route) {
        setNone({ rowId: row.id, key })
        posthog.capture('nearby_avoid_street_none', { destination: row.id })
        return false
      }
      const named = avoided.map((a, i) => (towns?.[i] ? { ...a, label: `${streetOnly(a.label)}, ${towns[i]}` } : a))
      setEntries(e => ({ ...e, [row.id]: { avoided: named, route, baseMinutes: prev?.baseMinutes ?? shownMinutes, prev: prev ?? null } }))
      return true
    } catch {
      setFailed({ rowId: row.id, key })
      return false
    } finally {
      setPending(p => (p?.rowId === row.id && p.key === key ? null : p))
    }
  }, [center, entries])

  /** Undo the last street avoided (parity gap-undo-all; the planner and the
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
    return {
      avoiding: e?.avoided.map(a => a.label) ?? [],
      deltaMin: e ? e.route.minutes - e.baseMinutes : null,
      pendingKey: pending?.rowId === rowId ? pending.key : null,
      noneKey: none?.rowId === rowId ? none.key : null,
      failedKey: failed?.rowId === rowId ? failed.key : null,
      full: (e?.avoided.length ?? 0) >= MAX_AVOID_STREETS,
    }
  }, [entries, pending, none, failed])

  return { apply, avoid, undo, stateFor }
}
