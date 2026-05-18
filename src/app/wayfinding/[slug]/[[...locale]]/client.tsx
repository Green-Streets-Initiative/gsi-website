'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { WayfindingEvent, WayfindingBusiness, Locale, LayerKey, SelectedFeature, SheetSnap, BluebikeStationLive, MBTAStopLive, BikeParkingSpot } from '@/lib/wayfinding/types'
import { getDefaultLayerState } from '@/lib/wayfinding/layers'
import { useGeolocation, haversineMeters } from '@/lib/wayfinding/geo'
import { t, tCategory } from '@/lib/wayfinding/i18n'
import { trackEvent } from '@/lib/wayfinding/telemetry'
import EventHeader from '@/components/wayfinding/EventHeader'
import ChipRow from '@/components/wayfinding/ChipRow'
import BottomSheet from '@/components/wayfinding/BottomSheet'
import RainBanner from '@/components/wayfinding/RainBanner'
import EventMap from '@/components/wayfinding/EventMap'
import SmartCard from '@/components/wayfinding/SmartCard'
import DepartureModal from '@/components/wayfinding/DepartureModal'
import GetMeThereModal from '@/components/wayfinding/GetMeThereModal'
import { ForkKnifeIcon, PintGlassIcon, CoffeeIcon, BowlSteamIcon, BeerSteinIcon, BeerBottleIcon } from '@/components/wayfinding/WayfindingIcons'

const ROUTE_COLORS: Record<string, string> = {
  'Orange': '#ED8B00',
  'Green-B': '#00843D', 'Green-C': '#00843D', 'Green-D': '#00843D', 'Green-E': '#00843D',
  'Red': '#DA291C',
  'Blue': '#003DA5',
}

