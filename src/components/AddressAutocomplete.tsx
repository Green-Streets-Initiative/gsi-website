'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

type Prediction = {
  placeId: string
  text: string
}

type PlaceData = {
  placeId: string
  address: string
  lat: number
  lng: number
}

type Props = {
  value: string
  onChange: (address: string) => void
  onCityDetected?: (city: string) => void
  onPlaceSelected?: (place: PlaceData) => void
  label?: string
  variant?: 'light' | 'dark'
  placeholder?: string
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY!

export default function AddressAutocomplete({
  value,
  onChange,
  onCityDetected,
  onPlaceSelected,
  label,
  variant = 'light',
  placeholder = 'Start typing an address…',
}: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const isDark = variant === 'dark'

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setPredictions([])
      return
    }

    try {
      const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
        },
        body: JSON.stringify({
          input,
          includedRegionCodes: ['us'],
          includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'establishment'],
          locationBias: {
            circle: {
              center: { latitude: 42.3736, longitude: -71.1097 },
              radius: 30000,
            },
          },
        }),
      })

      const data = await res.json()
      const items: Prediction[] = (data.suggestions || [])
        .filter((s: { placePrediction?: unknown }) => s.placePrediction)
        .slice(0, 5)
        .map((s: { placePrediction: { placeId: string; text: { text: string } } }) => ({
          placeId: s.placePrediction.placeId,
          text: s.placePrediction.text.text,
        }))

      setPredictions(items)
      setOpen(items.length > 0)
    } catch {
      setPredictions([])
    }
  }, [])

  function handleInput(val: string) {
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchPredictions(val), 300)
  }

  async function selectPrediction(prediction: Prediction) {
    onChange(prediction.text)
    setOpen(false)
    setPredictions([])

    // Fetch place details for lat/lng and city
    const needsDetails = onPlaceSelected || onCityDetected
    if (!needsDetails) return

    try {
      const fields = [
        onPlaceSelected ? 'location' : '',
        onCityDetected ? 'addressComponents' : '',
      ].filter(Boolean).join(',')

      const res = await fetch(
        `https://places.googleapis.com/v1/places/${prediction.placeId}?fields=${fields}`,
        { headers: { 'X-Goog-Api-Key': API_KEY } }
      )
      const data = await res.json()

      if (onPlaceSelected && data.location) {
        onPlaceSelected({
          placeId: prediction.placeId,
          address: prediction.text,
          lat: data.location.latitude,
          lng: data.location.longitude,
        })
      }

      if (onCityDetected && data.addressComponents) {
        const cityComponent = data.addressComponents.find(
          (c: { types: string[] }) => c.types.includes('locality')
        )
        if (cityComponent?.longText) {
          onCityDetected(cityComponent.longText)
        }
      }
    } catch {
      // Place details are best-effort
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className={`mb-1.5 block text-sm font-medium ${isDark ? 'text-white' : 'text-[#191A2E]'}`}>
          {label}
        </label>
      )}
      {!label && (
        <label className={`mb-1.5 block text-sm font-medium ${isDark ? 'text-white' : 'text-[#191A2E]'}`}>
          Address <span className={isDark ? 'text-lime' : 'text-[#E05252]'}>*</span>
        </label>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => {
          setFocused(true)
          if (predictions.length > 0) setOpen(true)
        }}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className={isDark
          ? 'w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-[0.9375rem] text-white outline-none transition-colors placeholder:text-white/45 focus:border-[#BAF14D]'
          : 'w-full rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-4 py-3 text-[0.9375rem] text-[#191A2E] outline-none transition-colors placeholder:text-[#8A8DA8] focus:border-[#BAF14D]'
        }
      />
      {open && focused && predictions.length > 0 && (
        <ul className={`absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border shadow-lg ${
          isDark
            ? 'border-white/[0.12] bg-[#242538]'
            : 'border-[rgba(25,26,46,0.12)] bg-white'
        }`}>
          {predictions.map((p) => (
            <li key={p.placeId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectPrediction(p)}
                className={`w-full px-4 py-2.5 text-left text-[0.875rem] transition-colors ${
                  isDark
                    ? 'text-white hover:bg-white/[0.06]'
                    : 'text-[#191A2E] hover:bg-[#F4F8EE]'
                }`}
              >
                {p.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
