'use client'

import { useEffect, useState } from 'react'
import { MapPin, X } from '@phosphor-icons/react'
import type { ProblemPin } from './formModel'
import VolunteerRouteMap from './VolunteerRouteMap'

const PIN_CATEGORIES = [
  { value: 'crossing', label: 'Crossing' },
  { value: 'sidewalk', label: 'Sidewalk' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'bike', label: 'Biking' },
  { value: 'other', label: 'Other' },
]

interface Props {
  routeCoordinates: [number, number][]
  pins: ProblemPin[]
  onChange: (pins: ProblemPin[]) => void
  onClose: () => void
}

// Flag a problem at the exact spot it exists — the walk-audit principle that
// every finding should carry a location. Tapping the map drops a pin; if the
// walker allows location, the map opens centered where they're standing.
export default function ProblemPinSheet({ routeCoordinates, pins, onChange, onClose }: Props) {
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null)
  const [located, setLocated] = useState(false)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocated(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocated(true)
      },
      () => setLocated(true),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 },
    )
  }, [])

  function addPin(lat: number, lng: number) {
    onChange([...pins, { lat, lng, note: '', category: null }])
  }

  function updatePin(index: number, patch: Partial<ProblemPin>) {
    onChange(pins.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  function removePin(index: number) {
    onChange(pins.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-[600px] overflow-y-auto rounded-t-2xl bg-[#F4F8EE] p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-bold text-[#191A2E]">
            <MapPin size={18} weight="fill" className="text-[#D97706]" /> Flag a problem spot
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[#6B7280] hover:text-[#191A2E]">
            <X size={18} weight="bold" />
          </button>
        </div>

        <p className="mb-3 text-xs text-[#6B7280]">
          Tap the map where the problem is — a missing crosswalk, a blocked sidewalk, a spot that
          feels unsafe. Add a short note for each pin.
        </p>

        {located && (
          <VolunteerRouteMap
            routeCoordinates={routeCoordinates}
            pins={pins}
            onMapClick={addPin}
            center={here}
            heightClass="h-64"
          />
        )}

        <div className="mt-3 space-y-3">
          {pins.length === 0 && (
            <p className="text-center text-xs text-[#6B7280]">No spots flagged yet.</p>
          )}
          {pins.map((pin, i) => (
            <div key={i} className="rounded-xl bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-[#191A2E]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#D97706] text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  Spot {i + 1}
                </span>
                <button
                  onClick={() => removePin(i)}
                  className="text-xs font-semibold text-[#6B7280] hover:text-red-600"
                >
                  Remove
                </button>
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {PIN_CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => updatePin(i, { category: pin.category === c.value ? null : c.value })}
                    className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                      pin.category === c.value
                        ? 'border-[#D97706] bg-[#D97706]/10 font-medium text-[#B45309]'
                        : 'border-gray-200 bg-white text-[#6B7280]'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <textarea
                value={pin.note}
                onChange={(e) => updatePin(i, { note: e.target.value })}
                placeholder="What's the problem here?"
                rows={2}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#2966E5] focus:outline-none"
              />
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-[#2966E5] py-3 text-sm font-bold text-white"
        >
          Done
        </button>
      </div>
    </div>
  )
}
