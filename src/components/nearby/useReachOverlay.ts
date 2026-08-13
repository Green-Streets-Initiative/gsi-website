'use client'

import { useMemo } from 'react'
import { reachRouteFeatures } from '@/lib/nearby/route-lines'
import { destinationPinHtml } from './markers'
import type { NearbyMarker } from './NearbyMap'
import type { Selection } from './useNearbyModel'
import type { ReachRow } from './types'

/**
 * Reach routes draw on the page's MAIN map (no nested mini-maps): when the
 * selection is a reach destination, append its route legs to the corridor
 * lines, add the destination flag pin, and switch the map highlight to the
 * reach feature id. Shared by the mobile shell and the desktop two-pane so
 * both surfaces draw destination routes identically.
 */
export function useReachOverlay({ selection, reachRows, corridorLines, markers, highlightedCorridorId }: {
  selection: Selection
  reachRows: ReachRow[]
  corridorLines: GeoJSON.FeatureCollection
  markers: NearbyMarker[]
  highlightedCorridorId: string | null
}) {
  const reachRow = selection?.type === 'reach'
    ? reachRows.find(r => r.id === selection.id)
    : undefined

  const lines = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!reachRow || selection?.type !== 'reach') return corridorLines
    return {
      type: 'FeatureCollection',
      features: [
        ...corridorLines.features,
        ...reachRouteFeatures(reachRow, selection.mode, `reach:${reachRow.id}`),
      ],
    }
  }, [corridorLines, reachRow, selection])

  const overlayMarkers = useMemo<NearbyMarker[]>(() => (
    reachRow
      ? [...markers, { id: `reachdest-${reachRow.id}`, lat: reachRow.lat, lng: reachRow.lng, html: destinationPinHtml(reachRow.name), zIndex: 5 }]
      : markers
  ), [markers, reachRow])

  const highlight = selection?.type === 'reach' ? `reach:${selection.id}` : highlightedCorridorId

  return { reachRow, lines, markers: overlayMarkers, highlight }
}
