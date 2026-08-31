'use client'

import { useState } from 'react'
import posthog from 'posthog-js'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import type { ReachRow } from './types'
import { useNearbyT } from './NearbyI18n'

/**
 * "Where do you want to go?" — the Destinations tab's opening move.
 *
 * It used to be a card that punted to the Commute Advisor, which asks about
 * vehicle MPG, gas price, parking and days driven before it answers. That's
 * the right set of questions for a commute you'll make 200 times and the
 * wrong one for getting somewhere on Saturday.
 *
 * The answer is a ReachRow — the same shape the curated destinations use —
 * so it renders through the existing route detail with no new UI grammar:
 * times by mode, the line chain with its transfers named, bike comfort, the
 * route drawn on the page's main map, and a hand-off to a maps app for
 * turn-by-turn. The Advisor is still one tap away inside that result, where
 * it belongs: for the trips you actually repeat.
 */
export default function TripPlanner({ center, onPlanned, partnerSlug }: {
  center: { lat: number; lng: number }
  /** The planned row, ready to be prepended to the list and selected. */
  onPlanned: (row: ReachRow) => void
  partnerSlug?: string | null
}) {
  const tr = useNearbyT()
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  async function plan(place: { address: string; lat: number; lng: number }) {
    setStatus('loading')
    // The label people recognise is the first line, not the full postal
    // address — "Porter Square", not "Porter Square, Cambridge, MA 02140".
    const name = place.address.split(',')[0]?.trim() || place.address
    try {
      const res = await fetch(
        `/api/nearby/trip?from=${center.lat},${center.lng}&to=${place.lat},${place.lng}&name=${encodeURIComponent(name)}`
      )
      if (!res.ok) throw new Error(`trip ${res.status}`)
      const { row } = await res.json()
      posthog.capture('snapshot_trip_planned', {
        transit: row?.transit_minutes ?? null,
        bike: row?.bike_minutes ?? null,
        ...(partnerSlug ? { partner: partnerSlug } : {}),
      })
      setStatus('idle')
      setAddress('')
      onPlanned(row as ReachRow)
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-[rgba(186,241,77,0.25)] bg-[linear-gradient(135deg,rgba(41,102,229,0.18),rgba(186,241,77,0.1))] px-4 py-4">
      <div className="text-[0.95rem] font-bold text-white">{tr('trip.title')}</div>
      <p className="mt-1 text-[0.82rem] leading-snug text-white/80">{tr('trip.body')}</p>
      <div className="mt-2.5">
        <AddressAutocomplete
          value={address}
          onChange={(a) => { setAddress(a); if (status === 'error') setStatus('idle') }}
          onPlaceSelected={(p) => plan(p)}
          variant="dark"
          label={null}
          placeholder={tr('trip.placeholder')}
        />
      </div>
      {status === 'loading' && (
        <p className="mt-2 text-[0.8rem] text-white/80">{tr('trip.working')}</p>
      )}
      {status === 'error' && (
        <p className="mt-2 text-[0.8rem] text-white/80">{tr('trip.error')}</p>
      )}
    </div>
  )
}
