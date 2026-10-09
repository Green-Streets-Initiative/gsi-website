'use client'

import { useMemo } from 'react'
import { reachRouteFeatures } from '@/lib/nearby/route-lines'
import { bluebikeHtml, destinationPinHtml } from './markers'
import type { NearbyMarker } from './NearbyMap'
import type { Selection } from './useNearbyModel'
import type { ReachRow } from './types'

/**
 * Reach routes draw on the page's MAIN map (no nested mini-maps): when the
 * selection is a reach destination, append its route legs to the corridor
 * lines, add the destination flag pin, and switch the map highlight to the
 * reach feature id. Shared by the mobile shell and the desktop two-pane so
 * both surfaces draw destination routes identically.
 *
 * On a bike route it also adds the bike-share dock nearest the destination,
 * lit and tappable: the ride often ends at one (the dock nearest the start is
 * already among the page's docks; useNearbyModel keeps that one lit).
 */
export function useReachOverlay({ selection, reachRows, corridorLines, markers, highlightedCorridorId, bikeAlt = false, dockSelectedId = null, openDocksLabel }: {
  /** The route to draw: the open destination, or the one behind a dock card
   *  opened from it (useNearbyModel's routeSelection). */
  selection: Selection
  reachRows: ReachRow[]
  corridorLines: GeoJSON.FeatureCollection
  markers: NearbyMarker[]
  highlightedCorridorId: string | null
  /** The visitor picked the quicker route over the calm one. */
  bikeAlt?: boolean
  /** The dock whose card is open, so its pin wears the selected ring. */
  dockSelectedId?: string | null
  /** "{count} open docks" in the page's language, for the far-end dock's pin. */
  openDocksLabel?: (count: number) => string
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

  const destDock = selection?.type === 'reach' && selection.mode === 'bike'
    ? reachRow?.dest_docks?.[0]
    : undefined

  const overlayMarkers = useMemo<NearbyMarker[]>(() => {
    if (!reachRow) return markers
    const out = [...markers, { id: `reachdest-${reachRow.id}`, lat: reachRow.lat, lng: reachRow.lng, html: destinationPinHtml(reachRow.name), zIndex: 5 }]
    // Skipped when the page already shows it (a short trip inside the
    // start's dock radius) — the model keeps that copy.
    if (destDock && !markers.some(m => m.id === `dock-${destDock.station_id}`)) {
      out.push({
        id: `dock-${destDock.station_id}`,
        lat: destDock.lat,
        lng: destDock.lng,
        html: bluebikeHtml(
          destDock.num_bikes_available,
          destDock.num_ebikes_available,
          destDock.name,
          dockSelectedId === destDock.station_id,
          openDocksLabel
            ? { count: destDock.num_docks_available, label: openDocksLabel(destDock.num_docks_available) }
            : undefined,
        ),
        tappable: true,
        analyticsType: 'bluebike',
        // Over the flag, or the flag swallows the tap at city zoom (the
        // place's name pill still shows beneath)
        zIndex: 6,
      })
    }
    return out
  }, [markers, reachRow, destDock, dockSelectedId, openDocksLabel])

  const highlight = selection?.type === 'reach' ? `reach:${selection.id}` : highlightedCorridorId

  return { reachRow, lines, markers: overlayMarkers, highlight }
}
