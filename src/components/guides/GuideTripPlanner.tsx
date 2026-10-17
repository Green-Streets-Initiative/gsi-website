'use client'

import { useState } from 'react'
import posthog from 'posthog-js'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { gaEvent } from '@/lib/ga'
import type { ReachRow } from '@/components/nearby/types'
import TransitDisruptions from '@/components/guides/TransitDisruptions'
import { routeIdsForLabels } from '@/lib/nearby/disruptions'

/*
 * A small trip planner that sits inside a guide: from, to, and the transit and
 * bike answers for that trip, with a link to the same trip on the Nearby map.
 * Uses the same trip service as Nearby (/api/nearby/trip), so the numbers
 * match. Placed by GuideView's toolsAfter map (seo/answer-pages.md).
 */

type Place = { lat: number; lng: number; label: string }

const comfortWords: Record<string, string> = {
  path: 'mostly on paths away from cars',
  protected: 'mostly in protected bike lanes',
  bike_lane: 'mostly in painted bike lanes',
  shared_road: 'mostly on streets without bike lanes',
  mixed: 'a mix of bike lanes and streets',
}

/** "67" -> "bus 67", "Red" -> "the Red Line", "Green-B" -> "the Green Line (B)". */
function lineName(label: string): string {
  if (/^\d+[A-Z]?$|^SL\d$|^CT\d$/.test(label)) return `bus ${label}`
  if (/^(Red|Orange|Blue|Mattapan)$/.test(label)) return `the ${label} Line`
  const g = /^Green(?:[- ]Line)?[- ]\(?([A-E])\)?$/.exec(label)
  if (g) return `the Green Line (${g[1]})`
  return label
}

function track(event: string, props: Record<string, unknown>) {
  try {
    posthog.capture(event, props)
    gaEvent(event, props)
  } catch {
    // Analytics never blocks the tool.
  }
}

