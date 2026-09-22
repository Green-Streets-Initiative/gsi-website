'use client'

import { useEffect, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { NamedCorridor, TownHeatmapLayer } from '@/lib/towns/queries'
import { splitLayer } from './heatmap-geometry'

let maplibrePromise: Promise<typeof import('maplibre-gl')> | null = null
function loadMaplibre() {
  if (!maplibrePromise) maplibrePromise = import('maplibre-gl')
  return maplibrePromise
}

const MODE_LABELS: Record<string, string> = {
  all: 'All modes',
  walk: 'Walking',
  bike: 'Biking',
  transit: 'Transit',
}

// Sequential blues on the light basemap: pale (few) → navy (many).
const BAND_COLORS: [number, string][] = [
  [1, '#9DB1E4'],
  [2, '#2966E5'],
  [3, '#1B3FA3'],
  [4, '#0E2464'],
]

/**
 * Named corridor rankings + supporting map. The list leads — tapping a name
 * highlights that corridor's segments on the map. "New to Shift" chips (see
 * NamedCorridor.newer in lib/towns/queries.ts for the rule) render only when
 * the flag discriminates: if nearly every corridor carries it — true while
 * the app is young — showing it is noise, so the chips hide on that tab.
 */
/**
 * Default view frames the TOWN (centroid ± ~1.8mi), not the full feature
 * extent — commute traces reach ~6mi out and were forcing a regional zoom
 * where the basemap has no street detail. Panning still reveals the rest.
 */
const TOWN_SPAN_LAT = 0.026 // ≈1.8mi half-span — whole town + edges (Keith 07-14: 0.017 cropped corridors)
function townBounds(
  centroid: { lat: number; lng: number } | null,
  layer: TownHeatmapLayer,
): [[number, number], [number, number]] {
  let c = centroid
  if (!c) {
    // median of feature coords — robust against far-flung commute traces
    const lngs: number[] = [], lats: number[] = []
    for (const f of layer.geojson.features) {
      const [lng, lat] = (f.geometry as GeoJSON.LineString).coordinates[0] as [number, number]
      lngs.push(lng)
      lats.push(lat)
    }
    if (lngs.length === 0) return [[-71.1, 42.35], [-71.0, 42.42]]
    lngs.sort((a, b) => a - b)
    lats.sort((a, b) => a - b)
    c = { lng: lngs[Math.floor(lngs.length / 2)], lat: lats[Math.floor(lats.length / 2)] }
  }
  const spanLng = TOWN_SPAN_LAT / Math.cos((c.lat * Math.PI) / 180)
  return [
    [c.lng - spanLng, c.lat - TOWN_SPAN_LAT],
    [c.lng + spanLng, c.lat + TOWN_SPAN_LAT],
  ]
}

const FIT_OPTS = { padding: 8, maxZoom: 13.75 }

export default function TownHeatmap({
  layers,
  centroid,
}: {
  layers: TownHeatmapLayer[]
  centroid: { lat: number; lng: number } | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [active, setActive] = useState<string>(layers[0]?.mode_group ?? 'all')
  // Selected CORRIDOR id (not name): same-named streets in different places
  // carry distinct cluster ids, so exactly one contiguous street highlights.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const activeLayer = layers.find((l) => l.mode_group === active)
  const corridors: NamedCorridor[] = activeLayer?.named_corridors ?? []
  const newerFlagged = corridors.filter((c) => c.newer).length
  // Saturation guard: only show the chip when <60% of listed corridors carry it.
  const showNewerChips = corridors.length > 0 && newerFlagged > 0 && newerFlagged / corridors.length < 0.6
  const maxScore = Math.max(...corridors.map((c) => c.score), 1)

  // Init map once with every layer's source; toggle via layout visibility.
  useEffect(() => {
    if (!containerRef.current || layers.length === 0) return
    let cancelled = false

    async function init() {
      const maplibregl = await loadMaplibre()
      if (cancelled || !containerRef.current) return

      const bounds = townBounds(centroid, layers[0])

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        bounds,
        fitBoundsOptions: FIT_OPTS,
        attributionControl: false,
        cooperativeGestures: true,
      })
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      mapRef.current = map
      requestAnimationFrame(() => map.resize())

      map.on('load', () => {
        for (const layer of layers) {
          const first = layers[0]?.mode_group ?? 'all'
          const { streets, grid } = splitLayer(layer.geojson)
          // Two sources per layer: the unnamed remainder underneath, faint and
          // thin, and the corridor chains on top carrying the banding (see
          // heatmap-geometry.ts for how the published runs become chains).
          map.addSource(`hm-${layer.mode_group}-grid`, { type: 'geojson', data: grid })
          map.addSource(`hm-${layer.mode_group}`, { type: 'geojson', data: streets })
          map.addLayer({
            id: `hm-${layer.mode_group}-grid`,
            type: 'line',
            source: `hm-${layer.mode_group}-grid`,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
              visibility: layer.mode_group === first ? 'visible' : 'none',
            },
            paint: {
              'line-color': '#9DB1E4',
              'line-width': 1.2,
              'line-opacity': 0.45,
            },
          })
          map.addLayer({
            id: `hm-${layer.mode_group}`,
            type: 'line',
            source: `hm-${layer.mode_group}`,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
              visibility: layer.mode_group === first ? 'visible' : 'none',
            },
            paint: {
              'line-color': ['match', ['get', 'band'],
                ...BAND_COLORS.flatMap(([band, color]) => [band, color]),
                '#9DB1E4',
              ] as unknown as string,
              'line-width': ['match', ['get', 'band'], 1, 2, 2, 3, 3, 4.2, 4, 5.4, 2] as unknown as number,
              // Opaque: the band colors already carry the hierarchy, and any
              // translucency drew a darker dot wherever two round caps met.
              'line-opacity': 1,
            },
          })
          // Highlight overlay for the selected named corridor.
          map.addLayer({
            id: `hm-${layer.mode_group}-hl`,
            type: 'line',
            source: `hm-${layer.mode_group}`,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
              visibility: layer.mode_group === first ? 'visible' : 'none',
            },
            filter: ['==', ['get', 'corridor'], '___none___'],
            paint: {
              'line-color': '#EDB93C',
              'line-width': 5,
              'line-opacity': 1,
            },
          })
        }
        setReady(true)
      })
    }

    init()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mode toggle: swap visible layers, clear selection, refit to layer extent.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    for (const layer of layers) {
      const vis = layer.mode_group === active ? 'visible' : 'none'
      for (const id of [`hm-${layer.mode_group}-grid`, `hm-${layer.mode_group}`, `hm-${layer.mode_group}-hl`]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
      }
    }
    map.fitBounds(townBounds(centroid, activeLayer ?? layers[0]), { ...FIT_OPTS, duration: 600 })
    setSelectedId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ready])

  // Selection: filter the highlight layer, dim the base layer.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const base = `hm-${active}`
    const hl = `${base}-hl`
    if (!map.getLayer(hl)) return
    map.setFilter(hl, ['==', ['get', 'corridor'], selectedId ?? '___none___'])
    map.setPaintProperty(base, 'line-opacity', selectedId ? 0.18 : 1)
  }, [selectedId, active, ready])

  if (layers.length === 0) return null

  return (
    <div>
      {/* Mode toggle */}
      <div className="mb-4 inline-flex flex-wrap rounded-full border border-navy/20 p-0.5" aria-label="Mode">
        {layers.map((l) => (
          <button
            key={l.mode_group}
            onClick={() => setActive(l.mode_group)}
            aria-pressed={active === l.mode_group}
            className={`rounded-full px-3 py-1 text-[13px] font-semibold transition-colors ${
              active === l.mode_group ? 'bg-navy text-white' : 'text-navy hover:bg-navy/[0.05]'
            }`}
          >
            {MODE_LABELS[l.mode_group] ?? l.mode_group}
          </button>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(240px,340px)_1fr]">
        {/* Ranked corridor list */}
        {corridors.length > 0 && (
          <ol className="self-start rounded-[14px] border border-navy/10 bg-white px-2 py-1">
            {corridors.map((c, i) => {
              const cid = c.id ?? c.name
              const selected = selectedId === cid
              return (
                <li key={cid} className="border-b border-navy/10 last:border-b-0">
                  <button
                    onClick={() => setSelectedId(selected ? null : cid)}
                    aria-pressed={selected}
                    className={`w-full rounded-[8px] px-2 py-2.5 text-left transition-colors ${
                      selected ? 'bg-forest/[0.08]' : 'hover:bg-navy/[0.03]'
                    }`}
                  >
                    <span className="flex items-baseline gap-2.5">
                      <span className={`font-serif text-[1.0625rem] ${i < 3 ? 'text-forest' : 'text-ink-soft'}`}>
                        {i + 1}
                      </span>
                      <span className={`min-w-0 flex-1 truncate text-[15px] font-semibold ${selected ? 'text-green-deep' : 'text-navy'}`}>
                        {c.name}
                      </span>
                      {c.mode && (
                        <span className="shrink-0 rounded-full border border-navy/20 px-2 py-0.5 text-[10px] font-semibold text-navy">
                          {c.mode}
                        </span>
                      )}
                      {showNewerChips && c.newer && (
                        <span className="shrink-0 rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-semibold text-green-deep">
                          new to Shift
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 block h-1 overflow-hidden rounded bg-navy/[0.08]">
                      <span
                        className={`block h-full rounded ${selected ? 'bg-forest' : 'bg-navy/25'}`}
                        style={{ width: `${Math.max(6, Math.round((c.score / maxScore) * 100))}%` }}
                      />
                    </span>
                  </button>
                </li>
              )
            })}
            {showNewerChips && (
              <li className="px-2 pb-2 pt-2.5 text-[12px] leading-snug text-ink-soft">
                <span className="font-semibold text-green-deep">New to Shift:</span> stretches of this route are
                mostly traveled by people who joined Shift in the last 90 days.
              </li>
            )}
          </ol>
        )}

        {/* Supporting map */}
        <div className={corridors.length > 0 ? '' : 'md:col-span-2'}>
          <div className="h-[340px] overflow-hidden rounded-[14px] border border-navy/10 md:h-[420px]">
            <div ref={containerRef} className="h-full w-full" />
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-soft">
            <span>Fewer neighbors</span>
            <span className="flex items-center gap-1">
              {BAND_COLORS.map(([band, color]) => (
                <span key={band} className="inline-block h-1.5 w-7 rounded-full" style={{ backgroundColor: color }} />
              ))}
            </span>
            <span>More neighbors</span>
            {selectedId && (
              <button onClick={() => setSelectedId(null)} className="ml-auto font-semibold text-forest underline-offset-4 hover:underline">
                Clear highlight
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
