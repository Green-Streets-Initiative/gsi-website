'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react'
import { MAP_COMFORT_COLORS, comfortLabel, formatStretchMiles, legPhotoSpec, type CalmOption, type ComfortPiece } from '@/components/commute/calm-route'
import { streetName, streetRows } from '@/components/organizers/RouteReview'
import type { SiteLocale } from '@/lib/site-i18n'
import { translator } from '@/lib/site-i18n'
import { ridesStrings } from '@/lib/site-strings/rides'

/**
 * What the ride's streets look like (Keith 2026-11-12/13): the route street by
 * street, from the start, one Street View photo at a time. Previous / Next,
 * a swipe on the photo, or a tap on the bar of streets (in route order,
 * coloured by comfort, as wide as each street is long) moves along; a tap on
 * the map jumps there too, and the street showing is outlined on the map.
 * The calmest and busiest parts are labelled where they come up. Same pieces
 * and camera rule as Commute Advisor and the organizer console's route review
 * (calm-route.ts legPhotoSpec), same photo proxy (/api/nearby/corridor-photo,
 * cached at the edge for a month). One photo loads at a time, plus the next.
 */

/** Calmest first, busiest last: the order the comfort bar uses. */
const TIER_ORDER = ['path', 'protected', 'bike_lane', 'quiet_street', 'shared_road']
const tier = (r: string) => { const i = TIER_ORDER.indexOf(r); return i < 0 ? TIER_ORDER.length : i }

function photoUrl(option: CalmOption, index: number): string | null {
  const spec = legPhotoSpec(option, index)
  if (!spec) return null
  const params = new URLSearchParams({ lat: String(spec.lat), lng: String(spec.lng) })
  if (spec.heading !== undefined) params.set('heading', String(Math.round(spec.heading)))
  return `/api/nearby/corridor-photo?${params}`
}

export default function RideStreets({ option, pieces, selected, onSelect, locale }: {
  option: CalmOption
  pieces: ComfortPiece[]
  /** The map piece lit on the map, if any. */
  selected: number | null
  onSelect: (index: number | null) => void
  locale: SiteLocale
}) {
  const t = translator(ridesStrings, locale)
  const rows = streetRows(pieces)
  const total = rows.reduce((a, r) => a + r.miles, 0)
  // The street showing: the one holding the lit map piece, else the first.
  const found = selected == null ? -1 : rows.findIndex((r) => r.members.includes(selected))
  const cur = Math.max(0, found)
  const row = rows[cur]
  const [failed, setFailed] = useState<Set<number>>(() => new Set())
  const [loaded, setLoaded] = useState<string | null>(null)
  const touchX = useRef<number | null>(null)

  // Calmest and busiest get a label, when the route has both kinds.
  const calmest = [...rows].sort((a, b) => tier(a.rating) - tier(b.rating) || b.miles - a.miles)[0]
  const busiest = [...rows].sort((a, b) => tier(b.rating) - tier(a.rating) || b.miles - a.miles)[0]
  const mixed = calmest && busiest && tier(busiest.rating) > tier(calmest.rating)
  const tag = !row || !mixed ? null : row.index === calmest.index ? t('streets.calmest') : row.index === busiest.index ? t('streets.busiest') : null

  const go = (i: number) => {
    const next = rows[Math.min(rows.length - 1, Math.max(0, i))]
    if (next) onSelect(next.index)
  }

  // Fetch the next street's photo ahead, so Next feels instant.
  const nextUrl = rows[cur + 1] ? photoUrl(option, rows[cur + 1].index) : null
  useEffect(() => {
    if (nextUrl) { const img = new Image(); img.src = nextUrl }
  }, [nextUrl])

  if (!row) return null
  const src = photoUrl(option, row.index)
  const name = streetName(row.label)
  const noPhoto = !src || failed.has(row.index)

  return (
    <div className="p-4">
      <h2 className="text-[16px] font-bold text-(--ev-ink)">{t('streets.title')}</h2>

      {/* The photo, swipeable on a phone. */}
      <div className="relative mt-3 aspect-[16/9] overflow-hidden rounded-xl bg-(--ev-panel-faint)"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          const from = touchX.current
          touchX.current = null
          if (from == null) return
          const dx = e.changedTouches[0].clientX - from
          if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1))
        }}>
        {noPhoto ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-[15px] text-(--ev-ink-75)">
            <Camera className="h-6 w-6" aria-hidden />{t('streets.none')}
          </div>
        ) : (
          <>
            {loaded !== src && <Camera className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-(--ev-ink-60)" aria-hidden />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={src} src={src} alt={t('streets.alt', { street: name })}
              onLoad={() => setLoaded(src)}
              onError={() => setFailed((s) => new Set(s).add(row.index))}
              className="absolute inset-0 h-full w-full object-cover" />
          </>
        )}
        {tag && <span className="absolute left-3 top-3 rounded-full bg-[#191A2E]/85 px-3 py-1.5 text-[14px] font-semibold text-white">{tag}</span>}
        {rows.length > 1 && (
          <>
            <button type="button" onClick={() => go(cur - 1)} disabled={cur === 0} aria-label={t('streets.prev')}
              className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#191A2E] shadow-md hover:bg-white disabled:hidden">
              <ChevronLeft size={22} aria-hidden />
            </button>
            <button type="button" onClick={() => go(cur + 1)} disabled={cur === rows.length - 1} aria-label={t('streets.next')}
              className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#191A2E] shadow-md hover:bg-white disabled:hidden">
              <ChevronRight size={22} aria-hidden />
            </button>
          </>
        )}
      </div>

      {/* Which street, what kind, how far along. */}
      <div className="mt-3 flex items-start justify-between gap-3">
        <p className="flex min-w-0 items-start gap-2">
          <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: MAP_COMFORT_COLORS[row.rating] ?? MAP_COMFORT_COLORS.shared_road }} aria-hidden />
          <span className="min-w-0">
            <span className="block text-[16px] font-semibold leading-snug text-(--ev-ink)">{name}</span>
            <span className="block text-[14px] text-(--ev-ink-75)">{comfortLabel(row.rating, locale)} · {formatStretchMiles(row.miles, locale)}</span>
          </span>
        </p>
        {rows.length > 1 && <p className="shrink-0 pt-0.5 text-[14px] font-semibold text-(--ev-ink-75)">{t('streets.of', { n: cur + 1, total: rows.length })}</p>}
      </div>

      {/* The whole route as a bar of its streets: tap one to see it. */}
      {rows.length > 1 && (
        <div className="mt-3 flex h-11 items-center gap-[3px]" role="group" aria-label={t('streets.bar')}>
          {rows.map((r, i) => (
            <button key={r.index} type="button" onClick={() => go(i)} aria-pressed={i === cur}
              aria-label={`${streetName(r.label)}, ${comfortLabel(r.rating, locale)}, ${formatStretchMiles(r.miles, locale)}`}
              style={{ flexGrow: Math.max(r.miles / (total || 1), 0.04), flexBasis: 0 }}
              className="group flex h-full min-w-[10px] items-center">
              <span className={`block w-full rounded-full transition-all ${i === cur ? 'h-4 ring-2 ring-[#191A2E] ring-offset-2 ring-offset-(--ev-card)' : 'h-2.5 group-hover:h-3.5'}`}
                style={{ background: MAP_COMFORT_COLORS[r.rating] ?? MAP_COMFORT_COLORS.shared_road }} />
            </button>
          ))}
        </div>
      )}
      <p className="mt-1 text-[14px] text-(--ev-ink-75)">{t('streets.hint')}</p>
    </div>
  )
}
