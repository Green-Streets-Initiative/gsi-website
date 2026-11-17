'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { eventPath, eventUrl } from '@/lib/events-url'
import {
  MapPin, Calendar, Users,
  ChevronLeft, ChevronRight, Share2, Globe, ExternalLink, Ticket,
  ArrowRight, Route, Languages, Footprints, Bike, Bus,
} from 'lucide-react'
import { eventLanguages, ownNames } from '@/lib/languages'
import dynamic from 'next/dynamic'
import posthog from 'posthog-js'
import FixListingLink from '@/components/hosts/FixListingLink'
import { gaEvent } from '@/lib/ga'
import StoreButtons from '@/components/StoreButtons'
import { withUtm as appUtm } from '@/lib/utm'
import { DateTile, PlaceSign, GettingThere, MoreNearHere } from './EventPageParts'
import {
  type CommunityEvent, type NextUp,
  getTagMeta, isDeadline, parseEventDate,
  buildIcs, gcalUrl, directionsUrl,
  eventRideStyle, isNoDrop, isRideEvent,
  eventImages,
} from '@/lib/events'
import { withLang, type SiteLocale } from '@/lib/site-i18n'
import {
  eventsT, typeLabel, tagLabel, rideLevelLabel, rideLevelBlurb, paceLabel,
  timeL, dateLongL, dateMediumL, dateRangeLongL, calendarNotesL, ledInLineL,
} from '@/lib/events-i18n'
import EventImageCarousel from './EventImageCarousel'
import { FeedsToLine, GoTogetherSection } from './GoTogether'
import { NO_GO_TOGETHER, isWalkGroup, type GoTogetherData } from '@/lib/go-together'
import { EventPageAlertSignup } from './EventAlertSignup'
import EventFeedSubscribe from './EventFeedSubscribe'
import { parseEventBody } from '@/lib/event-body'
import { tagInk, rideStyleInk } from '@/lib/events-tone'
import { EventsToneProvider, toneClass, useEventsTone, useEventsI18n, type EventsTone } from './EventsTone'
import './events-tone.css'

const EventMap = dynamic(() => import('./EventMap'), { ssr: false })

const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''
const STORE_LIVE = !!(IOS_URL && ANDROID_URL)
const withAppUtm = (url: string) =>
  appUtm(url, { source: 'web_events', medium: 'event_page', campaign: 'community_events' }) ?? url

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

/**
 * Most search traffic to these pages lands on an event that has already
 * happened — the older a page is, the better it ranks, so the finished ones
 * out-pull the upcoming ones. Rather than leave that visitor at a dead date,
 * carry them to the next occurrence of the same ride, or failing that to the
 * organizer's next event.
 */
/** The organizer cancelled, postponed or moved this one (Shift 01013). */
function ScheduleBanner({ event }: { event: CommunityEvent }) {
  const { locale, t } = useEventsI18n()
  const status = event.schedule_status
  if (!status) return null
  let headline: string
  if (status === 'cancelled') headline = t('detail.cancelled')
  else if (status === 'postponed') headline = t('detail.postponed')
  else if (event.previous_event_date && event.previous_event_date !== event.event_date) {
    headline = t('detail.moved_from', { date: dateLongL(parseEventDate(event.previous_event_date), locale) })
  } else if (event.previous_event_time) headline = t('detail.new_time_was', { time: timeL(event.previous_event_time, locale) })
  else headline = t('detail.new_time')
  const note = event.schedule_note?.trim()

  return (
    <div className="mb-6 rounded-2xl border border-(--ev-accent-line-30) bg-(--ev-accent-tint-7) p-4 sm:mb-8 sm:p-5">
      <p className="font-(family-name:--font-headline) text-[19px] font-extrabold leading-tight text-(--ev-ink) sm:text-[22px]">{headline}</p>
      {note && <p className="mt-1 text-[15px] text-(--ev-ink-75)">{t('detail.organizer_said', { note })}</p>}
    </div>
  )
}

