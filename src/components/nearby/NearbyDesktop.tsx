'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import posthog from 'posthog-js'
import type { BluebikeStationLive, MBTAStopLive } from '@/lib/wayfinding/types'
import type { TransitCorridor, BikeCorridor } from '@/lib/nearby/corridors'
import type { TripDest } from '@/lib/nearby/share'
import type { SectionData, SectionStatus, CommunityData, GuideItem, ReachRow } from './types'
import NearbyMap, { TrafficToggle, TrafficLegend, useTrafficPreference, type FitPadding, type RouteLegTapInfo } from './NearbyMap'
import { useInitialFocus } from './useInitialFocus'
import type { InitialFocus } from '@/lib/nearby/focus'
import {
  useNearbyModel, MODE_FILTER_DEFAULT, PAINTED_DEFAULT,
  type ModeFilter, type Selection,
} from './useNearbyModel'
import { useReachOverlay } from './useReachOverlay'
import { DetailContent } from './DetailPanel'
import ModeFilterChips from './ModeFilterChips'
import { StationList, BikeRouteList, DockList, BorrowRentList, RepairList, ServiceDisruptionsCard, firstBikeShelfKey } from './AroundYouLists'
import { nearbyAlerts, type SurfacedAlert } from '@/lib/nearby/alerts'
import { ReachList } from './ReachSection'
import TripPlanner from './TripPlanner'
import { defaultRouteMode, reachModeFor } from '@/lib/nearby/reach-ui'
import { ExploreBody } from './ExploreBody'
import { ExplorePerks, isPerkMarker, useNearbyPerks, usePerkMarkers } from './NearbyPerks'
import PartnerCobrand from './PartnerCobrand'
import NewRoutesOffer from './NewRoutesOffer'
import type { NearbyPartner } from '@/lib/nearby/partner'
import GuideLinks from './GuideLinks'
import { SkeletonRows, ErrorCard } from './SectionShell'
import { useNearbyT } from './NearbyI18n'
import NearbyLanguagePill from './NearbyLanguagePill'
import { useNearbyV2, wantsSignIn } from './useNearbyV2'
import { NearbySignIn, V2Blocks, V2LayersButton, V2PlaceChips, type V2Layers } from './NearbyV2'

/**
 * The desktop (≥ lg) experience: a two-pane app layout. The map is a sticky
 * left pane that never scrolls away — everything tapped (map or lists) shows
 * its detail in a card floating over the map's bottom edge — and the content
 * rail on the right scrolls past it: stations, bike routes, docks,
 * destinations, events.
 * Destination rows expand in place and draw their route on the SAME map
 * (no nested mini-maps). Below lg, NearbyShell renders the app shell
 * instead; both consume the same model + overlay hooks.
 */

interface Props {
  /** ?focus= deep link — see useInitialFocus */
  initialFocus: InitialFocus | null
  /** ?plan=1 (the /plan short address): open the Destinations rail with the
   *  trip search focused. */
  planFirst?: boolean
  /** ?to=&toName= — plan this trip on arrival (see parseTripDest) */
  planTo?: TripDest | null
  center: { lat: number; lng: number }
  displayLabel: string
  /** Town, shown beneath the neighborhood headline (null when no neighborhood) */
  subLabel: string | null
  /** Outreach co-brand (null = default branding); slug also tags analytics
   *  and rides the Download-Shift / advisor links */
  partner: NearbyPartner | null
  partnerSlug: string | null
  /** Attributed /shift hand-off href (carries partner + utm) */
  appHref: string
  /** In a New Routes campaign context — show the reward offer + code */
  newRoutes: boolean
  outside: boolean
  copied: boolean
  onCopyLink: () => void
  onChangeLocation: () => void
  onPrint: () => void
  onPlanCommute: (row: ReachRow) => void
  partnerLine: string
  transitCorridors: TransitCorridor[]
  bikeCorridors: BikeCorridor[]
  popularBikeStreetKeys: Set<string>
  rail: MBTAStopLive[]
  bus: MBTAStopLive[]
  railFar: MBTAStopLive[]
  busFar: MBTAStopLive[]
  shuttles: MBTAStopLive[]
  docks: BluebikeStationLive[]
  backgroundLines: GeoJSON.FeatureCollection | null
  transitStatus: SectionStatus
  reach: SectionData<ReachRow[]>
  community: SectionData<CommunityData | null>
  guides: SectionData<GuideItem[]>
  alerts: SurfacedAlert[]
  onRetry: () => void
  onRequestCorridorShape: (routeId: string, stopId: string) => void
}

