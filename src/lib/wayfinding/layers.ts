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
  { key: 'shopping', labelKey: 'chip_shopping', icon: 'Storefront', defaultOn: true, color: '#8E24AA' },
  { key: 'services', labelKey: 'chip_services', icon: 'Wrench', defaultOn: false, color: '#00897B' },
  { key: 'bus', labelKey: 'chip_bus', icon: 'Bus', defaultOn: true, color: '#1976D2' },
  { key: 'train', labelKey: 'chip_train', icon: 'Train', defaultOn: true, color: '#E66300' },
  { key: 'bluebike', labelKey: 'chip_bluebike', icon: 'Bicycle', defaultOn: true, color: '#2B6CB0' },
  { key: 'bike-parking', labelKey: 'chip_bike_parking', icon: 'LockKey', defaultOn: false, color: '#616161' },
]

/** Maps each business category string to its layer key for filtering */
export const CATEGORY_TO_LAYER: Record<string, LayerKey> = {
  // Food & Drink
  'Restaurant': 'food',
  'Cafe': 'food',
  'Bar': 'food',
  'Liquor Store': 'food',
  'Meat Market': 'food',
  'Bar & Grill': 'food',
  'Quick Bites': 'food',
  'Brewery': 'food',
  'Beverage Brand': 'food',
  // Shopping
  'Shop': 'shopping',
  'Art and Design': 'shopping',
  'Tattoo Studio': 'shopping',
  // Services
  'Hair Salon + Barber': 'services',
  'Health and Wellness': 'services',
  'Fitness Training and Martial Arts': 'services',
  'Services': 'services',
  'Auto': 'services',
  'Daycare Center': 'services',
}

export function getDefaultLayerState(): Record<LayerKey, boolean> {
  return Object.fromEntries(FIXED_LAYERS.map(l => [l.key, l.defaultOn])) as Record<LayerKey, boolean>
}
