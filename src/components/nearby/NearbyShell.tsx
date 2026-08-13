'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import posthog from 'posthog-js'
import type { BluebikeStationLive, MBTAStopLive, SheetSnap } from '@/lib/wayfinding/types'
import type { TransitCorridor, BikeCorridor } from '@/lib/nearby/corridors'
import ModeIcon from '@/components/commute/ModeIcon'
import { reachRouteFeatures } from '@/lib/nearby/route-lines'
import { defaultRouteMode, reachModeFor } from '@/lib/nearby/reach-ui'
import { directionsUrl } from '@/lib/nearby/transit-ui'
import BikeComfortBlock from './BikeComfortBlock'
import type { SectionData, SectionStatus, CommunityData, GuideItem, ReachRow } from './types'
import NearbyMap, { type FitPadding, type NearbyMarker } from './NearbyMap'
import { destinationPinHtml } from './markers'
import NearbySheet from './NearbySheet'
import {
  useNearbyModel, MODE_FILTER_DEFAULT, PAINTED_DEFAULT,
  type ModeFilter, type Selection,
} from './useNearbyModel'
import { DetailContent } from './DetailPanel'
import ModeFilterChips from './ModeFilterChips'
import { StationList, BikeRouteList, DockList } from './AroundYouLists'
import { ReachList } from './ReachSection'
import { ExploreBody, GuidesBlock } from './EventsGuides'
import { SkeletonRows, ErrorCard } from './SectionShell'

/**
 * The phone experience: one screen, no page scroll. The map is the stage;
 * everything else lives in a draggable bottom sheet with three always-
 * visible tabs. Tapping anything — a marker, a line, a list row — shows its
 * details at the top of the sheet, right under your thumb, with the map
 * highlight in view above. (≥ lg renders the classic column instead.)
 */

type Tab = 'transit' | 'destinations' | 'explore'

const TABS: { id: Tab; label: string }[] = [
  { id: 'transit', label: 'Transit & bike' },
  { id: 'destinations', label: 'Destinations' },
  { id: 'explore', label: 'Explore nearby' },
]

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

