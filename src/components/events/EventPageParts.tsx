'use client'

/**
 * Pieces of the event page in the site's picked look (Direction A, "What's on
 * near you", Keith 2026-11-17; docs/design-review-2026-11). A date tile and a
 * green place sign say when and where at a glance; "Getting there" lists the
 * real nearest station, bus stop and bike share dock with walk times, each a
 * tap away from directions; "More near here" shows what else is on close by.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import posthog from 'posthog-js'
import { Bike, Bus, ChevronRight, MapPin, ParkingSquare, TrainFront } from 'lucide-react'
import { gaEvent } from '@/lib/ga'
import { eventPath } from '@/lib/events-url'
import { type CommunityEvent, directionsUrl, parseEventDate } from '@/lib/events'
import { withLang, type SiteLocale } from '@/lib/site-i18n'
import { timeL, type EventsT } from '@/lib/events-i18n'
import { capitalizeStopName, fetchBikeParking, fetchBikeShareDocks, fetchMBTAStops, fetchTrainStops } from '@/lib/nearby/live-data'
import type { BikeParkingSpot, BluebikeStationLive, MBTAStopLive } from '@/lib/wayfinding/types'

/** The green of a street-name sign. */
export const SIGN_GREEN = '#1F6B45'

const intlTag = (locale: SiteLocale) => (locale === 'en' ? 'en-US' : locale)

/** "Sat" over "21": the day a person scans for. */
export function DateTile({ date, locale }: { date: string; locale: SiteLocale }) {
  const d = parseEventDate(date)
  const weekday = new Intl.DateTimeFormat(intlTag(locale), { weekday: 'short' }).format(d)
  return (
    <div className="flex h-[56px] w-[56px] shrink-0 flex-col items-center justify-center rounded-[12px] border border-(--ev-line-strong) bg-(--ev-card) leading-none" aria-hidden>
      <span className="text-[13px] font-bold text-(--ev-accent)">{weekday}</span>
      <span className="mt-1 font-(family-name:--font-headline) text-[22px] font-extrabold text-(--ev-ink)">{d.getDate()}</span>
    </div>
  )
}

/**
 * The place's short name the way a street sign prints it: "Union Square,
 * Somerville, MA" becomes "Union Sq". Null when the listing gives a street
 * address or nothing short enough to fit the tile.
 */
export function signName(locationName: string | null): string | null {
  const first = (locationName ?? '').split(',')[0].trim()
  if (!first || /^\d/.test(first) || /see event page/i.test(first)) return null
  const short = first
    .replace(/\bSquare\b/g, 'Sq')
    .replace(/\bStation\b/g, 'Sta')
    .replace(/\bStreet\b/g, 'St')
    .replace(/\bAvenue\b/g, 'Ave')
    .replace(/^The\s+/i, '')
  return short.length <= 10 ? short : null
}

/** The green place sign: the short name when it fits, a pin when it doesn't. */
export function PlaceSign({ locationName }: { locationName: string | null }) {
  const name = signName(locationName)
  return (
    <div
      className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-[10px] px-1 text-center font-(family-name:--font-headline) text-[13px] font-extrabold leading-[1.1] text-white"
      style={{ backgroundColor: SIGN_GREEN, boxShadow: `inset 0 0 0 2px #fff, 0 0 0 1px ${SIGN_GREEN}` }}
      aria-hidden
    >
      {name ?? <MapPin size={22} />}
    </div>
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
  racks: BikeParkingSpot[] | null
}

type Row = {
  key: string
  href: string
  name: string
  sub: string
  value?: string
  surface: string
  badge: { bg: string; fg: string; text: string | null; Icon: typeof Bus }
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
  const [live, setLive] = useState<Live>({ train: null, bus: null, dock: undefined, racks: null })

  useEffect(() => {
    if (!lat || !lng) return
    let alive = true
    const set = (patch: Partial<Live>) => alive && setLive((l) => ({ ...l, ...patch }))
    fetchTrainStops(lat, lng).then((train) => set({ train })).catch(() => set({ train: [] }))
    fetchMBTAStops(lat, lng).then((bus) => set({ bus })).catch(() => set({ bus: [] }))
    fetchBikeShareDocks(lat, lng, 800)
      .then((docks) => set({ dock: [...docks].sort((a, b) => a.distance_meters - b.distance_meters)[0] ?? null }))
      .catch(() => set({ dock: null }))
    fetchBikeParking(lat, lng, 400).then((racks) => set({ racks })).catch(() => set({ racks: [] }))
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
        : t(walkMin(live.dock.distance_meters) <= 1 ? 'gt.dock_at' : 'gt.dock_near', { system: live.dock.system_name ?? 'Bike share' }),
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
  if (live.racks && live.racks.length > 0) {
    rows.push({
      key: 'racks',
      href: mapsDir(event, 'bicycling'),
      name: t('gt.racks'),
      sub: t('gt.racks_sub'),
      value: String(live.racks.length),
      surface: 'getting_there_racks',
      badge: { bg: '#4A4D68', fg: '#fff', text: null, Icon: ParkingSquare },
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
            onClick={() => onDirections(r.surface, r.key === 'dock' || r.key === 'bike' || r.key === 'racks' ? 'bicycling' : 'transit')}
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
              <span className="block text-[14px] leading-snug text-(--ev-ink-75)">{r.sub}</span>
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

/** A few other events close by on the same days, with their own place signs. */
export function MoreNearHere({
  events, fromId, hrefBase, locale,
}: {
  events: CommunityEvent[]
  fromId: string
  hrefBase: string
  locale: SiteLocale
}) {
  if (events.length === 0) return null
  return (
    <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-1">
      {events.map((e) => {
        const d = parseEventDate(e.event_date)
        const when = `${new Intl.DateTimeFormat(intlTag(locale), { weekday: 'short' }).format(d)}${e.event_time ? ` ${timeL(e.event_time, locale)}` : ''}`
        const sign = signName(e.location_name)
        return (
          <li key={e.id}>
            <Link
              href={withLang(eventPath(e, hrefBase), locale)}
              onClick={() => {
                posthog.capture('event_more_near_click', { event_id: fromId, to_event_id: e.id })
                gaEvent('event_more_near_click', { event_id: fromId })
              }}
              className="flex h-full flex-col gap-1.5 rounded-[12px] border border-(--ev-line) bg-(--ev-card) p-3 transition-colors hover:border-(--ev-line-stronger)"
            >
              <span className="text-[14px] font-bold text-(--ev-ink-75)">{when}</span>
              <span className="font-(family-name:--font-headline) text-[16px] font-extrabold leading-snug text-(--ev-ink)">{e.title}</span>
              {sign ? (
                <span
                  className="self-start rounded-[4px] px-2 pb-0.5 pt-1 font-(family-name:--font-headline) text-[13px] font-extrabold text-white"
                  style={{ backgroundColor: SIGN_GREEN, boxShadow: `inset 0 0 0 1.5px #fff, 0 0 0 1px ${SIGN_GREEN}` }}
                >
                  {sign}
                </span>
              ) : e.location_name ? (
                <span className="text-[14px] text-(--ev-ink-75)">{e.location_name.split(',')[0]}</span>
              ) : null}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
