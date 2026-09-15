'use client'

import { useEffect, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadMaplibre } from '@/lib/map/loadMaplibre'

/*
 * A real map of the campus and what is around it, as the "around campus"
 * visual on a school page: the free CARTO Voyager basemap (no key), centered
 * on the campus, not interactive. The whole block is one link to /nearby,
 * which opens the live map centered in the same place.
 *
 * The map library is large, so it only loads once the block scrolls into
 * view, and the cream placeholder keeps the block's shape until then. The
 * link is a sibling of the map, not a wrapper: MapLibre injects its own
 * anchors, and nested links are invalid.
 */
export default function CampusMap({
  lat,
  lng,
  href,
  shortName,
}: {
  lat: number
  lng: number
  href: string
  shortName: string
}) {
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
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      try {
        map = new maplibregl.Map({
          container: mapEl.current,
          style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
          center: [lng, lat],
          zoom: 14,
          interactive: false,
          attributionControl: false,
          fadeDuration: reduced ? 0 : 300,
        })
      } catch {
        // No WebGL: the cream placeholder stays, and the link still works.
        return
      }
      requestAnimationFrame(() => map?.resize())

      const pin = document.createElement('div')
      pin.setAttribute('aria-hidden', 'true')
      pin.style.cssText =
        'width:18px;height:18px;border-radius:9999px;background:#2D6A4F;border:3px solid #fff;box-shadow:0 1px 4px rgba(25,26,46,0.35)'
      new maplibregl.Marker({ element: pin }).setLngLat([lng, lat]).addTo(map)
    }

    init()
    return () => {
      cancelled = true
      map?.remove()
      map = null
    }
  }, [inView, lat, lng])

  return (
    <div>
      <div ref={boxRef} className="relative aspect-[16/9] overflow-hidden rounded-[18px] border border-navy/10 bg-[#E9EFE3]">
        {/* MapLibre forces `position: relative` on its container, so the
            absolute box is a wrapper and the map fills it. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div ref={mapEl} className="h-full w-full" />
        </div>
        <a
          href={href}
          className="group absolute inset-0 flex items-end p-4 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-forest md:p-5"
          aria-label={`Open the live map around ${shortName}`}
        >
          <span className="inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-navy/10 bg-white/95 px-4 py-2.5 text-[14px] text-navy shadow-sm">
            <span className="text-ink-soft">T stops, Bluebikes docks, bike paths</span>
            <span className="font-semibold text-forest group-hover:underline">Open the {shortName} map &rarr;</span>
          </span>
        </a>
      </div>
      <p className="mt-2 text-[11px] text-ink-soft">
        Map © OpenStreetMap contributors, © CARTO.
      </p>
    </div>
  )
}
