'use client'

import { useState, useEffect, useCallback } from 'react'
import type { WayfindingEvent, Locale, BluebikeStationLive } from '@/lib/wayfinding/types'
import type { BikeComfort } from '@/lib/types/commute'
import { t } from '@/lib/wayfinding/i18n'
import { haversineMeters, formatDistance, walkTimeMinutes, bikeTimeMinutes, busTimeMinutes } from '@/lib/wayfinding/geo'
import { trackEvent } from '@/lib/wayfinding/telemetry'
import { PersonWalkIcon, BusIcon, BicycleIcon, TrainIcon } from './WayfindingIcons'
import ComfortBar from '@/components/commute/ComfortBar'
import AddressAutocomplete from '@/components/AddressAutocomplete'

interface Props {
  event: WayfindingEvent
  locale: Locale
  userPosition: { lat: number; lng: number } | null
  bluebikes: BluebikeStationLive[]
  onClose: () => void
}

interface MBTAPrediction {
  routeId: string
  routeName: string
  direction: string
  stopName: string
  stopId: string
  stopLat: number
  stopLng: number
  minutesAway: number
}

interface TrainPrediction {
  routeId: string
  routeName: string
  direction: string
  stopName: string
  stopId: string
  stopLat: number
  stopLng: number
  minutesAway: number
  lineColor: string
}

const ROUTE_COLORS: Record<string, string> = {
  'Orange': '#ED8B00',
  'Green-B': '#00843D', 'Green-C': '#00843D', 'Green-D': '#00843D', 'Green-E': '#00843D',
  'Red': '#DA291C',
  'Blue': '#003DA5',
}

