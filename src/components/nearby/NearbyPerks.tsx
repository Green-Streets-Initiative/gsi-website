'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { ExternalLink } from 'lucide-react'
import { KIND_ICON } from '@/components/rides/RidePerks'
import { BLOCK_M, type PerkStop } from '@/lib/bike-perks'
import { formatDistance } from '@/lib/events'
import { perkPinHtml } from './markers'
import type { NearbyMarker } from './NearbyMap'
import type { ReachRow } from './types'
import { fetchTripRow } from './TripPlanner'
import { useNearbyT } from './NearbyI18n'

/**
 * Bicycle Benefits members on /nearby, matching the Shift app (Keith
 * 2026-11-01): "Bike perks nearby" as pins and Explore rows, where a tap plans
 * the bike trip there in place, and "Bike perks on the way" (at most two) on a
 * planned bike trip, from the trip's own `bike_perks`. The look is the ride
 * page's (src/components/rides/RidePerks.tsx): the kind as the icon, the perk
 * as a chip, the program credited by name, and one line on the sticker.
 */

/** A perk is worth a short ride, not a trip of its own (the app's radius). */
const NEARBY_RADIUS_M = 3200
/** Rows and pins: enough to choose from without burying the map. */
const NEARBY_CAP = 6
const PROGRAM_URL = 'https://bicyclebenefits.org'

const perkKey = (p: PerkStop) => `${p.name}|${p.lat}|${p.lng}`

/** The members near the page's spot, and planning a trip to one. */
export function useNearbyPerks({ center, onPlanned }: {
  center: { lat: number; lng: number }
  onPlanned: (row: ReachRow, prefer?: 'transit' | 'bike') => void
}) {
  const [perks, setPerks] = useState<PerkStop[]>([])
  useEffect(() => {
    let live = true
    fetch(`/api/bike-perks?near=${center.lat},${center.lng}&r=${NEARBY_RADIUS_M}`)
      .then(r => (r.ok ? r.json() : { perks: [] }))
      .then((d: { perks?: PerkStop[] }) => { if (live) setPerks((d.perks ?? []).slice(0, NEARBY_CAP)) })
      .catch(() => { if (live) setPerks([]) })
    return () => { live = false }
  }, [center.lat, center.lng])

  const [planning, setPlanning] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const plan = useCallback(async (p: PerkStop, source: 'list' | 'map') => {
    const key = perkKey(p)
    setPlanning(key)
    setFailed(null)
    try {
      const row = await fetchTripRow(center, p, p.name)
      posthog.capture('snapshot_trip_planned', {
        transit: row.transit_minutes ?? null, bike: row.bike_minutes ?? null, via: 'bike_perk', source,
      })
      onPlanned({ ...row, perk_dest: p }, 'bike')
    } catch {
      setFailed(key)
    } finally {
      setPlanning(null)
    }
  }, [center, onPlanned])

  const planById = useCallback((markerId: string) => {
    const p = perks[Number(markerId.slice('perk:'.length))]
    if (p) plan(p, 'map')
  }, [perks, plan])

  return { perks, planning, failed, plan, planById }
}

export const isPerkMarker = (id: string) => id.startsWith('perk:')

/** Pins: the nearby set while Explore is open, or the one or two on the way
 *  while a bike trip is drawn (named, and not tappable: the list says more). */
export function usePerkMarkers({ perks, showNearby, route }: {
  perks: PerkStop[]
  showNearby: boolean
  route: ReachRow | null
}): NearbyMarker[] {
  return useMemo(() => {
    if (route) {
      return tripPerks(route).filter(p => p !== route.perk_dest).map((p, i) => ({
        id: `perkroute:${i}`, lat: p.lat, lng: p.lng, html: perkPinHtml(`${p.name}: ${p.perk}`, p.name), zIndex: 4,
      }))
    }
    if (!showNearby) return []
    return perks.map((p, i) => ({
      id: `perk:${i}`, lat: p.lat, lng: p.lng, html: perkPinHtml(`${p.name}: ${p.perk}`),
      tappable: true, analyticsType: 'bike_perk', zIndex: 3,
    }))
  }, [perks, showNearby, route])
}

/** The trip's perks to show: the destination first when it is one, then the
 *  route's in riding order, two at most. */
function tripPerks(row: ReachRow): PerkStop[] {
  const dest = row.perk_dest
  const onTheWay = (row.bike_perks ?? []).filter(p => !dest || perkKey(p) !== perkKey(dest))
  return (dest ? [dest, ...onTheWay] : onTheWay).slice(0, 2)
}

function PerkIcon({ p }: { p: PerkStop }) {
  const tr = useNearbyT()
  const Icon = KIND_ICON[p.kind]
  return (
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--nb-panel-raised) text-(--nb-accent)"
      title={tr(`perks.kind_${p.kind}`)}>
      <Icon size={17} aria-hidden />
    </span>
  )
}

