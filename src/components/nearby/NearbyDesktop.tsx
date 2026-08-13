'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import posthog from 'posthog-js'
import type { BluebikeStationLive, MBTAStopLive } from '@/lib/wayfinding/types'
import type { TransitCorridor, BikeCorridor } from '@/lib/nearby/corridors'
import type { SectionData, SectionStatus, CommunityData, GuideItem, ReachRow } from './types'
import NearbyMap from './NearbyMap'
import {
  useNearbyModel, MODE_FILTER_DEFAULT, PAINTED_DEFAULT,
  type ModeFilter, type Selection,
} from './useNearbyModel'
import { useReachOverlay } from './useReachOverlay'
import { DetailContent } from './DetailPanel'
import ModeFilterChips from './ModeFilterChips'
import { StationList, BikeRouteList, DockList } from './AroundYouLists'
import { ReachList } from './ReachSection'
import { ExploreBody } from './ExploreBody'
import GuideLinks from './GuideLinks'
import { SkeletonRows, ErrorCard } from './SectionShell'

/**
 * The desktop (≥ lg) experience: a two-pane app layout. The map is a sticky
 * left pane that never scrolls away — everything tapped (map or lists) shows
 * its detail pinned right under the map — and the content rail on the right
 * scrolls past it: stations, bike routes, docks, destinations, events.
 * Destination rows expand in place and draw their route on the SAME map
 * (no nested mini-maps). Below lg, NearbyShell renders the app shell
 * instead; both consume the same model + overlay hooks.
 */

interface Props {
  center: { lat: number; lng: number }
  displayLabel: string
  outside: boolean
  copied: boolean
  onCopyLink: () => void
  onChangeLocation: () => void
  onAdvisorCta: () => void
  partnerLine: string
  transitCorridors: TransitCorridor[]
  bikeCorridors: BikeCorridor[]
  rail: MBTAStopLive[]
  bus: MBTAStopLive[]
  docks: BluebikeStationLive[]
  backgroundLines: GeoJSON.FeatureCollection | null
  transitStatus: SectionStatus
  reach: SectionData<ReachRow[]>
  community: SectionData<CommunityData | null>
  guides: SectionData<GuideItem[]>
  onRetry: () => void
}