const FOOD_CATEGORY_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  'Restaurant': ForkKnifeIcon,
  'Bar & Grill': PintGlassIcon,
  'Cafe': CoffeeIcon,
  'Quick Bites': BowlSteamIcon,
  'Brewery': BeerSteinIcon,
  'Beverage Brand': BeerBottleIcon,
}

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
  const [mobileView, setMobileView] = useState<'map' | 'directory'>('map')
  const [showDeparture, setShowDeparture] = useState(false)
  const [showGetMeThere, setShowGetMeThere] = useState(false)
  const [bluebikes, setBluebikes] = useState<BluebikeStationLive[]>([])
  const [mbtaStops, setMbtaStops] = useState<MBTAStopLive[]>([])
  const [trainStops, setTrainStops] = useState<MBTAStopLive[]>([])
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

  const handleDismiss = useCallback(() => {
    setSelectedFeature(null)
    sheetRef.current?.snapTo('peek')
  }, [])

  const handleGetMeHome = useCallback(() => {
    setShowDeparture(true)
    trackEvent({ event: 'get_me_home', slug: event.slug, locale })
  }, [event.slug, locale])

  const handleGetMeThere = useCallback(() => {
    setShowGetMeThere(true)
    trackEvent({ event: 'get_me_there', slug: event.slug, locale })
  }, [event.slug, locale])

  const displayDate = event.is_rain_date && event.date_rain ? event.date_rain : event.date_primary

  const sortedBusinesses = [...businesses].sort((a, b) =>
    haversineMeters(refLat, refLng, a.lat, a.lng) - haversineMeters(refLat, refLng, b.lat, b.lng)
  )

  const sortedBluebikes = [...bluebikes].sort((a, b) => a.distance_meters - b.distance_meters)
  const sortedMbta = [...mbtaStops].sort((a, b) => a.distance_meters - b.distance_meters)
  const sortedTrainStops = [...trainStops].sort((a, b) => a.distance_meters - b.distance_meters)
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

  const DirectoryList = useCallback(() => (
    <div className="px-4 pb-8">
      {filteredBusinesses.length > 0 && (
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
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{b.name}</span>
                {b.is_shift_partner && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200">
                    <img src="/assets/wayfinding/shift-wordmark.svg" alt="Shift" className="h-3" />
                    <span className="text-[10px] text-gray-500 font-medium">Rewards Partner</span>
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {foodCategories.length > 1 && <span className="text-orange-600">{tCategory(locale, b.category)} · </span>}
                {b.address}
              </div>
            </button>
          ))}
        </section>
      )}
      {sortedBluebikes.length > 0 && (
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
      {sortedMbta.length > 0 && (
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
      {sortedTrainStops.length > 0 && (
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {t(locale, 'chip_train')}
          </h3>
          {sortedTrainStops.map((s, i) => {
            const lineColor = ROUTE_COLORS[s.route_id] ?? '#E66300'
            return (
            <button
              key={`${s.stop_id}-${s.route_id}-${i}`}
              className="w-full text-left py-3 border-b border-gray-100 last:border-0 flex items-center gap-3"
              onClick={() => handlePinSelect({ type: 'mbta', data: s })}
            >
              {s.route_name && (
                <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: lineColor }}>
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
            )
          })}
        </section>
      )}
    </div>
  ), [filteredBusinesses, foodCategories, sortedBluebikes, sortedMbta, sortedTrainStops, locale, handlePinSelect])

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

      <div className="relative flex-1 min-h-0 md:flex md:flex-row">
        {/* Map area — always mounted, hidden on mobile when directory tab active */}
        <div className={`absolute inset-0 md:relative md:flex-1 md:min-h-0 ${mobileView === 'directory' ? 'hidden md:block' : ''}`}>
          <EventMap
            event={event}
            businesses={filteredBusinesses}
            activeLayers={activeLayers}
            userPosition={geo.position}
            bluebikes={bluebikes}
            mbtaStops={mbtaStops}
            trainStops={trainStops}
            bikeParking={bikeParking}
            onPinSelect={handlePinSelect}
            onMapTap={handleDismiss}
            onLiveDataLoad={(bb, mbta, bp, train) => {
              setBluebikes(bb)
              setMbtaStops(mbta)
              setBikeParking(bp)
              setTrainStops(train)
            }}
          />

          <div className="absolute top-0 left-0 right-0 z-10">
            <ChipRow
              activeLayers={activeLayers}
              onToggle={toggleLayer}
              locale={locale}
            />

            {activeLayers.food && foodCategories.length > 1 && (
              <div className="flex flex-wrap gap-1.5 px-4 py-1 bg-white/90 backdrop-blur-sm">
                {foodCategories.map(cat => {
                  const active = !activeCategories || activeCategories.has(cat)
                  const CatIcon = FOOD_CATEGORY_ICONS[cat]
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                        active
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {CatIcon && <CatIcon size={14} />}
                      {tCategory(locale, cat)}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Mobile: SmartCard sheet on pin tap */}
          {selectedFeature && (
            <div className="absolute bottom-0 left-0 right-0 z-10 md:hidden">
              <BottomSheet
                ref={sheetRef}
                snap={sheetSnap}
                onSnapChange={setSheetSnap}
              >
                <SmartCard
                  feature={selectedFeature}
                  locale={locale}
                  userLat={refLat}
                  userLng={refLng}
                  eventCenter={{ lat: event.center_lat, lng: event.center_lng }}
                  allMbtaStops={sortedMbta}
                  allTrainStops={sortedTrainStops}
                  onDismiss={handleDismiss}
                />
              </BottomSheet>
            </div>
          )}
        </div>

        {/* Mobile: directory view */}
        {mobileView === 'directory' && (
          <div className="absolute inset-0 bg-white overflow-y-auto md:hidden">
            {activeLayers.food && foodCategories.length > 1 && (
              <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-gray-100">
                {foodCategories.map(cat => {
                  const active = !activeCategories || activeCategories.has(cat)
                  const CatIcon = FOOD_CATEGORY_ICONS[cat]
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                        active
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {CatIcon && <CatIcon size={14} />}
                      {tCategory(locale, cat)}
                    </button>
                  )
                })}
              </div>
            )}
            <DirectoryList />
          </div>
        )}

        {/* Mobile: bottom bar with tab toggle + CTAs */}
        <div className="absolute bottom-0 left-0 right-0 z-20 md:hidden">
          <div className="flex border-t border-gray-200 bg-white">
            <button
              onClick={() => { setMobileView('map'); setSelectedFeature(null) }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                mobileView === 'map' ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
                <path d="M228.92,49.69a8,8,0,0,0-6.86-1.45L160.93,63.52,99.58,32.84a8,8,0,0,0-5.52-.6l-64,16A8,8,0,0,0,24,56V200a8,8,0,0,0,9.94,7.76l61.13-15.28,61.35,30.68A8.15,8.15,0,0,0,160,224a8,8,0,0,0,1.94-.24l64-16A8,8,0,0,0,232,200V56A8,8,0,0,0,228.92,49.69ZM104,52.94l48,24V203.06l-48-24ZM40,62.25l48-12v127.5l-48,12ZM216,193.75l-48,12V78.25l48-12Z" />
              </svg>
              Map
            </button>
            <button
              onClick={() => setMobileView('directory')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                mobileView === 'directory' ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
                <path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z" />
              </svg>
              Directory
            </button>
          </div>
          <div className="px-4 pb-3 pt-1 flex gap-2 bg-white">
            <button
              onClick={handleGetMeThere}
              className="flex-1 py-3 rounded-xl font-semibold text-white text-center shadow-sm"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {t(locale, 'get_me_there')} →
            </button>
            <button
              onClick={handleGetMeHome}
              className="flex-1 py-3 rounded-xl font-semibold text-center bg-gray-100 text-gray-700"
            >
              {t(locale, 'get_me_home')}
            </button>
          </div>
        </div>

        {/* Desktop: sidebar panel */}
        <div className="hidden md:flex md:flex-col md:w-[380px] md:border-l md:border-gray-100 md:bg-white">
          <div className="flex gap-2 p-4 border-b border-gray-100">
            <button
              onClick={handleGetMeThere}
              className="flex-1 py-2.5 rounded-xl font-semibold text-white text-center text-sm"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {t(locale, 'get_me_there')} →
            </button>
            <button
              onClick={handleGetMeHome}
              className="flex-1 py-2.5 rounded-xl font-semibold text-center text-sm bg-gray-100 text-gray-700"
            >
              {t(locale, 'get_me_home')}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {selectedFeature ? (
              <SmartCard
                feature={selectedFeature}
                locale={locale}
                userLat={refLat}
                userLng={refLng}
                eventCenter={{ lat: event.center_lat, lng: event.center_lng }}
                allMbtaStops={sortedMbta}
                allTrainStops={sortedTrainStops}
                onDismiss={handleDismiss}
              />
            ) : (
              <DirectoryList />
            )}
          </div>
        </div>
      </div>

      {!isEmbed && (
        <div className="bg-white border-t border-gray-100 py-2 px-4">
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-[11px] text-gray-400">Wayfinding by</span>
            <a
              href="https://www.gogreenstreets.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] hover:underline"
              style={{ color: '#2D6A4F', fontFamily: 'Trebuchet MS, sans-serif' }}
            >
              <strong>Green Streets</strong> Initiative
            </a>
          </div>
        </div>
      )}

      {showGetMeThere && (
        <GetMeThereModal
          event={event}
          locale={locale}
          userPosition={geo.position}
          bluebikes={sortedBluebikes}
          onClose={() => setShowGetMeThere(false)}
        />
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
