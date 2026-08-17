'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import posthog from 'posthog-js'
import type { BluebikeStationLive, MBTAStopLive } from '@/lib/wayfinding/types'
import type { TransitCorridor, BikeCorridor } from '@/lib/nearby/corridors'
import type { SectionData, SectionStatus, CommunityData, GuideItem, ReachRow } from './types'
import NearbyMap, { type RouteLegTapInfo } from './NearbyMap'
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
import PartnerCobrand from './PartnerCobrand'
import type { NearbyPartner } from '@/lib/nearby/partner'
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
  /** Town, shown beneath the neighborhood headline (null when no neighborhood) */
  subLabel: string | null
  /** Outreach co-brand (null = default branding); slug also tags analytics
   *  and rides the Download-Shift / advisor links */
  partner: NearbyPartner | null
  partnerSlug: string | null
  outside: boolean
  copied: boolean
  onCopyLink: () => void
  onChangeLocation: () => void
  onPrint: () => void
  onAdvisorCta: () => void
  onPlanCommute: (row: ReachRow) => void
  partnerLine: string
  transitCorridors: TransitCorridor[]
  bikeCorridors: BikeCorridor[]
  popularBikeStreetKeys: Set<string>
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

const RAIL_TABS = [
  { id: 'transit' as const, label: 'Transit & bike' },
  { id: 'destinations' as const, label: 'Destinations' },
  { id: 'explore' as const, label: 'Explore nearby' },
]
type RailTab = (typeof RAIL_TABS)[number]['id']

