'use client'

import { useEffect, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadMaplibre } from '@/lib/map/loadMaplibre'

/*
 * The garages around the venue on a map, numbered like the list beside it,
 * with the venue and its station. CARTO Voyager basemap (no key), not
 * interactive; loads once it scrolls near view (the CampusMap pattern).
 */

type Pin = { lat: number; lng: number; label: string; kind: 'venue' | 'garage' | 'official' | 'station' }

const STYLE: Record<Pin['kind'], string> = {
  venue: 'background:#191A2E;color:#fff;border-radius:8px;padding:3px 8px;font:700 13px/1.3 Trebuchet MS,sans-serif;white-space:nowrap',
  official:
    'background:#2D6A4F;color:#fff;border-radius:9999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font:800 14px/1 Trebuchet MS,sans-serif;border:2px solid #fff',
  garage:
    'background:#fff;color:#191A2E;border-radius:9999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font:800 14px/1 Trebuchet MS,sans-serif;border:2px solid #191A2E',
  station:
    'background:#fff;color:#191A2E;border-radius:9999px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font:800 15px/1 Arial,sans-serif;border:3px solid #191A2E',
}

export default function VenueMap({ pins, name }: { pins: Pin[]; name: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapEl = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { rootMargin: '200px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!inView || !mapEl.current) return
    let cancelled = false
    let map: maplibregl.Map | null = null

    async function init() {
      const maplibregl = await loadMaplibre()
      if (cancelled || !mapEl.current) return
      const lats = pins.map((p) => p.lat)
      const lngs = pins.map((p) => p.lng)
      try {
        map = new maplibregl.Map({
          container: mapEl.current,
          style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
          bounds: [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          fitBoundsOptions: { padding: 44 },
          interactive: false,
          attributionControl: false,
          fadeDuration: 0,
        })
      } catch {
        return
      }
      requestAnimationFrame(() => map?.resize())
      for (const p of pins) {
        const el = document.createElement('div')
        el.setAttribute('aria-hidden', 'true')
        el.style.cssText = `${STYLE[p.kind]};box-shadow:0 1px 4px rgba(25,26,46,0.35)`
        el.textContent = p.label
        // The venue's name sits above its point, clear of the pins around it.
        new maplibregl.Marker({ element: el, ...(p.kind === 'venue' ? { anchor: 'bottom' as const, offset: [0, -4] as [number, number] } : {}) })
          .setLngLat([p.lng, p.lat])
          .addTo(map)
      }
    }

    init()
    return () => {
      cancelled = true
      map?.remove()
      map = null
    }
  }, [inView, pins])

  return (
    <div>
      <div
        ref={boxRef}
        role="img"
        aria-label={`Map of the garages near ${name}`}
        className="relative aspect-[4/3] overflow-hidden rounded-[18px] border border-navy/10 bg-[#E9EFE3]"
      >
        <div className="pointer-events-none absolute inset-0">
          <div ref={mapEl} className="h-full w-full" />
        </div>
      </div>
      <p className="mt-2 text-[0.8125rem] text-navy/70">Map © OpenStreetMap contributors, © CARTO.</p>
    </div>
  )
}
