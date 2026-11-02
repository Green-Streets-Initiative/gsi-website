'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { VenueLive } from '@/app/api/venue-live/route'
import type { BikeDock } from '@/lib/venues'

/*
 * The live parts of a venue page, from one /api/venue-live call that
 * refreshes every 30 seconds while the tab is open: disruptions near the
 * top, the departures board and the Bluebikes docks. Each part renders
 * nothing (or its quiet fallback) until the data comes, so the page reads
 * fine without it.
 */

const Live = createContext<VenueLive | null | 'failed'>(null)

export function LiveProvider({ venue, children }: { venue: string; children: ReactNode }) {
  const [data, setData] = useState<VenueLive | null | 'failed'>(null)
  useEffect(() => {
    let cancelled = false
    const load = () => {
      if (document.visibilityState !== 'visible') return
      fetch(`/api/venue-live?venue=${encodeURIComponent(venue)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: VenueLive) => !cancelled && setData(d))
        .catch(() => !cancelled && setData((prev) => (prev && prev !== 'failed' ? prev : 'failed')))
    }
    load()
    const timer = setInterval(load, 30_000)
    document.addEventListener('visibilitychange', load)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', load)
    }
  }, [venue])
  return <Live.Provider value={data}>{children}</Live.Provider>
}

const LINE: Record<string, { name: string; color: string }> = {
  Orange: { name: 'Orange Line', color: '#ED8B00' },
  'Green-B': { name: 'Green Line B', color: '#00843D' },
  'Green-C': { name: 'Green Line C', color: '#00843D' },
  'Green-D': { name: 'Green Line D', color: '#00843D' },
  'Green-E': { name: 'Green Line E', color: '#00843D' },
  Red: { name: 'Red Line', color: '#DA291C' },
  Blue: { name: 'Blue Line', color: '#003DA5' },
}
const RAIL = '#80276C'
const railName = (route: string) =>
  route === 'CR-Newburyport' ? 'Newburyport/Rockport Line' : `${route.replace(/^CR-/, '').replace(/([a-z])([A-Z])/g, '$1 $2')} Line`

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })

/** Disruptions at the station on now or this week, MBTA's own words. */
export function LiveAlerts({ stop, stopName }: { stop: string; stopName: string }) {
  const data = useContext(Live)
  if (!data || data === 'failed' || data.alerts.length === 0) return null
  return (
    <ul className="mt-5 space-y-2" aria-label={`Service changes at ${stopName}`}>
      {data.alerts.map((a) => (
        <li key={a.header} className="flex gap-3 rounded-[14px] border-2 border-[#B54708]/40 bg-[#FFF6E5] px-4 py-3">
          <span aria-hidden="true" className="mt-0.5 text-[1.125rem] leading-none">⚠</span>
          <p className="text-[1rem] leading-[1.5] text-navy">
            <b>{a.now ? 'Now: ' : 'Coming up: '}</b>
            {a.header.split(/(?<=\.)\s/)[0]}{' '}
            <a href={`https://www.mbta.com/stops/${stop}`} target="_blank" rel="noopener noreferrer" className="font-bold text-forest underline underline-offset-4">
              Details
            </a>
          </p>
        </li>
      ))}
    </ul>
  )
}

function Stripe({ color }: { color: string }) {
  return <span aria-hidden="true" className="w-1.5 shrink-0 self-stretch rounded-full" style={{ background: color }} />
}

/** Next trains from the venue's station. */
export function LiveDepartures({ stop, stopName }: { stop: string; stopName: string }) {
  const data = useContext(Live)
  if (data === 'failed') {
    return (
      <p className="text-[1rem] leading-[1.55] text-navy">
        Live train times aren&rsquo;t loading right now.{' '}
        <a href={`https://www.mbta.com/stops/${stop}`} target="_blank" rel="noopener noreferrer" className="font-bold text-forest underline underline-offset-4">
          See them on mbta.com
        </a>
      </p>
    )
  }
  if (!data) return <div className="h-[260px] animate-pulse rounded-[16px] bg-navy/[0.04]" aria-label="Loading train times" />

  return (
    <div className="rounded-[16px] border border-navy/10 bg-white">
      <p className="flex items-center gap-2 border-b border-navy/10 px-4 py-3 text-[0.9375rem] font-bold text-navy">
        <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-forest" />
        Leaving {stopName} now
      </p>
      {data.subway.length === 0 && data.rail.length === 0 && (
        <p className="px-4 py-4 text-[1rem] text-navy">No trains in the next while. Service runs from about 5 AM to after midnight.</p>
      )}
      <ul className="divide-y divide-navy/10">
        {data.subway.map((r) => {
          const line = LINE[r.route] ?? { name: r.route, color: '#191A2E' }
          return (
            <li key={`${r.route}-${r.headsign}`} className="flex items-center gap-3 px-4 py-3">
              <Stripe color={line.color} />
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-bold leading-snug text-navy">{line.name}</span>
                <span className="block text-[0.9375rem] leading-snug text-navy/80">to {r.headsign}</span>
              </span>
              <span className="shrink-0 text-right text-[1.0625rem] font-bold tabular-nums text-navy">
                {r.mins.map((m) => (m <= 0 ? 'Now' : `${m} min`)).join(' · ')}
              </span>
            </li>
          )
        })}
        {data.rail.map((r) => (
          <li key={`${r.route}-${r.at}`} className="flex items-center gap-3 px-4 py-3">
            <Stripe color={RAIL} />
            <span className="min-w-0 flex-1">
              <span className="block text-[1rem] font-bold leading-snug text-navy">{railName(r.route)}</span>
              <span className="block text-[0.9375rem] leading-snug text-navy/80">to {r.headsign}</span>
            </span>
            <span className="shrink-0 text-right text-[1.0625rem] font-bold tabular-nums text-navy">{clock(r.at)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Bikes and open docks at the Bluebikes stations near the venue. */
export function LiveDocks({ docks }: { docks: BikeDock[] }) {
  const data = useContext(Live)
  const live = data && data !== 'failed' ? data.bikes : []
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {docks.map((d) => {
        const s = live.find((b) => b.ids[0] === d.ids[0])
        return (
          <li key={d.ids[0]} className="flex items-center gap-3 rounded-[12px] border border-navy/10 bg-white px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[1rem] font-bold leading-snug text-navy">{d.name}</span>
              <span className="block text-[0.9375rem] leading-snug text-navy/80">{d.walkMin} min walk</span>
            </span>
            {s && (
              <span className="flex shrink-0 gap-3 text-center">
                <span>
                  <span className="block text-[1.25rem] font-extrabold leading-none tabular-nums text-navy">{s.bikes}</span>
                  <span className="text-[0.875rem] text-navy/80">bikes</span>
                </span>
                <span>
                  <span className="block text-[1.25rem] font-extrabold leading-none tabular-nums text-navy">{s.docks}</span>
                  <span className="text-[0.875rem] text-navy/80">open docks</span>
                </span>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
