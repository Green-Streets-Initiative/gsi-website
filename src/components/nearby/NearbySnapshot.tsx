'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { supabase } from '@/lib/supabase'
import type { BluebikeStationLive, MBTAStopLive } from '@/lib/wayfinding/types'
import { fetchBluebikes, fetchMBTAStops, fetchTrainStops } from '@/lib/nearby/live-data'
import { fetchNearbyAlerts, type SurfacedAlert, type NearbyPromo } from '@/lib/nearby/alerts'
import { round3, parseSnapshotParams, buildShareUrl, stickyParams, isOutsideArea } from '@/lib/nearby/share'
import { parsePartnerSlug, fetchPartner, type NearbyPartner } from '@/lib/nearby/partner'
import { resolvePlaceLabel, combinePlaceLabel, splitPlaceLabel } from '@/lib/nearby/neighborhood'
import { fetchPopularBikeStreets } from '@/lib/nearby/popularity'
import { NEARBY_PATH } from '@/lib/nearby/config'
import {
  buildTransitCorridors, buildBikeCorridors, fetchCorridorMeta, seedCorridorFromStop,
  SNAPSHOT_BUS_OPTS, SNAPSHOT_RAIL_PREFIX, SNAPSHOT_RAIL_TYPES, SNAPSHOT_RAIL_MAX_STATIONS,
  type TransitCorridor,
} from '@/lib/nearby/corridors'
import type { SectionData, BikeNetworkData, CommunityData, GuideItem, ReachRow } from './types'
import { captureReachLoaded } from './ReachSection'
import NearbyShell from './NearbyShell'
import NearbyDesktop from './NearbyDesktop'
import PartnerCobrand from './PartnerCobrand'
import { useIsDesktop } from './useIsDesktop'
import { t, resolveNearbyLocale } from '@/lib/nearby/i18n'
import { NearbyI18nProvider } from './NearbyI18n'
import { NearbyPromosProvider } from './NearbyPromos'
import NearbyLanguagePill from './NearbyLanguagePill'

const REFRESH_MS = 30_000

interface Located {
  lat: number
  lng: number
  /** Shareable label — "Neighborhood, Town" (or just town); never a street
   *  address (it goes in the URL). Neighborhood is a district, not PII. */
  label: string
  /** Town (Google locality) — drives the events/town query and the sub-label */
  city: string
  /** Neighborhood from the shared `neighborhoods` table; null until resolved
   *  or when the point falls in no mapped neighborhood */
  neighborhood: string | null
  /** Full address for advisor prefill; never leaves this browser or the URL */
  fullAddress: string | null
  source: 'geolocation' | 'address' | 'url'
}