/** Identity of a selection — keys the floating card so switching between two
 *  markers replays the entrance animation and resets the card's scroll. */
function selectionKey(sel: NonNullable<Selection>): string {
  switch (sel.type) {
    case 'corridor': case 'dock': case 'borrow': case 'repair': case 'reach': return `${sel.type}-${sel.id}`
    case 'station': return `station-${sel.key}`
    case 'lane': return `lane-${sel.info.lngLat?.lng ?? 0}-${sel.info.lngLat?.lat ?? 0}`
  }
}

const RAIL_TABS = [
  { id: 'transit' as const },
  { id: 'destinations' as const },
  { id: 'explore' as const },
]
type RailTab = (typeof RAIL_TABS)[number]['id']

const RAIL_TAB_LABEL_KEYS: Record<RailTab, string> = {
  transit: 'desktop.tab_transit',
  destinations: 'desktop.tab_destinations',
  explore: 'desktop.tab_explore',
}

export default function NearbyDesktop({
  initialFocus, planFirst = false, planTo = null, center, displayLabel, subLabel, outside, copied, onCopyLink, onChangeLocation, onPrint,
  onPlanCommute, partnerLine, partner, partnerSlug, appHref, newRoutes,
  transitCorridors, bikeCorridors, popularBikeStreetKeys, rail, bus, railFar, busFar, shuttles, docks,
  backgroundLines, transitStatus, reach, community, guides, alerts, onRetry,
  onRequestCorridorShape,
}: Props) {
  const tr = useNearbyT()
  const [modeFilter, setModeFilter] = useState<ModeFilter>(MODE_FILTER_DEFAULT)
  const [paintedOn, setPaintedOn] = useState(PAINTED_DEFAULT)
  // Live traffic: on by default in weekday commute windows, remembered once
  // touched (see useTrafficPreference)
  const { trafficOn, toggleTraffic } = useTrafficPreference()
  // Selecting Bike turns painted lanes on — in the bike view they're part of
  // the picture, not clutter. The user can still toggle them back off.
  const handleModeChange = useCallback((m: ModeFilter) => {
    setModeFilter(m)
    if (m === 'bike') setPaintedOn(true)
  }, [])

  // Around You v2 (on for Keith and Meghan only): same as the mobile shell,
  // the tabs and chips give way to answer-first blocks and a Layers button
  const v2 = useNearbyV2()
  const isV2 = v2.on
  const [extrasLayer, setExtrasLayer] = useState(false)
  const [perksLayer, setPerksLayer] = useState(false)
  const [moreBikeOpen, setMoreBikeOpen] = useState(false)
  const [moreNearbyOpen, setMoreNearbyOpen] = useState(false)
  const [morePlacesOpen, setMorePlacesOpen] = useState(false)

  const startDockLabel = useCallback(
    (d: BluebikeStationLive) => tr('dock.pin_bikes', { count: d.num_bikes_available }), [tr])
  const model = useNearbyModel({
    center, transitCorridors, bikeCorridors, rail, bus, railFar, busFar, shuttles, docks,
    modeFilter: isV2 ? 'all' : modeFilter, paintedVisible: paintedOn, onRequestCorridorShape, startDockLabel,
    extrasVisible: !isV2 || extrasLayer || moreBikeOpen,
  })
  const {
    selection, select, handleMarkerTap,
    corridorById, stations, stationByKey, crossModeNearest,
    corridorLines, highlightedCorridorId, markers, accessPoints,
    showRail, showBus, showBike,
  } = model

  // Reach routes draw on the main map, same as the mobile shell
  // A trip the visitor planned themselves. It joins the destination rows so
  // it renders, draws and selects exactly like a curated one — the planner
  // needed no new detail UI because a planned trip IS a reach row.
  const [plannedRows, setPlannedRows] = useState<ReachRow[]>([])
  const reachRows = useMemo(() => [...plannedRows, ...reach.data], [plannedRows, reach.data])

  // Which of the two bike routes is being described. Cleared with the
  // selection — a choice made about one destination means nothing about the
  // next one.
  const [bikeAlt, setBikeAlt] = useState(false)

  const openDocksLabel = useCallback((count: number) => tr('detail.open_docks', { count }), [tr])
  const overlay = useReachOverlay({
    selection: model.routeSelection ?? selection, reachRows, corridorLines, markers, highlightedCorridorId, bikeAlt,
    dockSelectedId: selection?.type === 'dock' ? selection.id : null,
    openDocksLabel,
  })
  // The dock card can open on the far-end dock, which is the route's, not
  // one of the page's nearby docks.
  const detailDocks = useMemo(() => {
    const route = model.routeSelection ? reachRows.find(r => r.id === model.routeSelection!.id) : undefined
    const extra = (route?.dest_docks ?? []).filter(d => !docks.some(x => x.station_id === d.station_id))
    return extra.length ? [...docks, ...extra] : docks
  }, [docks, reachRows, model.routeSelection])

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
  /** A planned trip lands in the list and opens immediately — the answer is
   *  the point of the search, not a row you then have to find and tap. */
  const onPlanned = useCallback((row: ReachRow, prefer?: 'transit' | 'bike') => {
    setPlannedRows(prev => [row, ...prev.filter(r => r.id !== row.id)])
    select({ type: 'reach', id: row.id, mode: defaultRouteMode(row, prefer ?? reachModeFor(modeFilter) ?? undefined) }, 'trip')
  }, [select, modeFilter])

  const onRouteSelect = useCallback((sel: { id: string; mode: 'transit' | 'bike' } | null) => {
    if (!sel) {
      select(null, 'row-collapse')
      return
    }
    select({ type: 'reach', id: sel.id, mode: sel.mode }, 'list')
    posthog.capture('reach_route_viewed', { destination: sel.id, mode: sel.mode })
  }, [select])

  // Rail tabs — the mobile sheet's three-way split, so the rail is a set of
  // short panes instead of one long scroll. Content stays mounted (hidden)
  // so scroll positions and expanded rows survive tab hops.
  const [railTab, setRailTab] = useState<RailTab>(planFirst ? 'destinations' : 'transit')
  const changeRailTab = useCallback((next: RailTab) => {
    setRailTab(next)
    if (selection) select(null, 'tab-change')
    posthog.capture('nearby_tab_changed', { tab: next, surface: 'desktop' })
  }, [selection, select])

  // Bicycle Benefits members: pins and rows on Explore, where a tap plans the
  // bike trip there. A trip opens in the Destinations pane like any planned
  // one, so the rail moves there with it (not through changeRailTab, which
  // would close the trip it just opened). The one or two on the way pin while
  // a bike trip is drawn.
  const destPaneRef = useRef<HTMLDivElement>(null)
  const v2TripRef = useRef<HTMLDivElement>(null)
  const railHeadRef = useRef<HTMLDivElement>(null)
  const onPerkPlanned = useCallback((row: ReachRow, prefer?: 'transit' | 'bike') => {
    setRailTab('destinations')
    onPlanned(row, prefer)
    // The page is still scrolled to Explore's list: land on the trip that
    // just opened, under the sticky tabs, once the pane has rendered.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const open = (isV2 ? v2TripRef : destPaneRef).current?.querySelector('[aria-expanded="true"]')
      if (!open) return
      const under = railHeadRef.current?.getBoundingClientRect().bottom ?? 0
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      window.scrollTo({ top: window.scrollY + open.getBoundingClientRect().top - under - 8, behavior: reduce ? 'auto' : 'smooth' })
    }))
  }, [onPlanned, isV2])
  const nearbyPerks = useNearbyPerks({ center, onPlanned: onPerkPlanned })
  const routeSel = model.routeSelection
  const perkMarkers = usePerkMarkers({
    perks: nearbyPerks.perks,
    showNearby: !selection && (isV2 ? perksLayer || moreNearbyOpen : railTab === 'explore'),
    route: routeSel?.mode === 'bike' ? reachRows.find(r => r.id === routeSel.id) ?? null : null,
  })
  const mapMarkers = useMemo(
    () => (perkMarkers.length ? [...overlay.markers, ...perkMarkers] : overlay.markers), [overlay.markers, perkMarkers])

  // The floating detail card covers the bottom of the map — measure the map
  // box so the point-focus ease can land the tapped marker in the uncovered
  // area above the card (same pattern as the mobile shell's fitPadding).
  const mapBoxRef = useRef<HTMLDivElement>(null)
  const [mapH, setMapH] = useState(0)
  useEffect(() => {
    const el = mapBoxRef.current
    if (!el) return
    const measure = () => setMapH(el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const focusPadding = useMemo<FitPadding | undefined>(
    () => (mapH ? { top: 48, bottom: Math.round(mapH * 0.45) + 24, left: 48, right: 48 } : undefined),
    [mapH]
  )

  // At page-top scroll the sticky map column overhangs the fold, clipping the
  // floating card's lower edge — nudge the page the few dozen px it takes to
  // bring the map's bottom (and the card riding on it) fully into view.
  useEffect(() => {
    if (!selection || selection.type === 'reach') return
    const el = mapBoxRef.current
    if (!el) return
    const delta = el.getBoundingClientRect().bottom - window.innerHeight
    if (delta > 0) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      window.scrollBy({ top: delta, behavior: reduce ? 'auto' : 'smooth' })
    }
  }, [selection])

  // A tapped stretch of the drawn route; cleared whenever the selection moves
  const [legInfo, setLegInfo] = useState<RouteLegTapInfo | null>(null)
  // Which street bullet the reader is pointing at. Lives here so the list and
  // the map share one answer; cleared whenever the selection moves.
  const [highlightedStreetKey, setHighlightedStreetKey] = useState<string | null>(null)

  // Section-collapse state for the bike-side shelves, owned here so it
  // survives the sheet's snap changes and tab hops (the app hoists it into
  // TransitBikePane for the same reason).
  //
  // null means "untouched", which renders the FIRST bike shelf open. Closing
  // everything by default made the stack read as a flat list of headings; one
  // open shelf shows the pattern, and the rest still collapse away. The
  // sentinel (rather than seeding a Set) is what lets the default follow
  // whichever shelf actually has corridors, without a setState-in-effect.
  const [openSections, setOpenSections] = useState<Set<string> | null>(null)
  const defaultOpenShelf = useMemo(() => firstBikeShelfKey(bikeCorridors), [bikeCorridors])
  const isSectionOpen = useCallback(
    (key: string) => (openSections ? openSections.has(key) : key === defaultOpenShelf),
    [openSections, defaultOpenShelf],
  )
  const toggleSection = useCallback((key: string) => {
    setOpenSections(prev => {
      // Seed from what's on screen, so opening Borrow doesn't silently close
      // the shelf the user could see was open.
      const next = new Set(prev ?? (defaultOpenShelf ? [defaultOpenShelf] : []))
      if (next.has(key)) next.delete(key)
      else {
        next.add(key)
        posthog.capture('snapshot_section_expanded', { section: key })
      }
      return next
    })
  }, [defaultOpenShelf])

  useInitialFocus(initialFocus, {
    corridorById, stationByKey: model.stationByKey, docks, reachRows: reach.data,
    select: selectShowing, isSectionOpen, toggleSection, selection,
    showDestinations: useCallback(() => setRailTab('destinations'), []),
  })

  useEffect(() => { setLegInfo(null); setHighlightedStreetKey(null); setBikeAlt(false) }, [selection])
  const handleLegTap = useCallback((info: RouteLegTapInfo) => {
    setLegInfo(info)
    posthog.capture('reach_leg_tapped', { leg: info.leg, surface: 'desktop' })
  }, [])

  const v2Layers: V2Layers = { painted: paintedOn, traffic: trafficOn, extras: extrasLayer, perks: perksLayer }
  const toggleV2Layer = (key: keyof V2Layers) => {
    if (key === 'painted') setPaintedOn(p => !p)
    else if (key === 'traffic') toggleTraffic()
    else if (key === 'extras') setExtrasLayer(x => !x)
    else setPerksLayer(x => !x)
  }
  // v2 has no Destinations tab: an open trip (a chip, a search, a perk) shows
  // at the top of the rail, with the rest of the places under "More places"
  const v2TripRows = morePlacesOpen
    ? reachRows
    : reachRows.filter(r => routeSelection && r.id === routeSelection.id)
  const visibleRouteIds = new Set(stations.flatMap(st => st.routes.map(r => r.id)))
  const routeNames = new Map(stations.flatMap(st => st.routes.map(r => [r.id, r.name] as const)))

  return (
    <div className="pb-20">
      {/* Compact header — the h1 stays for SEO/a11y; actions live in the bar.
          Neighborhood is the headline; the town rides beneath it, so the
          "Your neighborhood snapshot" eyebrow finally reads true. */}
      <div className="mx-auto max-w-[1200px] px-6 pb-4 pt-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-(--nb-accent)">
              {tr('desktop.eyebrow_snapshot')}
            </div>
            <h1 className="mt-1 truncate font-display text-[1.35rem] font-extrabold tracking-tight text-(--nb-ink)">
              {displayLabel}
            </h1>
            {subLabel && (
              <div className="mt-0.5 text-[0.9rem] font-semibold text-(--nb-ink-70)">{subLabel}</div>
            )}
          </div>
          {/* Partner co-brand — secondary to the GSI headline, hugging the
              right edge of the header (never the load-bearing sticky bar) */}
          {partner && <PartnerCobrand partner={partner} logoClass="max-h-9" gsiClass="max-h-6" />}
        </div>
        {/* New Routes offer under the headline — visible on every tab, not
            buried in the Explore rail. */}
        {newRoutes && (
          <div className="mt-3 max-w-2xl">
            <NewRoutesOffer
              href={appHref}
              variant="compact"
              onCta={() => posthog.capture('snapshot_app_cta_clicked', { campaign: 'newroutes', ...(partnerSlug ? { partner: partnerSlug } : {}) })}
            />
          </div>
        )}
        {outside && (
          <p className="mt-3 rounded-xl border border-(--nb-warn-line) bg-(--nb-warn-tint) px-5 py-3.5 text-[0.875rem] leading-relaxed text-(--nb-ink)">
            {tr('desktop.outside_banner')}
          </p>
        )}
      </div>

      {/* Sticky top bar. The FIXED h-[52px] single row is load-bearing: the
          map pane below assumes 60px nav + 52px bar + 16px gap (top-[128px] /
          calc(100vh-144px)). Overflow scrolls horizontally — never wrap. */}
      <div className="sticky top-[60px] z-20 border-b border-(--nb-line-mid) bg-(--nb-bg)/95 backdrop-blur">
        <div className="relative mx-auto max-w-[1200px]">
          <div className="flex h-[52px] items-center gap-3 overflow-x-auto whitespace-nowrap px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="min-w-0 shrink truncate text-[0.85rem] font-bold text-(--nb-ink)">
              {displayLabel}{subLabel && <span className="font-semibold text-(--nb-ink-70)">{` · ${subLabel}`}</span>}
            </span>
            <button
              onClick={onCopyLink}
              className="shrink-0 rounded-lg border border-(--nb-line-mid) px-3 py-1.5 text-[0.78rem] font-semibold text-(--nb-ink) transition-colors hover:bg-(--nb-panel)"
            >
              {copied ? tr('desktop.copied') : tr('desktop.copy_link')}
            </button>
            <button
              onClick={onChangeLocation}
              className="shrink-0 rounded-lg border border-(--nb-line-mid) px-3 py-1.5 text-[0.78rem] font-semibold text-(--nb-ink) transition-colors hover:bg-(--nb-panel)"
            >
              {tr('desktop.change_location')}
            </button>
            <button
              onClick={onPrint}
              className="shrink-0 rounded-lg border border-(--nb-line-mid) px-3 py-1.5 text-[0.78rem] font-semibold text-(--nb-ink) transition-colors hover:bg-(--nb-panel)"
            >
              {tr('desktop.print_version')}
            </button>
            <NearbyLanguagePill className="shrink-0" />
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-(--nb-bg) to-transparent" />
        </div>
      </div>

      {/* Two panes: sticky map left, scrolling content rail right */}
      <div className="mx-auto mt-5 max-w-[1200px] px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_480px]">

          {/* LEFT: the map pane. Viewport-derived height, so a short rail
              can't collapse it; detail floats OVER the map's bottom edge, so
              the response to a tap is always where the user is looking —
              never below the fold, and the map never resizes. */}
          <div className="lg:sticky lg:top-[128px] lg:flex lg:h-[calc(100vh-144px)] lg:min-h-[420px] lg:flex-col lg:self-start">
            <div ref={mapBoxRef} className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-(--nb-line)">
              <NearbyMap
                center={center}
                markers={mapMarkers}
                lines={backgroundLines}
                paintedVisible={showBike && paintedOn}
                separatedVisible={showBike}
                trafficVisible={trafficOn}
                corridorLines={overlay.lines}
                selectedCorridorId={overlay.highlight}
                holdSelectionFit={selection?.type === 'dock' && !!model.routeSelection}
                highlightedStreetKey={highlightedStreetKey}
                onCorridorSelect={(id, source) => {
                  if (id) select({ type: 'corridor', id }, source)
                  else select(null, source)
                }}
                onMarkerTap={(id) => (isPerkMarker(id) ? nearbyPerks.planById(id) : handleMarkerTap(id))}
                onLaneTap={(info) => select({ type: 'lane', info }, 'map')}
                onReachLegTap={handleLegTap}
                fitCount={7}
                extraFitPoints={accessPoints}
                focusPoint={model.selectionPoint}
                focusPadding={focusPadding}
                controls={{ attribution: 'top-left' }}
                heightClass="h-full"
              />

              {/* Left of the map's own recenter and zoom buttons */}
              {isV2 && (
                <div className="absolute right-[52px] top-2.5 z-10">
                  <V2LayersButton layers={v2Layers} onToggle={toggleV2Layer} />
                </div>
              )}

              {/* Detail card — everything tapped lands HERE, floating over the
                  map bottom, always in view. (Reach selections render in their
                  own row expansion in the rail instead.) */}
              {selection && selection.type !== 'reach' && (
                <div
                  key={selectionKey(selection)}
                  className="animate-detail-card-in absolute inset-x-3 bottom-3 z-10 max-h-[45%] overflow-y-auto rounded-xl border border-(--nb-accent-line) bg-(--nb-card) px-4 py-3.5 shadow-[0_8px_28px_rgba(0,0,0,0.45)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <DetailContent
                        selection={selection}
                        stationByKey={stationByKey}
                        corridorById={corridorById}
                        docks={detailDocks}
                        borrowRent={model.borrowRent}
                repairPlaces={model.repairPlaces}
                center={center}
                        onSelectCorridor={(id) => selectShowing({ type: 'corridor', id }, 'panel')}
                      />
                    </div>
                    <button
                      onClick={() => select(null, 'panel-close')}
                      aria-label={tr('desktop.close_details')}
                      className="shrink-0 rounded-lg border border-(--nb-line-mid) px-2.5 py-1 text-[0.9rem] font-bold text-(--nb-ink-80) transition-colors hover:bg-(--nb-panel-raised) hover:text-(--nb-ink)"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: the content rail, split into the mobile sheet's three
              panes. Macro tabs sit ABOVE the mode chips — same order as the
              mobile sheet header. Both stick just under the top bar
              (60+52=112). */}
          <div className="min-w-0">
            {isV2 && (
              <div ref={railHeadRef} className="sticky top-[112px] z-10 bg-(--nb-bg) pb-2.5 pt-1">
                {/* The original planner (always mounted, hidden) plans a ?to=
                    link on arrival, so this one never does */}
                <TripPlanner bare center={center} onPlanned={onPlanned} partnerSlug={partnerSlug} autoFocus={planFirst && !planTo} />
                <V2PlaceChips
                  rows={reach.data}
                  onPick={(row) => onRouteSelect({ id: row.id, mode: defaultRouteMode(row) })}
                  morePlacesOpen={morePlacesOpen}
                  onMorePlaces={() => setMorePlacesOpen(o => !o)}
                />
                {trafficOn && <TrafficLegend className="mt-2" />}
              </div>
            )}
            {v2.checked && !v2.signedIn && wantsSignIn() && <NearbySignIn />}

            {isV2 && (
              <div>
                {v2TripRows.length > 0 && (
                  <div ref={v2TripRef} className="mb-5">
                    <ReachList
                      center={center}
                      rows={v2TripRows}
                      modeFilter="all"
                      routeSelection={routeSelection}
                      onRouteSelect={onRouteSelect}
                      legInfo={legInfo}
                      highlightedStreetKey={highlightedStreetKey}
                      onHighlightStreet={setHighlightedStreetKey}
                      bikeAlt={bikeAlt}
                      onPickRoute={setBikeAlt}
                      onPlanCommute={onPlanCommute}
                      partnerSlug={partnerSlug}
                    />
                  </div>
                )}
                {transitStatus === 'loading' && stations.length === 0 && <SkeletonRows count={3} />}
                <V2Blocks
                  stations={stations}
                  alerts={nearbyAlerts(alerts, visibleRouteIds)}
                  routeNames={routeNames}
                  docks={docks}
                  bikeCorridors={bikeCorridors}
                  events={community.data?.events ?? []}
                  eventsLoading={community.status === 'loading'}
                  onLine={(row) => corridorById.has(`transit:${row.routeId}`)
                    ? selectShowing({ type: 'corridor', id: `transit:${row.routeId}` }, 'board')
                    : selectShowing({ type: 'station', key: row.stationKey }, 'board')}
                  onDock={(id) => selectShowing({ type: 'dock', id }, 'board')}
                  onBikeRoute={(id) => selectShowing({ type: 'corridor', id }, 'board')}
                  renderAllStops={() => (
                    <StationList
                      stations={stations}
                      corridorById={corridorById}
                      highlightedCorridorId={highlightedCorridorId}
                      status={transitStatus}
                      onRetry={onRetry}
                      onSelectRoute={(id) => selectShowing({ type: 'corridor', id }, 'list')}
                      onFocusStation={model.focusStation}
                      focusedStationKey={model.focusedStationKey}
                      alerts={alerts}
                      mode="all"
                      crossModeNearest={null}
                      onSwitchMode={handleModeChange}
                    />
                  )}
                  moreBikeOpen={moreBikeOpen}
                  onMoreBike={() => setMoreBikeOpen(o => !o)}
                  renderMoreBike={() => (
                    <>
                      <BikeRouteList
                        bikeCorridors={bikeCorridors}
                        popularStreetKeys={popularBikeStreetKeys}
                        highlightedCorridorId={highlightedCorridorId}
                        onSelect={(id) => selectShowing({ type: 'corridor', id }, 'list')}
                        isSectionOpen={isSectionOpen}
                        onToggleSection={toggleSection}
                      />
                      <DockList docks={docks} onSelect={(id) => selectShowing({ type: 'dock', id }, 'list')} selectedId={selection?.type === 'dock' ? selection.id : null} isSectionOpen={isSectionOpen} onToggleSection={toggleSection} />
                      <BorrowRentList points={model.borrowRent} onSelect={(id) => selectShowing({ type: 'borrow', id }, 'list')} selectedId={selection?.type === 'borrow' ? selection.id : null} isSectionOpen={isSectionOpen} onToggleSection={toggleSection} />
                      <RepairList places={model.repairPlaces} onSelect={(id) => selectShowing({ type: 'repair', id }, 'list')} selectedId={selection?.type === 'repair' ? selection.id : null} isSectionOpen={isSectionOpen} onToggleSection={toggleSection} />
                    </>
                  )}
                  moreNearbyOpen={moreNearbyOpen}
                  onMoreNearby={() => setMoreNearbyOpen(o => !o)}
                  renderMoreNearby={() => (
                    <>
                      <ExploreBody community={community} compact />
                      <ExplorePerks perks={nearbyPerks.perks} planning={nearbyPerks.planning} failed={nearbyPerks.failed} onPlan={nearbyPerks.plan} />
                    </>
                  )}
                />
              </div>
            )}

            <div ref={isV2 ? undefined : railHeadRef} className={isV2 ? 'hidden' : 'sticky top-[112px] z-10 bg-(--nb-bg) pb-2.5 pt-1'}>
              <div className="flex gap-1 rounded-xl bg-(--nb-panel) p-1">
                {RAIL_TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => changeRailTab(t.id)}
                    aria-pressed={railTab === t.id}
                    className={`flex-1 rounded-lg py-2 text-[0.8rem] font-bold transition-colors ${
                      railTab === t.id ? 'bg-(--nb-accent-fill) text-(--nb-on-accent-fill)' : 'text-(--nb-ink-70) hover:text-(--nb-ink)'
                    }`}
                  >
                    {tr(RAIL_TAB_LABEL_KEYS[t.id])}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <ModeFilterChips
                  mode={modeFilter}
                  onMode={handleModeChange}
                  painted={paintedOn}
                  onPaintedToggle={() => setPaintedOn(p => !p)}
                />
                <TrafficToggle on={trafficOn} onToggle={toggleTraffic} />
              </div>
              {trafficOn && <TrafficLegend className="mt-1.5" />}
            </div>

            <div className={!isV2 && railTab === 'transit' ? '' : 'hidden'}>
              {(showRail || showBus) && (() => {
                const visibleRouteIds = new Set(stations.flatMap(st => st.routes.map(r => r.id)))
                const routeNames = new Map(stations.flatMap(st => st.routes.map(r => [r.id, r.name] as const)))
                return <ServiceDisruptionsCard alerts={nearbyAlerts(alerts, visibleRouteIds)} routeNames={routeNames} />
              })()}
              {(showRail || showBus) && (
                <>
                  <StationList
                    stations={stations}
                    corridorById={corridorById}
                    highlightedCorridorId={highlightedCorridorId}
                    status={transitStatus}
                    onRetry={onRetry}
                    onSelectRoute={(id) => selectShowing({ type: 'corridor', id }, 'list')}
                    onFocusStation={model.focusStation}
                    focusedStationKey={model.focusedStationKey}
                    alerts={alerts}
                    mode={modeFilter}
                    crossModeNearest={crossModeNearest}
                    onSwitchMode={handleModeChange}
                  />
                  <GuideLinks context="stations" guides={guides.data} modeFilter={modeFilter} />
                </>
              )}
              {showBike && (
                <>
                  <BikeRouteList
                    bikeCorridors={bikeCorridors}
                    popularStreetKeys={popularBikeStreetKeys}
                    highlightedCorridorId={highlightedCorridorId}
                    onSelect={(id) => selectShowing({ type: 'corridor', id }, 'list')}
                    isSectionOpen={isSectionOpen}
                    onToggleSection={toggleSection}
                  />
                  <GuideLinks context="bike" guides={guides.data} modeFilter={modeFilter} />
                  <DockList docks={docks} onSelect={(id) => selectShowing({ type: 'dock', id }, 'list')} selectedId={selection?.type === 'dock' ? selection.id : null} isSectionOpen={isSectionOpen} onToggleSection={toggleSection} />
                  <GuideLinks context="docks" guides={guides.data} modeFilter={modeFilter} />
                  <BorrowRentList
                    points={model.borrowRent}
                    onSelect={(id) => selectShowing({ type: 'borrow', id }, 'list')}
                    selectedId={selection?.type === 'borrow' ? selection.id : null}
                    isSectionOpen={isSectionOpen}
                    onToggleSection={toggleSection}
                  />
                  {model.borrowRent.length > 0 && (
                    <GuideLinks context="borrow" guides={guides.data} modeFilter={modeFilter} />
                  )}
                  <RepairList
                    places={model.repairPlaces}
                    onSelect={(id) => selectShowing({ type: 'repair', id }, 'list')}
                    selectedId={selection?.type === 'repair' ? selection.id : null}
                    isSectionOpen={isSectionOpen}
                    onToggleSection={toggleSection}
                  />
                </>
              )}
            </div>

            <div ref={destPaneRef} className={!isV2 && railTab === 'destinations' ? '' : 'hidden'}>
              {/* Planning a specific trip leads — most people arrive wanting
                  their own destination, not our curated set. It answers here,
                  in a row like any other; the Advisor's full cost comparison
                  lives inside that answer, for the trips you actually repeat. */}
              <TripPlanner center={center} onPlanned={onPlanned} partnerSlug={partnerSlug} autoFocus={planFirst && !planTo} initialDest={planTo} />

              <p className="mb-3 mt-6 text-[0.8rem] leading-snug text-(--nb-ink-70)">
                {tr('desktop.destinations_intro')}
              </p>
              {reach.status === 'loading' && <SkeletonRows count={4} />}
              {reach.status === 'error' && <ErrorCard label={tr('desktop.reach_error')} onRetry={onRetry} />}
              {reach.status === 'ready' && reachRows.length > 0 && (
                <ReachList
                  center={center}
                  rows={reachRows}
                  modeFilter={modeFilter}
                  routeSelection={routeSelection}
                  onRouteSelect={onRouteSelect}
                  legInfo={legInfo}
                  highlightedStreetKey={highlightedStreetKey}
                  onHighlightStreet={setHighlightedStreetKey}
                  bikeAlt={bikeAlt}
                  onPickRoute={setBikeAlt}
                  onPlanCommute={onPlanCommute}
                  partnerSlug={partnerSlug}
                />
              )}
              {reach.status === 'ready' && reachRows.length === 0 && (
                <p className="rounded-xl border border-(--nb-line) bg-(--nb-panel-faint) px-5 py-4 text-[0.875rem] text-(--nb-ink-70)">
                  {tr('desktop.no_destinations')}
                </p>
              )}
            </div>

            <div className={!isV2 && railTab === 'explore' ? '' : 'hidden'}>
              <ExploreBody community={community} compact />
              <ExplorePerks perks={nearbyPerks.perks} planning={nearbyPerks.planning} failed={nearbyPerks.failed} onPlan={nearbyPerks.plan} />
            </div>

            {/* Get-Shift hook — persistent at the bottom of the rail on EVERY
                tab (was gated to Explore). In New Routes context the reward
                offer sits under the headline instead. */}
            {!newRoutes && (
              <div className="mt-4 rounded-xl border border-(--nb-line-mid) bg-(--nb-card) px-4 py-3.5">
                <div className="text-[0.9rem] font-bold text-(--nb-ink)">{tr('desktop.get_app_title')}</div>
                <p className="mt-0.5 text-[0.8rem] leading-snug text-(--nb-ink-80)">{partnerLine}</p>
                <a
                  href={appHref}
                  onClick={() => posthog.capture('snapshot_app_cta_clicked', partnerSlug ? { partner: partnerSlug } : {})}
                  className="mt-2 inline-block rounded-lg border border-(--nb-accent-line) px-3.5 py-1.5 text-[0.78rem] font-bold text-(--nb-accent) transition-colors hover:bg-(--nb-accent-fill) hover:text-(--nb-on-accent-fill)"
                >
                  {tr('desktop.download_app')}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
