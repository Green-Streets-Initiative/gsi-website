'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import posthog from 'posthog-js'
import { gaEvent } from '@/lib/ga'
import FixListingLink from '@/components/hosts/FixListingLink'
import { EventPageAlertSignup } from '@/components/events/EventAlertSignup'
import { parseEventBody } from '@/lib/event-body'
import {
  type CommunityEvent, type NextUp,
  getTypeMeta, formatTime, dateLong, parseEventDate, isDeadline,
  buildIcs, gcalUrl, directionsUrl, eventRideStyle, isNoDrop, rideLengthLabel, RIDE_STYLE_LABEL,
} from '@/lib/events'
import { eventPath } from '@/lib/events-url'
import { capitalizeStopName, fetchBikeParking, fetchBikeShareDocks, fetchMBTAStops, fetchTrainStops } from '@/lib/nearby/live-data'
import type { BikeParkingSpot, BluebikeStationLive, MBTAStopLive } from '@/lib/wayfinding/types'
import { MileMarkers, Plaque } from './Signs'

/**
 * The event page in the wayfinding look (prototype, 2026-11-04). The title
 * sits on a green sign; the facts a person decides on are mile markers; and
 * "Getting there" is a guide sign with the real nearest station, bus stop,
 * bike share dock and racks, each with its walk time. Tracking matches
 * EventDetail so a prototype visit counts the same way.
 */

function withUtm(url: string): string {
  try {
    const u = new URL(url)
    u.searchParams.set('utm_source', 'gsi')
    u.searchParams.set('utm_medium', 'events_calendar')
    u.searchParams.set('utm_campaign', 'community_events')
    return u.toString()
  } catch {
    return url
  }
}

/** About 80 meters a minute on foot, rounded up, never under 1. */
const walkMin = (m: number) => Math.max(1, Math.ceil(m / 80))

function mapsDir(ev: CommunityEvent, mode: 'transit' | 'bicycling' | 'walking'): string {
  return directionsUrl(ev).replace(/travelmode=[a-z]+/, `travelmode=${mode}`)
}

