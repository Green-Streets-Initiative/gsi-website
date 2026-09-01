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
export function useReachOverlay({ selection, reachRows, corridorLines, markers, highlightedCorridorId, bikeAlt = false }: {
  selection: Selection
  reachRows: ReachRow[]
  corridorLines: GeoJSON.FeatureCollection
  markers: NearbyMarker[]
  highlightedCorridorId: string | null
  /** The visitor picked the quicker route over the calm one. */
  bikeAlt?: boolean
}) {
  const reachRow = selection?.type === 'reach'
    ? reachRows.find(r => r.id === selection.id)
    : undefined

  const lines = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!reachRow || selection?.type !== 'reach') return corridorLines
    // Both bike routes draw. The one not chosen goes under a sibling corridor
    // id, which the map already renders faint — so the road not taken is
    // visible as a shape without competing with the one being described.
    const showsAlt = selection.mode === 'bike' && !!reachRow.bike_alt
    return {
      type: 'FeatureCollection',
      features: [
        ...corridorLines.features,
        ...(showsAlt
          ? reachRouteFeatures(reachRow, selection.mode, `reach:${reachRow.id}:other`, !bikeAlt)
          : []),
        ...reachRouteFeatures(reachRow, selection.mode, `reach:${reachRow.id}`, bikeAlt),
      ],
    }
  }, [corridorLines, reachRow, selection, bikeAlt])

  const overlayMarkers = useMemo<NearbyMarker[]>(() => (
    reachRow
      ? [...markers, { id: `reachdest-${reachRow.id}`, lat: reachRow.lat, lng: reachRow.lng, html: destinationPinHtml(reachRow.name), zIndex: 5 }]
      : markers
  ), [markers, reachRow])

  const highlight = selection?.type === 'reach' ? `reach:${selection.id}` : highlightedCorridorId

  return { reachRow, lines, markers: overlayMarkers, highlight }
}
