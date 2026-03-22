'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

type Prediction = {
  placeId: string
  text: string
}

type Props = {
  value: string
  onChange: (address: string) => void
  onCityDetected?: (city: string) => void
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY!

export default function AddressAutocomplete({ value, onChange, onCityDetected }: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

    if (onCityDetected) {
      try {
        const res = await fetch(
          `https://places.googleapis.com/v1/places/${prediction.placeId}?fields=addressComponents`,
          {
            headers: {
              'X-Goog-Api-Key': API_KEY,
            },
          }
        )
        const data = await res.json()
        const cityComponent = data.addressComponents?.find(
          (c: { types: string[] }) => c.types.includes('locality')
        )
        if (cityComponent?.longText) {
          onCityDetected(cityComponent.longText)
        }
      } catch {
        // City detection is best-effort
      }
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
      <label className="mb-1.5 block text-sm font-medium text-[#191A2E]">
        Address <span className="text-[#E05252]">*</span>
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => {
          setFocused(true)
          if (predictions.length > 0) setOpen(true)
        }}
        onBlur={() => setFocused(false)}
        placeholder="Start typing an address…"
        className="w-full rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-4 py-3 text-[0.9375rem] text-[#191A2E] outline-none transition-colors placeholder:text-[#8A8DA8] focus:border-[#BAF14D]"
      />
      {open && focused && predictions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-[rgba(25,26,46,0.12)] bg-white shadow-lg">
          {predictions.map((p) => (
            <li key={p.placeId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectPrediction(p)}
                className="w-full px-4 py-2.5 text-left text-[0.875rem] text-[#191A2E] transition-colors hover:bg-[#F4F8EE]"
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
