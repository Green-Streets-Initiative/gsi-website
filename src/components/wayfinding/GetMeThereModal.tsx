'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react'
import type { WayfindingEvent, Locale, BluebikeStationLive } from '@/lib/wayfinding/types'
import type { BikeComfort } from '@/lib/types/commute'
import { t } from '@/lib/wayfinding/i18n'
import { haversineMeters, formatDistance, walkTimeMinutes } from '@/lib/wayfinding/geo'
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

interface TransitStep {
  lineName: string
  lineShortName: string
  vehicleType: string
  numStops: number
  departureStop: string
  arrivalStop: string
  departureStopLat?: number
  departureStopLng?: number
}

interface RouteResult {
  durationMins: number
  distanceMiles: number
  transitSteps?: TransitStep[]
}

interface MbtaRealtimePred {
  minutesAway: number
  routeId: string
  stopId: string
}

const ROUTE_COLORS: Record<string, string> = {
  'Orange': '#ED8B00',
  'Green-B': '#00843D', 'Green-C': '#00843D', 'Green-D': '#00843D', 'Green-E': '#00843D',
  'Red': '#DA291C',
  'Blue': '#003DA5',
}

function transitLineColor(step: TransitStep): string {
  for (const [key, color] of Object.entries(ROUTE_COLORS)) {
    if (step.lineName.includes(key) || step.lineShortName.includes(key)) return color
  }
  if (step.vehicleType === 'BUS') return '#2563EB'
  if (step.vehicleType === 'SUBWAY' || step.vehicleType === 'HEAVY_RAIL') return '#E66300'
  return '#6B7280'
}

function transitIcon(step: TransitStep) {
  const color = transitLineColor(step)
  if (step.vehicleType === 'BUS') return <BusIcon size={18} style={{ color }} />
  return <TrainIcon size={18} style={{ color }} />
}

