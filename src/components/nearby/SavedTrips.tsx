'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { BookmarkSimple, Bicycle, Bus, Check, PersonSimpleWalk } from '@phosphor-icons/react'
import { useNearbyT } from './NearbyI18n'
import { fetchTripRow } from './TripPlanner'
import type { ReachRow } from './types'
import { NEARBY_PATH } from '@/lib/nearby/config'
import { round3, stickyParams } from '@/lib/nearby/share'
import { haversineDist } from '@/lib/nearby/live-data'
import { loadSavedTrips, markTripOpened, removeTrip, sameChanges, sameTrip, saveTrip, useSavedTrips, type NewSavedTrip, type SavedTrip, type TripRouteChanges, type TripWay } from '@/lib/nearby/saved-trips'
import type { AvoidState } from './useAvoidStreets'

/**
 * Saved trips on Around You (parity gap-saved-trips-web, 2026-11-13), the
 * app's "Save this trip" and "Your trips" chips (SaveTripButton,
 * SavedTripsRow) for signed-in members. The rows are the app's own, so a
 * trip saved here is in the app's Your trips and the other way round. A bike
 * trip keeps the streets it avoids and the place it goes through (Shift
 * 01787), and opening it puts them back, as the app does.
 */

/** Where the page's trips start from. `here` = the browser's location, saved
 *  as "from wherever I am" (the app's null start), so the trip opens from
 *  where the person is next time. */
export type TripOrigin = { lat: number; lng: number; name: string; here: boolean }
export const TripOriginContext = createContext<TripOrigin | null>(null)

/** The page's avoid-a-street state (useAvoidStreets), so Save keeps the
 *  changes made to a bike trip. Absent = nothing to keep. */
export type AvoidChanges = {
  changesFor: (rowId: string) => TripRouteChanges | null
  stateFor: (rowId: string) => AvoidState
}
export const AvoidChangesContext = createContext<AvoidChanges | null>(null)

function originFor(o: TripOrigin): NewSavedTrip['from'] {
  return o.here ? null : { name: o.name, lat: o.lat, lng: o.lng }
}

/** "Save this trip" under a planned trip; "Saved to Your trips" once it is. */
export function SaveTripButton({ row, mode }: { row: ReachRow; mode: 'transit' | 'bike' }) {
  const tr = useNearbyT()
  const origin = useContext(TripOriginContext)
  const avoid = useContext(AvoidChangesContext)
  const saved = useSavedTrips()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<'full' | 'failed' | null>(null)
  if (!origin) return null
  // The streets avoided and the place gone through; undefined while a
  // re-plan is still running (wait for it), as in the app
  const st = mode === 'bike' ? avoid?.stateFor(row.id) : undefined
  const changes = mode !== 'bike' || !avoid ? null : st?.pendingKey || st?.throughPending ? undefined : avoid.changesFor(row.id)
  const trip: NewSavedTrip = { way: mode, from: originFor(origin), to: { name: row.name, lat: row.lat, lng: row.lng }, changes }
  const savedTrip = saved?.find(s => sameTrip(s, trip)) ?? null
  // Saved, but its avoided streets or place have changed since
  const changed = !!savedTrip && mode === 'bike' && changes !== undefined && !sameChanges(savedTrip.changes, changes ?? null)

  if (savedTrip && !changed) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex min-h-[40px] items-center gap-1.5 text-[15px] font-semibold text-(--nb-ink)">
          <Check size={18} weight="bold" aria-hidden="true" />
          {tr('saved.saved')}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const ok = await removeTrip(savedTrip.id)
            setBusy(false)
            posthog.capture('nearby_trip_unsaved', { way: mode, ok })
          }}
          className="min-h-[40px] text-[14px] font-semibold text-(--nb-ink-80) underline-offset-2 hover:underline disabled:opacity-60"
        >
          {tr('saved.remove')}
        </button>
        <span className="block w-full text-[14px] text-(--nb-ink-80)">{tr('saved.saved_sub')}</span>
      </div>
    )
  }
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setProblem(null)
          const { error } = await saveTrip(trip)
          setBusy(false)
          setProblem(error)
          posthog.capture('nearby_trip_saved', {
            way: mode, from_here: !trip.from, ok: !error, error,
            update: changed, avoids: changes?.avoid.length ?? 0, through: !!changes?.through,
          })
        }}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-(--nb-accent-line) px-3.5 text-[15px] font-semibold text-(--nb-accent) transition-colors hover:bg-(--nb-accent-tint) disabled:opacity-60"
      >
        <BookmarkSimple size={18} weight="bold" aria-hidden="true" />
        {tr(changed ? 'saved.save_changes' : 'saved.save')}
      </button>
      {problem && (
        <p className="mt-1.5 text-[14px] leading-snug text-(--nb-ink-80)" role="status">
          {tr(problem === 'full' ? 'saved.full' : 'saved.failed')}
        </p>
      )}
    </div>
  )
}

