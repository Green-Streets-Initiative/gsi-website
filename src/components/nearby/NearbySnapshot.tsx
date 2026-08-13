'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { supabase } from '@/lib/supabase'
import type { BluebikeStationLive, MBTAStopLive } from '@/lib/wayfinding/types'
import { fetchBluebikes, fetchMBTAStops, fetchTrainStops } from '@/lib/nearby/live-data'
import { round3, parseSnapshotParams, buildShareUrl, isOutsideArea } from '@/lib/nearby/share'
import { NEARBY_PATH } from '@/lib/nearby/config'
import {
  buildTransitCorridors, buildBikeCorridors, fetchCorridorMeta,
  SNAPSHOT_BUS_OPTS, SNAPSHOT_RAIL_PREFIX, SNAPSHOT_RAIL_TYPES, SNAPSHOT_MAX_STOPS,
  type TransitCorridor,
} from '@/lib/nearby/corridors'
import type { SectionData, BikeNetworkData, CommunityData, GuideItem, ReachRow } from './types'
import { captureReachLoaded } from './ReachSection'
import NearbyShell from './NearbyShell'
import NearbyDesktop from './NearbyDesktop'
import { useIsDesktop } from './useIsDesktop'

const REFRESH_MS = 30_000

interface Located {
  lat: number
  lng: number
  /** Shareable label — city/town only, never a street address (it goes in the URL) */
  label: string
  city: string
  /** Full address for on-screen display + advisor prefill; never leaves this browser */
  fullAddress: string | null
  source: 'geolocation' | 'address' | 'url'
}

