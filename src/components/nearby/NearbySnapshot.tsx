'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { supabase } from '@/lib/supabase'
import type { BluebikeStationLive, MBTAStopLive } from '@/lib/wayfinding/types'
import { fetchBikeShareDocks, fetchMBTAStops, fetchTrainStops, fetchShuttleStops } from '@/lib/nearby/live-data'
import { fetchNearbyAlertsAndClosures, type SurfacedAlert, type NearbyPromo } from '@/lib/nearby/alerts'
import { round3, parseSnapshotParams, buildShareUrl, stickyParams, isOutsideArea } from '@/lib/nearby/share'
import { buildAppHref, isNewRoutesContext } from '@/lib/nearby/campaign'
import { parsePartnerSlug, fetchPartnerClient, type NearbyPartner } from '@/lib/nearby/partner'
import { resolvePlaceLabel, combinePlaceLabel, splitPlaceLabel } from '@/lib/nearby/neighborhood'
import { fetchPopularBikeStreets } from '@/lib/nearby/popularity'
import { NEARBY_PATH } from '@/lib/nearby/config'
import {
  buildTransitCorridors, buildBikeCorridors, fetchCorridorMeta, seedCorridorFromStop,
  SNAPSHOT_BUS_OPTS, SNAPSHOT_RAIL_PREFIX, SNAPSHOT_RAIL_TYPES, SNAPSHOT_RAIL_MAX_STATIONS,
  SNAPSHOT_BUS_FAR_OPTS, SNAPSHOT_RAIL_FAR,
  type TransitCorridor,
} from '@/lib/nearby/corridors'
import type { SectionData, SectionStatus, BikeNetworkData, CommunityData, GuideItem, ReachRow } from './types'
import { captureReachLoaded } from './ReachSection'
import NearbyShell from './NearbyShell'
import NearbyDesktop from './NearbyDesktop'
import PartnerCobrand from './PartnerCobrand'
import NewRoutesOffer from './NewRoutesOffer'
import { useIsDesktop } from './useIsDesktop'
import { t, resolveNearbyLocale, type NearbyLocale } from '@/lib/nearby/i18n'
import { NearbyI18nProvider } from './NearbyI18n'
import { NearbyPromosProvider } from './NearbyPromos'
import NearbyLanguagePill from './NearbyLanguagePill'
import { NearbyToneProvider, type NearbyTone } from './NearbyTone'
import { parseInitialFocus } from '@/lib/nearby/focus'

const REFRESH_MS = 30_000

/** Nearest rail station beyond the normal radius (one station, 0.05°). */
const fetchRailFar = (lat: number, lng: number) =>
  fetchTrainStops(lat, lng, SNAPSHOT_RAIL_TYPES, SNAPSHOT_RAIL_FAR.cachePrefix, SNAPSHOT_RAIL_FAR.maxStations, SNAPSHOT_RAIL_FAR.radiusDeg)

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

