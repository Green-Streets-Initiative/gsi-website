'use client'

import { useState, useEffect } from 'react'

interface CountdownTimerProps {
  targetDate: string
  /**
   * Staging only: an ISO instant to treat as "now" at mount, so the preview
   * routes can show a countdown for a date that has already passed. The
   * timer still ticks in real time from there.
   */
  fakeNow?: string
}

/** Serif numerals on cream; used on the Shift Your Summer page while a challenge is upcoming. */
export default function CountdownTimer({ targetDate, fakeNow }: CountdownTimerProps) {
  const [offsetMs] = useState(() => (fakeNow ? new Date(fakeNow).getTime() - Date.now() : 0))
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate, offsetMs))

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(getTimeLeft(targetDate, offsetMs))
    }, 1000)
    return () => clearInterval(id)
  }, [targetDate, offsetMs])

  if (timeLeft.total <= 0) {
    return <p className="font-serif text-[1.375rem] text-green-deep">The challenge has started.</p>
  }

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2 sm:gap-x-6">
      <span className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-forest">Starts in</span>
      <Unit value={timeLeft.days} label="days" />
      <Unit value={timeLeft.hours} label="hours" />
      <Unit value={timeLeft.minutes} label="min" />
      <Unit value={timeLeft.seconds} label="sec" />
    </div>
  )
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-start">
      <span className="font-serif text-[2.5rem] leading-none tabular-nums text-navy sm:text-[3rem]">{String(value).padStart(2, '0')}</span>
      <span className="mt-1.5 text-[12px] text-ink-soft">{label}</span>
    </div>
  )
}

function getTimeLeft(targetDate: string, offsetMs = 0) {
  const diff = new Date(targetDate).getTime() - (Date.now() + offsetMs)
  if (diff <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }
  return {
    total: diff,
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}
