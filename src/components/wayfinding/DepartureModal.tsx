'use client'

import { useState } from 'react'
import { WayfindingEvent, Locale, DepartureMode } from '@/lib/wayfinding/types'
import { t } from '@/lib/wayfinding/i18n'
import { trackEvent } from '@/lib/wayfinding/telemetry'
import { PersonWalkIcon, BusIcon, BicycleIcon } from './WayfindingIcons'

interface Props {
  event: WayfindingEvent
  locale: Locale
  userPosition: { lat: number; lng: number } | null
  onClose: () => void
}

const MODES: { key: DepartureMode; icon: React.ReactNode; labelKey: 'arrival_walk' | 'arrival_bus' | 'arrival_bike' }[] = [
  { key: 'walk', icon: <PersonWalkIcon size={22} />, labelKey: 'arrival_walk' },
  { key: 'bus', icon: <BusIcon size={22} />, labelKey: 'arrival_bus' },
  { key: 'bike', icon: <BicycleIcon size={22} />, labelKey: 'arrival_bike' },
]

function getDirectionsUrl(mode: DepartureMode, destLat: number, destLng: number, originLat?: number, originLng?: number): string {
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  const origin = originLat && originLng ? `${originLat},${originLng}` : ''

  if (mode === 'bike') {
    const base = '/commute-advisor'
    const params = new URLSearchParams({
      dest_lat: destLat.toString(),
      dest_lng: destLng.toString(),
    })
    if (origin) {
      params.set('origin_lat', originLat!.toString())
      params.set('origin_lng', originLng!.toString())
    }
    return `${base}?${params.toString()}`
  }

  if (isIOS) {
    const travelMode = mode === 'bus' ? 'r' : 'w'
    return `maps://maps.apple.com/?daddr=${destLat},${destLng}${origin ? `&saddr=${origin}` : ''}&dirflg=${travelMode}`
  }

  const travelMode = mode === 'bus' ? 'transit' : 'walking'
  return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}${origin ? `&origin=${origin}` : ''}&travelmode=${travelMode}`
}

export default function DepartureModal({ event, locale, userPosition, onClose }: Props) {
  const [mode, setMode] = useState<DepartureMode>('walk')
  const [destInput, setDestInput] = useState('')

  const handleGo = () => {
    trackEvent({
      event: 'departure_mode_selected',
      slug: event.slug,
      locale,
      mode,
    })

    const url = getDirectionsUrl(
      mode,
      0, 0,
      event.center_lat,
      event.center_lng,
    )

    if (mode === 'bike') {
      window.location.href = url
    } else {
      window.open(url, '_blank')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl p-5 pb-8 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">{t(locale, 'departure_title')}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label={t(locale, 'close')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          {MODES.map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl text-sm font-medium transition-all ${
                mode === m.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{m.icon}</span>
              {t(locale, m.labelKey)}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t(locale, 'departure_destination')}
          </label>
          <input
            type="text"
            value={destInput}
            onChange={(e) => setDestInput(e.target.value)}
            placeholder={t(locale, 'departure_destination_placeholder')}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>

        <button
          onClick={handleGo}
          className="w-full py-3 rounded-xl font-semibold text-white text-center"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {t(locale, 'departure_go')} →
        </button>
      </div>
    </div>
  )
}
