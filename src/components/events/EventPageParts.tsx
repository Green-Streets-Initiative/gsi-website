'use client'

/**
 * Pieces of the event page in the site's picked look (Direction A, "What's on
 * near you", Keith 2026-11-17; docs/design-review-2026-11). A date tile and a
 * small map of the start say when and where at a glance; "Getting there" lists the
 * real nearest station, bus stop and bike share dock with walk times, each a
 * tap away from directions; "More near here" shows what else is on close by.
 */

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { Bike, Bus, ChevronRight, MapPin, TrainFront } from 'lucide-react'
import { gaEvent } from '@/lib/ga'
import { type CommunityEvent, directionsUrl, parseEventDate } from '@/lib/events'
import type { SiteLocale } from '@/lib/site-i18n'
import type { EventsT } from '@/lib/events-i18n'
import { capitalizeStopName, fetchBikeShareDocks, fetchMBTAStops, fetchTrainStops } from '@/lib/nearby/live-data'
import type { BluebikeStationLive, MBTAStopLive } from '@/lib/wayfinding/types'
import type { EventHost } from '@/lib/event-hosts'
import EventCard from './EventCard'
import { MapSquare } from './CardThumb'

/** The site green, for the map pin. */
export const SIGN_GREEN = '#1F6B45'

const intlTag = (locale: SiteLocale) => (locale === 'en' ? 'en-US' : locale)

/** "Sat" over "21": the day a person scans for. */
export function DateTile({ date, locale, size = 'md' }: { date: string; locale: SiteLocale; size?: 'sm' | 'md' }) {
  const d = parseEventDate(date)
  const weekday = new Intl.DateTimeFormat(intlTag(locale), { weekday: 'short' }).format(d)
  const sm = size === 'sm'
  return (
    <div className={`flex shrink-0 flex-col items-center justify-center border border-(--ev-line-strong) bg-(--ev-card) leading-none ${sm ? 'h-[46px] w-[46px] rounded-[10px]' : 'h-[56px] w-[56px] rounded-[12px]'}`} aria-hidden>
      <span className="text-[13px] font-bold text-(--ev-accent)">{weekday}</span>
      <span className={`font-(family-name:--font-headline) font-extrabold text-(--ev-ink) ${sm ? 'mt-0.5 text-[19px]' : 'mt-1 text-[22px]'}`}>{d.getDate()}</span>
    </div>
  )
}

/**
 * The place's picture beside its name: a small street map of the start with
 * a pin, the same square the /events cards use (Keith 2026-11-19, replacing
 * the green sign). A pin tile when there is no spot to map.
 */
export function PlaceSquare({ lat, lng }: { lat: number | null | undefined; lng: number | null | undefined }) {
  const ok = lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number(lat) !== 0
  return (
    <div className="relative flex h-[56px] w-[56px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-(--ev-line) bg-[#EEF0EA] text-(--ev-accent)" aria-hidden>
      {ok ? <MapSquare lat={Number(lat)} lng={Number(lng)} /> : <MapPin size={22} />}
    </div>
  )
}

