'use client'

import Link from 'next/link'
import { Bike, ChevronRight, Footprints } from 'lucide-react'
import posthog from 'posthog-js'
import { eventHref, eventPath } from '@/lib/events-url'
import { formatTime } from '@/lib/events'
import { feederPlace, isWalkGroup, shortOrganizer, type GoTogetherGroup, type GoTogetherTarget } from '@/lib/go-together'
import { useEventsTone } from './EventsTone'

/**
 * Go Together on an event's page (Shift 01460), the website twin of the
 * app's components/GoTogether.tsx:
 *
 *   FeedsToLine        "Rides to Critical Mass" under a group's own title.
 *   GoTogetherSection  on the event: the groups going there together, with
 *                      where each starts and when it leaves.
 *
 * Same words as the app (go_together.* in Shift's locales/en.json). The web
 * page doesn't know where the visitor is, so groups sort by start time
 * instead of distance.
 */

export function FeedsToLine({ target, walk, fromId }: { target: GoTogetherTarget; walk: boolean; fromId: string }) {
  const { hrefBase } = useEventsTone()
  const Icon = walk ? Footprints : Bike
  return (
    <Link
      href={eventPath(target, hrefBase)}
      onClick={() => posthog.capture('go_together_feeds_to_clicked', { event_id: fromId, target_id: target.id })}
      className="-mt-2 mb-4 inline-flex min-h-[44px] items-center gap-2 text-[15px] font-bold text-(--ev-accent) hover:underline"
    >
      <Icon size={16} aria-hidden />
      {walk ? 'Walks' : 'Rides'} to {target.title}
      <ChevronRight size={14} aria-hidden />
    </Link>
  )
}

export function GoTogetherSection({ eventId, groups }: { eventId: string; groups: GoTogetherGroup[] }) {
  const { hrefBase } = useEventsTone()
  if (groups.length === 0) return null
  return (
    <section id="go-together" aria-labelledby="go-together-title" className="mb-8 rounded-2xl border border-(--ev-line) bg-(--ev-card) p-4 sm:p-5">
      <h2 id="go-together-title" className="font-display text-[20px] font-extrabold text-(--ev-ink)">Go Together</h2>
      <p className="mt-1 text-[15px] text-(--ev-ink-75)">Meet a group near you and arrive together.</p>
      <ul className="mt-3 flex flex-col gap-1">
        {groups.map((g) => {
          const walk = isWalkGroup(g.event_type)
          const Icon = walk ? Footprints : Bike
          const details = [
            g.event_time ? `Leaves ${formatTime(g.event_time)}` : null,
            g.distance_text ? `${g.distance_text} ${walk ? 'walk' : 'ride'}` : null,
          ].filter(Boolean).join(' · ')
          const organizer = shortOrganizer(g.organizer_name)
          return (
            <li key={g.id}>
              <Link
                // A Shift ride opens its own page for the date, where people RSVP without the app.
                href={eventHref(g, hrefBase)}
                onClick={() => posthog.capture('go_together_feeder_clicked', { event_id: eventId, feeder_id: g.id, is_shift_ride: !!g.ride_code })}
                className="flex min-h-[56px] items-center gap-3 rounded-[12px] px-2 py-2 transition-colors hover:bg-(--ev-panel)"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--ev-accent-tint-15) text-(--ev-accent)">
                  <Icon size={20} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold text-(--ev-ink)">From {feederPlace(g.title, g.location_name)}</span>
                  {details && <span className="block text-[14px] text-(--ev-ink-75)">{details}</span>}
                  {organizer && <span className="block truncate text-[14px] text-(--ev-ink-75)">{organizer}</span>}
                </span>
                <ChevronRight size={16} className="shrink-0 text-(--ev-ink-75)" aria-hidden />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
