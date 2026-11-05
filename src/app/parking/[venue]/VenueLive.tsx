'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { VenueLive } from '@/app/api/venue-live/route'
import type { BikeDock, ShuttleStation } from '@/lib/venues'

/*
 * The live parts of a venue page, from one /api/venue-live call that
 * refreshes every 30 seconds while the tab is open: disruptions near the
 * top, the departures board and the Bluebikes docks. Each part renders
 * nothing (or its quiet fallback) until the data comes, so the page reads
 * fine without it.
 */

const Live = createContext<VenueLive | null | 'failed'>(null)
/** The station whose trains are showing, and a way to pick another (White Stadium's shuttle stations). */
const Station = createContext<{ stop: string | null; pick: (stop: string) => void }>({ stop: null, pick: () => {} })

export function LiveProvider({ venue, children }: { venue: string; children: ReactNode }) {
  const [data, setData] = useState<VenueLive | null | 'failed'>(null)
  const [stop, pick] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const load = () => {
      if (document.visibilityState !== 'visible') return
      fetch(`/api/venue-live?venue=${encodeURIComponent(venue)}${stop ? `&stop=${encodeURIComponent(stop)}` : ''}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: VenueLive) => !cancelled && setData(d))
        // Keep the last good answer through a blip, unless it's for another station.
        .catch(() => !cancelled && setData((prev) => (prev && prev !== 'failed' && (!stop || prev.stop === stop) ? prev : 'failed')))
    }
    load()
    const timer = setInterval(load, 30_000)
    document.addEventListener('visibilitychange', load)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', load)
    }
  }, [venue, stop])
  return (
    <Station.Provider value={{ stop, pick }}>
      <Live.Provider value={data}>{children}</Live.Provider>
    </Station.Provider>
  )
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

// MBTA headers abbreviate months and streets ("Heath St (E), Nov. 7-8"), so
// a period after one of those doesn't end the sentence.
const firstSentence = (s: string) =>
  s.split(/(?<!\b(?:Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|St|Ave|Sq|Mt|approx)\.)(?<=\.)\s/)[0]

/** In the hero: one line saying the station has a service change, jumping to the details. */
export function LiveAlertChip({ stopName, names }: { stopName: string; names?: Record<string, string> }) {
  const data = useContext(Live)
  if (!data || data === 'failed' || data.alerts.length === 0) return null
  // With shuttle stations to pick from, the alerts are for whichever is showing.
  stopName = names?.[data.stop] ?? stopName
  const now = data.alerts.some((a) => a.now)
  return (
    <a
      href="#transit"
      className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 border-[#B54708]/40 bg-[#FFF6E5] px-4 text-[0.9375rem] font-bold text-navy hover:border-[#B54708]"
    >
      <span aria-hidden="true">⚠</span>
      {now ? `Service change at ${stopName} now` : `Service change at ${stopName} this week`}
    </a>
  )
}

/** Disruptions at the station on now or this week, MBTA's own words. */
export function LiveAlerts({ stop, stopName, names }: { stop: string; stopName: string; names?: Record<string, string> }) {
  const data = useContext(Live)
  if (!data || data === 'failed' || data.alerts.length === 0) return null
  if (names?.[data.stop]) {
    stop = data.stop
    stopName = names[data.stop]
  }
  return (
    <ul className="mt-5 space-y-2" aria-label={`Service changes at ${stopName}`}>
      {data.alerts.map((a) => (
        <li key={a.header} className="flex gap-3 rounded-[14px] border-2 border-[#B54708]/40 bg-[#FFF6E5] px-4 py-3">
          <span aria-hidden="true" className="mt-0.5 text-[1.125rem] leading-none">⚠</span>
          <p className="text-[1rem] leading-[1.5] text-navy">
            <b>{a.now ? 'Now: ' : 'Coming up: '}</b>
            {firstSentence(a.header)}{' '}
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
  if (!data || data.stop !== stop) return <div className="h-[260px] animate-pulse rounded-[16px] bg-navy/[0.04]" aria-label="Loading train times" />

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

/** Live trains at each shuttle station, one at a time, picked by tab. */
export function StationBoards({ stations }: { stations: ShuttleStation[] }) {
  const { stop, pick } = useContext(Station)
  const current = stations.find((s) => s.stop === stop) ?? stations[0]
  return (
    <div>
      <div role="tablist" aria-label="Station" className="mb-3 flex flex-wrap gap-2">
        {stations.map((s) => {
          const on = s.stop === current.stop
          return (
            <button
              key={s.stop}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => pick(s.stop)}
              className={`min-h-[44px] rounded-full border-2 px-4 text-[0.9375rem] font-bold transition-colors ${
                on ? 'border-navy bg-navy text-white' : 'border-navy/20 bg-white text-navy hover:border-forest'
              }`}
            >
              {s.name}
            </button>
          )
        })}
      </div>
      <div role="tabpanel">
        <LiveDepartures stop={current.stop} stopName={current.name} />
      </div>
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
