'use client'

import { useState, useEffect } from 'react'
import posthog from 'posthog-js'
import { type BorrowRentPoint } from '@/lib/nearby/borrow-rent'
import type { BluebikeStationLive } from '@/lib/wayfinding/types'
import { formatDistance, walkTimeMinutes, bikeTimeMinutes } from '@/lib/wayfinding/geo'
import { directionsUrl } from '@/lib/nearby/transit-ui'
import { BIKE_SHARE_SYSTEM_LINKS, cargobVendorLink } from '@/lib/nearby/bike-share-links'
import { CORRIDOR_UNSPLASH } from '@/lib/nearby/config'
import { protectionLabel, laneTierCopy, LANE_SOURCE_LABEL } from '@/lib/nearby/bike-labels'
import { bearingDegrees } from '@/lib/geo/polyline'
import type { TransitCorridor, BikeCorridor, FrequencyInfo } from '@/lib/nearby/corridors'
import { TrainIcon, BusIcon, FerryIcon } from '@/components/wayfinding/WayfindingIcons'
import { dockStatsText } from './markers'
import { useNearbyT } from './NearbyI18n'
import { bikeshareLogoUrl, borrowLogoUrl } from '@/lib/nearby/provider-logos'
import {
  type Selection, type StationGroup, routeEndpoints,
} from './useNearbyModel'

/**
 * The tapped-thing detail view: station / corridor / dock / lane content
 * plus its photo. Rendered pinned under the map on desktop and inside the
 * bottom sheet on mobile — same content, different frame.
 */

const SOURCE_LABEL = LANE_SOURCE_LABEL

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