export default function NearbyShell({
  center, displayLabel, outside, copied, onCopyLink, onChangeLocation,
  onAdvisorCta, partnerLine,
  transitCorridors, bikeCorridors, rail, bus, docks,
  backgroundLines, transitStatus, reach, community, guides, onRetry,
}: Props) {
  const [tab, setTab] = useState<Tab>('transit')
  const [snap, setSnap] = useState<SheetSnap>('half')
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

  // The screen is the app. The shell is position:fixed, so the page behind
  // can't scroll into view even on iOS Safari (which ignores overflow:hidden
  // scroll locks); these are belt-and-suspenders against rubber-banding.
  useEffect(() => {
    const html = document.documentElement
    const prevOverflow = html.style.overflow
    const prevOverscroll = html.style.overscrollBehavior
    html.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    return () => {
      html.style.overflow = prevOverflow
      html.style.overscrollBehavior = prevOverscroll
    }
  }, [])

  // Camera fits land in the window above the half sheet
  const shellRef = useRef<HTMLDivElement>(null)
  const [shellH, setShellH] = useState(0)
  useEffect(() => {
    const el = shellRef.current
    if (!el) return
    const measure = () => setShellH(el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const fitPadding = useMemo<FitPadding | undefined>(
    () => (shellH ? { top: 96, bottom: Math.round(shellH * 0.45) + 24, left: 40, right: 40 } : undefined),
    [shellH]
  )

  // Any new selection reveals the sheet at half — detail under the thumb,
  // map highlight in view above
  const selectReveal = useCallback((next: Selection, source: string) => {
    select(next, source)
    if (next) setSnap('half')
  }, [select])

  const markerTapReveal = useCallback((id: string) => {
    handleMarkerTap(id)
    setSnap('half')
  }, [handleMarkerTap])

  // A list tap can target a painted corridor while painted lanes are hidden —
  // bring them back so the selection actually draws
  const selectShowing = useCallback((next: Selection, source: string) => {
    if (next?.type === 'corridor') {
      const c = corridorById.get(next.id)
      if (c?.kind === 'bike' && c.protection === 'painted' && !paintedOn) setPaintedOn(true)
    }
    selectReveal(next, source)
  }, [corridorById, paintedOn, selectReveal])

  // ── Reach routes draw on the MAIN map (no nested mini-map in the sheet) ──
  const reachRow = selection?.type === 'reach'
    ? reach.data.find(r => r.id === selection.id)
    : undefined

  const shellCorridorLines = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!reachRow || selection?.type !== 'reach') return corridorLines
    return {
      type: 'FeatureCollection',
      features: [
        ...corridorLines.features,
        ...reachRouteFeatures(reachRow, selection.mode, `reach:${reachRow.id}`),
      ],
    }
  }, [corridorLines, reachRow, selection])

  const shellMarkers = useMemo<NearbyMarker[]>(() => (
    reachRow
      ? [...markers, { id: `reachdest-${reachRow.id}`, lat: reachRow.lat, lng: reachRow.lng, html: destinationPinHtml(reachRow.name), zIndex: 5 }]
      : markers
  ), [markers, reachRow])

  const effectiveHighlight = selection?.type === 'reach' ? `reach:${selection.id}` : highlightedCorridorId

  const selectReach = useCallback((row: ReachRow, mode: 'transit' | 'bike', source: string) => {
    selectReveal({ type: 'reach', id: row.id, mode }, source)
    posthog.capture('reach_route_viewed', { destination: row.id, mode })
  }, [selectReveal])

  const changeTab = useCallback((next: Tab) => {
    setTab(next)
    if (selection) select(null, 'tab-change')
    setSnap(s => (s === 'peek' ? 'half' : s))
    posthog.capture('nearby_tab_changed', { tab: next })
  }, [selection, select])

  const handleSnapChange = useCallback((next: SheetSnap, source: 'drag' | 'tap') => {
    setSnap(next)
    posthog.capture('nearby_sheet_snap', { snap: next, source })
  }, [])

  const tabBar = (
    <div className="mx-4 mb-2 flex gap-1 rounded-xl bg-white/[0.05] p-1">
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => changeTab(t.id)}
          aria-pressed={tab === t.id}
          className={`flex-1 rounded-lg py-2 text-[0.8rem] font-bold transition-colors ${
            tab === t.id ? 'bg-[#BAF14D] text-[#191A2E]' : 'text-white/75 hover:text-white'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )

  return (
    // Fixed to the viewport (below the fixed Nav) rather than sized with
    // dvh math — Safari's URL-bar dance and scroll quirks can't touch it
    <div className="fixed inset-x-0 bottom-0 top-[60px] z-30 flex flex-col overflow-hidden bg-[#191A2E]">
      {/* Thin orientation strip — tells you what page you're on without
          spending real screen space */}
      <div className="flex h-7 shrink-0 items-center border-b border-white/[0.08] px-4">
        <span className="truncate text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[#BAF14D]">
          Your neighborhood snapshot
        </span>
      </div>

      {/* The stage (sheet snap heights + camera padding measure this box).
          Attribution rides above the sheet's peek height so the license
          line is readable whenever the sheet is tucked away */}
      <div ref={shellRef} className="relative min-h-0 flex-1">
      <div className="absolute inset-0 [&_.maplibregl-ctrl-bottom-right]:!bottom-[88px]">
        <NearbyMap
          center={center}
          markers={shellMarkers}
          lines={backgroundLines}
          paintedVisible={showBike && paintedOn}
          separatedVisible={showBike}
          corridorLines={shellCorridorLines}
          selectedCorridorId={effectiveHighlight}
          onCorridorSelect={(id, source) => {
            if (id) selectReveal({ type: 'corridor', id }, source)
            else select(null, source)
          }}
          onMarkerTap={markerTapReveal}
          onLaneTap={(info) => selectReveal({ type: 'lane', info }, 'map')}
          fitCount={7}
          extraFitPoints={accessPoints}
          cooperative={false}
          controls={{ showZoom: false }}
          fitPadding={fitPadding}
          heightClass="h-full"
        />
      </div>

      {/* Compact location pill over the map */}
      <div className="absolute left-3 right-3 top-3 z-10 flex items-center gap-2 rounded-full border border-white/[0.1] bg-[#191A2E]/85 py-1.5 pl-4 pr-1.5 backdrop-blur">
        <span className="min-w-0 flex-1 truncate text-[0.85rem] font-bold text-white">{displayLabel}</span>
        <button
          onClick={onCopyLink}
          className="shrink-0 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
        <button
          onClick={onChangeLocation}
          className="shrink-0 rounded-full bg-white/[0.08] px-2.5 py-1 text-[0.72rem] font-semibold text-white transition-colors hover:bg-white/[0.14]"
        >
          Change
        </button>
      </div>

      <NearbySheet snap={snap} onSnapChange={handleSnapChange} header={tabBar}>
        {/* Detail view replaces the tab content; tabs stay mounted below so
            list scroll positions survive */}
        {selection && (
          <div>
            <button
              onClick={() => select(null, 'sheet-back')}
              className="mb-2 flex items-center gap-1.5 rounded-lg py-1 text-[0.8rem] font-semibold text-[#BAF14D] transition-opacity hover:opacity-80"
            >
              ← Back
            </button>
            {selection.type === 'reach' ? (
              reachRow ? (
                <ReachDetail
                  row={reachRow}
                  mode={selection.mode}
                  center={center}
                  onMode={(m) => selectReach(reachRow, m, 'panel')}
                />
              ) : null
            ) : (
              <DetailContent
                selection={selection}
                stationByKey={stationByKey}
                corridorById={corridorById}
                docks={docks}
                onSelectCorridor={(id) => selectShowing({ type: 'corridor', id }, 'panel')}
              />
            )}
          </div>
        )}

        <div className={selection || tab !== 'transit' ? 'hidden' : ''}>
          {outside && (
            <p className="mb-2 rounded-xl border border-[#EDB93C]/30 bg-[#EDB93C]/10 px-4 py-3 text-[0.82rem] leading-relaxed text-white">
              This spot looks like it&apos;s outside Greater Boston, where our transit and Bluebikes data lives. Bike-path data covers all of Massachusetts, so parts of the picture may still fill in.
            </p>
          )}
          {/* One selector for the whole sheet: pick a mode, map + lists follow */}
          <div className="mt-2.5">
            <ModeFilterChips
              mode={modeFilter}
              onMode={setModeFilter}
              painted={paintedOn}
              onPaintedToggle={() => setPaintedOn(p => !p)}
            />
          </div>
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
          <GuidesBlock guides={guides} title="Starter guides" modeFilter={modeFilter} />
        </div>

        <div className={selection || tab !== 'destinations' ? 'hidden' : ''}>
          <p className="mt-2 text-[0.8rem] leading-snug text-white/75">
            Popular destinations — tap one to see the route.
          </p>
          <div className="mt-3">
            {reach.status === 'loading' && <SkeletonRows count={4} />}
            {reach.status === 'error' && <ErrorCard label="Couldn't compute travel times right now." onRetry={onRetry} />}
            {reach.status === 'ready' && reach.data.length > 0 && (
              <ReachList
                center={center}
                rows={reach.data}
                modeFilter={modeFilter}
                onRowTap={(row) => selectReach(row, defaultRouteMode(row, reachModeFor(modeFilter) ?? undefined), 'list')}
              />
            )}
            {reach.status === 'ready' && reach.data.length === 0 && (
              <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-[0.875rem] text-white/75">
                No destination times for this spot yet.
              </p>
            )}
          </div>
        </div>

        <div className={selection || tab !== 'explore' ? 'hidden' : ''}>
          <div className="mt-2">
            <ExploreBody community={community} />
          </div>
          <div className="mt-5 space-y-3">
            <div className="rounded-xl border border-[rgba(186,241,77,0.18)] bg-[linear-gradient(135deg,rgba(41,102,229,0.15),rgba(186,241,77,0.08))] px-4 py-3.5">
              <div className="text-[0.9rem] font-bold text-white">Have a destination in mind?</div>
              <p className="mt-0.5 text-[0.8rem] leading-snug text-white/80">
                The Commute Advisor compares every way to get there — with your home already filled in.
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
      </NearbySheet>
      </div>
    </div>
  )
}

/* ── Destination route detail: the route is on the MAIN map above ── */

function ReachDetail({ row, mode, center, onMode }: {
  row: ReachRow
  mode: 'transit' | 'bike'
  center: { lat: number; lng: number }
  onMode: (mode: 'transit' | 'bike') => void
}) {
  const hasTransit = (row.transit_segments?.length ?? 0) > 0
  const hasBike = !!row.bike_polyline
  const steps = mode === 'transit' ? row.steps : (row.bike_steps ?? [])

  const chip = (active: boolean) =>
    `flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.75rem] font-semibold transition-colors ${
      active
        ? 'border-[#BAF14D]/60 bg-[rgba(186,241,77,0.12)] text-white'
        : 'border-white/[0.15] text-white/75 hover:border-white/[0.3]'
    }`

  return (
    <div>
      <div className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#BAF14D]">
        Route — shown on the map
      </div>
      <div className="text-[0.95rem] font-bold text-white">{row.name}</div>
      <div className="text-[0.78rem] text-white/75">{row.distance_miles} mi away</div>

      {hasTransit && hasBike && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={() => onMode('transit')} aria-pressed={mode === 'transit'} className={chip(mode === 'transit')}>
            <ModeIcon mode="transit" size={13} /> T &amp; bus · {row.transit_minutes} min
          </button>
          <button onClick={() => onMode('bike')} aria-pressed={mode === 'bike'} className={chip(mode === 'bike')}>
            <ModeIcon mode="bike" size={13} /> Bike · {row.bike_is_estimate ? '~' : ''}{row.bike_minutes} min
          </button>
        </div>
      )}

      {steps.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {steps.map((s, j) => (
            <span key={`${s.label}-${j}`} className="flex items-center gap-1.5">
              {j > 0 && <span className="text-[0.7rem] text-white/70">→</span>}
              <span
                className="rounded px-1.5 py-0.5 text-[0.7rem] font-bold"
                style={{ backgroundColor: s.color, color: s.textColor }}
              >
                {s.label}
              </span>
            </span>
          ))}
        </div>
      )}

      {mode === 'transit' && (
        <p className="mt-2 text-[0.72rem] leading-snug text-white/70">
          Colored stretches are the ride; lighter gray stretches are the walks between.
        </p>
      )}

      {mode === 'bike' && row.bike_comfort && (
        <>
          <p className="mt-2 text-[0.72rem] leading-snug text-white/70">
            Bright green stretches are protected or a path; dashed blue are painted lanes; gray stretches share the road.
          </p>
          <BikeComfortBlock comfort={row.bike_comfort} />
        </>
      )}

      {/* Hand off to their maps app for the actual trip — turn-by-turn is its job */}
      <a
        href={directionsUrl(row.lat, row.lng, {
          mode: mode === 'bike' ? 'bicycling' : 'transit',
          origin: center,
        })}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => posthog.capture('snapshot_directions_clicked', { type: 'reach', mode })}
        className="mt-2 inline-block text-[0.8rem] font-semibold text-[#BAF14D] hover:opacity-80"
      >
        Open in Maps ↗
      </a>
    </div>
  )
}
