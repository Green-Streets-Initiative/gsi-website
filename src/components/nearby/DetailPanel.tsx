'use client'

import { useState, useEffect } from 'react'
import posthog from 'posthog-js'
import type { BluebikeStationLive } from '@/lib/wayfinding/types'
import { formatDistance, walkTimeMinutes } from '@/lib/wayfinding/geo'
import { directionsUrl } from '@/lib/nearby/transit-ui'
import { CORRIDOR_UNSPLASH } from '@/lib/nearby/config'
import { bearingDegrees } from '@/lib/geo/polyline'
import type { TransitCorridor, BikeCorridor, FrequencyInfo } from '@/lib/nearby/corridors'
import { dockStatsText } from './markers'
import {
  type Selection, type StationGroup, routeTermini, soonestAtStation,
} from './useNearbyModel'

/**
 * The tapped-thing detail view: station / corridor / dock / lane content
 * plus its photo. Rendered pinned under the map on desktop and inside the
 * bottom sheet on mobile — same content, different frame.
 */

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

export interface SvSpec { lat: number; lng: number; heading?: number }

export type PhotoSpec =
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

export function corridorPhotoSpec(c: TransitCorridor | BikeCorridor): PhotoSpec {
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

export function PanelPhoto({ spec, alt }: { spec: PhotoSpec; alt: string }) {
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

/* ── Detail content per selection type ── */

export function DetailContent({ selection, stationByKey, corridorById, docks, onSelectCorridor }: {
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
