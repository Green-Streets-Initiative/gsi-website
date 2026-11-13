'use client'

import { useState } from 'react'
import { type StationGroup, shuttleAgencyForStation, isShuttleStation } from './useNearbyModel'
import { withUtm } from '@/lib/utm'
import { useNearbyLocale, useNearbyT } from './NearbyI18n'
import type { ShuttleAccess } from '@/lib/nearby/shuttle-agencies'

/**
 * The two lines every campus / TMA shuttle stop needs and no MBTA stop does:
 * WHO runs it and WHO may board.
 *
 * A shuttle stop is drawn like a bus stop and named like one ("Market Basket
 * Somerville"), so without this a rider can't tell that the indigo pin is an
 * MIT shuttle they may need an MIT ID to use. The policy itself lives in
 * lib/nearby/shuttle-agencies.ts, verified per operator.
 */
const ACCESS_KEY: Record<ShuttleAccess, string> = {
  public: 'shuttle.access_public',
  'public-fare': 'shuttle.access_public_fare',
  id: 'shuttle.access_id',
  unstated: 'shuttle.access_unstated',
}

export function ShuttleOperatorLines({
  station,
  variant = 'compact',
  className = '',
}: {
  station: StationGroup
  /** 'compact' = one line for a list card; 'detail' = two, with room to
   *  spell out what kind of service this is. */
  variant?: 'compact' | 'detail'
  className?: string
}) {
  const tr = useNearbyT()
  const agency = isShuttleStation(station) ? shuttleAgencyForStation(station) : null
  if (!agency) return null
  const accessKey = ACCESS_KEY[agency.access]
  const access = tr(accessKey, { operator: agency.idName })
  if (variant === 'detail') {
    return (
      <span className={`block text-[0.78rem] leading-snug ${className}`}>
        <span className="block text-(--nb-ink-80)">{agency.name}</span>
        <span className="block text-(--nb-ink-70)">{access}</span>
        {agency.url && (
          <a
            href={withUtm(agency.url, { medium: 'nearby', campaign: 'shuttle', content: agency.prefix }) ?? agency.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block font-semibold text-(--nb-accent) underline-offset-2 hover:underline"
          >
            {tr('shuttle.operator_link')} &rarr;<span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </span>
    )
  }
  return (
    <span className={`block text-[0.78rem] leading-snug text-(--nb-ink-80) ${className}`}>
      {agency.name}
      <span className="text-(--nb-ink-70)"> · {access}</span>
    </span>
  )
}

type StationRoute = StationGroup['routes'][number]

/** The word beside a timetable time: the days it runs when only weekdays or
 *  only weekends (a bare "in 20 min" on a Monday-to-Friday shuttle reads as
 *  every day), otherwise "scheduled". Same rule as the app's RouteRow. */
export function scheduledWordKey(route: Pick<StationRoute, 'serviceDays'>): string {
  return route.serviceDays === 31 ? 'shuttle.weekdays' : route.serviceDays === 96 ? 'shuttle.weekends' : 'transit.scheduled'
}

/** "3:00 PM" today, "Sat 9:13 AM" another day (the app's nextScheduledLabel):
 *  EZRide's weekend run, read on a Monday, is five days out. */
export function nextAtTime(iso: string, locale: string): string {
  const when = new Date(iso)
  const time = when.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
  const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  if (day(when) === day(new Date())) return time
  return `${when.toLocaleDateString(locale, { weekday: 'short', timeZone: 'America/New_York' })} ${time}`
}

/** The next time for a route whose rows name no direction (most shuttles):
 *  "in 6 min", "in 24 min · scheduled", or, with nothing soon but a later
 *  run in the timetable, "next 3:00 PM". Lower Mystic runs mornings and
 *  afternoons; at noon the true answer is "not until three", not a blank. */
export function ShuttleNextAt({ route, className = '' }: { route: StationRoute; className?: string }) {
  const tr = useNearbyT()
  const locale = useNearbyLocale()
  const soonest = route.arrivals
    .filter(a => a.nextMin !== null)
    .sort((a, b) => (a.nextMin as number) - (b.nextMin as number))[0]
  if (soonest) {
    return (
      <strong className={`ml-auto shrink-0 text-[0.75rem] font-bold text-(--nb-accent) ${className}`}>
        {soonest.nextMin === 0 ? tr('detail.now') : tr('detail.in_min', { minutes: soonest.nextMin })}
        {soonest.scheduled ? <span className="text-[13px] font-normal text-(--nb-ink-80)"> · {tr(scheduledWordKey(route))}</span> : null}
      </strong>
    )
  }
  if (!route.nextAt) return null
  return (
    <strong className={`ml-auto shrink-0 text-[0.75rem] font-bold text-(--nb-ink-80) ${className}`}>
      {tr('shuttle.next_at', { time: nextAtTime(route.nextAt, locale) })}
      <span className="text-[13px] font-normal"> · {tr(scheduledWordKey(route))}</span>
    </strong>
  )
}

/**
 * "Where it goes" for a shuttle stop: each route's stops in travel order,
 * with this stop called out, as in the app's Around You (DetailPane
 * ShuttleRouteStops). A shuttle has no line on any map people know, so the
 * list is how someone tells whether it goes their way. Nothing for MBTA and
 * regional stops, or when the server sent no order.
 */
export function ShuttleRouteStops({ station, className = '' }: { station: StationGroup; className?: string }) {
  const tr = useNearbyT()
  const [expanded, setExpanded] = useState<string | null>(null)
  if (!isShuttleStation(station)) return null
  const routes = station.routes.filter(r => (r.stops?.length ?? 0) > 1)
  if (routes.length === 0) return null
  const here = new Set(station.stopIds ?? [])
  // A long campus route is a wall of stops: the shape of the trip first
  const PREVIEW = 5
  return (
    <div className={className}>
      {routes.map(r => {
        const stops = r.stops ?? []
        const open = expanded === r.id
        const shown = open ? stops : stops.slice(0, PREVIEW)
        const rest = stops.length - shown.length
        return (
          <div key={r.id} className="mt-2.5">
            <div className="text-[14px] font-bold text-(--nb-ink)">{tr('shuttle.where_it_goes', { route: r.name })}</div>
            <ol className="mt-1.5 space-y-1">
              {shown.map((st, i) => {
                const isHere = here.has(st.id)
                return (
                  <li key={`${st.id}-${i}`} className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className={`shrink-0 rounded-full ${isHere ? 'h-2.5 w-2.5 bg-(--nb-accent)' : 'h-[7px] w-[7px] bg-(--nb-line-strong)'}`}
                    />
                    <span className={`min-w-0 truncate text-[14px] ${isHere ? 'font-bold text-(--nb-ink)' : 'text-(--nb-ink-80)'}`}>
                      {isHere ? tr('shuttle.you_are_here', { stop: st.name }) : st.name}
                    </span>
                  </li>
                )
              })}
            </ol>
            {rest > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpanded(r.id) }}
                className="mt-1 py-1 text-[14px] font-semibold text-(--nb-accent) hover:opacity-80"
              >
                {tr(rest === 1 ? 'shuttle.more_stops_one' : 'shuttle.more_stops_other', { count: rest })}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
