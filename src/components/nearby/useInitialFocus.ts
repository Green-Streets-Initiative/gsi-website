'use client'

import { useEffect, useRef } from 'react'
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
          next = { type: 'reach', id: row.id, mode: defaultRouteMode(row) }
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
