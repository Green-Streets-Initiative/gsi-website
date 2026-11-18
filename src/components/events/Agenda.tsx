'use client'

import { useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { type CommunityEvent, parseEventDate } from '@/lib/events'
import { groupLabelL, eventCount } from '@/lib/events-i18n'
import { siteDate } from '@/lib/site-i18n'
import EventCard from './EventCard'
import FeederTray from './FeederTray'
import type { CalendarEntry } from '@/lib/go-together'
import type { UserLoc } from './useEventFilters'
import { trackEvents } from './events-analytics'
import { useEventsTone, useEventsI18n } from './EventsTone'
import { DateTile } from './EventPageParts'

/**
 * The day-grouped list used by the phone list view and the desktop agenda:
 * sticky day headers, paged 40 at a time (unpaged when a single day is
 * showing), and an empty state that points at Submit an event.
 */

export const AGENDA_PAGE = 40

interface AgendaProps {
  events: CommunityEvent[]
  /** Go together: the same events with feeder rides nested under their event (useEventFilters). */
  entries?: CalendarEntry<CommunityEvent>[]
  /** "Rides to …" for a feeder that is a card of its own. */
  ridesTo?: (ev: CommunityEvent) => string | null
  limit: number
  onShowMore: () => void
  paged: boolean
  userLoc: UserLoc
  /** The person picked a place, so cards say how far away each event is. */
  showAway?: boolean
  saved: Record<string, boolean>
  onToggleSave: (id: string) => void
  emptyMessage: string
  emptyAction?: ReactNode
  showCount?: boolean
  /** Beside the phone count line (the "Get these by email" jump). */
  countAction?: ReactNode
  /** Something placed after the first `after` events (or after the list, when it is shorter): the email sign-up on phones. */
  inset?: { after: number; node: ReactNode }
}

export default function Agenda({
  events, entries: nested, ridesTo, limit, onShowMore, paged, userLoc, showAway, saved, onToggleSave, emptyMessage, emptyAction, showCount, countAction, inset,
}: AgendaProps) {
  const { hrefBase } = useEventsTone()
  const { locale, t } = useEventsI18n()
  const entries = useMemo(() => nested ?? events.map((event) => ({ event, feeders: [] })), [nested, events])
  const shown = paged ? entries.slice(0, limit) : entries
  // Boston's date on server and browser alike, so the label hydrates the same.
  const todayBoston = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const groups = useMemo(() => {
    const out: { key: string; label: string; day: string; entries: CalendarEntry<CommunityEvent>[] }[] = []
    let currentKey = ''
    for (const entry of shown) {
      const ev = entry.event
      if (ev.event_date !== currentKey) {
        currentKey = ev.event_date
        out.push({ key: currentKey, label: groupLabelL(parseEventDate(ev.event_date), locale), day: siteDate(locale, parseEventDate(ev.event_date), { weekday: 'long' }), entries: [] })
      }
      out[out.length - 1].entries.push(entry)
    }
    return out
  }, [shown, locale])

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-(--ev-line) bg-(--ev-card) px-8 py-14 text-center">
        <p className="text-[15px] text-(--ev-ink-75)">{emptyMessage}</p>
        {emptyAction ?? (
          <Link href={`${hrefBase}/submit`} className="mt-3 inline-block text-[15px] font-semibold text-(--ev-accent) hover:underline">
            {t('cta.submit')}
          </Link>
        )}
      </div>
    )
  }

  let position = 0
  const remaining = entries.length - shown.length
  const insetAt = inset ? Math.min(inset.after, shown.length) - 1 : -1

  return (
    <div>
      {showCount && (
        <div className="mb-2 flex items-center justify-between gap-3 lg:hidden">
          <p className="text-[14px] text-(--ev-ink-75)">
            {eventCount(t, events.length)}
          </p>
          {countAction}
        </div>
      )}
      <div className="flex flex-col gap-7">
        {groups.map((group) => (
          <div key={group.key}>
            {/* Each day opens on its date tile (Direction A), sticky while its events scroll by. */}
            <div className="sticky top-[121px] z-[25] mb-3 flex min-h-[62px] items-center gap-3 bg-(--ev-bg) py-2 lg:top-[116px]">
              {/* A multi-day event that started before today sits under "Going on now", not under its first day. */}
              {group.key >= todayBoston && <DateTile date={group.key} locale={locale} size="sm" />}
              <h3 className="min-w-0 truncate font-(family-name:--font-headline) text-[18px] font-extrabold tracking-[-0.01em] [word-spacing:0.12em] text-(--ev-ink)">
                {group.key < todayBoston ? t('agenda.ongoing') : group.key === todayBoston ? t('cal.today') : (
                  // On a phone the date tile beside it already says "Sat 21", so the weekday is enough.
                  <><span className="sm:hidden">{group.day}</span><span className="hidden sm:inline">{group.label}</span></>
                )}
              </h3>
              <div className="h-px min-w-4 flex-1 bg-(--ev-line)" />
              <span className="shrink-0 text-[14px] text-(--ev-ink-75)">{eventCount(t, group.entries.reduce((n, e) => n + 1 + e.feeders.length, 0))}</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {group.entries.map(({ event: ev, feeders }) => {
                const pos = position++
                return (
                  <div key={ev.id}>
                    <EventCard
                      event={ev}
                      userLat={userLoc.lat}
                      userLng={userLoc.lng}
                      showAway={showAway}
                      saved={!!saved[ev.id]}
                      onToggleSave={onToggleSave}
                      onOpen={() => trackEvents('events_card_clicked', { id: ev.id, type: ev.event_type, position: pos })}
                      ridesTo={ridesTo?.(ev)}
                      attached={feeders.length > 0}
                    />
                    {feeders.length > 0 && (
                      <FeederTray eventId={ev.id} feeders={feeders} userLat={userLoc.lat} userLng={userLoc.lng} showAway={showAway} />
                    )}
                    {pos === insetAt && inset!.node}
                  </div>
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
          {t('agenda.show_more', { count: remaining })}
        </button>
      )}
    </div>
  )
}
