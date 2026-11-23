'use client'

import { useMemo, useState, type ReactNode, type Ref } from 'react'
import { MAP_COMFORT_COLORS, comfortLabel, formatStretchMiles, type ComfortPiece } from '@/components/commute/calm-route'
import { streetName, streetRows } from '@/components/organizers/RouteReview'
import { cx } from '@/components/organizers/ui'
import type { SiteLocale } from '@/lib/site-i18n'
import { translator } from '@/lib/site-i18n'
import { ridesStrings } from '@/lib/site-strings/rides'

/**
 * The route, street by street (Keith 2026-11-23): start, each street with its
 * comfort and distance, then the finish. Under each street, a row of photos in
 * the order you ride past them: Street View along the street (about one every
 * 0.7 mi, one to four) with the street's spots in their places among them.
 * Tap one to open it full width under the row; a street photo lights its
 * street on the map. This replaced the big street carousel (RideStreets.tsx),
 * which "doesn't follow the route". Used by the ride plan (learner and
 * guide), the guide's route step and ride pages; same photo proxy and camera
 * rule as the rest of the site (/api/nearby/corridor-photo, facing along the
 * route).
 */

type LL = { lat: number; lng: number }
const metres = (a: LL, b: LL) => {
  const k = Math.PI / 180
  const x = (b.lng - a.lng) * k * Math.cos(((a.lat + b.lat) / 2) * k)
  return Math.hypot(x, (b.lat - a.lat) * k) * 6371000
}
const bearing = (a: LL, b: LL) => {
  const k = Math.PI / 180
  const dLng = (b.lng - a.lng) * k
  const y = Math.sin(dLng) * Math.cos(b.lat * k)
  const x = Math.cos(a.lat * k) * Math.sin(b.lat * k) - Math.sin(a.lat * k) * Math.cos(b.lat * k) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}
const viewUrl = (v: LL & { heading?: number }) => {
  const q = new URLSearchParams({ lat: v.lat.toFixed(5), lng: v.lng.toFixed(5) })
  if (v.heading !== undefined) q.set('heading', String(Math.round(v.heading)))
  return `/api/nearby/corridor-photo?${q}`
}

/** Calmest first, busiest last (the old carousel's order), for the "Safest part" / "Busiest part" labels. */
const TIER_ORDER = ['path', 'protected', 'bike_lane', 'quiet_street', 'shared_road']
const tier = (r: string) => { const i = TIER_ORDER.indexOf(r); return i < 0 ? TIER_ORDER.length : i }

type Stop = { key: string; at: number } & ({ kind: 'view'; lat: number; lng: number; heading?: number; miles: number } | { kind: 'spot'; i: number })

/** A Street View photo along a street: a thumbnail with how far along it is under it. Hidden when there's no photo there. */
function ViewThumb({ src, alt, label, on, onToggle }: { src: string; alt: string; label: string; on: boolean; onToggle: () => void }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <div className="flex w-[72px] shrink-0 flex-col items-center gap-1">
      <button type="button" onClick={onToggle} aria-expanded={on} aria-label={alt}
        className={cx('relative h-12 w-[72px] shrink-0 rounded-lg bg-(--ev-panel) p-0', on && 'ring-2 ring-[#191A2E] ring-offset-1')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full rounded-lg object-cover" />
      </button>
      <span className="text-[13px] leading-tight text-(--ev-ink-75)">{label}</span>
    </div>
  )
}

const dot = 'relative mt-1 h-4 w-4 shrink-0 rounded-full border-[3px] border-white shadow-[0_0_0_1px_var(--ev-line-strong)]'