export default function NearbySnapshot() {
  const searchParams = useSearchParams()
  const isDesktop = useIsDesktop()

  const [location, setLocation] = useState<Located | null>(null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [address, setAddress] = useState('')

  // Per-section data
  const [rail, setRail] = useState<SectionData<MBTAStopLive[]>>({ status: 'loading', data: [] })
  const [bus, setBus] = useState<SectionData<MBTAStopLive[]>>({ status: 'loading', data: [] })
  const [bluebikes, setBluebikes] = useState<SectionData<BluebikeStationLive[]>>({ status: 'loading', data: [] })
  const [bikeNetwork, setBikeNetwork] = useState<SectionData<BikeNetworkData | null>>({ status: 'loading', data: null })
  const [community, setCommunity] = useState<SectionData<CommunityData | null>>({ status: 'loading', data: null })
  const [guides, setGuides] = useState<SectionData<GuideItem[]>>({ status: 'loading', data: [] })
  const [reach, setReach] = useState<SectionData<ReachRow[]>>({ status: 'loading', data: [] })
  const [transitCorridors, setTransitCorridors] = useState<SectionData<TransitCorridor[]>>({ status: 'loading', data: [] })

  const refreshBusyRef = useRef(false)
  const cityRef = useRef('')
  const loadSeqRef = useRef(0)

  /** Single entry point for a chosen location — rounds coords, updates the
   *  URL (refresh keeps state, link is shareable), fires analytics. */
  const setLocated = useCallback((loc: Located) => {
    const rounded = { ...loc, lat: round3(loc.lat), lng: round3(loc.lng) }
    setLocation(rounded)
    setLocating(false)
    setGeoError(null)
    window.history.replaceState(null, '', buildShareUrl(rounded.lat, rounded.lng, rounded.label))
    posthog.capture('snapshot_location_set', {
      method: rounded.source,
      outside_area: isOutsideArea(rounded.lat, rounded.lng),
    })
  }, [])

  // URL hydration — a valid ?lat&lng skips the gate entirely
  useEffect(() => {
    const parsed = parseSnapshotParams(new URLSearchParams(searchParams.toString()))
    posthog.capture('snapshot_viewed', { has_url_coords: !!parsed })
    if (parsed) {
      setLocation({ ...parsed, city: parsed.label, fullAddress: null, source: 'url' })
    }
  // Mount only — later URL changes come from our own replaceState
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Data loading ── */

  const loadAll = useCallback((loc: Located) => {
    const { lat, lng } = loc
    setRail({ status: 'loading', data: [] })
    setBus({ status: 'loading', data: [] })
    setBluebikes({ status: 'loading', data: [] })
    setBikeNetwork({ status: 'loading', data: null })
    setCommunity({ status: 'loading', data: null })
    setGuides({ status: 'loading', data: [] })
    setReach({ status: 'loading', data: [] })
    setTransitCorridors({ status: 'loading', data: [] })

    // Corridors: list first (from the same cached stop topology), then fill
    // each corridor's end-to-end shape and weekday frequency as they resolve
    const seq = ++loadSeqRef.current
    ;(async () => {
      try {
        const corridors = await buildTransitCorridors(lat, lng)
        if (loadSeqRef.current !== seq) return
        setTransitCorridors({ status: 'ready', data: corridors })
        posthog.capture('snapshot_section_loaded', { section: 'corridors', count: corridors.length })

        for (const corridor of corridors) {
          fetchCorridorMeta(corridor)
            .then(meta => {
              if (loadSeqRef.current !== seq) return
              setTransitCorridors(prev => ({
                ...prev,
                data: prev.data.map(c => (c.id === corridor.id
                  ? { ...c, shape: meta.shape, frequency: meta.frequency ?? 'unavailable', directions: meta.directions }
                  : c)),
              }))
            })
            .catch(() => {
              if (loadSeqRef.current !== seq) return
              setTransitCorridors(prev => ({
                ...prev,
                data: prev.data.map(c => (c.id === corridor.id ? { ...c, frequency: 'unavailable' as const } : c)),
              }))
            })
        }
      } catch {
        if (loadSeqRef.current !== seq) return
        setTransitCorridors({ status: 'error', data: [] })
      }
    })()

    // Self-heal: transient upstream failures (rate limits) leave a corridor
    // "unavailable" — retry those once after the rate window resets
    setTimeout(() => {
      if (loadSeqRef.current !== seq) return
      setTransitCorridors(prev => {
        for (const corridor of prev.data) {
          if (corridor.frequency !== 'unavailable' && corridor.shape !== null) continue
          fetchCorridorMeta(corridor)
            .then(meta => {
              if (loadSeqRef.current !== seq) return
              setTransitCorridors(p => ({
                ...p,
                data: p.data.map(c => (c.id === corridor.id
                  ? { ...c, shape: meta.shape, frequency: meta.frequency ?? 'unavailable', directions: meta.directions }
                  : c)),
              }))
            })
            .catch(() => {})
        }
        return prev
      })
    }, 75_000)

    fetchTrainStops(lat, lng, SNAPSHOT_RAIL_TYPES, SNAPSHOT_RAIL_PREFIX, SNAPSHOT_MAX_STOPS).then(rows => {
      setRail({ status: 'ready', data: rows })
      posthog.capture('snapshot_section_loaded', { section: 'rail', count: rows.length })
    })
    fetchMBTAStops(lat, lng, SNAPSHOT_BUS_OPTS).then(rows => {
      setBus({ status: 'ready', data: rows })
      posthog.capture('snapshot_section_loaded', { section: 'bus', count: rows.length })
    })
    fetchBluebikes(lat, lng).then(rows => {
      setBluebikes({ status: 'ready', data: rows })
      posthog.capture('snapshot_section_loaded', { section: 'bluebikes', count: rows.length })
    })

    // Bike network, progressively: the close-in network paints immediately,
    // then the full 3-mile network (the connectors — Paul Dudley path,
    // Minuteman, …) swaps in when it arrives. Both radii are server-cached.
    ;(async () => {
      try {
        // v= busts browser HTTP caches (max-age=86400) when the lane
        // classification changes server-side (v2: sidepath detection)
        const res = await fetch(`/api/bike-network?lat=${lat}&lng=${lng}&radius=1.5&v=2`)
        if (!res.ok) throw new Error(`bike-network ${res.status}`)
        const data: BikeNetworkData = await res.json()
        if (loadSeqRef.current !== seq) return
        setBikeNetwork({ status: 'ready', data })
        posthog.capture('snapshot_section_loaded', {
          section: 'bike_network',
          count: data.counts.path + data.counts.protected + data.counts.painted,
        })
        const wide = await fetch(`/api/bike-network?lat=${lat}&lng=${lng}&radius=3&v=2`)
        if (wide.ok) {
          const wideData: BikeNetworkData = await wide.json()
          if (loadSeqRef.current !== seq) return
          setBikeNetwork({ status: 'ready', data: wideData })
        }
      } catch {
        if (loadSeqRef.current !== seq) return
        setBikeNetwork({ status: 'error', data: null })
        posthog.capture('snapshot_section_error', { section: 'bike_network' })
      }
    })()

    // Non-car highways: transit + bike times to landmark destinations
    ;(async () => {
      try {
        // v= busts browser HTTP caches (max-age=86400) when the response
        // shape or lane classification changes — bump it alongside the
        // server's cache-key version (v6: sidepath-aware comfort tiers)
        const res = await fetch(`/api/nearby/reach?lat=${lat}&lng=${lng}&v=6`)
        if (!res.ok) throw new Error(`reach ${res.status}`)
        const data = await res.json()
        setReach({ status: 'ready', data: data.destinations ?? [] })
        captureReachLoaded((data.destinations ?? []).length)
      } catch {
        setReach({ status: 'error', data: [] })
        posthog.capture('snapshot_section_error', { section: 'reach' })
      }
    })()

    // Community: events + roams (+ partners when we know the town)
    ;(async () => {
      try {
        const town = loc.city || cityRef.current
        const res = await fetch(`/api/nearby/events?lat=${lat}&lng=${lng}${town ? `&town=${encodeURIComponent(town)}` : ''}`)
        if (!res.ok) throw new Error(`events ${res.status}`)
        setCommunity({ status: 'ready', data: await res.json() })
      } catch {
        setCommunity({ status: 'error', data: null })
      }
    })()

    // The full approved guide library (~20 rows) — the contextual pickers
    // choose per section, so the Bluebikes guide (not a starter) is in reach
    ;(async () => {
      const { data } = await supabase
        .from('content_items')
        .select('id, slug, title, summary, primary_mode, topics, is_starter')
        .eq('content_type', 'micro_guide')
        .eq('status', 'approved')
        .in('primary_mode', ['cycling', 'transit', 'walking'])
        .contains('surfaces', ['guide_library'])
        .order('title', { ascending: true })
        .limit(30)
      setGuides({ status: 'ready', data: (data ?? []) as GuideItem[] })
    })()
  }, [])

  // Load on location; refresh live numbers every 30 s while the tab is visible
  useEffect(() => {
    if (!location) return
    loadAll(location)

    const { lat, lng } = location
    const timer = setInterval(async () => {
      if (document.hidden || refreshBusyRef.current) return
      refreshBusyRef.current = true
      try {
        const [railRows, busRows, bbRows] = await Promise.all([
          fetchTrainStops(lat, lng, SNAPSHOT_RAIL_TYPES, SNAPSHOT_RAIL_PREFIX, SNAPSHOT_MAX_STOPS),
          fetchMBTAStops(lat, lng, SNAPSHOT_BUS_OPTS),
          fetchBluebikes(lat, lng),
        ])
        setRail({ status: 'ready', data: railRows })
        setBus({ status: 'ready', data: busRows })
        setBluebikes({ status: 'ready', data: bbRows })
      } finally {
        refreshBusyRef.current = false
      }
    }, REFRESH_MS)

    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.lat, location?.lng])

  /* ── Location entry ── */

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setGeoError('Location isn’t available in this browser — type an address instead.')
      return
    }
    setGeoError(null)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = round3(pos.coords.latitude)
        const lng = round3(pos.coords.longitude)
        setLocated({ lat, lng, label: '', city: '', fullAddress: null, source: 'geolocation' })
        // Best-effort city label for the header + share URL
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
            { headers: { Accept: 'application/json' } }
          )
          const data = await res.json()
          const city = data.address?.city ?? data.address?.town ?? data.address?.village ?? ''
          if (city) {
            cityRef.current = city
            setLocation(prev => {
              if (!prev) return prev
              window.history.replaceState(null, '', buildShareUrl(prev.lat, prev.lng, city))
              return { ...prev, label: city, city }
            })
          }
        } catch { /* label stays generic */ }
      },
      () => {
        setLocating(false)
        setGeoError('Location access was denied — type an address instead and we’ll take it from there.')
        posthog.capture('snapshot_location_denied')
      },
      { timeout: 8000, maximumAge: 60_000 }
    )
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      posthog.capture('snapshot_share_copied')
    }).catch(() => {})
  }

  function handleChangeLocation() {
    setLocation(null)
    setAddress('')
    setGeoError(null)
    cityRef.current = ''
    window.history.replaceState(null, '', NEARBY_PATH)
  }

  function handleAdvisorCta() {
    posthog.capture('snapshot_advisor_cta_clicked')
    if (!location) return
    try {
      sessionStorage.setItem('commute-advisor-state', JSON.stringify({
        homeAddress: location.fullAddress ?? location.label,
        homePlaceData: { placeId: '', lat: location.lat, lng: location.lng },
        step: 1,
      }))
    } catch {}
  }

  const retry = useCallback(() => { if (location) loadAll(location) }, [location, loadAll])

  // Named bike corridors become selectable entities; everything else —
  // unnamed segments, named lanes that didn't make the corridor cut, and
  // same-named streets in OTHER towns — stays as background lines, tappable
  // with their street name. Claimed features are matched by identity.
  const bikeBuild = useMemo(
    () => (location && bikeNetwork.data
      ? buildBikeCorridors(bikeNetwork.data.geojson, location.lat, location.lng)
      : { corridors: [], claimed: new Set<unknown>() }),
    [bikeNetwork.data, location]
  )
  const bikeCorridors = bikeBuild.corridors
  const backgroundLines = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!bikeNetwork.data) return null
    return {
      type: 'FeatureCollection',
      features: bikeNetwork.data.geojson.features.filter(f => !bikeBuild.claimed.has(f)),
    }
  }, [bikeNetwork.data, bikeBuild])

  /* ── Render ── */

  if (!location) {
    return (
      <div className="mx-auto max-w-[640px] px-6 pb-24 pt-14">
        <div className="text-center">
          <div className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#BAF14D]">
            New to the area?
          </div>
          <h1 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-[1.12] tracking-tighter text-white">
            See how your neighborhood <em className="not-italic text-[#BAF14D]">moves</em>
          </h1>
          <p className="mx-auto mt-3 max-w-[46ch] text-[1rem] leading-relaxed text-white/75">
            The T stations, bus routes, Bluebikes docks, and bike paths around your new home — live, on a map, in seconds.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-[440px] rounded-[20px] border border-white/[0.12] bg-[#242538] p-7">
          <button
            onClick={handleUseMyLocation}
            disabled={locating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#BAF14D] py-3.5 text-[0.9375rem] font-bold text-[#191A2E] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {locating ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#191A2E]/30 border-t-[#191A2E]" />
                Finding you…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 256 256" fill="currentColor"><path d="M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a88.1,88.1,0,0,0-88,88c0,31.4,14.51,64.68,42,96.25a254.19,254.19,0,0,0,41.45,38.3,8,8,0,0,0,9.18,0A254.19,254.19,0,0,0,174,200.25c27.45-31.57,42-64.85,42-96.25A88.1,88.1,0,0,0,128,16Zm0,206c-16.53-13-72-60.75-72-118a72,72,0,0,1,144,0C200,161.23,144.53,209,128,222Z"/></svg>
                Use my location
              </>
            )}
          </button>

          {geoError && (
            <p className="mt-3 text-[0.8125rem] leading-snug text-white/75">{geoError}</p>
          )}

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.12]" />
            <span className="text-[0.75rem] font-semibold uppercase tracking-wider text-white/70">or</span>
            <div className="h-px flex-1 bg-white/[0.12]" />
          </div>

          <AddressAutocomplete
            value={address}
            onChange={setAddress}
            onCityDetected={(city) => {
              cityRef.current = city
              setLocation(prev => {
                if (!prev) return prev
                window.history.replaceState(null, '', buildShareUrl(prev.lat, prev.lng, city))
                return { ...prev, label: city, city }
              })
            }}
            onPlaceSelected={(place) => {
              setLocated({
                lat: place.lat,
                lng: place.lng,
                label: cityRef.current,
                city: cityRef.current,
                fullAddress: place.address,
                source: 'address',
              })
            }}
            label={null}
            variant="dark"
            placeholder="Type your new address…"
          />
          <p className="mt-3 text-[0.75rem] leading-snug text-white/75">
            Your address is only used to look things up — it never appears in the page link, and shared links carry a neighborhood-level location only.
          </p>
        </div>
      </div>
    )
  }

  const outside = isOutsideArea(location.lat, location.lng)
  const displayLabel = location.fullAddress ?? (location.label || 'Your location')
  const partnerLine = community.data?.partners && community.data.partners.count > 0
    ? `Unlock perks at ${community.data.partners.count} local business${community.data.partners.count === 1 ? '' : 'es'} near you${community.data.partners.names[0] ? ` — like ${community.data.partners.names.slice(0, 2).join(' and ')}` : ''}.`
    : 'Track your trips, feel the health gains, and unlock perks at partner businesses around town.'

  // Phones and tablets get the app shell (map stage + tabbed bottom sheet);
  // desktop gets the two-pane layout (sticky map + content rail). Both own
  // their mode-filter state and consume the same model/overlay hooks.
  const surfaceProps = {
    center: location,
    displayLabel,
    outside,
    copied,
    onCopyLink: handleCopyLink,
    onChangeLocation: handleChangeLocation,
    onAdvisorCta: handleAdvisorCta,
    partnerLine,
    transitCorridors: transitCorridors.data,
    bikeCorridors,
    rail: rail.data,
    bus: bus.data,
    docks: bluebikes.data,
    backgroundLines,
    transitStatus: transitCorridors.status,
    reach,
    community,
    guides,
    onRetry: retry,
  }

  return isDesktop ? <NearbyDesktop {...surfaceProps} /> : <NearbyShell {...surfaceProps} />
}
