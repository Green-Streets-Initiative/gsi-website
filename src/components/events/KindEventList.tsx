'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { type CommunityEvent, DEFAULT_LOCATION, parseEventDate } from '@/lib/events'
import { groupLabelL } from '@/lib/events-i18n'
import EventCard from './EventCard'
import { trackEvents } from './events-analytics'

/**
 * A kind page's list (/events/group-rides...): the calendar's own cards under
 * the calendar's day headers, one section per area. Rendered on the server
 * too, so the events are in the HTML search reads. Sits inside the page's
 * EventsToneProvider.
 */

export interface KindSection {
  id: string
  title: string
  /** Events with the day each is listed under (a weekend festival's first weekend day). */
  items: { event: CommunityEvent; day: string }[]
  /** How many more this section has than it shows, with where to see them. */
  more?: { count: number; href: string; label: string }
}

export default function KindEventList({ kind, sections, inset }: { kind: string; sections: KindSection[]; inset?: ReactNode }) {
  let position = 0
  return (
    <div className="flex flex-col gap-10">
      {sections.map((s, si) => {
        const groups: { day: string; items: KindSection['items'] }[] = []
        for (const it of s.items) {
          if (groups[groups.length - 1]?.day !== it.day) groups.push({ day: it.day, items: [] })
          groups[groups.length - 1].items.push(it)
        }
        return (
          <div key={s.id} className="flex flex-col gap-8">
            <section aria-labelledby={`${s.id}-h`}>
              <h2 id={`${s.id}-h`} className="font-display text-[22px] font-extrabold text-(--ev-ink)">{s.title}</h2>
              <div className="mt-3 flex flex-col gap-6">
                {groups.map((g) => (
                  <div key={g.day}>
                    <div className="mb-3 flex items-center gap-3">
                      <h3 className="whitespace-nowrap text-[14px] font-semibold text-(--ev-ink-85)">{groupLabelL(parseEventDate(g.day), 'en')}</h3>
                      <div className="h-px flex-1 bg-(--ev-line)" />
                      <span className="font-mono text-[13px] text-(--ev-ink-75)">{g.items.length}</span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {g.items.map(({ event }) => {
                        const pos = position++
                        return (
                          <EventCard
                            key={event.id}
                            event={event}
                            userLat={DEFAULT_LOCATION.lat}
                            userLng={DEFAULT_LOCATION.lng}
                            onOpen={() => trackEvents('events_card_clicked', { id: event.id, type: event.event_type, position: pos, kind })}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {s.more && s.more.count > 0 && (
                <Link href={s.more.href} className="mt-4 inline-block text-[15px] font-semibold text-(--ev-accent) hover:underline">
                  {s.more.label}
                </Link>
              )}
            </section>
            {si === 0 && inset}
          </div>
        )
      })}
    </div>
  )
}
