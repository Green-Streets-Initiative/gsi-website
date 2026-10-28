'use client'

/**
 * "Trains home that take bikes" for a roam that ends near a commuter rail stop
 * (roams.rail_home_*, Shift migration 01214). Fetched in the browser from the
 * Shift rail-bike-trains edge function so the times are live even though the
 * roam page itself is cached for an hour. Renders nothing until it has an
 * answer, and nothing at all if the MBTA can't be reached.
 */

import { useEffect, useState } from 'react'
import { Train, TriangleAlert, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Answer {
  stop_name: string
  route_id: string
  trains: { departs_at: string; train: string; to?: string }[]
  day: 'today' | 'later'
  day_date: string | null
  none_today: boolean
  notice: string | null
}

function clock(iso: string): string {
  // Schedule times arrive in Eastern time with an offset; read them as written.
  const [h, m] = iso.slice(11, 16).split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}

function weekday(date: string): string {
  return new Date(`${date}T12:00:00-05:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York',
  })
}

/** `headed={false}` drops the small title, for a page that gives the box its own heading (trail pages). */
export default function TrainsHome({ stopId, routeId, directionId, headed = true }: { stopId: string; routeId: string; directionId: 0 | 1; headed?: boolean }) {
  const [answer, setAnswer] = useState<Answer | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.functions
      .invoke('rail-bike-trains', { body: { stop_id: stopId, route_id: routeId, direction_id: directionId } })
      .then(({ data, error }) => {
        if (cancelled || error || !data || !Array.isArray(data.trains)) return
        setAnswer(data as Answer)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [stopId, routeId, directionId])

  if (!answer) return null

  // Name the destination ("to North Station") so riders know these head home.
  const to = answer.trains[0]?.to ? ` to ${answer.trains[0].to}` : ''
  const lead =
    answer.trains.length === 0
      ? `No trains from ${answer.stop_name} take bikes in the next few days.`
      : answer.day === 'today'
        ? `Next trains from ${answer.stop_name}${to} that take bikes:`
        : `No trains from ${answer.stop_name}${to} take bikes for the rest of today. The next ones that do:`
  // The service date sits right above the times, so readers can see the list is fresh.
  const dateLine =
    answer.trains.length > 0 && answer.day_date
      ? answer.day === 'today' ? `Today, ${weekday(answer.day_date)}` : weekday(answer.day_date)
      : null

  return (
    <section aria-labelledby={headed ? 'trains-home' : undefined} aria-label={headed ? undefined : 'Trains home that take bikes'} className={`${headed ? 'mb-5' : ''} rounded-[14px] border border-navy/10 bg-white px-5 py-4`}>
      {headed && (
        <h2 id="trains-home" className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-forest">
          Trains home that take bikes
        </h2>
      )}
      <p className={`${headed ? 'mt-2' : ''} text-[0.9375rem] leading-relaxed text-navy`}>{lead}</p>
      {dateLine && <p className="mt-2 text-[0.875rem] font-semibold text-ink-soft">{dateLine}</p>}
      {answer.trains.length > 0 && (
        <ul className="mt-1 divide-y divide-navy/10">
          {answer.trains.map((t) => (
            <li key={`${t.departs_at}-${t.train}`} className="flex items-center gap-3 py-2">
              <Train size={16} className="shrink-0 text-forest" aria-hidden />
              <span className="min-w-[5rem] text-[0.9375rem] font-semibold tabular-nums text-navy">{clock(t.departs_at)}</span>
              {t.train && <span className="text-[0.875rem] text-ink-soft">Train {t.train}</span>}
            </li>
          ))}
        </ul>
      )}
      {answer.notice && (
        <p className="mt-3 flex gap-2 rounded-[10px] bg-[#EDB93C]/15 px-3 py-2 text-[0.875rem] leading-relaxed text-navy">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-[#8A6D1F]" aria-hidden />
          <span>{answer.notice}</span>
        </p>
      )}
      <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-soft">
        From the MBTA schedule. On a crowded train, the conductor can still say no to bikes.{' '}
        <a
          href={`https://www.mbta.com/schedules/${encodeURIComponent(answer.route_id)}/timetable`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-forest underline-offset-4 hover:underline"
        >
          Full schedule <ArrowRight size={13} aria-hidden />
        </a>
      </p>
    </section>
  )
}
