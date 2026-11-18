'use client'

import { useState } from 'react'

/**
 * The square on an event card when the listing has no flyer (Keith
 * 2026-11-18, mockup round 3): the host's logo when it is a square mark,
 * otherwise a small street map of the start with a pin. A wide wordmark
 * shrinks to nothing in a 64px square, so it falls back to the map too.
 */

const Z = 16
/** z16 tiles drawn at half size: z15 framing that stays sharp on 2x screens. */
const T = 128
/** Half the largest box (64px) plus a margin, in drawn pixels. */
const REACH = 40

/** A whole-pixel offset from the box's center (whole pixels keep server and browser markup identical). */
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

export default function CardThumb({ lat, lng, logo, fallback }: {
  lat: number | null
  lng: number | null
  logo: string | null
  /** The type tile, for an event with no logo and no place on a map. */
  fallback: React.ReactNode
}) {
  const [logoOk, setLogoOk] = useState(true)
  /** Square marks only: a wordmark can't be read at this size. */
  const check = (img: HTMLImageElement) => {
    const { naturalWidth: w, naturalHeight: h } = img
    if (!w || !h || w / h > 1.3 || h / w > 1.3 || Math.min(w, h) < 96) setLogoOk(false)
  }
  // It may have loaded before the page hydrated, when onLoad wasn't listening yet.
  const logoRef = (img: HTMLImageElement | null) => {
    if (img && img.complete) check(img)
  }
  const box = 'relative h-16 w-16 shrink-0 overflow-hidden rounded-[12px] border border-(--ev-line) lg:h-14 lg:w-14 lg:rounded-[10px]'
  const hasMap = lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))

  if (logo && logoOk) {
    return (
      <div className={`${box} flex items-center justify-center bg-white p-1.5`}>
        <img
          src={logo}
          alt=""
          loading="lazy"
          className="max-h-full max-w-full object-contain"
          ref={logoRef}
          onLoad={(e) => check(e.currentTarget)}
          onError={() => setLogoOk(false)}
        />
      </div>
    )
  }
  if (hasMap) {
    return (
      <div className={`${box} bg-[#EEF0EA]`}>
        <MapSquare lat={Number(lat)} lng={Number(lng)} />
      </div>
    )
  }
  return <>{fallback}</>
}