export default function NearbySnapshot() {
  const searchParams = useSearchParams()
  const isDesktop = useIsDesktop()

  // Locale from ?lang= (wins) or the browser; provided to the whole tree below.
  // Browser language resolves after mount to avoid a hydration mismatch (server
  // has no navigator), so a non-English browser without ?lang= starts in
  // English for one paint, then switches.
  const langParam = searchParams.get('lang')
  const [browserLang, setBrowserLang] = useState<string | null>(null)
  useEffect(() => {
    setBrowserLang(typeof navigator !== 'undefined' ? navigator.language : null)
  }, [])
  const locale = resolveNearbyLocale(langParam, browserLang)
  const tr = (key: string, replacements?: Record<string, string | number>) => t(locale, key, replacements)

  const [location, setLocation] = useState<Located | null>(null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [address, setAddress] = useState('')

  // Per-section data
  const [rail, setRail] = useState<SectionData<MBTAStopLive[]>>({ status: 'loading', data: [] })
  const [bus, setBus] = useState<SectionData<MBTAStopLive[]>>({ status: 'loading', data: [] })
  const [alerts, setAlerts] = useState<SurfacedAlert[]>([])
  // Contextual promos (Bluebikes closure credit, etc.) — global config, matched
  // to alerts in the detail blocks. Fetched once; fails soft to none.
  const [promos, setPromos] = useState<NearbyPromo[]>([])
  useEffect(() => {
    let cancelled = false
    fetch('/api/nearby/promo')
      .then(r => (r.ok ? r.json() : { promos: [] }))
      .then(d => { if (!cancelled) setPromos(Array.isArray(d?.promos) ? d.promos : []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  const [bluebikes, setBluebikes] = useState<SectionData<BluebikeStationLive[]>>({ status: 'loading', data: [] })
  const [bikeNetwork, setBikeNetwork] = useState<SectionData<BikeNetworkData | null>>({ status: 'loading', data: null })
  const [community, setCommunity] = useState<SectionData<CommunityData | null>>({ status: 'loading', data: null })
  const [guides, setGuides] = useState<SectionData<GuideItem[]>>({ status: 'loading', data: [] })
  const [reach, setReach] = useState<SectionData<ReachRow[]>>({ status: 'loading', data: [] })
  const [transitCorridors, setTransitCorridors] = useState<SectionData<TransitCorridor[]>>({ status: 'loading', data: [] })
  // Streets Shift riders actually ride (town heatmap) — badge data only,
  // never part of ranking. Empty until the town resolves; empty = no badges.
  const [popularBikeStreetKeys, setPopularBikeStreetKeys] = useState<Set<string>>(new Set())

  const refreshBusyRef = useRef(false)
  const cityRef = useRef('')
  const loadSeqRef = useRef(0)
  // Routes we've already fetched on demand (a tapped station whose line was
  // outside the nearby top-8), so a marker/live refresh doesn't refetch.
  const onDemandRoutesRef = useRef<Set<string>>(new Set())

  // Partner co-brand (outreach deep links): the slug is read once at mount,
  // independently of the coord params — every combination of partner/coords
  // must work. Malformed or unknown slugs resolve to null silently.
  const partnerSlug = useMemo(
    () => parsePartnerSlug(new URLSearchParams(searchParams.toString())),
    // Mount only — the slug never changes without a full navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [partner, setPartner] = useState<NearbyPartner | null>(null)
  useEffect(() => {
    if (!partnerSlug) return
    let cancelled = false
    fetchPartner(partnerSlug).then(p => { if (!cancelled) setPartner(p) })
    return () => { cancelled = true }
  }, [partnerSlug])

  /** Single entry point for a chosen location — rounds coords, updates the
   *  URL (refresh keeps state, link is shareable; partner/utm params ride
   *  along), fires analytics. */
  const setLocated = useCallback((loc: Located) => {
    const rounded = { ...loc, lat: round3(loc.lat), lng: round3(loc.lng) }
    setLocation(rounded)
    setLocating(false)
    setGeoError(null)
    window.history.replaceState(null, '', buildShareUrl(rounded.lat, rounded.lng, rounded.label, stickyParams(window.location.search)))
    posthog.capture('snapshot_location_set', {
      method: rounded.source,
      outside_area: isOutsideArea(rounded.lat, rounded.lng),
      ...(partnerSlug ? { partner: partnerSlug } : {}),
    })
  }, [partnerSlug])

  // URL hydration — a valid ?lat&lng skips the gate entirely. The label
  // param already carries "Neighborhood, Town" from whoever shared it, so
  // split it for instant display instead of re-resolving over the network.
  useEffect(() => {
    const parsed = parseSnapshotParams(new URLSearchParams(searchParams.toString()))
    posthog.capture('snapshot_viewed', {
      has_url_coords: !!parsed,
      ...(partnerSlug ? { partner: partnerSlug } : {}),
    })
    if (parsed) {
      const { neighborhood, town } = splitPlaceLabel(parsed.label)
      setLocation({ ...parsed, city: town ?? '', neighborhood, fullAddress: null, source: 'url' })
    }
  // Mount only — later URL changes come from our own replaceState
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Resolve neighborhood + town from the shared Supabase source (same data
  // the Shift app uses) for locations we set ourselves — geolocation gives
  // only coords, and the address path's town needs its neighborhood filled
  // in. URL-hydrated locations already carry a parsed label, so skip them.
  useEffect(() => {
    if (!location || location.source === 'url') return
    let cancelled = false
    ;(async () => {
      const resolved = await resolvePlaceLabel(location.lat, location.lng, location.city || cityRef.current || null)
      if (cancelled) return
      const label = combinePlaceLabel(resolved)
      setLocation(prev => {
        if (!prev) return prev
        if (label) window.history.replaceState(null, '', buildShareUrl(prev.lat, prev.lng, label, stickyParams(window.location.search)))
        return {
          ...prev,
          neighborhood: resolved.neighborhood,
          city: resolved.town ?? prev.city,
          label: label || prev.label,
        }
      })
    })()
    return () => { cancelled = true }
  // Keyed on the point only — resolveLabel patches label/neighborhood, not coords
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.lat, location?.lng])

  // Popular-with-Shift-riders lookup, keyed on the resolved town. Two small
  // anon reads; fails soft to an empty set (no badges, section unchanged).
  useEffect(() => {
    const town = location?.city
    if (!town) {
      setPopularBikeStreetKeys(new Set())
      return
    }
    let cancelled = false
    fetchPopularBikeStreets(town).then(keys => {
      if (!cancelled) setPopularBikeStreetKeys(keys)
    })
    return () => { cancelled = true }
  }, [location?.city])

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
    onDemandRoutesRef.current = new Set()

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

    const railP = fetchTrainStops(lat, lng, SNAPSHOT_RAIL_TYPES, SNAPSHOT_RAIL_PREFIX, SNAPSHOT_RAIL_MAX_STATIONS)
    const busP = fetchMBTAStops(lat, lng, SNAPSHOT_BUS_OPTS)
    railP.then(rows => {
      setRail({ status: 'ready', data: rows })
      posthog.capture('snapshot_section_loaded', { section: 'rail', count: rows.length })
    })
    busP.then(rows => {
      setBus({ status: 'ready', data: rows })
      posthog.capture('snapshot_section_loaded', { section: 'bus', count: rows.length })
    })
    // Service alerts for the routes we're about to show (major effects only).
    Promise.all([railP, busP]).then(([railRows, busRows]) =>
      fetchNearbyAlerts([...railRows, ...busRows].map(r => r.route_id)).then(setAlerts),
    )
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
        // classification changes server-side (v2: sidepath detection,
        // v3: name inheritance, v4: 45 m inheritance radius)
        const res = await fetch(`/api/bike-network?lat=${lat}&lng=${lng}&radius=1.5&v=5`)
        if (!res.ok) throw new Error(`bike-network ${res.status}`)
        const data: BikeNetworkData = await res.json()
        if (loadSeqRef.current !== seq) return
        setBikeNetwork({ status: 'ready', data })
        posthog.capture('snapshot_section_loaded', {
          section: 'bike_network',
          count: data.counts.path + data.counts.protected + data.counts.painted,
        })
        const wide = await fetch(`/api/bike-network?lat=${lat}&lng=${lng}&radius=3&v=5`)
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
        // server's cache-key version (v9: comfort segments name their street)
        const res = await fetch(`/api/nearby/reach?lat=${lat}&lng=${lng}&v=9`)
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
          fetchTrainStops(lat, lng, SNAPSHOT_RAIL_TYPES, SNAPSHOT_RAIL_PREFIX, SNAPSHOT_RAIL_MAX_STATIONS),
          fetchMBTAStops(lat, lng, SNAPSHOT_BUS_OPTS),
          fetchBluebikes(lat, lng),
        ])
        setRail({ status: 'ready', data: railRows })
        setBus({ status: 'ready', data: busRows })
        setBluebikes({ status: 'ready', data: bbRows })
        fetchNearbyAlerts([...railRows, ...busRows].map(r => r.route_id)).then(setAlerts)
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
      setGeoError(tr('snap.geo_unavailable'))
      return
    }
    setGeoError(null)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = round3(pos.coords.latitude)
        const lng = round3(pos.coords.longitude)
        // Neighborhood + town fill in via the resolve effect (shared source)
        setLocated({ lat, lng, label: '', city: '', neighborhood: null, fullAddress: null, source: 'geolocation' })
      },
      () => {
        setLocating(false)
        setGeoError(tr('snap.geo_denied'))
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

  // The page URL already carries the rounded coords + city-only label (the
  // full address never leaves the browser), so the print link is just the
  // current query on the print path
  function handlePrint() {
    posthog.capture('snapshot_print_clicked')
    window.location.assign(`/nearby/print${window.location.search}`)
  }

  function handleChangeLocation() {
    setLocation(null)
    setAddress('')
    setGeoError(null)
    cityRef.current = ''
    // Location params go; the partner co-brand and any campaign utm stay
    const sticky = stickyParams(window.location.search).toString()
    window.history.replaceState(null, '', sticky ? `${NEARBY_PATH}?${sticky}` : NEARBY_PATH)
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

  /** Hand a specific destination to the Commute Advisor — home AND
   *  destination prefilled, so the user lands one tap from a comparison. */
  const handlePlanCommute = useCallback((row: { id: string; name: string; lat: number; lng: number }) => {
    posthog.capture('snapshot_plan_commute_clicked', { destination: row.id })
    if (!location) return
    try {
      sessionStorage.setItem('commute-advisor-state', JSON.stringify({
        homeAddress: location.fullAddress ?? location.label,
        homePlaceData: { placeId: '', lat: location.lat, lng: location.lng },
        workAddress: row.name,
        workPlaceData: { placeId: '', lat: row.lat, lng: row.lng },
        step: 1,
      }))
    } catch {}
  }, [location])

  const retry = useCallback(() => { if (location) loadAll(location) }, [location, loadAll])

  /** A tapped station whose line fell outside the nearby top-8 has no shape to
   *  draw (the Orange Line at Sullivan Sq). Fetch that one line on demand from
   *  a live stop row and append it to the corridor set so its polyline draws.
   *  One extra call, only on tap; deduped per route, cleared on relocation. */
  const requestCorridorShape = useCallback((routeId: string, stopId: string) => {
    if (onDemandRoutesRef.current.has(routeId)) return
    const rows = [...rail.data, ...bus.data]
    const row = rows.find(r => r.stop_id === stopId && r.route_id === routeId)
      ?? rows.find(r => r.route_id === routeId)
    if (!row) return
    onDemandRoutesRef.current.add(routeId)
    const seed = seedCorridorFromStop(routeId, row)
    const seq = loadSeqRef.current
    setTransitCorridors(prev =>
      prev.data.some(c => c.routeId === routeId) ? prev : { ...prev, data: [...prev.data, seed] },
    )
    fetchCorridorMeta(seed)
      .then(meta => {
        if (loadSeqRef.current !== seq) return
        setTransitCorridors(prev => ({
          ...prev,
          data: prev.data.map(c => (c.id === seed.id
            ? { ...c, shape: meta.shape, frequency: meta.frequency ?? 'unavailable', directions: meta.directions }
            : c)),
        }))
      })
      .catch(() => {
        if (loadSeqRef.current !== seq) return
        onDemandRoutesRef.current.delete(routeId)
        setTransitCorridors(prev => ({
          ...prev,
          data: prev.data.map(c => (c.id === seed.id ? { ...c, frequency: 'unavailable' as const } : c)),
        }))
      })
  }, [rail.data, bus.data])

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
      <NearbyI18nProvider locale={locale}>
      <div className="mx-auto max-w-[640px] px-6 pb-24 pt-14">
        <div className="mb-4 flex justify-end">
          <NearbyLanguagePill />
        </div>
        <div className="text-center">
          <div className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#BAF14D]">
            {tr('snap.eyebrow')}
          </div>
          <h1 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-[1.12] tracking-tighter text-white">
            {tr('snap.headline_lead')}<em className="not-italic text-[#BAF14D]">{tr('snap.headline_em')}</em>{tr('snap.headline_tail')}
          </h1>
          <p className="mx-auto mt-3 max-w-[46ch] text-[1rem] leading-relaxed text-white/75">
            {tr('snap.subtitle')}
          </p>
          {partner && (
            <div className="mt-4">
              <PartnerCobrand partner={partner} center logoClass="max-h-7" />
            </div>
          )}
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
                {tr('snap.finding_you')}
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 256 256" fill="currentColor"><path d="M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a88.1,88.1,0,0,0-88,88c0,31.4,14.51,64.68,42,96.25a254.19,254.19,0,0,0,41.45,38.3,8,8,0,0,0,9.18,0A254.19,254.19,0,0,0,174,200.25c27.45-31.57,42-64.85,42-96.25A88.1,88.1,0,0,0,128,16Zm0,206c-16.53-13-72-60.75-72-118a72,72,0,0,1,144,0C200,161.23,144.53,209,128,222Z"/></svg>
                {tr('snap.use_my_location')}
              </>
            )}
          </button>

          {geoError && (
            <p className="mt-3 text-[0.8125rem] leading-snug text-white/75">{geoError}</p>
          )}

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.12]" />
            <span className="text-[0.75rem] font-semibold uppercase tracking-wider text-white/70">{tr('snap.or')}</span>
            <div className="h-px flex-1 bg-white/[0.12]" />
          </div>

          <AddressAutocomplete
            value={address}
            onChange={setAddress}
            onCityDetected={(city) => {
              // Interim town label; the resolve effect fills in the
              // neighborhood and rewrites this to "Neighborhood, Town"
              cityRef.current = city
              setLocation(prev => (prev ? { ...prev, city } : prev))
            }}
            onPlaceSelected={(place) => {
              setLocated({
                lat: place.lat,
                lng: place.lng,
                label: cityRef.current,
                city: cityRef.current,
                neighborhood: null,
                fullAddress: place.address,
                source: 'address',
              })
            }}
            label={null}
            variant="dark"
            placeholder={tr('snap.address_placeholder')}
          />
          <p className="mt-3 text-[0.75rem] leading-snug text-white/75">
            {tr('snap.address_note')}
          </p>
        </div>
      </div>
      </NearbyI18nProvider>
    )
  }

  const outside = isOutsideArea(location.lat, location.lng)
  // Neighborhood is the headline; town rides beneath it (or is the headline
  // when no neighborhood resolved). The full street address is never shown —
  // it stays in-browser for the advisor handoff only.
  const displayLabel = location.neighborhood || location.city || tr('snap.your_location')
  const subLabel = location.neighborhood ? location.city : null
  const partnerCount = community.data?.partners?.count ?? 0
  const partnerNames = community.data?.partners?.names ?? []
  const partnerNamesSuffix = partnerNames[0]
    ? tr('snap.partner_line_names', { names: partnerNames.slice(0, 2).join(tr('snap.and_join')) })
    : ''
  const partnerLine = partnerCount > 0
    ? tr(partnerCount === 1 ? 'snap.partner_line_one' : 'snap.partner_line_other', {
        count: partnerCount,
        names: partnerNamesSuffix,
      })
    : tr('snap.partner_line_default')

  // Phones and tablets get the app shell (map stage + tabbed bottom sheet);
  // desktop gets the two-pane layout (sticky map + content rail). Both own
  // their mode-filter state and consume the same model/overlay hooks.
  const surfaceProps = {
    center: location,
    displayLabel,
    subLabel,
    outside,
    copied,
    onCopyLink: handleCopyLink,
    onChangeLocation: handleChangeLocation,
    onPrint: handlePrint,
    onAdvisorCta: handleAdvisorCta,
    onPlanCommute: handlePlanCommute,
    partnerLine,
    partner,
    partnerSlug,
    transitCorridors: transitCorridors.data,
    bikeCorridors,
    popularBikeStreetKeys,
    rail: rail.data,
    bus: bus.data,
    docks: bluebikes.data,
    backgroundLines,
    transitStatus: transitCorridors.status,
    reach,
    community,
    guides,
    alerts,
    onRetry: retry,
    onRequestCorridorShape: requestCorridorShape,
  }

  return (
    <NearbyI18nProvider locale={locale}>
      <NearbyPromosProvider promos={promos}>
        {isDesktop ? <NearbyDesktop {...surfaceProps} /> : <NearbyShell {...surfaceProps} />}
      </NearbyPromosProvider>
    </NearbyI18nProvider>
  )
}
