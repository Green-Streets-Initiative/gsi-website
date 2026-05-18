'use client'

import { WayfindingEvent, Locale, ArrivalMode, SelectedFeature, BluebikeStationLive, MBTAStopLive, BikeParkingSpot } from '@/lib/wayfinding/types'
import { t } from '@/lib/wayfinding/i18n'
import { formatDistance } from '@/lib/wayfinding/geo'

interface Props {
  event: WayfindingEvent
  locale: Locale
  userPosition: { lat: number; lng: number } | null
  bluebikes: BluebikeStationLive[]
  mbtaStops: MBTAStopLive[]
  bikeParking: BikeParkingSpot[]
  onSelectFeature: (feature: SelectedFeature) => void
}

interface QuickCard {
  icon: string
  title: string
  subtitle: string
  feature: SelectedFeature
}

export default function ArrivalFlow({
  event, locale, userPosition,
  bluebikes, mbtaStops, bikeParking, onSelectFeature,
}: Props) {
  const cards: QuickCard[] = []

  if (bluebikes.length > 0) {
    const closest = bluebikes[0]
    cards.push({
      icon: '🚲',
      title: closest.name,
      subtitle: `${closest.num_bikes_available} ${t(locale, 'bikes')} · ${closest.num_docks_available} ${t(locale, 'docks_free')} · ${formatDistance(closest.distance_meters)}`,
      feature: { type: 'bluebike', data: closest },
    })
  }

  if (mbtaStops.length > 0) {
    const closest = mbtaStops[0]
    const arrivalText = closest.next_arrival_minutes !== null
      ? `${closest.next_arrival_minutes} ${t(locale, 'min')} · `
      : ''
    cards.push({
      icon: '🚌',
      title: `${closest.route_name}${closest.direction ? ` ${t(locale, 'toward')} ${closest.direction}` : ''}`,
      subtitle: `${arrivalText}${t(locale, 'stop')} ${closest.name} · ${formatDistance(closest.distance_meters)}`,
      feature: { type: 'mbta', data: closest },
    })
  }

  if (bikeParking.length > 0) {
    const closest = bikeParking[0]
    cards.push({
      icon: '🔒',
      title: closest.type === 'stands' || closest.type === 'rack'
        ? t(locale, 'bike_rack')
        : t(locale, 'bike_corral'),
      subtitle: formatDistance(closest.distance_meters),
      feature: { type: 'bike-parking', data: closest },
    })
  }

  if (cards.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-gray-400">
        {t(locale, 'loading')}
      </div>
    )
  }

  return (
    <div className="py-2 space-y-2">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        {t(locale, 'getting_around')}
      </h3>
      {cards.map((card, i) => (
        <button
          key={i}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          onClick={() => onSelectFeature(card.feature)}
        >
          <span className="text-xl flex-shrink-0">{card.icon}</span>
          <div className="min-w-0">
            <div className="font-medium text-gray-900 text-sm truncate">{card.title}</div>
            <div className="text-xs text-gray-500 truncate">{card.subtitle}</div>
          </div>
        </button>
      ))}
    </div>
  )
}
