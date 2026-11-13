'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MapPin, MapPinPlus, X } from '@phosphor-icons/react'
import posthog from 'posthog-js'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { useNearbyT } from './NearbyI18n'
import { useNearbyTone } from './NearbyTone'
import type { NearbyMarker } from './NearbyMap'
import type { ReachRow } from './types'
import type { ThroughResult, Through } from './useAvoidStreets'

/**
 * "Go through a place" on a bike trip (Around You v2; the app's
 * GoThroughPlace, parity gap-through-web, Keith 2026-11-13). "Go a different
 * way" opens a search for a street or place; while it's open, a tap on the
 * map picks the spot. Picking doesn't re-plan yet: it asks "Go through X?"
 * first, then re-plans (useAvoidStreets.goThrough), still avoiding every
 * street avoided so far. The ride goes past the place; it isn't a stop. When
 * it works, the line at the top of the trip says "Going through X", with Undo.
 */

type Pending = { rowId: string; lat: number; lng: number; label: string | null; via: 'tap' | 'search' }
type Note = { rowId: string; kind: 'busy' | 'none' | 'failed'; place: string }

export type GoThroughProps = {
  /** The search is showing, and a map tap picks a place. */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A place picked and waiting for "Go through" (label null = not named). */
  pending: { label: string | null } | null
  /** Finding the route, or why there isn't one. */
  note: { kind: Note['kind']; place: string } | null
  onPick: (place: { lat: number; lng: number; name: string }) => void
  onConfirm: () => void
  onCancel: () => void
  onDismissNote: () => void
  /** A re-plan is running: nothing new can be asked. */
  disabled: boolean
}

/**
 * The state behind the control, kept by the page so a tap on its map can
 * pick the spot. `activeRowId` is the bike trip open now; anything asked
 * about one trip is dropped when another opens.
 */
export function useGoThrough({ activeRowId, goThrough, onChanged }: {
  activeRowId: string | null
  goThrough: (row: ReachRow, shownMinutes: number, place: Through, via: 'tap' | 'search') => Promise<ThroughResult>
  /** The route changed: the lit street and the calm/quick choice belonged to the old one. */
  onChanged: () => void
}) {
  const tr = useNearbyT()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [note, setNote] = useState<Note | null>(null)

  useEffect(() => {
    setOpen(false)
    setPending(null)
    setNote(null)
  }, [activeRowId])

  const propose = useCallback((lat: number, lng: number, via: Pending['via'], label: string | null) => {
    if (!activeRowId) return
    setNote(null)
    setPending({ rowId: activeRowId, lat, lng, label, via })
  }, [activeRowId])

  /** For the map: a tap picks the spot while the search is open. */
  const onMapPick = open && activeRowId
    ? (p: { lat: number; lng: number; name: string | null }) => propose(p.lat, p.lng, 'tap', p.name)
    : undefined

  const propsFor = useCallback((row: ReachRow, shownMinutes: number, busy: boolean): GoThroughProps => ({
    open,
    onOpenChange: (next: boolean) => {
      setOpen(next)
      if (!next) setPending(null)
      if (next) {
        setNote(null)
        posthog.capture('nearby_through_open', { destination: row.id })
      }
    },
    pending: pending?.rowId === row.id ? { label: pending.label } : null,
    note: note?.rowId === row.id ? { kind: note.kind, place: note.place } : null,
    onPick: (place) => propose(place.lat, place.lng, 'search', place.name),
    onConfirm: () => {
      const p = pending
      if (!p || p.rowId !== row.id) return
      setPending(null)
      setOpen(false)
      const place = p.label ?? tr('v2.through_this_spot')
      setNote({ rowId: row.id, kind: 'busy', place })
      void goThrough(row, shownMinutes, { lat: p.lat, lng: p.lng, label: place }, p.via).then(result => {
        // Done: the line at the top of the trip says so, with Undo
        setNote(n => (n?.rowId === row.id ? (result === 'ok' ? null : { ...n, kind: result }) : n))
        if (result === 'ok') onChanged()
      })
    },
    onCancel: () => setPending(null),
    onDismissNote: () => setNote(null),
    disabled: busy,
  }), [open, pending, note, propose, goThrough, onChanged, tr])

  return {
    propsFor,
    onMapPick,
    /** The spot being asked about, for the map pin. */
    pendingSpot: pending && pending.rowId === activeRowId ? { lat: pending.lat, lng: pending.lng } : null,
    /** A place picked from the search, for the map to pan to. */
    searchSpot: pending && pending.rowId === activeRowId && pending.via === 'search' ? { lat: pending.lat, lng: pending.lng } : null,
  }
}

/** The pin for the place a bike trip goes through (or the spot being asked about). */
export function throughSpotMarker(spot: { lat: number; lng: number }): NearbyMarker {
  return {
    id: 'through-place',
    lat: spot.lat,
    lng: spot.lng,
    html: '<div style="width:18px;height:18px;border-radius:50%;background:#191A2E;border:4px solid #BAF14D;box-shadow:0 1px 6px rgba(0,0,0,0.45)"></div>',
    zIndex: 40,
    noFit: true,
  }
}

