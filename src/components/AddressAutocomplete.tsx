'use client'

import { useState, useRef, useEffect, useCallback, useId, type KeyboardEvent } from 'react'

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

type ParsedAddress = {
  line1: string
  city: string
  state: string
  zip: string
}

type Props = {
  value: string
  onChange: (address: string) => void
  onCityDetected?: (city: string) => void
  onPlaceSelected?: (place: PlaceData) => void
  onAddressParsed?: (parsed: ParsedAddress) => void
  label?: string | null
  variant?: 'light' | 'dark'
  placeholder?: string
}

export default function AddressAutocomplete({
  value,
  onChange,
  onCityDetected,
  onPlaceSelected,
  onAddressParsed,
  label,
  variant = 'light',
  placeholder = 'Start typing an address…',
}: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [open, setOpen] = useState(false)
  // The suggestion the arrow keys are on; -1 = none. Focus stays in the
  // field (ARIA 1.2 combobox, same pattern as the portal's ChampionField),
  // so the list never unmounts under the keyboard the way it used to when
  // Tab moved focus onto a suggestion (portal review A11Y-1).
  const [active, setActive] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Bumped on every request and on every pick, so a slow or superseded
  // response can't overwrite newer suggestions or reopen a closed list.
  const requestRef = useRef(0)
  const inputId = useId()
  const listId = useId()
  const optionId = (i: number) => `${listId}-opt-${i}`
  const expanded = open && predictions.length > 0

  const isDark = variant === 'dark'

  const fetchPredictions = useCallback(async (input: string) => {
    const req = ++requestRef.current
    if (input.length < 3) {
      setPredictions([])
      return
    }

    try {
      const res = await fetch('/api/places/autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      })

      const data = await res.json()
      if (req !== requestRef.current) return
      const items: Prediction[] = data.predictions || []

      setPredictions(items)
      setActive(-1)
      // Only open while the person is still in this field: a response that
      // lands after they've tabbed on must not cover the next field.
      setOpen(items.length > 0 && document.activeElement === inputRef.current)
    } catch {
      if (req === requestRef.current) setPredictions([])
    }
  }, [])

  function handleInput(val: string) {
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchPredictions(val), 300)
  }

  async function selectPrediction(prediction: Prediction) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    requestRef.current++
    onChange(prediction.text)
    setOpen(false)
    setActive(-1)
    setPredictions([])

    // Fetch place details for lat/lng, city, and structured address
    const needsDetails = onPlaceSelected || onCityDetected || onAddressParsed
    if (!needsDetails) return

    try {
      const fields = [
        onPlaceSelected ? 'location' : '',
        (onCityDetected || onAddressParsed) ? 'addressComponents' : '',
      ].filter(Boolean).join(',')

      const res = await fetch(
        `/api/places/details?placeId=${prediction.placeId}&fields=${fields}`
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

      if (data.addressComponents) {
        const find = (type: string): string =>
          data.addressComponents.find(
            (c: { types: string[] }) => c.types.includes(type)
          )?.longText || ''

        const findShort = (type: string): string =>
          data.addressComponents.find(
            (c: { types: string[] }) => c.types.includes(type)
          )?.shortText || ''

        if (onCityDetected) {
          const city = find('locality')
          if (city) onCityDetected(city)
        }

        if (onAddressParsed) {
          const streetNumber = find('street_number')
          const route = find('route')
          onAddressParsed({
            line1: [streetNumber, route].filter(Boolean).join(' '),
            city: find('locality'),
            state: findShort('administrative_area_level_1'),
            zip: find('postal_code'),
          })
        }
      }
    } catch {
      // Place details are best-effort
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const n = predictions.length
    if (e.key === 'ArrowDown') {
      if (n === 0) return
      e.preventDefault()
      if (!open) {
        setOpen(true)
        setActive(0)
      } else {
        setActive((a) => (a + 1) % n)
      }
    } else if (e.key === 'ArrowUp') {
      if (!expanded) return
      e.preventDefault()
      setActive((a) => (a <= 0 ? n - 1 : a - 1))
    } else if (e.key === 'Enter') {
      // Only take Enter when a suggestion is highlighted; otherwise let the
      // surrounding form submit as before.
      if (expanded && active >= 0) {
        e.preventDefault()
        selectPrediction(predictions[active])
      }
    } else if (e.key === 'Escape') {
      if (expanded) {
        e.preventDefault()
        setOpen(false)
        setActive(-1)
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
      {label !== null && (
        <label htmlFor={inputId} className={`mb-1.5 block text-sm font-medium ${isDark ? 'text-white' : 'text-[#191A2E]'}`}>
          {label || <>Address <span aria-hidden="true" className={isDark ? 'text-lime' : 'text-[#E05252]'}>*</span></>}
        </label>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        // The browser's own address dropdown would sit on top of ours.
        autoComplete="off"
        role="combobox"
        aria-label={label === null ? placeholder : undefined}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => {
          if (predictions.length > 0) setOpen(true)
        }}
        // Suggestions swallow mousedown (keeping focus here), so closing on
        // blur never cancels a click on one.
        onBlur={() => {
          setOpen(false)
          setActive(-1)
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={isDark
          ? 'w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-[0.9375rem] text-white outline-none transition-colors placeholder:text-white/60 focus:border-[#BAF14D]'
          : 'w-full rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-4 py-3 text-[0.9375rem] text-[#191A2E] outline-none transition-colors placeholder:text-[#5A5C6E] focus:border-[#2D6A4F]'
        }
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Address suggestions"
        hidden={!expanded}
        className={`absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border shadow-lg ${
          isDark
            ? 'border-white/[0.12] bg-[#242538]'
            : 'border-[rgba(25,26,46,0.12)] bg-white'
        }`}
      >
        {expanded && predictions.map((p, i) => (
          <li
            key={p.placeId}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            // mousedown only keeps focus in the field; the pick happens on
            // click, so screen-reader activation (which may send only click)
            // works, and the list doesn't vanish under the pointer before
            // mouseup lands on whatever is beneath it.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => selectPrediction(p)}
            className={`cursor-pointer px-4 py-2.5 text-left text-[0.875rem] transition-colors ${
              isDark
                ? `text-white hover:bg-white/[0.06] ${i === active ? 'bg-white/[0.14] shadow-[inset_3px_0_0_#BAF14D]' : ''}`
                : `text-[#191A2E] hover:bg-[#F4F8EE] ${i === active ? 'bg-[#E3EFD6] shadow-[inset_3px_0_0_#2D6A4F]' : ''}`
            }`}
          >
            {p.text}
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite">
        {expanded ? `${predictions.length} ${predictions.length === 1 ? 'suggestion' : 'suggestions'}. Use the up and down arrows to choose.` : ''}
      </p>
    </div>
  )
}