export default function NearbyDesktop({
  center, displayLabel, subLabel, outside, copied, onCopyLink, onChangeLocation, onPrint,
  onAdvisorCta, onPlanCommute, partnerLine, partner, partnerSlug,
  transitCorridors, bikeCorridors, popularBikeStreetKeys, rail, bus, docks,
  backgroundLines, transitStatus, reach, community, guides, onRetry,
}: Props) {
  const [modeFilter, setModeFilter] = useState<ModeFilter>(MODE_FILTER_DEFAULT)
  const [paintedOn, setPaintedOn] = useState(PAINTED_DEFAULT)
  // Selecting Bike turns painted lanes on — in the bike view they're part of
  // the picture, not clutter. The user can still toggle them back off.
  const handleModeChange = useCallback((m: ModeFilter) => {
    setModeFilter(m)
    if (m === 'bike') setPaintedOn(true)
  }, [])

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

  // Rail tabs — the mobile sheet's three-way split, so the rail is a set of
  // short panes instead of one long scroll. Content stays mounted (hidden)
  // so scroll positions and expanded rows survive tab hops.
  const [railTab, setRailTab] = useState<RailTab>('transit')
  const changeRailTab = useCallback((next: RailTab) => {
    setRailTab(next)
    if (selection) select(null, 'tab-change')
    posthog.capture('nearby_tab_changed', { tab: next, surface: 'desktop' })
  }, [selection, select])

  // A tapped stretch of the drawn route; cleared whenever the selection moves
  const [legInfo, setLegInfo] = useState<RouteLegTapInfo | null>(null)
  useEffect(() => { setLegInfo(null) }, [selection])
  const handleLegTap = useCallback((info: RouteLegTapInfo) => {
    setLegInfo(info)
    posthog.capture('reach_leg_tapped', { leg: info.leg, surface: 'desktop' })
  }, [])

  return (
    <div className="pb-20">
      {/* Compact header — the h1 stays for SEO/a11y; actions live in the bar.
          Neighborhood is the headline; the town rides beneath it, so the
          "Your neighborhood snapshot" eyebrow finally reads true. */}
      <div className="mx-auto max-w-[1200px] px-6 pb-4 pt-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#BAF14D]">
              Your neighborhood snapshot
            </div>
            <h1 className="mt-1 truncate font-display text-[1.35rem] font-extrabold tracking-tight text-white">
              {displayLabel}
            </h1>
            {subLabel && (
              <div className="mt-0.5 text-[0.9rem] font-semibold text-white/70">{subLabel}</div>
            )}
          </div>
          {/* Partner co-brand — secondary to the GSI headline, hugging the
              right edge of the header (never the load-bearing sticky bar) */}
          {partner && <PartnerCobrand partner={partner} logoClass="max-h-9" />}
        </div>
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
            <span className="min-w-0 shrink truncate text-[0.85rem] font-bold text-white">
              {displayLabel}{subLabel && <span className="font-semibold text-white/70">{` · ${subLabel}`}</span>}
            </span>
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
            <button
              onClick={onPrint}
              className="shrink-0 rounded-lg border border-white/[0.15] px-3 py-1.5 text-[0.78rem] font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              Print version
            </button>
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
                onReachLegTap={handleLegTap}
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

          {/* RIGHT: the content rail, split into the mobile sheet's three
              panes. Macro tabs sit ABOVE the mode chips — same order as the
              mobile sheet header. Both stick just under the top bar
              (60+52=112). */}
          <div className="min-w-0">
            <div className="sticky top-[112px] z-10 bg-[#191A2E] pb-2.5 pt-1">
              <div className="flex gap-1 rounded-xl bg-white/[0.05] p-1">
                {RAIL_TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => changeRailTab(t.id)}
                    aria-pressed={railTab === t.id}
                    className={`flex-1 rounded-lg py-2 text-[0.8rem] font-bold transition-colors ${
                      railTab === t.id ? 'bg-[#BAF14D] text-[#191A2E]' : 'text-white/75 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <ModeFilterChips
                  mode={modeFilter}
                  onMode={handleModeChange}
                  painted={paintedOn}
                  onPaintedToggle={() => setPaintedOn(p => !p)}
                />
              </div>
            </div>

            <div className={railTab === 'transit' ? '' : 'hidden'}>
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
                    popularStreetKeys={popularBikeStreetKeys}
                    highlightedCorridorId={highlightedCorridorId}
                    onSelect={(id) => selectShowing({ type: 'corridor', id }, 'list')}
                  />
                  <GuideLinks context="bike" guides={guides.data} modeFilter={modeFilter} />
                  <DockList docks={docks} />
                  <GuideLinks context="docks" guides={guides.data} modeFilter={modeFilter} />
                </>
              )}
            </div>

            <div className={railTab === 'destinations' ? '' : 'hidden'}>
              {/* Planning a specific trip leads — most people arrive wanting
                  their own destination, not our curated set. */}
              <div className="rounded-xl border border-[rgba(186,241,77,0.25)] bg-[linear-gradient(135deg,rgba(41,102,229,0.18),rgba(186,241,77,0.1))] px-4 py-4">
                <div className="text-[0.95rem] font-bold text-white">Have a specific place to get to?</div>
                <p className="mt-1 text-[0.82rem] leading-snug text-white/80">
                  Plan any trip with the Commute Advisor — it compares every way to get there by time, cost, and health, with your home already filled in.
                </p>
                <Link
                  href={partnerSlug ? `/commute-advisor?partner=${partnerSlug}` : '/commute-advisor'}
                  onClick={onAdvisorCta}
                  className="mt-2.5 inline-block rounded-lg bg-[#BAF14D] px-4 py-2 text-[0.8rem] font-bold text-[#191A2E] transition-opacity hover:opacity-85"
                >
                  Plan your trip →
                </Link>
              </div>

              <p className="mb-3 mt-6 text-[0.8rem] leading-snug text-white/75">
                Or explore popular destinations nearby — tap a place to see the route on the map.
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
                  legInfo={legInfo}
                  onPlanCommute={onPlanCommute}
                  partnerSlug={partnerSlug}
                />
              )}
              {reach.status === 'ready' && reach.data.length === 0 && (
                <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-[0.875rem] text-white/75">
                  No destination times for this spot yet.
                </p>
              )}
            </div>

            <div className={railTab === 'explore' ? '' : 'hidden'}>
              <ExploreBody community={community} compact />
              <div className="mt-4 rounded-xl border border-white/[0.1] bg-[#242538] px-4 py-3.5">
                <div className="text-[0.9rem] font-bold text-white">Get the Shift app</div>
                <p className="mt-0.5 text-[0.8rem] leading-snug text-white/80">{partnerLine}</p>
                <a
                  href={partnerSlug ? `/shift?partner=${partnerSlug}` : '/shift'}
                  onClick={() => posthog.capture('snapshot_app_cta_clicked', partnerSlug ? { partner: partnerSlug } : {})}
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