export default function GoThroughPlace({ open, onOpenChange, pending, note, onPick, onConfirm, onCancel, onDismissNote, disabled }: GoThroughProps) {
  const tr = useNearbyT()
  const tone = useNearbyTone()
  const [query, setQuery] = useState('')
  // Nothing matched what's typed: say so, and point at the map
  const [noMatches, setNoMatches] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // A spot picked on the map, or the answer, may land below the fold
  const showing = pending ? 'pending' : note ? `note:${note.kind}` : null
  useEffect(() => {
    if (showing) boxRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [showing])
  useEffect(() => {
    if (!open) {
      setQuery('')
      setNoMatches(false)
    }
  }, [open])

  const closeBtn = (onClick: () => void) => (
    <button
      onClick={onClick}
      aria-label={tr('v2.through_close')}
      className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center text-(--nb-ink-80) hover:text-(--nb-ink)"
    >
      <X size={18} />
    </button>
  )
  const card = 'mt-3 scroll-mt-4 rounded-xl border border-(--nb-accent-line) bg-(--nb-panel) px-4 py-3'

  if (pending) {
    return (
      <div ref={boxRef} className={card}>
        <p className="text-[15px] font-bold leading-snug text-(--nb-ink)">
          {tr('v2.through_confirm', { place: pending.label ?? tr('v2.through_this_spot') })}
        </p>
        <p className="mt-1 text-[14px] leading-snug text-(--nb-ink-80)">{tr('v2.through_confirm_body')}</p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-xl border border-(--nb-line-mid) px-3 text-[15px] font-semibold text-(--nb-ink-80) hover:border-(--nb-line-strong) hover:text-(--nb-ink)"
          >
            {tr('v2.through_cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={disabled}
            className="min-h-[44px] flex-1 rounded-xl bg-(--nb-accent-fill) px-3 text-[15px] font-bold text-(--nb-on-accent-fill) transition-opacity hover:opacity-85 disabled:opacity-70"
          >
            {tr('v2.through_go')}
          </button>
        </div>
      </div>
    )
  }

  if (note) {
    return (
      <div ref={boxRef} className={card} role="status">
        {note.kind === 'busy' ? (
          <p className="text-[15px] font-semibold leading-snug text-(--nb-ink)">{tr('v2.through_finding', { place: note.place })}</p>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[15px] font-bold leading-snug text-(--nb-ink)">
                {note.kind === 'none' ? tr('v2.through_none', { place: note.place }) : tr('v2.avoid_failed')}
              </p>
              {note.kind === 'none' && (
                <p className="mt-1 text-[14px] leading-snug text-(--nb-ink-80)">{tr('v2.through_none_body')}</p>
              )}
            </div>
            {closeBtn(onDismissNote)}
          </div>
        )}
      </div>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => onOpenChange(true)}
        disabled={disabled}
        aria-expanded={false}
        className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-(--nb-line-mid) px-4 py-2 text-[15px] font-semibold text-(--nb-ink) transition-colors hover:border-(--nb-line-strong) hover:bg-(--nb-panel) disabled:opacity-70"
      >
        <MapPinPlus size={18} weight="bold" className="text-(--nb-accent)" aria-hidden="true" />
        {tr('v2.trip_different_way')}
      </button>
    )
  }

  return (
    <>
      <div ref={boxRef} className={card}>
        <div className="flex items-start justify-between gap-2">
          <p className="pt-1 text-[15px] font-bold leading-snug text-(--nb-ink)">{tr('v2.through_open')}</p>
          {closeBtn(() => onOpenChange(false))}
        </div>
        <div className="mt-2">
          <AddressAutocomplete
            value={query}
            onChange={(q) => {
              setQuery(q)
              if (q.trim().length < 3) setNoMatches(false)
            }}
            onResults={(count) => setNoMatches(count === 0)}
            onPlaceSelected={(p) => onPick({ lat: p.lat, lng: p.lng, name: p.address.split(',')[0].trim() || p.address })}
            variant={tone === 'dark' ? 'dark' : 'light'}
            label={null}
            placeholder={tr('v2.through_search')}
            includeAreas
          />
        </div>
        {noMatches && (
          <p className="mt-2 text-[14px] leading-snug text-(--nb-ink-80)" role="status">{tr('v2.through_search_none')}</p>
        )}
        <p className="mt-3 flex items-center gap-2 text-[14px] leading-snug text-(--nb-ink-80)">
          <MapPin size={16} className="shrink-0" aria-hidden="true" />
          {tr('v2.through_or_tap')}
        </p>
      </div>
      <p className="mt-2 text-[14px] leading-snug text-(--nb-ink-80)">{tr('v2.trip_avoid_hint')}</p>
    </>
  )
}