export default function NearbyDesktop({
  center, displayLabel, outside, copied, onCopyLink, onChangeLocation,
  onAdvisorCta, partnerLine,
  transitCorridors, bikeCorridors, rail, bus, docks,
  backgroundLines, transitStatus, reach, community, guides, onRetry,
}: Props) {
  const [modeFilter, setModeFilter] = useState<ModeFilter>(MODE_FILTER_DEFAULT)
  const [paintedOn, setPaintedOn] = useState(PAINTED_DEFAULT)

  const model = useNearbyModel({
    center, transitCorridors, bikeCorridors, rail, bus, docks,
    modeFilter, paintedVisible: paintedOn,
  })
  const {
    selection, select, handleMarkerTap,
    corridorById, stations, stationByKey,
    corridorLines, highlightedCorridorId, markers, accessPoints,
    showRail, showBus, showBike,
  } = model

  // Reach routes draw on the main map, same as the mobile shell
  const overlay = useReachOverlay({
    selection, reachRows: reach.data, corridorLines, markers, highlightedCorridorId,
  })

  // A list tap can target a painted corridor while painted lanes are hidden —
  // bring them back so the selection actually draws
  const selectShowing = useCallback((next: Selection, source: string) => {
    if (next?.type === 'corridor') {
      const c = corridorById.get(next.id)
      if (c?.kind === 'bike' && c.protection === 'painted' && !paintedOn) setPaintedOn(true)
    }
    select(next, source)
  }, [corridorById, paintedOn, select])

  // Destination rows are controlled by the page selection: single-slot, so
  // opening a route replaces a corridor selection and vice versa
  const routeSelection = selection?.type === 'reach'
    ? { id: selection.id, mode: selection.mode }
    : null
  const onRouteSelect = useCallback((sel: { id: string; mode: 'transit' | 'bike' } | null) => {
    if (!sel) {
      select(null, 'row-collapse')
      return
    }
    select({ type: 'reach', id: sel.id, mode: sel.mode }, 'list')
    posthog.capture('reach_route_viewed', { destination: sel.id, mode: sel.mode })
  }, [select])

  return (
    <div className="pb-20">
      {/* Compact header — the h1 stays for SEO/a11y; actions live in the bar */}
      <div className="mx-auto max-w-[1200px] px-6 pb-4 pt-6 lg:px-8">
        <div className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#BAF14D]">
          Your neighborhood snapshot
        </div>
        <h1 className="mt-1 truncate font-display text-[1.35rem] font-extrabold tracking-tight text-white">
          {displayLabel}
        </h1>
        {outside && (
          <p className="mt-3 rounded-xl border border-[#EDB93C]/30 bg-[#EDB93C]/10 px-5 py-3.5 text-[0.875rem] leading-relaxed text-white">
            This spot looks like it&apos;s outside Greater Boston, where our transit and Bluebikes data lives. Bike-path data covers all of Massachusetts, so parts of the picture may still fill in.
          </p>
        )}
      </div>

      {/* Sticky top bar. The FIXED h-[52px] single row is load-bearing: the
          map pane below assumes 60px nav + 52px bar + 16px gap (top-[128px] /
          calc(100vh-144px)). Overflow scrolls horizontally — never wrap. */}
      <div className="sticky top-[60px] z-20 border-b border-white/[0.12] bg-[#191A2E]/95 backdrop-blur">
        <div className="relative mx-auto max-w-[1200px]">
          <div className="flex h-[52px] items-center gap-3 overflow-x-auto whitespace-nowrap px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="min-w-0 shrink truncate text-[0.85rem] font-bold text-white">{displayLabel}</span>
            <button
              onClick={onCopyLink}
              className="shrink-0 rounded-lg border border-white/[0.15] px-3 py-1.5 text-[0.78rem] font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              {copied ? 'Copied ✓' : 'Copy link'}
            </button>
            <button
              onClick={onChangeLocation}
              className="shrink-0 rounded-lg border border-white/[0.15] px-3 py-1.5 text-[0.78rem] font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              Change location
            </button>
            <div className="ml-auto shrink-0 pl-2">
              <ModeFilterChips
                mode={modeFilter}
                onMode={setModeFilter}
                painted={paintedOn}
                onPaintedToggle={() => setPaintedOn(p => !p)}
              />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#191A2E] to-transparent" />
        </div>
      </div>

      {/* Two panes: sticky map left, scrolling content rail right */}
      <div className="mx-auto mt-5 max-w-[1200px] px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_480px]">

          {/* LEFT: the map pane. Viewport-derived height, so a short rail
              can't collapse it; detail pinned under the map stays fully
              visible without any page scroll. */}
          <div className="lg:sticky lg:top-[128px] lg:flex lg:h-[calc(100vh-144px)] lg:min-h-[420px] lg:flex-col lg:self-start">
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/[0.08]">
              <NearbyMap
                center={center}
                markers={overlay.markers}
                lines={backgroundLines}
                paintedVisible={showBike && paintedOn}
                separatedVisible={showBike}
                corridorLines={overlay.lines}
                selectedCorridorId={overlay.highlight}
                onCorridorSelect={(id, source) => {
                  if (id) select({ type: 'corridor', id }, source)
                  else select(null, source)
                }}
                onMarkerTap={handleMarkerTap}
                onLaneTap={(info) => select({ type: 'lane', info }, 'map')}
                fitCount={7}
                extraFitPoints={accessPoints}
                heightClass="h-full"
              />
            </div>

            {/* Detail panel — everything tapped lands HERE, pinned under the
                map, never down the page. (Reach selections render in their
                own row expansion in the rail instead.) */}
            {selection && selection.type !== 'reach' && (
              <div className="mt-2.5 max-h-[40%] shrink-0 overflow-y-auto rounded-xl border border-[rgba(186,241,77,0.25)] bg-[#242538] px-4 py-3.5">
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
          </div>

          {/* RIGHT: the content rail */}
          <div className="min-w-0">
            {(showRail || showBus) && (
              <>
                <StationList
                  stations={stations}
                  corridorById={corridorById}
                  highlightedCorridorId={highlightedCorridorId}
                  status={transitStatus}
                  onRetry={onRetry}
                  onSelectRoute={(id) => selectShowing({ type: 'corridor', id }, 'list')}
                />
                <GuideLinks context="stations" guides={guides.data} modeFilter={modeFilter} />
              </>
            )}

            {showBike && (
              <>
                <BikeRouteList
                  bikeCorridors={bikeCorridors}
                  highlightedCorridorId={highlightedCorridorId}
                  onSelect={(id) => selectShowing({ type: 'corridor', id }, 'list')}
                />
                <GuideLinks context="bike" guides={guides.data} modeFilter={modeFilter} />
                <DockList docks={docks} />
                <GuideLinks context="docks" guides={guides.data} modeFilter={modeFilter} />
              </>
            )}

            {/* Destinations — rows expand in place, route draws on the map */}
            <h2 className="mb-1 mt-8 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
              Where can you get from here?
            </h2>
            <p className="mb-3 text-[0.8rem] leading-snug text-white/75">
              Popular destinations — tap a place to see the route on the map.
            </p>
            {reach.status === 'loading' && <SkeletonRows count={4} />}
            {reach.status === 'error' && <ErrorCard label="Couldn't compute travel times right now." onRetry={onRetry} />}
            {reach.status === 'ready' && reach.data.length > 0 && (
              <ReachList
                center={center}
                rows={reach.data}
                modeFilter={modeFilter}
                routeSelection={routeSelection}
                onRouteSelect={onRouteSelect}
              />
            )}
            {reach.status === 'ready' && reach.data.length === 0 && (
              <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-[0.875rem] text-white/75">
                No destination times for this spot yet.
              </p>
            )}

            {/* Events + Roams (each block carries its own compact label) */}
            <div className="mt-8">
              <ExploreBody community={community} compact />
            </div>

            {/* CTA bridge — compact cards, same as the mobile explore tab */}
            <div className="mt-8 space-y-3">
              <div className="rounded-xl border border-[rgba(186,241,77,0.18)] bg-[linear-gradient(135deg,rgba(41,102,229,0.15),rgba(186,241,77,0.08))] px-4 py-3.5">
                <div className="text-[0.9rem] font-bold text-white">Have a destination in mind?</div>
                <p className="mt-0.5 text-[0.8rem] leading-snug text-white/80">
                  The Commute Advisor compares every way to get there — time, cost, and health — with your home already filled in.
                </p>
                <Link
                  href="/commute-advisor"
                  onClick={onAdvisorCta}
                  className="mt-2 inline-block rounded-lg bg-[#BAF14D] px-3.5 py-1.5 text-[0.78rem] font-bold text-[#191A2E] transition-opacity hover:opacity-85"
                >
                  Compare your options →
                </Link>
              </div>
              <div className="rounded-xl border border-white/[0.1] bg-[#242538] px-4 py-3.5">
                <div className="text-[0.9rem] font-bold text-white">Get the Shift app</div>
                <p className="mt-0.5 text-[0.8rem] leading-snug text-white/80">{partnerLine}</p>
                <a
                  href="/shift"
                  onClick={() => posthog.capture('snapshot_app_cta_clicked')}
                  className="mt-2 inline-block rounded-lg border border-[#BAF14D] px-3.5 py-1.5 text-[0.78rem] font-bold text-[#BAF14D] transition-colors hover:bg-[#BAF14D] hover:text-[#191A2E]"
                >
                  Download the app →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
