'use client'

import { useCallback } from 'react'
import type { BluebikeStationLive, MBTAStopLive } from '@/lib/wayfinding/types'
import type { TransitCorridor, BikeCorridor } from '@/lib/nearby/corridors'
import NearbyMap from './NearbyMap'
import type { SectionStatus } from './types'
import { useNearbyModel, type ModeFilter, type Selection } from './useNearbyModel'
import { DetailContent } from './DetailPanel'
import { StationList, BikeRouteList, DockList } from './AroundYouLists'

interface Props {
  center: { lat: number; lng: number }
  transitCorridors: TransitCorridor[]
  bikeCorridors: BikeCorridor[]
  rail: MBTAStopLive[]
  bus: MBTAStopLive[]
  docks: BluebikeStationLive[]
  /** Unnamed bike-lane features only (named ones render as corridors) */
  backgroundLines: GeoJSON.FeatureCollection | null
  transitStatus: SectionStatus
  onRetry: () => void
  /** Page-wide mode filter, owned by the page (the chips render above) */
  modeFilter: ModeFilter
  paintedVisible: boolean
  /** A list tap on a painted corridor while painted lanes are hidden */
  onShowPainted: () => void
}

/**
 * The desktop/tablet column: one map with a detail panel pinned directly
 * under it. Everything tapped shows up in that ONE place — no popups (they
 * clip and trap scroll), no scrolling the page to some distant card. The
 * lists below are for browsing; they highlight the map, never the other
 * way around. (On phones the same model renders as the app shell instead.)
 */
export default function CorridorExplorer({
  center, transitCorridors, bikeCorridors, rail, bus, docks,
  backgroundLines, transitStatus, onRetry,
  modeFilter, paintedVisible, onShowPainted,
}: Props) {
  const model = useNearbyModel({
    center, transitCorridors, bikeCorridors, rail, bus, docks,
    modeFilter, paintedVisible,
  })
  const {
    selection, select, handleMarkerTap,
    corridorById, stations, stationByKey,
    corridorLines, highlightedCorridorId, markers, accessPoints,
    showRail, showBus, showBike,
  } = model

  // A list tap can target a painted corridor while painted lanes are hidden —
  // bring them back so the selection actually draws
  const selectShowing = useCallback((next: Selection, source: string) => {
    if (next?.type === 'corridor') {
      const c = corridorById.get(next.id)
      if (c?.kind === 'bike' && c.protection === 'painted' && !paintedVisible) onShowPainted()
    }
    select(next, source)
  }, [corridorById, paintedVisible, onShowPainted, select])

  return (
    <div>
      <NearbyMap
        center={center}
        markers={markers}
        lines={backgroundLines}
        paintedVisible={showBike && paintedVisible}
        separatedVisible={showBike}
        corridorLines={corridorLines}
        selectedCorridorId={highlightedCorridorId}
        onCorridorSelect={(id, source) => {
          if (id) select({ type: 'corridor', id }, source)
          else select(null, source)
        }}
        onMarkerTap={handleMarkerTap}
        onLaneTap={(info) => select({ type: 'lane', info }, 'map')}
        fitCount={7}
        extraFitPoints={accessPoints}
        heightClass="h-[360px] sm:h-[420px]"
      />

      {/* Detail panel — everything tapped on the map lands HERE, right under
          your thumb, never down the page */}
      {selection && (
        <div className="mt-2.5 rounded-xl border border-[rgba(186,241,77,0.25)] bg-[#242538] px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DetailContent
                selection={selection}
                stationByKey={stationByKey}
                corridorById={corridorById}
                docks={docks}
                onSelectCorridor={(id) => selectShowing({ type: 'corridor', id }, 'panel')}
              />
            </div>
            <button
              onClick={() => select(null, 'panel-close')}
              aria-label="Close details"
              className="shrink-0 rounded-lg border border-white/[0.15] px-2.5 py-1 text-[0.9rem] font-bold text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Lists mirror the mode filter — a hidden mode's section goes with it */}
      {(showRail || showBus) && (
        <StationList
          stations={stations}
          corridorById={corridorById}
          highlightedCorridorId={highlightedCorridorId}
          status={transitStatus}
          onRetry={onRetry}
          onSelectRoute={(id) => selectShowing({ type: 'corridor', id }, 'list')}
        />
      )}

      {showBike && (
        <BikeRouteList
          bikeCorridors={bikeCorridors}
          highlightedCorridorId={highlightedCorridorId}
          onSelect={(id) => selectShowing({ type: 'corridor', id }, 'list')}
        />
      )}

      {showBike && <DockList docks={docks} />}
    </div>
  )
}