function Arrow() {
  return (
    <svg className="sg-row-arrow" viewBox="0 0 28 28" aria-hidden="true">
      <path d="M4 14h17M14 6l8 8-8 8" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface Live {
  train: MBTAStopLive[] | null
  bus: MBTAStopLive[] | null
  dock: BluebikeStationLive | null | undefined
  racks: BikeParkingSpot[] | null
}

/** The nearest stop and every route that serves it. */
function nearestStop(stops: MBTAStopLive[] | null): { name: string; meters: number; routes: string[]; next: number | null } | null {
  if (!stops || stops.length === 0) return null
  const sorted = [...stops].sort((a, b) => a.distance_meters - b.distance_meters)
  const first = sorted[0]
  const same = sorted.filter((s) => s.name === first.name)
  const routes = Array.from(new Set(same.map((s) => s.route_name)))
  const nexts = same.map((s) => s.next_arrival_minutes).filter((n): n is number => typeof n === 'number' && n >= 0)
  return { name: capitalizeStopName(first.name), meters: first.distance_meters, routes, next: nexts.length ? Math.min(...nexts) : null }
}

function GettingThere({
  event,
  isToday,
  town,
  onDirections,
  onTown,
}: {
  event: CommunityEvent
  isToday: boolean
  town: { name: string; href: string } | null
  onDirections: (surface: string) => void
  onTown: () => void
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
    return () => {
      alive = false
    }
  }, [lat, lng])

  if (!lat || !lng) return null

  const train = nearestStop(live.train)
  const bus = nearestStop(live.bus)
  const racks = live.racks
  const rackCount = racks ? racks.length : null

  type Row = { key: string; href: string; name: string; sub: string; value?: string; surface: string; internal?: boolean }
  const rows: Row[] = []

  rows.push(
    train
      ? {
          key: 'train',
          href: mapsDir(event, 'transit'),
          name: /station/i.test(train.name) ? train.name : `${train.name} station`,
          sub: `${train.routes.join(', ')}${isToday && train.next != null ? ` · next in ${train.next} min` : ''}`,
          value: `${walkMin(train.meters)} min walk`,
          surface: 'getting_there_train',
        }
      : {
          key: 'train',
          href: mapsDir(event, 'transit'),
          name: 'By transit',
          sub: live.train === null ? 'Finding the nearest station' : 'Transit directions from where you are',
          surface: 'getting_there_transit',
        },
  )
  if (bus) {
    rows.push({
      key: 'bus',
      href: mapsDir(event, 'transit'),
      name: bus.name,
      sub: `${bus.routes.length === 1 ? 'Bus' : 'Buses'} ${bus.routes.slice(0, 5).join(', ')}${isToday && bus.next != null ? ` · next in ${bus.next} min` : ''}`,
      value: `${walkMin(bus.meters)} min walk`,
      surface: 'getting_there_bus',
    })
  }
  rows.push(
    live.dock
      ? {
          key: 'dock',
          href: mapsDir(event, 'bicycling'),
          name: live.dock.name,
          sub: isToday
            ? `${live.dock.num_bikes_available} bikes and ${live.dock.num_docks_available} open docks now`
            : `Bluebikes dock ${walkMin(live.dock.distance_meters) <= 1 ? 'next to' : 'near'} the start`,
          value: `${walkMin(live.dock.distance_meters)} min walk`,
          surface: 'getting_there_bikeshare',
        }
      : {
          key: 'bike',
          href: mapsDir(event, 'bicycling'),
          name: 'By bike',
          sub: 'Bike directions from where you are',
          surface: 'getting_there_bike',
        },
  )
  if (rackCount && rackCount > 0) {
    rows.push({
      key: 'racks',
      href: mapsDir(event, 'bicycling'),
      name: 'Bike racks',
      sub: 'Within a 5 minute walk of the start',
      value: String(rackCount),
      surface: 'getting_there_racks',
    })
  }
  if (town) {
    rows.push({ key: 'town', href: town.href, name: `Around ${town.name}`, sub: 'Trails, rides and ways to get around', surface: 'town', internal: true })
  }

  return (
    <section aria-labelledby="getting-there" className="sg-guide">
      <div className="sg-guide-inner">
        <h2 id="getting-there" className="sg-guide-title text-[18px]">
          Getting there
        </h2>
        {rows.map((r) =>
          r.internal ? (
            <Link key={r.key} href={r.href} className="sg-row" onClick={onTown}>
              <span className="sg-row-name">{r.name}</span>
              <Arrow />
              <span className="sg-row-sub">{r.sub}</span>
            </Link>
          ) : (
            <a key={r.key} href={r.href} target="_blank" rel="noopener noreferrer" className="sg-row" onClick={() => onDirections(r.surface)}>
              <span className="sg-row-name">{r.name}</span>
              {r.value && <span className="sg-row-value text-[16px]">{r.value}</span>}
              <Arrow />
              <span className="sg-row-sub">{r.sub}</span>
            </a>
          ),
        )}
      </div>
    </section>
  )
}

export default function EventSignView({
  event,
  nextUp,
  isPast,
  isToday,
  sponsorLinks,
  roamLinks,
  rideCode,
  hostHref,
  town,
}: {
  event: CommunityEvent
  nextUp: NextUp | null
  isPast: boolean
  isToday: boolean
  sponsorLinks: Record<string, string>
  roamLinks: Array<{ id: string; name: string; reward_note: string | null }>
  rideCode: string | null
  hostHref: string | null
  town: { name: string; href: string } | null
}) {
  const meta = getTypeMeta(event.event_type)
  const level = eventRideStyle(event)
  const length = rideLengthLabel(event.distance_text)
  const deadline = isDeadline(event.event_type)
  const noDrop = isNoDrop(event)
  const timeStr = event.event_time ? formatTime(event.event_time) : null
  const endStr = event.event_end_time ? formatTime(event.event_end_time) : null
  const d = parseEventDate(event.event_date)
  const dayLine = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const [calOpen, setCalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  const eventProps = (extra: Record<string, unknown>) => ({ event_id: event.id, event_type: event.event_type, is_past: isPast, ...extra })
  const trackCalendar = (method: 'google' | 'ics') => {
    const p = eventProps({ method, surface: 'details' })
    gaEvent('event_calendar_save', p)
    posthog.capture('event_calendar_save', p)
  }
  const trackDirections = (surface: string) => {
    const p = eventProps({ surface })
    gaEvent('event_directions_click', p)
    posthog.capture('event_directions_click', p)
  }
  const trackOutbound = (kind: 'register' | 'info' | 'route') => {
    const p = eventProps({ kind, surface: 'details' })
    posthog.capture('event_outbound_click', p)
    gaEvent(kind === 'register' ? 'event_register_click' : kind === 'route' ? 'event_route_click' : 'event_info_click', p)
  }
  const downloadIcs = () => {
    trackCalendar('ics')
    const blob = new Blob([buildIcs(event)], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.title.replace(/[^a-zA-Z0-9-_ ]/g, '').trim()}.ics`
    a.click()
    URL.revokeObjectURL(url)
    setCalOpen(false)
    showToast('Calendar file downloaded')
  }
  const share = async () => {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: event.title, url }) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url)
      showToast('Link copied')
    }
  }

  // The one thing that means "I'm going": RSVP for a Shift ride, else the
  // organizer's registration, else their event page.
  const registerLabel = event.tags.includes('sold_out') ? 'Join the waitlist' : 'Register'
  const primary =
    rideCode && !isPast
      ? { href: `/rides/${rideCode}?date=${event.event_date}`, label: 'RSVP', internal: true, track: () => posthog.capture('ride_page_open', { from: 'event_detail', surface: 'actions' }) }
      : event.registration_url
        ? { href: withUtm(event.registration_url), label: registerLabel, internal: false, track: () => trackOutbound('register') }
        : event.event_url
          ? { href: withUtm(event.event_url), label: 'Event info', internal: false, track: () => trackOutbound('info') }
          : null

  const markers = [
    ...(timeStr ? [{ value: timeStr, label: 'Starts' }] : []),
    ...(length ? [{ value: length.replace(/ ride$/, '').replace(/ to /, '–'), label: 'Ride length' }] : []),
    ...(level ? [{ value: RIDE_STYLE_LABEL[level], label: noDrop ? 'Level, no-drop' : 'Level' }] : []),
  ]

  const sameAsName = !!event.location_address && !!event.location_name && event.location_address.trim().toLowerCase() === event.location_name.trim().toLowerCase()
  const address = sameAsName ? null : event.location_address
  const hasPlace = !!event.location_name && event.location_name !== 'See event page for details'

  return (
    <div className="mx-auto max-w-[1080px] px-4 pb-16 pt-6 sm:px-6 md:pt-10">
      <Link href="/events" className="sg-link text-[16px]">&larr; All events</Link>

      {event.schedule_status && (
        <Plaque className="mt-5 border-[#B42318]">
          <p className="font-[family-name:var(--font-overpass)] text-[20px] font-extrabold">
            {event.schedule_status === 'cancelled' ? 'Cancelled by the organizer' : event.schedule_status === 'postponed' ? 'Postponed' : 'New date or time'}
          </p>
          {event.schedule_note && <p className="mt-1 text-[16px]">From the organizer: &ldquo;{event.schedule_note}&rdquo;</p>}
        </Plaque>
      )}

      {isPast && (
        <Plaque className="mt-5">
          <p className="font-[family-name:var(--font-overpass)] text-[20px] font-extrabold">This one has passed</p>
          {nextUp ? (
            <Link href={`/preview/signs${eventPath(nextUp)}`} className="sg-link mt-1 inline-block text-[17px]">
              Next {nextUp.kind === 'series' ? 'one' : 'event'}: {dateLong(parseEventDate(nextUp.event_date))}
              {nextUp.event_time ? ` at ${formatTime(nextUp.event_time)}` : ''} &rarr;
            </Link>
          ) : (
            <Link href="/events" className="sg-link mt-1 inline-block text-[17px]">What&rsquo;s on this week &rarr;</Link>
          )}
        </Plaque>
      )}

      <div className="mt-5 grid gap-8 md:grid-cols-[1fr_400px] md:gap-x-12">
        <div className="min-w-0 md:col-start-1 md:row-start-1">
          {/* The title on a sign: the date line, then the event's name. */}
          <header className="sg-guide">
            <div className="sg-guide-inner px-5 pb-6 pt-4 md:px-7 md:pb-8 md:pt-6">
              <p className="font-[family-name:var(--font-overpass)] text-[18px] font-bold md:text-[20px]">{dayLine}</p>
              <h1 className="mt-2 font-[family-name:var(--font-overpass)] text-[clamp(30px,7vw,48px)] font-extrabold leading-[1.06] tracking-[-0.01em] text-white">
                {event.title}
              </h1>
              <p className="mt-3 text-[17px] text-white">
                {meta.label}
              </p>
            </div>
          </header>

          {markers.length > 0 && <MileMarkers items={markers} className="sg-markers-row mt-6" />}

          {hasPlace && (
            <Plaque className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-overpass)] text-[20px] font-extrabold leading-tight">
                  {deadline ? event.location_name : `Meet at ${event.location_name}`}
                </p>
                {address && <p className="mt-1 text-[16px] text-[var(--sg-ink-soft)]">{address}</p>}
              </div>
              {!deadline && (
                <a
                  href={directionsUrl(event)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sg-btn sg-btn-quiet"
                  onClick={() => trackDirections('details')}
                >
                  Directions
                </a>
              )}
            </Plaque>
          )}

          {/* What you can do here. */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            {primary &&
              (primary.internal ? (
                <Link href={primary.href} className="sg-btn sg-btn-primary col-span-2 sm:min-w-[160px]" onClick={primary.track}>
                  {primary.label}
                </Link>
              ) : (
                <a href={primary.href} target="_blank" rel="noopener noreferrer" className="sg-btn sg-btn-primary col-span-2 sm:min-w-[160px]" onClick={primary.track}>
                  {primary.label}
                </a>
              ))}
            <div className="relative">
              <button type="button" className="sg-btn sg-btn-quiet w-full" onClick={() => setCalOpen(!calOpen)} aria-expanded={calOpen}>
                Add to calendar
              </button>
              {calOpen && (
                <div className="absolute left-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-[10px] border-2 border-[var(--sg-ink)] bg-white py-1">
                  <a
                    href={gcalUrl(event)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-3 text-[16px] hover:bg-[var(--sg-ground)]"
                    onClick={() => { trackCalendar('google'); setCalOpen(false) }}
                  >
                    Google Calendar
                  </a>
                  <button type="button" onClick={downloadIcs} className="block w-full px-4 py-3 text-left text-[16px] hover:bg-[var(--sg-ground)]">
                    Apple or Outlook (.ics)
                  </button>
                </div>
              )}
            </div>
            <button type="button" className="sg-btn sg-btn-quiet" onClick={share}>
              Share
            </button>
          </div>

        </div>

        {/* Getting there: after the actions on phones, beside everything on wide screens. */}
        {!deadline && (
          <aside className="md:col-start-2 md:row-span-2 md:row-start-1">
            <div className="md:sticky md:top-24">
              <GettingThere event={event} isToday={isToday} town={town} onDirections={trackDirections} onTown={() => posthog.capture('event_town_click', eventProps({ town: town?.name }))} />
            </div>
          </aside>
        )}

        <div className="min-w-0 md:col-start-1 md:row-start-2">
          {event.body && (
            <div className="max-w-[640px] space-y-1 text-[17px] leading-[1.6]">
              {parseEventBody(event.body).map((line, i) =>
                line.kind === 'blank' ? (
                  <div key={i} className="h-3" aria-hidden />
                ) : line.kind === 'heading' ? (
                  <p key={i} className="pt-2 font-[family-name:var(--font-overpass)] text-[19px] font-extrabold">{line.text}</p>
                ) : (
                  <p key={i} className={line.kind === 'bullet' ? 'pl-5 -indent-5' : undefined}>
                    {line.kind === 'bullet' && '•  '}
                    {line.parts.map((part, j) => (part.bold ? <strong key={j}>{part.text}</strong> : part.text))}
                  </p>
                ),
              )}
            </div>
          )}

          {roamLinks.length > 0 && (
            <div className="mt-8 space-y-3">
              {roamLinks.map((r) => (
                <Link key={r.id} href={`/shift/roams/${encodeURIComponent(r.id)}`} className="sg-plaque block hover:bg-[var(--sg-ground)]">
                  <span className="block text-[17px] font-bold">Part of this ride uses the {r.name}</span>
                  <span className="mt-1 block text-[15px] text-[var(--sg-ink-soft)]">{r.reward_note ?? 'See the roam'} &rarr;</span>
                </Link>
              ))}
            </div>
          )}

          {(event.organizer_name || (event.sponsors && event.sponsors.length > 0) || (event.route_links ?? []).length > 0) && (
            <div className="mt-8 space-y-3 border-t-2 border-[var(--sg-ink)] pt-6 text-[17px]">
              {event.organizer_name && (
                <p>
                  Hosted by{' '}
                  {event.organizer_url ? (
                    <a href={withUtm(event.organizer_url)} target="_blank" rel="noopener noreferrer" className="sg-link">{event.organizer_name}</a>
                  ) : (
                    <strong>{event.organizer_name}</strong>
                  )}
                  {hostHref && (
                    <>
                      {' · '}
                      <Link href={hostHref} className="sg-link">All their rides and walks</Link>
                    </>
                  )}
                </p>
              )}
              {event.sponsors && event.sponsors.length > 0 && (
                <p>
                  {event.organizer_name ? 'With ' : 'Presented by '}
                  {event.sponsors.map((name, i) => (
                    <span key={name}>
                      {i > 0 && ', '}
                      {sponsorLinks[name] ? (
                        <a href={withUtm(sponsorLinks[name])} target="_blank" rel="noopener noreferrer" className="sg-link">{name}</a>
                      ) : (
                        name
                      )}
                    </span>
                  ))}
                </p>
              )}
              {(event.route_links ?? []).map((r) => (
                <p key={r.url}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="sg-link" onClick={() => trackOutbound('route')}>
                    {r.label} on {r.provider} &rarr;
                  </a>
                </p>
              ))}
            </div>
          )}

          <EventPageAlertSignup event={event} className="mt-8 max-w-[480px]" />

          <div className="mt-8 border-t border-[var(--sg-line)] pt-5 text-[16px]">
            {event.ride_series_id && !event.source_id ? (
              <p>
                Your ride?{' '}
                <Link href={`/organizers/rides/${event.ride_series_id}`} className="sg-link">Change it in organizer tools</Link>
              </p>
            ) : (
              <FixListingLink event={{ id: event.id, title: event.title }} />
            )}
          </div>
        </div>

      </div>

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[10px] bg-[var(--sg-ink)] px-5 py-3 text-[16px] text-white">
          {toast}
        </div>
      )}
    </div>
  )
}
