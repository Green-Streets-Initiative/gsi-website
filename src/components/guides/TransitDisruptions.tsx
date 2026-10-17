'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Warning } from '@phosphor-icons/react'
import ModeIcon from '@/components/commute/ModeIcon'
import { dayLabel, fetchDisruptions, type Disruption, type LineBadge } from '@/lib/nearby/disruptions'
import { lineColor, lineTextColor } from '@/lib/nearby/transit-ui'

/*
 * MBTA shuttles, suspensions and station closures happening now or starting
 * in the next 30 days, read live from the MBTA. Built to be scanned: a strip
 * of the affected lines (and the subway lines that are clear), then one row
 * per disruption led by the mode icon and line badge, the same badges Nearby
 * uses. On the T backup guide it lists subway and commuter rail; inside the
 * trip planner, only the lines the trip uses.
 */

const MAX_ROWS = 6
const SUBWAY: LineBadge[] = [
  { id: 'Red', name: 'Red Line', mode: 'subway' },
  { id: 'Orange', name: 'Orange Line', mode: 'subway' },
  { id: 'Blue', name: 'Blue Line', mode: 'subway' },
  { id: 'Green', name: 'Green Line', mode: 'subway' },
  { id: 'Mattapan', name: 'Mattapan Line', mode: 'subway' },
]

/** The MBTA ends a service day around 3 AM, so an end at 3 AM Monday means
 *  "through Sunday". Step back five hours before naming the last day. */
function lastDay(endIso: string): string {
  return dayLabel(new Date(new Date(endIso).getTime() - 5 * 3_600_000).toISOString())
}

function when(d: Disruption): string {
  if (d.status === 'now') return d.end ? `Now through ${lastDay(d.end)}` : 'Happening now'
  if (d.end) {
    const first = dayLabel(d.start)
    const last = lastDay(d.end)
    return first === last ? first : `${first} to ${last}`
  }
  return `Starts ${dayLabel(d.start)}`
}

function what(d: Disruption): string {
  const bus = d.lines.length > 0 && d.lines.every((l) => l.mode === 'bus')
  if (d.effect === 'SHUTTLE') return 'Shuttle buses replace trains'
  if (d.effect === 'SUSPENSION') return bus ? 'No buses' : 'No trains'
  return 'Station closed or skipped'
}

function modeIcon(lines: LineBadge[]): string {
  const m = lines[0]?.mode
  return m === 'commuter_rail' ? 'commuter_rail' : m === 'bus' ? 'bus' : 'transit'
}

function Badge({ line, muted = false }: { line: LineBadge; muted?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[0.75rem] font-bold ${muted ? 'border bg-white text-navy' : ''}`}
      style={muted ? { borderColor: lineColor(line.id) } : { backgroundColor: lineColor(line.id), color: lineTextColor(line.id) }}
    >
      {line.name}
    </span>
  )
}

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

  // The glance strip: subway first, then commuter rail, then bus; a Green
  // branch badge drops out when the whole Green Line is already listed.
  const seen: LineBadge[] = []
  for (const d of items ?? []) for (const l of d.lines) if (!seen.some((a) => a.id === l.id)) seen.push(l)
  const order = { subway: 0, commuter_rail: 1, bus: 2, ferry: 3 }
  const wholeGreen = seen.some((l) => l.id === 'Green')
  const affected = seen
    .filter((l) => !(wholeGreen && l.id.startsWith('Green-')))
    .sort((a, b) => order[a.mode] - order[b.mode])
  const affectedIds = new Set(affected.map((a) => (a.id.startsWith('Green') ? 'Green' : a.id)))
  const clear = SUBWAY.filter((l) => !affectedIds.has(l.id))
  const showSubwayClear = !compact && (routeTypes ?? []).some((t) => t === 0 || t === 1)

  return (
    <div
      id={compact ? undefined : 'closures'}
      className={compact ? 'rounded-[10px] border border-navy/10 bg-white px-4 py-3' : 'my-8 scroll-mt-24 rounded-[14px] border border-navy/15 bg-white p-5 sm:p-6'}
      aria-live="polite"
    >
      {compact ? (
        <h3 className="mb-2 text-[0.875rem] font-semibold text-forest">{heading}</h3>
      ) : (
        <h2 className="mb-3 font-serif text-[1.25rem] leading-tight text-navy">{heading}</h2>
      )}

      {items === null && <p className="text-[0.9375rem] text-ink-soft">Checking MBTA service changes…</p>}
      {items !== null && items.length === 0 && <p className="text-[0.9375rem] leading-relaxed text-ink-soft">{emptyText}</p>}

      {items !== null && items.length > 0 && !compact && (
        <div className="mb-4 grid gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Warning size={16} weight="fill" className="shrink-0 text-ep-warning-ink" aria-hidden />
            <span className="mr-1 text-[0.875rem] font-semibold text-navy">Changes on</span>
            {affected.map((l) => (
              <Badge key={l.id} line={l} />
            ))}
          </div>
          {showSubwayClear && clear.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <CheckCircle size={16} weight="fill" className="shrink-0 text-forest" aria-hidden />
              <span className="mr-1 text-[0.875rem] font-semibold text-navy">No closures on</span>
              {clear.map((l) => (
                <Badge key={l.id} line={l} muted />
              ))}
            </div>
          )}
        </div>
      )}

      {items !== null && items.length > 0 && (
        <ul className="grid gap-2.5">
          {items.slice(0, compact ? items.length : MAX_ROWS).map((d) => (
            <li key={d.id} className={`flex gap-3 ${compact ? '' : 'rounded-[10px] bg-cream px-3.5 py-3'}`}>
              <span className="mt-0.5 text-navy">
                <ModeIcon mode={modeIcon(d.lines)} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  {d.lines.map((l) => (
                    <Badge key={l.id} line={l} />
                  ))}
                  <span className={`text-[0.8125rem] font-semibold ${d.status === 'now' ? 'text-ep-warning-ink' : 'text-forest'}`}>
                    {when(d)}
                  </span>
                </span>
                <span className="mt-1 block text-[0.9375rem] font-semibold leading-snug text-navy">{what(d)}</span>
                <span className="mt-0.5 text-[0.875rem] leading-relaxed text-ink-soft line-clamp-2">{d.header}</span>
                {!compact && (
                  <a
                    href={d.url ?? 'https://www.mbta.com/alerts'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-[0.8125rem] font-semibold text-forest underline underline-offset-4 hover:opacity-80"
                  >
                    Details from the MBTA
                  </a>
                )}
              </span>
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
          Live from the MBTA: shuttles, suspensions and station closures, now and in the next 30 days.
        </p>
      )}
    </div>
  )
}
