import { LayerKey } from './types'

export interface LayerDef {
  key: LayerKey
  labelKey: string
  icon: string
  defaultOn: boolean
  color: string
}

export const FIXED_LAYERS: LayerDef[] = [
  { key: 'festival', labelKey: 'chip_festival', icon: 'MapPin', defaultOn: true, color: 'accent' },
  { key: 'food', labelKey: 'chip_food', icon: 'ForkKnife', defaultOn: true, color: '#FF7043' },
  { key: 'bus', labelKey: 'chip_bus', icon: 'Bus', defaultOn: true, color: '#1976D2' },
  { key: 'train', labelKey: 'chip_train', icon: 'Train', defaultOn: true, color: '#E66300' },
  { key: 'bluebike', labelKey: 'chip_bluebike', icon: 'Bicycle', defaultOn: true, color: '#2B6CB0' },
  { key: 'bike-parking', labelKey: 'chip_bike_parking', icon: 'LockKey', defaultOn: true, color: '#616161' },
]

export function getDefaultLayerState(): Record<LayerKey, boolean> {
  return Object.fromEntries(FIXED_LAYERS.map(l => [l.key, l.defaultOn])) as Record<LayerKey, boolean>
}