function directionsUrl(lat: number, lng: number, mode: 'walking' | 'transit' | 'bicycling'): string {
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (isIOS) {
    const dirflg = mode === 'transit' ? 'r' : mode === 'bicycling' ? 'cy' : 'w'
    return `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=${dirflg}`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${mode}`
}

function milesToDisplay(miles: number): string {
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`
  return `${miles.toFixed(1)} mi`
}

export default function GetMeThereModal({ event, locale, userPosition, bluebikes, onClose }: Props) {
  const [routeData, setRouteData] = useState<Record<string, RouteResult | null> | null>(null)
  const [loadingRoutes, setLoadingRoutes] = useState(true)
  const [mbtaPred, setMbtaPred] = useState<MbtaRealtimePred | null>(null)
  const [loadingMbtaPred, setLoadingMbtaPred] = useState(false)
  const [bluebikeRoute, setBluebikeRoute] = useState<RouteResult | null>(null)
  const [bikeComfort, setBikeComfort] = useState<BikeComfort | null>(null)
  const [loadingComfort, setLoadingComfort] = useState(false)
  const [manualPosition, setManualPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [addressValue, setAddressValue] = useState('')
  const mbtaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const destLat = event.center_lat
  const destLng = event.center_lng
  const effectivePosition = userPosition ?? manualPosition
  const hasLocation = !!effectivePosition

  const walkRoute = routeData?.WALK ?? null
  const bikeRoute = routeData?.BICYCLE ?? null
  const transitRoute = routeData?.TRANSIT ?? null

  const nearestBluebike = useMemo(() =>
    bluebikes
      .filter(s => s.num_bikes_available > 0)
      .sort((a, b) => {
        if (!hasLocation) return a.distance_meters - b.distance_meters
        const da = haversineMeters(effectivePosition!.lat, effectivePosition!.lng, a.lat, a.lng)
        const db = haversineMeters(effectivePosition!.lat, effectivePosition!.lng, b.lat, b.lng)
        return da - db
      })[0] ?? null,
    [bluebikes, hasLocation, effectivePosition]
  )

  const bluebikeDistToUser = nearestBluebike && hasLocation
    ? haversineMeters(effectivePosition!.lat, effectivePosition!.lng, nearestBluebike.lat, nearestBluebike.lng)
    : null

  // Fetch all routes from Google via /api/route
  const fetchRoutes = useCallback(async () => {
    if (!hasLocation) { setLoadingRoutes(false); return }
    setLoadingRoutes(true)
    try {
      const res = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: effectivePosition!.lat, lng: effectivePosition!.lng },
          destination: { lat: destLat, lng: destLng },
          modes: ['WALK', 'BICYCLE', 'TRANSIT'],
          departureTime: new Date().toISOString(),
        }),
      })
      if (!res.ok) { setLoadingRoutes(false); return }
      const data = await res.json()
      setRouteData(data.routes)
    } catch {
      // fail silently
    } finally {
      setLoadingRoutes(false)
    }
  }, [hasLocation, effectivePosition, destLat, destLng])

  // Surgical MBTA prediction: query for the specific stop+route Google identified
  const fetchMbtaPrediction = useCallback(async () => {
    if (!transitRoute?.transitSteps?.length) return
    const firstStep = transitRoute.transitSteps[0]
    if (!firstStep.departureStopLat || !firstStep.departureStopLng) return

    setLoadingMbtaPred(true)
    try {
      const routeType = firstStep.vehicleType === 'BUS' ? '3' : '0,1'
      // Find the MBTA stop near the departure stop Google identified
      const stopsRes = await fetch(
        `https://api-v3.mbta.com/stops?filter[latitude]=${firstStep.departureStopLat}&filter[longitude]=${firstStep.departureStopLng}&filter[radius]=0.003&filter[route_type]=${routeType}&page[limit]=5`
      )
      const stopsData = await stopsRes.json()
      const stopIds = (stopsData.data || []).map((s: { id: string }) => s.id)
      if (stopIds.length === 0) { setLoadingMbtaPred(false); return }

      // Query predictions for those stops
      const predsRes = await fetch(
        `https://api-v3.mbta.com/predictions?filter[stop]=${stopIds.join(',')}&filter[route_type]=${routeType}&sort=departure_time&page[limit]=10`
      )
      const predsData = await predsRes.json()

      const lineShort = firstStep.lineShortName.toLowerCase()
      const lineName = firstStep.lineName.toLowerCase()

      for (const pred of predsData.data || []) {
        const depTime = pred.attributes.departure_time
        if (!depTime) continue
        const diff = (new Date(depTime).getTime() - Date.now()) / 60000
        if (diff < 0) continue
        const routeId = pred.relationships?.route?.data?.id ?? ''
        const routeLower = routeId.toLowerCase()
        // Match by route ID containing the line short name or vice versa
        if (routeLower.includes(lineShort) || lineShort.includes(routeLower) ||
            routeLower.includes(lineName) || lineName.includes(routeLower) ||
            routeId.replace(/^0*/, '') === firstStep.lineShortName) {
          setMbtaPred({
            minutesAway: Math.round(diff),
            routeId,
            stopId: pred.relationships?.stop?.data?.id ?? '',
          })
          setLoadingMbtaPred(false)
          return
        }
      }
      // No matching prediction found — might be off-hours
      setMbtaPred(null)
    } catch {
      // fail silently
    } finally {
      setLoadingMbtaPred(false)
    }
  }, [transitRoute])

  // Fetch Google routes once on mount / location change
  useEffect(() => {
    fetchRoutes()
  }, [fetchRoutes])

  // Start MBTA polling once we have transit route data
  useEffect(() => {
    if (!transitRoute?.transitSteps?.length) return
    fetchMbtaPrediction()
    mbtaIntervalRef.current = setInterval(fetchMbtaPrediction, 30000)
    return () => {
      if (mbtaIntervalRef.current) clearInterval(mbtaIntervalRef.current)
    }
  }, [transitRoute, fetchMbtaPrediction])

  // Fetch Google BICYCLE route from nearest Bluebike station to destination
  useEffect(() => {
    if (!nearestBluebike) return
    fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: { lat: nearestBluebike.lat, lng: nearestBluebike.lng },
        destination: { lat: destLat, lng: destLng },
        modes: ['BICYCLE'],
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.routes?.BICYCLE) setBluebikeRoute(data.routes.BICYCLE) })
      .catch(() => {})
  }, [nearestBluebike, destLat, destLng])

  // Bike comfort
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

  const blueBikeEst = bluebikeRoute && bluebikeDistToUser
    ? walkTimeMinutes(bluebikeDistToUser) + bluebikeRoute.durationMins
    : null

  // Mode ordering by Google durations
  type ModeKey = 'walk' | 'transit' | 'bike'
  const modeEstimates: { key: ModeKey; est: number | null }[] = [
    { key: 'walk', est: walkRoute?.durationMins ?? null },
    { key: 'transit', est: transitRoute?.durationMins ?? null },
    { key: 'bike', est: bikeRoute?.durationMins ?? null },
  ]
  const modeOrder = modeEstimates
    .sort((a, b) => {
      if (a.est === null && b.est === null) return 0
      if (a.est === null) return 1
      if (b.est === null) return -1
      return a.est - b.est
    })
    .map(m => m.key)

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

          {loadingRoutes && hasLocation && (
            <div className="bg-gray-50 rounded-xl p-4">
              <span className="text-sm text-gray-500">{t(locale, 'loading')}</span>
            </div>
          )}

          {!loadingRoutes && modeOrder.map(mode => {
            if (mode === 'walk') return (
              <ModeCard
                key="walk"
                icon={<PersonWalkIcon size={20} className="text-gray-700" />}
                title={t(locale, 'arrival_walk')}
                subtitle={walkRoute
                  ? `${walkRoute.durationMins} ${t(locale, 'min')} · ${milesToDisplay(walkRoute.distanceMiles)}`
                  : hasLocation ? t(locale, 'no_viable_route') : t(locale, 'grant_location')
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
            )

            if (mode === 'transit') {
              if (!hasLocation) return null
              if (!transitRoute || !transitRoute.transitSteps?.length) {
                return (
                  <ModeCard
                    key="transit"
                    icon={<BusIcon size={20} className="text-blue-600" />}
                    title={t(locale, 'transit')}
                    subtitle={t(locale, 'no_viable_route')}
                    action={
                      <a
                        href={directionsUrl(destLat, destLng, 'transit')}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleDirections('transit')}
                        className="px-4 py-2 rounded-full text-sm font-semibold text-white flex-shrink-0"
                        style={{ backgroundColor: 'var(--accent)' }}
                      >
                        {t(locale, 'directions')}
                      </a>
                    }
                  />
                )
              }

              return (
                <div key="transit" className="bg-gray-50 rounded-xl overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {transitIcon(transitRoute.transitSteps[0])}
                        <span className="font-medium text-gray-900 text-sm">{t(locale, 'transit')}</span>
                        <span className="text-xs text-gray-500">~{transitRoute.durationMins} {t(locale, 'min')}</span>
                      </div>
                      <a
                        href={directionsUrl(destLat, destLng, 'transit')}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleDirections('transit')}
                        className="px-4 py-2 rounded-full text-sm font-semibold text-white flex-shrink-0"
                        style={{ backgroundColor: 'var(--accent)' }}
                      >
                        {t(locale, 'directions')}
                      </a>
                    </div>

                    <div className="space-y-2">
                      {transitRoute.transitSteps.map((step, i) => {
                        const color = transitLineColor(step)
                        const badge = step.lineShortName || step.lineName
                        const isFirst = i === 0
                        return (
                          <div key={i} className="flex items-start gap-2.5">
                            <div className="flex-shrink-0 mt-0.5">
                              {step.vehicleType === 'BUS'
                                ? <BusIcon size={16} style={{ color }} />
                                : <TrainIcon size={16} style={{ color }} />
                              }
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
                                <span
                                  className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded text-white text-xs font-bold"
                                  style={{ backgroundColor: color }}
                                >
                                  {badge}
                                </span>
                                <span className="text-gray-700">
                                  {step.numStops} {t(locale, 'stops_to')} {step.arrivalStop}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {t(locale, 'board_at')} {step.departureStop}
                              </div>
                              {isFirst && mbtaPred && (
                                <div className="mt-1">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                    {t(locale, 'next_departure')}: {mbtaPred.minutesAway <= 0 ? 'Now' : `${mbtaPred.minutesAway} ${t(locale, 'min')}`}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <a
                    href="https://www.gogreenstreets.org/guides/your-first-bus-ride"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block py-2.5 text-xs text-center text-gray-500 hover:text-gray-700 transition-colors border-t border-gray-100"
                  >
                    {t(locale, 'bus_guide')} →
                  </a>
                </div>
              )
            }

            if (mode === 'bike') return (
              <Fragment key="bike">
                {/* Your bike — Google-routed cycling directions */}
                <ModeCard
                  icon={<BicycleIcon size={20} className="text-green-700" />}
                  title={t(locale, 'your_bike')}
                  subtitle={bikeRoute
                    ? `~${bikeRoute.durationMins} ${t(locale, 'min')} · ${milesToDisplay(bikeRoute.distanceMiles)}`
                    : hasLocation ? t(locale, 'no_viable_route') : t(locale, 'grant_location')
                  }
                  action={
                    <a
                      href={directionsUrl(destLat, destLng, 'bicycling')}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleDirections('bike')}
                      className="px-4 py-2 rounded-full text-sm font-semibold text-white flex-shrink-0"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      {t(locale, 'directions')}
                    </a>
                  }
                />

                {/* Bluebike — walk to station + ride */}
                {nearestBluebike && (() => {
                  const walkToStation = bluebikeDistToUser ? walkTimeMinutes(bluebikeDistToUser) : null
                  const totalBikeTrip = blueBikeEst
                  return (
                  <div className="bg-gray-50 rounded-xl overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <BicycleIcon size={20} className="text-blue-700" />
                        <span className="font-medium text-gray-900 text-sm">Bluebike</span>
                        {totalBikeTrip !== null && (
                          <span className="text-xs font-normal text-gray-500">~{totalBikeTrip} {t(locale, 'min')}</span>
                        )}
                      </div>

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
                              {bluebikeDistToUser && walkToStation !== null && (
                                <span className="text-gray-500">· {formatDistance(bluebikeDistToUser)} walk</span>
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
              </Fragment>
            )

            return null
          })}
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
