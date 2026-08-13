'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import posthog from 'posthog-js'
import type { BluebikeStationLive, MBTAStopLive } from '@/lib/wayfinding/types'
import { formatDistance, walkTimeMinutes } from '@/lib/wayfinding/geo'
import { directionsUrl } from '@/lib/nearby/transit-ui'
import { BLUEBIKES_NOTE, CORRIDOR_UNSPLASH } from '@/lib/nearby/config'
import { bearingDegrees } from '@/lib/geo/polyline'
import type { TransitCorridor, BikeCorridor, FrequencyInfo } from '@/lib/nearby/corridors'
import NearbyMap, { type NearbyMarker, type LaneTapInfo } from './NearbyMap'
import { userDotHtml, busStopHtml, trainStopHtml, bluebikeHtml, dockStatsText } from './markers'
import type { SectionStatus } from './types'
import { SkeletonRows, ErrorCard } from './SectionShell'

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
}

/**
 * Everything tapped on the map shows up in ONE place: a detail panel pinned
 * directly under the map. No popups (they clip and trap scroll on mobile),
 * no scrolling the page to some distant card — your eyes never leave the
 * map area. The list below is for browsing; it highlights the map but never
 * the other way around.
 */

type Selection =
  | { type: 'corridor'; id: string }
  | { type: 'station'; key: string }
  | { type: 'dock'; id: string }
  | { type: 'lane'; info: LaneTapInfo }
  | null

/* ── Station grouping (by name — MBTA lists each platform separately) ── */

interface StationGroup {
  key: string
  name: string
  lat: number
  lng: number
  dist: number
  isRail: boolean
  routes: { id: string; name: string; arrivals: { direction: string; nextMin: number | null }[] }[]
}

function groupStops(rows: MBTAStopLive[], isRail: boolean): StationGroup[] {
  const groups = new Map<string, StationGroup>()
  for (const row of rows) {
    const key = row.name.toLowerCase()
    let g = groups.get(key)
    if (!g) {
      g = { key, name: row.name, lat: row.lat, lng: row.lng, dist: row.distance_meters, isRail, routes: [] }
      groups.set(key, g)
    }
    g.dist = Math.min(g.dist, row.distance_meters)
    let route = g.routes.find(r => r.id === row.route_id)
    if (!route) {
      route = { id: row.route_id, name: row.route_name, arrivals: [] }
      g.routes.push(route)
    }
    const arrival = route.arrivals.find(a => a.direction === row.direction)
    if (!arrival) {
      route.arrivals.push({ direction: row.direction, nextMin: row.next_arrival_minutes })
    } else if (row.next_arrival_minutes !== null && (arrival.nextMin === null || row.next_arrival_minutes < arrival.nextMin)) {
      arrival.nextMin = row.next_arrival_minutes
    }
  }
  return [...groups.values()].sort((a, b) => a.dist - b.dist)
}

function routeTermini(route: StationGroup['routes'][number]): string {
  const ends = [...new Set(route.arrivals.map(a => a.direction).filter(Boolean))]
  return ends.join(' ↔ ')
}

function soonestAtStation(route: StationGroup['routes'][number]): number | null {
  const mins = route.arrivals.map(a => a.nextMin).filter((m): m is number => m !== null)
  return mins.length ? Math.min(...mins) : null
}

/** Compact frequency for list rows: "every ~11 min" / "18 trips/day" */
function freqShort(freq: TransitCorridor['frequency']): string | null {
  if (freq === null || freq === 'unavailable') return null
  if (freq.headwayMin !== null) return `every ~${freq.headwayMin} min`
  if (freq.tripsPerDay) return `${freq.tripsPerDay} trips/day`
  return null
}

const TIER_COPY: Record<string, { title: string; detail: string }> = {
  path: {
    title: 'Car-free path',
    detail: 'Fully separate from traffic — no cars at all. The most comfortable riding there is.',
  },
  protected: {
    title: 'Protected bike lane',
    detail: 'A physical barrier — curb, posts, or parking — sits between you and traffic.',
  },
  painted: {
    title: 'Painted bike lane',
    detail: 'You share the road, with paint marking your space. Fine for confident riders.',
  },
}
const SOURCE_LABEL: Record<string, string> = {
  mapc: 'MAPC TrailMap',
  massdot: 'MassDOT inventory',
  osm: 'OpenStreetMap',
}