function PerkChip({ perk }: { perk: string }) {
  return <span className="rounded-lg bg-(--nb-accent-tint) px-2.5 py-0.5 font-semibold text-(--nb-ink)">{perk}</span>
}

/** "No sticker yet? X sells them. About Bicycle Benefits" — said once per block. */
function StickerLine({ stops, surface }: { stops: PerkStop[]; surface: 'explore' | 'trip' }) {
  const tr = useNearbyT()
  const seller = stops.find(p => p.stickers)
  return (
    <p className="mt-3 text-[14px] leading-snug text-(--nb-ink-70)">
      {seller ? tr('perks.sticker_seller', { name: seller.name }) : tr('perks.sticker_any')}{' '}
      <a href={PROGRAM_URL} target="_blank" rel="noopener noreferrer"
        onClick={() => posthog.capture('nearby_perk_link_clicked', { surface, target: 'program' })}
        className="inline-flex items-center gap-1 font-semibold text-(--nb-accent) hover:underline">
        {tr('perks.about')} <ExternalLink size={12} aria-hidden />
      </a>
    </p>
  )
}

/** Explore: "Bike perks nearby". A row plans the bike trip there. */
export function ExplorePerks({ perks, planning, failed, onPlan }: {
  perks: PerkStop[]
  planning: string | null
  failed: string | null
  onPlan: (p: PerkStop, source: 'list') => void
}) {
  const tr = useNearbyT()
  // A trip takes a few seconds to plan, and a map pin's row can be off
  // screen: bring the row that is planning (or failed) into view.
  const rows = useRef(new Map<string, HTMLDivElement>())
  const shown = planning ?? failed
  useEffect(() => {
    if (shown) rows.current.get(shown)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [shown])
  if (perks.length === 0) return null
  const away = (p: PerkStop) => p.meters <= BLOCK_M
    ? tr('perks.block_away')
    : tr('explore.distance_away', { distance: formatDistance(Math.max(0.1, p.meters / 1609)) })
  return (
    <div className="mt-5">
      <div className="text-[0.7rem] font-bold uppercase tracking-wider text-(--nb-ink-70)">
        {tr('perks.nearby_title')}
      </div>
      <p className="mb-2.5 mt-1 text-[14px] leading-snug text-(--nb-ink-70)">{tr('perks.nearby_sub')}</p>
      <div className="overflow-hidden rounded-xl border border-(--nb-line) bg-(--nb-card)">
        {perks.map((p, i) => {
          const key = perkKey(p)
          return (
            <div key={key} ref={el => { if (el) rows.current.set(key, el); else rows.current.delete(key) }}
              className={`${i > 0 ? 'border-t border-(--nb-line)' : ''} ${planning === key ? 'bg-(--nb-accent-tint)' : ''}`}>
              <button
                onClick={() => onPlan(p, 'list')}
                disabled={planning !== null}
                aria-label={tr('perks.plan_aria', { name: p.name })}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-(--nb-panel-faint) disabled:cursor-wait"
              >
                <PerkIcon p={p} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-snug text-(--nb-ink)">{p.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-(--nb-ink-70)">
                    <PerkChip perk={p.perk} />
                    {planning === key
                      ? <span className="font-semibold text-(--nb-accent)">{tr('perks.planning')}</span>
                      : away(p)}
                  </span>
                  {failed === key && (
                    <span className="mt-1 block text-[14px] text-(--nb-ink-80)">{tr('perks.error')}</span>
                  )}
                </span>
                <span className="self-center text-[1.1rem] font-bold leading-none text-(--nb-accent)" aria-hidden>›</span>
              </button>
            </div>
          )
        })}
      </div>
      <StickerLine stops={perks} surface="explore" />
    </div>
  )
}

/** A planned bike trip: "Bike perks on the way" (or "on this trip" when the
 *  trip goes to one), two at most. Nothing when there are none. */
export function TripPerks({ row }: { row: ReachRow }) {
  const tr = useNearbyT()
  const stops = tripPerks(row)
  if (stops.length === 0) return null
  const track = () => posthog.capture('nearby_perk_link_clicked', { surface: 'trip', target: 'business' })
  return (
    <div className="mt-4 border-t border-(--nb-line) pt-3.5">
      <div className="text-[0.95rem] font-bold text-(--nb-ink)">
        {row.perk_dest ? tr('perks.trip_title_dest') : tr('perks.trip_title')}
      </div>
      <p className="mt-0.5 text-[14px] leading-snug text-(--nb-ink-70)">{tr('perks.subtitle')}</p>
      <ul className="mt-3 space-y-3">
        {stops.map(p => (
          <li key={perkKey(p)} className="flex gap-3">
            <PerkIcon p={p} />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-snug text-(--nb-ink)">
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" onClick={track} className="hover:underline">{p.name}</a>
                ) : p.name}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-(--nb-ink-70)">
                <PerkChip perk={p.perk} />
                {p === row.perk_dest && tr('perks.destination')}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <StickerLine stops={stops} surface="trip" />
    </div>
  )
}
