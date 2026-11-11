'use client'

import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { riderStatus, type RideRiderStatus, type RiderStatusRow } from '@/lib/organizers/api'
import { cx } from './ui'

/**
 * Ride day, inside the Next ride cards (the dashboard's Next up and the
 * ride page's Next ride), the same as the app's RideDayCounts (Shift
 * components/RideRiderStatusCard.tsx, Keith 2026-11-07: "Not sure we need
 * separate sections"). From 30 minutes before the start to 15 after, the
 * card's numbers become here / on the way / going, and the riders who said
 * Going list under them with where each one is. The rest of the time, and
 * whenever the status can't be read, the card keeps its usual numbers.
 */

const POLL_MS = 20_000

/** The rider window on this computer's clock, with a couple of minutes of slack; the server decides what it shows. */
export function rideWindowOpen(date: string, startTime: string, now = new Date()): boolean {
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (date !== key) return false
  const [h, m] = startTime.split(':').map(Number)
  const start = (h || 0) * 60 + (m || 0)
  const mins = now.getHours() * 60 + now.getMinutes()
  return mins >= start - 32 && mins <= start + 17
}

/** True while it's ride time for a date; re-checks the clock each minute. */
export function useRideTime(date: string | null, startTime: string | null): boolean {
  const [tick, setTick] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  return !!date && !!startTime && rideWindowOpen(date, startTime, new Date(tick))
}

/** Re-read every 20 s while the tab is visible; no reads when it isn't ride time (null). */
function useRiderStatus(occurrenceId: string | null): RideRiderStatus | null {
  // Kept with the date it was read for, so a different date never shows another's riders.
  const [read, setRead] = useState<{ id: string; status: RideRiderStatus | null } | null>(null)
  useEffect(() => {
    if (!occurrenceId) return
    let live = true
    let timer: ReturnType<typeof setInterval> | null = null
    const poll = () => { void riderStatus(occurrenceId).then((s) => { if (live) setRead({ id: occurrenceId, status: s }) }) }
    const start = () => { if (timer) clearInterval(timer); timer = setInterval(poll, POLL_MS) }
    const onVis = () => {
      if (document.visibilityState === 'visible') { poll(); start() } else if (timer) { clearInterval(timer); timer = null }
    }
    poll(); start()
    document.addEventListener('visibilitychange', onVis)
    return () => { live = false; if (timer) clearInterval(timer); document.removeEventListener('visibilitychange', onVis) }
  }, [occurrenceId])
  return occurrenceId && read?.id === occurrenceId ? read.status : null
}

export interface RideDay {
  /** Here, on the way, going: the card's numbers in the window. */
  tiles: { label: string; n: number; lead: boolean }[]
  riders: RiderStatusRow[]
}

/**
 * What a Next ride card shows on ride day: the numbers and the riders in the
 * window, `'no_meetup'` when the ride has no pin to measure from, or null
 * (keep the usual numbers).
 */
export function useRideDay(occurrenceId: string | null, on: boolean): RideDay | 'no_meetup' | null {
  const status = useRiderStatus(on ? occurrenceId : null)
  if (!on || !status) return null
  if (!status.available) return status.reason === 'no_meetup' ? 'no_meetup' : null
  if (!status.window_open) return null
  return {
    tiles: [
      { label: 'Here', n: status.here ?? 0, lead: true },
      { label: 'On the way', n: status.on_the_way ?? 0, lead: false },
      { label: 'Going', n: status.expected ?? 0, lead: false },
    ],
    riders: status.riders ?? [],
  }
}

function Chip({ row, dark }: { row: RiderStatusRow; dark?: boolean }) {
  const base = 'shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-bold'
  if (row.status === 'here') {
    return <span className={cx(base, dark ? 'bg-[#BAF14D] text-[#191A2E]' : 'bg-(--ev-ink) text-white')}>Here</span>
  }
  if (row.status === 'away') {
    return <span className={cx(base, dark ? 'bg-[#5FD4BD]/20 text-[#8FE6D4]' : 'bg-[#E3F4EF] text-[#1B6151]')}>{(row.distance_mi ?? 0).toFixed(1)} mi away</span>
  }
  return (
    <span className={cx(base, 'font-semibold', dark ? 'bg-white/10 text-white/80' : 'bg-(--ev-panel) text-(--ev-ink-80)')}>
      {row.status === 'unknown' ? 'Unknown' : 'Not sharing'}
    </span>
  )
}

/** The riders who said Going, each with where they are. */
export function RideDayRiders({ riders, dark }: { riders: RiderStatusRow[]; dark?: boolean }) {
  if (riders.length === 0) return null
  return (
    <ul className={cx('divide-y border-t', dark ? 'divide-white/10 border-white/10' : 'divide-(--ev-line) border-(--ev-line)')}>
      {riders.map((r) => (
        <li key={r.member_id} className="flex items-center gap-3 py-2">
          {r.avatar_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={r.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            : <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full text-[14px] font-bold',
                dark ? 'bg-[#BAF14D]/15 text-[#BAF14D]' : 'bg-(--ev-accent-tint-15) text-(--ev-accent-90)')} aria-hidden>
                {(r.display_name || '?').trim().charAt(0).toUpperCase()}
              </span>}
          <span className={cx('min-w-0 flex-1 truncate text-[15px] font-semibold', dark ? 'text-white' : 'text-(--ev-ink)')}>
            {r.display_name}
            {/* Joining along the way: here/away is measured to their stop (Shift 01744). */}
            {r.stop && <span className={cx('font-normal', dark ? 'text-white/75' : 'text-(--ev-ink-75)')}> · at {r.stop}</span>}
          </span>
          <Chip row={r} dark={dark} />
        </li>
      ))}
    </ul>
  )
}

/** "Add a meetup pin": without one, nobody's distance can be measured. */
export function NoMeetupHint({ dark }: { dark?: boolean }) {
  return (
    <p className={cx('flex items-center gap-2 text-[14px]', dark ? 'text-white/80' : 'text-(--ev-ink-80)')}>
      <MapPin className="h-4 w-4 shrink-0" aria-hidden />Add a meetup pin to see who&rsquo;s here on ride day.
    </p>
  )
}
