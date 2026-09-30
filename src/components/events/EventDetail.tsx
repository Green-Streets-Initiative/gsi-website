'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { eventPath } from '@/lib/events-url'
import {
  MapPin, Calendar, Users,
  ChevronLeft, Bookmark, Share2, Globe, ExternalLink, Ticket,
  Clock, Mail, ArrowRight,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import posthog from 'posthog-js'
import StoreButtons from '@/components/StoreButtons'
import { withUtm as appUtm } from '@/lib/utm'
import { EVENT_TYPE_ICONS } from './event-type-icons'
import {
  type CommunityEvent, type NextUp,
  getTypeMeta, getTagMeta, formatTime, dateLong, isDeadline, parseEventDate,
  buildIcs, gcalUrl, directionsUrl,
  eventRideStyle, isNoDrop, isRideEvent, PACE_BAND_LABEL, RIDE_STYLE_LABEL, RIDE_STYLE_BLURB,
} from '@/lib/events'
import { typeInk, tagInk, rideStyleInk, TINT } from '@/lib/events-tone'
import { EventsToneProvider, toneClass, useEventsTone, type EventsTone } from './EventsTone'
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
  const status = event.schedule_status
  if (!status) return null
  let headline: string
  if (status === 'cancelled') headline = 'Cancelled by the organizer'
  else if (status === 'postponed') headline = 'Postponed. No new date yet.'
  else if (event.previous_event_date && event.previous_event_date !== event.event_date) {
    headline = `Moved from ${dateLong(parseEventDate(event.previous_event_date))}`
  } else if (event.previous_event_time) headline = `New start time (was ${formatTime(event.previous_event_time)})`
  else headline = 'New start time'
  const note = event.schedule_note?.trim()

  return (
    <div className="mb-6 rounded-2xl border border-(--ev-accent-line-30) bg-(--ev-accent-tint-7) p-4 sm:mb-8 sm:p-5">
      <p className="font-display text-[19px] font-extrabold leading-tight text-(--ev-ink) sm:text-[22px]">{headline}</p>
      {note && <p className="mt-1 text-[13px] text-(--ev-ink-75)">From the organizer: &ldquo;{note}&rdquo;</p>}
    </div>
  )
}

