'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { eventPath } from '@/lib/events-url'
import { type CommunityEvent, getTypeMeta, formatTime, haversine } from '@/lib/events'
import { feederPlace, shortOrganizer } from '@/lib/go-together'
import { EVENT_TYPE_ICONS } from './event-type-icons'
import { useEventsTone } from './EventsTone'
import { trackEvents } from './events-analytics'

/** How many groups show before "+N more groups". */
const SHOWN = 2

/**
 * The Go together tray under an event card (Keith 2026-10-29, option A): the
 * groups riding or walking there together, nearest first. Mirrors the Shift
 * app's FeederTray. Sits flush under its EventCard (attached).
 */
export default function FeederTray({ eventId, feeders, userLat, userLng }: {
  eventId: string
  feeders: CommunityEvent[]
  userLat: number
  userLng: number
}) {
  const { hrefBase } = useEventsTone()
  const [open, setOpen] = useState(false)

  const rows = feeders
    .map((f) => ({
      f,
      miles: f.location_lat && f.location_lng ? haversine(userLat, userLng, f.location_lat, f.location_lng) : null,
    }))
    .sort((a, b) => (a.miles ?? Infinity) - (b.miles ?? Infinity))
  const visible = open ? rows : rows.slice(0, SHOWN)
  const more = rows.length - visible.length

  return (
    <div className="rounded-b-[14px] border border-t-0 border-(--ev-line) bg-(--ev-panel) px-3.5 pb-3 pt-2.5 sm:px-4 sm:pl-[88px] lg:pl-[108px]">
      <p className="text-[14px] font-bold text-(--ev-accent)">
        Go together · {rows.length} group{rows.length !== 1 ? 's' : ''}
      </p>
      <ul className="mt-1.5 flex flex-col gap-1 border-l-2 border-(--ev-accent-line-40) pl-3.5">
        {visible.map(({ f, miles }) => {
          const Icon = EVENT_TYPE_ICONS[getTypeMeta(f.event_type).icon] ?? Calendar
          const place = feederPlace(f.title, f.location_name)
          const sub = [
            f.event_time ? `Leaves ${formatTime(f.event_time)}` : null,
            shortOrganizer(f.organizer_name),
          ].filter(Boolean).join(' · ')
          const away = miles !== null ? (miles < 10 ? miles.toFixed(1) : String(Math.round(miles))) : null
          return (
            <li key={f.id}>
              <Link
                href={eventPath(f, hrefBase)}
                onClick={() => trackEvents('events_feeder_clicked', { id: f.id, event_id: eventId })}
                className="flex min-h-[48px] items-center gap-3 rounded-[10px] px-1 py-1.5 transition-colors hover:bg-(--ev-card)"
              >
                {f.image_url ? (
                  <img src={f.image_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--ev-accent-tint-15) text-(--ev-accent)">
                    <Icon size={18} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-(--ev-ink)">From {place}</span>
                  {sub && <span className="block truncate text-[14px] text-(--ev-ink-75)">{sub}</span>}
                </span>
                {away && (
                  <span className="shrink-0 text-right">
                    <span className="block text-[15px] font-bold text-(--ev-accent)">{away} mi</span>
                    <span className="hidden text-[13px] text-(--ev-ink-75) sm:block">from you</span>
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
      {more > 0 && (
        <button
          onClick={() => { setOpen(true); trackEvents('events_feeder_more', { event_id: eventId, hidden: more }) }}
          className="mt-1 min-h-[44px] pl-[18px] text-[14px] font-bold text-(--ev-accent) hover:underline"
        >
          +{more} more group{more !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}
