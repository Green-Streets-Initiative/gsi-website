'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, TriangleAlert } from 'lucide-react'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { TrailSummary } from '@/lib/trails/queries'
import { QUIET_STYLE, LABEL_FONT_BOLD, quietBasemap } from '@/lib/maps/quietBasemap'

let maplibrePromise: Promise<typeof import('maplibre-gl')> | null = null
function loadMaplibre() {
  if (!maplibrePromise) maplibrePromise = import('maplibre-gl')
  return maplibrePromise
}

type LngLat = [number, number]
export type NetworkTrail = { id: string; name: string; lines: LngLat[][] }

export interface Region {
  id: string
  label: string
  trails: TrailSummary[]
}

const GREEN = '#2D6A4F'
const GOLD = '#EDB93C'
const NAVY = '#191A2E'
const CLOSED = '#C2410C'

function miles(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

function boundsOf(lines: LngLat[][]): [LngLat, LngLat] | null {
  const pts = lines.flat()
  if (pts.length === 0) return null
  let a = pts[0][0], b = pts[0][1], c = pts[0][0], d = pts[0][1]
  for (const [x, y] of pts) {
    if (x < a) a = x
    if (y < b) b = y
    if (x > c) c = x
    if (y > d) d = y
  }
  return [[a, b], [c, d]]
}

/**
 * /trails: every trail on one quiet map in the Keep going mock-up's style
 * (Keith 2026-10-21): the paths are the map, each named along its line, with
 * its ends marked; the faint network of other bike paths behind; closures
 * dotted orange. The list beside it is grouped by area; choosing an area fits
 * the map to it, pointing at a row lights its trail, and tapping a trail on
 * the map opens its page.
 */
export default function TrailIndex({ regions, network }: { regions: Region[]; network: NetworkTrail[] }) {
  const router = useRouter()
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [ready, setReady] = useState(false)
  const [region, setRegion] = useState(regions[0]?.id ?? '')
  const [hover, setHover] = useState<string | null>(null)

  const byId = useMemo(() => new Map(network.map((n) => [n.id, n])), [network])
  const current = regions.find((r) => r.id === region) ?? regions[0]
  const allTrails = useMemo(() => regions.flatMap((r) => r.trails), [regions])
  const hasClosed = allTrails.some((t) => t.closed_lines.length > 0)

  const regionBounds = (r: Region | undefined) =>
    r ? boundsOf(r.trails.flatMap((t) => [...(byId.get(t.id)?.lines ?? []), ...t.ends.map((e) => [[e.lng, e.lat]] as LngLat[])])) : null

  const fitRegion = (r: Region | undefined, animate: boolean) => {
    const map = mapRef.current
    const b = regionBounds(r)
    if (!map || !b) return
    map.resize()
    map.fitBounds(b, { padding: { top: 56, bottom: 72, left: 72, right: 72 }, maxZoom: 13, animate, duration: 700 })
  }

  useEffect(() => {
    if (!mapEl.current) return
    let cancelled = false
    ;(async () => {
      const maplibregl = await loadMaplibre()
      if (cancelled || !mapEl.current) return
      const b = regionBounds(current) ?? [[-71.3, 42.2], [-70.9, 42.5]]
      const map = new maplibregl.Map({
        container: mapEl.current,
        style: QUIET_STYLE,
        bounds: b,
        fitBoundsOptions: { padding: 48 },
        attributionControl: false,
        cooperativeGestures: true,
      })
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      mapRef.current = map
      map.on('load', async () => {
        quietBasemap(map)
        fitRegion(current, false)

        // The other bike paths, faint, for context (Greater Boston).
        try {
          const net = await fetch('/data/bike-network-greater-boston.json').then((r) => r.json())
          map.addSource('net', { type: 'geojson', data: net })
          map.addLayer({ id: 'net', type: 'line', source: 'net', paint: { 'line-color': '#AEBDAB', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 14, 1.8], 'line-opacity': 0.75 } })
        } catch {
          // Context only.
        }

        map.addSource('trails', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: network.map((n) => ({
              type: 'Feature',
              properties: { id: n.id, name: n.name },
              geometry: { type: 'MultiLineString', coordinates: n.lines },
            })),
          },
        })
        const width = ['interpolate', ['linear'], ['zoom'], 8, 2.2, 11, 3.2, 14, 4.6] as unknown as number
        map.addLayer({ id: 'trails-hit', type: 'line', source: 'trails', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': GREEN, 'line-width': 16, 'line-opacity': 0 } })
        map.addLayer({ id: 'trails-casing', type: 'line', source: 'trails', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4.2, 11, 5.6, 14, 7.6], 'line-opacity': 0.9 } })
        map.addLayer({ id: 'trails-halo', type: 'line', source: 'trails', filter: ['==', ['get', 'id'], ''], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': GOLD, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 7, 14, 12], 'line-opacity': 0.75 } })
        map.addLayer({ id: 'trails-line', type: 'line', source: 'trails', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': GREEN, 'line-width': width, 'line-opacity': 0.92 } })

        const closed = allTrails.flatMap((t) => t.closed_lines)
        if (closed.length > 0) {
          map.addSource('closed', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: closed } } })
          map.addLayer({ id: 'closed', type: 'line', source: 'closed', layout: { 'line-cap': 'round' }, paint: { 'line-color': CLOSED, 'line-width': 3.5, 'line-dasharray': [0.6, 1.6] } })
        }

        // Places: hollow rings with a name, as in the mock-up (lib/trails/places.ts).
        const seen = new Set<string>()
        const ends = allTrails.flatMap((t) =>
          t.places
            .filter((e) => {
              if (seen.has(e.label)) return false
              seen.add(e.label)
              return true
            })
            .map((e) => ({ type: 'Feature' as const, properties: { label: e.label, id: t.id }, geometry: { type: 'Point' as const, coordinates: [e.lng, e.lat] } })),
        )
        map.addSource('ends', { type: 'geojson', data: { type: 'FeatureCollection', features: ends } })
        map.addLayer({
          id: 'ends-ring',
          type: 'circle',
          source: 'ends',
          minzoom: 9,
          paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3.5, 13, 5.5], 'circle-color': '#FFFFFF', 'circle-stroke-color': NAVY, 'circle-stroke-width': 2 },
        })
        map.addLayer({
          id: 'ends-label',
          type: 'symbol',
          source: 'ends',
          minzoom: 9.5,
          layout: {
            'text-field': ['get', 'label'],
            'text-font': LABEL_FONT_BOLD,
            'text-size': ['interpolate', ['linear'], ['zoom'], 9.5, 10.5, 13, 12.5],
            'symbol-sort-key': 2,
            'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
            'text-radial-offset': 0.8,
            'text-padding': 4,
          },
          paint: { 'text-color': NAVY, 'text-halo-color': '#FAFAF6', 'text-halo-width': 1.8 },
        })

        // Trail names, one per trail, beside the middle of its longest stretch
        // (most trails are many short pieces, too short to carry a label along them).
        const labelPts = network.flatMap((n) => {
          const longest = n.lines.reduce<LngLat[]>((best, l) => (l.length > best.length ? l : best), [])
          const mid = longest[Math.floor(longest.length / 2)]
          return mid ? [{ type: 'Feature' as const, properties: { name: n.name }, geometry: { type: 'Point' as const, coordinates: mid } }] : []
        })
        map.addSource('trail-names', { type: 'geojson', data: { type: 'FeatureCollection', features: labelPts } })
        map.addLayer({
          id: 'trails-label',
          type: 'symbol',
          source: 'trail-names',
          layout: {
            'text-field': ['get', 'name'],
            'text-font': LABEL_FONT_BOLD,
            'text-size': ['interpolate', ['linear'], ['zoom'], 8, 11.5, 13, 14],
            'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
            'text-radial-offset': 0.9,
            'text-justify': 'auto',
            'text-max-width': 9,
            'text-padding': 3,
          },
          paint: { 'text-color': GREEN, 'text-halo-color': '#FAFAF6', 'text-halo-width': 2 },
        })

        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 })
        map.on('mousemove', 'trails-hit', (e) => {
          const f = e.features?.[0]
          if (!f) return
          map.getCanvas().style.cursor = 'pointer'
          setHover(f.properties?.id as string)
          popup
            .setLngLat(e.lngLat)
            .setHTML(`<div style="font-size:13px;font-weight:600;color:${NAVY};padding:2px 4px">${String(f.properties?.name ?? '').replace(/[&<>"]/g, '')}</div>`)
            .addTo(map)
        })
        map.on('mouseleave', 'trails-hit', () => {
          map.getCanvas().style.cursor = ''
          setHover(null)
          popup.remove()
        })
        map.on('click', 'trails-hit', (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined
          if (id) router.push(`/trails/${id}`)
        })
        setReady(true)
      })
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // Built once; region and hover update it below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const f: maplibregl.FilterSpecification = ['==', ['get', 'id'], hover ?? '']
    map.setFilter('trails-halo', f)
  }, [hover, ready])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
      <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)] lg:sticky lg:top-[84px]">
        <div ref={mapEl} className="h-[280px] w-full sm:h-[440px] lg:h-[clamp(420px,calc(100vh-200px),640px)]" role="img" aria-label="Map of the trails on this page" />
        <p className="flex flex-wrap gap-x-5 gap-y-1 border-t border-navy/[0.07] px-4 py-2.5 text-[0.8125rem] text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-1 w-5 rounded" style={{ background: GREEN }} aria-hidden /> Trails on this page</span>
          {hasClosed && (
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-flex w-5 justify-between" aria-hidden>
                {[0, 1, 2].map((i) => <i key={i} className="inline-block h-1 w-1 rounded-full" style={{ background: CLOSED }} />)}
              </i>{' '}
              Closed
            </span>
          )}
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[2px] w-5 rounded" style={{ background: '#B9C7B7' }} aria-hidden /> Other bike paths</span>
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full border-2 bg-white" style={{ borderColor: NAVY }} aria-hidden /> Places along the trails</span>
        </p>
      </div>
      <div className="min-w-0">
        {/* One row that scrolls sideways on phones, so the list starts on the first screen. */}
        <div role="tablist" aria-label="Area" className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">

          {regions.map((r) => (
            <button
              key={r.id}
              role="tab"
              type="button"
              aria-selected={r.id === region}
              onClick={() => {
                setRegion(r.id)
                fitRegion(r, true)
              }}
              className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-full px-4 text-[0.875rem] font-semibold transition-colors ${r.id === region ? 'bg-navy text-white' : 'bg-white text-navy ring-1 ring-navy/15 hover:bg-navy/[0.04]'}`}
            >
              {r.label} <span className={r.id === region ? 'text-white/75' : 'text-ink-soft'}>{r.trails.length}</span>
            </button>
          ))}
        </div>
        <ul className="mt-4 divide-y divide-navy/[0.07] overflow-hidden rounded-[16px] bg-white shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)]">
          {current?.trails.map((t) => (
            <li key={t.id} onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)}>
              <Link
                href={`/trails/${t.id}`}
                onFocus={() => setHover(t.id)}
                onBlur={() => setHover(null)}
                className={`group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3.5 transition-colors sm:px-5 ${hover === t.id ? 'bg-[#EDB93C]/[0.10]' : 'hover:bg-navy/[0.02]'}`}
              >
                <span className="min-w-0">
                  <span className="block text-[1rem] font-semibold leading-snug text-navy">{t.name}</span>
                  <span className="mt-0.5 block text-[0.875rem] leading-snug text-ink-soft">
                    {t.from_label && t.to_label ? `${t.from_label} to ${t.to_label}` : t.towns.join(', ')}
                  </span>
                  {t.closed && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-[#9A3412]">
                      <TriangleAlert size={12} aria-hidden /> Part of it is closed
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  {t.full_miles ? <span className="text-[0.9375rem] font-semibold tabular-nums text-navy">{miles(t.full_miles)} mi</span> : null}
                  <ArrowRight size={16} className="text-forest transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
