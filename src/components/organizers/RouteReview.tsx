'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Camera } from 'lucide-react'
import { PanelPhoto } from '@/components/nearby/DetailPanel'
import {
  COMFORT_LABELS, comfortPieces, comfortableShare, concernAdvice, concernTitle, formatStretchMiles, legPhotoSpec,
  newLaneNotes, relevantConcerns, safetyVerdict, type CalmFlag, type CalmOption, type ComfortPiece,
} from '@/components/commute/calm-route'
import { PACE_MID_MPH, PACE_OPTIONS } from '@/lib/organizers/ride-words'
import { routeMiles } from '@/lib/organizers/route-geo'
import { assessRouteRisk } from '@/lib/organizers/route-risk'
import type { RouteDraft } from '@/lib/organizers/types'
import type { MapFocus, MapPiece, MapSpot } from './RouteMap'
import { cx } from './ui'

/**
 * What a route is like to ride, street by street, the way Commute Advisor
 * and Nearby show it: the same planner output, the same comfort tiers and
 * concern wording (components/commute/calm-route.ts), and a Street View
 * photo of whichever stretch or spot the organizer picks, so "protected
 * lane on Cummins Hwy" is something they can see.
 */

/** Darker than the site legend so each tier reads on the light street map. */
export const MAP_COMFORT_COLORS: Record<string, string> = {
  path: '#2E8B57',
  protected: '#0E9F8E',
  bike_lane: '#2966E5',
  quiet_street: '#7CB342',
  shared_road: '#8C8FA3',
}

const TIER_ORDER = ['path', 'protected', 'bike_lane', 'quiet_street', 'shared_road']

/** The planner's output as Commute Advisor's helpers read it. */
export function routeOption(route: RouteDraft): CalmOption {
  return {
    score: 0,
    distanceMiles: routeMiles(route.waypoints),
    durationMinutes: 0,
    summary: '',
    waypoints: route.waypoints,
    viaWaypoints: [],
    flags: (route.flags ?? []) as CalmFlag[],
    comfort_segments: route.comfortSegments ?? [],
    comfort_rating: route.comfortRating ?? '',
    comfort_summary: route.comfortSummary ?? '',
  }
}

export interface RouteReading {
  option: CalmOption
  pieces: ComfortPiece[]
  concerns: (CalmFlag & { lat: number; lng: number; n: number })[]
  mapPieces: MapPiece[]
  mapSpots: MapSpot[]
}

export function readRoute(route: RouteDraft | null): RouteReading | null {
  if (!route || route.waypoints.length < 2) return null
  const option = routeOption(route)
  const pieces = route.comfortSegments?.length ? comfortPieces(option) : []
  const concerns = relevantConcerns(option.flags)
    .filter((f): f is CalmFlag & { lat: number; lng: number } => f.type === 'concern' && typeof f.lat === 'number' && typeof f.lng === 'number')
    .map((f, i) => ({ ...f, n: i + 1 }))
  return {
    option,
    pieces,
    concerns,
    mapPieces: pieces.map((p) => ({ coords: p.coords, color: MAP_COMFORT_COLORS[p.rating] ?? MAP_COMFORT_COLORS.shared_road, index: p.index })),
    mapSpots: concerns.map((c) => ({ lat: c.lat, lng: c.lng, n: c.n })),
  }
}

/** "COLUMBUS AVENUE" → "Columbus Avenue": some planner names arrive shouting. */
export function tidyName(s: string): string {
  return s.replace(/\b[A-Z]{3,}\b/g, (w) => w[0] + w.slice(1).toLowerCase())
}

interface StreetRow { label: string; miles: number; rating: string; index: number }

/**
 * The list a person reads: back-to-back pieces of the same street become one
 * row (named for the comfort most of it has), and slivers under 0.15 mi fold
 * into the row before. The map keeps every piece; a row selects its longest.
 */
function streetRows(pieces: ComfortPiece[]): StreetRow[] {
  const rows: (StreetRow & { byRating: Record<string, number>; longest: number })[] = []
  for (const p of pieces) {
    const last = rows[rows.length - 1]
    const same = last && last.label.toLowerCase() === p.label.toLowerCase()
    if (last && (same || p.distanceMi < 0.15)) {
      last.miles += p.distanceMi
      last.byRating[p.rating] = (last.byRating[p.rating] ?? 0) + p.distanceMi
      if (p.distanceMi > last.longest) { last.longest = p.distanceMi; last.index = p.index }
      continue
    }
    rows.push({ label: p.label, miles: p.distanceMi, rating: p.rating, index: p.index, byRating: { [p.rating]: p.distanceMi }, longest: p.distanceMi })
  }
  return rows.map((r) => ({
    label: r.label, miles: r.miles, index: r.index,
    rating: Object.entries(r.byRating).sort((a, b) => b[1] - a[1])[0][0],
  }))
}

