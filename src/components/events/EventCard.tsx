'use client'

import Link from 'next/link'
import { eventPath } from '@/lib/events-url'
import { Calendar, Bookmark } from 'lucide-react'
import { type CommunityEvent, getTypeMeta, getTagMeta, formatTime, formatDistance, haversine, isDeadline, dateRangeShort, eventDayKeys, isMultiDay, eventRideStyle, isNoDrop, rideLengthLabel, RIDE_STYLE_LABEL } from '@/lib/events'
import { typeInk, tagInk, rideStyleInk, TINT } from '@/lib/events-tone'
import { EVENT_TYPE_ICONS } from './event-type-icons'
import { useEventsTone } from './EventsTone'

interface EventCardProps {
  event: CommunityEvent
  userLat: number
  userLng: number
  /** The person picked a place (Near), so "2.3 mi away" is from them and not the default point. */
  showAway?: boolean
  showDate?: boolean
  saved?: boolean
  onToggleSave?: (id: string) => void
  onOpen?: () => void
  /** A feeder ride's destination, when it is a card of its own: "Rides to Critical Mass" (Shift 01460). */
  ridesTo?: string | null
  /** A Go together tray sits flush underneath (FeederTray). */
  attached?: boolean
}

/**
 * One event. Phones get the stacked card; from lg up the same markup becomes
 * a denser row with a fixed time column on the left (CSS only, so there is no
 * layout flash when the desktop media query resolves after hydration).
 */
