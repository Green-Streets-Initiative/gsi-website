'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { WayfindingEvent, WayfindingBusiness, Locale, LayerKey, SelectedFeature, SheetSnap, BluebikeStationLive, MBTAStopLive, BikeParkingSpot } from '@/lib/wayfinding/types'
import { getDefaultLayerState } from '@/lib/wayfinding/layers'
import { useGeolocation, haversineMeters } from '@/lib/wayfinding/geo'
import { t } from '@/lib/wayfinding/i18n'
import { trackEvent } from '@/lib/wayfinding/telemetry'
import EventHeader from '@/components/wayfinding/EventHeader'
import ChipRow from '@/components/wayfinding/ChipRow'
import BottomSheet from '@/components/wayfinding/BottomSheet'
import RainBanner from '@/components/wayfinding/RainBanner'
import EventMap from '@/components/wayfinding/EventMap'
import SmartCard from '@/components/wayfinding/SmartCard'
import ArrivalFlow from '@/components/wayfinding/ArrivalFlow'
import DepartureModal from '@/components/wayfinding/DepartureModal'

interface Props {
  event: WayfindingEvent
  businesses: WayfindingBusiness[]
  locale: Locale
  isEmbed: boolean
}

export function WayfindingClient({ event, businesses, locale, isEmbed }: Props) {
  const [activeLayers, setActiveLayers] = useState<Record<LayerKey, boolean>>(getDefaultLayerState)
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null)
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('peek')
  const [showDeparture, setShowDeparture] = useState(false)
  const [bluebikes, setBluebikes] = useState<BluebikeStationLive[]>([])
  const [mbtaStops, setMbtaStops] = useState<MBTAStopLive[]>([])
  const [bikeParking, setBikeParking] = useState<BikeParkingSpot[]>([])
  const sheetRef = useRef<{ snapTo: (snap: SheetSnap) => void }>(null)

  const geo = useGeolocation()
  const refLat = geo.position?.lat ?? event.center_lat
  const refLng = geo.position?.lng ?? event.center_lng

  useEffect(() => {
    trackEvent({ event: 'page_load', slug: event.slug, locale })
  }, [event.slug, locale])

  useEffect(() => {
    geo.request()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleLayer = useCallback((key: LayerKey) => {
    setActiveLayers(prev => {
      const next = { ...prev, [key]: !prev[key] }
      trackEvent({ event: 'chip_toggle', slug: event.slug, locale, layer: key, enabled: next[key] })
      return next
    })
  }, [event.slug, locale])

  const handlePinSelect = useCallback((feature: SelectedFeature) => {
    setSelectedFeature(feature)
    sheetRef.current?.snapTo('half')
    trackEvent({ event: 'pin_tap', slug: event.slug, locale, type: feature.type, name: 'name' in feature.data ? (feature.data as WayfindingBusiness).name : '' })
  }, [event.slug, locale])

  const handleGetMeHome = useCallback(() => {
    setShowDeparture(true)
    trackEvent({ event: 'get_me_home', slug: event.slug, locale })
  }, [event.slug, locale])

  const displayDate = event.is_rain_date && event.date_rain ? event.date_rain : event.date_primary

  const sortedBusinesses = [...businesses].sort((a, b) =>
    haversineMeters(refLat, refLng, a.lat, a.lng) - haversineMeters(refLat, refLng, b.lat, b.lng)
  )

  const sortedBluebikes = [...bluebikes].sort((a, b) => a.distance_meters - b.distance_meters)
  const sortedMbta = [...mbtaStops].sort((a, b) => a.distance_meters - b.distance_meters)
  const sortedBikeParking = [...bikeParking].sort((a, b) => a.distance_meters - b.distance_meters)

  return (
    <>
      {!isEmbed && (
        <EventHeader
          event={event}
          locale={locale}
          displayDate={displayDate}
        />
      )}

      {(event.is_rain_date || event.is_cancelled) && (
        <RainBanner event={event} locale={locale} displayDate={displayDate} />
      )}

      <div className="relative flex-1 min-h-0">
        <EventMap
          event={event}
          businesses={businesses}
          activeLayers={activeLayers}
          userPosition={geo.position}
          bluebikes={bluebikes}
          mbtaStops={mbtaStops}
          bikeParking={bikeParking}
          onPinSelect={handlePinSelect}
          onLiveDataLoad={(bb, mbta, bp) => {
            setBluebikes(bb)
            setMbtaStops(mbta)
            setBikeParking(bp)
          }}
        />

        <div className="absolute bottom-0 left-0 right-0 z-10">
          <ChipRow
            activeLayers={activeLayers}
            onToggle={toggleLayer}
            locale={locale}
          />

          <BottomSheet
            ref={sheetRef}
            snap={sheetSnap}
            onSnapChange={setSheetSnap}
          >
            {selectedFeature ? (
              <SmartCard
                feature={selectedFeature}
                locale={locale}
                userLat={refLat}
                userLng={refLng}
                eventCenter={{ lat: event.center_lat, lng: event.center_lng }}
              />
            ) : sheetSnap === 'full' ? (
              <div className="px-4 pb-8">
                {activeLayers.food && sortedBusinesses.length > 0 && (
                  <section className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      {t(locale, 'chip_food')}
                    </h3>
                    {sortedBusinesses.map(b => (
                      <button
                        key={b.id}
                        className="w-full text-left py-3 border-b border-gray-100 last:border-0"
                        onClick={() => handlePinSelect({ type: 'business', data: b })}
                      >
                        <div className="font-medium text-gray-900">{b.name}</div>
                        {b.address && <div className="text-sm text-gray-500">{b.address}</div>}
                      </button>
                    ))}
                  </section>
                )}
                {activeLayers.bluebike && sortedBluebikes.length > 0 && (
                  <section className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      {t(locale, 'chip_bluebike')}
                    </h3>
                    {sortedBluebikes.map(s => (
                      <button
                        key={s.station_id}
                        className="w-full text-left py-3 border-b border-gray-100 last:border-0"
                        onClick={() => handlePinSelect({ type: 'bluebike', data: s })}
                      >
                        <div className="font-medium text-gray-900">{s.name}</div>
                        <div className="text-sm text-gray-500">
                          {s.num_bikes_available} {t(locale, 'bikes')} · {s.num_docks_available} {t(locale, 'docks_free')}
                        </div>
                      </button>
                    ))}
                  </section>
                )}
                {activeLayers.bus && sortedMbta.length > 0 && (
                  <section className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      {t(locale, 'chip_bus')}
                    </h3>
                    {sortedMbta.map((s, i) => (
                      <button
                        key={`${s.stop_id}-${s.route_id}-${i}`}
                        className="w-full text-left py-3 border-b border-gray-100 last:border-0"
                        onClick={() => handlePinSelect({ type: 'mbta', data: s })}
                      >
                        <div className="font-medium text-gray-900">{s.route_name} {t(locale, 'toward')} {s.direction}</div>
                        <div className="text-sm text-gray-500">
                          {s.next_arrival_minutes !== null ? `${s.next_arrival_minutes} ${t(locale, 'min')}` : ''} · {t(locale, 'stop')} {s.name}
                        </div>
                      </button>
                    ))}
                  </section>
                )}
              </div>
            ) : (
              <div className="px-4">
                <ArrivalFlow
                  event={event}
                  locale={locale}
                  userPosition={geo.position}
                  bluebikes={sortedBluebikes}
                  mbtaStops={sortedMbta}
                  bikeParking={sortedBikeParking}
                  onSelectFeature={handlePinSelect}
                />
              </div>
            )}

            <div className="px-4 pb-4 mt-2">
              <button
                onClick={handleGetMeHome}
                className="w-full py-3 rounded-xl font-semibold text-white text-center"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {t(locale, 'get_me_home')} →
              </button>
            </div>
          </BottomSheet>
        </div>
      </div>

      {!isEmbed && (
        <div className="bg-white border-t border-gray-100 py-2 px-4 text-center">
          <span className="text-xs text-gray-400">{event.attribution}</span>
        </div>
      )}

      {showDeparture && (
        <DepartureModal
          event={event}
          locale={locale}
          userPosition={geo.position}
          onClose={() => setShowDeparture(false)}
        />
      )}
    </>
  )
}