/** A host's square logo on white, or their initials when we have no logo. */
export function HostMark({ host, size }: { host: EventHost; size: number }) {
  const [ok, setOk] = useState(true)
  const initials = host.name.replace(/\([^)]*\)/g, '').split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
  const radius = size >= 48 ? 'rounded-[12px]' : 'rounded-full'
  if (host.logo && ok) {
    return (
      <span className={`flex shrink-0 items-center justify-center overflow-hidden border border-(--ev-line) bg-white ${radius}`} style={{ width: size, height: size, padding: Math.round(size * 0.1) }} aria-hidden>
        <img src={host.logo} alt="" className="max-h-full max-w-full object-contain" onError={() => setOk(false)} />
      </span>
    )
  }
  return (
    <span className={`flex shrink-0 items-center justify-center bg-(--ev-primary) font-(family-name:--font-headline) font-extrabold text-white ${radius}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden>
      {initials || <MapPin size={Math.round(size * 0.45)} />}
    </span>
  )
}

/** About 80 meters a minute on foot, rounded up, never under 1. */
const walkMin = (m: number) => Math.max(1, Math.ceil(m / 80))

function mapsDir(ev: CommunityEvent, mode: 'transit' | 'bicycling' | 'walking'): string {
  return directionsUrl(ev, mode)
}

/** The nearest stop and every route that serves it. */
function nearestStop(stops: MBTAStopLive[] | null) {
  if (!stops || stops.length === 0) return null
  const sorted = [...stops].sort((a, b) => a.distance_meters - b.distance_meters)
  const first = sorted[0]
  const same = sorted.filter((s) => s.name === first.name)
  const routes = Array.from(new Set(same.map((s) => s.route_name)))
  const routeIds = Array.from(new Set(same.map((s) => s.route_id)))
  const nexts = same.map((s) => s.next_arrival_minutes).filter((n): n is number => typeof n === 'number' && n >= 0)
  return { name: capitalizeStopName(first.name), meters: first.distance_meters, routes, routeIds, next: nexts.length ? Math.min(...nexts) : null }
}

/** The T line's own color and letters, so the row reads like the map at the station. */
function lineBadge(routeId: string | undefined): { bg: string; fg: string; text: string | null } {
  const id = routeId ?? ''
  if (id.startsWith('Green')) return { bg: '#00843D', fg: '#fff', text: 'GL' }
  if (id === 'Red' || id === 'Mattapan') return { bg: '#DA291C', fg: '#fff', text: id === 'Red' ? 'RL' : 'M' }
  if (id === 'Orange') return { bg: '#ED8B00', fg: '#fff', text: 'OL' }
  if (id === 'Blue') return { bg: '#003DA5', fg: '#fff', text: 'BL' }
  if (id.startsWith('CR-')) return { bg: '#80276C', fg: '#fff', text: 'CR' }
  return { bg: '#2D6A4F', fg: '#fff', text: null }
}

interface Live {
  train: MBTAStopLive[] | null
  bus: MBTAStopLive[] | null
  dock: BluebikeStationLive | null | undefined
}

type Row = {
  key: string
  href: string
  name: string
  sub: string
  value?: string
  surface: string
  badge: { bg: string; fg: string; text: string | null; Icon: typeof Bus }
  /** Bluebikes' own wordmark in place of its name in the line under. */
  mark?: boolean
}

const MARK = '\u0000'

/** "[BLUEbikes] dock at the start": the system's wordmark where its name goes. */
function SubLine({ text, mark }: { text: string; mark?: boolean }) {
  if (!mark || !text.includes(MARK)) return <>{text.replace(MARK, 'Bluebikes')}</>
  const [before, after] = text.split(MARK)
  return (
    <>
      {before}
      <span className="mx-0.5 inline-flex h-[20px] items-center rounded-[5px] bg-[#1D5FA8] px-1.5 align-[-4px]">
        <img src="/assets/nearby/bluebikes.svg" alt="Bluebikes" className="block h-[11px] w-auto" />
      </span>
      {after}
    </>
  )
}

/** Real stops near the start, nearest first, each linking to directions in that mode. */
export function GettingThere({
  event, isToday, t, onDirections,
}: {
  event: CommunityEvent
  isToday: boolean
  t: EventsT
  onDirections: (surface: string, mode: string) => void
}) {
  const lat = event.location_lat
  const lng = event.location_lng
  const [live, setLive] = useState<Live>({ train: null, bus: null, dock: undefined })

  useEffect(() => {
    if (!lat || !lng) return
    let alive = true
    const set = (patch: Partial<Live>) => alive && setLive((l) => ({ ...l, ...patch }))
    fetchTrainStops(lat, lng).then((train) => set({ train })).catch(() => set({ train: [] }))
    fetchMBTAStops(lat, lng).then((bus) => set({ bus })).catch(() => set({ bus: [] }))
    fetchBikeShareDocks(lat, lng, 800)
      .then((docks) => set({ dock: [...docks].sort((a, b) => a.distance_meters - b.distance_meters)[0] ?? null }))
      .catch(() => set({ dock: null }))
    return () => { alive = false }
  }, [lat, lng])

  if (!lat || !lng) return null

  const train = nearestStop(live.train)
  const bus = nearestStop(live.bus)
  const rows: Row[] = []
  const minWalk = (m: number) => t('gt.walk', { min: walkMin(m) })

  if (train) {
    const b = lineBadge(train.routeIds[0])
    rows.push({
      key: 'train',
      href: mapsDir(event, 'transit'),
      name: /station/i.test(train.name) ? train.name : t('gt.station', { name: train.name }),
      sub: `${train.routes.join(', ')}${isToday && train.next != null ? ` · ${t('gt.next', { min: train.next })}` : ''}`,
      value: minWalk(train.meters),
      surface: 'getting_there_train',
      badge: { ...b, Icon: TrainFront },
    })
  } else {
    rows.push({
      key: 'train',
      href: mapsDir(event, 'transit'),
      name: t('gt.by_transit'),
      sub: live.train === null ? t('gt.finding') : t('gt.transit_from_you'),
      surface: 'getting_there_transit',
      badge: { bg: '#2D6A4F', fg: '#fff', text: null, Icon: TrainFront },
    })
  }
  if (bus) {
    const first = bus.routes[0] ?? ''
    rows.push({
      key: 'bus',
      href: mapsDir(event, 'transit'),
      name: bus.name,
      sub: `${t(bus.routes.length === 1 ? 'gt.bus_one' : 'gt.bus_other', { routes: bus.routes.slice(0, 5).join(', ') })}${isToday && bus.next != null ? ` · ${t('gt.next', { min: bus.next })}` : ''}`,
      value: minWalk(bus.meters),
      surface: 'getting_there_bus',
      badge: { bg: '#FFC72C', fg: '#191A2E', text: first.length <= 3 ? first : null, Icon: Bus },
    })
  }
  if (live.dock) {
    rows.push({
      key: 'dock',
      href: mapsDir(event, 'bicycling'),
      name: live.dock.name,
      sub: isToday
        ? t('gt.dock_now', { bikes: live.dock.num_bikes_available, docks: live.dock.num_docks_available })
        : t(walkMin(live.dock.distance_meters) <= 1 ? 'gt.dock_at' : 'gt.dock_near', { system: /bluebikes/i.test(live.dock.system_name ?? '') ? MARK : live.dock.system_name ?? 'Bike share' }),
      mark: /bluebikes/i.test(live.dock.system_name ?? ''),
      value: minWalk(live.dock.distance_meters),
      surface: 'getting_there_bikeshare',
      badge: { bg: '#1D5FA8', fg: '#fff', text: null, Icon: Bike },
    })
  } else {
    rows.push({
      key: 'bike',
      href: mapsDir(event, 'bicycling'),
      name: t('gt.by_bike'),
      sub: t('gt.bike_from_you'),
      surface: 'getting_there_bike',
      badge: { bg: '#1D5FA8', fg: '#fff', text: null, Icon: Bike },
    })
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.key}>
          <a
            href={r.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onDirections(r.surface, r.key === 'dock' || r.key === 'bike' ? 'bicycling' : 'transit')}
            className="grid min-h-[64px] grid-cols-[44px_1fr_auto] items-center gap-3 rounded-[12px] border border-(--ev-line) bg-(--ev-card) px-3 py-2.5 transition-colors hover:border-(--ev-line-stronger)"
          >
            <span
              className="flex h-11 w-11 items-center justify-center rounded-[10px] font-(family-name:--font-headline) text-[15px] font-extrabold"
              style={{ backgroundColor: r.badge.bg, color: r.badge.fg }}
              aria-hidden
            >
              {r.badge.text ?? <r.badge.Icon size={20} />}
            </span>
            <span className="min-w-0">
              <span className="block text-[16px] font-bold leading-snug text-(--ev-ink)">{r.name}</span>
              <span className="block text-[14px] leading-snug text-(--ev-ink-75)"><SubLine text={r.sub} mark={r.mark} /></span>
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap text-[14px] font-bold text-(--ev-ink-80)">
              {r.value}
              <ChevronRight size={18} aria-hidden />
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}

/** A few other events close by on the same days, as the same cards /events shows (Keith 2026-11-19). */
export function MoreNearHere({
  events, fromId,
}: {
  events: CommunityEvent[]
  fromId: string
  hrefBase?: string
  locale?: SiteLocale
}) {
  if (events.length === 0) return null
  return (
    <ul className="flex flex-col gap-2.5">
      {events.map((e) => (
        <li key={e.id}>
          <EventCard
            event={e}
            userLat={Number(e.location_lat) || 0}
            userLng={Number(e.location_lng) || 0}
            showDate
            stacked
            onOpen={() => {
              posthog.capture('event_more_near_click', { event_id: fromId, to_event_id: e.id })
              gaEvent('event_more_near_click', { event_id: fromId })
            }}
          />
        </li>
      ))}
    </ul>
  )
}

/**
 * A picture of the meeting spot for the first screen when the listing has no
 * flyer: one cached map tile (/api/map-tiles) cropped around the start, with
 * the pin. Taps through to the full map under Where you meet.
 */
export function PlaceThumb({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const z = 16
  const n = 2 ** z
  const xf = ((lng + 180) / 360) * n
  const latR = (lat * Math.PI) / 180
  const yf = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n
  const x = Math.floor(xf)
  const y = Math.floor(yf)
  // The start's spot inside the 256px tile, as a share of it.
  const px = (xf - x) * 100
  const py = (yf - y) * 100
  return (
    <a href="#where-meet" className="relative block aspect-[3/4] overflow-hidden rounded-[12px] border border-(--ev-line) bg-(--ev-panel)" aria-label={label}>
      <img
        src={`/api/map-tiles/${z}/${x}/${y}`}
        alt=""
        className="absolute h-[256px] w-[256px] max-w-none"
        style={{ left: `calc(50% - ${(px / 100) * 256}px)`, top: `calc(50% - ${(py / 100) * 256}px)` }}
      />
      <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full" width="26" height="32" viewBox="0 0 32 40" aria-hidden>
        <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24C32 7.163 24.837 0 16 0z" fill={SIGN_GREEN} />
        <circle cx="16" cy="15" r="6" fill="#fff" />
      </svg>
    </a>
  )
}

/** Web addresses in the host's text become links. */
export function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g)
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow ugc" className="font-semibold text-(--ev-accent) underline underline-offset-2">
            {p.replace(/^https?:\/\/(www\.)?/, '')}
          </a>
        ) : (
          p
        ),
      )}
    </>
  )
}