function minutes(n: number): string {
  if (n < 60) return `${n} min`
  const h = Math.floor(n / 60)
  const m = n % 60
  return m ? `${h} hr ${m} min` : `${h} hr`
}

export default function RouteReview({ route, reading, pace, focus, onFocus }: {
  route: RouteDraft
  reading: RouteReading
  pace: string | null
  focus: MapFocus
  onFocus: (f: MapFocus) => void
}) {
  const [allStretches, setAllStretches] = useState(false)
  const { option, pieces, concerns } = reading
  const miles = option.distanceMiles
  const comfortPct = pieces.length ? Math.round(comfortableShare(option.comfort_segments) * 100) : null
  const verdict = safetyVerdict(concerns, comfortPct)
  const paceOpt = PACE_OPTIONS.find((p) => p.key === pace)
  const rideMin = pace && PACE_MID_MPH[pace] ? Math.round((miles / PACE_MID_MPH[pace]) * 60) : null

  // Miles on each tier, for the bar.
  const tiers = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of pieces) m[p.rating] = (m[p.rating] ?? 0) + p.distanceMi
    const total = Object.values(m).reduce((a, b) => a + b, 0)
    return TIER_ORDER.filter((t) => m[t] > 0).map((t) => ({ rating: t, miles: m[t], pct: total ? (m[t] / total) * 100 : 0 }))
  }, [pieces])

  const rows = useMemo(() => streetRows(pieces), [pieces])

  // What the photo shows: the picked stretch or spot, else the first spot, else the first stretch.
  const shown = focus ?? (concerns[0] ? { kind: 'spot' as const, n: concerns[0].n } : pieces[0] ? { kind: 'piece' as const, index: pieces[0].index } : null)
  const spot = shown?.kind === 'spot' ? concerns.find((c) => c.n === shown.n) ?? null : null
  const piece = shown?.kind === 'piece' ? pieces.find((p) => p.index === shown.index) ?? null : null
  const photo = spot ? { lat: spot.lat, lng: spot.lng } : piece ? legPhotoSpec(option, piece.index) : null
  const caption = spot
    ? tidyName(concernTitle(spot))
    : piece ? `${tidyName(piece.label)}, ${formatStretchMiles(rows.find((r) => r.index === piece.index)?.miles ?? piece.distanceMi)}, ${(COMFORT_LABELS[piece.rating] ?? piece.rating).toLowerCase()}` : ''

  const list = allStretches ? rows : rows.slice(0, 10)

  return (
    <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([
          ['Distance', `${miles.toFixed(1)} mi`],
          ['Climbing', route.elevation ? `${Math.round(route.elevation.ascent_ft).toLocaleString()} ft` : '–'],
          [paceOpt ? `Riding time, ${paceOpt.label.toLowerCase()}` : 'Riding time', rideMin ? `about ${minutes(rideMin)}` : 'Pick a pace'],
          ['On calm streets', comfortPct != null ? `${comfortPct}%` : '–'],
        ] as const).map(([k, v]) => (
          <div key={k} className="rounded-xl bg-(--ev-panel-faint) px-3.5 py-2.5">
            <dt className="text-[14px] font-semibold text-(--ev-ink-75)">{k}</dt>
            <dd className="font-display text-[22px] font-extrabold leading-tight text-(--ev-ink)">{v}</dd>
          </div>
        ))}
      </dl>

      {tiers.length > 0 && (
        <div>
          <div className="flex h-3 w-full overflow-hidden rounded-full" role="img"
            aria-label={tiers.map((t) => `${Math.round(t.pct)}% ${COMFORT_LABELS[t.rating]}`).join(', ')}>
            {tiers.map((t) => <span key={t.rating} style={{ width: `${t.pct}%`, background: MAP_COMFORT_COLORS[t.rating] }} />)}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {tiers.map((t) => (
              <li key={t.rating} className="flex items-center gap-1.5 text-[14px] text-(--ev-ink-85)">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: MAP_COMFORT_COLORS[t.rating] }} aria-hidden />
                {COMFORT_LABELS[t.rating]} {formatStretchMiles(t.miles)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pieces.length > 0 && <p className="text-[15px] font-semibold text-(--ev-ink)">{verdict.text}</p>}
      {assessRouteRisk(route.comfortSegments, route.flags as { type?: string; description?: string }[]).level === 'high' && (
        <p className="rounded-xl bg-[#FFF4D6] px-4 py-3 text-[15px] text-[#6B4200]">
          Most of this route is on streets shared with cars, with a crash history or fast traffic. If the ride is public, GSI checks it before it goes on the events calendar; the ride page works right away.
        </p>
      )}
      {newLaneNotes(option.flags).length > 0 && (
        <ul className="grid gap-1">
          {newLaneNotes(option.flags).map((n) => (
            <li key={n} className="flex items-center gap-2 text-[15px] font-semibold text-(--ev-ink)">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: MAP_COMFORT_COLORS.protected }} aria-hidden />{n}
            </li>
          ))}
        </ul>
      )}

      {(pieces.length > 0 || concerns.length > 0) && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="order-2 min-w-0 lg:order-1">
            {concerns.length > 0 && (
              <section className="mb-4">
                <h4 className="mb-1.5 text-[15px] font-bold text-(--ev-ink)">Spots to take carefully</h4>
                <ul className="grid gap-1">
                  {concerns.map((c) => {
                    const on = shown?.kind === 'spot' && shown.n === c.n
                    return (
                      <li key={c.n}>
                        <button type="button" onClick={() => onFocus({ kind: 'spot', n: c.n })} aria-pressed={on}
                          className={cx('flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left', on ? 'bg-[#FDEBDD]' : 'hover:bg-(--ev-panel-faint)')}>
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E8833A] text-[12px] font-extrabold text-white">!</span>
                          <span className="min-w-0">
                            <span className="block text-[15px] font-semibold text-(--ev-ink)">{tidyName(concernTitle(c))}</span>
                            {concernAdvice(c) && <span className="block text-[14px] text-(--ev-ink-75)">{concernAdvice(c)}</span>}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
            {pieces.length > 0 && (
              <section>
                <h4 className="mb-1.5 text-[15px] font-bold text-(--ev-ink)">Street by street</h4>
                <ol className="grid gap-0.5">
                  {list.map((p) => {
                    const on = shown?.kind === 'piece' && shown.index === p.index
                    return (
                      <li key={p.index}>
                        <button type="button" onClick={() => onFocus({ kind: 'piece', index: p.index })} aria-pressed={on}
                          className={cx('flex min-h-[40px] w-full items-center gap-2.5 rounded-lg px-2.5 text-left', on ? 'bg-(--ev-panel)' : 'hover:bg-(--ev-panel-faint)')}>
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: MAP_COMFORT_COLORS[p.rating] }} aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-(--ev-ink)">{tidyName(p.label)}</span>
                          <span className="shrink-0 text-[14px] text-(--ev-ink-75)">{COMFORT_LABELS[p.rating] ?? p.rating} · {formatStretchMiles(p.miles)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
                {rows.length > 10 && (
                  <button type="button" onClick={() => setAllStretches((v) => !v)} className="mt-1 px-2.5 text-[14px] font-semibold text-(--ev-ink) underline">
                    {allStretches ? 'Show fewer' : `Show all ${rows.length} streets`}
                  </button>
                )}
              </section>
            )}
          </div>

          <figure className="order-1 min-w-0 lg:sticky lg:top-20 lg:order-2 lg:self-start">
            {/* The photo box keeps its size while Street View loads or has nothing here. */}
            <div className="relative min-h-[150px] overflow-hidden rounded-xl border border-(--ev-line) bg-(--ev-panel-faint) [&_img]:mt-0">
              <Camera className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-(--ev-ink-60)" aria-hidden />
              {photo ? (
                <div className="relative"><PanelPhoto key={`${photo.lat},${photo.lng}`} spec={{ kind: 'sv', ...photo }} alt={caption} /></div>
              ) : (
                <div className="flex aspect-[16/9] items-center justify-center text-(--ev-ink-75)"><Camera className="h-6 w-6" aria-hidden /></div>
              )}
            </div>
            {caption && (
              <figcaption className="mt-2 flex items-start gap-1.5 text-[14px] text-(--ev-ink-85)">
                {spot && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C2611F]" aria-hidden />}
                <span><span className="font-semibold text-(--ev-ink)">{caption}</span>. Street View; pick any stretch or spot to see it.</span>
              </figcaption>
            )}
          </figure>
        </div>
      )}
    </div>
  )
}
