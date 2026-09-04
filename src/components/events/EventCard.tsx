'use client'

import Link from 'next/link'
import { Calendar, Bookmark } from 'lucide-react'
import { type CommunityEvent, getTypeMeta, getTagMeta, formatTime, formatDistance, haversine, isDeadline, parseEventDate, dateShort } from '@/lib/events'
import { EVENT_TYPE_ICONS } from './event-type-icons'

interface EventCardProps {
  event: CommunityEvent
  userLat: number
  userLng: number
  showDate?: boolean
  saved?: boolean
  onToggleSave?: (id: string) => void
  onOpen?: () => void
}

/**
 * One event. Phones get the stacked card; from lg up the same markup becomes
 * a denser row with a fixed time column on the left (CSS only, so there is no
 * layout flash when the desktop media query resolves after hydration).
 */
export default function EventCard({ event, userLat, userLng, showDate, saved, onToggleSave, onOpen }: EventCardProps) {
  const meta = getTypeMeta(event.event_type)
  const Icon = EVENT_TYPE_ICONS[meta.icon] ?? Calendar

  const distance = event.location_lat && event.location_lng
    ? haversine(userLat, userLng, event.location_lat, event.location_lng)
    : null

  const evDate = parseEventDate(event.event_date)
  const timeStr = event.event_time ? formatTime(event.event_time) : null
  const endStr = event.event_end_time ? formatTime(event.event_end_time) : null
  const datePart = showDate ? dateShort(evDate) : null
  const deadline = isDeadline(event.event_type)

  // Phone meta line: date · time · place · distance
  const metaParts: string[] = []
  if (datePart && timeStr) metaParts.push(`${datePart} · ${timeStr}`)
  else if (datePart) metaParts.push(datePart)
  else if (timeStr) metaParts.push(timeStr)
  if (deadline && metaParts.length > 0) metaParts[0] = `Entry deadline: ${metaParts[0]}`

  const place = event.location_name && event.location_name !== 'See event page for details' ? event.location_name : null
  if (place) metaParts.push(place)
  if (distance !== null) metaParts.push(formatDistance(distance))

  // Desktop meta line: the time lives in its own column, so only place · distance
  const metaPartsLg: string[] = []
  if (datePart) metaPartsLg.push(deadline ? `Entry deadline: ${datePart}` : datePart)
  if (place) metaPartsLg.push(place)
  if (distance !== null) metaPartsLg.push(formatDistance(distance))

  return (
    <div className="group relative flex min-h-[72px] items-start gap-3 rounded-[14px] border border-white/[0.07] bg-card p-3.5 transition-all duration-200 hover:border-white/[0.14] hover:bg-[#2E2F45] sm:gap-4 sm:p-4 lg:min-h-0 lg:items-center lg:px-4 lg:py-3">
      <Link href={`/events/${encodeURIComponent(event.id)}`} onClick={onOpen} className="absolute inset-0 z-10 rounded-[14px]" aria-label={event.title} />

      {/* Desktop time column */}
      <div className="hidden w-[76px] shrink-0 flex-col lg:flex">
        <span className="text-[14px] font-semibold leading-tight text-white">
          {deadline ? 'Deadline' : timeStr ?? 'All day'}
        </span>
        {!deadline && timeStr && endStr && (
          <span className="mt-0.5 text-[11px] leading-tight text-white/75">to {endStr}</span>
        )}
      </div>

      {/* Flyer thumbnail when the event has one; the type tile otherwise */}
      {event.image_url ? (
        <div
          className="h-16 w-16 shrink-0 overflow-hidden rounded-[13px] border sm:h-14 sm:w-14 lg:h-11 lg:w-11 lg:rounded-[10px]"
          style={{ borderColor: meta.color + '55', backgroundColor: meta.color + '14' }}
        >
          <img src={event.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[13px] sm:h-14 sm:w-14 lg:h-11 lg:w-11 lg:rounded-[10px]"
          style={{ backgroundColor: meta.color + '29' }}
        >
          <Icon size={24} className="lg:hidden" style={{ color: meta.color }} />
          <Icon size={18} className="hidden lg:block" style={{ color: meta.color }} />
        </div>
      )}

      {/* Body */}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] lg:hidden" style={{ color: meta.color }}>
          {meta.label}
        </p>
        <h3 className="mt-0.5 line-clamp-2 font-display text-[17px] font-bold leading-snug text-white sm:text-[18px] lg:mt-0 lg:line-clamp-1 lg:text-[16px]">
          {event.title}
        </h3>
        <p className="mt-1 text-[13px] leading-snug text-white/75 lg:hidden">
          {metaParts.join(' · ')}
        </p>
        <p className="mt-0.5 hidden truncate text-[13px] leading-snug text-white/75 lg:block">
          <span className="font-medium" style={{ color: meta.color }}>{meta.label}</span>
          {metaPartsLg.length > 0 && ` · ${metaPartsLg.join(' · ')}`}
        </p>
        {(event.ride_series_id || event.tags.length > 0) && (
          <div className="mt-1.5 flex flex-wrap gap-1 lg:mt-1">
            {/* Planned in the Shift app — riders can RSVP there rather than
                following a link to somebody else's site. */}
            {event.ride_series_id && (
              <span className="inline-block rounded-full bg-lime/15 px-2 py-0.5 text-[10px] font-semibold leading-tight text-lime">
                Join with Shift
              </span>
            )}
            {event.tags.slice(0, 3).map(tag => {
              const tm = getTagMeta(tag)
              return (
                <span
                  key={tag}
                  className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight"
                  style={{ color: tm.color, backgroundColor: tm.bg }}
                >
                  {tm.label}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Bookmark */}
      {onToggleSave && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(event.id) }}
          className="relative z-20 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.14] transition-colors hover:border-white/[0.25] lg:h-9 lg:w-9"
          aria-label={saved ? 'Remove bookmark' : 'Save event'}
        >
          <Bookmark size={18} className={saved ? 'fill-lime text-lime' : 'text-white/75'} />
        </button>
      )}
    </div>
  )
}