export default function RouteStreetList({
  pieces, locale, title, start, finish, selected, onSelect, open: openProp, onOpen,
  spots, spotThumb, spotCaption, spotPanel, spotNote, onSpot, panelRef, spotRef,
}: {
  pieces: ComfortPiece[]
  locale: SiteLocale
  /** The heading over the list; null for none. */
  title?: string | null
  /** "Start at Davis", "Arrive at Union Square". */
  start: string
  finish: string
  /** The street lit on the map (a piece index), and setting it. */
  selected: number | null
  onSelect: (index: number | null) => void
  /** What's open in the list ("s-<i>" a spot, "v-<row>-<n>" a street photo). Left out, the list keeps it itself. */
  open?: string | null
  onOpen?: (key: string | null) => void
  /** Spots on the route, in route order (spot i is numbered i + 1), and how each one looks. */
  spots?: LL[]
  spotThumb?: (i: number, open: boolean, toggle: () => void) => ReactNode
  spotCaption?: (i: number) => string
  spotPanel?: (i: number) => ReactNode
  /** The guide's note on a spot: shown in words under the photos while the spot is closed. */
  spotNote?: (i: number) => string | null | undefined
  /** Tapping a spot (the plan lights it on the map too); else it just opens. */
  onSpot?: (i: number) => void
  panelRef?: Ref<HTMLDivElement>
  spotRef?: (i: number, el: HTMLElement | null) => void
}) {
  const t = translator(ridesStrings, locale)
  const [openOwn, setOpenOwn] = useState<string | null>(null)
  const open = openProp !== undefined ? openProp : openOwn
  const setOpen = onOpen ?? setOpenOwn
  const rows = useMemo(() => streetRows(pieces), [pieces])

  // Each street's photos and spots, in the order you ride past them. A street photo within 80 m of a spot is left
  // out (the spot's photo shows that corner).
  const stretches = useMemo(() => {
    const all = pieces.flatMap((p) => p.coords.map(([lng, lat]) => ({ lat, lng, piece: p.index })))
    const rowOf = (piece: number) => Math.max(0, rows.findIndex((r) => r.members.includes(piece)))
    const spotRow = (spots ?? []).map((s) => {
      let best = all[0]
      let bestD = Infinity
      for (const c of all) { const d = metres(c, s); if (d < bestD) { bestD = d; best = c } }
      return best ? rowOf(best.piece) : 0
    })
    return rows.map((r, ri) => {
      const coords = pieces.filter((p) => r.members.includes(p.index)).flatMap((p) => p.coords.map(([lng, lat]) => ({ lat, lng })))
      const cum = [0]
      for (let k = 1; k < coords.length; k++) cum.push(cum[k - 1] + metres(coords[k - 1], coords[k]))
      const len = cum[cum.length - 1] ?? 0
      const placed: Stop[] = []
      ;(spots ?? []).forEach((s, i) => {
        if (spotRow[i] !== ri) return
        let best = 0
        let bestD = Infinity
        coords.forEach((c, k) => { const d = metres(c, s); if (d < bestD) { bestD = d; best = k } })
        placed.push({ kind: 'spot', key: `s-${i}`, at: cum[best] ?? 0, i })
      })
      const views: Stop[] = []
      if (coords.length > 1 && len > 0) {
        const n = Math.min(4, Math.max(1, Math.round(r.miles / 0.7)))
        for (let v = 0; v < n; v++) {
          const target = (len * (v + 0.5)) / n
          let k = cum.findIndex((c) => c >= target)
          if (k < 0) k = coords.length - 1
          let a = k
          let b = k
          while (a > 0 && cum[k] - cum[a] < 20) a--
          while (b < coords.length - 1 && cum[b] - cum[k] < 20) b++
          if (placed.some((sp) => Math.abs(sp.at - cum[k]) < 80)) continue
          views.push({ kind: 'view', key: `v-${ri}-${v}`, at: cum[k], lat: coords[k].lat, lng: coords[k].lng, heading: a !== b ? bearing(coords[a], coords[b]) : undefined, miles: cum[k] / 1609.34 })
        }
      }
      return [...views, ...placed].sort((x, y) => x.at - y.at)
    })
  }, [rows, pieces, spots])

  // Safest and busiest get a label, when the route has both kinds.
  const calmest = [...rows].sort((a, b) => tier(a.rating) - tier(b.rating) || b.miles - a.miles)[0]
  const busiest = [...rows].sort((a, b) => tier(b.rating) - tier(a.rating) || b.miles - a.miles)[0]
  const mixed = !!calmest && !!busiest && tier(busiest.rating) > tier(calmest.rating)

  if (!rows.length) return null
  const toggleSpot = (i: number) => (onSpot ? onSpot(i) : setOpen(open === `s-${i}` ? null : `s-${i}`))

  return (
    <div className="grid grid-cols-1 gap-2">
      {title ? <h2 className="text-[17px] font-bold">{title}</h2> : null}
      <ol className="relative grid grid-cols-1">
        <span aria-hidden className="absolute bottom-5 left-[7px] top-5 w-0.5 bg-(--ev-line-strong)" />
        <li className="relative flex items-start gap-3 py-2">
          <span aria-hidden className={cx(dot, 'bg-[#191A2E]')} />
          <span className="block text-[16px] font-bold">{start}</span>
        </li>
        {rows.map((r, ri) => {
          const name = streetName(r.label)
          const stops = stretches[ri] ?? []
          const shown = stops.find((st) => st.key === open)
          const noted = stops.filter((st): st is Stop & { kind: 'spot' } => st.kind === 'spot' && !!spotNote?.(st.i))
          const tag = !mixed ? null : r.index === calmest.index ? t('streets.calmest') : r.index === busiest.index ? t('streets.busiest') : null
          return (
            <li key={r.index} className="relative grid grid-cols-1">
              <button type="button" onClick={() => { setOpen(null); onSelect(selected === r.index ? null : r.index) }} aria-pressed={selected === r.index}
                className={cx('-mx-2 flex min-h-[44px] items-start gap-3 rounded-lg px-2 py-2 text-left', selected === r.index ? 'bg-(--ev-panel)' : 'hover:bg-(--ev-panel-faint)')}>
                <span aria-hidden className={dot} style={{ background: MAP_COMFORT_COLORS[r.rating] ?? MAP_COMFORT_COLORS.shared_road }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold">{name}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-[15px] text-(--ev-ink-80)">
                    {comfortLabel(r.rating, locale)} · {formatStretchMiles(r.miles, locale)}
                    {tag ? <span className="rounded-full bg-(--ev-panel) px-2 py-0.5 text-[13px] font-semibold text-(--ev-ink-85)">{tag}</span> : null}
                  </span>
                </span>
              </button>
              {stops.length ? (
                <div className="grid grid-cols-1 gap-2 pb-2 pl-7">
                  <div className="-mx-1 flex gap-2 overflow-x-auto p-1 [scrollbar-width:none]">
                    {stops.map((st) => st.kind === 'spot' ? (
                      <div key={st.key} ref={(el) => spotRef?.(st.i, el)} className="flex w-[72px] shrink-0 flex-col items-center gap-1">
                        {spotThumb?.(st.i, open === st.key, () => toggleSpot(st.i))}
                        <button type="button" onClick={() => toggleSpot(st.i)} className="line-clamp-2 w-full text-center text-[13px] font-semibold leading-tight">
                          {spotCaption?.(st.i)}
                        </button>
                      </div>
                    ) : (
                      <ViewThumb key={st.key} src={viewUrl(st)} alt={t('streets.alt', { street: name })} on={open === st.key}
                        label={formatStretchMiles(st.miles, locale)}
                        onToggle={() => { const next = open === st.key ? null : st.key; setOpen(next); onSelect(next ? r.index : null) }} />
                    ))}
                  </div>
                  {shown?.kind === 'spot' ? (
                    <div ref={panelRef} className="w-full max-w-[520px]">{spotPanel?.(shown.i)}</div>
                  ) : shown?.kind === 'view' ? (
                    <figure className="m-0 grid w-full max-w-[520px] grid-cols-1 gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={viewUrl(shown)} alt={t('streets.alt', { street: name })} className="aspect-[16/9] w-full rounded-lg object-cover" />
                      <figcaption className="text-[14px] text-(--ev-ink-75)">{t('streets.view_at', { street: name, miles: formatStretchMiles(shown.miles, locale) })}</figcaption>
                    </figure>
                  ) : null}
                  {/* The guide's notes stay in words: they're written for the rider. */}
                  {noted.filter((st) => st.key !== open).map((st) => (
                    <p key={st.key} className="flex items-start gap-2 text-[15px]">
                      <span aria-hidden className="mt-0.5 flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#9A5B00] px-1 text-[12px] font-extrabold text-white">{st.i + 1}</span>
                      <span className="min-w-0">{spotNote?.(st.i)}</span>
                    </p>
                  ))}
                </div>
              ) : null}
            </li>
          )
        })}
        <li className="relative flex items-start gap-3 py-2">
          <span aria-hidden className={cx(dot, 'bg-[#191A2E]')} />
          <span className="block text-[16px] font-bold">{finish}</span>
        </li>
      </ol>
      <p className="text-[14px] text-(--ev-ink-75)">{t('streets.list_hint')}</p>
    </div>
  )
}
