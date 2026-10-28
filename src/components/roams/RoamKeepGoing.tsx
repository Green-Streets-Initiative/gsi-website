'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { gaEvent } from '@/lib/ga'
import type { KeepGoingRow } from '@/lib/roams/queries'
import { QUIET_STYLE, LABEL_FONT_BOLD, quietBasemap } from '@/lib/maps/quietBasemap'

/**
 * "Keep going" (Keith 2026-10-20): from either end of this roam, where you can
 * keep riding on paths and protected lanes. The map is open: the faint
 * Greater Boston bike-path network, this roam in blue, each destination in
 * green, closures dashed red. The destinations are one collapsed list with the
 * same columns (where to, starts at, length, how much is protected); opening a
 * row lights its line in gold, fits the map to it, and shows its steps and the
 * roam that rides it.
 */

type LngLat = [number, number]

const BAR_COLOR: Record<string, string> = { protected: '#2D6A4F', street: '#C2410C', closed: '#C2410C' }

function bounds(lines: LngLat[][]): [LngLat, LngLat] | null {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90
  for (const l of lines) for (const [x, y] of l) {
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
  return x0 <= x1 ? [[x0, y0], [x1, y1]] : null
}

function Bar({ row }: { row: KeepGoingRow }) {
  return (
    <span className="flex h-1.5 w-[72px] shrink-0 gap-[2px] overflow-hidden rounded-full bg-navy/[0.08] sm:w-[110px]" aria-hidden>
      {row.bar.map((b, i) => (
        <span key={i} style={{ flex: b.share, backgroundColor: BAR_COLOR[b.kind] ?? '#2D6A4F' }} />
      ))}
    </span>
  )
}

export default function RoamKeepGoing({
  roamId,
  roamName,
  subject = 'roam',
  route,
  routeLines,
  quiet = false,
  places = [],
  rows,
  closed,
}: {
  roamId: string
  roamName: string
  /** 'trail' on the /trails pages: the legend says "This trail". */
  subject?: 'roam' | 'trail'
  route: LngLat[] | null
  /** Trail pages: the whole trail as several lines, drawn in place of `route`. */
  routeLines?: LngLat[][]
  /** Trail pages: the quiet basemap used on /trails, with place names. */
  quiet?: boolean
  places?: Array<{ label: string; lat: number; lng: number }>
  rows: KeepGoingRow[]
  /** closed stretches near this roam ([lng, lat][] each) */
  closed: LngLat[][]
}) {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('maplibre-gl').Map | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const own: LngLat[][] = routeLines && routeLines.length > 0 ? routeLines : route && route.length > 1 ? [route] : []
  const allLines = [...own, ...rows.flatMap((r) => r.lines ?? [])]

  useEffect(() => {
    if (!mapEl.current) return
    let cancelled = false
    ;(async () => {
      const maplibregl = await import('maplibre-gl')
      if (cancelled || !mapEl.current) return
      const b = bounds(allLines)
      const map = new maplibregl.Map({
        container: mapEl.current,
        style: quiet ? QUIET_STYLE : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        bounds: b ?? undefined,
        fitBoundsOptions: { padding: 36 },
        attributionControl: false,
        cooperativeGestures: true,
      })
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      mapRef.current = map
      map.on('load', async () => {
        if (quiet) quietBasemap(map)
        if (b) map.fitBounds(b, { padding: 36, animate: false })
        try {
          const net = await fetch('/data/bike-network-greater-boston.json').then((r) => r.json())
          map.addSource('kg-net', { type: 'geojson', data: net })
          map.addLayer({ id: 'kg-net', type: 'line', source: 'kg-net', paint: { 'line-color': '#5E8466', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.9, 14, 1.8], 'line-opacity': 0.55 } })
        } catch {
          // The network is context only; the page works without it.
        }
        const features = rows.flatMap((r) =>
          (r.lines ?? []).map((l) => ({ type: 'Feature' as const, properties: { key: r.key }, geometry: { type: 'LineString' as const, coordinates: l } })),
        )
        map.addSource('kg-dest', { type: 'geojson', data: { type: 'FeatureCollection', features } })
        map.addLayer({ id: 'kg-halo', type: 'line', source: 'kg-dest', filter: ['==', ['get', 'key'], '__none__'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#EDB93C', 'line-width': 10, 'line-opacity': 0.55 } })
        map.addLayer({ id: 'kg-dest', type: 'line', source: 'kg-dest', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2D6A4F', 'line-width': 2.8, 'line-opacity': 0.85 } })
        if (closed.length) {
          map.addSource('kg-closed', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: closed } } })
          map.addLayer({ id: 'kg-closed', type: 'line', source: 'kg-closed', paint: { 'line-color': '#C2410C', 'line-width': 3, 'line-dasharray': [1.5, 1.2] } })
        }
        if (routeLines && routeLines.length > 0) {
          map.addSource('kg-roam', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: routeLines } } })
          map.addLayer({ id: 'kg-roam', type: 'line', source: 'kg-roam', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2966E5', 'line-width': 4.5 } })
        } else if (route && route.length > 1) {
          map.addSource('kg-roam', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route } } })
          map.addLayer({ id: 'kg-roam', type: 'line', source: 'kg-roam', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2966E5', 'line-width': 4.5 } })
          for (const p of [route[0], route[route.length - 1]]) {
            const el = document.createElement('div')
            el.style.cssText = 'width:13px;height:13px;border-radius:50%;background:#2966E5;border:2.5px solid #fff;box-shadow:0 1px 3px rgba(25,26,46,.35)'
            new maplibregl.Marker({ element: el }).setLngLat(p).addTo(map)
          }
        }
        if (quiet && places.length > 0) {
          map.addSource('kg-places', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: places.map((p) => ({ type: 'Feature', properties: { label: p.label }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })) },
          })
          map.addLayer({ id: 'kg-places-ring', type: 'circle', source: 'kg-places', paint: { 'circle-radius': 4.5, 'circle-color': '#FFFFFF', 'circle-stroke-color': '#191A2E', 'circle-stroke-width': 2 } })
          map.addLayer({
            id: 'kg-places',
            type: 'symbol',
            source: 'kg-places',
            layout: { 'text-field': ['get', 'label'], 'text-font': LABEL_FONT_BOLD, 'text-size': 12, 'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 0.8, 'text-padding': 4 },
            paint: { 'text-color': '#191A2E', 'text-halo-color': '#FAFAF6', 'text-halo-width': 2 },
          })
        }
        setReady(true)
      })
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // Static per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Light the open row's line and fit the map to it (with this roam's nearer end in view).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.setFilter('kg-halo', ['==', ['get', 'key'], open ?? '__none__'])
    const row = rows.find((r) => r.key === open)
    // The open route together with this roam, so the link between them shows.
    // On a long trail, only the part of it near where the row starts.
    const start = row?.lines?.[0]?.[0]
    const near = routeLines && start ? own.filter((l) => l.some(([x, y]) => Math.abs(x - start[0]) < 0.03 && Math.abs(y - start[1]) < 0.02)) : own
    const b = bounds(row?.lines?.length ? [...row.lines, ...near] : allLines)
    if (b) map.fitBounds(b, { padding: 44, maxZoom: 15, duration: 600 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready])

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)] lg:sticky lg:top-[124px]">
        <div ref={mapEl} className="h-[300px] w-full sm:h-[380px] lg:h-[460px]" role="img" aria-label={`Map of bike paths around the ${roamName}, with the routes you can take from its ends`} />
        <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-navy/[0.07] px-4 py-2.5 text-[0.8125rem] text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-1 w-4 rounded bg-[#2966E5]" aria-hidden /> {subject === 'trail' ? 'This trail' : 'This roam'}</span>
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-1 w-4 rounded bg-[#2D6A4F]" aria-hidden /> Where you can keep going</span>
          {closed.length > 0 && <span className="inline-flex items-center gap-1.5"><i className="inline-block h-1 w-4 rounded bg-[#C2410C]" aria-hidden /> Closed</span>}
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-1 w-4 rounded bg-[#5E8466]/60" aria-hidden /> Other bike paths</span>
        </p>
      </div>

      <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)]">
        <div className="hidden grid-cols-[minmax(0,1fr)_128px_86px_16px] gap-x-3 border-b border-navy/[0.07] px-5 py-2.5 text-[0.8125rem] font-semibold text-ink-soft sm:grid" aria-hidden>
          <span>Where to</span><span>Starts at</span><span>Length</span><span />
        </div>
        <ul>
          {rows.map((r, i) => {
            const isOpen = open === r.key
            return (
              <li key={r.key} className={i > 0 ? 'border-t border-navy/[0.07]' : ''}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`kg-${r.key}`}
                  onClick={() => {
                    if (!isOpen) gaEvent('roam_keep_going_opened', { roam_id: roamId, destination: r.key })
                    setOpen(isOpen ? null : r.key)
                    // On phones the map sits above the list: bring it into view to show the route.
                    if (!isOpen && window.matchMedia('(max-width: 1023px)').matches) {
                      mapEl.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                  }}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto_18px] gap-x-3 gap-y-1.5 px-4 py-3.5 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_128px_86px_16px] sm:px-5 ${
                    isOpen ? 'bg-[#FFFBEF] shadow-[inset_3px_0_0_#EDB93C]' : 'hover:bg-cream/60'
                  }`}
                >
                  <span className="col-span-2 text-[1rem] font-semibold text-navy sm:col-span-1">{r.title}</span>
                  <span className="col-start-1 row-start-2 text-[0.875rem] text-navy sm:col-start-auto sm:row-start-auto">
                    <span className="sm:hidden">Starts at </span>{r.start_label}
                    {r.start_note && <span className="ml-1.5 text-[0.8125rem] text-ink-soft sm:ml-0 sm:block">{r.start_note}</span>}
                  </span>
                  <span className="col-start-2 row-start-2 text-right text-[0.875rem] font-semibold tabular-nums text-navy sm:col-start-auto sm:row-start-auto sm:text-left">{r.length_label}</span>
                  <ChevronDown size={16} className={`col-start-3 row-start-1 justify-self-end text-ink-soft transition-transform sm:col-start-auto sm:row-start-auto ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                  <span className="col-span-full flex items-center gap-2.5">
                    <Bar row={r} />
                    {r.bar_note && <span className="text-[0.8125rem] leading-snug text-ink-soft">{r.bar_note}</span>}
                  </span>
                </button>
                {isOpen && (
                  <div id={`kg-${r.key}`} className="bg-[#FFFBEF] px-4 pb-4 pt-1 sm:px-5">
                    <ol className="mt-1.5">
                      {r.steps.map((s, j) => (
                        <li key={j} className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-2.5 pb-3 last:pb-0">
                          {j < r.steps.length - 1 && <span className="absolute left-[9px] top-[18px] bottom-0 w-[2px] bg-navy/[0.1]" aria-hidden />}
                          <span
                            className={`relative mt-0.5 h-5 w-5 rounded-full border-2 ${s.kind === 'here' ? 'border-[#2966E5] bg-[#2966E5]' : s.kind === 'closed' ? 'border-[#C2410C] bg-white' : 'border-forest bg-white'}`}
                            aria-hidden
                          />
                          <span>
                            <span className="block text-[0.9375rem] font-semibold text-navy">{s.title}</span>
                            {s.note && <span className={`block text-[0.875rem] leading-snug ${s.kind === 'closed' ? 'text-[#9A3412]' : 'text-ink-soft'}`}>{s.note}</span>}
                          </span>
                        </li>
                      ))}
                    </ol>
                    {r.linked_trail_id && (
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <Link
                          href={`/trails/${r.linked_trail_id}`}
                          onClick={() => gaEvent('trail_keep_going_trail_link', { from: roamId, to: r.linked_trail_id })}
                          className="inline-flex min-h-[44px] items-center rounded-full bg-navy px-5 text-[0.9375rem] font-semibold text-white hover:bg-navy/90"
                        >
                          {r.link_label ?? 'See the trail'} →
                        </Link>
                        {r.linked_roam_id && (
                          <Link
                            href={`/shift/roams/${r.linked_roam_id}`}
                            onClick={() => gaEvent('roam_keep_going_roam_link', { roam_id: roamId, to: r.linked_roam_id })}
                            className="inline-flex min-h-[44px] items-center text-[0.9375rem] font-semibold text-forest underline-offset-4 hover:underline"
                          >
                            or ride it as a roam
                          </Link>
                        )}
                      </div>
                    )}
                    {!r.linked_trail_id && r.linked_roam_id && r.link_label && (
                      <Link
                        href={`/shift/roams/${r.linked_roam_id}`}
                        onClick={() => gaEvent('roam_keep_going_roam_link', { roam_id: roamId, to: r.linked_roam_id })}
                        className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-navy px-5 text-[0.9375rem] font-semibold text-white hover:bg-navy/90"
                      >
                        {r.link_label} →
                      </Link>
                    )}
                    {!r.linked_trail_id && !r.linked_roam_id && r.action_url && r.action_label && (
                      <a
                        href={r.action_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => gaEvent('roam_keep_going_directions', { roam_id: roamId, destination: r.key })}
                        className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-navy px-5 text-[0.9375rem] font-semibold text-white hover:bg-navy/90"
                      >
                        {r.action_label} ↗
                      </a>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
