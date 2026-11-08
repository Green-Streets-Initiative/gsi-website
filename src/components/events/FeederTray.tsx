'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { eventHref, eventPath } from '@/lib/events-url'
import { type CommunityEvent, getTypeMeta, haversine } from '@/lib/events'
import { withLang } from '@/lib/site-i18n'
import { timeL, plural } from '@/lib/events-i18n'
import { feederPlace, shortOrganizer } from '@/lib/go-together'
import { EVENT_TYPE_ICONS } from './event-type-icons'
import { useEventsTone, useEventsI18n } from './EventsTone'
import { trackEvents } from './events-analytics'

/** How many groups show before "+N more groups". */
const SHOWN = 2

/**
 * The Go together tray under an event card (Keith 2026-10-29, option A): the
 * groups riding or walking there together, nearest first. Mirrors the Shift
 * app's FeederTray. Sits flush under its EventCard (attached).
 */
export default function FeederTray({ eventId, feeders, userLat, userLng, showAway }: {
  eventId: string
  feeders: CommunityEvent[]
  userLat: number
  userLng: number
  /** The person picked a place; until then the groups are still sorted from the default point, without a distance. */
  showAway?: boolean
}) {
  const { hrefBase } = useEventsTone()
  const { locale, t } = useEventsI18n()
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
        {plural(t, rows.length, 'gt.tray_one', 'gt.tray_other')}
      </p>
      <ul className="mt-1.5 flex flex-col gap-1 border-l-2 border-(--ev-accent-line-40) pl-3.5">
        {visible.map(({ f, miles }) => {
          const Icon = EVENT_TYPE_ICONS[getTypeMeta(f.event_type).icon] ?? Calendar
          const place = feederPlace(f.title, f.location_name)
          const off = f.schedule_status === 'cancelled'
          const sub = [
            off ? t('card.cancelled') : f.event_time ? t('gt.leaves', { time: timeL(f.event_time, locale) }) : null,
            shortOrganizer(f.organizer_name),
          ].filter(Boolean).join(' · ')
          const awayN = showAway && miles !== null ? (miles < 10 ? miles.toFixed(1) : String(Math.round(miles))) : null
          const away = awayN === null ? null : t('unit.mi', { n: awayN })
          return (
            <li key={f.id}>
              <Link
                // A Shift ride opens its own page on that date, where people RSVP, no app needed.
                href={withLang(off ? eventPath(f, hrefBase) : eventHref(f, hrefBase), locale)}
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
                  <span className={`block truncate text-[15px] font-bold ${off ? 'text-(--ev-ink-75) line-through' : 'text-(--ev-ink)'}`}>{t('gt.from', { place })}</span>
                  {sub && <span className="block truncate text-[14px] text-(--ev-ink-75)">{sub}</span>}
                </span>
                {away && (
                  <span className="shrink-0 text-right">
                    <span className="block text-[15px] font-bold text-(--ev-accent)">{away}</span>
                    <span className="block text-[13px] text-(--ev-ink-75)">{t('gt.away')}</span>
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
          {plural(t, more, 'gt.more_one', 'gt.more_other')}
        </button>
      )}
    </div>
  )
}
