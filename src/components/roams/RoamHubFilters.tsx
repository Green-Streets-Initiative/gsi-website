'use client'

import { useEffect, useState } from 'react'
import { LocateFixed, X } from 'lucide-react'
import { gaEvent } from '@/lib/ga'

/**
 * Filters for the /shift/roams hub. Every card is already in the server HTML
 * (so search engines see all of them); this only hides, reorders and labels
 * cards that carry RoamCard's `filterable` data attributes, then hides any
 * group left empty and updates the jump-link counts.
 *
 * Near me (or a picked place) keeps routes that start within NEAR_MILES and
 * sorts them closest first. Under 1 hr and Group ride soon match the card's
 * data-minutes and data-group. Kinds of filter combine (all must match).
 */

const NEAR_MILES = 15

/** Fixed starting points for people who'd rather not share their location. */
const PLACES: Array<{ id: string; label: string; lat: number; lng: number }> = [
  { id: 'boston', label: 'Boston', lat: 42.3601, lng: -71.0589 },
  { id: 'cambridge', label: 'Cambridge', lat: 42.3736, lng: -71.1097 },
  { id: 'quincy', label: 'Quincy', lat: 42.2529, lng: -71.0023 },
  { id: 'lexington', label: 'Lexington', lat: 42.4473, lng: -71.2245 },
  { id: 'salem', label: 'Salem', lat: 42.5195, lng: -70.8967 },
  { id: 'newburyport', label: 'Newburyport', lat: 42.8126, lng: -70.8773 },
  { id: 'lowell', label: 'Lowell', lat: 42.6334, lng: -71.3162 },
  { id: 'framingham', label: 'Framingham', lat: 42.2793, lng: -71.4162 },
  { id: 'worcester', label: 'Worcester', lat: 42.2626, lng: -71.8023 },
  { id: 'fitchburg', label: 'Fitchburg', lat: 42.5834, lng: -71.8023 },
  { id: 'brockton', label: 'Brockton', lat: 42.0834, lng: -71.0184 },
  { id: 'plymouth', label: 'Plymouth', lat: 41.9584, lng: -70.6673 },
  { id: 'new-bedford', label: 'New Bedford', lat: 41.6362, lng: -70.9342 },
  { id: 'falmouth', label: 'Falmouth', lat: 41.5515, lng: -70.6148 },
  { id: 'springfield', label: 'Springfield', lat: 42.1015, lng: -72.5898 },
  { id: 'northampton', label: 'Northampton', lat: 42.3251, lng: -72.6412 },
  { id: 'amherst', label: 'Amherst', lat: 42.3732, lng: -72.5199 },
]

type Origin = { lat: number; lng: number; label: string }

function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function milesLabel(mi: number): string {
  return mi < 10 ? (Math.round(mi * 10) / 10).toFixed(1) : String(Math.round(mi))
}

const chipBase =
  'inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy'
const chipOff = 'border-navy/15 bg-white text-navy hover:border-navy/40'
const chipOn = 'border-navy bg-navy text-white'

