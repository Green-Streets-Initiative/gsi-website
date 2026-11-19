'use client'

import { useState } from 'react'
import type { DashboardRide } from '@/lib/organizers/types'

/**
 * The square on a "Your rides" card, as on the events calendar's cards
 * (polish 2026-11-19): the ride's flyer, else a small street map of where
 * people meet with a pin. A ride with neither (a draft with no meeting place
 * yet) shows no square. Needs Shift 01862 for the fields; until then, none.
 *
 * The map math is the events calendar's MapSquare (src/components/events/
 * CardThumb.tsx); kept here so the console doesn't depend on the events code.
 */

const Z = 16
/** z16 tiles drawn at half size: z15 framing that stays sharp on 2x screens. */
const T = 128
/** Half the 64px box plus a margin, in drawn pixels. */
const REACH = 40

/** A whole-pixel offset from the box's center. */
const off = (d: number) => { const r = Math.round(d); return r < 0 ? `calc(50% - ${-r}px)` : `calc(50% + ${r}px)` }

function MapSquare({ lat, lng }: { lat: number; lng: number }) {
  const n = 2 ** Z
  const px = ((lng + 180) / 360) * n * T
  const r = (lat * Math.PI) / 180
  const py = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * T
  const tiles: { x: number; y: number }[] = []
  for (let x = Math.floor((px - REACH) / T); x <= Math.floor((px + REACH) / T); x++)
    for (let y = Math.floor((py - REACH) / T); y <= Math.floor((py + REACH) / T); y++) tiles.push({ x, y })
  return (
    <>
      {tiles.map(({ x, y }) => (
        <img
          key={`${x}-${y}`}
          src={`/api/map-tiles/${Z}/${x}/${y}`}
          alt=""
          loading="lazy"
          className="absolute max-w-none"
          style={{ width: T, height: T, left: off(x * T - px), top: off(y * T - py) }}
        />
      ))}
      <span className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-white bg-[#2D6A4F] shadow-[0_1px_4px_rgba(0,0,0,0.45)]" aria-hidden />
    </>
  )
}

const BOX = 'relative h-16 w-16 shrink-0 overflow-hidden rounded-[12px] border border-(--ev-line)'

export default function RideThumb({ r }: { r: DashboardRide }) {
  const [flyerOk, setFlyerOk] = useState(true)
  // It may have failed before the page hydrated, when onError wasn't listening yet.
  const flyerRef = (img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) setFlyerOk(false)
  }
  if (r.flyer_url && flyerOk) {
    return (
      <div className={BOX}>
        <img ref={flyerRef} src={r.flyer_url} alt="" className="h-full w-full object-cover" loading="lazy" onError={() => setFlyerOk(false)} />
      </div>
    )
  }
  const lat = Number(r.meetup_lat)
  const lng = Number(r.meetup_lng)
  if (r.meetup_lat == null || r.meetup_lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return (
    <div className={`${BOX} bg-[#EEF0EA]`}>
      <MapSquare lat={lat} lng={lng} />
    </div>
  )
}
