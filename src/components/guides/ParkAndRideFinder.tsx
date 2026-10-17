'use client'

import { useState } from 'react'
import posthog from 'posthog-js'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { gaEvent } from '@/lib/ga'
import type { ParkAndRideLot } from '@/app/api/park-and-ride/route'

/*
 * "Park at the T": the MBTA station lots and garages nearest to where a drive
 * starts, with the MBTA's posted fee, spaces and typical weekday use, and a
 * link to plan the ride in from that station on the Nearby map.
 */

function track(event: string, props: Record<string, unknown>) {
  try {
    posthog.capture(event, props)
    gaEvent(event, props)
  } catch {
    // Analytics never blocks the tool.
  }
}

export default function ParkAndRideFinder({
  slug,
  placement,
  heading,
  intro,
}: {
  slug: string
  placement: string
  heading: string
  intro: string
}) {
  const [text, setText] = useState('')
  const [locating, setLocating] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'outside' | 'none'>('idle')
  const [lots, setLots] = useState<ParkAndRideLot[]>([])

  const search = (lat: number, lng: number) => {
    setStatus('loading')
    setLots([])
    fetch(`/api/park-and-ride?lat=${lat}&lng=${lng}`)
      .then(async (res) => {
        if (res.status === 400) return setStatus('outside')
        if (!res.ok) return setStatus('error')
        const data = (await res.json()) as { lots: ParkAndRideLot[] }
        setLots(data.lots)
        setStatus(data.lots.length ? 'done' : 'none')
        track('guide_tool_used', { tool: 'park_and_ride', slug, placement, results: data.lots.length })
      })
      .catch(() => setStatus('error'))
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        setText('Your location')
        search(pos.coords.latitude, pos.coords.longitude)
      },
      () => setLocating(false),
      { timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <div id="station-parking" className="my-8 scroll-mt-24 rounded-[14px] border border-navy/15 bg-white p-5 sm:p-6">
      <p className="mb-1 text-[1.0625rem] font-semibold leading-snug text-navy">{heading}</p>
      <p className="mb-4 text-[0.9375rem] leading-relaxed text-ink-soft">{intro}</p>

      <AddressAutocomplete
            includeAreas
        value={text}
        onChange={setText}
        onPlaceSelected={(p) => search(p.lat, p.lng)}
        label="Where does your drive start?"
        placeholder="Your home address or town"
      />
      <button
        type="button"
        onClick={useMyLocation}
        className="mt-2 text-[0.875rem] font-semibold text-forest underline underline-offset-4 hover:opacity-80"
      >
        {locating ? 'Finding you…' : 'Use my location'}
      </button>

      <div aria-live="polite" className="mt-4">
        {status === 'loading' && <p className="text-[0.9375rem] text-ink-soft">Finding station parking…</p>}
        {status === 'outside' && (
          <p className="text-[0.9375rem] text-ink-soft">That address is outside the area we cover. Try one in Massachusetts.</p>
        )}
        {status === 'none' && (
          <p className="text-[0.9375rem] text-ink-soft">
            There&apos;s no MBTA station parking within 25 miles of that address. Many regional bus systems run their own
            park-and-ride lots; check your local transit agency.
          </p>
        )}
        {status === 'error' && (
          <p className="text-[0.9375rem] text-ink-soft">
            We couldn&apos;t load station parking right now. The MBTA lists every lot on its{' '}
            <a href="https://www.mbta.com/parking/stations-and-rates" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest underline underline-offset-4">
              parking page
            </a>
            .
          </p>
        )}
        {status === 'done' && (
          <>
            <ul className="grid gap-3">
              {lots.map((l) => (
                <li key={l.id} className="rounded-[10px] bg-cream px-4 py-3">
                  <p className="text-[1rem] font-semibold leading-snug text-navy">
                    {l.station}
                    <span className="font-normal text-ink-soft"> · {l.miles} mi away</span>
                  </p>
                  {l.lines.length > 0 && <p className="text-[0.875rem] text-ink-soft">{l.lines.join(', ')}</p>}
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-navy">
                    {[
                      l.dailyFee,
                      l.spaces ? `${l.spaces.toLocaleString('en-US')} spaces` : null,
                      l.weekdayUsePct
                        ? l.weekdayUsePct >= 90
                          ? 'usually fills up on weekdays'
                          : `usually ${l.weekdayUsePct}% full on weekdays`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <a
                    href={`/nearby?${new URLSearchParams({ lat: l.lat.toFixed(3), lng: l.lng.toFixed(3), label: l.station, plan: '1' })}`}
                    onClick={() => track('guide_tool_open_map', { tool: 'park_and_ride', slug, placement })}
                    className="mt-1 inline-block text-[0.875rem] font-semibold text-forest underline underline-offset-4 hover:opacity-80"
                  >
                    Plan the ride in from {l.station}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-soft">
              Rates and spaces are the MBTA&apos;s own listing. Most lots are paid by phone.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