/* ── Panel photos. Priority: curated Unsplash override → the server's
      recognizable-photo pipeline (Wikipedia lead image / vision-picked
      Places photo) → Street View aimed along the infrastructure ── */

interface SvSpec { lat: number; lng: number; heading?: number }

type PhotoSpec =
  | { kind: 'sv'; lat: number; lng: number; heading?: number }
  | { kind: 'unsplash'; id: string }
  | { kind: 'resolve'; name: string; photoKind: 'station' | 'bike' | 'line'; lat: number; lng: number; sv?: SvSpec }

/** Bearing along a corridor's geometry from the vertex nearest a point. */
function headingAlong(features: GeoJSON.Feature[], nearLat: number, nearLng: number): number | undefined {
  let best: { coords: [number, number][]; i: number; d: number } | null = null
  for (const f of features) {
    if (f.geometry.type !== 'LineString') continue
    const coords = f.geometry.coordinates as [number, number][]
    for (let i = 0; i < coords.length; i++) {
      const d = (coords[i][1] - nearLat) ** 2 + (coords[i][0] - nearLng) ** 2
      if (!best || d < best.d) best = { coords, i, d }
    }
  }
  if (!best) return undefined
  const { coords, i } = best
  const neighbor = coords[Math.min(i + 3, coords.length - 1)] ?? coords[Math.max(i - 3, 0)]
  const here = coords[i]
  if (!neighbor || (neighbor[0] === here[0] && neighbor[1] === here[1])) return undefined
  return bearingDegrees(here[1], here[0], neighbor[1], neighbor[0])
}

function corridorPhotoSpec(c: TransitCorridor | BikeCorridor): PhotoSpec {
  const curated = CORRIDOR_UNSPLASH[c.name.toLowerCase()]
  if (curated) return { kind: 'unsplash', id: curated }
  if (c.kind === 'bike') {
    const sv: SvSpec = {
      lat: c.accessPoint.lat,
      lng: c.accessPoint.lng,
      heading: headingAlong(c.geojson.features, c.accessPoint.lat, c.accessPoint.lng),
    }
    return { kind: 'resolve', name: c.name, photoKind: 'bike', lat: c.accessPoint.lat, lng: c.accessPoint.lng, sv }
  }
  const sv: SvSpec = {
    lat: c.access.lat,
    lng: c.access.lng,
    heading: c.shape ? headingAlong(c.shape.features, c.access.lat, c.access.lng) : undefined,
  }
  // Rail lines have recognizable canonical photos; bus routes don't — a
  // Street View of the boarding corner is the more useful picture there
  if (c.kind === 'bus') return { kind: 'sv', ...sv }
  return { kind: 'resolve', name: c.name, photoKind: 'line', lat: c.access.lat, lng: c.access.lng, sv }
}

function svProxyUrl(sv: SvSpec): string {
  const params = new URLSearchParams({ lat: String(sv.lat), lng: String(sv.lng) })
  if (sv.heading !== undefined) params.set('heading', String(Math.round(sv.heading)))
  return `/api/nearby/corridor-photo?${params}`
}

interface PhotoMeta { url: string; attribution?: string | null; attributionUrl?: string | null }

