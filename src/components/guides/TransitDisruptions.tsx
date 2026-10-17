'use client'

import { useEffect, useState } from 'react'
import { dayLabel, fetchDisruptions, type Disruption } from '@/lib/nearby/disruptions'

/*
 * MBTA shuttles, suspensions and station closures happening now or starting
 * in the next 30 days, read live from the MBTA. On the T backup guide it lists
 * subway and commuter rail; inside the trip planner it lists only the lines
 * the trip uses.
 */

/** The MBTA ends a service day around 3 AM, so an end at 3 AM Monday means
 *  "through Sunday". Step back five hours before naming the last day. */
function lastDay(endIso: string): string {
  return dayLabel(new Date(new Date(endIso).getTime() - 5 * 3_600_000).toISOString())
}

function when(d: Disruption): string {
  if (d.status === 'now') return d.end ? `Now, through ${lastDay(d.end)}` : 'Happening now'
  return `Starts ${dayLabel(d.start)}`
}

const MAX_ROWS = 6

export default function TransitDisruptions({
  routeIds,
  routeTypes,
  heading,
  emptyText,
  compact = false,
}: {
  routeIds?: string[]
  routeTypes?: number[]
  heading: string
  emptyText: string
  compact?: boolean
}) {
  const [items, setItems] = useState<Disruption[] | null>(null)
  const key = `${(routeIds ?? []).join(',')}|${(routeTypes ?? []).join(',')}`

  useEffect(() => {
    let cancelled = false
    fetchDisruptions({ routeIds, routeTypes }).then((d) => {
      if (!cancelled) setItems(d)
    })
    return () => {
      cancelled = true
    }
    // key captures both lists
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const shell = compact
    ? 'mt-3 rounded-[10px] border border-navy/10 bg-white px-4 py-3'
    : 'my-8 rounded-[14px] border border-navy/15 bg-white p-5 sm:p-6'

  return (
    <div className={shell} aria-live="polite">
      <p className={compact ? 'text-[0.8125rem] font-semibold text-forest' : 'mb-3 text-[1.0625rem] font-semibold leading-snug text-navy'}>
        {heading}
      </p>
      {items === null && <p className="text-[0.9375rem] text-ink-soft">Checking MBTA service changes…</p>}
      {items !== null && items.length === 0 && <p className="text-[0.9375rem] leading-relaxed text-ink-soft">{emptyText}</p>}
      {items !== null && items.length > 0 && (
        <ul className="grid gap-3">
          {items.slice(0, compact ? items.length : MAX_ROWS).map((d) => (
            <li key={d.id} className={compact ? '' : 'rounded-[10px] bg-cream px-4 py-3'}>
              <p
                className={
                  d.status === 'now'
                    ? 'text-[0.8125rem] font-semibold text-ep-warning-ink'
                    : 'text-[0.8125rem] font-semibold text-forest'
                }
              >
                {when(d)}
              </p>
              <p className="text-[0.9375rem] leading-relaxed text-navy">{d.header}</p>
              {d.url && !compact && (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.875rem] font-semibold text-forest underline underline-offset-4 hover:opacity-80"
                >
                  Details from the MBTA
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {!compact && items !== null && items.length > MAX_ROWS && (
        <p className="mt-3 text-[0.9375rem] text-navy">
          And {items.length - MAX_ROWS} more on the{' '}
          <a href="https://www.mbta.com/alerts" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest underline underline-offset-4">
            MBTA&apos;s alerts page
          </a>
          .
        </p>
      )}
      {!compact && (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-soft">
          Live from the MBTA. Shuttles, suspensions and station closures, now and in the next 30 days. See{' '}
          <a href="https://www.mbta.com/alerts" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest underline underline-offset-4">
            all MBTA alerts
          </a>
          .
        </p>
      )}
    </div>
  )
}