export default function GuideTripPlanner({
  slug,
  placement,
  heading,
  intro,
  toPlaceholder = 'Where are you going?',
}: {
  slug: string
  placement: string
  heading: string
  intro: string
  toPlaceholder?: string
}) {
  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')
  const [from, setFrom] = useState<Place | null>(null)
  const [to, setTo] = useState<Place | null>(null)
  const [locating, setLocating] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'outside'>('idle')
  const [row, setRow] = useState<ReachRow | null>(null)
  const [lineIds, setLineIds] = useState<string[]>([])

  const plan = (f: Place | null, t: Place | null) => {
    if (!f || !t) return
    setStatus('loading')
    setRow(null)
    const q = new URLSearchParams({ from: `${f.lat},${f.lng}`, to: `${t.lat},${t.lng}`, name: t.label.slice(0, 80) })
    fetch(`/api/nearby/trip?${q}`)
      .then(async (res) => {
        if (res.status === 400) return setStatus('outside')
        if (!res.ok) return setStatus('error')
        const data = (await res.json()) as { row: ReachRow | null }
        if (!data.row) return setStatus('error')
        setRow(data.row)
        setStatus('done')
        setLineIds([])
        const labels = (data.row.transit_segments ?? [])
          .filter((seg) => seg.mode === 'transit' && seg.label)
          .map((seg) => seg.label as string)
        routeIdsForLabels(labels).then(setLineIds)
        track('guide_tool_used', { tool: 'trip_planner', slug, placement })
      })
      .catch(() => setStatus('error'))
  }
  const chooseFrom = (p: Place) => {
    setFrom(p)
    plan(p, to)
  }
  const chooseTo = (p: Place) => {
    setTo(p)
    plan(from, p)
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        setFromText('Your location')
        chooseFrom({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Your location' })
      },
      () => setLocating(false),
      { timeout: 10000, maximumAge: 60000 },
    )
  }

  const transitLines = (row?.transit_segments ?? [])
    .filter((s) => s.mode === 'transit' && s.label)
    .map((s) => lineName(s.label as string))
  const mapHref =
    from && to
      ? `/nearby?${new URLSearchParams({
          lat: from.lat.toFixed(3),
          lng: from.lng.toFixed(3),
          label: from.label,
          to: `${to.lat.toFixed(5)},${to.lng.toFixed(5)}`,
          toName: to.label,
          toMode: 'transit',
        })}`
      : '/nearby?plan=1'

  return (
    <div id="trip-planner" className="my-8 scroll-mt-24 rounded-[14px] border border-navy/15 bg-white p-5 sm:p-6">
      <p className="mb-1 text-[1.0625rem] font-semibold leading-snug text-navy">{heading}</p>
      <p className="mb-4 text-[0.9375rem] leading-relaxed text-ink-soft">{intro}</p>

      <div className="grid gap-3">
        <div>
          <AddressAutocomplete
            includeAreas
            value={fromText}
            onChange={(v) => {
              setFromText(v)
              setFrom(null)
            }}
            onPlaceSelected={(p) => chooseFrom({ lat: p.lat, lng: p.lng, label: p.address })}
            label="From"
            placeholder="Where are you starting?"
          />
          <button
            type="button"
            onClick={useMyLocation}
            className="mt-2 text-[0.875rem] font-semibold text-forest underline underline-offset-4 hover:opacity-80"
          >
            {locating ? 'Finding you…' : 'Use my location'}
          </button>
        </div>
        <AddressAutocomplete
            includeAreas
          value={toText}
          onChange={(v) => {
            setToText(v)
            setTo(null)
          }}
          onPlaceSelected={(p) => chooseTo({ lat: p.lat, lng: p.lng, label: p.address })}
          label="To"
          placeholder={toPlaceholder}
        />
      </div>

      <div aria-live="polite" className="mt-4">
        {status === 'loading' && <p className="text-[0.9375rem] text-ink-soft">Planning your trip…</p>}
        {status === 'outside' && (
          <p className="text-[0.9375rem] text-ink-soft">
            One of those addresses is outside the area our planner covers. Try an address in Massachusetts.
          </p>
        )}
        {status === 'error' && (
          <p className="text-[0.9375rem] text-ink-soft">
            We couldn&apos;t plan that trip right now. Try a nearby street address, or plan it on the{' '}
            <a href="/nearby?plan=1" className="font-semibold text-forest underline underline-offset-4">
              Nearby page
            </a>
            .
          </p>
        )}
        {status === 'done' && row && (
          <div className="grid gap-3">
            <div className="rounded-[10px] bg-cream px-4 py-3">
              <p className="text-[0.8125rem] font-semibold text-forest">By transit</p>
              {row.transit_minutes != null ? (
                <p className="text-[1rem] leading-relaxed text-navy">
                  <strong className="font-semibold">{row.transit_minutes} min</strong>
                  {row.transit_fare ? `, $${row.transit_fare.amount.toFixed(2)}` : ''}
                  {transitLines.length > 0 ? ` on ${transitLines.join(', then ')}` : ''}
                  {row.transit_walk_minutes ? `, with ${row.transit_walk_minutes} min of walking` : ''}
                </p>
              ) : (
                <p className="text-[1rem] leading-relaxed text-navy">No transit route found for this trip.</p>
              )}
            </div>
            {lineIds.length > 0 && (
              <TransitDisruptions
                compact
                routeIds={lineIds}
                heading="Service changes on these lines"
                emptyText="No closures are planned on these lines in the next 30 days."
              />
            )}
            <div className="rounded-[10px] bg-cream px-4 py-3">
              <p className="text-[0.8125rem] font-semibold text-forest">By bike</p>
              <p className="text-[1rem] leading-relaxed text-navy">
                <strong className="font-semibold">{row.bike_minutes} min</strong>
                {row.bike_comfort?.rating ? `, ${comfortWords[row.bike_comfort.rating] ?? ''}` : ''}
              </p>
            </div>
            <a
              href={mapHref}
              onClick={() => track('guide_tool_open_map', { tool: 'trip_planner', slug, placement })}
              className="inline-block text-[0.9375rem] font-semibold text-forest underline underline-offset-4 hover:opacity-80"
            >
              See this trip on the map, with live arrivals
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