function NextUpBanner({ nextUp, host = null }: { nextUp: NextUp | null; host?: { href: string; name: string } | null }) {
  const { hrefBase } = useEventsTone()
  const { locale, t } = useEventsI18n()
  const nextDate = nextUp ? dateLongL(parseEventDate(nextUp.event_date), locale) : null
  const label = nextUp && nextDate
    ? nextUp.event_time ? t('next.date_at', { date: nextDate, time: timeL(nextUp.event_time, locale) }) : nextDate
    : null

  return (
    <div className="mb-6 rounded-2xl border border-(--ev-accent-line-30) bg-(--ev-accent-tint-7) p-4 sm:mb-8 sm:p-5">
      <p className="text-[15px] font-bold text-(--ev-accent)">
        {t('next.passed')}
      </p>

      {nextUp && label ? (
        <>
          <Link
            href={withLang(eventPath(nextUp, hrefBase), locale)}
            className="mt-1.5 inline-flex items-center gap-1.5 font-(family-name:--font-headline) text-[19px] font-extrabold leading-tight text-(--ev-ink) transition-opacity hover:opacity-80 sm:text-[22px]"
          >
            {t(nextUp.kind === 'series' ? 'next.one' : 'next.event', { when: label })}
            <ArrowRight size={18} className="shrink-0" />
          </Link>
          <p className="mt-1 text-[15px] text-(--ev-ink-75)">
            {nextUp.kind === 'series'
              ? <>{nextUp.location_name ? t('next.again_at', { place: nextUp.location_name }) : t('next.again')}</>
              : <>{nextUp.title}{nextUp.location_name ? ` · ${nextUp.location_name}` : ''}</>}
          </p>
        </>
      ) : (
        <>
          <p className="mt-1.5 font-(family-name:--font-headline) text-[19px] font-extrabold leading-tight text-(--ev-ink) sm:text-[22px]">
            {t('next.none')}
          </p>
          <Link
            href={withLang(hrefBase, locale)}
            className="mt-1 inline-flex items-center gap-1.5 text-[15px] font-semibold text-(--ev-accent) transition-opacity hover:opacity-80"
          >
            {t('next.see_week')}
            <ArrowRight size={14} className="shrink-0" />
          </Link>
        </>
      )}
      {/* The host's page, where everything they have coming up is listed. */}
      {host && (
        <Link
          href={host.href}
          onClick={() => posthog.capture('event_host_page_click', { from: 'past_banner' })}
          className="mt-3 flex min-h-[44px] items-center gap-1.5 border-t border-(--ev-accent-line-30) pt-3 text-[15px] font-semibold text-(--ev-accent) transition-opacity hover:opacity-80"
        >
          {t('next.host_all', { host: host.name })}
          <ArrowRight size={16} className="shrink-0" />
        </Link>
      )}
    </div>
  )
}

interface EventDetailProps {
  event: CommunityEvent
  /** The next occurrence or the organizer's next event; null when neither exists. */
  nextUp?: NextUp | null
  /** Resolved server-side against Boston time, not the visitor's clock. */
  isPast?: boolean
  /** `light` is the cream site; `dark` (default) is the app-dark original. */
  tone?: EventsTone
  /** Where the back link and next-occurrence links point. */
  hrefBase?: string
  /** Sponsor name → website, from the organizer directory (see loadEvent). */
  sponsorLinks?: Record<string, string>
  /** Roams whose route this event travels (Shift roam_events), public roams only. */
  roamLinks?: Array<{ id: string; name: string; reward_note: string | null }>
  /** Invite code of the Shift ride this listing comes from; its page takes RSVPs. */
  rideCode?: string | null
  /** The host's page on this site, when they run often enough to have one. */
  hostHref?: string | null
  /** The town page for the event's address, when that town has one. */
  town?: { name: string; href: string } | null
  /** Groups going to this event, and where this one goes (Go Together, Shift 01460). */
  goTogether?: GoTogetherData
  /**
   * A repeating event's other dates still ahead, and its lasting page
   * (/events/series/...). `href` is left out on the series page itself.
   */
  series?: { href?: string; dates: Pick<CommunityEvent, 'id' | 'slug' | 'event_date'>[] } | null
  /** The page's language (translation plan, batch 5). English when left out. */
  locale?: SiteLocale
  /** It happens today (Boston time): live departures and free bikes show. */
  isToday?: boolean
  /** Other events close by on the same few days ("More near here"). */
  moreNear?: CommunityEvent[]
}


const DIRECTION_MODES = [
  { mode: 'walking', key: 'detail.dir_walk', Icon: Footprints },
  { mode: 'bicycling', key: 'detail.dir_bike', Icon: Bike },
  { mode: 'transit', key: 'detail.dir_transit', Icon: Bus },
] as const

