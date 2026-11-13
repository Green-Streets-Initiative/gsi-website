'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { decodePolyline } from '@/lib/geo/polyline'
import { useNearbyT } from '@/components/nearby/NearbyI18n'
import { SPOT_LABELS, isSpotKind, type SpotKind } from './spotCopy'
import { useSpotSwitch } from './useSpotSwitch'

/**
 * "Reported on this walk": open spot reports near the walking parts of a
 * route, from get_spot_cautions (Shift 01664; snow fades after 4 days, the
 * rest after 45; only the problem and how long ago, never who or the note).
 *
 * A route's walks are separate lines (to the stop, between rides, from the
 * last stop), so each is asked about on its own: joined into one, the gap
 * between them would become a straight line across town and pick up spots
 * nobody walks past. Each walk is thinned to keep the whole ask within the
 * function's 500 points.
 *
 * The map's markers and the list under the route use this same hook for
 * the same route, so one answer serves both (cached per route for the visit).
 */

export interface SpotCaution {
  kind: SpotKind
  lat: number
  lng: number
  reported_at: string
  reports: number
}

type Pt = { lat: number; lng: number }

const MAX_POINTS = 500
const cache = new Map<string, Promise<SpotCaution[]>>()

function thin(points: Pt[], max: number): Pt[] {
  if (points.length <= max) return points
  const out: Pt[] = []
  const step = (points.length - 1) / (max - 1)
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)])
  return out
}

/** The walking legs of a transit trip, as point lists. */
export function walkLegs(segments: { mode: string; polyline: string }[] | null | undefined): Pt[][] {
  return (segments ?? [])
    .filter((s) => s.mode === 'walk' && s.polyline)
    .map((s) => decodePolyline(s.polyline).map(([lat, lng]) => ({ lat, lng })))
    .filter((pts) => pts.length >= 2)
}

function legsKey(legs: Pt[][]): string {
  return legs.map((l) => l.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';')).join('|')
}

async function fetchCautions(legs: Pt[][]): Promise<SpotCaution[]> {
  const total = legs.reduce((a, l) => a + l.length, 0)
  const answers = await Promise.all(legs.map(async (leg) => {
    const share = Math.max(2, Math.floor((MAX_POINTS * leg.length) / Math.max(total, 1)))
    const { data, error } = await supabase.rpc('get_spot_cautions', { p_points: thin(leg, Math.min(share, MAX_POINTS)) })
    if (error || !Array.isArray(data)) return []
    return (data as Record<string, unknown>[]).flatMap((r): SpotCaution[] => {
      const lat = Number(r.lat), lng = Number(r.lng)
      if (!isSpotKind(r.kind) || !Number.isFinite(lat) || !Number.isFinite(lng) || typeof r.reported_at !== 'string') return []
      return [{ kind: r.kind, lat, lng, reported_at: r.reported_at, reports: Number(r.reports) || 1 }]
    })
  }))
  // A spot near where two walks meet comes back twice: keep it once.
  const seen = new Set<string>()
  return answers.flat()
    .filter((c) => {
      const k = `${c.kind}:${c.lat.toFixed(4)},${c.lng.toFixed(4)}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .sort((a, b) => b.reported_at.localeCompare(a.reported_at))
}

/** Cautions along these walks; empty while the switch is off, while loading, or on any error. */
export function useSpotCautions(legs: Pt[][] | null): SpotCaution[] {
  const on = useSpotSwitch()
  const key = useMemo(() => (legs && legs.length > 0 ? legsKey(legs) : ''), [legs])
  const [result, setResult] = useState<{ key: string; cautions: SpotCaution[] }>({ key: '', cautions: [] })

  useEffect(() => {
    if (!on || !key || !legs) return
    let cancelled = false
    let p = cache.get(key)
    if (!p) {
      p = fetchCautions(legs).catch(() => [])
      cache.set(key, p)
    }
    p.then((cautions) => { if (!cancelled) setResult({ key, cautions }) })
    return () => { cancelled = true }
    // legs is keyed by its points
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, key])

  return on && result.key === key ? result.cautions : NONE
}

/** "Sidewalk blocked, reported 2 days ago", by calendar day, in the page's language. */
function cautionLine(tr: ReturnType<typeof useNearbyT>, c: SpotCaution, now = new Date()): string {
  const problem = tr(`spot.kind_${c.kind}`)
  const then = new Date(c.reported_at)
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Number.isNaN(then.getTime()) ? 0 : Math.max(0, Math.round((day(now) - day(then)) / 86_400_000))
  if (days === 0) return tr('spot.caution_today', { problem })
  if (days === 1) return tr('spot.caution_yesterday', { problem })
  return tr('spot.caution_days', { problem, count: days })
}

/** One empty list, so "nothing" never looks like a change to a memo downstream. */
const NONE: SpotCaution[] = []

/** A small amber warning dot for the map (NearbyMap DOM-marker HTML), titled in the page's language. */
export function spotCautionMarkerHtml(kind: SpotKind, label: string = SPOT_LABELS[kind]): string {
  const title = label.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
  return `<div title="${title}" style="width:18px;height:18px;border-radius:50%;background:#E0A63C;border:2px solid #191A2E;display:flex;align-items:center;justify-content:center;color:#191A2E;font:800 11px/1 -apple-system,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,0.4)">!</div>`
}

/**
 * The list under a route: "Reported on this walk" and one row per spot,
 * "Sidewalk broken or blocked, reported 2 days ago". Nothing at all when
 * there is nothing to say. Reads the Nearby page's own colour tokens, so it
 * holds up on its light and dark tones.
 */
export function SpotCautionsList({ segments, legs: givenLegs, className = 'mt-3' }: {
  segments?: { mode: string; polyline: string }[] | null
  /** Or the walk's own lines (the commute advisor's walking route). */
  legs?: Pt[][] | null
  className?: string
}) {
  const tr = useNearbyT()
  const fromSegments = useMemo(() => walkLegs(segments), [segments])
  const cautions = useSpotCautions(givenLegs ?? fromSegments)
  if (cautions.length === 0) return null
  return (
    <div className={`${className} rounded-lg border border-(--nb-line-mid) bg-(--nb-panel) px-3 py-2`}>
      <p className="text-[0.875rem] font-bold text-(--nb-ink)">{tr('spot.cautions_title')}</p>
      <ul className="mt-1 space-y-1">
        {cautions.map((c) => (
          <li key={`${c.kind}-${c.lat}-${c.lng}`} className="flex items-start gap-2 text-[0.875rem] leading-snug text-(--nb-ink-80)">
            <span aria-hidden className="mt-[0.4em] h-2 w-2 shrink-0 rounded-full bg-[#E0A63C]" />
            <span>{cautionLine(tr, c)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
