'use client'

import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type CommunityEvent, getTypeMeta, dateKey, parseEventDate } from '@/lib/events'

interface CalendarGridProps {
  events: CommunityEvent[]
  year: number
  monthIndex: number
  selectedDay: string | null
  onPrevMonth: () => void
  onNextMonth: () => void
  onSelectDay: (day: string) => void
  onSelectEvent: (id: string) => void
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface DayCell {
  key: string
  date: number
  inMonth: boolean
  isToday: boolean
  events: CommunityEvent[]
}

export default function CalendarGrid({
  events, year, monthIndex, selectedDay,
  onPrevMonth, onNextMonth, onSelectDay, onSelectEvent,
}: CalendarGridProps) {
  const todayStr = dateKey(new Date())

  const { weeks, eventsByDay } = useMemo(() => {
    const byDay: Record<string, CommunityEvent[]> = {}
    for (const ev of events) {
      const k = ev.event_date
      if (!byDay[k]) byDay[k] = []
      byDay[k].push(ev)
    }
    for (const k of Object.keys(byDay)) {
      byDay[k].sort((a, b) => (a.event_time ?? '').localeCompare(b.event_time ?? ''))
    }

    const first = new Date(year, monthIndex, 1)
    const startOffset = first.getDay()
    const gridStart = new Date(year, monthIndex, 1 - startOffset)

    const rows: DayCell[][] = []
    for (let w = 0; w < 6; w++) {
      const row: DayCell[] = []
      for (let di = 0; di < 7; di++) {
        const cur = new Date(gridStart)
        cur.setDate(gridStart.getDate() + w * 7 + di)
        const k = dateKey(cur)
        row.push({
          key: k,
          date: cur.getDate(),
          inMonth: cur.getMonth() === monthIndex,
          isToday: k === todayStr,
          events: byDay[k] ?? [],
        })
      }
      rows.push(row)
      const lastInRow = new Date(gridStart)
      lastInRow.setDate(gridStart.getDate() + w * 7 + 6)
      if (lastInRow.getMonth() !== monthIndex && lastInRow > first && w >= 4) break
    }

    return { weeks: rows, eventsByDay: byDay }
  }, [events, year, monthIndex, todayStr])

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-card p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-white">
          {MONTHS[monthIndex]} {year}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onPrevMonth}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-white/[0.14] text-white/70 transition-colors hover:bg-white/[0.06]"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={onNextMonth}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-white/[0.14] text-white/70 transition-colors hover:bg-white/[0.06]"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.map((row) =>
          row.map((cell) => {
            const isSelected = selectedDay === cell.key
            return (
              <button
                key={cell.key}
                onClick={() => onSelectDay(cell.key)}
                className={`
                  min-h-[92px] rounded-[10px] p-[7px] text-left transition-colors
                  ${cell.inMonth ? 'bg-[#1F2034]' : 'bg-white/[0.015]'}
                  ${isSelected ? 'ring-1 ring-lime/60 bg-lime/[0.06]' : ''}
                  hover:bg-white/[0.06]
                `}
              >
                {/* Day number */}
                <div className="mb-1">
                  {cell.isToday ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-lime text-[12px] font-bold text-navy">
                      {cell.date}
                    </span>
                  ) : (
                    <span className={`text-[12px] font-medium ${cell.inMonth ? 'text-white/80' : 'text-white/[0.62]'}`}>
                      {cell.date}
                    </span>
                  )}
                </div>

                {/* Event chips (max 2) */}
                <div className="flex min-w-0 flex-col gap-0.5 overflow-hidden">
                  {cell.events.slice(0, 2).map((ev) => {
                    const meta = getTypeMeta(ev.event_type)
                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => { e.stopPropagation(); onSelectEvent(ev.id) }}
                        className="flex min-w-0 cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight text-white/90 transition-opacity hover:opacity-80"
                        style={{ backgroundColor: meta.color + '33' }}
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className="truncate">{ev.title}</span>
                      </div>
                    )
                  })}
                  {cell.events.length > 2 && (
                    <span className="pl-1 text-[10px] text-white/50">
                      +{cell.events.length - 2} more
                    </span>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