export default function RoamHubFilters({ total }: { total: number }) {
  const [origin, setOrigin] = useState<Origin | null>(null)
  const [placeId, setPlaceId] = useState('')
  const [underHour, setUnderHour] = useState(false)
  const [group, setGroup] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState(false)
  const [shown, setShown] = useState(total)

  const active = !!origin || underHour || group

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-roam-card]'))
    let visible = 0
    for (const card of cards) {
      const minutes = Number(card.dataset.minutes || NaN)
      const lat = Number(card.dataset.lat || NaN)
      const lng = Number(card.dataset.lng || NaN)
      const dist = origin && Number.isFinite(lat) && Number.isFinite(lng) ? milesBetween(origin, { lat, lng }) : null
      let ok = true
      if (underHour && !(minutes <= 60)) ok = false
      if (group && card.dataset.group !== '1') ok = false
      if (origin && (dist == null || dist > NEAR_MILES)) ok = false
      card.hidden = !ok
      card.style.order = origin && dist != null ? String(Math.round(dist * 10)) : ''
      const slot = card.querySelector<HTMLElement>('[data-roam-distance]')
      if (slot) {
        slot.hidden = !(origin && dist != null)
        slot.textContent = origin && dist != null ? `${milesLabel(dist)} mi away · ` : ''
      }
      if (ok) visible++
    }
    for (const section of Array.from(document.querySelectorAll<HTMLElement>('[data-roam-group]'))) {
      const count = section.querySelectorAll('[data-roam-card]:not([hidden])').length
      section.hidden = count === 0
      const counter = document.querySelector<HTMLElement>(`[data-roam-group-count="${section.dataset.roamGroup}"]`)
      const link = counter?.closest<HTMLElement>('a')
      if (counter) counter.textContent = String(count)
      if (link) link.hidden = count === 0
    }
    setShown(visible)
  }, [origin, underHour, group])

  const useMyLocation = () => {
    if (origin && !placeId) {
      setOrigin(null)
      return
    }
    if (!('geolocation' in navigator)) {
      setLocError(true)
      return
    }
    setLocating(true)
    setLocError(false)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        setPlaceId('')
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'you' })
        gaEvent('roam_hub_filter', { filter: 'near_me', on: true })
      },
      () => {
        setLocating(false)
        setLocError(true)
      },
      { maximumAge: 10 * 60 * 1000, timeout: 10000 },
    )
  }

  const pickPlace = (id: string) => {
    setPlaceId(id)
    setLocError(false)
    const p = PLACES.find((x) => x.id === id)
    setOrigin(p ? { lat: p.lat, lng: p.lng, label: p.label } : null)
    if (p) gaEvent('roam_hub_filter', { filter: 'place', place: p.id })
  }

  const clear = () => {
    setOrigin(null)
    setPlaceId('')
    setUnderHour(false)
    setGroup(false)
    setLocError(false)
    gaEvent('roam_hub_filter', { filter: 'clear' })
  }

  const nearOn = !!origin && !placeId

  return (
    <div className="mx-auto mt-6 max-w-[860px] rounded-2xl border border-navy/10 bg-white/70 px-4 py-4">
      <div className="flex flex-wrap items-center justify-center gap-2.5" role="group" aria-label="Filter routes">
        <span className="text-[15px] font-semibold text-navy">Filter:</span>
        <button type="button" onClick={useMyLocation} aria-pressed={nearOn} className={`${chipBase} ${nearOn ? chipOn : chipOff}`}>
          <LocateFixed size={16} aria-hidden />
          {locating ? 'Finding you…' : 'Near me'}
        </button>
        <button
          type="button"
          aria-pressed={underHour}
          onClick={() => {
            setUnderHour((v) => !v)
            gaEvent('roam_hub_filter', { filter: 'under_hour', on: !underHour })
          }}
          className={`${chipBase} ${underHour ? chipOn : chipOff}`}
        >
          Under 1 hr
        </button>
        <button
          type="button"
          aria-pressed={group}
          onClick={() => {
            setGroup((v) => !v)
            gaEvent('roam_hub_filter', { filter: 'group_ride', on: !group })
          }}
          className={`${chipBase} ${group ? chipOn : chipOff}`}
        >
          Group ride soon
        </button>
        <label className="inline-flex min-h-[44px] items-center gap-2 text-[15px] text-ink-soft">
          <span>or start from</span>
          <select
            id="roam-hub-place"
            aria-label="Start from a place"
            value={placeId}
            onChange={(e) => pickPlace(e.target.value)}
            className="min-h-[44px] rounded-full border border-navy/15 bg-white px-3 text-[15px] font-semibold text-navy focus-visible:outline-2 focus-visible:outline-navy"
          >
            <option value="">a place…</option>
            {PLACES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className={`${active || locError ? 'mt-2' : ''} flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[15px] text-ink-soft`}
        aria-live="polite"
      >
        {locError && <span>We couldn&apos;t get your location. Pick a place instead.</span>}
        {active && !locError && (
          <span>
            {shown === 0
              ? origin
                ? `No routes start within ${NEAR_MILES} miles of ${origin.label === 'you' ? 'you' : origin.label} with these filters.`
                : 'No routes match these filters.'
              : `Showing ${shown} of ${total} routes${origin ? `, closest to ${origin.label === 'you' ? 'you' : origin.label} first` : ''}.`}
          </span>
        )}
        {active && (
          <button type="button" onClick={clear} className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-forest underline-offset-4 hover:underline">
            <X size={14} aria-hidden />
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
