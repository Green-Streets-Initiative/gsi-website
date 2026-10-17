'use client'

import { useState } from 'react'
import posthog from 'posthog-js'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { gaEvent } from '@/lib/ga'
import type { ReachRow } from '@/components/nearby/types'
import TransitDisruptions from '@/components/guides/TransitDisruptions'
import { routeIdsForLabels } from '@/lib/nearby/disruptions'
import { gt, type GuideLocale, type GuideKey } from '@/lib/guides/i18n'

/*
 * A small trip planner that sits inside a guide: from, to, and the transit and
 * bike answers for that trip, with a link to the same trip on the Nearby map.
 * Uses the same trip service as Nearby (/api/nearby/trip), so the numbers
 * match. Placed by GuideView's toolsAfter map (seo/answer-pages.md).
 */

type Place = { lat: number; lng: number; label: string }

const COMFORT = ['path', 'protected', 'bike_lane', 'shared_road', 'mixed']
function comfortWords(rating: string, L: GuideLocale): string {
  return COMFORT.includes(rating) ? gt(L, `comfort.${rating}` as GuideKey) : ''
}

const SUBWAY_ES: Record<string, string> = { Red: 'Roja', Orange: 'Naranja', Blue: 'Azul', Mattapan: 'Mattapan' }
const SUBWAY_PT: Record<string, string> = { Red: 'Vermelha', Orange: 'Laranja', Blue: 'Azul', Mattapan: 'Mattapan' }

/** "67" -> "bus 67", "Red" -> "the Red Line", "Green-B" -> "the Green Line (B)";
 *  in Spanish "el autobús 67", "la Línea Roja", "la Línea Verde (B)"; in Portuguese
 *  "o ônibus 67", "a Linha Vermelha", "a Linha Verde (B)". */
