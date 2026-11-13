'use client'

import { Bicycle, Car, PersonSimpleWalk, Train, Van, type Icon } from '@phosphor-icons/react'
import { TILE, fitViewport, toPixel } from '@/lib/geo/web-mercator'
import { RASTER_TILE_ATTRIBUTION, rasterTileUrl } from '@/lib/nearby/static-map'
import { decodePolyline } from '@/lib/geo/polyline'
import { comfortColor } from '@/lib/comfort-colors'
import { directionsUrl } from '@/components/commute/plan-data'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { askTripStrings } from '@/lib/site-strings/ask-trip'
import { advisorStrings } from '@/lib/site-strings/advisor'
import type { TripCard } from '@/lib/shift-assistant/tools'

/**
 * The member assistant's cards in the visitors' assistant (parity
 * gap-visitor-assistant-cards, 2026-11-13): the route card check_trip sends
 * (a map of the walk, the ride or the transit trip in its line colors, the
 * minutes beside the other ways, and for a ride how calm each stretch is)
 * and the comparison card compare_ways sends (each way's minutes and weekly
 * cost, the best fit first). Web twins of Shift's components/assistant
 * RouteCard and CompareCard, drawn on a light page: one <svg> map from the
 * raster basemap like components/notes/NotesStaticMap, no map library.
 * "Open in Google Maps" is the one button; the app's "Save this trip" and
 * "See the full trip" need an account, so they stay in the app.
 */

export type AskCard = TripCard

const W = 640
const H = 240
const TIERS = ['path', 'protected', 'bike_lane', 'quiet_street', 'shared_road'] as const
const WAY_ICON: Record<string, Icon> = { walk: PersonSimpleWalk, bike: Bicycle, transit: Train, drive: Car, park_ride: Car, bike_ride: Bicycle, shuttle: Van }
/** Directions for a two-part trip open transit: it's mostly the train. */
const MAPS_MODE: Record<string, string> = { walk: 'walk', bike: 'bike', transit: 'transit', drive: 'drive', park_ride: 'transit', bike_ride: 'transit' }

type Line = { pts: [number, number][]; color: string; width: number; dash?: string }

