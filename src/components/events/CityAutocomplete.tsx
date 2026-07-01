'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

type Prediction = { placeId: string; text: string }

interface CityAutocompleteProps {
  onSelect: (loc: { lat: number; lng: number; label: string }) => void
  placeholder?: string
}

export default function CityAutocomplete({ onSelect, placeholder = 'Town or city' }: CityAutocompleteProps) {
  const [value, setValue] = useState('')
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 2) {
      setPredictions([])
      return
    }
    try {
      const res = await fetch('/api/places/autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input,
          types: ['locality', 'sublocality', 'administrative_area_level_1'],
        }),
      })
      const data = await res.json()
      const items: Prediction[] = data.predictions || []
      setPredictions(items)
      setOpen(items.length > 0)
    } catch {
      setPredictions([])
    }
  }, [])

  function handleInput(val: string) {
    setValue(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchPredictions(val), 300)
  }

  async function selectPrediction(prediction: Prediction) {
    setOpen(false)
    setPredictions([])
    try {
      const res = await fetch(
        `/api/places/details?placeId=${prediction.placeId}&fields=location,addressComponents`
      )
      const data = await res.json()
      const lat = data.location?.latitude
      const lng = data.location?.longitude
      if (lat == null || lng == null) return

      const locality = data.addressComponents?.find(
        (c: { types: string[] }) => c.types.includes('locality')
      )?.longText
      const admin = data.addressComponents?.find(
        (c: { types: string[] }) => c.types.includes('administrative_area_level_1')
      )?.shortText
      const label = locality || prediction.text.split(',')[0]
      const displayLabel = [locality, admin].filter(Boolean).join(', ') || prediction.text.split(',').slice(0, 2).join(',').trim()

      setValue(displayLabel)
      onSelect({ lat, lng, label })
    } catch {
      setValue(prediction.text.split(',')[0])
    }
  }

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
        className="w-full rounded-lg border border-white/[0.14] bg-[#1F2034] px-3 py-1.5 text-[13px] text-white placeholder:text-white/50 focus:border-lime focus:outline-none"
      />
      {open && focused && predictions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-white/[0.12] bg-[#242538] shadow-lg">
          {predictions.map((p) => (
            <li key={p.placeId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectPrediction(p)}
                className="w-full px-3 py-2 text-left text-[13px] text-white hover:bg-white/[0.06]"
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
