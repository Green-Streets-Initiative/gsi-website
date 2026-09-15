'use client'

import posthog from 'posthog-js'
import { TrainIcon, BusIcon, BicycleIcon } from '@/components/wayfinding/WayfindingIcons'
import { useNearbyT } from './NearbyI18n'
import type { ModeFilter } from './useNearbyModel'

/**
 * The page-wide mode selector: one set of chips drives the map layers AND
 * every list below, so the page shows only what the rider cares about right
 * now. Replaces the old per-layer legend toggles; painted lanes keep a
 * sub-toggle (they're a bike-view refinement, not a mode).
 */

const CHIPS: { id: ModeFilter; Icon?: React.ComponentType<{ size?: number }> }[] = [
  { id: 'all' },
  { id: 'train', Icon: TrainIcon },
  { id: 'bus', Icon: BusIcon },
  { id: 'bike', Icon: BicycleIcon },
]

export default function ModeFilterChips({ mode, onMode, painted, onPaintedToggle }: {
  mode: ModeFilter
  onMode: (mode: ModeFilter) => void
  painted: boolean
  onPaintedToggle: () => void
}) {
  const tr = useNearbyT()
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      <div className="flex rounded-full border border-(--nb-line-mid) bg-(--nb-panel-faint) p-1">
        {CHIPS.map(({ id, Icon }) => (
          <button
            key={id}
            onClick={() => {
              if (id !== mode) posthog.capture('nearby_mode_filter', { mode: id })
              onMode(id)
            }}
            aria-pressed={mode === id}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8rem] font-bold transition-colors ${
              mode === id ? 'bg-(--nb-accent-fill) text-(--nb-on-accent-fill)' : 'text-(--nb-ink-80) hover:text-(--nb-ink)'
            }`}
          >
            {Icon && <Icon size={14} />}
            {tr(`chips.${id}`)}
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
              ? 'border-(--nb-painted-line) bg-(--nb-painted-tint) text-(--nb-ink)'
              : 'border-(--nb-line-mid) text-(--nb-ink-70) hover:border-(--nb-line-strong)'
          }`}
        >
          <span className="inline-block h-[3px] w-6 rounded [background-image:repeating-linear-gradient(90deg,var(--nb-painted)_0_5px,transparent_5px_9px)]" />
          {painted ? tr('chips.painted_shown') : tr('chips.show_painted')}
        </button>
      )}
    </div>
  )
}
