'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import 'maplibre-gl/dist/maplibre-gl.css'
import { QUIET_STYLE, LABEL_FONT_BOLD, quietBasemap } from '@/lib/maps/quietBasemap'
import { CLEARED_STYLE, CONDITION_COLOR, LANE_STYLE, clearedLabel, conditionLabel, laneLabel, type ClearedKey, type Condition } from '@/lib/trails/conditionText'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { trailStrings } from '@/lib/site-strings/trails'

let maplibrePromise: Promise<typeof import('maplibre-gl')> | null = null
function loadMaplibre() {
  if (!maplibrePromise) maplibrePromise = import('maplibre-gl')
  return maplibrePromise
}

type LngLat = [number, number]

export interface ConditionsTrail {
  id: string
  name: string
  lines: LngLat[][]
  cleared: ClearedKey
  /** What the hover card says: the newest report, or who clears it. */
  status: string
  closed_lines: LngLat[][]
  reports: Array<{ line: LngLat[]; condition: Condition }>
}

/** A protected bike lane: no page of its own, so the hover card is all it says. */
export interface ConditionsLane {
  id: string
  /** "Cambridge Street, Cambridge" */
  name: string
  lines: LngLat[][]
  status: string
  reports: Array<{ line: LngLat[]; condition: Condition }>
}

const NAVY = '#191A2E'
const CLOSED = '#C2410C'
const GREATER_BOSTON: [LngLat, LngLat] = [[-71.29, 42.25], [-70.94, 42.49]]

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

/**
 * /trails/conditions: every trail styled by who clears it, the stretches
 * people reported in the last day drawn over it in their condition's color,
 * closures dotted orange (Keith 2026-10-31). Protected bike lanes thin and
 * violet underneath (Keith 2026-11-04: "Yes, add lanes"). Opens on Greater
 * Boston, where most trails, lanes and riders are; tapping a trail opens its page.
 */