function NextUpBanner({ nextUp }: { nextUp: NextUp | null }) {
  const { hrefBase } = useEventsTone()
  const label = nextUp
    ? `${dateLong(parseEventDate(nextUp.event_date))}${nextUp.event_time ? ` at ${formatTime(nextUp.event_time)}` : ''}`
    : null

  return (
    <div className="mb-6 rounded-2xl border border-(--ev-accent-line-30) bg-(--ev-accent-tint-7) p-4 sm:mb-8 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-(--ev-accent)">
        This one has passed
      </p>

      {nextUp && label ? (
        <>
          <Link
            href={eventPath(nextUp, hrefBase)}
            className="mt-1.5 inline-flex items-center gap-1.5 font-display text-[19px] font-extrabold leading-tight text-(--ev-ink) transition-opacity hover:opacity-80 sm:text-[22px]"
          >
            Next {nextUp.kind === 'series' ? 'one' : 'event'}: {label}
            <ArrowRight size={18} className="shrink-0" />
          </Link>
          <p className="mt-1 text-[13px] text-(--ev-ink-75)">
            {nextUp.kind === 'series'
              ? <>This one runs again{nextUp.location_name ? ` at ${nextUp.location_name}` : ''}.</>
              : <>{nextUp.title}{nextUp.location_name ? ` · ${nextUp.location_name}` : ''}</>}
          </p>
        </>
      ) : (
        <>
          <p className="mt-1.5 font-display text-[19px] font-extrabold leading-tight text-(--ev-ink) sm:text-[22px]">
            No repeat scheduled yet
          </p>
          <Link
            href={hrefBase}
            className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-(--ev-accent) transition-opacity hover:opacity-80"
          >
            See what&rsquo;s happening this week near you
            <ArrowRight size={14} className="shrink-0" />
          </Link>
        </>
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
}

export default function EventDetail({ event, nextUp = null, isPast = false, tone = 'dark', hrefBase = '/events', sponsorLinks = {} }: EventDetailProps) {
  const meta = getTypeMeta(event.event_type)
  const Icon = EVENT_TYPE_ICONS[meta.icon] ?? Calendar
  // The type's color for this surface: the navy-tuned one, or its ink on cream.
  const ink = typeInk(meta, tone)
  // Easy / Moderate / Rec, only when the listing supports the call.
  const level = eventRideStyle(event)
  const noDrop = isNoDrop(event)
  // Pace, distance, and drop policy: shown only where the listing states them.
  const rideFacts: string[] = []
  if (isRideEvent(event.event_type)) {
    if (event.pace && PACE_BAND_LABEL[event.pace]) rideFacts.push(PACE_BAND_LABEL[event.pace])
    if (event.distance_text) rideFacts.push(event.distance_text)
  }
  const evDate = parseEventDate(event.event_date)
  // Deadline-style events (contests) are places to enter, not places to go —
  // no map, no directions.
  const deadline = isDeadline(event.event_type)
  const hasMap = !!(event.location_lat && event.location_lng) && !deadline
  const hasLeftColumn = !!(event.image_url || hasMap)

  const [saved, setSaved] = useState(false)
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
      showToast('Link copied to clipboard')
    }
  }

  const handleDownloadIcs = () => {
    const ics = buildIcs(event)
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.title.replace(/[^a-zA-Z0-9-_ ]/g, '').trim()}.ics`
    a.click()
    URL.revokeObjectURL(url)
    setCalMenuOpen(false)
    showToast('Calendar file downloaded')
  }

  // Register / Event info clicks leave the site, so without this an event page
  // had no measurable outcome at all. `event_outbound_click` counts as an
  // activation in scripts/seo/pull-posthog.mjs.
  const trackOutbound = (kind: 'register' | 'info', surface: 'details' | 'phone_bar') => {
    posthog.capture('event_outbound_click', { kind, surface, event_id: event.id, event_type: event.event_type, is_past: isPast })
  }

  const timeStr = event.event_time ? formatTime(event.event_time) : null
  const endTimeStr = event.event_end_time ? formatTime(event.event_end_time) : null
  const location = [event.location_name, event.location_address].filter(Boolean).join(', ')

  return (
    <EventsToneProvider tone={tone} hrefBase={hrefBase}>
    <div className={`min-h-screen bg-(--ev-bg) px-4 pb-32 pt-6 sm:px-8 sm:pt-8 lg:pb-24 ${toneClass(tone)}`}>
      <div className="mx-auto max-w-[1040px]">
        {/* Back button */}
        <Link href={hrefBase} className="mb-6 inline-flex items-center gap-1 text-[13px] font-medium text-(--ev-ink-75) transition-colors hover:text-(--ev-ink) sm:mb-8">
          <ChevronLeft size={16} />
          All events
        </Link>

        <ScheduleBanner event={event} />
        {isPast && <NextUpBanner nextUp={nextUp} />}

        <div className={`grid gap-6 sm:gap-10 ${hasLeftColumn ? 'lg:grid-cols-2' : ''}`}>
          {/* ---- LEFT COLUMN ---- */}
          {hasLeftColumn && (
            <div>
              {event.image_url && (
                <div className="mb-6 overflow-hidden rounded-2xl border border-(--ev-line)">
                  <img src={event.image_url} alt={event.title} className="w-full object-contain" />
                </div>
              )}

              {hasMap && (
                <div className="overflow-hidden rounded-2xl border border-(--ev-line) bg-(--ev-card)">
                  <div className={event.image_url ? 'h-48' : 'h-72'}>
                    <EventMap lat={event.location_lat!} lng={event.location_lng!} label={event.location_name} />
                  </div>
                  <div className="p-4">
                    <p className="text-[14px] font-semibold text-(--ev-ink)">{event.location_name}</p>
                    {event.location_address && (
                      <p className="mt-0.5 text-[13px] text-(--ev-ink-75)">{event.location_address}</p>
                    )}
                    <a
                      href={directionsUrl(event)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-(--ev-line-mid) px-4 py-2 text-[13px] font-medium text-(--ev-ink-75) transition-colors hover:bg-(--ev-panel)"
                    >
                      <MapPin size={14} />
                      Directions
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---- RIGHT COLUMN ---- */}
          <div>
            {/* Type + date header */}
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-[13px]"
                style={{ backgroundColor: ink + TINT[tone].tile }}
              >
                <Icon size={22} style={{ color: ink }} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: ink }}>
                  {meta.label}
                  {level && (
                    <>
                      <span className="text-(--ev-ink-75)"> · </span>
                      <span style={{ color: rideStyleInk(level, tone) }} title={RIDE_STYLE_BLURB[level]}>{RIDE_STYLE_LABEL[level]}</span>
                    </>
                  )}
                </p>
                <p className="text-[13px] text-(--ev-ink-75)">
                  {deadline && 'Entry deadline: '}
                  {dateLong(evDate)}
                  {timeStr && ` · ${timeStr}`}
                  {!deadline && endTimeStr && ` – ${endTimeStr}`}
                </p>
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => { setSaved(!saved); showToast(saved ? 'Removed from saved' : 'Event saved') }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-(--ev-line-mid) transition-colors hover:border-(--ev-line-stronger)"
                  aria-label={saved ? 'Remove bookmark' : 'Save event'}
                >
                  <Bookmark size={18} className={saved ? 'fill-(--ev-accent) text-(--ev-accent)' : 'text-(--ev-ink-60)'} />
                </button>
              </div>
            </div>

            {/* Title */}
            <h1 className="mb-4 font-display text-[clamp(28px,3.5vw,40px)] font-extrabold leading-[1.1] tracking-tight text-(--ev-ink)">
              {event.title}
            </h1>

            {/* Ride facts: the organizer's own numbers */}
            {rideFacts.length > 0 && (
              <p className="-mt-2 mb-4 text-[14px] font-medium text-(--ev-ink-80)">
                {rideFacts.join(' · ')}
              </p>
            )}

            {/* Tags */}
            {(noDrop || event.tags.length > 0) && (
              <div className="mb-6 flex flex-wrap gap-1.5">
                {noDrop && (
                  <span
                    className="inline-block rounded-full bg-(--ev-accent-tint-15) px-3 py-1 text-[12px] font-semibold text-(--ev-accent)"
                    title="The organizer says nobody gets left behind: the group waits, or a sweep rides at the back."
                  >
                    No-drop
                  </span>
                )}
                {event.tags.map(tag => {
                  const tm = tagInk(getTagMeta(tag), tone)
                  return (
                    <span
                      key={tag}
                      className="inline-block rounded-full px-3 py-1 text-[12px] font-semibold"
                      style={{ color: tm.color, backgroundColor: tm.bg }}
                    >
                      {getTagMeta(tag).label}
                    </span>
                  )
                })}
              </div>
            )}

            {/* Action row (desktop; phones get the bottom bar) */}
            <div className="mb-8 hidden flex-wrap gap-2 lg:flex">
              {(event.location_lat && event.location_lng) && !deadline && (
                <a
                  href={directionsUrl(event)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[10px] bg-(--ev-accent-fill) px-5 py-2.5 text-[13px] font-bold text-(--ev-on-accent-fill) transition-opacity hover:opacity-85"
                >
                  <MapPin size={15} />
                  Getting there
                </a>
              )}

              {/* Save to calendar */}
              <div className="relative">
                <button
                  onClick={() => setCalMenuOpen(!calMenuOpen)}
                  className="inline-flex items-center gap-2 rounded-[10px] border border-(--ev-line-strong) px-5 py-2.5 text-[13px] font-semibold text-(--ev-ink) transition-colors hover:bg-(--ev-panel)"
                >
                  <Calendar size={15} />
                  Save to calendar
                </button>
                {calMenuOpen && (
                  <div className="absolute left-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-(--ev-line-mid) bg-(--ev-menu-raised) py-1 shadow-(--ev-shadow-deep)">
                    <a
                      href={gcalUrl(event)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-(--ev-ink-80) transition-colors hover:bg-(--ev-panel)"
                      onClick={() => setCalMenuOpen(false)}
                    >
                      <Globe size={14} />
                      Google Calendar
                    </a>
                    <button
                      onClick={handleDownloadIcs}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-(--ev-ink-80) transition-colors hover:bg-(--ev-panel)"
                    >
                      <Calendar size={14} />
                      Apple Calendar (.ics)
                    </button>
                    <button
                      onClick={handleDownloadIcs}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-(--ev-ink-80) transition-colors hover:bg-(--ev-panel)"
                    >
                      <ExternalLink size={14} />
                      Download .ics file
                    </button>
                  </div>
                )}
              </div>

              {/* Share */}
              <button
                onClick={handleShare}
                className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-(--ev-line-strong) text-(--ev-ink-75) transition-colors hover:bg-(--ev-panel)"
                aria-label="Share"
              >
                <Share2 size={16} />
              </button>
            </div>

            {/* Description */}
            {event.body && (
              <div className="mb-8 text-[15px] leading-relaxed text-(--ev-ink-75) whitespace-pre-line">
                {event.body}
              </div>
            )}

            {/* Meta list */}
            <div className="mb-8 flex flex-col gap-3 border-t border-(--ev-line) pt-6">
              <div className="flex gap-3">
                <Calendar size={16} className="mt-0.5 shrink-0 text-(--ev-ink-40)" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-(--ev-ink-70)">{deadline ? 'Entry deadline' : 'Date'}</p>
                  <p className="text-[14px] text-(--ev-ink-80)">{dateLong(evDate)}</p>
                </div>
              </div>
              {timeStr && (
                <div className="flex gap-3">
                  <Clock size={16} className="mt-0.5 shrink-0 text-(--ev-ink-40)" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-(--ev-ink-70)">Time</p>
                    <p className="text-[14px] text-(--ev-ink-80)">
                      {timeStr}{endTimeStr && ` – ${endTimeStr}`}
                    </p>
                  </div>
                </div>
              )}
              {event.location_name && event.location_name !== 'See event page for details' && (
                <div className="flex gap-3">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-(--ev-ink-40)" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-(--ev-ink-70)">Where</p>
                    <p className="text-[14px] text-(--ev-ink-80)">{location}</p>
                  </div>
                </div>
              )}
              {event.organizer_name && (
                <div className="flex gap-3">
                  <Users size={16} className="mt-0.5 shrink-0 text-(--ev-ink-40)" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-(--ev-ink-70)">Organizer</p>
                    {event.organizer_url ? (
                      <a href={withUtm(event.organizer_url)} target="_blank" rel="noopener noreferrer" className="text-[14px] text-(--ev-accent) hover:underline">
                        {event.organizer_name} <ExternalLink size={12} className="inline" />
                      </a>
                                        ) : (
                      <p className="text-[14px] text-(--ev-ink-80)">{event.organizer_name}</p>
                    )}
                  </div>
                </div>
              )}
              {event.sponsors && event.sponsors.length > 0 && (
                <div className="flex gap-3">
                  <Users size={16} className="mt-0.5 shrink-0 text-(--ev-ink-40)" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-(--ev-ink-70)">
                      {event.organizer_name ? 'Presented with' : 'Presented by'}
                    </p>
                    <p className="text-[14px] text-(--ev-ink-80)">
                      {event.sponsors.map((name, i) => {
                        const url = sponsorLinks[name]
                        return (
                          <span key={name}>
                            {i > 0 && ' · '}
                            {url ? (
                              <a href={withUtm(url)} target="_blank" rel="noopener noreferrer" className="text-(--ev-accent) hover:underline">
                                {name} <ExternalLink size={12} className="inline" />
                              </a>
                            ) : (
                              name
                            )}
                          </span>
                        )
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Outbound link buttons */}
            <div className="flex flex-wrap gap-2">
              {event.event_url && (
                <a
                  href={withUtm(event.event_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[10px] border border-(--ev-line-strong) px-5 py-2.5 text-[13px] font-semibold text-(--ev-ink) transition-colors hover:bg-(--ev-panel)"
                  onClick={() => trackOutbound('info', 'details')}
                >
                  <Globe size={15} />
                  Event info
                </a>
              )}
              {event.registration_url && (
                <a
                  href={withUtm(event.registration_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[10px] bg-blue px-5 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-85"
                  onClick={() => trackOutbound('register', 'details')}
                >
                  <Ticket size={15} />
                  Register
                </a>
              )}
            </div>

            {/* App invitation. Event pages are the site's top organic click class
                and, until 2026-09, the only major landing class with no way into
                Shift (0 of 36 organic event visits reached the app). Contests are
                places to enter, not to travel to, so they skip it.
                Experiment exp-2026-09-8. */}
            {!deadline && STORE_LIVE && (
              <div className="mt-6 rounded-[14px] border border-(--ev-line-strong) px-5 py-4">
                <p className="text-[14px] font-semibold text-(--ev-ink)">Walking, biking or taking transit there?</p>
                <p className="mt-1 text-[13px] leading-relaxed text-(--ev-ink-80)">
                  Shift counts the trip without you touching anything and turns it into money saved and perks from
                  local businesses. It&apos;s free.
                </p>
                <StoreButtons
                  iosUrl={withAppUtm(IOS_URL)}
                  androidUrl={withAppUtm(ANDROID_URL)}
                  placement="event_detail"
                  tone={tone === 'light' ? 'light' : 'dark'}
                  className="mt-3.5 [&>a]:max-[420px]:basis-full"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phone action bar: the primary link, save to calendar, share */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-(--ev-line-10) bg-(--ev-bar-deep) px-4 pt-3 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        {event.registration_url ? (
          <a
            href={withUtm(event.registration_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[10px] bg-blue px-4 text-[14px] font-bold text-white"
            onClick={() => trackOutbound('register', 'phone_bar')}
          >
            <Ticket size={16} />
            Register
          </a>
        ) : event.event_url ? (
          <a
            href={withUtm(event.event_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[10px] bg-(--ev-accent-fill) px-4 text-[14px] font-bold text-(--ev-on-accent-fill)"
            onClick={() => trackOutbound('info', 'phone_bar')}
          >
            <Globe size={16} />
            Event info
          </a>
        ) : hasMap ? (
          <a
            href={directionsUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[10px] bg-(--ev-accent-fill) px-4 text-[14px] font-bold text-(--ev-on-accent-fill)"
          >
            <MapPin size={16} />
            Getting there
          </a>
        ) : null}
        <div className="relative">
          <button
            onClick={() => setBarMenuOpen(!barMenuOpen)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-(--ev-line-strong) px-4 text-[13px] font-semibold text-(--ev-ink)"
            aria-haspopup="menu"
            aria-expanded={barMenuOpen}
          >
            <Calendar size={16} />
            Save
          </button>
          {barMenuOpen && (
            <div className="absolute bottom-full right-0 z-50 mb-2 w-56 overflow-hidden rounded-xl border border-(--ev-line-mid) bg-(--ev-menu-raised) py-1 shadow-(--ev-shadow-deep)">
              <a
                href={gcalUrl(event)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-(--ev-ink-80) transition-colors hover:bg-(--ev-panel)"
                onClick={() => setBarMenuOpen(false)}
              >
                <Globe size={14} />
                Google Calendar
              </a>
              <button
                onClick={() => { handleDownloadIcs(); setBarMenuOpen(false) }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-(--ev-ink-80) transition-colors hover:bg-(--ev-panel)"
              >
                <Calendar size={14} />
                Apple Calendar (.ics)
              </button>
            </div>
          )}
        </div>
        <button
          onClick={handleShare}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-(--ev-line-strong) text-(--ev-ink-80)"
          aria-label="Share"
        >
          <Share2 size={17} />
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-(--ev-line-mid) bg-(--ev-toast) px-5 py-3 text-[13px] font-medium text-(--ev-ink-on-toast) shadow-(--ev-shadow)"
          style={{ animation: 'animate-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        >
          {toast}
        </div>
      )}
    </div>
    </EventsToneProvider>
  )
}
