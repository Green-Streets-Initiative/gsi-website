'use client'

import { useState } from 'react'
import posthog from 'posthog-js'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { gaEvent } from '@/lib/ga'
import type { ParkAndRideLot } from '@/app/api/park-and-ride/route'
import { gt, lineLabel, type GuideLocale } from '@/lib/guides/i18n'

/*
 * "Park at the T": the MBTA station lots and garages nearest to where a drive
 * starts, with the MBTA's posted fee, spaces and typical weekday use, and a
 * link to plan the ride in from that station on the Nearby map.
 */

/** The MBTA fee comes back as "$4 on weekdays, $2 on weekends". */
function feeLabel(fee: string, L: GuideLocale): string {
  if (L === 'pt-BR') return fee.replace(/ on weekdays/g, ' nos dias úteis').replace(/ on weekends/g, ' nos fins de semana')
  if (L !== 'es') return fee
  return fee.replace(/ on weekdays/g, ' entre semana').replace(/ on weekends/g, ' los fines de semana')
}

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
  locale: L = 'en',
}: {
  slug: string
  placement: string
  heading: string
  intro: string
  locale?: GuideLocale
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
        setText(gt(L, 'planner.yourLocation'))
        search(pos.coords.latitude, pos.coords.longitude)
      },
      () => setLocating(false),
      { timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <div id="station-parking" className="my-8 scroll-mt-24 rounded-[14px] border border-navy/15 bg-white p-5 sm:p-6">
      <h2 className="mb-1 font-serif text-[1.25rem] leading-tight text-navy">{heading}</h2>
      <p className="mb-4 text-[1rem] leading-relaxed text-navy">{intro}</p>

      <AddressAutocomplete
            includeAreas
        value={text}
        onChange={setText}
        onPlaceSelected={(p) => search(p.lat, p.lng)}
        label={gt(L, 'parking.label')}
        placeholder={gt(L, 'parking.placeholder')}
      />
      <button
        type="button"
        onClick={useMyLocation}
        className="mt-2 text-[0.875rem] font-semibold text-forest underline underline-offset-4 hover:opacity-80"
      >
        {locating ? gt(L, 'planner.finding') : gt(L, 'planner.useMyLocation')}
      </button>

      <div aria-live="polite" className="mt-4">
        {status === 'loading' && <p className="text-[0.9375rem] text-ink-soft">{gt(L, 'parking.loading')}</p>}
        {status === 'outside' && (
          <p className="text-[0.9375rem] text-ink-soft">{gt(L, 'parking.outside')}</p>
        )}
        {status === 'none' && (
          <p className="text-[0.9375rem] text-ink-soft">
            {gt(L, 'parking.none')}
          </p>
        )}
        {status === 'error' && (
          <p className="text-[0.9375rem] text-ink-soft">
            {gt(L, 'parking.error')}{' '}
            <a href="https://www.mbta.com/parking/stations-and-rates" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest underline underline-offset-4">
              {gt(L, 'parking.errorLink')}
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
                    <span className="font-normal text-ink-soft"> · {gt(L, 'parking.away', { miles: l.miles })}</span>
                  </p>
                  {l.lines.length > 0 && <p className="text-[0.875rem] text-ink-soft">{l.lines.map((n) => lineLabel(n, L)).join(', ')}</p>}
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-navy">
                    {[
                      l.dailyFee ? feeLabel(l.dailyFee, L) : null,
                      l.spaces ? gt(L, 'parking.spaces', { n: l.spaces.toLocaleString('en-US') }) : null,
                      l.weekdayUsePct
                        ? l.weekdayUsePct >= 90
                          ? gt(L, 'parking.fills')
                          : gt(L, 'parking.full', { pct: l.weekdayUsePct })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <a
                    href={`/nearby?${new URLSearchParams({ lat: l.lat.toFixed(3), lng: l.lng.toFixed(3), label: l.station, plan: '1', ...(L === 'en' ? {} : { lang: L }) })}`}
                    onClick={() => track('guide_tool_open_map', { tool: 'park_and_ride', slug, placement })}
                    className="mt-1 inline-block text-[0.875rem] font-semibold text-forest underline underline-offset-4 hover:opacity-80"
                  >
                    {gt(L, 'parking.planFrom', { station: l.station })}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-soft">
              {gt(L, 'parking.note')}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
