'use client'

import { useState, useEffect } from 'react'

interface CountdownTimerProps {
  targetDate: string
}

export default function CountdownTimer({ targetDate }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate))

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(getTimeLeft(targetDate))
    }, 1000)
    return () => clearInterval(id)
  }, [targetDate])

  if (timeLeft.total <= 0) {
    return (
      <p className="font-display text-lg font-bold text-[#BAF14D]">
        The challenge has started!
      </p>
    )
  }

  return (
    <div className="flex items-center gap-3 sm:gap-5">
      <span className="text-sm font-semibold uppercase tracking-wider text-white/40">
        Starts in
      </span>
      <Unit value={timeLeft.days} label="days" />
      <Separator />
      <Unit value={timeLeft.hours} label="hrs" />
      <Separator />
      <Unit value={timeLeft.minutes} label="min" />
      <Separator />
      <Unit value={timeLeft.seconds} label="sec" />
    </div>
  )
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-display text-3xl font-extrabold tabular-nums text-[#BAF14D] sm:text-4xl">
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-white/50">
        {label}
      </span>
    </div>
  )
}

function Separator() {
  return (
    <span className="mb-3 text-xl font-bold text-white/20">:</span>
  )
}

function getTimeLeft(targetDate: string) {
  const diff = new Date(targetDate).getTime() - Date.now()
  if (diff <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }
  return {
    total: diff,
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}