function PanelPhoto({ spec, alt }: { spec: PhotoSpec; alt: string }) {
  const [hidden, setHidden] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [meta, setMeta] = useState<PhotoMeta | null>(null)
  // Resolve mode degrades to the Street View spec when the pipeline has
  // nothing (or its image fails to load)
  const [useSv, setUseSv] = useState(false)

  const specKey = spec.kind === 'unsplash' ? spec.id
    : spec.kind === 'resolve' ? `${spec.photoKind}:${spec.name}`
    : `${spec.lat},${spec.lng}`
  useEffect(() => {
    setHidden(false)
    setLoaded(false)
    setMeta(null)
    setUseSv(false)
    if (spec.kind === 'sv') return
    let cancelled = false
    const url = spec.kind === 'unsplash'
      ? `/api/nearby/corridor-photo?unsplash=${encodeURIComponent(spec.id)}`
      : `/api/nearby/corridor-photo?resolve=1&name=${encodeURIComponent(spec.name)}&kind=${spec.photoKind}&lat=${spec.lat}&lng=${spec.lng}`
    fetch(url)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled) return
        if (data?.url) setMeta(data)
        else if (spec.kind === 'resolve' && spec.sv) setUseSv(true)
        else setHidden(true)
      })
      .catch(() => {
        if (cancelled) return
        if (spec.kind === 'resolve' && spec.sv) setUseSv(true)
        else setHidden(true)
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.kind, specKey])

  if (hidden) return null

  const src = spec.kind === 'sv' ? svProxyUrl(spec)
    : useSv && spec.kind === 'resolve' && spec.sv ? svProxyUrl(spec.sv)
    : meta?.url
  if (!src) return null

  // Eager load (it's one on-demand image) and collapsed until it actually
  // arrives — no empty gray block while pending, nothing at all on 404
  return (
    <div className={loaded ? 'mt-2' : 'h-0 overflow-hidden'}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="h-32 w-full rounded-lg object-cover sm:h-36"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false)
          if (!useSv && spec.kind === 'resolve' && spec.sv) {
            setMeta(null)
            setUseSv(true)
          } else {
            setHidden(true)
          }
        }}
      />
      {!useSv && meta?.attribution && (
        meta.attributionUrl ? (
          <a href={meta.attributionUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-[0.65rem] text-white/70 hover:text-white">
            {meta.attribution}
          </a>
        ) : (
          <span className="mt-0.5 block text-[0.65rem] text-white/70">{meta.attribution}</span>
        )
      )}
    </div>
  )
}

/* ── Explorer ── */

