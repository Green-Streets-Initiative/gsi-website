'use client'

import posthog from 'posthog-js'
import { TrainIcon, BusIcon, BicycleIcon } from '@/components/wayfinding/WayfindingIcons'
import type { ModeFilter } from './useNearbyModel'

/**
 * The page-wide mode selector: one set of chips drives the map layers AND
 * every list below, so the page shows only what the rider cares about right
 * now. Replaces the old per-layer legend toggles; painted lanes keep a
 * sub-toggle (they're a bike-view refinement, not a mode).
 */

const CHIPS: { id: ModeFilter; label: string; Icon?: React.ComponentType<{ size?: number }> }[] = [
  { id: 'all', label: 'All' },
  { id: 'train', label: 'Trains', Icon: TrainIcon },
  { id: 'bus', label: 'Buses', Icon: BusIcon },
  { id: 'bike', label: 'Bike', Icon: BicycleIcon },
]

export default function ModeFilterChips({ mode, onMode, painted, onPaintedToggle }: {
  mode: ModeFilter
  onMode: (mode: ModeFilter) => void
  painted: boolean
  onPaintedToggle: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      <div className="flex rounded-full border border-white/[0.12] bg-white/[0.04] p-1">
        {CHIPS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => {
              if (id !== mode) posthog.capture('nearby_mode_filter', { mode: id })
              onMode(id)
            }}
            aria-pressed={mode === id}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8rem] font-bold transition-colors ${
              mode === id ? 'bg-[#BAF14D] text-[#191A2E]' : 'text-white/80 hover:text-white'
            }`}
          >
            {Icon && <Icon size={14} />}
            {label}
          </button>
        ))}
      </div>
      {(mode === 'all' || mode === 'bike') && (
        <button
          onClick={() => {
            posthog.capture('nearby_layer_toggled', { layer: 'painted', visible: !painted })
            onPaintedToggle()
          }}
          aria-pressed={painted}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.75rem] font-semibold transition-colors ${
            painted
              ? 'border-[#7FB5FF]/60 bg-[#7FB5FF]/15 text-white'
              : 'border-white/[0.15] text-white/75 hover:border-white/[0.3]'
          }`}
        >
          <span className="inline-block h-[3px] w-6 rounded [background-image:repeating-linear-gradient(90deg,#7FB5FF_0_5px,transparent_5px_9px)]" />
          {painted ? 'Painted lanes shown' : 'Show painted lanes too'}
        </button>
      )}
    </div>
  )
}
