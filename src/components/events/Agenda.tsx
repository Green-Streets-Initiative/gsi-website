'use client'

import { useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { type CommunityEvent, groupLabel, parseEventDate } from '@/lib/events'
import EventCard from './EventCard'
import type { UserLoc } from './useEventFilters'
import { trackEvents } from './events-analytics'
import { useEventsTone } from './EventsTone'

/**
 * The day-grouped list used by the phone list view and the desktop agenda:
 * sticky day headers, paged 40 at a time (unpaged when a single day is
 * showing), and an empty state that points at Submit an event.
 */

export const AGENDA_PAGE = 40

interface AgendaProps {
  events: CommunityEvent[]
  limit: number
  onShowMore: () => void
  paged: boolean
  userLoc: UserLoc
  saved: Record<string, boolean>
  onToggleSave: (id: string) => void
  emptyMessage: string
  emptyAction?: ReactNode
  showCount?: boolean
}

export default function Agenda({
  events, limit, onShowMore, paged, userLoc, saved, onToggleSave, emptyMessage, emptyAction, showCount,
}: AgendaProps) {
  const { hrefBase } = useEventsTone()
  const shown = paged ? events.slice(0, limit) : events

  const groups = useMemo(() => {
    const out: { key: string; label: string; events: CommunityEvent[] }[] = []
    let currentKey = ''
    for (const ev of shown) {
      if (ev.event_date !== currentKey) {
        currentKey = ev.event_date
        out.push({ key: currentKey, label: groupLabel(parseEventDate(ev.event_date)), events: [] })
      }
      out[out.length - 1].events.push(ev)
    }
    return out
  }, [shown])

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-(--ev-line) bg-(--ev-card) px-8 py-14 text-center">
        <p className="text-[15px] text-(--ev-ink-75)">{emptyMessage}</p>
        {emptyAction ?? (
          <Link href={`${hrefBase}/submit`} className="mt-3 inline-block text-[13px] font-semibold text-(--ev-accent) hover:underline">
            Submit an event
          </Link>
        )}
      </div>
    )
  }

  let position = 0
  const remaining = events.length - shown.length

  return (
    <div>
      {showCount && (
        <p className="mb-4 text-[13px] text-(--ev-ink-75) lg:hidden">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </p>
      )}
      <div className="flex flex-col gap-7">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="sticky top-[116px] z-20 mb-3 flex items-center gap-3 bg-(--ev-bg) py-2 lg:top-[116px]">
              <h3 className="whitespace-nowrap text-[14px] font-semibold text-(--ev-ink-85)">{group.label}</h3>
              <div className="h-px flex-1 bg-(--ev-line)" />
              <span className="font-mono text-[12px] text-(--ev-ink-75)">{group.events.length}</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {group.events.map((ev) => {
                const pos = position++
                return (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    userLat={userLoc.lat}
                    userLng={userLoc.lng}
                    saved={!!saved[ev.id]}
                    onToggleSave={onToggleSave}
                    onOpen={() => trackEvents('events_card_clicked', { id: ev.id, type: ev.event_type, position: pos })}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <button
          onClick={() => { onShowMore(); trackEvents('events_show_more', { shown: shown.length + AGENDA_PAGE }) }}
          className="mx-auto mt-6 block rounded-[10px] border border-(--ev-line-strong) px-6 py-3 text-[14px] font-semibold text-(--ev-ink) transition-colors hover:bg-(--ev-panel)"
        >
          Show more · {remaining} remaining
        </button>
      )}
    </div>
  )
}