export default function EventDetail({ event, nextUp = null, isPast = false, tone = 'dark', hrefBase = '/events', sponsorLinks = {}, roamLinks = [], rideCode = null, hostHref = null, town = null, goTogether = NO_GO_TOGETHER, series = null, locale = 'en', isToday = false, moreNear = [] }: EventDetailProps) {
  const t = eventsT(locale)
  // Easy / Moderate / Rec, only when the listing supports the call.
  const level = eventRideStyle(event)
  const noDrop = isNoDrop(event)
  // Pace, distance, and drop policy: shown only where the listing states them.
  const rideFacts: string[] = []
  if (isRideEvent(event.event_type)) {
    const pace = paceLabel(event.pace, locale)
    if (pace) rideFacts.push(pace)
    if (event.distance_text) rideFacts.push(event.distance_text)
  }
  // The language it's led in (Shift 01697), and each in its own words.
  const ledIn = ledInLineL(event.languages, event.event_type, locale)
  const ownLangs = eventLanguages(event.languages).filter((c) => c !== 'en')
  // The line says it, so the Spanish / Bilingual chips would only repeat it.
  const chipTags = ledIn ? event.tags.filter((t) => t !== 'spanish' && t !== 'bilingual') : event.tags
  // "November 1 to 30, 2026" for a multi-day event (Shift 01557).
  const dateText = dateRangeLongL(event, locale)
  // Deadline-style events (contests) are places to enter, not places to go —
  // no map, no directions.
  // Statewide days (Walk/Ride Day) carry a nominal Boston Common pin so radius
  // filters reach everyone; a map and directions to it would be nonsense. Same
  // rule as the app's event screen (community-event.tsx `placeless`).
  const placeless = !event.location_address && Number(event.target_radius_miles) >= 100
  const deadline = isDeadline(event.event_type)
  // A private home is listed as "A home in <town>" with its pin rounded to
  // about 1 km (Shift 01813): no map, directions or nearest stops, which
  // would point at a spot that isn't the door. The host shares the address.
  const privateHome = /^a home in /i.test(event.location_name ?? '')
  const hasMap = !!(event.location_lat && event.location_lng) && !deadline && !placeless && !privateHome
  const images = eventImages(event)

  const [calMenuOpen, setCalMenuOpen] = useState(false)
  const [barMenuOpen, setBarMenuOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, url })
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url)
      showToast(t('detail.link_copied'))
    }
  }

  // The three things a visitor can do here that mean "I intend to go": leave
  // for the organizer's registration or event page, save the date, or get
  // directions. Each fires a GA4 event (Google Ads imports GA4 key events as
  // conversions; the Ad Grant needs at least one a month) and a PostHog copy.
  const eventProps = (extra: Record<string, unknown>) => ({
    event_id: event.id, event_type: event.event_type, is_past: isPast, ...extra,
  })
  const trackCalendar = (method: 'google' | 'ics', surface: 'details' | 'phone_bar') => {
    const props = eventProps({ method, surface })
    gaEvent('event_calendar_save', props)
    posthog.capture('event_calendar_save', props)
  }
  const trackDirections = (surface: 'map_card' | 'details' | 'phone_bar', mode?: string) => {
    const props = eventProps(mode ? { surface, mode } : { surface })
    gaEvent('event_directions_click', props)
    posthog.capture('event_directions_click', props)
  }

  // The calendar entry's own labels in the page's language; the event's words stay as listed.
  const notes = calendarNotesL(event, `${eventUrl(event)}?lang=${encodeURIComponent(locale)}`, locale)
  const calEvent = notes ? { ...event, notes } : event

  const handleDownloadIcs = (surface: 'details' | 'phone_bar') => {
    trackCalendar('ics', surface)
    const ics = buildIcs(calEvent)
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.title.replace(/[^a-zA-Z0-9-_ ]/g, '').trim()}.ics`
    a.click()
    URL.revokeObjectURL(url)
    setCalMenuOpen(false)
    showToast(t('detail.ics_done'))
  }

  // Register / Event info clicks leave the site, so without this an event page
  // had no measurable outcome at all. `event_outbound_click` counts as an
  // activation in scripts/seo/pull-posthog.mjs.
  // A sold-out listing stays up because organizers' pages take a notify-me
  // list and spots reopen; the button says what the click will get.
  const registerLabel = event.tags.includes('sold_out') ? t('detail.waitlist') : t('detail.register')
  const trackOutbound = (kind: 'register' | 'info' | 'route', surface: 'details' | 'phone_bar') => {
    const props = eventProps({ kind, surface })
    posthog.capture('event_outbound_click', props)
    gaEvent(kind === 'register' ? 'event_register_click' : kind === 'route' ? 'event_route_click' : 'event_info_click', props)
  }

  const timeStr = event.event_time ? timeL(event.event_time, locale) : null
  const endTimeStr = event.event_end_time ? timeL(event.event_end_time, locale) : null
  const whenText = `${dateText}${timeStr ? ` · ${timeStr}` : ''}${!deadline && endTimeStr ? ` – ${endTimeStr}` : ''}`
  const eventLink = (href: string) => withLang(href, locale)
  // Some listings carry the street address as the place name too; print it once.
  const sameAsName = (a: string | null) =>
    !!a && !!event.location_name && a.trim().toLowerCase() === event.location_name.trim().toLowerCase()
  // "Union Square" over "Union Square, Somerville, MA" reads twice; keep the rest.
  const restOfAddress = (a: string | null) => {
    const name = event.location_name?.trim().toLowerCase()
    if (!a || !name) return a
    return a.trim().toLowerCase().startsWith(`${name},`) ? a.trim().slice(name.length + 1).trim() : a
  }
  const address = sameAsName(event.location_address) ? null : restOfAddress(event.location_address)
  const location = [event.location_name, address].filter(Boolean).join(', ')

  const showPlace = !!event.location_name && event.location_name !== 'See event page for details'
  const hostLine = event.organizer_name
    ? t('detail.host_line', { type: typeLabel(event.event_type, locale), host: event.organizer_name })
    : typeLabel(event.event_type, locale)

  // The phone bar repeats the first-screen buttons, so it shows only once
  // they have scrolled away.
  const actionsRef = useRef<HTMLDivElement>(null)
  const [actionsInView, setActionsInView] = useState(true)
  useEffect(() => {
    const el = actionsRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setActionsInView(entry.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const H2 = 'font-(family-name:--font-headline) text-[22px] font-extrabold leading-tight text-(--ev-ink)'
  const PRIMARY = 'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[10px] bg-(--ev-primary) px-4 text-[16px] font-bold text-white transition-opacity hover:opacity-90'
  const SECONDARY = 'inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-(--ev-ink) px-4 text-[16px] font-bold text-(--ev-ink) transition-colors hover:bg-(--ev-panel)'

  /** The one thing to do here: answer the Shift ride, sign up, read the host's page, or get directions. */
  const primaryAction = (surface: 'details' | 'phone_bar', cls: string) => {
    if (rideCode && !isPast) {
      return (
        <Link
          href={eventLink(`/rides/${rideCode}?date=${event.event_date}`)}
          className={cls}
          onClick={() => posthog.capture('ride_page_open', { from: 'event_detail', surface: surface === 'details' ? 'actions' : 'phone_bar' })}
        >
          <Users size={17} aria-hidden />
          {t('detail.rsvp')}
        </Link>
      )
    }
    if (event.registration_url) {
      return (
        <a href={withUtm(event.registration_url)} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => trackOutbound('register', surface)}>
          <Ticket size={17} aria-hidden />
          {registerLabel}
        </a>
      )
    }
    if (event.event_url) {
      return (
        <a href={withUtm(event.event_url)} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => trackOutbound('info', surface)}>
          <Globe size={17} aria-hidden />
          {t('detail.event_info')}
        </a>
      )
    }
    if (hasMap) {
      return (
        <a href={directionsUrl(event)} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => trackDirections(surface)}>
          <MapPin size={17} aria-hidden />
          {t('detail.directions')}
        </a>
      )
    }
    return null
  }
  // "Event info" is a second link only when it isn't already the main button.
  const infoIsPrimary = !(rideCode && !isPast) && !event.registration_url && !!event.event_url

  const calendarMenu = (surface: 'details' | 'phone_bar', close: () => void, placement: string) => (
    <div className={`absolute ${placement} z-50 w-60 overflow-hidden rounded-xl border border-(--ev-line-mid) bg-(--ev-menu-raised) py-1 shadow-(--ev-shadow-deep)`} role="menu">
      <a
        href={gcalUrl(calEvent)}
        target="_blank"
        rel="noopener noreferrer"
        role="menuitem"
        className="flex min-h-[44px] items-center gap-2 px-4 text-[15px] text-(--ev-ink-80) transition-colors hover:bg-(--ev-panel)"
        onClick={() => { trackCalendar('google', surface); close() }}
      >
        <Globe size={15} aria-hidden />
        Google Calendar
      </a>
      <button
        type="button"
        role="menuitem"
        onClick={() => { handleDownloadIcs(surface); close() }}
        className="flex min-h-[44px] w-full items-center gap-2 px-4 text-left text-[15px] text-(--ev-ink-80) transition-colors hover:bg-(--ev-panel)"
      >
        <Calendar size={15} aria-hidden />
        Apple Calendar (.ics)
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => { handleDownloadIcs(surface); close() }}
        className="flex min-h-[44px] w-full items-center gap-2 px-4 text-left text-[15px] text-(--ev-ink-80) transition-colors hover:bg-(--ev-panel)"
      >
        <ExternalLink size={15} aria-hidden />
        {t('detail.download_ics')}
      </button>
    </div>
  )

  return (
    <EventsToneProvider tone={tone} hrefBase={hrefBase} locale={locale}>
    <div className={`event-page min-h-screen bg-(--ev-card) px-4 pb-32 pt-4 font-(family-name:--font-gsi) sm:px-8 sm:pt-6 lg:pb-24 ${toneClass(tone)}`}>
      <div className="mx-auto max-w-[1120px]">
        <Link href={eventLink(hrefBase)} className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-[15px] font-bold text-(--ev-accent) transition-opacity hover:opacity-80">
          <ChevronLeft size={18} aria-hidden />
          {t('detail.all_events')}
        </Link>

        <ScheduleBanner event={event} />
        {isPast && <NextUpBanner nextUp={nextUp} host={hostHref && event.organizer_name ? { href: hostHref, name: event.organizer_name } : null} />}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
          {/* ---- What, when, where, and the button: the first phone screen ---- */}
          <div>
            <div className={images.length > 0 ? 'grid grid-cols-[88px_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[150px_minmax(0,1fr)] lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-6' : ''}>
              {images.length > 0 && (
                <a href="#flyer" className="block aspect-[3/4] overflow-hidden rounded-[12px] border border-(--ev-line) bg-(--ev-panel)" aria-label={t('img.alt', { title: event.title, n: 1 })}>
                  <img src={images[0]} alt="" className="h-full w-full object-cover" />
                </a>
              )}
              <div className="min-w-0">
                <h1 className="font-(family-name:--font-headline) text-[26px] font-extrabold leading-[1.1] tracking-[-0.01em] text-(--ev-ink) sm:text-[34px] lg:text-[40px]">
                  {event.title}
                </h1>
                <p className="mt-1.5 text-[15px] text-(--ev-ink-75)">{hostLine}</p>

                {(level || noDrop || rideFacts.length > 0 || chipTags.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {level && (
                      <span className="inline-block rounded-full bg-(--ev-panel) px-3 py-1 text-[14px] font-bold" style={{ color: rideStyleInk(level, tone) }} title={rideLevelBlurb(level, locale)}>
                        {rideLevelLabel(level, locale)}
                      </span>
                    )}
                    {noDrop && (
                      <span className="inline-block rounded-full bg-(--ev-accent-tint-15) px-3 py-1 text-[14px] font-bold text-(--ev-accent)" title={t('detail.no_drop_title')}>
                        {t('card.no_drop')}
                      </span>
                    )}
                    {rideFacts.map((f) => (
                      <span key={f} className="inline-block rounded-full bg-(--ev-panel) px-3 py-1 text-[14px] font-bold text-(--ev-ink-80)">{f}</span>
                    ))}
                    {chipTags.map((tag) => {
                      const tm = tagInk(getTagMeta(tag), tone)
                      return (
                        <span key={tag} className="inline-block rounded-full px-3 py-1 text-[14px] font-bold" style={{ color: tm.color, backgroundColor: tm.bg }}>
                          {tagLabel(tag, locale)}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* A group going to a bigger event says where (Go Together). */}
            {goTogether.feeds && (
              <div className="mt-4">
                <FeedsToLine target={goTogether.feeds} walk={isWalkGroup(event.event_type)} fromId={event.id} />
              </div>
            )}

            {/* When and where, each with its own picture: a date tile and a place sign. */}
            <div className="mt-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <DateTile date={event.event_date} locale={locale} />
                <div className="min-w-0">
                  <p className="text-[17px] font-bold leading-snug text-(--ev-ink)">
                    {deadline ? t('card.entry_deadline', { when: dateText }) : dateText}
                  </p>
                  {timeStr && (
                    <p className="text-[15px] text-(--ev-ink-75)">
                      {timeStr}{!deadline && endTimeStr ? ` – ${endTimeStr}` : ''}
                    </p>
                  )}
                </div>
              </div>
              {showPlace && (
                <div className="flex items-center gap-3">
                  <PlaceSign locationName={event.location_name} />
                  <div className="min-w-0">
                    <p className="text-[17px] font-bold leading-snug text-(--ev-ink)">{event.location_name}</p>
                    {privateHome
                      ? <p className="text-[15px] text-(--ev-ink-75)">{t('detail.home_note')}</p>
                      : address && <p className="text-[15px] text-(--ev-ink-75)">{address}</p>}
                  </div>
                </div>
              )}
            </div>

            {/* What language it's led in (Shift 01697). */}
            {ledIn && (
              <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold text-(--ev-ink)">
                <Languages size={18} className="shrink-0 text-(--ev-accent)" aria-hidden />
                {ledIn}
                {ownLangs.length > 0 && (
                  <span lang={ownLangs[0]} className="font-normal text-(--ev-ink-75)">· {ownNames(ownLangs)}</span>
                )}
              </p>
            )}

            {/* The buttons, on the first phone screen. */}
            <div ref={actionsRef} className="mt-5 flex items-stretch gap-2">
              {primaryAction('details', `${PRIMARY} flex-[1.4]`)}
              <div className="relative flex-1">
                <button type="button" onClick={() => setCalMenuOpen(!calMenuOpen)} className={SECONDARY} aria-haspopup="menu" aria-expanded={calMenuOpen}>
                  <Calendar size={17} aria-hidden />
                  <span className="xl:hidden">{t('detail.save')}</span>
                  <span className="hidden xl:inline">{t('detail.save_calendar')}</span>
                </button>
                {calMenuOpen && calendarMenu('details', () => setCalMenuOpen(false), 'right-0 top-full mt-2')}
              </div>
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex min-h-[48px] w-12 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-(--ev-line-strong) text-(--ev-ink-80) transition-colors hover:bg-(--ev-panel)"
                aria-label={t('detail.share')}
              >
                <Share2 size={18} />
              </button>
            </div>

            {/* The groups going here together, as in the app. */}
            {!isPast && (
              <div className="mt-6">
                <GoTogetherSection eventId={event.id} groups={goTogether.groups} />
              </div>
            )}

            {/* Where you meet: the map, then directions in each way to get there. */}
            {hasMap && (
              <section aria-labelledby="where-meet" className="mt-8 border-t border-(--ev-line) pt-6">
                <h2 id="where-meet" className={H2}>{t('detail.where_meet')}</h2>
                <div className="mt-3 overflow-hidden rounded-2xl border border-(--ev-line)">
                  <div className="h-60 lg:h-80">
                    <EventMap lat={event.location_lat!} lng={event.location_lng!} label={event.location_name} />
                  </div>
                  <div className="p-4">
                    <p className="text-[15px] font-bold text-(--ev-ink)">{location}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {DIRECTION_MODES.map(({ mode, key, Icon }) => (
                        <a
                          key={mode}
                          href={directionsUrl(event, mode)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-(--ev-line-mid) px-4 text-[15px] font-semibold text-(--ev-ink) transition-colors hover:bg-(--ev-panel)"
                          onClick={() => trackDirections('map_card', mode)}
                        >
                          <Icon size={16} aria-hidden />
                          {t(key)}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* ---- Getting there, the host's words, and what's next ---- */}
          <div className="flex flex-col gap-8">
            {hasMap && (
              <section aria-labelledby="getting-there" className="border-t border-(--ev-line) pt-6 lg:border-t-0 lg:pt-0">
                <h2 id="getting-there" className={H2}>{t('detail.getting_there')}</h2>
                <div className="mt-3">
                  <GettingThere
                    event={event}
                    isToday={isToday}
                    t={t}
                    onDirections={(surface, mode) => {
                      const props = eventProps({ surface, mode })
                      gaEvent('event_directions_click', props)
                      posthog.capture('event_directions_click', props)
                    }}
                  />
                </div>
                {!deadline && town && (
                  <Link
                    href={eventLink(town.href)}
                    className="mt-3 flex min-h-[44px] items-center gap-1 text-[15px] font-bold text-(--ev-accent) hover:underline"
                    onClick={() => posthog.capture('event_town_click', eventProps({ town: town.name }))}
                  >
                    {t('detail.town_link', { town: town.name })}
                    <ChevronRight size={16} aria-hidden />
                  </Link>
                )}
              </section>
            )}

            {/* The host's own words, then who they are. */}
            {(event.body || event.organizer_name || (event.sponsors?.length ?? 0) > 0) && (
              <section aria-labelledby="host-says" className="border-t border-(--ev-line) pt-6">
                <h2 id="host-says" className={H2}>{event.organizer_name ? t('detail.host_says') : t('detail.about')}</h2>
                {event.body && (
                  <div className="mt-3 text-[16px] leading-relaxed text-(--ev-ink-80) [overflow-wrap:anywhere]">
                    {parseEventBody(event.body).map((line, i) =>
                      line.kind === 'blank' ? (
                        <div key={i} className="h-3" aria-hidden />
                      ) : line.kind === 'heading' ? (
                        <p key={i} className="font-bold text-(--ev-ink)">{line.text}</p>
                      ) : (
                        <p key={i} className={line.kind === 'bullet' ? 'pl-4 -indent-4' : undefined}>
                          {line.kind === 'bullet' && '•  '}
                          {line.parts.map((part, j) =>
                            part.bold ? <strong key={j} className="font-bold text-(--ev-ink)">{part.text}</strong> : part.text,
                          )}
                        </p>
                      ),
                    )}
                  </div>
                )}

                {event.organizer_name && (
                  <div className="mt-4 flex items-center gap-3 rounded-[12px] bg-(--ev-panel) p-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-(--ev-card) text-(--ev-accent)" aria-hidden>
                      <Users size={20} />
                    </span>
                    <div className="min-w-0">
                      {event.organizer_url ? (
                        <a href={withUtm(event.organizer_url)} target="_blank" rel="noopener noreferrer" className="text-[16px] font-bold text-(--ev-ink) hover:underline">
                          {event.organizer_name} <ExternalLink size={13} className="inline" aria-hidden />
                        </a>
                      ) : (
                        <p className="text-[16px] font-bold text-(--ev-ink)">{event.organizer_name}</p>
                      )}
                      {hostHref && (
                        <Link href={hostHref} className="block text-[15px] font-semibold text-(--ev-accent) hover:underline">
                          {t('detail.host_page')}
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {event.sponsors && event.sponsors.length > 0 && (
                  <p className="mt-3 text-[15px] text-(--ev-ink-80)">
                    {event.organizer_name ? t('detail.presented_with') : t('detail.presented_by')}{' '}
                    {event.sponsors.map((name, i) => {
                      const url = sponsorLinks[name]
                      return (
                        <span key={name}>
                          {i > 0 && ' · '}
                          {url ? (
                            <a href={withUtm(url)} target="_blank" rel="noopener noreferrer" className="font-semibold text-(--ev-accent) hover:underline">
                              {name}
                            </a>
                          ) : name}
                        </span>
                      )
                    })}
                  </p>
                )}

                {((event.event_url && !infoIsPrimary) || (event.route_links ?? []).length > 0) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {event.event_url && !infoIsPrimary && (
                      <a
                        href={withUtm(event.event_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-(--ev-line-strong) px-4 text-[15px] font-semibold text-(--ev-ink) transition-colors hover:bg-(--ev-panel)"
                        onClick={() => trackOutbound('info', 'details')}
                      >
                        <Globe size={16} aria-hidden />
                        {t('detail.event_info')}
                      </a>
                    )}
                    {/* The organizer's published route (Shift 01394): a link, the route stays on their service. */}
                    {(event.route_links ?? []).map((r) => (
                      <a
                        key={r.url}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-(--ev-line-strong) px-4 text-[15px] font-semibold text-(--ev-ink) transition-colors hover:bg-(--ev-panel)"
                        onClick={() => trackOutbound('route', 'details')}
                      >
                        <Route size={16} aria-hidden />
                        {t('detail.route_on', { label: locale !== 'en' && r.label === 'Route' ? t('detail.route') : r.label, provider: r.provider })}
                      </a>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* The whole flyer: the thumbnail at the top links here. */}
            {images.length > 0 && (
              <section id="flyer" className="scroll-mt-24">
                <EventImageCarousel images={images} title={event.title} />
              </section>
            )}

            {/* A repeating event's other dates, each a tap away. */}
            {series && (series.dates.length > 0 || series.href) && (
              <section aria-labelledby="more-dates-title">
                <h2 id="more-dates-title" className={H2}>{t('series.more_dates')}</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {series.dates.map((d) => (
                    <li key={d.id}>
                      <Link
                        href={withLang(eventPath(d, hrefBase), locale)}
                        onClick={() => posthog.capture('event_series_date_click', { event_id: event.id, to_event_id: d.id })}
                        className="inline-flex min-h-[44px] items-center rounded-[10px] border border-(--ev-line-strong) px-4 text-[15px] font-semibold text-(--ev-ink-80) transition-colors hover:bg-(--ev-panel)"
                      >
                        {dateMediumL(parseEventDate(d.event_date), locale)}
                      </Link>
                    </li>
                  ))}
                  {series.href && (
                    <li>
                      <Link
                        href={withLang(series.href, locale)}
                        onClick={() => posthog.capture('event_series_page_click', { event_id: event.id })}
                        className="inline-flex min-h-[44px] items-center gap-1 rounded-[10px] px-3 text-[15px] font-bold text-(--ev-accent) hover:underline"
                      >
                        {t('series.all_dates')}
                        <ChevronRight size={16} aria-hidden />
                      </Link>
                    </li>
                  )}
                </ul>
              </section>
            )}

            {/* Roams this ride or walk shares part of its route with. The
                organizer's route is their own, so never "follows". */}
            {roamLinks.length > 0 && (
              <div className="flex flex-col gap-2">
                {roamLinks.map((r) => (
                  <a
                    key={r.id}
                    href={eventLink(`/shift/roams/${encodeURIComponent(r.id)}`)}
                    className="flex min-h-[44px] flex-col justify-center rounded-[12px] border border-(--ev-line) px-4 py-3 text-[15px] font-semibold text-(--ev-ink-80) hover:border-(--ev-ink-40)"
                  >
                    <span>{t('detail.roam_part', { name: r.name })}</span>
                    <span className="mt-0.5 text-[14px] text-(--ev-ink-75)">{t('detail.roam_see')}</span>
                    {r.reward_note && <span className="mt-1 text-[14px] font-normal text-(--ev-ink-75)">{r.reward_note}</span>}
                  </a>
                ))}
              </div>
            )}

            {/* Other events close by on the same days. */}
            {!isPast && moreNear.length > 0 && (
              <section aria-labelledby="more-near">
                <h2 id="more-near" className={H2}>{t('detail.more_near')}</h2>
                <div className="mt-3">
                  <MoreNearHere events={moreNear} fromId={event.id} hrefBase={hrefBase} locale={locale} />
                </div>
              </section>
            )}

            <div className="flex flex-col gap-6">
              {/* Every event of this kind in this town, in the visitor's own
                  calendar (PLG L-24). Rides, walks and bike repair only. */}
              <EventFeedSubscribe event={event} />

              {/* The weekly email, set to this event's kind and town (calendar
                  growth plan bet 1). Past events too: a missed ride is the
                  best moment to offer the next one. */}
              <EventPageAlertSignup event={event} className="max-w-[440px]" />

              {/* An event with no town page keeps the app card (exp-2026-11-1);
                  one with a town page links there under Getting there. */}
              {!deadline && !town && STORE_LIVE && (
                <div className="rounded-[14px] border border-(--ev-line-strong) px-5 py-4">
                  <p className="text-[16px] font-bold text-(--ev-ink)">{t('detail.app_title')}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-(--ev-ink-80)">{t('detail.app_body')}</p>
                  <StoreButtons
                    iosUrl={withAppUtm(IOS_URL)}
                    androidUrl={withAppUtm(ANDROID_URL)}
                    placement="event_detail"
                    tone={tone === 'light' ? 'light' : 'dark'}
                    className="mt-3.5 [&>a]:max-[420px]:basis-full"
                  />
                </div>
              )}
              {!deadline && town && !hasMap && (
                <Link
                  href={eventLink(town.href)}
                  className="flex min-h-[44px] items-center gap-1 text-[15px] font-bold text-(--ev-accent) hover:underline"
                  onClick={() => posthog.capture('event_town_click', eventProps({ town: town.name }))}
                >
                  {t('detail.town_link', { town: town.name })}
                  <ChevronRight size={16} aria-hidden />
                </Link>
              )}
            </div>

            <div className="border-t border-(--ev-line) pt-5">
              {/* A ride planned in Shift is the organizer's own listing, not one built from public posts. */}
              {event.ride_series_id && !event.source_id ? (
                <p className="text-[15px] text-(--ev-ink-80)">
                  {t('detail.your_ride')}{' '}
                  <Link href={`/organizers/rides/${event.ride_series_id}`} className="font-semibold text-(--ev-accent) hover:underline">
                    {t('detail.change_ride')}
                  </Link>
                  {t('detail.sentence_end')}
                </p>
              ) : (
                <FixListingLink event={{ id: event.id, title: event.title }} locale={locale} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Phone bar: the same buttons, once the ones at the top have scrolled away. */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-(--ev-line-10) bg-(--ev-bar-deep) px-4 pt-3 backdrop-blur transition-transform duration-200 lg:hidden ${actionsInView ? 'pointer-events-none translate-y-full' : 'translate-y-0'}`}
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        aria-hidden={actionsInView}
      >
        {primaryAction('phone_bar', `${PRIMARY} flex-1 min-h-[44px] text-[15px]`)}
        <div className="relative">
          <button
            type="button"
            onClick={() => setBarMenuOpen(!barMenuOpen)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border-[1.5px] border-(--ev-ink) px-4 text-[15px] font-bold text-(--ev-ink)"
            aria-haspopup="menu"
            aria-expanded={barMenuOpen}
            tabIndex={actionsInView ? -1 : 0}
          >
            <Calendar size={16} aria-hidden />
            {t('detail.save')}
          </button>
          {barMenuOpen && calendarMenu('phone_bar', () => setBarMenuOpen(false), 'bottom-full right-0 mb-2')}
        </div>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-(--ev-line-strong) text-(--ev-ink-80)"
          aria-label={t('detail.share')}
          tabIndex={actionsInView ? -1 : 0}
        >
          <Share2 size={17} />
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-(--ev-line-mid) bg-(--ev-toast) px-5 py-3 text-[15px] font-medium text-(--ev-ink-on-toast) shadow-(--ev-shadow)"
          style={{ animation: 'animate-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        >
          {toast}
        </div>
      )}
    </div>
    </EventsToneProvider>
  )
}
