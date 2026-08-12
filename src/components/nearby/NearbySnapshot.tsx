'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
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
import { SectionShell } from './SectionShell'
import CorridorExplorer from './CorridorExplorer'
import ReachSection, { captureReachLoaded } from './ReachSection'
import EventsGuides from './EventsGuides'

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
                  ? { ...c, shape: meta.shape, frequency: meta.frequency ?? 'unavailable' }
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
                  ? { ...c, shape: meta.shape, frequency: meta.frequency ?? 'unavailable' }
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

    // Bike network: widen once to 3 mi if no protected route in the default radius
    ;(async () => {
      try {
        let res = await fetch(`/api/bike-network?lat=${lat}&lng=${lng}&radius=1.5`)
        if (!res.ok) throw new Error(`bike-network ${res.status}`)
        let data: BikeNetworkData = await res.json()
        if (!data.nearest_protected) {
          const wide = await fetch(`/api/bike-network?lat=${lat}&lng=${lng}&radius=3`)
          if (wide.ok) data = await wide.json()
        }
        setBikeNetwork({ status: 'ready', data })
        posthog.capture('snapshot_section_loaded', {
          section: 'bike_network',
          count: data.counts.separated + data.counts.painted,
        })
      } catch {
        setBikeNetwork({ status: 'error', data: null })
        posthog.capture('snapshot_section_error', { section: 'bike_network' })
      }
    })()

    // Non-car highways: transit + bike times to landmark destinations
    ;(async () => {
      try {
        const res = await fetch(`/api/nearby/reach?lat=${lat}&lng=${lng}`)
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

    // Starter guides for transit / cycling / walking
    ;(async () => {
      const { data } = await supabase
        .from('content_items')
        .select('id, slug, title, summary, primary_mode')
        .eq('content_type', 'micro_guide')
        .eq('status', 'approved')
        .eq('is_starter', true)
        .in('primary_mode', ['cycling', 'transit', 'walking'])
        .contains('surfaces', ['guide_library'])
        .order('title', { ascending: true })
        .limit(6)
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

  // Named bike corridors become selectable entities; unnamed segments stay
  // as background lines on the map
  const bikeCorridors = useMemo(
    () => (location && bikeNetwork.data ? buildBikeCorridors(bikeNetwork.data.geojson, location.lat, location.lng) : []),
    [bikeNetwork.data, location]
  )
  const backgroundLines = useMemo<GeoJSON.FeatureCollection | null>(
    () => bikeNetwork.data
      ? {
          type: 'FeatureCollection',
          features: bikeNetwork.data.geojson.features.filter(
            f => !(f.properties as { name?: string | null })?.name
          ),
        }
      : null,
    [bikeNetwork.data]
  )

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

  return (
    <div className="pb-20">
      {/* Location header */}
      <div className="mx-auto max-w-[720px] px-6 pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#BAF14D]">
              Your neighborhood snapshot
            </div>
            <h1 className="mt-1 truncate font-display text-[1.5rem] font-extrabold tracking-tight text-white">
              {displayLabel}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="rounded-lg border border-white/[0.15] px-3.5 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              {copied ? 'Copied ✓' : 'Copy link'}
            </button>
            <button
              onClick={handleChangeLocation}
              className="rounded-lg border border-white/[0.15] px-3.5 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              Change location
            </button>
          </div>
        </div>

        {outside && (
          <p className="mt-4 rounded-xl border border-[#EDB93C]/30 bg-[#EDB93C]/10 px-5 py-3.5 text-[0.875rem] leading-relaxed text-white">
            This spot looks like it&apos;s outside Greater Boston, where our transit and Bluebikes data lives. Bike-path data covers all of Massachusetts, so parts of the picture may still fill in.
          </p>
        )}
      </div>

      <SectionShell
        eyebrow="Getting in and out"
        title="Your corridors"
        subtitle="Every route worth knowing — T lines, buses, and comfortable bike routes, with how often they run. Tap any route on the map or in the list to see the whole line and where it goes."
      >
        <CorridorExplorer
          center={location}
          transitCorridors={transitCorridors.data}
          bikeCorridors={bikeCorridors}
          rail={rail.data}
          bus={bus.data}
          docks={bluebikes.data}
          backgroundLines={backgroundLines}
          transitStatus={transitCorridors.status}
          onRetry={retry}
        />
      </SectionShell>
      <ReachSection reach={reach} onRetry={retry} />
      <EventsGuides community={community} guides={guides} />

      {/* CTA bridge */}
      <div className="mx-auto max-w-[720px] space-y-4 px-6 pt-2">
        <div className="rounded-2xl border border-[rgba(186,241,77,0.18)] bg-[linear-gradient(135deg,rgba(41,102,229,0.15),rgba(186,241,77,0.08))] px-7 py-6">
          <div className="mb-1 font-display text-[1.0625rem] font-extrabold tracking-tight text-white">
            Have a destination in mind?
          </div>
          <p className="mb-3.5 text-[0.85rem] leading-relaxed text-white/80">
            Add where you work or study and the Commute Advisor compares every way to get there — time, cost, and health — with your home already filled in.
          </p>
          <Link
            href="/commute-advisor"
            onClick={handleAdvisorCta}
            className="inline-block rounded-lg bg-[#BAF14D] px-4 py-2 text-[0.8125rem] font-bold text-[#191A2E] transition-opacity hover:opacity-85"
          >
            Compare your options →
          </Link>
        </div>

        <div className="rounded-2xl border border-white/[0.1] bg-[#242538] px-7 py-6">
          <div className="mb-1 font-display text-[1.0625rem] font-extrabold tracking-tight text-white">
            Get the Shift app
          </div>
          <p className="mb-3.5 text-[0.85rem] leading-relaxed text-white/80">{partnerLine}</p>
          <a
            href="/shift"
            onClick={() => posthog.capture('snapshot_app_cta_clicked')}
            className="inline-block rounded-lg border border-[#BAF14D] px-4 py-2 text-[0.8125rem] font-bold text-[#BAF14D] transition-colors hover:bg-[#BAF14D] hover:text-[#191A2E]"
          >
            Download the app →
          </a>
        </div>
      </div>
    </div>
  )
}