export default function CorridorExplorer({
  center, transitCorridors, bikeCorridors, rail, bus, docks,
  backgroundLines, transitStatus, onRetry,
}: Props) {
  const [selection, setSelection] = useState<Selection>(null)
  const [showPainted, setShowPainted] = useState(false)

  const corridorById = useMemo(() => {
    const m = new Map<string, TransitCorridor | BikeCorridor>()
    for (const c of transitCorridors) m.set(c.id, c)
    for (const c of bikeCorridors) m.set(c.id, c)
    return m
  }, [transitCorridors, bikeCorridors])

  // Stations, with any corridor whose boarding stop didn't make the nearby
  // cut appended as its own card — every line stays reachable from the list
  const stations = useMemo(() => {
    const groups = [...groupStops(rail, true).slice(0, 4), ...groupStops(bus, false).slice(0, 5)]
    const covered = new Set(groups.flatMap(g => g.routes.map(r => r.id)))
    for (const c of transitCorridors) {
      if (covered.has(c.routeId)) continue
      const key = c.access.stopName.toLowerCase()
      let g = groups.find(x => x.key === key)
      if (!g) {
        g = {
          key, name: c.access.stopName, lat: c.access.lat, lng: c.access.lng,
          dist: c.access.walkMin * 80, isRail: c.kind !== 'bus', routes: [],
        }
        groups.push(g)
      }
      g.routes.push({ id: c.routeId, name: c.name, arrivals: c.endpoints.filter(Boolean).map(d => ({ direction: d, nextMin: null })) })
      covered.add(c.routeId)
    }
    return groups
  }, [rail, bus, transitCorridors])

  const stationByKey = useMemo(() => new Map(stations.map(s => [s.key, s])), [stations])

  const corridorLines = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: [
      ...transitCorridors.flatMap(c => c.shape?.features ?? []),
      ...bikeCorridors.flatMap(c => c.geojson.features),
    ],
  }), [transitCorridors, bikeCorridors])

  // The map highlights a corridor when one is selected — directly, or via a
  // station that only one line serves
  const highlightedCorridorId = useMemo(() => {
    if (selection?.type === 'corridor') return selection.id
    if (selection?.type === 'station') {
      const st = stationByKey.get(selection.key)
      if (st?.routes.length === 1) return `transit:${st.routes[0].id}`
    }
    return null
  }, [selection, stationByKey])

  const select = useCallback((next: Selection, source: string) => {
    setSelection(next)
    if (next) posthog.capture('snapshot_detail_viewed', { type: next.type, source })
    if (next?.type === 'corridor') {
      posthog.capture('corridor_selected', { corridor: next.id, source })
    }
  }, [])

  const handleMarkerTap = useCallback((id: string) => {
    if (id.startsWith('rail-') || id.startsWith('bus-')) {
      select({ type: 'station', key: id.replace(/^(rail|bus)-/, '') }, 'map')
    } else if (id.startsWith('dock-')) {
      select({ type: 'dock', id: id.replace(/^dock-/, '') }, 'map')
    }
  }, [select])

  const markers = useMemo<NearbyMarker[]>(() => [
    { id: 'user', lat: center.lat, lng: center.lng, html: userDotHtml(), zIndex: 10 },
    ...groupStops(rail, true).slice(0, 4).map(g => ({
      id: `rail-${g.key}`,
      lat: g.lat,
      lng: g.lng,
      html: trainStopHtml((corridorById.get(`transit:${g.routes[0]?.id}`) as TransitCorridor | undefined)?.color ?? '#666', g.name),
      tappable: true,
      analyticsType: 'train',
      zIndex: 3,
    })),
    ...groupStops(bus, false).slice(0, 5).map(g => ({
      id: `bus-${g.key}`,
      lat: g.lat,
      lng: g.lng,
      html: busStopHtml(`${g.name} — routes ${g.routes.map(r => r.name).join(', ')}`),
      tappable: true,
      analyticsType: 'bus',
      zIndex: 2,
    })),
    ...docks.slice(0, 8).map(d => ({
      id: `dock-${d.station_id}`,
      lat: d.lat,
      lng: d.lng,
      html: bluebikeHtml(d.num_bikes_available, d.num_ebikes_available, d.name),
      tappable: true,
      analyticsType: 'bluebike',
      zIndex: 1,
    })),
  ], [center, rail, bus, docks, corridorById])

  // Boarding locations belong in the first frame even when their stations
  // didn't make the marker cut
  const accessPoints = useMemo(
    () => [
      ...transitCorridors.map(c => ({ lat: c.access.lat, lng: c.access.lng })),
      ...bikeCorridors.map(c => ({ lat: c.accessPoint.lat, lng: c.accessPoint.lng })),
    ],
    [transitCorridors, bikeCorridors]
  )

  const rowClass = (active: boolean) =>
    `flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2.5 py-2 text-left transition-colors ${
      active ? 'bg-[rgba(186,241,77,0.08)]' : 'hover:bg-white/[0.05]'
    }`

  return (
    <div>
      <NearbyMap
        center={center}
        markers={markers}
        lines={backgroundLines}
        paintedVisible={showPainted}
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
                onSelectCorridor={(id) => select({ type: 'corridor', id }, 'panel')}
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

      {/* Legend + painted toggle */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.75rem] text-white/75">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[3px] w-6 rounded bg-[#ED8B00]" /> T & bus routes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[3px] w-6 rounded bg-[#BAF14D]" /> Comfortable bike routes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2B6CB0] text-[8px] font-bold text-white">4</span> Bluebikes
        </span>
        <button
          onClick={() => setShowPainted(v => !v)}
          aria-pressed={showPainted}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold transition-colors ${
            showPainted
              ? 'border-[#7FB5FF]/60 bg-[#7FB5FF]/15 text-white'
              : 'border-white/[0.15] text-white/75 hover:border-white/[0.3]'
          }`}
        >
          <span className="inline-block h-[3px] w-6 rounded [background-image:repeating-linear-gradient(90deg,#7FB5FF_0_5px,transparent_5px_9px)]" />
          {showPainted ? 'Painted lanes shown' : 'Show painted lanes too'}
        </button>
      </div>

      {/* ── Stations first: the landmarks people actually navigate by ── */}
      <div className="mt-5">
        <div className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
          Trains & buses — stations near you
        </div>
        {transitStatus === 'loading' && <SkeletonRows count={3} />}
        {transitStatus === 'error' && <ErrorCard label="Couldn't reach the MBTA right now." onRetry={onRetry} />}
        {transitStatus === 'ready' && stations.length === 0 && (
          <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-[0.875rem] text-white/75">
            No MBTA stations or stops close to this spot — the map shows what&apos;s in the wider area.
          </p>
        )}
        <div className="space-y-2.5">
          {stations.map(st => (
            <div key={`${st.isRail ? 'r' : 'b'}-${st.key}`} className="rounded-xl border border-white/[0.08] bg-[#242538] px-3 py-3">
              {/* Station identity leads */}
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1.5">
                <span className="text-[0.95rem] font-bold text-white">{st.name}</span>
                <span className="text-[0.78rem] text-white/75">
                  {walkTimeMinutes(st.dist)} min walk · {formatDistance(st.dist)}
                </span>
              </div>
              {/* Lines serving it — tap one to light it up on the map */}
              <div className="mt-1.5 space-y-0.5">
                {st.routes.map(r => {
                  const corridor = corridorById.get(`transit:${r.id}`) as TransitCorridor | undefined
                  const active = highlightedCorridorId === `transit:${r.id}`
                  const next = soonestAtStation(r)
                  const fs = corridor ? freqShort(corridor.frequency) : null
                  return (
                    <button
                      key={r.id}
                      onClick={() => select({ type: 'corridor', id: `transit:${r.id}` }, 'list')}
                      className={rowClass(active)}
                    >
                      <span
                        className="rounded px-1.5 py-0.5 text-[0.7rem] font-bold"
                        style={{ backgroundColor: corridor?.color ?? '#666', color: corridor?.textColor ?? '#fff' }}
                      >
                        {/^\d/.test(r.name) ? `Route ${r.name}` : r.name}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[0.8rem] text-white/80">{routeTermini(r)}</span>
                      <span className="text-[0.75rem] text-white/75">
                        {corridor?.frequency === null && <span className="inline-block h-3 w-20 animate-pulse rounded bg-white/[0.08] align-middle" aria-hidden="true" />}
                        {corridor?.frequency === 'unavailable' && 'schedule unavailable'}
                        {fs}
                        {next !== null && <strong className="ml-1.5 font-bold text-[#BAF14D]">{next === 0 ? 'now' : `in ${next} min`}</strong>}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bike routes ── */}
      {bikeCorridors.length > 0 && (
        <div className="mt-5">
          <div className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
            Bike routes
          </div>
          <div className="space-y-2.5">
            {bikeCorridors.map(c => (
              <button
                key={c.id}
                onClick={() => select({ type: 'corridor', id: c.id }, 'list')}
                className={`w-full rounded-xl border px-4 py-3.5 text-left transition-colors ${
                  highlightedCorridorId === c.id
                    ? 'border-[#BAF14D]/60 bg-[rgba(186,241,77,0.06)]'
                    : 'border-white/[0.08] bg-[#242538] hover:border-white/[0.2]'
                }`}
              >
                <div className="text-[0.9rem] font-semibold text-white">{c.name}</div>
                <div className="mt-0.5 text-[0.8rem]">
                  {c.protection === 'path' && <span className="font-bold text-[#BAF14D]">Car-free path — no traffic at all</span>}
                  {c.protection === 'protected' && <span className="font-bold text-[#BAF14D]">Protected end to end — barrier from traffic</span>}
                  {c.protection === 'mostly-protected' && <span className="text-white/80">Mostly protected — some painted stretches</span>}
                  {c.protection === 'painted' && <span className="text-white/80">Painted lane — paint marks your space</span>}
                </div>
                <div className="mt-1 text-[0.8rem] text-white/80">
                  {c.lengthMiles} mi through this area · nearest point {walkTimeMinutes(c.accessDistanceMeters)} min walk ({formatDistance(c.accessDistanceMeters)})
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Bluebikes docks ── */}
      <div className="mt-5">
        <div className="mb-2.5 text-[0.7rem] font-bold uppercase tracking-wider text-white/70">
          Bluebikes docks
        </div>
        {docks.length === 0 ? (
          <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-[0.875rem] text-white/75">
            No Bluebikes docks within about a mile of this spot. The network grows every year — and your own bike works everywhere.
          </p>
        ) : (
          <div className="space-y-2.5">
            {docks.slice(0, 3).map(d => (
              <div key={d.station_id} className="rounded-xl border border-white/[0.08] bg-[#242538] px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#7FB5FF]">Bluebikes dock</div>
                    <span className="block truncate text-[0.9rem] font-semibold text-white">{d.name}</span>
                  </div>
                  <span className="text-[0.8rem] text-white/75">
                    {walkTimeMinutes(d.distance_meters)} min walk · {formatDistance(d.distance_meters)}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[0.8rem] text-white/80">
                    <strong className="font-bold text-[#BAF14D]">{dockStatsText(d.num_bikes_available, d.num_ebikes_available)}</strong>
                    {' · '}{d.num_docks_available} open docks
                  </span>
                  <a
                    href={directionsUrl(d.lat, d.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => posthog.capture('snapshot_directions_clicked', { type: 'bluebike' })}
                    className="text-[0.8rem] font-semibold text-[#BAF14D] hover:opacity-80"
                  >
                    Walk there →
                  </a>
                </div>
              </div>
            ))}
            <p className="px-1 text-[0.8rem] leading-relaxed text-white/75">{BLUEBIKES_NOTE}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Detail panel content per selection type ── */

function DetailContent({ selection, stationByKey, corridorById, docks, onSelectCorridor }: {
  selection: NonNullable<Selection>
  stationByKey: Map<string, StationGroup>
  corridorById: Map<string, TransitCorridor | BikeCorridor>
  docks: BluebikeStationLive[]
  onSelectCorridor: (id: string) => void
}) {
  if (selection.type === 'station') {
    const st = stationByKey.get(selection.key)
    if (!st) return null
    return (
      <div>
        <div className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#BAF14D]">
          {st.isRail ? 'Station' : 'Bus stop'}
        </div>
        <div className="text-[0.95rem] font-bold text-white">{st.name}</div>
        <div className="text-[0.78rem] text-white/75">
          {walkTimeMinutes(st.dist)} min walk · {formatDistance(st.dist)}
        </div>
        <div className="mt-1.5 space-y-0.5">
          {st.routes.map(r => {
            const corridor = corridorById.get(`transit:${r.id}`) as TransitCorridor | undefined
            const next = soonestAtStation(r)
            return (
              <button
                key={r.id}
                onClick={() => onSelectCorridor(`transit:${r.id}`)}
                className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-white/[0.05]"
              >
                <span
                  className="rounded px-1.5 py-0.5 text-[0.7rem] font-bold"
                  style={{ backgroundColor: corridor?.color ?? '#666', color: corridor?.textColor ?? '#fff' }}
                >
                  {/^\d/.test(r.name) ? `Route ${r.name}` : r.name}
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.78rem] text-white/80">{routeTermini(r)}</span>
                {next !== null && (
                  <strong className="text-[0.75rem] font-bold text-[#BAF14D]">{next === 0 ? 'now' : `in ${next} min`}</strong>
                )}
              </button>
            )
          })}
        </div>
        <div className="mt-1 text-[0.72rem] text-white/70">Tap a route to see the whole line on the map</div>
        <PanelPhoto
          spec={st.isRail
            ? { kind: 'resolve', name: st.name, photoKind: 'station', lat: st.lat, lng: st.lng, sv: { lat: st.lat, lng: st.lng } }
            : { kind: 'sv', lat: st.lat, lng: st.lng }}
          alt={st.name}
        />
      </div>
    )
  }

  if (selection.type === 'corridor') {
    const c = corridorById.get(selection.id)
    if (!c) return null
    if (c.kind === 'bike') {
      return (
        <div>
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#BAF14D]">Bike route — shown on the map</div>
          <div className="text-[0.95rem] font-bold text-white">{c.name}</div>
          <div className="mt-0.5 text-[0.8rem]">
            {c.protection === 'path' && <span className="font-bold text-[#BAF14D]">Car-free path — no traffic at all</span>}
            {c.protection === 'protected' && <span className="font-bold text-[#BAF14D]">Protected end to end</span>}
            {c.protection === 'mostly-protected' && <span className="text-white/80">Mostly protected — some painted stretches</span>}
            {c.protection === 'painted' && <span className="text-white/80">Painted lane — paint marks your space</span>}
          </div>
          <div className="mt-0.5 text-[0.78rem] text-white/80">
            {c.lengthMiles} mi through this area · nearest point {walkTimeMinutes(c.accessDistanceMeters)} min walk
          </div>
          <PanelPhoto spec={corridorPhotoSpec(c)} alt={c.name} />
        </div>
      )
    }
    const freq = c.frequency
    return (
      <div>
        <div className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#BAF14D]">
          {c.kind === 'bus' ? 'Bus route — shown on the map' : 'Line — shown on the map'}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <span className="rounded px-2 py-0.5 text-[0.72rem] font-bold" style={{ backgroundColor: c.color, color: c.textColor }}>
            {/^\d/.test(c.name) ? `Route ${c.name}` : c.name}
          </span>
          {(c.endpoints[0] || c.endpoints[1]) && (
            <span className="text-[0.85rem] font-semibold text-white">
              {[c.endpoints[0], c.endpoints[1]].filter(Boolean).join(' ↔ ')}
            </span>
          )}
        </div>
        <div className="mt-1 text-[0.85rem] text-white">
          {freq === null && <span className="inline-block h-4 w-44 animate-pulse rounded bg-white/[0.08]" aria-hidden="true" />}
          {freq === 'unavailable' && <span className="text-white/75">Schedule unavailable right now</span>}
          {freq !== null && freq !== 'unavailable' && (freq as FrequencyInfo).label}
        </div>
        <div className="mt-0.5 text-[0.78rem] text-white/80">
          Board at <span className="font-semibold text-white">{c.access.stopName}</span> · {c.access.walkMin} min walk
        </div>
        <PanelPhoto spec={corridorPhotoSpec(c)} alt={`${c.name} at ${c.access.stopName}`} />
      </div>
    )
  }

  if (selection.type === 'dock') {
    const d = docks.find(x => x.station_id === selection.id)
    if (!d) return null
    return (
      <div>
        <div className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#7FB5FF]">Bluebikes dock</div>
        <div className="text-[0.95rem] font-bold text-white">{d.name}</div>
        <div className="text-[0.78rem] text-white/75">
          {walkTimeMinutes(d.distance_meters)} min walk · {formatDistance(d.distance_meters)}
        </div>
        <div className="mt-1 text-[0.8rem] text-white/80">
          <strong className="font-bold text-[#BAF14D]">{dockStatsText(d.num_bikes_available, d.num_ebikes_available)}</strong>
          {' · '}{d.num_docks_available} open docks
        </div>
        <a
          href={directionsUrl(d.lat, d.lng)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => posthog.capture('snapshot_directions_clicked', { type: 'bluebike' })}
          className="mt-1 inline-block text-[0.8rem] font-semibold text-[#BAF14D] hover:opacity-80"
        >
          Walk there →
        </a>
      </div>
    )
  }

  // Unnamed lane segment
  const copy = TIER_COPY[selection.info.quality] ?? TIER_COPY.painted
  return (
    <div>
      <div className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#BAF14D]">Bike infrastructure</div>
      <div className="text-[0.95rem] font-bold text-white">{selection.info.name ?? copy.title}</div>
      <div className="mt-0.5 text-[0.8rem] leading-relaxed text-white/80">{copy.detail}</div>
      {selection.info.source && SOURCE_LABEL[selection.info.source] && (
        <div className="mt-1 text-[0.72rem] text-white/70">Data: {SOURCE_LABEL[selection.info.source]}</div>
      )}
    </div>
  )
}