export function DetailContent({ selection, stationByKey, corridorById, docks, borrowRent, onSelectCorridor }: {
  selection: NonNullable<Selection>
  stationByKey: Map<string, StationGroup>
  corridorById: Map<string, TransitCorridor | BikeCorridor>
  docks: BluebikeStationLive[]
  borrowRent: (BorrowRentPoint & { distMiles: number })[]
  onSelectCorridor: (id: string) => void
}) {
  const tr = useNearbyT()
  if (selection.type === 'station') {
    const st = stationByKey.get(selection.key)
    if (!st) return null
    return (
      <div>
        <div className="flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#BAF14D]">
          {st.routes.every(r => r.id.startsWith('Boat-')) ? <FerryIcon size={12} /> : st.isRail ? <TrainIcon size={12} /> : <BusIcon size={12} />}
          {st.routes.every(r => r.id.startsWith('Boat-')) ? tr('detail.ferry_terminal') : st.isRail ? tr('detail.station') : tr('detail.bus_stop')}
        </div>
        <div className="text-[0.95rem] font-bold text-white">{st.name}</div>
        <div className="text-[0.78rem] text-white/75">
          {tr('detail.walk_distance', { minutes: walkTimeMinutes(st.dist), distance: formatDistance(st.dist) })}
        </div>
        <div className="mt-1.5 space-y-0.5">
          {st.routes.map(r => {
            const corridor = corridorById.get(`transit:${r.id}`) as TransitCorridor | undefined
            const dirs = r.arrivals.filter(a => a.direction)
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
                  {/^\d/.test(r.name) ? tr('detail.route_name', { name: r.name }) : r.name}
                </span>
                {/* One line per direction — which WAY is the next one going? */}
                {dirs.length > 0 ? (
                  <span className="w-full space-y-0.5">
                    {dirs.map(a => (
                      <span key={a.direction} className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-[0.78rem] text-white/80">→ {a.direction}</span>
                        {a.nextMin !== null && (
                          <strong className="shrink-0 text-[0.75rem] font-bold text-[#BAF14D]">
                            {a.nextMin === 0 ? tr('detail.now') : tr('detail.in_min', { minutes: a.nextMin })}
                          </strong>
                        )}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-[0.78rem] text-white/80">{routeEndpoints(corridor, r)}</span>
                )}
              </button>
            )
          })}
        </div>
        <div className="mt-1 text-[0.72rem] text-white/70">{tr('detail.tap_route_hint')}</div>
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
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#BAF14D]">{tr('detail.bike_route_eyebrow')}</div>
          <div className="text-[0.95rem] font-bold text-white">{c.name}</div>
          <div className="mt-0.5 text-[0.8rem]">
            {(() => {
              const p = protectionLabel(c.protection, c.onewayOnly, tr)
              return <span className={p.emphasis ? 'font-bold text-[#BAF14D]' : 'text-white/80'}>{p.text}</span>
            })()}
          </div>
          <div className="mt-0.5 text-[0.78rem] text-white/80">
            {tr('detail.bike_length', { miles: c.lengthMiles, minutes: bikeTimeMinutes(c.accessDistanceMeters) })}
          </div>
          {SOURCE_LABEL[c.source] && (
            <div className="mt-1 text-[0.72rem] text-white/70">{tr('detail.data_source', { source: SOURCE_LABEL[c.source] })}</div>
          )}
          <PanelPhoto spec={corridorPhotoSpec(c)} alt={c.name} />
        </div>
      )
    }
    const freq = c.frequency
    // Both directions' next departures at the boarding stop — station groups
    // are keyed by lowercased name, and the corridor carries its access stop
    // name + routeId, so we read the same live arrivals the station detail
    // uses. Matches the app's route detail (both ways, not just one).
    const liveDirs =
      stationByKey
        .get(c.access.stopName.toLowerCase())
        ?.routes.find(r => r.id === c.routeId)
        ?.arrivals.filter(a => a.direction) ?? []
    return (
      <div>
        <div className="flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#BAF14D]">
          {c.kind === 'bus' ? <BusIcon size={12} /> : <TrainIcon size={12} />}
          {c.kind === 'bus' ? tr('detail.bus_route_eyebrow') : tr('detail.line_eyebrow')}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <span className="rounded px-2 py-0.5 text-[0.72rem] font-bold" style={{ backgroundColor: c.color, color: c.textColor }}>
            {/^\d/.test(c.name) ? tr('detail.route_name', { name: c.name }) : c.name}
          </span>
          {(c.endpoints[0] || c.endpoints[1]) && (
            <span className="text-[0.85rem] font-semibold text-white">
              {[c.endpoints[0], c.endpoints[1]].filter(Boolean).join(' ↔ ')}
            </span>
          )}
        </div>
        <div className="mt-1 text-[0.85rem] text-white">
          {freq === null && <span className="inline-block h-4 w-44 animate-pulse rounded bg-white/[0.08]" aria-hidden="true" />}
          {freq === 'unavailable' && <span className="text-white/75">{tr('detail.schedule_unavailable')}</span>}
          {freq !== null && freq !== 'unavailable' && (freq as FrequencyInfo).label}
        </div>
        <div className="mt-0.5 text-[0.78rem] text-white/80">
          {tr('detail.board_at', { stop: c.access.stopName, minutes: c.access.walkMin })}
        </div>
        {liveDirs.length > 0 && (
          <div className="mt-2 space-y-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2">
            {liveDirs.map(a => (
              <div key={a.direction} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[0.8rem] text-white/80">→ {a.direction}</span>
                {a.nextMin !== null && (
                  <strong className="shrink-0 text-[0.8rem] font-bold text-[#BAF14D]">
                    {a.nextMin === 0 ? tr('detail.now') : tr('detail.in_min', { minutes: a.nextMin })}
                  </strong>
                )}
              </div>
            ))}
          </div>
        )}
        <AllStops corridor={c} />
        <PanelPhoto spec={corridorPhotoSpec(c)} alt={tr('detail.photo_alt_at', { name: c.name, stop: c.access.stopName })} />
      </div>
    )
  }

  if (selection.type === 'dock') {
    const d = docks.find(x => x.station_id === selection.id)
    if (!d) return null
    return (
      <div>
        <div className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#7FB5FF]">
          {(() => {
            const logo = bikeshareLogoUrl(d.system_id ?? 'bluebikes')
            return logo
              ? <><img src={logo} alt="" className="h-4 w-auto" />{tr('detail.dock_label')}</>
              : tr('detail.bike_share_dock', { system: d.system_name ?? 'Bluebikes' })
          })()}
        </div>
        <div className="text-[0.95rem] font-bold text-white">{d.name}</div>
        <div className="text-[0.78rem] text-white/75">
          {tr('detail.walk_distance', { minutes: walkTimeMinutes(d.distance_meters), distance: formatDistance(d.distance_meters) })}
        </div>
        <div className="mt-1 text-[0.8rem] text-white/80">
          <strong className="font-bold text-[#BAF14D]">{dockStatsText(d.num_bikes_available, d.num_ebikes_available, tr)}</strong>
          {' · '}{tr('detail.open_docks', { count: d.num_docks_available })}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <a
            href={directionsUrl(d.lat, d.lng)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => posthog.capture('snapshot_directions_clicked', { type: d.system_id ?? 'bluebike' })}
            className="text-[0.8rem] font-semibold text-[#BAF14D] hover:opacity-80"
          >
            {tr('detail.walk_there')}
          </a>
          {(() => {
            // Vendor action: the system's official smart link opens the
            // vendor app when installed (falls back to their site); systems
            // without one get a plain site link.
            const links = BIKE_SHARE_SYSTEM_LINKS[d.system_id ?? 'bluebikes']
            if (!links) return null
            return (
              <a
                href={links.appUrl ?? links.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => posthog.capture('snapshot_vendor_app_clicked', {
                  system: d.system_id ?? 'bluebikes',
                  target: links.appUrl ? 'app' : 'site',
                })}
                className="text-[0.8rem] font-semibold text-[#BAF14D] hover:opacity-80"
              >
                {links.appUrl
                  ? tr('detail.open_vendor_app', { system: d.system_name ?? 'Bluebikes' })
                  : tr('detail.open_site')}
              </a>
            )
          })()}
        </div>
      </div>
    )
  }

  // Borrow & rent point — CargoB hub or Community Pedal Power pickup
  if (selection.type === 'borrow') {
    const p = borrowRent.find(x => x.id === selection.id)
    if (!p) return null
    // CargoB rents through its app: phones get the store link (an installed
    // app shows "Open" there), desktop keeps the site. Pedal Power has no
    // app — site everywhere.
    const vendor = p.org === 'cargob'
      ? cargobVendorLink(p.url)
      : { url: p.url, target: 'site' as const }
    return (
      <div>
        <div className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#EDB93C]">
          {(() => {
            const logo = borrowLogoUrl(p.org)
            return logo ? <img src={logo} alt="" className="h-5 w-auto" /> : null
          })()}
          {tr('detail.borrow_rent_eyebrow')}
        </div>
        <div className="text-[0.95rem] font-bold text-white">{p.name}</div>
        <div className="text-[0.78rem] text-white/75">
          {tr('detail.walk_distance', { minutes: walkTimeMinutes(p.distMiles * 1609.34), distance: formatDistance(p.distMiles * 1609.34) })}
        </div>
        <div className="mt-1 text-[0.82rem] text-white/80">
          {tr(p.org === 'cargob' ? 'borrow.cargob' : 'borrow.pedal_power')}
          {p.approximate ? tr('detail.exact_address_note') : ''}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {/* Approximate pickup areas (Pedal Power centroids) get no
              directions link — a confident walk to a wrong address is
              worse than none. */}
          {!p.approximate && (
            <a
              href={directionsUrl(p.lat, p.lng)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => posthog.capture('snapshot_directions_clicked', { type: 'borrow', org: p.org })}
              className="text-[0.8rem] font-semibold text-[#BAF14D] hover:opacity-80"
            >
              {tr('detail.walk_there')}
            </a>
          )}
          <a
            href={vendor.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => posthog.capture('snapshot_borrow_clicked', { org: p.org, target: vendor.target })}
            className="text-[0.8rem] font-semibold text-[#BAF14D] hover:opacity-80"
          >
            {vendor.target === 'app_store'
              ? tr('detail.get_vendor_app', { name: 'CargoB' })
              : tr('detail.open_site')}
          </a>
        </div>
      </div>
    )
  }

  // Background lane segment — named when the data knows the street
  if (selection.type === 'lane') {
    const copy = laneTierCopy(selection.info.quality, tr)
    return (
      <div>
        <div className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#BAF14D]">{tr('detail.bike_infra_eyebrow')}</div>
        <div className="text-[0.95rem] font-bold text-white">{selection.info.name ?? copy.title}</div>
        <div className="mt-0.5 text-[0.8rem] leading-relaxed text-white/80">
          {selection.info.name && <span className="font-semibold text-white">{copy.title} — </span>}
          {copy.detail}
        </div>
        {selection.info.source && SOURCE_LABEL[selection.info.source] && (
          <div className="mt-1 text-[0.72rem] text-white/70">
            {tr('detail.data_source', { source: SOURCE_LABEL[selection.info.source] })}
            {selection.info.nameInferred && tr('detail.name_inferred_note')}
          </div>
        )}
      </div>
    )
  }

  // 'reach' renders via the shell's own ReachDetail — nothing to show here
  return null
}

/* ── Every stop along the selected route, expanding IN PLACE under the card.
      Direction chips are labeled by destination ("toward Medford/Tufts") so a
      new rider can orient the loop; their boarding stop is highlighted. ── */

function AllStops({ corridor: c }: { corridor: TransitCorridor }) {
  const tr = useNearbyT()
  const [open, setOpen] = useState(false)
  const [dirIdx, setDirIdx] = useState(0)
  const dirs = c.directions ?? []
  if (dirs.length === 0) return null

  const active = dirs[Math.min(dirIdx, dirs.length - 1)]
  const accessName = c.access.stopName.toLowerCase()
  // Rail access stops can be parent "place-…" ids while route stops are
  // platforms (or vice versa) — the name match covers the id mismatch
  const isBoarding = (s: { id: string; name: string }) =>
    s.id === c.access.stopId || s.name.toLowerCase() === accessName

  return (
    <div className="mt-2">
      <button
        onClick={() => {
          if (!open) posthog.capture('snapshot_stops_expanded', { route: c.routeId })
          setOpen(o => !o)
        }}
        aria-expanded={open}
        className="text-[0.8rem] font-semibold text-[#BAF14D] hover:opacity-80"
      >
        {open ? tr('detail.hide_stops') : tr('detail.see_all_stops', { count: active.stops.length })}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
          {dirs.length > 1 && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {dirs.map((d, i) => {
                const dest = c.endpoints[d.directionId] || tr('detail.direction_n', { number: d.directionId + 1 })
                const activeChip = i === Math.min(dirIdx, dirs.length - 1)
                return (
                  <button
                    key={d.directionId}
                    onClick={() => setDirIdx(i)}
                    aria-pressed={activeChip}
                    className={`rounded-full border px-2.5 py-0.5 text-[0.72rem] font-semibold transition-colors ${
                      activeChip
                        ? 'border-[#BAF14D]/60 bg-[rgba(186,241,77,0.12)] text-white'
                        : 'border-white/[0.15] text-white/75 hover:border-white/[0.3]'
                    }`}
                  >
                    {tr('detail.toward', { dest })}
                  </button>
                )
              })}
            </div>
          )}
          <ol className="max-h-52 space-y-1 overflow-y-auto pr-1">
            {active.stops.map(s => {
              const here = isBoarding(s)
              return (
                <li key={s.id} className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${here ? 'bg-[#BAF14D]' : 'bg-white/60'}`} aria-hidden="true" />
                  <span className={`text-[0.8rem] ${here ? 'font-bold text-white' : 'text-white/80'}`}>
                    {s.name}
                    {here && <span className="ml-1.5 text-[0.72rem] font-semibold text-[#BAF14D]">{tr('detail.your_stop')}</span>}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )
}