const usd = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`

export default function AskTripCard({ card, locale, onDirections }: { card: AskCard; locale: SiteLocale; onDirections: (way: string) => void }) {
  return card.compare ? <CompareCard card={card} locale={locale} onDirections={onDirections} /> : <RouteCard card={card} locale={locale} onDirections={onDirections} />
}

function placeName(name: string, locale: SiteLocale): string {
  return name === 'Home' ? translator(askTripStrings, locale)('card.home') : name
}

function RouteCard({ card, locale, onDirections }: { card: AskCard; locale: SiteLocale; onDirections: (way: string) => void }) {
  const t = translator(askTripStrings, locale)
  const ta = translator(advisorStrings, locale)
  const lead = card.lead ?? 'bike'
  const from = placeName(card.from.name, locale)
  const to = card.to.name

  const lines: Line[] = []
  if (lead === 'transit' && card.transit_segments?.length) {
    for (const g of card.transit_segments) {
      lines.push(g.mode === 'walk'
        ? { pts: decodePolyline(g.polyline), color: '#4A4D68', width: 3, dash: '2 6' }
        : { pts: decodePolyline(g.polyline), color: g.color, width: 6 })
    }
  } else if (lead === 'walk' && card.walk_polyline) {
    lines.push({ pts: decodePolyline(card.walk_polyline), color: '#4A4D68', width: 5 })
  } else if (lead === 'bike' && card.polyline) {
    lines.push({ pts: decodePolyline(card.polyline), color: '#2D6A4F', width: 5 })
  }
  const ride = lead === 'bike' && card.polyline ? decodePolyline(card.polyline) : []

  // The lead way first, then the others this trip has.
  const ways = ([
    { way: 'walk', minutes: card.walk_minutes ?? null, miles: card.walk_miles ?? null },
    { way: 'bike', minutes: card.bike_minutes, miles: card.bike_miles },
    { way: 'transit', minutes: card.transit_minutes, miles: null },
  ] as const)
    .filter((w) => w.minutes != null)
    .sort((a, b) => Number(b.way === lead) - Number(a.way === lead))

  const total = card.comfort.reduce((a, s) => a + s.miles, 0)
  const calm = card.comfort.filter((s) => s.rating === 'path' || s.rating === 'protected').reduce((a, s) => a + s.miles, 0)
  const tierOf = (r: string) => ((TIERS as readonly string[]).includes(r) ? r : 'shared_road') as (typeof TIERS)[number]

  // A ride hands Google Maps a few points along our line so it keeps to the calm streets.
  const via = ride.length > 4 ? Array.from({ length: 7 }, (_, i) => ride[Math.round(((i + 1) * (ride.length - 1)) / 8)]).map(([lat, lng]) => ({ lat, lng })) : undefined
  const google = directionsUrl(card.from, card.to, lead, via)

  return (
    <div className="mt-2.5 overflow-hidden rounded-[12px] border border-[rgba(25,26,46,0.14)] bg-white">
      <TripMap from={card.from} to={card.to} lines={lines} title={t('card.map', { from, to })} />
      <div className="px-3.5 pb-3.5 pt-3">
        <p className="text-[1rem] font-bold leading-snug text-[#191A2E]">{t('card.to', { place: to })}</p>
        <p className="text-[0.875rem] text-[#4A4D68]">{t('card.from', { place: from })}</p>

        <div className="mt-2.5 flex flex-wrap gap-2">
          {ways.map((w) => {
            const WayIcon = WAY_ICON[w.way]
            const isLead = w.way === lead
            return (
              <span
                key={w.way}
                className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 text-[0.875rem] font-semibold ${isLead ? 'border-[#2D6A4F] bg-[#F4F8EE] text-[#1F4D3A]' : 'border-[rgba(25,26,46,0.18)] text-[#191A2E]'}`}
              >
                <WayIcon size={16} weight={isLead ? 'bold' : 'regular'} aria-hidden />
                <span className="sr-only">{ta(`cost.name_${w.way}` as Parameters<typeof ta>[0])}: </span>
                {isLead && w.miles != null ? t('card.min_mi', { n: w.minutes!, miles: w.miles }) : t('card.min', { n: w.minutes! })}
              </span>
            )
          })}
        </div>

        {lead === 'transit' && (card.transit_lines?.length ?? 0) > 0 && (
          <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.875rem] font-semibold text-[#191A2E]">
            {card.transit_lines!.map((l, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && <span aria-hidden className="text-[#4A4D68]">→</span>}
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </p>
        )}

        {lead === 'bike' && total > 0 && (
          <div className="mt-3">
            <div className="flex h-2.5 overflow-hidden rounded-full" role="img" aria-label={t('card.calm_share', { pct: Math.round((calm / total) * 100) })}>
              {card.comfort.map((s, i) => (
                <span key={i} style={{ width: `${(s.miles / total) * 100}%`, background: comfortColor(tierOf(s.rating), true) }} />
              ))}
            </div>
            <p className="mt-1.5 text-[0.875rem] font-semibold text-[#191A2E]">{t('card.calm_share', { pct: Math.round((calm / total) * 100) })}</p>
            <ul className="mt-1 flex flex-wrap gap-x-3.5 gap-y-1">
              {TIERS.filter((tier) => card.comfort.some((s) => tierOf(s.rating) === tier)).map((tier) => (
                <li key={tier} className="inline-flex items-center gap-1.5 text-[0.8125rem] text-[#4A4D68]">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: comfortColor(tier, true) }} />
                  {t(`card.tier_${tier}`)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <a
          href={google}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onDirections(lead)}
          className="mt-3 flex min-h-[44px] items-center justify-center rounded-full bg-[#2D6A4F] px-4 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#1F4D3A]"
        >
          {t('card.google')}
        </a>
      </div>
    </div>
  )
}

function CompareCard({ card, locale, onDirections }: { card: AskCard; locale: SiteLocale; onDirections: (way: string) => void }) {
  const t = translator(askTripStrings, locale)
  const ta = translator(advisorStrings, locale)
  const c = card.compare!
  const named = (w: { way: string }) => w.way in WAY_ICON && `cost.name_${w.way}` in advisorStrings.en
  const ways = c.ways
    .filter(named)
    .sort((a, b) => Number(b.way === c.recommended) - Number(a.way === c.recommended) || (a.minutes ?? 999) - (b.minutes ?? 999))
  if (!ways.length) return null
  const slowest = Math.max(1, ...ways.map((w) => w.minutes_up_to ?? w.minutes ?? 0))
  const best = ways.find((w) => w.way === c.recommended) ?? ways[0]
  // Directions for the best fit, or the quickest other way when that's driving or a shuttle.
  const mapsCan = (w?: { way: string }) => !!w && w.way !== 'drive' && w.way !== 'shuttle'
  const go = mapsCan(best) ? best : ways.find(mapsCan) ?? best
  const from = placeName(card.from.name, locale)

  return (
    <div className="mt-2.5 rounded-[12px] border border-[rgba(25,26,46,0.14)] bg-white px-3.5 pb-3.5 pt-3">
      <p className="text-[1rem] font-bold leading-snug text-[#191A2E]">{t('card.ways_to', { place: card.to.name })}</p>
      <p className="text-[0.875rem] text-[#4A4D68]">{c.miles != null ? t('card.from_miles', { place: from, miles: c.miles }) : t('card.from', { place: from })}</p>
      <ul className="mt-2.5 space-y-2">
        {ways.map((w) => {
          const WayIcon = WAY_ICON[w.way]
          const isBest = w.way === best.way
          const minutes = w.minutes ?? 0
          return (
            <li key={w.way} className={`rounded-[10px] border px-3 py-2.5 ${isBest ? 'border-[#2D6A4F] bg-[#F4F8EE]' : 'border-[rgba(25,26,46,0.14)]'}`}>
              <div className="flex items-center gap-2">
                <WayIcon size={18} weight={isBest ? 'bold' : 'regular'} className={isBest ? 'text-[#1F4D3A]' : 'text-[#191A2E]'} aria-hidden />
                <span className={`min-w-0 truncate text-[0.9375rem] font-semibold ${isBest ? 'text-[#1F4D3A]' : 'text-[#191A2E]'}`}>
                  {ta(`cost.name_${w.way}` as Parameters<typeof ta>[0])}
                </span>
                {isBest && <span className="shrink-0 rounded-full bg-[#2D6A4F] px-2 py-0.5 text-[0.8125rem] font-semibold text-white">{t('card.best')}</span>}
                <span className="ml-auto shrink-0 text-[0.9375rem] font-semibold text-[#191A2E]">
                  {w.weekly_cost != null ? t('card.week', { amount: usd(w.weekly_cost) }) : t('card.month', { amount: usd(w.monthly_cost) })}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2.5">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(25,26,46,0.08)]">
                  <span className={`block h-2 rounded-full ${isBest ? 'bg-[#2D6A4F]' : 'bg-[#8C8FA3]'}`} style={{ width: `${Math.max(4, (minutes / slowest) * 100)}%` }} />
                </span>
                <span className="min-w-[74px] text-right text-[0.875rem] font-semibold text-[#191A2E]">
                  {w.minutes_up_to != null && w.minutes_up_to > minutes ? t('card.min_range', { min: minutes, max: w.minutes_up_to }) : t('card.min', { n: minutes })}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      <a
        href={directionsUrl(card.from, card.to, MAPS_MODE[go.way] ?? 'transit')}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onDirections(go.way)}
        className="mt-3 flex min-h-[44px] items-center justify-center rounded-full bg-[#2D6A4F] px-4 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#1F4D3A]"
      >
        {t('card.google')}
      </a>
    </div>
  )
}

function TripMap({ from, to, lines, title }: { from: { lat: number; lng: number }; to: { lat: number; lng: number }; lines: Line[]; title: string }) {
  const all: [number, number][] = [[from.lat, from.lng], [to.lat, to.lng], ...lines.flatMap((l) => l.pts)]
  let minLat = all[0][0], maxLat = all[0][0], minLng = all[0][1], maxLng = all[0][1]
  for (const [lat, lng] of all) {
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat)
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng)
  }
  const pad = 0.002
  const vp = fitViewport({ minLat: minLat - pad, maxLat: maxLat + pad, minLng: minLng - pad, maxLng: maxLng + pad }, W, H, { padFactor: 0.82, minZoom: 9, maxZoom: 16 })
  const maxTile = Math.pow(2, vp.zoom) - 1
  const tiles: { key: string; url: string; x: number; y: number }[] = []
  for (let tx = Math.floor(vp.originX / TILE); tx <= Math.floor((vp.originX + W) / TILE); tx++) {
    for (let ty = Math.floor(vp.originY / TILE); ty <= Math.floor((vp.originY + H) / TILE); ty++) {
      if (tx < 0 || ty < 0 || tx > maxTile || ty > maxTile) continue
      tiles.push({ key: `${tx}-${ty}`, url: rasterTileUrl('voyager', vp.zoom, tx, ty), x: tx * TILE - vp.originX, y: ty * TILE - vp.originY })
    }
  }
  const path = (pts: [number, number][]) => pts.map(([lat, lng], i) => {
    const p = toPixel(vp, lat, lng)
    return `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }).join(' ')
  const a = toPixel(vp, from.lat, from.lng)
  const b = toPixel(vp, to.lat, to.lng)

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={title} className="block h-[180px] w-full sm:h-[220px]" style={{ background: '#EDECE6' }}>
        <title>{title}</title>
        {tiles.map((tile) => <image key={tile.key} href={tile.url} x={tile.x} y={tile.y} width={TILE} height={TILE} />)}
        {lines.map((l, i) => l.pts.length > 1 && (
          <g key={i} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {!l.dash && <path d={path(l.pts)} stroke="#ffffff" strokeWidth={l.width + 4} />}
            <path d={path(l.pts)} stroke={l.color} strokeWidth={l.width} strokeDasharray={l.dash} />
          </g>
        ))}
        <circle cx={a.x} cy={a.y} r={7} fill="#191A2E" stroke="#ffffff" strokeWidth={3} />
        <circle cx={b.x} cy={b.y} r={10} fill="#2D6A4F" stroke="#ffffff" strokeWidth={3} />
        <circle cx={b.x} cy={b.y} r={3.5} fill="#ffffff" />
      </svg>
      <figcaption className="px-3.5 pt-1 text-[0.75rem] text-[#5B6075]">{RASTER_TILE_ATTRIBUTION}</figcaption>
    </figure>
  )
}
