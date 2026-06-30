'use client'

import Link from 'next/link'
import {
  Bike, Zap, Package, Footprints, Bus, Megaphone, PartyPopper,
  MapPin, Calendar, GraduationCap, Wrench, Flag, Users, Bookmark,
  Clock,
} from 'lucide-react'
import { type CommunityEvent, getTypeMeta, getTagMeta, formatTime, formatDistance, haversine, parseEventDate, dateShort } from '@/lib/events'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Bike, Zap, Package, Footprints, Bus, Megaphone, PartyPopper,
  MapPin, Calendar, GraduationCap, Wrench, Flag, Users,
}

interface EventCardProps {
  event: CommunityEvent
  userLat: number
  userLng: number
  showDate?: boolean
  saved?: boolean
  onToggleSave?: (id: string) => void
}

export default function EventCard({ event, userLat, userLng, showDate, saved, onToggleSave }: EventCardProps) {
  const meta = getTypeMeta(event.event_type)
  const Icon = ICON_MAP[meta.icon] ?? Calendar

  const distance = event.location_lat && event.location_lng
    ? haversine(userLat, userLng, event.location_lat, event.location_lng)
    : null

  const evDate = parseEventDate(event.event_date)
  const timeStr = event.event_time ? formatTime(event.event_time) : null
  const datePart = showDate ? dateShort(evDate) : null

  const metaParts: string[] = []
  if (datePart && timeStr) metaParts.push(`${datePart} · ${timeStr}`)
  else if (datePart) metaParts.push(datePart)
  else if (timeStr) metaParts.push(timeStr)

  const locationParts: string[] = []
  if (event.location_name && event.location_name !== 'See event page for details') locationParts.push(event.location_name)
  if (locationParts.length > 0) metaParts.push(locationParts[0])

  if (distance !== null) metaParts.push(formatDistance(distance))

  return (
    <div className="group relative flex items-start gap-4 rounded-[14px] border border-white/[0.07] bg-card p-4 transition-all duration-200 hover:border-white/[0.14] hover:bg-[#2E2F45]">
      <Link href={`/events/${encodeURIComponent(event.id)}`} className="absolute inset-0 z-10 rounded-[14px]" />

      {/* Type tile */}
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[13px]"
        style={{ backgroundColor: meta.color + '29' }}
      >
        <Icon size={24} style={{ color: meta.color }} />
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: meta.color }}>
          {meta.label}
        </p>
        <h3 className="mt-0.5 truncate font-display text-[18px] font-bold leading-snug text-white">
          {event.title}
        </h3>
        <p className="mt-1 truncate text-[13px] text-white/55">
          {metaParts.join(' · ')}
        </p>
        {event.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
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
          className="relative z-20 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.14] transition-colors hover:border-white/[0.25]"
          aria-label={saved ? 'Remove bookmark' : 'Save event'}
        >
          <Bookmark size={18} className={saved ? 'fill-lime text-lime' : 'text-white/60'} />
        </button>
      )}
    </div>
  )
}