export default function NearbySnapshot({ tone = 'dark' }: { tone?: NearbyTone } = {}) {
  const searchParams = useSearchParams()
  // ?focus= opens the page already looking at one station/line/dock/route
  const initialFocus = useMemo(() => parseInitialFocus(searchParams.get('focus')), [searchParams])
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
  // A tap on the language pill lands here, not in the URL: the pill flips
  // this state and mirrors it into ?lang= as a courtesy. Deriving the locale
  // from the URL alone meant the switch waited on a router navigation, and
  // a stalled one left the pill looking dead (Keith, 2026-09-22).
  const [chosenLocale, setChosenLocale] = useState<NearbyLocale | null>(null)
  const locale = chosenLocale ?? resolveNearbyLocale(langParam, browserLang)
  const tr = (key: string, replacements?: Record<string, string | number>) => t(locale, key, replacements)

  const [location, setLocation] = useState<Located | null>(null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [address, setAddress] = useState('')

  // Per-section data
  const [rail, setRail] = useState<SectionData<MBTAStopLive[]>>({ status: 'loading', data: [] })
  const [bus, setBus] = useState<SectionData<MBTAStopLive[]>>({ status: 'loading', data: [] })
  const [shuttles, setShuttles] = useState<SectionData<MBTAStopLive[]>>({ status: 'loading', data: [] })
  // The nearest option beyond the normal radius — filled ONLY when the
  // primary rail/bus fetch found nothing (Boston College has no MBTA bus
  // within 0.7 mi; the list must still say where the nearest one is).
  const [railFar, setRailFar] = useState<MBTAStopLive[]>([])
  const [busFar, setBusFar] = useState<MBTAStopLive[]>([])
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
  // Read from window.location, NOT useSearchParams: the first render can see
  // EMPTY search params (they stream in a re-render later), and a []-deps
  // memo freezes that empty snapshot — the co-brand silently never loaded
  // for some visitors. The browser URL is always correct at client render.
  const partnerSlug = useMemo(
    () => (typeof window === 'undefined'
      ? null
      : parsePartnerSlug(new URLSearchParams(window.location.search))),
    // Mount only — the slug never changes without a full navigation
    [],
  )
  const [partner, setPartner] = useState<NearbyPartner | null>(null)
  // Distinct from `partner` being null: an unknown or blocked slug also
  // resolves to null, and the campaign decision below must not fire before
  // the lookup settles or it would flash the wrong offer in.
  const [partnerResolved, setPartnerResolved] = useState(false)
  useEffect(() => {
    if (!partnerSlug) { setPartnerResolved(true); return }
    let cancelled = false
    // Same-origin lookup — content blockers strip direct supabase.co calls
    fetchPartnerClient(partnerSlug)
      .then(p => { if (!cancelled) setPartner(p) })
      .finally(() => { if (!cancelled) setPartnerResolved(true) })
    return () => { cancelled = true }
  }, [partnerSlug])

  // New Routes campaign context (an explicit utm_campaign=newroutes, or a
  // co-brand whose row runs the campaign) and the attributed /shift hand-off
  // href. Read from window.location at mount for the same reason as
  // partnerSlug — useSearchParams can be empty on the first render. Waits on
  // partnerResolved: a co-brand alone no longer implies the campaign, so
  // deciding at mount would put a movers' reward back in front of every
  // partner's community. SSR renders the plain page; this enhances in.
  const [newRoutes, setNewRoutes] = useState(false)
  const [appHref, setAppHref] = useState('/shift')
  useEffect(() => {
    if (!partnerResolved) return
    setNewRoutes(isNewRoutesContext(window.location.search, partner?.campaign))
    setAppHref(buildAppHref(window.location.search, partner?.campaign))
  }, [partnerResolved, partner])

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
  //
  // Read from window.location, NOT useSearchParams, for exactly the reason
  // spelled out on partnerSlug above: the first render can see EMPTY search
  // params, and this effect runs once on mount, so it froze that empty
  // snapshot and dropped the visitor on the location gate. A shared
  // /nearby?lat&lng link — Copy link, the Shift app, a mailer — would then
  // land on "See how your neighborhood moves" instead of their neighborhood.
  useEffect(() => {
    const parsed = parseSnapshotParams(new URLSearchParams(window.location.search))
    if (parsed) {
      const { neighborhood, town } = splitPlaceLabel(parsed.label)
      setLocation({ ...parsed, city: town ?? '', neighborhood, fullAddress: null, source: 'url' })
    }
    // Analytics AFTER the state it describes, and never able to break it —
    // this ran first, so anything posthog threw (not yet initialised, a
    // content blocker) aborted the effect and left a visitor with valid
    // coords staring at the location gate.
    try {
      posthog.capture('snapshot_viewed', {
        has_url_coords: !!parsed,
        ...(partnerSlug ? { partner: partnerSlug } : {}),
      })
    } catch { /* analytics is never a reason to not render the page */ }
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
    setRailFar([])
    setBusFar([])
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
                  ? { ...c, shape: meta.shape, frequency: meta.frequency ?? 'unavailable', directions: meta.directions, connections: meta.connections }
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
                  ? { ...c, shape: meta.shape, frequency: meta.frequency ?? 'unavailable', directions: meta.directions, connections: meta.connections }
                  : c)),
              }))
            })
            .catch(() => {})
        }
        return prev
      })
    }, 75_000)

    // Each family resolves to [inRadius, far]: the far fetch runs only when
    // the primary came back empty, and "ready" waits for it so the list
    // never flashes the empty message before the nearest option arrives.
    const railP = fetchTrainStops(lat, lng, SNAPSHOT_RAIL_TYPES, SNAPSHOT_RAIL_PREFIX, SNAPSHOT_RAIL_MAX_STATIONS)
      .then(async rows => [rows, rows.length === 0 ? await fetchRailFar(lat, lng) : []] as const)
    const busP = fetchMBTAStops(lat, lng, SNAPSHOT_BUS_OPTS)
      .then(async rows => [rows, rows.length === 0 ? await fetchMBTAStops(lat, lng, SNAPSHOT_BUS_FAR_OPTS) : []] as const)
    railP.then(([rows, far]) => {
      if (loadSeqRef.current !== seq) return
      setRail({ status: 'ready', data: rows })
      setRailFar(far)
      posthog.capture('snapshot_section_loaded', { section: 'rail', count: rows.length, far: far.length })
    })
    busP.then(([rows, far]) => {
      if (loadSeqRef.current !== seq) return
      setBus({ status: 'ready', data: rows })
      setBusFar(far)
      posthog.capture('snapshot_section_loaded', { section: 'bus', count: rows.length, far: far.length })
    })
    fetchShuttleStops(lat, lng).then(rows => {
      setShuttles({ status: 'ready', data: rows })
      if (rows.length) posthog.capture('snapshot_section_loaded', { section: 'shuttle', count: rows.length })
    })
    // Service alerts for the routes we're about to show (major effects only),
    // plus the stops whose closure is old enough to retire from the lists.
    Promise.all([railP, busP]).then(([[railRows, railFarRows], [busRows, busFarRows]]) =>
      fetchNearbyAlertsAndClosures([...railRows, ...railFarRows, ...busRows, ...busFarRows].map(r => r.route_id)).then(
        ({ alerts, retiredStopIds }) => {
          if (loadSeqRef.current !== seq) return
          setAlerts(alerts)
          if (retiredStopIds.size > 0) {
            const live = (r: MBTAStopLive) => !retiredStopIds.has(r.stop_id)
            setRail(prev => (prev.status === 'ready' ? { ...prev, data: prev.data.filter(live) } : prev))
            setBus(prev => (prev.status === 'ready' ? { ...prev, data: prev.data.filter(live) } : prev))
            setRailFar(prev => prev.filter(live))
            setBusFar(prev => prev.filter(live))
          }
        },
      ),
    )
    fetchBikeShareDocks(lat, lng).then(rows => {
      setBluebikes({ status: 'ready', data: rows })
      posthog.capture('snapshot_section_loaded', { section: 'bike_share', count: rows.length })
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
        // v10: steps now carry the transfer stop names — without the bump the
        // route's own max-age=86400 keeps serving arrow-only chains for a day
        // v14: comfort rows own their segments, so the remainder is real
        // v15: rows carry the quicker alternate route
        const res = await fetch(`/api/nearby/reach?lat=${lat}&lng=${lng}&v=15`)
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
          fetchBikeShareDocks(lat, lng),
        ])
        // Far topology is session-cached, so a refresh of the nearest
        // option costs one /predictions call — same as a found stop would
        const [railFarRows, busFarRows] = await Promise.all([
          railRows.length === 0 ? fetchRailFar(lat, lng) : [],
          busRows.length === 0 ? fetchMBTAStops(lat, lng, SNAPSHOT_BUS_FAR_OPTS) : [],
        ])
        const { alerts, retiredStopIds } = await fetchNearbyAlertsAndClosures(
          [...railRows, ...railFarRows, ...busRows, ...busFarRows].map(r => r.route_id),
        )
        const live = (r: MBTAStopLive) => !retiredStopIds.has(r.stop_id)
        setRail({ status: 'ready', data: railRows.filter(live) })
        setBus({ status: 'ready', data: busRows.filter(live) })
        setRailFar(railFarRows.filter(live))
        setBusFar(busFarRows.filter(live))
        setBluebikes({ status: 'ready', data: bbRows })
        setAlerts(alerts)
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
    // Shuttle stops live in their own family — without them here a shuttle
    // route chip found no boarding row and drew nothing
    const rows = [...rail.data, ...bus.data, ...shuttles.data]
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
            ? { ...c, shape: meta.shape, frequency: meta.frequency ?? 'unavailable', directions: meta.directions, connections: meta.connections }
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
  }, [rail.data, bus.data, shuttles.data])

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
      <NearbyI18nProvider locale={locale} setLocale={setChosenLocale}>
      <div className="mx-auto max-w-[640px] px-6 pb-24 pt-14">
        <div className="mb-4 flex justify-end">
          <NearbyLanguagePill />
        </div>
        <div className="text-center">
          <div className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-(--nb-accent)">
            {tr(newRoutes ? 'snap.eyebrow_newroutes' : 'snap.eyebrow')}
          </div>
          <h1 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-[1.12] tracking-tighter text-(--nb-ink)">
            {tr('snap.headline_lead')}<em className="not-italic text-(--nb-accent)">{tr('snap.headline_em')}</em>{tr('snap.headline_tail')}
          </h1>
          <p className="mx-auto mt-3 max-w-[46ch] text-[1rem] leading-relaxed text-(--nb-ink-70)">
            {tr(newRoutes ? 'snap.subtitle_newroutes' : 'snap.subtitle')}
          </p>
          {partner && (
            <div className="mt-4">
              <PartnerCobrand partner={partner} center logoClass="max-h-7" />
            </div>
          )}
        </div>

        {newRoutes && (
          <div className="mx-auto mt-6 max-w-[440px]">
            <NewRoutesOffer
              href={appHref}
              variant="splash"
              onCta={() => posthog.capture('snapshot_app_cta_clicked', { campaign: 'newroutes', ...(partnerSlug ? { partner: partnerSlug } : {}) })}
            />
          </div>
        )}

        <div className="mx-auto mt-8 max-w-[440px] rounded-[20px] border border-(--nb-line-mid) bg-(--nb-card) p-7">
          <button
            onClick={handleUseMyLocation}
            disabled={locating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-(--nb-accent-fill) py-3.5 text-[0.9375rem] font-bold text-(--nb-on-accent-fill) transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {locating ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-(--nb-on-accent-fill)/30 border-t-(--nb-on-accent-fill)" />
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
            <p className="mt-3 text-[0.8125rem] leading-snug text-(--nb-ink-70)">{geoError}</p>
          )}

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-(--nb-panel-hover)" />
            <span className="text-[0.75rem] font-semibold uppercase tracking-wider text-(--nb-ink-70)">{tr('snap.or')}</span>
            <div className="h-px flex-1 bg-(--nb-panel-hover)" />
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
            variant={tone === 'dark' ? 'dark' : 'light'}
            placeholder={tr('snap.address_placeholder')}
          />
          <p className="mt-3 text-[0.75rem] leading-snug text-(--nb-ink-70)">
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
  // The station list's status. The stop fetchers swallow errors and return
  // [], so only the corridor build can report an error; but "ready" must wait
  // for rail AND bus (the old value was the corridor status alone, which let
  // the empty message flash while stops were still loading).
  const transitStatus: SectionStatus =
    transitCorridors.status === 'error' ? 'error'
    : rail.status === 'loading' || bus.status === 'loading' ? 'loading'
    : 'ready'

  const surfaceProps = {
    initialFocus,
    center: location,
    displayLabel,
    subLabel,
    outside,
    copied,
    onCopyLink: handleCopyLink,
    onChangeLocation: handleChangeLocation,
    onPrint: handlePrint,
    onPlanCommute: handlePlanCommute,
    partnerLine,
    partner,
    partnerSlug,
    appHref,
    newRoutes,
    transitCorridors: transitCorridors.data,
    bikeCorridors,
    popularBikeStreetKeys,
    rail: rail.data,
    bus: bus.data,
    railFar,
    busFar,
    shuttles: shuttles.data,
    docks: bluebikes.data,
    backgroundLines,
    transitStatus,
    reach,
    community,
    guides,
    alerts,
    onRetry: retry,
    onRequestCorridorShape: requestCorridorShape,
  }

  return (
    <NearbyToneProvider tone={tone}>
      <NearbyI18nProvider locale={locale} setLocale={setChosenLocale}>
        <NearbyPromosProvider promos={promos}>
          {isDesktop ? <NearbyDesktop {...surfaceProps} /> : <NearbyShell {...surfaceProps} />}
        </NearbyPromosProvider>
      </NearbyI18nProvider>
    </NearbyToneProvider>
  )
}
