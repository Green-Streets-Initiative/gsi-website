'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  type CommunityEvent, dateKey, parseEventDate, todayKey, dateMedium,
  eventDotsByDay, eventCountByDay,
} from '@/lib/events'

/**
 * Desktop date navigator: a compact month with event dots. Picking a day
 * filters the agenda beside it to that day; picking it again clears. Never
 * scrolls the page. Keyboard: arrows move a day/week, PageUp/PageDown a
 * month, Enter or Space toggles.
 */

interface MiniMonthProps {
  events: CommunityEvent[]
  selectedDay: string | null
  onSelectDay: (key: string | null) => void
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function MiniMonth({ events, selectedDay, onSelectDay }: MiniMonthProps) {
  const today = todayKey()
  const [ym, setYm] = useState(() => {
    const d = selectedDay ? parseEventDate(selectedDay) : new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<string | null>(null)

  // Follow the selection when it lands in another month.
  useEffect(() => {
    if (!selectedDay) return
    const d = parseEventDate(selectedDay)
    setYm((prev) => (prev.y === d.getFullYear() && prev.m === d.getMonth() ? prev : { y: d.getFullYear(), m: d.getMonth() }))
  }, [selectedDay])

  // Move DOM focus after a keyboard navigation has re-rendered the grid.
  useEffect(() => {
    if (!pendingFocus.current) return
    const el = gridRef.current?.querySelector<HTMLButtonElement>(`[data-key="${pendingFocus.current}"]`)
    el?.focus()
    pendingFocus.current = null
  })

  const dots = useMemo(() => eventDotsByDay(events), [events])
  const counts = useMemo(() => eventCountByDay(events), [events])

  const cells = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1)
    const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate()
    const arr: (Date | null)[] = []
    for (let i = 0; i < first.getDay(); i++) arr.push(null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(ym.y, ym.m, d))
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [ym])

  const monthPrefix = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`
  const inMonth = (k: string | null) => !!k && k.startsWith(monthPrefix)
  // One cell carries tabIndex 0: the focused day, else the selection, else today, else the first day that is not past.
  const tabKey =
    (inMonth(focusKey) && focusKey) ||
    (inMonth(selectedDay) && selectedDay) ||
    (inMonth(today) && today) ||
    cells.map((d) => (d ? dateKey(d) : null)).find((k) => k && k >= today) ||
    null

  const shiftMonth = (delta: number) => {
    setYm((prev) => {
      const d = new Date(prev.y, prev.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  const moveFocus = (from: string, days: number, months = 0) => {
    const d = parseEventDate(from)
    if (months) d.setMonth(d.getMonth() + months)
    else d.setDate(d.getDate() + days)
    const k = dateKey(d)
    setFocusKey(k)
    pendingFocus.current = k
    setYm({ y: d.getFullYear(), m: d.getMonth() })
  }

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, key: string) => {
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [-7, 0], ArrowDown: [7, 0],
      PageUp: [0, -1], PageDown: [0, 1],
    }
    const move = map[e.key]
    if (!move) return
    e.preventDefault()
    moveFocus(key, move[0], move[1])
  }

  const goToday = () => {
    const d = new Date()
    setYm({ y: d.getFullYear(), m: d.getMonth() })
    setFocusKey(today)
    pendingFocus.current = today
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-[15px] font-bold text-white">{MONTHS[ym.m]} {ym.y}</span>
        <div className="flex items-center gap-1">
          {!inMonth(today) && (
            <button
              onClick={goToday}
              className="mr-1 rounded-full border border-white/[0.14] px-2.5 py-0.5 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/[0.06]"
            >
              Today
            </button>
          )}
          <button
            onClick={() => shiftMonth(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.14] text-white/80 transition-colors hover:bg-white/[0.06]"
            aria-label="Previous month"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => shiftMonth(1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.14] text-white/80 transition-colors hover:bg-white/[0.06]"
            aria-label="Next month"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {DAY_LETTERS.map((l, i) => (
          <div key={i} className="py-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-white/70">{l}</div>
        ))}
      </div>

      <div ref={gridRef} role="grid" aria-label="Pick a day" className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} aria-hidden />
          const key = dateKey(d)
          const isSelected = selectedDay === key
          const isToday = key === today
          const isPast = key < today
          const count = counts.get(key) ?? 0
          const dayDots = dots.get(key) ?? []
          return (
            <button
              key={key}
              data-key={key}
              role="gridcell"
              tabIndex={tabKey === key ? 0 : -1}
              aria-pressed={isSelected}
              aria-disabled={isPast || undefined}
              aria-label={`${dateMedium(d)}, ${count} event${count === 1 ? '' : 's'}`}
              onClick={() => { if (!isPast) onSelectDay(isSelected ? null : key) }}
              onKeyDown={(e) => onKey(e, key)}
              onFocus={() => setFocusKey(key)}
              className={`flex h-9 flex-col items-center justify-center rounded-lg text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/70 ${
                isSelected
                  ? 'bg-lime text-navy'
                  : isPast
                    ? 'cursor-default text-white/60'
                    : 'text-white hover:bg-white/[0.06]'
              } ${isToday && !isSelected ? 'ring-1 ring-lime/70' : ''}`}
            >
              <span className="leading-none">{d.getDate()}</span>
              <span className="mt-1 flex h-1 items-center gap-0.5">
                {dayDots.map((c, j) => (
                  <span key={j} className="h-1 w-1 rounded-full" style={{ backgroundColor: isSelected ? '#191A2E' : c }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      {selectedDay ? (
        <button
          onClick={() => onSelectDay(null)}
          className="mt-3 w-full rounded-lg py-1.5 text-center text-[12px] font-semibold text-lime transition-colors hover:bg-white/[0.04]"
        >
          Showing {dateMedium(parseEventDate(selectedDay))} · Show all
        </button>
      ) : (
        <p className="mt-3 text-center text-[12px] text-white/75">Pick a day to see only that day.</p>
      )}
    </div>
  )
}
