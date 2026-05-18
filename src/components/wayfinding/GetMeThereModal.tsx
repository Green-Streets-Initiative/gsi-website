'use client'

import { useState, useEffect, useCallback } from 'react'
import type { WayfindingEvent, Locale, BluebikeStationLive, MBTAStopLive } from '@/lib/wayfinding/types'
import { t } from '@/lib/wayfinding/i18n'
import { haversineMeters, formatDistance, walkTimeMinutes } from '@/lib/wayfinding/geo'
import { trackEvent } from '@/lib/wayfinding/telemetry'
import { PersonWalkIcon, BusIcon, BicycleIcon } from './WayfindingIcons'

interface Props {
  event: WayfindingEvent
  locale: Locale
  userPosition: { lat: number; lng: number } | null
  bluebikes: BluebikeStationLive[]
  mbtaStops: MBTAStopLive[]
  onClose: () => void
}

interface MBTAPrediction {
  routeId: string
  routeName: string
  direction: string
  stopName: string
  stopId: string
  minutesAway: number
}

function directionsUrl(lat: number, lng: number, mode: 'walking' | 'transit'): string {
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (isIOS) {
    const dirflg = mode === 'transit' ? 'r' : 'w'
    return `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=${dirflg}`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${mode}`
}

export default function GetMeThereModal({ event, locale, userPosition, bluebikes, mbtaStops, onClose }: Props) {
  const [predictions, setPredictions] = useState<MBTAPrediction[]>([])
  const [loadingPredictions, setLoadingPredictions] = useState(true)

  const destLat = event.center_lat
  const destLng = event.center_lng
  const hasLocation = !!userPosition

  const walkDist = hasLocation ? haversineMeters(userPosition!.lat, userPosition!.lng, destLat, destLng) : null
  const walkMin = walkDist ? walkTimeMinutes(walkDist) : null

  const nearestBluebike = bluebikes
    .filter(s => s.num_bikes_available > 0)
    .sort((a, b) => {
      if (!hasLocation) return a.distance_meters - b.distance_meters
      const da = haversineMeters(userPosition!.lat, userPosition!.lng, a.lat, a.lng)
      const db = haversineMeters(userPosition!.lat, userPosition!.lng, b.lat, b.lng)
      return da - db
    })[0] ?? null

  const bluebikeDistToUser = nearestBluebike && hasLocation
    ? haversineMeters(userPosition!.lat, userPosition!.lng, nearestBluebike.lat, nearestBluebike.lng)
    : null

  const fetchPredictions = useCallback(async () => {
    try {
      const stopIds = [...new Set(mbtaStops.map(s => s.stop_id))].slice(0, 10)
      if (stopIds.length === 0) { setLoadingPredictions(false); return }

      const res = await fetch(
        `https://api-v3.mbta.com/predictions?filter[stop]=${stopIds.join(',')}&filter[route_type]=3&sort=departure_time&page[limit]=30`
      )
      const data = await res.json()

      const routesRes = await fetch(
        `https://api-v3.mbta.com/routes?filter[type]=3&sort=sort_order`
      )
      const routesData = await routesRes.json()
      const routeMap = new Map<string, { name: string; directions: string[] }>()
      for (const r of routesData.data || []) {
        routeMap.set(r.id, {
          name: r.id.replace(/^0*/, ''),
          directions: r.attributes.direction_names || [],
        })
      }

      const stopNameMap = new Map<string, string>()
      for (const s of mbtaStops) {
        stopNameMap.set(s.stop_id, s.name)
      }

      const preds: MBTAPrediction[] = []
      const seen = new Set<string>()

      for (const pred of data.data || []) {
        const stopId = pred.relationships?.stop?.data?.id
        const routeId = pred.relationships?.route?.data?.id
        if (!stopId || !routeId) continue

        const depTime = pred.attributes.departure_time
        if (!depTime) continue
        const diff = (new Date(depTime).getTime() - Date.now()) / 60000
        if (diff < 0) continue

        const dirId = pred.attributes.direction_id
        const key = `${routeId}-${dirId}`
        if (seen.has(key)) {
          const existing = preds.find(p => p.routeId === routeId && p.direction === (routeMap.get(routeId)?.directions[dirId] ?? ''))
          if (existing) continue
        }

        seen.add(key)
        const route = routeMap.get(routeId)

        preds.push({
          routeId,
          routeName: route?.name ?? routeId,
          direction: route?.directions[dirId] ?? '',
          stopName: stopNameMap.get(stopId) ?? stopId,
          stopId,
          minutesAway: Math.round(diff),
        })
      }

      setPredictions(preds.sort((a, b) => a.minutesAway - b.minutesAway))
    } catch {
      // fail silently
    } finally {
      setLoadingPredictions(false)
    }
  }, [mbtaStops])

  useEffect(() => {
    fetchPredictions()
    const interval = setInterval(fetchPredictions, 30000)
    return () => clearInterval(interval)
  }, [fetchPredictions])

  const handleDirections = (mode: string) => {
    trackEvent({ event: 'get_me_there', slug: event.slug, locale, mode })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl overflow-hidden animate-slide-up">
        <div className="p-5 pb-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">{t(locale, 'get_me_there_title')}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
              aria-label={t(locale, 'close')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-5 pb-8 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Walk */}
          <ModeCard
            icon={<PersonWalkIcon size={20} className="text-gray-700" />}
            title={t(locale, 'arrival_walk')}
            subtitle={walkMin !== null
              ? `${walkMin} ${t(locale, 'min')} · ${formatDistance(walkDist!)}`
              : t(locale, 'grant_location')
            }
            action={
              <a
                href={directionsUrl(destLat, destLng, 'walking')}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleDirections('walk')}
                className="px-4 py-2 rounded-full text-sm font-semibold text-white flex-shrink-0"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {t(locale, 'directions')}
              </a>
            }
          />

          {/* Bus routes */}
          {loadingPredictions && predictions.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <BusIcon size={20} className="text-blue-600" />
                <span className="text-sm text-gray-500">{t(locale, 'loading')}</span>
              </div>
            </div>
          ) : (
            predictions.slice(0, 4).map((pred, i) => (
              <ModeCard
                key={`${pred.routeId}-${pred.direction}-${i}`}
                icon={<BusIcon size={20} className="text-blue-600" />}
                title={
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded bg-blue-600 text-white text-xs font-bold">
                      {pred.routeName}
                    </span>
                    <span>{t(locale, 'toward')} {pred.direction}</span>
                  </span>
                }
                subtitle={
                  <span className="flex items-center gap-2 flex-wrap">
                    <ArrivalPill minutes={pred.minutesAway} locale={locale} isNext />
                    <span className="text-gray-500">· {pred.stopName}</span>
                  </span>
                }
                action={
                  <a
                    href={directionsUrl(destLat, destLng, 'transit')}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleDirections('bus')}
                    className="px-4 py-2 rounded-full text-sm font-semibold text-white flex-shrink-0"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {t(locale, 'directions')}
                  </a>
                }
              />
            ))
          )}

          {!loadingPredictions && predictions.length === 0 && mbtaStops.length > 0 && (
            <ModeCard
              icon={<BusIcon size={20} className="text-blue-600" />}
              title={t(locale, 'arrival_bus')}
              subtitle={t(locale, 'no_predictions')}
              action={
                <a
                  href={directionsUrl(destLat, destLng, 'transit')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleDirections('bus')}
                  className="px-4 py-2 rounded-full text-sm font-semibold text-white flex-shrink-0"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {t(locale, 'directions')}
                </a>
              }
            />
          )}

          {/* Bluebike */}
          {nearestBluebike && (
            <ModeCard
              icon={<BicycleIcon size={20} className="text-blue-700" />}
              title={
                <span className="flex items-center gap-2">
                  <span>Bluebike</span>
                  <span className="text-xs font-normal text-gray-500">· {nearestBluebike.name}</span>
                </span>
              }
              subtitle={
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                    {nearestBluebike.num_bikes_available - nearestBluebike.num_ebikes_available} {t(locale, 'bikes')}
                  </span>
                  {nearestBluebike.num_ebikes_available > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                      {nearestBluebike.num_ebikes_available} e-bikes
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
                    {nearestBluebike.num_docks_available} {t(locale, 'docks_free')}
                  </span>
                  {bluebikeDistToUser && (
                    <span className="text-gray-500">· {formatDistance(bluebikeDistToUser)}</span>
                  )}
                </span>
              }
              action={
                <a
                  href={directionsUrl(nearestBluebike.lat, nearestBluebike.lng, 'walking')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleDirections('bluebike')}
                  className="px-4 py-2 rounded-full text-sm font-semibold text-white flex-shrink-0"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {t(locale, 'directions')}
                </a>
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ModeCard({ icon, title, subtitle, action }: {
  icon: React.ReactNode
  title: React.ReactNode
  subtitle: React.ReactNode
  action: React.ReactNode
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 mt-0.5">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-900 text-sm">{title}</div>
          <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>
        </div>
        {action}
      </div>
    </div>
  )
}

function ArrivalPill({ minutes, locale, isNext }: { minutes: number; locale: Locale; isNext?: boolean }) {
  const label = minutes <= 0 ? 'Now' : `${minutes} ${t(locale, 'min')}`
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        isNext
          ? 'bg-blue-100 text-blue-800'
          : 'bg-blue-50 text-blue-600'
      }`}
    >
      {label}
    </span>
  )
}