export default function EventCard({ event, userLat, userLng, showAway, showDate, saved, onToggleSave, onOpen, ridesTo, attached }: EventCardProps) {
  const { tone, hrefBase } = useEventsTone()
  const meta = getTypeMeta(event.event_type)
  const Icon = EVENT_TYPE_ICONS[meta.icon] ?? Calendar
  // The type's color for this surface: the navy-tuned one, or its ink on cream.
  const ink = typeInk(meta, tone)
  const tint = TINT[tone]
  // Easy / Moderate / Rec, only when the listing supports the call.
  const level = eventRideStyle(event)
  const noDrop = isNoDrop(event)
  // Pace, distance, and drop policy are the three things a rider needs (Keith).
  // The level carries the pace; the length rides beside it when the listing states one.
  // Two distances sit on a ride's card, so each says what it is (Keith 2026-11-03):
  // the ride's length ("24 mi ride") next to its level, and how far it is from
  // you ("2.3 mi away") at the end of the place line, where it never gets cut off.
  const rideLength = level ? rideLengthLabel(event.distance_text) : null

  const away = showAway && event.location_lat && event.location_lng
    ? `${formatDistance(haversine(userLat, userLng, event.location_lat, event.location_lng))} away`
    : null

  const timeStr = event.event_time ? formatTime(event.event_time) : null
  const endStr = event.event_end_time ? formatTime(event.event_end_time) : null
  // "Nov 1 to 30" for a multi-day event (Shift 01557), "Nov 1" otherwise.
  const datePart = showDate ? dateRangeShort(event) : null
  // The desktop time column says how long a multi-day, all-day event runs.
  const spanLabel = isMultiDay(event) ? `${eventDayKeys(event).length} days` : 'All day'
  const deadline = isDeadline(event.event_type)
  // A Shift ride's cancelled date stays on the list, struck through, so
  // someone planning on it sees it's off instead of it quietly vanishing.
  const off = event.schedule_status === 'cancelled'

  // Who runs it sits on the card itself: people come to trust specific groups,
  // and they shouldn't have to click through to find out (Keith, 2026-09-14).
  const organizer = event.organizer_name?.trim() || null

  // Phone: date · time · organizer, then the place line
  let when = datePart && timeStr ? `${datePart} · ${timeStr}` : datePart ?? timeStr ?? ''
  if (deadline && when) when = `Entry deadline: ${when}`

  const place = event.location_name && event.location_name !== 'See event page for details' ? event.location_name : null

  // Desktop: the time lives in its own column and the distance in its own, so date · organizer · place
  const whenLg = datePart ? (deadline ? `Entry deadline: ${datePart}` : datePart) : ''

  /** "lead · organizer · tail", with the organizer set brighter than the rest. */
  const metaLine = (lead: string, tail: string | null) => (
    <>
      {lead}
      {organizer && (
        <>
          {lead && ' · '}
          <span className="font-medium text-(--ev-ink-85)">{organizer}</span>
        </>
      )}
      {tail && `${lead || organizer ? ' · ' : ''}${tail}`}
    </>
  )

  return (
    <div className={`group relative flex min-h-[72px] items-start gap-3 border border-(--ev-line) bg-(--ev-card) p-3.5 transition-all duration-200 hover:border-(--ev-line-mid) hover:bg-(--ev-card-hover) sm:gap-4 sm:p-4 lg:min-h-0 lg:items-center lg:px-4 lg:py-3 ${attached ? 'rounded-t-[14px]' : 'rounded-[14px]'}`}>
      <Link href={eventPath(event, hrefBase)} onClick={onOpen} className={`absolute inset-0 z-10 ${attached ? 'rounded-t-[14px]' : 'rounded-[14px]'}`} aria-label={event.title} />

      {/* Desktop time column */}
      <div className="hidden w-[76px] shrink-0 flex-col lg:flex">
        <span className={`text-[14px] font-semibold leading-tight ${off ? 'text-(--ev-ink-75) line-through' : 'text-(--ev-ink)'}`}>
          {deadline ? 'Deadline' : timeStr ?? spanLabel}
        </span>
        {!deadline && timeStr && endStr && (
          <span className="mt-0.5 text-[13px] leading-tight text-(--ev-ink-75)">to {endStr}</span>
        )}
      </div>

      {/* Flyer thumbnail when the event has one; the type tile otherwise */}
      {event.image_url ? (
        <div
          className="h-16 w-16 shrink-0 overflow-hidden rounded-[13px] border sm:h-14 sm:w-14 lg:h-11 lg:w-11 lg:rounded-[10px]"
          style={{ borderColor: ink + tint.spotLine, backgroundColor: ink + tint.thumb }}
        >
          <img src={event.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[13px] sm:h-14 sm:w-14 lg:h-11 lg:w-11 lg:rounded-[10px]"
          style={{ backgroundColor: ink + tint.tile }}
        >
          <Icon size={24} className="lg:hidden" style={{ color: ink }} />
          <Icon size={18} className="hidden lg:block" style={{ color: ink }} />
        </div>
      )}

      {/* Body */}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] lg:hidden" style={{ color: ink }}>
          {meta.label}
          {level && (
            <>
              <span className="text-(--ev-ink-75)"> · </span>
              <span style={{ color: rideStyleInk(level, tone) }}>{RIDE_STYLE_LABEL[level]}</span>
              {rideLength && <span className="text-(--ev-ink-75)"> · {rideLength}</span>}
            </>
          )}
        </p>
        <h3 className={`mt-0.5 line-clamp-2 font-display text-[17px] font-bold leading-snug sm:text-[18px] lg:mt-0 lg:line-clamp-1 lg:text-[16px] ${off ? 'text-(--ev-ink-75)' : 'text-(--ev-ink)'}`}>
          {off && <span className="mr-2 inline-block rounded-full bg-[#FBE4DF] px-2 py-0.5 align-middle font-sans text-[13px] font-bold leading-tight text-(--ev-danger)">Cancelled</span>}
          <span className={off ? 'line-through' : undefined}>{event.title}</span>
        </h3>
        <p className={`mt-1 text-[14px] leading-snug text-(--ev-ink-75) lg:hidden ${off ? 'line-through' : ''}`}>
          {metaLine(when, null)}
        </p>
        {(place || away) && (
          <p className="mt-0.5 flex min-w-0 text-[14px] leading-snug text-(--ev-ink-75) lg:hidden">
            {place && <span className="truncate">{place}</span>}
            {away && <span className="shrink-0 whitespace-pre font-semibold text-(--ev-ink-85)">{place ? ' · ' : ''}{away}</span>}
          </p>
        )}
        {/* Desktop: the type, level and ride length never truncate; the place does. */}
        <p className="mt-0.5 hidden min-w-0 text-[14px] leading-snug text-(--ev-ink-75) lg:flex">
          <span className="shrink-0 whitespace-pre">
            <span className="font-medium" style={{ color: ink }}>{meta.label}</span>
            {level && (
              <>
                {' · '}
                <span className="font-medium" style={{ color: rideStyleInk(level, tone) }}>{RIDE_STYLE_LABEL[level]}</span>
                {rideLength && ` · ${rideLength}`}
              </>
            )}
            {(whenLg || organizer || place) && ' · '}
          </span>
          <span className="truncate">{metaLine(whenLg, place)}</span>
        </p>
        {ridesTo && (
          <p className="mt-1 truncate text-[14px] font-semibold text-(--ev-accent)">
            {event.event_type === 'walking_tour' ? 'Walks' : 'Rides'} to {ridesTo}
          </p>
        )}
        {(event.ride_series_id || noDrop || event.tags.length > 0) && (
          <div className="mt-1.5 flex flex-wrap gap-1 lg:mt-1">
            {noDrop && (
              <span className="inline-block rounded-full bg-(--ev-accent-tint-15) px-2 py-0.5 text-[10px] font-semibold leading-tight text-(--ev-accent)">
                No-drop
              </span>
            )}
            {/* Planned in the Shift app — riders can RSVP there rather than
                following a link to somebody else's site. */}
            {event.ride_series_id && !off && (
              <span className="inline-block rounded-full bg-(--ev-accent-tint-15) px-2 py-0.5 text-[10px] font-semibold leading-tight text-(--ev-accent)">
                RSVP, no app needed
              </span>
            )}
            {event.tags.slice(0, 3).map(tag => {
              const tm = tagInk(getTagMeta(tag), tone)
              return (
                <span
                  key={tag}
                  className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight"
                  style={{ color: tm.color, backgroundColor: tm.bg }}
                >
                  {getTagMeta(tag).label}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Desktop distance column, beside the bookmark */}
      {away && (
        <span className="hidden w-[92px] shrink-0 text-right text-[14px] font-semibold text-(--ev-ink-85) lg:block">{away}</span>
      )}

      {/* Bookmark */}
      {onToggleSave && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(event.id) }}
          className="relative z-20 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-(--ev-line-mid) transition-colors hover:border-(--ev-line-stronger) lg:h-9 lg:w-9"
          aria-label={saved ? 'Remove bookmark' : 'Save event'}
        >
          <Bookmark size={18} className={saved ? 'fill-(--ev-accent) text-(--ev-accent)' : 'text-(--ev-ink-75)'} />
        </button>
      )}
    </div>
  )
}
