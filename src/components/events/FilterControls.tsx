'use client'

import { Navigation } from 'lucide-react'
import { EVENT_TYPES, TYPE_FILTER_ORDER, getTagMeta } from '@/lib/events'
import CityAutocomplete from './CityAutocomplete'
import {
  DISTANCE_OPTIONS, WHEN_OPTIONS, GOOD_FOR_TAGS,
  type DistanceValue, type WhenValue, type GeoStatus, type UserLoc,
} from './useEventFilters'

/**
 * The individual filter controls, shared by the phone filters sheet and the
 * desktop filter bar popovers so both always offer the same choices.
 */

export const pillClass = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
    active ? 'border-lime/50 text-lime' : 'border-white/[0.14] text-white/[0.78] hover:bg-white/[0.06]'
  }`

const rowClass = (active: boolean) =>
  `flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
    active ? 'border border-lime/30 bg-lime/[0.1] text-lime' : 'text-white/85 hover:bg-white/[0.06]'
  }`

// --- When ---

export function WhenPills({ value, onChange }: { value: WhenValue; onChange: (v: WhenValue) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {WHEN_OPTIONS.map((opt) => (
        <button key={opt.value} onClick={() => onChange(opt.value)} className={pillClass(value === opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function WhenList({ value, onChange }: { value: WhenValue; onChange: (v: WhenValue) => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      {WHEN_OPTIONS.map((opt) => (
        <button key={opt.value} onClick={() => onChange(opt.value)} className={rowClass(value === opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// --- Near ---

export function DistancePills({ value, onChange }: { value: DistanceValue; onChange: (v: DistanceValue) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DISTANCE_OPTIONS.map((opt) => (
        <button key={opt.value} onClick={() => onChange(opt.value)} className={pillClass(value === opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

interface LocationControlProps {
  geoStatus: GeoStatus
  userLoc: UserLoc
  initialCity?: string
  onUseMyLocation: () => void
  onCitySelect: (loc: UserLoc) => void
}

export function LocationControl({ geoStatus, userLoc, initialCity, onUseMyLocation, onCitySelect }: LocationControlProps) {
  return (
    <div>
      <div className="mb-2 flex gap-2">
        <button
          onClick={onUseMyLocation}
          disabled={geoStatus === 'locating'}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.14] px-3 py-1.5 text-[12px] font-medium text-white/80 transition-colors hover:bg-white/[0.06] disabled:opacity-60"
        >
          <Navigation size={13} />
          {geoStatus === 'locating' ? 'Locating…' : 'Use my location'}
        </button>
      </div>
      <CityAutocomplete onSelect={onCitySelect} initialValue={initialCity} />
      <p className="mt-1.5 text-[11px] text-white/75">
        {geoStatus === 'active' ? `Near ${userLoc.label}` : `Distances measured from ${userLoc.label} until you pick a town.`}
      </p>
    </div>
  )
}

// --- Type ---

interface TypeProps {
  value: string
  counts: Record<string, number>
  onChange: (t: string) => void
}

/** Phone sheet: pills in the canonical order, hiding empty types. */
export function TypePills({ value, counts, onChange }: TypeProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button onClick={() => onChange('All')} className={pillClass(value === 'All')}>All</button>
      {TYPE_FILTER_ORDER.map((t) => {
        const meta = EVENT_TYPES[t]
        if (!meta || (counts[t] ?? 0) === 0) return null
        return (
          <button key={t} onClick={() => onChange(t === value ? 'All' : t)} className={pillClass(value === t)}>
            {meta.label}
          </button>
        )
      })}
    </div>
  )
}

/** Desktop popover: rows with counts, most common first; long tail behind a disclosure. */
export function TypeList({ value, counts, types, expanded, onToggleExpanded, onChange }: TypeProps & {
  types: string[]
  expanded: boolean
  onToggleExpanded: () => void
}) {
  const TOP = 6
  const visible = expanded ? types : types.slice(0, TOP)
  const hidden = types.length - visible.length
  return (
    <div className="flex flex-col gap-0.5">
      <button onClick={() => onChange('All')} className={rowClass(value === 'All')}>
        <span>All types</span>
        <span className="font-mono text-[12px] text-white/70">{counts.All ?? 0}</span>
      </button>
      {visible.map((t) => {
        const meta = EVENT_TYPES[t]
        return (
          <button key={t} onClick={() => onChange(t === value ? 'All' : t)} className={rowClass(value === t)}>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
              {meta.label}
            </span>
            <span className="font-mono text-[12px] text-white/70">{counts[t] ?? 0}</span>
          </button>
        )
      })}
      {(hidden > 0 || expanded) && (
        <button
          onClick={onToggleExpanded}
          className="mt-1 rounded-lg px-3 py-1.5 text-left text-[12px] font-semibold text-lime transition-colors hover:bg-white/[0.04]"
        >
          {expanded ? 'Show fewer' : `Show ${hidden} more type${hidden === 1 ? '' : 's'}`}
        </button>
      )}
    </div>
  )
}

// --- Good for ---

interface TagProps {
  selected: string[]
  counts: Record<string, number>
  onToggle: (t: string) => void
}

export function TagToggles({ selected, counts, onToggle }: TagProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {GOOD_FOR_TAGS.map((t) => {
        const active = selected.includes(t)
        const n = counts[t] ?? 0
        return (
          <button
            key={t}
            onClick={() => onToggle(t)}
            disabled={!active && n === 0}
            aria-pressed={active}
            className={`${pillClass(active)} disabled:opacity-60`}
          >
            {getTagMeta(t).label}
            <span className={`ml-1.5 font-mono text-[11px] ${active ? 'text-lime/90' : 'text-white/70'}`}>{n}</span>
          </button>
        )
      })}
    </div>
  )
}
