'use client'

/**
 * Saved trips on the website (parity gap-saved-trips-web, 2026-11-13): the
 * same `saved_trips` rows as the Shift app (Shift 01491; the app's
 * lib/saved-trips.ts), read and written with the member's own session, so a
 * trip saved on /nearby shows in the app's "Your trips" and the other way
 * round. A trip is where from, where to and which way, never the timetable:
 * opening one plans it again with live departures.
 *
 * One list in memory for the page, so the Save button and the chips agree
 * the moment either changes it.
 *
 * A bike trip also keeps what was changed about its route (Shift 01787,
 * `route_changes`): the streets it avoids and the place it goes through, the
 * same shape the app writes. Opening it plans the ride again with those
 * changes (useAvoidStreets restore), on either surface.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type TripWay = 'walk' | 'bike' | 'transit'

export interface SavedTripPlace { name: string; lat: number; lng: number }

/** A saved bike trip's route changes (01787): what useAvoidStreets re-sends on open. */
export interface TripRouteChanges {
  /** Each avoided street: its key, its name, and its stretches as encoded polylines. */
  avoid: { key: string; label: string; polylines: string[] }[]
  /** The one place the ride goes through. */
  through: { lat: number; lng: number; label: string } | null
}

export interface SavedTrip {
  id: string
  label: string
  way: TripWay
  /** Null: the trip starts wherever the person is. */
  from: SavedTripPlace | null
  to: SavedTripPlace
  /** Bike only: the streets it avoids and the place it goes through. */
  changes: TripRouteChanges | null
}

export interface NewSavedTrip {
  way: TripWay
  from: SavedTripPlace | null
  to: SavedTripPlace
  /** Undefined while a re-plan is still running. */
  changes?: TripRouteChanges | null
}

/** The table allows 20 a person (trigger saved_trips_cap). */
const MAX = 20

let trips: SavedTrip[] | null = null
let loading: Promise<SavedTrip[]> | null = null
const listeners = new Set<(t: SavedTrip[]) => void>()

function publish(next: SavedTrip[]) {
  trips = next
  for (const l of listeners) l(next)
}

type Row = {
  id: string; label: string; way: TripWay
  from_name: string | null; from_lat: number | null; from_lng: number | null
  to_name: string; to_lat: number; to_lng: number
  route_changes: unknown
}

const COLUMNS = 'id, label, way, from_name, from_lat, from_lng, to_name, to_lat, to_lng, route_changes'

function rowToTrip(r: Row): SavedTrip {
  return {
    id: r.id,
    label: r.label,
    way: r.way,
    from: r.from_lat != null && r.from_lng != null ? { name: r.from_name ?? '', lat: r.from_lat, lng: r.from_lng } : null,
    to: { name: r.to_name, lat: r.to_lat, lng: r.to_lng },
    changes: readChanges(r.route_changes),
  }
}

/** A stored route_changes value, or null when it's missing or not the shape the app writes. */
function readChanges(raw: unknown): TripRouteChanges | null {
  const c = raw as { avoid?: unknown; through?: unknown } | null
  if (!c || typeof c !== 'object' || !Array.isArray(c.avoid)) return null
  const avoid = (c.avoid as { key?: unknown; label?: unknown; polylines?: unknown }[])
    .filter(a => a && typeof a.key === 'string' && typeof a.label === 'string' && Array.isArray(a.polylines))
    .map(a => ({ key: a.key as string, label: a.label as string, polylines: (a.polylines as unknown[]).filter((p): p is string => typeof p === 'string') }))
    .filter(a => a.polylines.length > 0)
  const t = c.through as { lat?: unknown; lng?: unknown; label?: unknown } | null | undefined
  const through = t && typeof t.lat === 'number' && typeof t.lng === 'number'
    ? { lat: t.lat, lng: t.lng, label: typeof t.label === 'string' ? t.label : '' }
    : null
  return avoid.length || through ? { avoid, through } : null
}

/** Only a bike trip carries changes, and an empty set is none. */
function cleanChanges(way: TripWay, c: TripRouteChanges | null | undefined): TripRouteChanges | null {
  if (way !== 'bike' || !c) return null
  return c.avoid.length || c.through ? { avoid: c.avoid.slice(0, 4), through: c.through } : null
}

/** The same changes: the same streets avoided, in the same order, and the same place. */
export function sameChanges(a: TripRouteChanges | null, b: TripRouteChanges | null): boolean {
  if (!a || !b) return !a && !b
  if (a.avoid.length !== b.avoid.length || a.avoid.some((x, i) => x.key !== b.avoid[i].key)) return false
  if (!a.through || !b.through) return !a.through && !b.through
  return near(a.through.lat, b.through.lat) && near(a.through.lng, b.through.lng)
}

