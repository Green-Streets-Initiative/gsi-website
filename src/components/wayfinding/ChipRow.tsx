'use client'

import { LayerKey, Locale } from '@/lib/wayfinding/types'
import { FIXED_LAYERS } from '@/lib/wayfinding/layers'
import { t, TranslationKey } from '@/lib/wayfinding/i18n'

interface Props {
  activeLayers: Record<LayerKey, boolean>
  onToggle: (key: LayerKey) => void
  locale: Locale
}

const ICONS: Record<string, string> = {
  MapPin: '📍',
  ForkKnife: '🍴',
  Bus: '🚌',
  Bicycle: '🚲',
  LockKey: '🔒',
}

export default function ChipRow({ activeLayers, onToggle, locale }: Props) {
  return (
    <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar bg-white/90 backdrop-blur-sm">
      {FIXED_LAYERS.map(layer => {
        const active = activeLayers[layer.key]
        const chipColor = layer.color === 'accent' ? 'var(--accent)' : layer.color
        return (
          <button
            key={layer.key}
            onClick={() => onToggle(layer.key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              active
                ? 'text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={active ? { backgroundColor: chipColor } : undefined}
          >
            <span className="text-sm">{ICONS[layer.icon] ?? '•'}</span>
            {t(locale, layer.labelKey as TranslationKey)}
          </button>
        )
      })}
    </div>
  )
}
