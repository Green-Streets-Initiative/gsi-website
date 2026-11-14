'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReachRow } from './types'
import type { Selection } from './useNearbyModel'
import { defaultRouteMode } from '@/lib/nearby/reach-ui'
import type { InitialFocus } from '@/lib/nearby/focus'

/** Fires the selection once, as soon as the thing it points at has loaded
 *  (each family arrives on its own fetch). A target that never shows up —
 *  a stale id, a station outside today's radius — simply does nothing. */
export function useInitialFocus(
  focus: InitialFocus | null,
  deps: {
    corridorById: Map<string, unknown>
    stationByKey: Map<string, unknown>
    docks: { station_id: string }[]
    reachRows: ReachRow[]
    select: (next: Selection, source: string) => void
    /** Make sure the list section holding the target is expanded. */
    isSectionOpen: (key: string) => boolean
    toggleSection: (key: string) => void
    /** Destinations live on their own tab; a route link has to show it. */
    showDestinations: () => void
    /** The page's current selection, so a link re-applies if the page's own
     *  data loads clear it (see below) but never after the visitor closes it. */
    selection: Selection
  },
) {
  // The bike network loads twice (1.5 mi, then 3 mi) and the second load can
  // re-tier or rename the corridor a link pointed at, which clears the
  // selection as orphaned. So: apply once, and re-apply only when the
  // corridor map itself changed underneath an open selection, within a
  // short settle window — a visitor's own ✕ never reopens it.
  const applied = useRef<{ at: number; count: number } | null>(null)
  const prevCorridors = useRef<Map<string, unknown> | null>(null)
  const { corridorById, stationByKey, docks, reachRows, select, isSectionOpen, toggleSection, showDestinations, selection } = deps
  useEffect(() => {
    if (!focus) return
    const corridorsChanged = prevCorridors.current !== corridorById
    prevCorridors.current = corridorById
    if (applied.current) {
      if (selection !== null || !corridorsChanged) return
      if (Date.now() - applied.current.at > 20_000 || applied.current.count >= 3) return
    }
    let next: Selection = null
    switch (focus.type) {
      case 'station':
        if (stationByKey.has(focus.key)) next = { type: 'station', key: focus.key }
        break
      case 'corridor': {
        // A bike corridor's id is its name; the live page may know the same
        // path under a longer or shorter name than the linking page did
        // ("harborwalk" vs "boston-harborwalk"), so fall back to the family.
        let id: string | null = corridorById.has(focus.id) ? focus.id : null
        if (!id && focus.id.startsWith('bike:')) {
          const want = focus.id.slice(5).replace(/-/g, '')
          for (const k of corridorById.keys()) {
            if (!k.startsWith('bike:')) continue
            const have = k.slice(5).replace(/-/g, '')
            if (have.includes(want) || want.includes(have)) { id = k; break }
          }
        }
        if (id) next = { type: 'corridor', id }
        break
      }
      case 'dock':
        if (docks.some(d => d.station_id === focus.id)) {
          next = { type: 'dock', id: focus.id }
          if (!isSectionOpen('docks')) toggleSection('docks')
        }
        break
      case 'reach': {
        const row = reachRows.find(r => r.id === focus.id)
        if (row) {
          next = { type: 'reach', id: row.id, mode: focus.mode ?? defaultRouteMode(row) }
          showDestinations()
        }
        break
      }
    }
    if (!next) return
    applied.current = { at: applied.current?.at ?? Date.now(), count: (applied.current?.count ?? 0) + 1 }
    select(next, 'deeplink')
  }, [focus, corridorById, stationByKey, docks, reachRows, select, isSectionOpen, toggleSection, showDestinations, selection])
}

/** What is open on the page: the selection and the trips the visitor typed. */
export type OpenOnPage = { center: { lat: number; lng: number }; selection: Selection; planned: ReachRow[] }
export type OpenHandoff = { report: (open: OpenOnPage) => void; take: () => OpenOnPage | null }

function focusOf(s: Selection): InitialFocus | null {
  switch (s?.type) {
    case 'station': return { type: 'station', key: s.key }
    case 'corridor': return { type: 'corridor', id: s.id }
    case 'dock': return { type: 'dock', id: s.id }
    case 'reach': return { type: 'reach', id: s.id, mode: s.mode }
    default: return null
  }
}

/**
 * The page swaps its desktop and phone layouts at 1024px, and each keeps its
 * own state, so narrowing the window closed the open trip and dropped the
 * trips the visitor had typed (2026-11-13). The layout in use reports what
 * is open; the next one starts from it, at the same place only. Returns the
 * typed trips to start with and the focus to open.
 */
export function useOpenHandoff(
  handoff: OpenHandoff | undefined,
  center: { lat: number; lng: number },
): { planned: ReachRow[]; focus: InitialFocus | null } {
  const [carried] = useState(() => {
    const c = handoff?.take() ?? null
    return c && c.center.lat === center.lat && c.center.lng === center.lng ? c : null
  })
  return useMemo(() => ({ planned: carried?.planned ?? [], focus: carried ? focusOf(carried.selection) : null }), [carried])
}

/** Tell the page what this layout has open. */
export function useReportOpen(
  handoff: OpenHandoff | undefined,
  center: { lat: number; lng: number },
  selection: Selection,
  planned: ReachRow[],
) {
  useEffect(() => { handoff?.report({ center, selection, planned }) }, [handoff, center, selection, planned])
}