export default function ConditionsMap({ trails, lanes = [], locale = 'en' }: { trails: ConditionsTrail[]; lanes?: ConditionsLane[]; locale?: SiteLocale }) {
  const router = useRouter()
  const tr = translator(trailStrings, locale)
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!mapEl.current) return
    let cancelled = false
    ;(async () => {
      const maplibregl = await loadMaplibre()
      if (cancelled || !mapEl.current) return
      const map = new maplibregl.Map({
        container: mapEl.current,
        style: QUIET_STYLE,
        bounds: GREATER_BOSTON,
        fitBoundsOptions: { padding: 24 },
        attributionControl: false,
        cooperativeGestures: true,
      })
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      mapRef.current = map
      map.on('load', () => {
        quietBasemap(map)
        map.resize()
        map.fitBounds(GREATER_BOSTON, { padding: 24, animate: false })

        if (lanes.length > 0) {
          map.addSource('lanes', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: lanes.map((l) => ({
                type: 'Feature' as const,
                properties: { id: l.id, name: l.name, status: l.status },
                geometry: { type: 'MultiLineString' as const, coordinates: l.lines },
              })),
            },
          })
          map.addLayer({ id: 'lanes-hit', type: 'line', source: 'lanes', paint: { 'line-color': LANE_STYLE.color, 'line-width': 14, 'line-opacity': 0 } })
          map.addLayer({ id: 'lanes-casing', type: 'line', source: 'lanes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 5, 'line-opacity': 0.9 } })
          map.addLayer({ id: 'lanes', type: 'line', source: 'lanes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': LANE_STYLE.color, 'line-width': LANE_STYLE.width } })
        }

        const features = trails.map((t) => ({
          type: 'Feature' as const,
          properties: { id: t.id, name: t.name, status: t.status, cleared: t.cleared },
          geometry: { type: 'MultiLineString' as const, coordinates: t.lines },
        }))
        map.addSource('trails', { type: 'geojson', data: { type: 'FeatureCollection', features } })
        map.addLayer({ id: 'trails-hit', type: 'line', source: 'trails', paint: { 'line-color': NAVY, 'line-width': 16, 'line-opacity': 0 } })
        map.addLayer({ id: 'trails-casing', type: 'line', source: 'trails', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 6.5, 'line-opacity': 0.9 } })
        for (const [key, st] of Object.entries(CLEARED_STYLE)) {
          map.addLayer({
            id: `trails-${key}`,
            type: 'line',
            source: 'trails',
            filter: ['==', ['get', 'cleared'], key],
            layout: { 'line-cap': st.dash ? 'butt' : 'round', 'line-join': 'round' },
            paint: { 'line-color': st.color, 'line-width': st.width, ...(st.dash ? { 'line-dasharray': st.dash } : {}) },
          })
        }

        const reports = [...trails, ...lanes].flatMap((t) => t.reports.map((r) => ({
          type: 'Feature' as const,
          properties: { color: CONDITION_COLOR[r.condition] },
          geometry: { type: 'LineString' as const, coordinates: r.line },
        })))
        if (reports.length > 0) {
          map.addSource('reports', { type: 'geojson', data: { type: 'FeatureCollection', features: reports } })
          map.addLayer({ id: 'reports-casing', type: 'line', source: 'reports', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 10 } })
          map.addLayer({ id: 'reports', type: 'line', source: 'reports', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 6.5 } })
        }

        const closed = trails.flatMap((t) => t.closed_lines)
        if (closed.length > 0) {
          map.addSource('closed', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: closed } } })
          map.addLayer({ id: 'closed', type: 'line', source: 'closed', layout: { 'line-cap': 'round' }, paint: { 'line-color': CLOSED, 'line-width': 3.5, 'line-dasharray': [0.6, 1.6] } })
        }

        // One name per trail, by the middle of its longest piece.
        const names = trails.flatMap((t) => {
          const longest = t.lines.reduce<LngLat[]>((best, l) => (l.length > best.length ? l : best), [])
          const mid = longest[Math.floor(longest.length / 2)]
          return mid ? [{ type: 'Feature' as const, properties: { name: t.name }, geometry: { type: 'Point' as const, coordinates: mid } }] : []
        })
        map.addSource('names', { type: 'geojson', data: { type: 'FeatureCollection', features: names } })
        map.addLayer({
          id: 'names',
          type: 'symbol',
          source: 'names',
          layout: {
            'text-field': ['get', 'name'],
            'text-font': LABEL_FONT_BOLD,
            'text-size': ['interpolate', ['linear'], ['zoom'], 8, 11, 13, 13.5],
            'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
            'text-radial-offset': 0.9,
            'text-max-width': 9,
            'text-padding': 3,
          },
          paint: { 'text-color': NAVY, 'text-halo-color': '#FAFAF6', 'text-halo-width': 2 },
        })

        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 })
        for (const layer of lanes.length > 0 ? ['trails-hit', 'lanes-hit'] : ['trails-hit']) {
          map.on('mousemove', layer, (e) => {
            const f = e.features?.[0]
            if (!f) return
            map.getCanvas().style.cursor = layer === 'trails-hit' ? 'pointer' : ''
            popup
              .setLngLat(e.lngLat)
              .setHTML(`<div style="padding:2px 4px;max-width:220px"><div style="font-size:13px;font-weight:700;color:${NAVY}">${esc(String(f.properties?.name ?? ''))}</div><div style="font-size:13px;color:${NAVY};margin-top:2px">${esc(String(f.properties?.status ?? ''))}</div></div>`)
              .addTo(map)
          })
          map.on('mouseleave', layer, () => {
            map.getCanvas().style.cursor = ''
            popup.remove()
          })
        }
        map.on('click', 'trails-hit', (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined
          if (id) router.push(withLang(`/trails/${id}#winter`, locale))
        })
      })
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // Built once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reportKinds = [...new Set([...trails, ...lanes].flatMap((t) => t.reports.map((r) => r.condition)))]
  const hasClosed = trails.some((t) => t.closed_lines.length > 0)

  return (
    <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)]">
      <div ref={mapEl} className="h-[300px] w-full sm:h-[440px] lg:h-[clamp(420px,calc(100vh-220px),620px)]" role="img" aria-label={tr('cm.map_aria')} />
      <div className="space-y-1.5 border-t border-navy/[0.07] px-4 py-3 text-[0.8125rem] text-navy">
        {reportKinds.length > 0 && (
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold">{tr('cm.reported_today')}</span>
            {reportKinds.map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <i className="inline-block h-1.5 w-5 rounded" style={{ background: CONDITION_COLOR[k] }} aria-hidden /> {conditionLabel(k, locale)}
              </span>
            ))}
          </p>
        )}
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="font-semibold">{tr('cm.in_winter')}</span>
          {(Object.keys(CLEARED_STYLE) as ClearedKey[]).map((k) => {
            const st = CLEARED_STYLE[k]
            return (
              <span key={k} className="inline-flex items-center gap-1.5">
                <svg width="22" height="6" aria-hidden>
                  <line x1="1" y1="3" x2="21" y2="3" stroke={st.color} strokeWidth="3" strokeDasharray={st.dash ? st.dash.map((d) => d * 3).join(' ') : undefined} strokeLinecap={st.dash ? 'butt' : 'round'} />
                </svg>
                {clearedLabel(k, locale)}
              </span>
            )
          })}
          {lanes.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <svg width="22" height="6" aria-hidden><line x1="1" y1="3" x2="21" y2="3" stroke={LANE_STYLE.color} strokeWidth="2.6" strokeLinecap="round" /></svg>
              {laneLabel(locale)}
            </span>
          )}
          {hasClosed && (
            <span className="inline-flex items-center gap-1.5">
              <svg width="22" height="6" aria-hidden><line x1="2" y1="3" x2="21" y2="3" stroke={CLOSED} strokeWidth="3.5" strokeDasharray="1 5" strokeLinecap="round" /></svg>
              {tr('cm.closed')}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