function lineName(label: string, L: GuideLocale): string {
  if (L === 'pt-BR') {
    if (/^\d+[A-Z]?$|^SL\d$|^CT\d$/.test(label)) return `o ônibus ${label}`
    if (/^(Red|Orange|Blue|Mattapan)$/.test(label)) return `a Linha ${SUBWAY_PT[label]}`
    const gp = /^Green(?:[- ]Line)?[- ]\(?([A-E])\)?$/.exec(label)
    if (gp) return `a Linha Verde (${gp[1]})`
    if (/ Line$/.test(label)) return `o trem metropolitano ${label.replace(/ Line$/, '')}`
    return label
  }
  const es = L === 'es'
  if (/^\d+[A-Z]?$|^SL\d$|^CT\d$/.test(label)) return es ? `el autobús ${label}` : `bus ${label}`
  if (/^(Red|Orange|Blue|Mattapan)$/.test(label)) return es ? `la Línea ${SUBWAY_ES[label]}` : `the ${label} Line`
  const g = /^Green(?:[- ]Line)?[- ]\(?([A-E])\)?$/.exec(label)
  if (g) return es ? `la Línea Verde (${g[1]})` : `the Green Line (${g[1]})`
  if (es && / Line$/.test(label)) return `el tren de cercanías ${label.replace(/ Line$/, '')}`
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
  toPlaceholder,
  locale: L = 'en',
}: {
  slug: string
  placement: string
  heading: string
  intro: string
  toPlaceholder?: string
  locale?: GuideLocale
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
        setFromText(gt(L, 'planner.yourLocation'))
        chooseFrom({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: gt(L, 'planner.yourLocation') })
      },
      () => setLocating(false),
      { timeout: 10000, maximumAge: 60000 },
    )
  }

  const transitLines = (row?.transit_segments ?? [])
    .filter((s) => s.mode === 'transit' && s.label)
    .map((s) => lineName(s.label as string, L))
  const mapHref =
    from && to
      ? `/nearby?${new URLSearchParams({
          lat: from.lat.toFixed(3),
          lng: from.lng.toFixed(3),
          label: from.label,
          to: `${to.lat.toFixed(5)},${to.lng.toFixed(5)}`,
          toName: to.label,
          toMode: 'transit',
          ...(L === 'en' ? {} : { lang: L }),
        })}`
      : L === 'en'
        ? '/nearby?plan=1'
        : `/nearby?plan=1&lang=${L}`

  return (
    <div id="trip-planner" className="my-8 scroll-mt-24 rounded-[14px] border border-navy/15 bg-white p-5 sm:p-6">
      <h2 className="mb-1 font-serif text-[1.25rem] leading-tight text-navy">{heading}</h2>
      <p className="mb-4 text-[1rem] leading-relaxed text-navy">{intro}</p>

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
            label={gt(L, 'planner.from')}
            placeholder={gt(L, 'planner.fromPlaceholder')}
          />
          <button
            type="button"
            onClick={useMyLocation}
            className="mt-2 text-[0.875rem] font-semibold text-forest underline underline-offset-4 hover:opacity-80"
          >
            {locating ? gt(L, 'planner.finding') : gt(L, 'planner.useMyLocation')}
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
          label={gt(L, 'planner.to')}
          placeholder={toPlaceholder ?? gt(L, 'planner.toPlaceholder')}
        />
      </div>

      <div aria-live="polite" className="mt-4">
        {status === 'loading' && <p className="text-[0.9375rem] text-ink-soft">{gt(L, 'planner.loading')}</p>}
        {status === 'outside' && (
          <p className="text-[0.9375rem] text-ink-soft">
            {gt(L, 'planner.outside')}
          </p>
        )}
        {status === 'error' && (
          <p className="text-[0.9375rem] text-ink-soft">
            {gt(L, 'planner.error')}{' '}
            <a href={mapHref} className="font-semibold text-forest underline underline-offset-4">
              {gt(L, 'planner.errorLink')}
            </a>
            .
          </p>
        )}
        {status === 'done' && row && (
          <div className="grid gap-3">
            <div className="rounded-[10px] bg-cream px-4 py-3">
              <p className="text-[0.8125rem] font-semibold text-forest">{gt(L, 'planner.byTransit')}</p>
              {row.transit_minutes != null ? (
                <p className="text-[1rem] leading-relaxed text-navy">
                  <strong className="font-semibold">{row.transit_minutes} min</strong>
                  {row.transit_fare ? `, $${row.transit_fare.amount.toFixed(2)}` : ''}
                  {transitLines.length > 0 ? gt(L, 'planner.onLines', { lines: transitLines.join(gt(L, 'planner.then')) }) : ''}
                  {row.transit_walk_minutes ? gt(L, 'planner.walking', { n: row.transit_walk_minutes }) : ''}
                </p>
              ) : (
                <p className="text-[1rem] leading-relaxed text-navy">{gt(L, 'planner.noTransit')}</p>
              )}
            </div>
            {lineIds.length > 0 && (
              <TransitDisruptions
                compact
                routeIds={lineIds}
                heading={gt(L, 'planner.changesHeading')}
                emptyText={gt(L, 'planner.changesEmpty')}
                locale={L}
              />
            )}
            <div className="rounded-[10px] bg-cream px-4 py-3">
              <p className="text-[0.8125rem] font-semibold text-forest">{gt(L, 'planner.byBike')}</p>
              <p className="text-[1rem] leading-relaxed text-navy">
                <strong className="font-semibold">{row.bike_minutes} min</strong>
                {row.bike_comfort?.rating && comfortWords(row.bike_comfort.rating, L) ? `, ${comfortWords(row.bike_comfort.rating, L)}` : ''}
              </p>
            </div>
            <a
              href={mapHref}
              onClick={() => track('guide_tool_open_map', { tool: 'trip_planner', slug, placement })}
              className="inline-block text-[0.9375rem] font-semibold text-forest underline underline-offset-4 hover:opacity-80"
            >
              {gt(L, 'planner.seeOnMap')}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
