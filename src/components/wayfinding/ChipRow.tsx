'use client'

import { LayerKey, Locale } from '@/lib/wayfinding/types'
import { FIXED_LAYERS } from '@/lib/wayfinding/layers'
import { t, TranslationKey } from '@/lib/wayfinding/i18n'
import { MapPinIcon, ForkKnifeIcon, BusIcon, TrainIcon, BicycleIcon, LockIcon, BeerSteinIcon, BeerBottleIcon } from './WayfindingIcons'

interface Props {
  activeLayers: Record<LayerKey, boolean>
  onToggle: (key: LayerKey) => void
  locale: Locale
}

const ICON_COMPONENTS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  MapPin: MapPinIcon,
  ForkKnife: ForkKnifeIcon,
  Bus: BusIcon,
  Train: TrainIcon,
  Bicycle: BicycleIcon,
  LockKey: LockIcon,
}

function Chip({ layer, active, onToggle, locale }: { layer: (typeof FIXED_LAYERS)[number]; active: boolean; onToggle: (key: LayerKey) => void; locale: Locale }) {
  const chipColor = layer.color === 'accent' ? 'var(--accent)' : layer.color
  const IconComponent = ICON_COMPONENTS[layer.icon]
  return (
    <button
      onClick={() => onToggle(layer.key)}
      className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
        active
          ? 'text-white shadow-sm'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
      style={active ? { backgroundColor: chipColor } : undefined}
    >
      {IconComponent && <IconComponent size={14} className="sm:w-4 sm:h-4" />}
      {t(locale, layer.labelKey as TranslationKey)}
    </button>
  )
}

const ROW1_KEYS: LayerKey[] = ['festival', 'food']
const ROW2_KEYS: LayerKey[] = ['bus', 'train', 'bluebike', 'bike-parking']

export default function ChipRow({ activeLayers, onToggle, locale }: Props) {
  const row1 = FIXED_LAYERS.filter(l => ROW1_KEYS.includes(l.key))
  const row2 = FIXED_LAYERS.filter(l => ROW2_KEYS.includes(l.key))
  return (
    <div className="px-4 py-2 space-y-1.5 bg-white/90 backdrop-blur-sm">
      <div className="flex gap-1.5 sm:gap-2">
        {row1.map(layer => (
          <Chip key={layer.key} layer={layer} active={activeLayers[layer.key]} onToggle={onToggle} locale={locale} />
        ))}
      </div>
      <div className="flex gap-1.5 sm:gap-2">
        {row2.map(layer => (
          <Chip key={layer.key} layer={layer} active={activeLayers[layer.key]} onToggle={onToggle} locale={locale} />
        ))}
      </div>
    </div>
  )
}