function directionsUrl(lat: number, lng: number, mode: 'walking' | 'transit'): string {
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (isIOS) {
    const dirflg = mode === 'transit' ? 'r' : 'w'
    return `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=${dirflg}`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${mode}`
}

export default function GetMeThereModal({ event, locale, userPosition, bluebikes, onClose }: Props) {
  const [predictions, setPredictions] = useState<MBTAPrediction[]>([])
  const [trainPredictions, setTrainPredictions] = useState<TrainPrediction[]>([])
  const [loadingPredictions, setLoadingPredictions] = useState(true)
  const [loadingTrainPredictions, setLoadingTrainPredictions] = useState(true)
  const [busExpanded, setBusExpanded] = useState(false)
  const [trainExpanded, setTrainExpanded] = useState(false)
  const [bikeComfort, setBikeComfort] = useState<BikeComfort | null>(null)
  const [loadingComfort, setLoadingComfort] = useState(false)
  const [manualPosition, setManualPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [addressValue, setAddressValue] = useState('')

  const destLat = event.center_lat
  const destLng = event.center_lng
  const effectivePosition = userPosition ?? manualPosition
  const hasLocation = !!effectivePosition

  const walkDist = hasLocation ? haversineMeters(effectivePosition!.lat, effectivePosition!.lng, destLat, destLng) : null
  const walkMin = walkDist ? walkTimeMinutes(walkDist) : null

  const nearestBluebike = bluebikes
    .filter(s => s.num_bikes_available > 0)
    .sort((a, b) => {
      if (!hasLocation) return a.distance_meters - b.distance_meters
      const da = haversineMeters(effectivePosition!.lat, effectivePosition!.lng, a.lat, a.lng)
      const db = haversineMeters(effectivePosition!.lat, effectivePosition!.lng, b.lat, b.lng)
      return da - db
    })[0] ?? null

  const bluebikeDistToUser = nearestBluebike && hasLocation
    ? haversineMeters(effectivePosition!.lat, effectivePosition!.lng, nearestBluebike.lat, nearestBluebike.lng)
    : null

  const fetchPredictions = useCallback(async () => {
    try {
      if (!hasLocation) { setLoadingPredictions(false); return }

      const stopsRes = await fetch(
        `https://api-v3.mbta.com/stops?filter[latitude]=${effectivePosition!.lat}&filter[longitude]=${effectivePosition!.lng}&filter[radius]=0.02&filter[route_type]=3`
      )
      const stopsData = await stopsRes.json()
      const nearbyStopIds: string[] = []
      const stopNameMap = new Map<string, string>()
      const stopLocMap = new Map<string, { lat: number; lng: number }>()

      for (const stop of stopsData.data || []) {
        nearbyStopIds.push(stop.id)
        const name = stop.attributes.name.replace(/(^|[.!?]\s+|@ )([a-z])/g, (_: string, prefix: string, letter: string) => prefix + letter.toUpperCase())
        stopNameMap.set(stop.id, name)
        stopLocMap.set(stop.id, { lat: stop.attributes.latitude, lng: stop.attributes.longitude })
      }

      if (nearbyStopIds.length === 0) { setLoadingPredictions(false); return }

      const stopIds = nearbyStopIds.slice(0, 10)
      const [predsResponse, routesRes] = await Promise.all([
        fetch(`https://api-v3.mbta.com/predictions?filter[stop]=${stopIds.join(',')}&filter[route_type]=3&sort=departure_time&page[limit]=30`),
        fetch(`https://api-v3.mbta.com/routes?filter[stop]=${stopIds.join(',')}&filter[type]=3`),
      ])
      const predsData = await predsResponse.json()
      const routesData = await routesRes.json()

      const routeMap = new Map<string, { name: string; directions: string[] }>()
      for (const r of routesData.data || []) {
        routeMap.set(r.id, {
          name: r.id.replace(/^0*/, ''),
          directions: r.attributes.direction_names || [],
        })
      }

      const preds: MBTAPrediction[] = []
      const seen = new Set<string>()

      for (const pred of predsData.data || []) {
        const stopId = pred.relationships?.stop?.data?.id
        const routeId = pred.relationships?.route?.data?.id
        if (!stopId || !routeId) continue

        const depTime = pred.attributes.departure_time
        if (!depTime) continue
        const diff = (new Date(depTime).getTime() - Date.now()) / 60000
        if (diff < 0) continue

        const dirId = pred.attributes.direction_id
        const key = `${routeId}-${dirId}`
        if (seen.has(key)) continue
        seen.add(key)

        const route = routeMap.get(routeId)
        const stopLoc = stopLocMap.get(stopId)

        preds.push({
          routeId,
          routeName: route?.name ?? routeId,
          direction: route?.directions[dirId] ?? '',
          stopName: stopNameMap.get(stopId) ?? stopId,
          stopId,
          stopLat: stopLoc?.lat ?? 0,
          stopLng: stopLoc?.lng ?? 0,
          minutesAway: Math.round(diff),
        })
      }

      setPredictions(preds.sort((a, b) => {
        const da = haversineMeters(effectivePosition!.lat, effectivePosition!.lng, a.stopLat, a.stopLng)
        const db = haversineMeters(effectivePosition!.lat, effectivePosition!.lng, b.stopLat, b.stopLng)
        return da !== db ? da - db : a.minutesAway - b.minutesAway
      }))
    } catch {
      // fail silently
    } finally {
      setLoadingPredictions(false)
    }
  }, [hasLocation, effectivePosition])

  const fetchTrainPreds = useCallback(async () => {
    try {
      if (!hasLocation) { setLoadingTrainPredictions(false); return }

      const stopsRes = await fetch(
        `https://api-v3.mbta.com/stops?filter[latitude]=${effectivePosition!.lat}&filter[longitude]=${effectivePosition!.lng}&filter[radius]=0.02&filter[route_type]=0,1`
      )
      const stopsData = await stopsRes.json()
      const nearbyStopIds: string[] = []
      const stopNameMap = new Map<string, string>()
      const stopLocMap = new Map<string, { lat: number; lng: number }>()

      for (const stop of stopsData.data || []) {
        nearbyStopIds.push(stop.id)
        const name = stop.attributes.name.replace(/(^|[.!?]\s+|@ )([a-z])/g, (_: string, prefix: string, letter: string) => prefix + letter.toUpperCase())
        stopNameMap.set(stop.id, name)
        stopLocMap.set(stop.id, { lat: stop.attributes.latitude, lng: stop.attributes.longitude })
      }

      if (nearbyStopIds.length === 0) { setLoadingTrainPredictions(false); return }

      const stopIds = nearbyStopIds.slice(0, 10)
      const [predsResponse, routesRes] = await Promise.all([
        fetch(`https://api-v3.mbta.com/predictions?filter[stop]=${stopIds.join(',')}&filter[route_type]=0,1&sort=departure_time&page[limit]=30`),
        fetch(`https://api-v3.mbta.com/routes?filter[stop]=${stopIds.join(',')}&filter[type]=0,1`),
      ])
      const predsData = await predsResponse.json()
      const routesData = await routesRes.json()

      const routeMap = new Map<string, { name: string; directions: string[] }>()
      for (const r of routesData.data || []) {
        routeMap.set(r.id, {
          name: r.attributes.long_name ?? r.id,
          directions: r.attributes.direction_destinations || r.attributes.direction_names || [],
        })
      }

      const preds: TrainPrediction[] = []
      const seen = new Set<string>()

      for (const pred of predsData.data || []) {
        const stopId = pred.relationships?.stop?.data?.id
        const routeId = pred.relationships?.route?.data?.id
        if (!stopId || !routeId) continue

        const depTime = pred.attributes.departure_time
        if (!depTime) continue
        const diff = (new Date(depTime).getTime() - Date.now()) / 60000
        if (diff < 0) continue

        const dirId = pred.attributes.direction_id
        const key = `${routeId}-${dirId}`
        if (seen.has(key)) continue
        seen.add(key)

        const route = routeMap.get(routeId)
        const stopLoc = stopLocMap.get(stopId)

        preds.push({
          routeId,
          routeName: route?.name ?? routeId,
          direction: route?.directions[dirId] ?? '',
          stopName: stopNameMap.get(stopId) ?? stopId,
          stopId,
          stopLat: stopLoc?.lat ?? 0,
          stopLng: stopLoc?.lng ?? 0,
          minutesAway: Math.round(diff),
          lineColor: ROUTE_COLORS[routeId] ?? '#E66300',
        })
      }

      setTrainPredictions(preds.sort((a, b) => {
        const da = haversineMeters(effectivePosition!.lat, effectivePosition!.lng, a.stopLat, a.stopLng)
        const db = haversineMeters(effectivePosition!.lat, effectivePosition!.lng, b.stopLat, b.stopLng)
        return da !== db ? da - db : a.minutesAway - b.minutesAway
      }))
    } catch {
      // fail silently
    } finally {
      setLoadingTrainPredictions(false)
    }
  }, [hasLocation, effectivePosition])

  useEffect(() => {
    fetchPredictions()
    fetchTrainPreds()
    const interval = setInterval(() => { fetchPredictions(); fetchTrainPreds() }, 30000)
    return () => clearInterval(interval)
  }, [fetchPredictions, fetchTrainPreds])

  useEffect(() => {
    if (!hasLocation) return
    setLoadingComfort(true)
    fetch(`/api/wayfinding/bike-comfort?origin_lat=${effectivePosition!.lat}&origin_lng=${effectivePosition!.lng}&dest_lat=${destLat}&dest_lng=${destLng}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && !data.error) setBikeComfort(data) })
      .catch(() => {})
      .finally(() => setLoadingComfort(false))
  }, [hasLocation, effectivePosition, destLat, destLng])

  const handleDirections = (mode: string) => {
    trackEvent({ event: 'get_me_there', slug: event.slug, locale, mode })
  }

  const visiblePredictions = busExpanded ? predictions : predictions.slice(0, 2)
  const hasMoreBus = predictions.length > 2
  const visibleTrainPredictions = trainExpanded ? trainPredictions : trainPredictions.slice(0, 2)
  const hasMoreTrain = trainPredictions.length > 2

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
          {!userPosition && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-2">{t(locale, 'or_enter_address')}</p>
              <AddressAutocomplete
                value={addressValue}
                onChange={setAddressValue}
                onPlaceSelected={(place) => setManualPosition({ lat: place.lat, lng: place.lng })}
                label={null}
                variant="light"
                placeholder={t(locale, 'address_placeholder')}
              />
            </div>
          )}

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

          {/* Bus routes — grouped */}
          {loadingPredictions && predictions.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <BusIcon size={20} className="text-blue-600" />
                <span className="text-sm text-gray-500">{t(locale, 'loading')}</span>
              </div>
            </div>
          ) : predictions.length > 0 ? (
            <div className="bg-gray-50 rounded-xl overflow-hidden">
              <div className="divide-y divide-gray-100">
                {visiblePredictions.map((pred, i) => {
                  const walkToStopDist = hasLocation ? haversineMeters(effectivePosition!.lat, effectivePosition!.lng, pred.stopLat, pred.stopLng) : null
                  const walkToStop = walkToStopDist !== null ? walkTimeMinutes(walkToStopDist) : null
                  const busRide = pred.stopLat ? busTimeMinutes(haversineMeters(pred.stopLat, pred.stopLng, destLat, destLng)) : null
                  const tripEst = walkToStop !== null && busRide !== null ? walkToStop + pred.minutesAway + busRide : null
                  return (
                  <div key={`${pred.routeId}-${pred.direction}-${i}`} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 mt-0.5">
                        <BusIcon size={20} className="text-blue-600" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 text-sm flex items-center gap-2">
                          <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded bg-blue-600 text-white text-xs font-bold">
                            {pred.routeName}
                          </span>
                          <span>{t(locale, 'toward')} {pred.direction}</span>
                          {tripEst !== null && (
                            <span className="text-xs font-normal text-gray-400">~{tripEst} {t(locale, 'min')}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          <span className="text-gray-600 font-medium">{t(locale, 'next_arrival')}:</span>{' '}
                          <ArrivalPill minutes={pred.minutesAway} locale={locale} isNext />
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {t(locale, 'board_at')} {pred.stopName}
                          {walkToStopDist !== null && ` · ${formatDistance(walkToStopDist)}`}
                        </div>
                      </div>
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
                    </div>
                  </div>
                  )
                })}
              </div>
              {hasMoreBus && (
                <button
                  onClick={() => setBusExpanded(!busExpanded)}
                  className="w-full py-2.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors border-t border-gray-100"
                >
                  {busExpanded ? t(locale, 'fewer_routes') : `${t(locale, 'more_routes')} (${predictions.length - 2})`}
                </button>
              )}
              <a
                href="https://www.gogreenstreets.org/guides/your-first-bus-ride"
                target="_blank"
                rel="noopener noreferrer"
                className="block py-2.5 text-xs text-center text-gray-500 hover:text-gray-700 transition-colors border-t border-gray-100"
              >
                {t(locale, 'bus_guide')} →
              </a>
            </div>
          ) : null}

          {!loadingPredictions && predictions.length === 0 && hasLocation && (
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

          {/* Train */}
          {loadingTrainPredictions && trainPredictions.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <TrainIcon size={20} className="text-orange-600" />
                <span className="text-sm text-gray-500">{t(locale, 'loading')}</span>
              </div>
            </div>
          ) : trainPredictions.length > 0 ? (
            <div className="bg-gray-50 rounded-xl overflow-hidden">
              <div className="divide-y divide-gray-100">
                {visibleTrainPredictions.map((pred, i) => {
                  const walkToStopDist = hasLocation ? haversineMeters(effectivePosition!.lat, effectivePosition!.lng, pred.stopLat, pred.stopLng) : null
                  const walkToStop = walkToStopDist !== null ? walkTimeMinutes(walkToStopDist) : null
                  const trainRide = pred.stopLat ? busTimeMinutes(haversineMeters(pred.stopLat, pred.stopLng, destLat, destLng)) : null
                  const tripEst = walkToStop !== null && trainRide !== null ? walkToStop + pred.minutesAway + trainRide : null
                  return (
                  <div key={`${pred.routeId}-${pred.direction}-${i}`} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 mt-0.5">
                        <TrainIcon size={20} style={{ color: pred.lineColor }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 text-sm flex items-center gap-2">
                          <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded text-white text-xs font-bold" style={{ backgroundColor: pred.lineColor }}>
                            {pred.routeName}
                          </span>
                          <span>{t(locale, 'toward')} {pred.direction}</span>
                          {tripEst !== null && (
                            <span className="text-xs font-normal text-gray-400">~{tripEst} {t(locale, 'min')}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          <span className="text-gray-600 font-medium">{t(locale, 'next_arrival')}:</span>{' '}
                          <ArrivalPill minutes={pred.minutesAway} locale={locale} isNext />
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {t(locale, 'board_at')} {pred.stopName}
                          {walkToStopDist !== null && ` · ${formatDistance(walkToStopDist)}`}
                        </div>
                      </div>
                      <a
                        href={directionsUrl(destLat, destLng, 'transit')}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleDirections('train')}
                        className="px-4 py-2 rounded-full text-sm font-semibold text-white flex-shrink-0"
                        style={{ backgroundColor: 'var(--accent)' }}
                      >
                        {t(locale, 'directions')}
                      </a>
                    </div>
                  </div>
                  )
                })}
              </div>
              {hasMoreTrain && (
                <button
                  onClick={() => setTrainExpanded(!trainExpanded)}
                  className="w-full py-2.5 text-xs font-medium text-orange-600 hover:bg-orange-50 transition-colors border-t border-gray-100"
                >
                  {trainExpanded ? t(locale, 'fewer_routes') : `${t(locale, 'more_routes')} (${trainPredictions.length - 2})`}
                </button>
              )}
            </div>
          ) : null}

          {!loadingTrainPredictions && trainPredictions.length === 0 && hasLocation && (
            <ModeCard
              icon={<TrainIcon size={20} className="text-orange-600" />}
              title={t(locale, 'chip_train')}
              subtitle={t(locale, 'no_predictions')}
              action={
                <a
                  href={directionsUrl(destLat, destLng, 'transit')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleDirections('train')}
                  className="px-4 py-2 rounded-full text-sm font-semibold text-white flex-shrink-0"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {t(locale, 'directions')}
                </a>
              }
            />
          )}

          {/* Bike */}
          {(nearestBluebike || bikeComfort) && (() => {
            const bikeRideDist = nearestBluebike ? haversineMeters(nearestBluebike.lat, nearestBluebike.lng, destLat, destLng) : null
            const bikeRideMin = bikeRideDist ? bikeTimeMinutes(bikeRideDist) : null
            const walkToStation = nearestBluebike && bluebikeDistToUser ? walkTimeMinutes(bluebikeDistToUser) : null
            const totalBikeTrip = walkToStation !== null && bikeRideMin !== null ? walkToStation + bikeRideMin : null
            return (
            <div className="bg-gray-50 rounded-xl overflow-hidden">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BicycleIcon size={20} className="text-blue-700" />
                  <span className="font-medium text-gray-900 text-sm">{t(locale, 'chip_bluebike')}</span>
                  {totalBikeTrip !== null && (
                    <span className="text-xs font-normal text-gray-400">~{totalBikeTrip} {t(locale, 'min')}</span>
                  )}
                </div>

                {bikeComfort && (bikeComfort.segments || bikeComfort.rating) && (
                  <div className="mb-3">
                    <ComfortBar rating={bikeComfort.rating} segments={bikeComfort.segments} theme="light" />
                    {bikeComfort.summary && (
                      <p className="text-xs text-gray-500 mt-1.5">{bikeComfort.summary}</p>
                    )}
                  </div>
                )}
                {loadingComfort && !bikeComfort && (
                  <div className="mb-3 text-xs text-gray-400">{t(locale, 'loading')}</div>
                )}

                {nearestBluebike && (
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-gray-600 mb-1">Nearest Bluebike station</div>
                      <div className="text-sm font-medium text-gray-900">{nearestBluebike.name}</div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
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
                      </div>
                    </div>
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
                  </div>
                )}
              </div>
              <a
                href="https://www.gogreenstreets.org/guides/how-to-use-bluebikes"
                target="_blank"
                rel="noopener noreferrer"
                className="block py-2.5 text-xs text-center text-gray-500 hover:text-gray-700 transition-colors border-t border-gray-100"
              >
                {t(locale, 'bluebike_guide')} →
              </a>
            </div>
            )
          })()}
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
