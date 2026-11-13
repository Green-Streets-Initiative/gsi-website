'use client'

/**
 * "Avoid this street" in the organizer console's route planner, the way the
 * app's planner does it (Shift app/(tabs)/community/plan-route.tsx): the
 * picked street's stretches on each leg it runs on go, as encoded polylines,
 * to Around You's /api/nearby/trip/avoid, which finds a bike route that stays
 * off them; Shift's plan-ride-route then scores that line like any other
 * (comfort, crash spots, hills), and it replaces the leg's chosen way.
 *
 * Behind the same switch as the app's (around_you_v2): each call can cost up
 * to three Google route lookups. Streets are matched by street key, as the
 * app's planner and Around You match them ("Cambridge St" and "Cambridge
 * Street, Boston" are one street).
 */
import { supabase } from '@/lib/supabase'
import { aroundYouV2On } from '@/components/nearby/useNearbyV2'
import { canonicalStreetKey } from '@/lib/nearby/street-names'
import { decodePolyline, encodePolyline } from '@/lib/geo/polyline'
import { accessToken, scoreRoute, type PlannedLegOption } from './api'
import type { LatLng } from './types'

/** What the avoid search takes per leg (its MAX_STREETS and MAX_STRETCHES). */
export const MAX_AVOIDS_PER_LEG = 4
const MAX_STRETCHES = 16

/** A street kept off one leg, so the next avoid stays off it too. */
export type Avoided = { key: string; label: string; polylines: string[] }

/** "Cambridge Street, Boston" → "Cambridge Street". */
export const streetOnly = (label: string) => label.split(',')[0].trim()

/** One key for every spelling of a street (the app's lib/street-rows streetKey). */
export const avoidKey = (label: string) => canonicalStreetKey(streetOnly(label))

/** Whether this organizer has avoid-a-street (around_you_v2, as in the app). */
export async function avoidStreetsOn(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session ? await aroundYouV2On(session.user.id) : false
  } catch {
    return false
  }
}

/** The stretches of one street on a leg's line, as encoded polylines. */
export function streetPolylines(option: PlannedLegOption, label: string): string[] {
  const key = avoidKey(label)
  const w = option.waypoints
  return (option.comfort_segments ?? [])
    .filter((s) => avoidKey(s.label) === key && s.startIdx != null && s.endIdx != null)
    .map((s) => {
      const start = Math.max(0, Math.min(w.length - 1, s.startIdx as number))
      const end = Math.max(start, Math.min(w.length - 1, s.endIdx as number))
      return w.slice(start, end + 1)
    })
    .filter((pts) => pts.length >= 2)
    .slice(0, MAX_STRETCHES)
    .map((pts) => encodePolyline(pts.map((p) => [p.lat, p.lng] as [number, number])))
}

/** Whether a leg's line rides this street at all. */
export const legRides = (option: PlannedLegOption | null | undefined, label: string) =>
  !!option && (option.comfort_segments ?? []).some((s) => avoidKey(s.label) === avoidKey(label))

export type AvoidAnswer = { status: 'ok'; option: PlannedLegOption } | { status: 'none' | 'failed' }

/** One leg's way that stays off every street in `avoided`, scored like the rest. */
export async function findAvoidingOption(from: LatLng, to: LatLng, avoided: Avoided[], pace: string | null): Promise<AvoidAnswer> {
  try {
    const token = await accessToken()
    const res = await fetch('/api/nearby/trip/avoid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        from: { lat: from.lat, lng: from.lng },
        to: { lat: to.lat, lng: to.lng },
        avoid: avoided.map((a) => a.polylines),
        names: avoided.map((a) => streetOnly(a.label)),
      }),
    })
    if (!res.ok) return { status: 'failed' }
    const answer = (await res.json()) as { route: { minutes: number; polyline: string } | null }
    if (!answer.route?.polyline) return { status: 'none' }
    const pts = decodePolyline(answer.route.polyline).map(([lat, lng]) => ({ lat, lng }))
    if (pts.length < 2) return { status: 'none' }
    const scored = await scoreRoute(pts, pace, 'bike')
    return {
      status: 'ok',
      option: {
        score: 0,
        distanceMiles: Number(scored.distanceMiles ?? 0),
        durationMinutes: Math.round(answer.route.minutes),
        summary: '',
        waypoints: pts,
        flags: scored.flags ?? [],
        comfort_segments: (scored.comfort_segments ?? []) as PlannedLegOption['comfort_segments'],
        comfort_rating: scored.comfort_rating ?? undefined,
        comfort_summary: scored.comfort_summary ?? undefined,
        elevation: scored.elevation ?? null,
      },
    }
  } catch {
    return { status: 'failed' }
  }
}