const WAY_ICON: Record<TripWay, typeof Bicycle> = { walk: PersonSimpleWalk, bike: Bicycle, transit: Bus }

/** A trip saved from somewhere else opens on that place's page; one from
 *  here (or from right about here) plans in place. */
const FAR_M = 200
/** The saved trip to open once that page has loaded (same tab, this visit). */
const OPEN_KEY = 'nearby:open-saved-trip'

/**
 * "Your trips" under the search: each saved trip as a chip that plans it
 * again, live. Nothing at all for someone signed out or with none saved.
 */
export function SavedTripChips({ center, onPlanned, onRestore }: {
  center: { lat: number; lng: number }
  onPlanned: (row: ReachRow, prefer?: 'transit' | 'bike') => void
  /** Put a saved bike trip's avoided streets and place back (useAvoidStreets restore). */
  onRestore?: (row: ReachRow, changes: TripRouteChanges) => void
}) {
  const tr = useNearbyT()
  const saved = useSavedTrips()
  const [opening, setOpening] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  // A trip opened from another place's page: plan it here, now that this
  // page is at its start
  const arrived = useRef(false)
  useEffect(() => {
    if (arrived.current) return
    arrived.current = true
    let id: string | null = null
    try { id = sessionStorage.getItem(OPEN_KEY); sessionStorage.removeItem(OPEN_KEY) } catch { /* private mode */ }
    if (!id) return
    void loadSavedTrips().then(list => {
      const t = list.find(x => x.id === id)
      if (t) void open(t, true)
    })
  // Once, on arrival
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!saved || saved.length === 0) return null

  async function open(t: SavedTrip, here = false) {
    setFailed(false)
    const prefer = t.way === 'walk' ? undefined : t.way
    if (!here) {
      markTripOpened(t.id)
      posthog.capture('nearby_saved_trip_opened', { way: t.way, from_here: !t.from, changes: !!t.changes })
    }
    if (!here && t.from && haversineDist(t.from.lat, t.from.lng, center.lat, center.lng) > FAR_M) {
      const p = stickyParams(window.location.search)
      p.set('lat', String(round3(t.from.lat)))
      p.set('lng', String(round3(t.from.lng)))
      if (t.from.name) p.set('label', t.from.name)
      try { sessionStorage.setItem(OPEN_KEY, t.id) } catch { /* private mode: opens the place only */ }
      window.location.assign(`${NEARBY_PATH}?${p.toString()}`)
      return
    }
    setOpening(t.id)
    try {
      const row = await fetchTripRow(center, t.to, t.to.name)
      onPlanned(row, prefer)
      // A bike trip saved with changes rides the same way again (01787)
      if (t.way === 'bike' && t.changes && row.bike_polyline) onRestore?.(row, t.changes)
    } catch {
      setFailed(true)
    } finally {
      setOpening(null)
    }
  }

  return (
    <div className="mt-2.5">
      <div className="text-[13px] font-bold uppercase tracking-wider text-(--nb-ink-70)">{tr('saved.heading')}</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {saved.slice(0, 6).map(t => {
          const Icon = WAY_ICON[t.way]
          return (
            <button
              key={t.id}
              type="button"
              disabled={opening !== null}
              onClick={() => open(t)}
              aria-label={tr(`saved.open_${t.way}`, { place: t.label })}
              className="inline-flex min-h-[36px] max-w-full items-center gap-1.5 rounded-full border border-(--nb-accent-line) px-3 py-1 text-[0.8125rem] font-semibold text-(--nb-ink) hover:bg-(--nb-accent-tint) disabled:opacity-60"
            >
              <Icon size={15} weight="bold" aria-hidden="true" className="shrink-0 text-(--nb-accent)" />
              <span className="truncate">{opening === t.id ? tr('trip.working') : t.label}</span>
            </button>
          )
        })}
      </div>
      {failed && <p className="mt-1.5 text-[14px] text-(--nb-ink-80)" role="status">{tr('trip.error')}</p>}
    </div>
  )
}
