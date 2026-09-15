'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type CommunityEvent, parseEventDate, dateKey, todayKey, eventDotsByDay, eventCountByDay } from '@/lib/events'
import { useEventsTone } from './EventsTone'

/**
 * Phone-sized replacement for the month grid: one week of day buttons with
 * colored event dots, and the selected day's events listed by the parent.
 * The month grid stays on tablet and desktop (see EventsPage).
 */

interface WeekStripProps {
  events: CommunityEvent[]
  selectedDay: string | null
  onSelectDay: (key: string | null) => void
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function startOfWeek(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  s.setDate(s.getDate() - s.getDay())
  return s
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export default function WeekStrip({ events, selectedDay, onSelectDay }: WeekStripProps) {
  const { tone } = useEventsTone()
  const today = todayKey()
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(selectedDay ? parseEventDate(selectedDay) : new Date()))

  // Follow the selection when it lands outside the visible week.
  useEffect(() => {
    if (!selectedDay) return
    const d = parseEventDate(selectedDay)
    const s = startOfWeek(d)
    if (dateKey(s) !== dateKey(weekStart)) setWeekStart(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay])

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const dotsByDay = useMemo(() => eventDotsByDay(events, 3, tone), [events, tone])
  // Dots on the selected day sit on the accent fill: navy on lime, cream on navy.
  const onFill = tone === 'light' ? '#F4F8EE' : '#191A2E'
  const countByDay = useMemo(() => eventCountByDay(events), [events])

  const first = days[0]
  const last = days[6]
  const rangeLabel = first.getMonth() === last.getMonth()
    ? `${MONTH_SHORT[first.getMonth()]} ${first.getFullYear()}`
    : `${MONTH_SHORT[first.getMonth()]} – ${MONTH_SHORT[last.getMonth()]} ${last.getFullYear()}`

  const goToday = () => {
    setWeekStart(startOfWeek(new Date()))
    onSelectDay(today)
  }

  return (
    <div className="rounded-2xl border border-(--ev-line) bg-(--ev-card) p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-(--ev-line-mid) text-(--ev-ink-80) transition-colors hover:bg-(--ev-panel)"
          aria-label="Previous week"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-display text-[15px] font-bold text-(--ev-ink)">{rangeLabel}</span>
          <button
            onClick={goToday}
            className="rounded-full border border-(--ev-line-mid) px-2.5 py-0.5 text-[11px] font-semibold text-(--ev-ink-80) transition-colors hover:bg-(--ev-panel)"
          >
            Today
          </button>
        </div>
        <button
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-(--ev-line-mid) text-(--ev-ink-80) transition-colors hover:bg-(--ev-panel)"
          aria-label="Next week"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const key = dateKey(d)
          const isSelected = selectedDay === key
          const isToday = key === today
          const isPast = key < today
          const dots = dotsByDay.get(key) ?? []
          const count = countByDay.get(key) ?? 0
          return (
            <button
              key={key}
              onClick={() => onSelectDay(isSelected ? null : key)}
              aria-pressed={isSelected}
              aria-label={`${DAY_ABBR[d.getDay()]} ${d.getDate()}, ${count} event${count === 1 ? '' : 's'}`}
              className={`flex min-h-[64px] flex-col items-center justify-start rounded-xl px-1 pb-1.5 pt-2 transition-colors ${
                isSelected
                  ? 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill)'
                  : isPast
                    ? 'text-(--ev-ink-60)'
                    : 'text-(--ev-ink) hover:bg-(--ev-panel)'
              } ${isToday && !isSelected ? 'ring-1 ring-(--ev-accent-line-60)' : ''}`}
            >
              <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${isSelected ? 'text-(--ev-on-accent-fill-soft)' : isPast ? 'text-(--ev-ink-60)' : 'text-(--ev-ink-75)'}`}>
                {DAY_ABBR[d.getDay()]}
              </span>
              <span className="mt-0.5 text-[16px] font-bold leading-none">{d.getDate()}</span>
              <span className="mt-1.5 flex h-1.5 items-center gap-0.5">
                {dots.map((c, i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: isSelected ? onFill : c }}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      {selectedDay && (
        <button
          onClick={() => onSelectDay(null)}
          className="mt-2 w-full rounded-lg py-1.5 text-center text-[12px] font-semibold text-(--ev-accent) transition-colors hover:bg-(--ev-panel-faint)"
        >
          Show all upcoming
        </button>
      )}
    </div>
  )
}
