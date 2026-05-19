'use client'

import { SelectedFeature, Locale, WayfindingBusiness, BluebikeStationLive, MBTAStopLive, BikeParkingSpot } from '@/lib/wayfinding/types'
import { t } from '@/lib/wayfinding/i18n'
import { formatDistance, haversineMeters } from '@/lib/wayfinding/geo'
import { BusIcon, TrainIcon } from './WayfindingIcons'

const ROUTE_COLORS: Record<string, string> = {
  'Orange': '#ED8B00',
  'Green-B': '#00843D', 'Green-C': '#00843D', 'Green-D': '#00843D', 'Green-E': '#00843D',
  'Red': '#DA291C',
  'Blue': '#003DA5',
}

interface Props {
  feature: SelectedFeature
  locale: Locale
  userLat: number
  userLng: number
  eventCenter: { lat: number; lng: number }
  allMbtaStops?: MBTAStopLive[]
  allTrainStops?: MBTAStopLive[]
  onDismiss?: () => void
}

function directionsUrl(lat: number, lng: number): string {
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (isIOS) {
    return `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`
}

function DismissButton({ onDismiss }: { onDismiss?: () => void }) {
  if (!onDismiss) return null
  return (
    <button
      onClick={onDismiss}
      className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
      aria-label="Close"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M1 1l12 12M13 1L1 13" />
      </svg>
    </button>
  )
}

export default function SmartCard({ feature, locale, userLat, userLng, allMbtaStops, allTrainStops, onDismiss }: Props) {
  if (feature.type === 'business') {
    const biz = feature.data as WayfindingBusiness
    const dist = haversineMeters(userLat, userLng, biz.lat, biz.lng)
    return (
      <div className="relative px-4 py-3">
        <DismissButton onDismiss={onDismiss} />
        <h3 className="font-semibold text-gray-900 text-lg pr-8">{biz.name}</h3>
        <div className="text-sm text-gray-500 mt-0.5">
          {formatDistance(dist)} {t(locale, 'away')}
          {biz.address && ` · ${biz.address}`}
        </div>
        {biz.is_shift_partner && (
          <a
            href="https://www.gogreenstreets.org/shift/rewards-partners"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <img src="/assets/wayfinding/shift-wordmark.png" alt="Shift" className="h-3" />
            <span className="text-[10px] text-gray-500 font-medium">Rewards Partner</span>
          </a>
        )}
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
      <div className="relative px-4 py-3">
        <DismissButton onDismiss={onDismiss} />
        <div className="text-xs font-medium text-blue-700 mb-0.5">Bluebike station</div>
        <h3 className="font-semibold text-gray-900 text-lg pr-8">{station.name}</h3>
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
    const isTrainStop = !!(allTrainStops?.some(s => s.stop_id === stop.stop_id))
    const stopsPool = isTrainStop ? allTrainStops! : (allMbtaStops ?? [])
    const siblingRoutes = stopsPool.filter(s => s.stop_id === stop.stop_id && (s.route_id !== stop.route_id || s.direction !== stop.direction))
    const allRoutes = [stop, ...siblingRoutes]
    const routeNames = [...new Set(allRoutes.map(r => r.route_name).filter(Boolean))]
    const withPredictions = allRoutes.filter(r => r.next_arrival_minutes !== null)
    const defaultBadgeColor = isTrainStop ? '#E66300' : undefined

    return (
      <div className="relative px-4 py-3">
        <DismissButton onDismiss={onDismiss} />
        <h3 className="font-semibold text-gray-900 text-lg pr-8">{stop.name}</h3>
        <div className="text-sm text-gray-500 mt-0.5">
          {formatDistance(dist)} {t(locale, 'away')}
        </div>

        <div className="mt-3 flex items-center gap-2">
          {isTrainStop
            ? <TrainIcon size={18} className="flex-shrink-0" style={{ color: '#E66300' }} />
            : <BusIcon size={18} className="text-blue-600 flex-shrink-0" />
          }
          <div className="flex items-center gap-1.5 flex-wrap">
            {routeNames.map(name => {
              const bg = ROUTE_COLORS[name] ?? defaultBadgeColor ?? '#2563EB'
              return (
                <span key={name} className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded text-white text-xs font-bold" style={{ backgroundColor: bg }}>
                  {name}
                </span>
              )
            })}
          </div>
        </div>

        {withPredictions.length > 0 ? (
          <div className="mt-3 space-y-1.5">
            {withPredictions.map((route, i) => {
              const bg = ROUTE_COLORS[route.route_name] ?? defaultBadgeColor ?? '#2563EB'
              return (
              <div key={`${route.route_id}-${route.direction}-${i}`} className="flex items-center gap-2 py-1">
                {route.route_name && (
                  <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: bg }}>
                    {route.route_name}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-900 font-medium">
                    {route.direction ? `${t(locale, 'toward')} ${route.direction}` : route.route_name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {t(locale, 'next_arrival')}: {route.next_arrival_minutes} {t(locale, 'min')}
                  </div>
                </div>
              </div>
              )
            })}
          </div>
        ) : (
          <div className="mt-3 text-sm text-gray-400">{t(locale, 'no_predictions')}</div>
        )}

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
      <div className="relative px-4 py-3">
        <DismissButton onDismiss={onDismiss} />
        <h3 className="font-semibold text-gray-900 text-lg pr-8">{label}</h3>
        <div className="text-sm text-gray-500 mt-0.5">
          {formatDistance(dist)} {t(locale, 'away')}
          {spot.capacity && ` · ${spot.capacity} ${t(locale, 'spaces')}`}
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
