'use client'

import { SelectedFeature, Locale, WayfindingBusiness, BluebikeStationLive, MBTAStopLive, BikeParkingSpot } from '@/lib/wayfinding/types'
import { t } from '@/lib/wayfinding/i18n'
import { formatDistance, haversineMeters } from '@/lib/wayfinding/geo'

interface Props {
  feature: SelectedFeature
  locale: Locale
  userLat: number
  userLng: number
  eventCenter: { lat: number; lng: number }
  allMbtaStops?: MBTAStopLive[]
}

function directionsUrl(lat: number, lng: number): string {
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (isIOS) {
    return `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`
}

export default function SmartCard({ feature, locale, userLat, userLng, allMbtaStops }: Props) {
  if (feature.type === 'business') {
    const biz = feature.data as WayfindingBusiness
    const dist = haversineMeters(userLat, userLng, biz.lat, biz.lng)
    return (
      <div className="px-4 py-3">
        <h3 className="font-semibold text-gray-900 text-lg">{biz.name}</h3>
        <div className="text-sm text-gray-500 mt-0.5">
          {formatDistance(dist)} {t(locale, 'away')}
          {biz.address && ` · ${biz.address}`}
        </div>
        {biz.description && (
          <p className="text-sm text-gray-600 mt-2">{biz.description}</p>
        )}
        <div className="flex gap-2 mt-3">
          <a
            href={directionsUrl(biz.lat, biz.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {t(locale, 'directions')}
          </a>
          {biz.website_url && (
            <a
              href={biz.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Website
            </a>
          )}
        </div>
      </div>
    )
  }

  if (feature.type === 'bluebike') {
    const station = feature.data as BluebikeStationLive
    const dist = haversineMeters(userLat, userLng, station.lat, station.lng)
    return (
      <div className="px-4 py-3">
        <h3 className="font-semibold text-gray-900 text-lg">{station.name}</h3>
        <div className="text-sm text-gray-500 mt-0.5">
          {formatDistance(dist)} {t(locale, 'away')}
        </div>
        <div className="flex gap-4 mt-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-700">{station.num_bikes_available - station.num_ebikes_available}</div>
            <div className="text-xs text-gray-500">{t(locale, 'bikes')}</div>
          </div>
          {station.num_ebikes_available > 0 && (
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{station.num_ebikes_available}</div>
              <div className="text-xs text-gray-500">e-bikes</div>
            </div>
          )}
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{station.num_docks_available}</div>
            <div className="text-xs text-gray-500">{t(locale, 'docks_free')}</div>
          </div>
        </div>
        <a
          href={directionsUrl(station.lat, station.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white mt-3"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {t(locale, 'directions')}
        </a>
      </div>
    )
  }

  if (feature.type === 'mbta') {
    const stop = feature.data as MBTAStopLive
    const dist = haversineMeters(userLat, userLng, stop.lat, stop.lng)
    const siblingRoutes = allMbtaStops
      ? allMbtaStops.filter(s => s.stop_id === stop.stop_id && (s.route_id !== stop.route_id || s.direction !== stop.direction))
      : []
    const allRoutes = [stop, ...siblingRoutes]

    return (
      <div className="px-4 py-3">
        <h3 className="font-semibold text-gray-900 text-lg">{stop.name}</h3>
        <div className="text-sm text-gray-500 mt-0.5">
          {formatDistance(dist)} {t(locale, 'away')}
        </div>
        <div className="mt-3 space-y-2">
          {allRoutes.map((route, i) => (
            <div key={`${route.route_id}-${route.direction}-${i}`} className="flex items-center gap-2">
              {route.route_name && (
                <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-bold flex-shrink-0">
                  {route.route_name}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-sm text-gray-900">
                  {route.direction ? `${t(locale, 'toward')} ${route.direction}` : ''}
                </span>
              </div>
              {route.next_arrival_minutes !== null && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold flex-shrink-0">
                  {route.next_arrival_minutes} {t(locale, 'min')}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3">
          <a
            href={directionsUrl(stop.lat, stop.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {t(locale, 'directions')}
          </a>
        </div>
      </div>
    )
  }

  if (feature.type === 'bike-parking') {
    const spot = feature.data as BikeParkingSpot
    const dist = haversineMeters(userLat, userLng, spot.lat, spot.lng)
    const label = spot.type === 'stands' || spot.type === 'rack'
      ? t(locale, 'bike_rack')
      : t(locale, 'bike_corral')
    return (
      <div className="px-4 py-3">
        <h3 className="font-semibold text-gray-900 text-lg">{label}</h3>
        <div className="text-sm text-gray-500 mt-0.5">
          {formatDistance(dist)} {t(locale, 'away')}
          {spot.capacity && ` · ${spot.capacity} spaces`}
        </div>
        <a
          href={directionsUrl(spot.lat, spot.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white mt-3"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {t(locale, 'directions')}
        </a>
      </div>
    )
  }

  return null
}