/** About 50 m, the table's own rule for "the same trip". */
const near = (a: number, b: number) => Math.round(a * 1000) === Math.round(b * 1000)

export function sameTrip(t: SavedTrip, n: NewSavedTrip): boolean {
  return (
    t.way === n.way &&
    near(t.to.lat, n.to.lat) &&
    near(t.to.lng, n.to.lng) &&
    (t.from && n.from ? near(t.from.lat, n.from.lat) && near(t.from.lng, n.from.lng) : !t.from && !n.from)
  )
}

/** The member's saved trips, newest first; [] when signed out. */
export async function loadSavedTrips(force = false): Promise<SavedTrip[]> {
  if (trips && !force) return trips
  if (loading && !force) return loading
  loading = (async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      loading = null
      publish([])
      return []
    }
    const { data, error } = await supabase
      .from('saved_trips')
      .select(COLUMNS)
      .order('created_at', { ascending: false })
      .limit(MAX)
    loading = null
    if (error) return trips ?? []
    const next = ((data ?? []) as Row[]).map(rowToTrip)
    publish(next)
    return next
  })()
  return loading
}

/** Save a trip, or return the one already saved. "full" at 20. Saving a
 *  trip already kept with other route changes keeps the new ones. */
export async function saveTrip(n: NewSavedTrip): Promise<{ trip: SavedTrip | null; error: 'full' | 'failed' | null }> {
  const list = await loadSavedTrips()
  const changes = cleanChanges(n.way, n.changes)
  const existing = list.find(t => sameTrip(t, n))
  if (existing) {
    if (sameChanges(existing.changes, changes)) return { trip: existing, error: null }
    const ok = await setTripChanges(existing.id, changes)
    return ok ? { trip: { ...existing, changes }, error: null } : { trip: null, error: 'failed' }
  }
  if (list.length >= MAX) return { trip: null, error: 'full' }
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user.id
  if (!userId) return { trip: null, error: 'failed' }
  const { data, error } = await supabase
    .from('saved_trips')
    .insert({
      user_id: userId,
      label: n.to.name.slice(0, 60) || 'Trip',
      way: n.way,
      from_name: n.from?.name ?? null,
      from_lat: n.from?.lat ?? null,
      from_lng: n.from?.lng ?? null,
      to_name: n.to.name,
      to_lat: n.to.lat,
      to_lng: n.to.lng,
      // The table knows two sources; a trip planned on the web is a planner trip
      source: 'planner',
      route_changes: changes,
    })
    .select(COLUMNS)
    .single()
  if (error || !data) {
    if (error?.message.includes('saved_trips_full')) return { trip: null, error: 'full' }
    // Saved from the app a moment ago: read it back
    if (error?.code === '23505' || error?.message.includes('duplicate')) {
      const again = (await loadSavedTrips(true)).find(t => sameTrip(t, n))
      return { trip: again ?? null, error: again ? null : 'failed' }
    }
    return { trip: null, error: 'failed' }
  }
  const trip = rowToTrip(data as Row)
  publish([trip, ...(trips ?? []).filter(t => t.id !== trip.id)])
  return { trip, error: null }
}

/** Keep these route changes (avoided streets, a place to go through) on a saved trip. */
export async function setTripChanges(id: string, changes: TripRouteChanges | null): Promise<boolean> {
  const { error } = await supabase.from('saved_trips').update({ route_changes: changes }).eq('id', id)
  if (error) return false
  publish((trips ?? []).map(t => (t.id === id ? { ...t, changes } : t)))
  return true
}

export async function removeTrip(id: string): Promise<boolean> {
  const { error } = await supabase.from('saved_trips').delete().eq('id', id)
  if (error) return false
  publish((trips ?? []).filter(t => t.id !== id))
  return true
}

/** Remember when a trip was last opened (fire and forget, as the app does). */
export function markTripOpened(id: string): void {
  void Promise.resolve(supabase.from('saved_trips').update({ opened_at: new Date().toISOString() }).eq('id', id)).catch(() => {})
}

/** The saved trips, kept current across the page. Null until loaded. */
export function useSavedTrips(): SavedTrip[] | null {
  const [list, setList] = useState<SavedTrip[] | null>(trips)
  useEffect(() => {
    listeners.add(setList)
    void loadSavedTrips().then(setList)
    return () => { listeners.delete(setList) }
  }, [])
  return list
}
