'use client'

import { useRef, useEffect } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'

let maplibrePromise: Promise<typeof import('maplibre-gl')> | null = null
function loadMaplibre() {
  if (!maplibrePromise) maplibrePromise = import('maplibre-gl')
  return maplibrePromise
}

interface Props {
  lat: number
  lng: number
  label?: string
}

export default function EventMap({ lat, lng, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    async function init() {
      const maplibregl = await loadMaplibre()
      if (cancelled || !containerRef.current) return

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        center: [lng, lat],
        zoom: 14.5,
        attributionControl: false,
        interactive: false,
      })

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      mapRef.current = map

      requestAnimationFrame(() => map.resize())

      const el = document.createElement('div')
      el.innerHTML = `<svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24C32 7.163 24.837 0 16 0z" fill="#BAF14D"/>
        <circle cx="16" cy="15" r="6" fill="#191A2E"/>
      </svg>`
      el.style.cursor = 'pointer'

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map)

      if (label) {
        marker.setPopup(new maplibregl.Popup({ offset: 28, closeButton: false })
          .setHTML(`<div style="font-size:13px;font-weight:600;color:#191A2E;padding:2px 4px">${label}</div>`))
      }
    }

    init()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [lat, lng, label])

  return <div ref={containerRef} className="h-full w-full" />
}
