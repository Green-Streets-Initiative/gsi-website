'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
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
  const [activeCategories, setActiveCategories] = useState<Set<string> | null>(null)
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

  const foodCategories = useMemo(() => {
    const cats = [...new Set(businesses.map(b => b.category))].sort()
    return cats
  }, [businesses])

  const filteredBusinesses = useMemo(() => {
    if (!activeCategories || activeCategories.size === 0) return sortedBusinesses
    return sortedBusinesses.filter(b => activeCategories.has(b.category))
  }, [sortedBusinesses, activeCategories])

  const toggleCategory = useCallback((cat: string) => {
    setActiveCategories(prev => {
      if (!prev) {
        const next = new Set(foodCategories)
        next.delete(cat)
        return next
      }
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
        if (next.size === 0) return null
      } else {
        next.add(cat)
        if (next.size === foodCategories.length) return null
      }
      return next
    })
  }, [foodCategories])

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
          businesses={filteredBusinesses}
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

          {activeLayers.food && foodCategories.length > 1 && (
            <div className="flex gap-1.5 px-4 py-1 overflow-x-auto no-scrollbar bg-white/90 backdrop-blur-sm">
              {foodCategories.map(cat => {
                const active = !activeCategories || activeCategories.has(cat)
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                      active
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          )}

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
                {activeLayers.food && filteredBusinesses.length > 0 && (
                  <section className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      {t(locale, 'chip_food')}
                    </h3>
                    {filteredBusinesses.map(b => (
                      <button
                        key={b.id}
                        className="w-full text-left py-3 border-b border-gray-100 last:border-0"
                        onClick={() => handlePinSelect({ type: 'business', data: b })}
                      >
                        <div className="font-medium text-gray-900">{b.name}</div>
                        <div className="text-sm text-gray-500">
                          {foodCategories.length > 1 && <span className="text-orange-600">{b.category} · </span>}
                          {b.address}
                        </div>
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
                          {s.num_bikes_available - s.num_ebikes_available} {t(locale, 'bikes')}
                          {s.num_ebikes_available > 0 && ` + ${s.num_ebikes_available} e-bikes`}
                          {' · '}{s.num_docks_available} {t(locale, 'docks_free')}
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
                        className="w-full text-left py-3 border-b border-gray-100 last:border-0 flex items-center gap-3"
                        onClick={() => handlePinSelect({ type: 'mbta', data: s })}
                      >
                        {s.route_name && (
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-bold flex-shrink-0">
                            {s.route_name}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900">
                            {s.direction ? `${t(locale, 'toward')} ${s.direction}` : s.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {s.next_arrival_minutes !== null ? `${s.next_arrival_minutes} ${t(locale, 'min')} · ` : ''}{s.name}
                          </div>
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
        <div className="bg-white border-t border-gray-100 py-2 px-4">
          <div className="flex items-center justify-center gap-4">
            {event.organizer_logo_url && (
              <img src={event.organizer_logo_url} alt={event.organizer_name ?? ''} className="h-6 object-contain" />
            )}
            <span className="text-[10px] text-gray-300">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400">Map by</span>
              <img src="https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets/gsi-wordmark.png" alt="Green Streets Initiative" className="h-3.5 object-contain opacity-40" />
            </div>
          </div>
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
