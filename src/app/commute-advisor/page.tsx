'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import RecommendationCard from '@/components/commute/RecommendationCard'
import CommuteMap from '@/components/commute/CommuteMap'
import BarrierSelector from '@/components/commute/BarrierSelector'
import GettingStarted from '@/components/commute/GettingStarted'
import ModeComparisonTable from '@/components/commute/ModeComparisonTable'
import ModeIcon from '@/components/commute/ModeIcon'
import type { RecommendationResponse, BarrierCode, CurrentCommuteMode, Mode } from '@/lib/types/commute'

type PlaceData = { placeId: string; lat: number; lng: number }
type TransitStep = { lineName: string; lineShortName: string; vehicleType: string; numStops: number; departureStop: string; arrivalStop: string }
type RouteResult = { durationMins: number; distanceMiles: number; transitSteps?: TransitStep[] } | null
type RouteResponse = { routes: Record<string, RouteResult>; cached: boolean }

const MODE_TO_GOOGLE: Record<string, string> = {
  bike: 'BICYCLE', ebike: 'BICYCLE', walk: 'WALK',
  mbta: 'TRANSIT', commuter_rail: 'TRANSIT',
}

/* ── Constants ── */
const VEHICLES: Record<string, { mpg: number; maint: number; isEV?: boolean; costPerMile?: number }> = {
  small_sedan:  { mpg: 32, maint: 0.102 },
  medium_sedan: { mpg: 28, maint: 0.109 },
  compact_suv:  { mpg: 27, maint: 0.104 },
  medium_suv:   { mpg: 24, maint: 0.110 },
  pickup:       { mpg: 20, maint: 0.114 },
  ev:           { mpg: 0,  maint: 0.06, isEV: true, costPerMile: 0.048 },
}

const MODES: Record<string, { met: number; mph: number | null; label: string; healthNote: string }> = {
  walk:          { met: 4.0, mph: 3.5,  label: 'Walking',       healthNote: 'each way on foot' },
  bike:          { met: 8.0, mph: 11,   label: 'Cycling',       healthNote: 'each way by bike' },
  ebike:         { met: 4.5, mph: 15,   label: 'E-bike',        healthNote: 'each way by e-bike' },
  mbta:          { met: 0,   mph: null,  label: 'MBTA',          healthNote: '' },
  commuter_rail: { met: 0,   mph: null,  label: 'Commuter rail', healthNote: '' },
}

const DRIVE_MPH = 14

/** Translate CO₂ kg into a relatable equivalency (from Shift app's impact engine) */
function co2Equivalency(kg: number): string {
  const grams = kg * 1000
  if (grams < 5000) {
    const bags = grams / 1000
    if (bags < 1.5) return 'Like keeping a bag of trash out of a landfill'
    return `Like keeping ${Math.round(bags)} bags of trash out of a landfill`
  }
  const trees = grams / 22000
  if (trees < 1.5) return 'Like planting a tree for a year'
  return `Like planting ${Math.round(trees)} trees for a year`
}
// Default pricing — overridden by /api/pricing on mount
let MBTA_SUBWAY_SINGLE = 2.40
let MBTA_SUBWAY_MONTHLY = 90
let MBTA_BUS_SINGLE = 1.70
let MBTA_BUS_MONTHLY = 55
const WEEKS = 52
const CO2_PER_MILE = 0.404
const BODY_WEIGHT_LBS = 165

const fmt = (n: number) => n < 0 ? `-$${Math.abs(Math.round(n)).toLocaleString()}` : `$${Math.round(n).toLocaleString()}`
const fmtCO2 = (kg: number) => kg >= 1000 ? `${(kg / 1000).toFixed(2)} tons` : `${Math.round(kg)} kg`

const PARKING_ANCHORS = [
  { label: 'Downtown Boston $32', val: 32 },
  { label: 'Back Bay / South End $26', val: 26 },
  { label: 'Kendall / Cambridge $22', val: 22 },
  { label: 'Somerville $14', val: 14 },
  { label: 'Inner suburbs $12', val: 12 },
]

const FAQ = [
  {
    q: 'How much money can I save by biking or walking to work in Boston?',
    a: 'On a typical 7-mile Boston-area commute, choosing to bike or walk three days a week puts roughly <strong>$900–$1,500 back in your pocket per year</strong> in fuel and maintenance savings — more if you\'re paying for parking. The maintenance savings surprise people: oil changes, tire wear, and brake replacement accumulate meaningfully over a full year of daily driving. At roughly 10–11 cents per mile, three active commute days a week on a 7-mile route saves around $175–$190 in maintenance alone, before you touch the gas budget.',
  },
  {
    q: 'How does biking to work compare to driving in Boston traffic?',
    a: 'On many Boston-area routes, a bike commute is surprisingly competitive with driving. Boston consistently ranks among the most congested cities in the US, with downtown speeds averaging 12–16 mph during peak hours. A cyclist averaging 10–12 mph on a 5–7 mile urban route can match or beat door-to-door driving time once parking and walking are included. For routes from neighborhoods like Somerville, Cambridge, or Jamaica Plain into the core, <strong>cycling often takes the same time or less</strong>. E-bikes close the gap further for hillier routes or longer distances.',
  },
  {
    q: 'What health benefits do I get from an active commute?',
    a: 'A 7-mile bike commute at a moderate pace burns roughly 400–500 calories and delivers about 45 minutes of moderate cardiovascular exercise — equivalent to a solid gym session. Doing this three days a week adds up to <strong>100+ active minutes and 1,200+ calories per week</strong>, which meets or exceeds the American Heart Association\'s weekly physical activity recommendations. For people who struggle to find time to exercise, commuting actively is often the most sustainable way to build consistent movement into an already-structured day.',
  },
  {
    q: 'Is the MBTA a reliable alternative to driving for Boston-area commuters?',
    a: 'It depends heavily on your route. The Red, Orange, and Green lines serve dense corridors well and are genuinely competitive with driving for many downtown-bound commutes. Bus routes vary significantly in reliability, though key routes — particularly the 86, 1, 39, and Silver Line — have improved with dedicated bus lanes. The monthly LinkPass at $90 covers unlimited trips on all subway, bus, and Silver Line routes. For a commuter making 40+ trips a month, <strong>the pass pays for itself in under three weeks</strong> of use.',
  },
  {
    q: 'What\'s the best way to start commuting by bike if you\'re new to riding in traffic?',
    a: 'The most common approach is to start on lower-traffic parallel routes before gradually building confidence on main roads. The Boston region has an expanding network of protected bike lanes, and tools like the MassDOT bike map show low-stress routing options. Many new commuters find it helpful to do a dry run on a weekend first. <strong>E-bikes make a significant difference</strong> for hillier routes or longer distances — they remove the exertion concern and let you arrive without breaking a sweat. Green Streets Initiative\'s Shift app is designed to help people in exactly this situation: discover routes, build confidence, and see the real-world results of their choices.',
  },
  {
    q: 'How much does parking cost in Boston and Cambridge?',
    a: 'Daily parking rates in the Boston area vary significantly by neighborhood. Downtown Boston and the Seaport typically run <strong>$28–$35 per day</strong>. Back Bay and the South End average $22–$28. Cambridge near Kendall Square runs $18–$25. Somerville, Medford, and inner suburban areas typically range from $10–$16. Monthly garage parking in downtown Boston averages $350–$500/month. Many employers subsidize or provide free parking — which is why this calculator asks about your actual situation rather than assuming you pay market rate.',
  },
]

/* ── Session persistence ── */
const SESSION_KEY = 'commute-advisor-state'

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/* ── Component ── */
export default function CommuteCalculator() {
  const saved = useRef(loadSession())
  const s = saved.current

  // Inputs — restore from session if available
  const [distance, setDistance] = useState(s?.distance ?? 0)
  const [driveDays, setDriveDays] = useState(s?.driveDays ?? 5)
  const [vehicle, setVehicle] = useState(s?.vehicle ?? 'medium_sedan')
  const [gasPrice, setGasPrice] = useState(s?.gasPrice ?? 3.59)
  const [parkMode, setParkMode] = useState(s?.parkMode ?? 'free')
  const [parkingCost, setParkingCost] = useState(s?.parkingCost ?? 15)
  const [commuteMode, setCommuteMode] = useState<CurrentCommuteMode>(s?.commuteMode ?? 'drive')
  const [rideshareDaily, setRideshareDaily] = useState(s?.rideshareDaily ?? 30)
  const [carpoolDaily, setCarpoolDaily] = useState(s?.carpoolDaily ?? 20)
  const [transitMonthly, setTransitMonthly] = useState(s?.transitMonthly ?? 90)
  const [busMonthly, setBusMonthly] = useState(s?.busMonthly ?? 55)
  const [selectedMode, setSelectedMode] = useState<string | null>(null)
  const [altMode, setAltMode] = useState(s?.altMode ?? 'bike')
  const [railZone, setRailZone] = useState(s?.railZone ?? 140)
  const [mbtaType, setMbtaType] = useState(s?.mbtaType ?? 'subway')
  const [hasEmployerSubsidy, setHasEmployerSubsidy] = useState(s?.hasEmployerSubsidy ?? false)
  const [employerSubsidy, setEmployerSubsidy] = useState(s?.employerSubsidy ?? 0)

  // Routing state — restore addresses and placeData
  const [homeAddress, setHomeAddress] = useState(s?.homeAddress ?? '')
  const [workAddress, setWorkAddress] = useState(s?.workAddress ?? '')
  const [homePlaceData, setHomePlaceData] = useState<PlaceData | null>(s?.homePlaceData ?? null)
  const [workPlaceData, setWorkPlaceData] = useState<PlaceData | null>(s?.workPlaceData ?? null)
  const [routeData, setRouteData] = useState<RouteResponse | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState(false)
  const routeAbortRef = useRef<AbortController | null>(null)

  // Step flow — restore step
  const [step, setStep] = useState(s?.step ?? 1)

  // Recommendation state — restore recommendation and barriers
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(s?.recommendation ?? null)
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)
  const [selectedBarriers, setSelectedBarriers] = useState<BarrierCode[]>(s?.selectedBarriers ?? [])
  const [outsideMA, setOutsideMA] = useState(false)
  const recommendRef = useRef<HTMLDivElement>(null)

  // Fetch dynamic pricing on mount
  useEffect(() => {
    fetch('/api/pricing').then(r => r.json()).then((p: Record<string, number>) => {
      if (p.gas_price_ma && !s?.gasPrice) setGasPrice(p.gas_price_ma)
      if (p.mbta_subway_single) MBTA_SUBWAY_SINGLE = p.mbta_subway_single
      if (p.mbta_subway_monthly) MBTA_SUBWAY_MONTHLY = p.mbta_subway_monthly
      if (p.mbta_bus_single) MBTA_BUS_SINGLE = p.mbta_bus_single
      if (p.mbta_bus_monthly) MBTA_BUS_MONTHLY = p.mbta_bus_monthly
    }).catch(() => { /* use defaults */ })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save state to sessionStorage on changes
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        distance, driveDays, vehicle, gasPrice, parkMode, parkingCost,
        commuteMode, rideshareDaily, carpoolDaily, transitMonthly, busMonthly, selectedMode,
        altMode, railZone, mbtaType, hasEmployerSubsidy, employerSubsidy,
        homeAddress, workAddress, homePlaceData, workPlaceData,
        step, recommendation, selectedBarriers,
      }))
    } catch { /* sessionStorage full or unavailable */ }
  }, [distance, driveDays, vehicle, gasPrice, parkMode, parkingCost,
      commuteMode, rideshareDaily, carpoolDaily, transitMonthly, busMonthly, selectedMode,
      altMode, railZone, mbtaType, hasEmployerSubsidy, employerSubsidy,
      homeAddress, workAddress, homePlaceData, workPlaceData,
      step, recommendation, selectedBarriers])

  // Fetch routing when both addresses and alt mode are set
  useEffect(() => {
    if (!homePlaceData || !workPlaceData) {
      setRouteData(null)
      return
    }

    // Abort previous request
    routeAbortRef.current?.abort()
    const controller = new AbortController()
    routeAbortRef.current = controller

    const timer = setTimeout(async () => {
      setRouteLoading(true)
      setRouteError(false)
      try {
        // Fetch all modes for comprehensive comparison
        const modes = new Set(['DRIVE', 'TRANSIT', 'BICYCLE', 'WALK'])
        const googleMode = MODE_TO_GOOGLE[altMode]
        if (googleMode) modes.add(googleMode)

        const res = await fetch('/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: { lat: homePlaceData.lat, lng: homePlaceData.lng },
            destination: { lat: workPlaceData.lat, lng: workPlaceData.lng },
            modes: [...modes],
          }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error('Route fetch failed')
        const data: RouteResponse = await res.json()
        setRouteData(data)
        // Update distance from the driving route
        if (data.routes.DRIVE) {
          setDistance(Math.round(data.routes.DRIVE.distanceMiles * 2) / 2) // round to nearest 0.5
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setRouteError(true)
          setRouteData(null)
        }
      } finally {
        setRouteLoading(false)
      }
    }, 500) // debounce

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [homePlaceData, workPlaceData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch recommendation when both addresses are set
  const fetchRecommendation = useCallback(async (barrier?: BarrierCode | null) => {
    if (!homePlaceData || !workPlaceData) {
      // Manual distance fallback — comparison-based estimate
      if (distance > 0) {
        setRecLoading(true)
        setRecError(null)
        setOutsideMA(false)
        try {
          const d = distance
          const category = d < 2 ? 'short' : d < 6 ? 'medium' : 'long' as const
          const driveMins = Math.round((d / 14) * 60)
          const driveCostDaily = d * 2 * 0.237 + 18 // gas+maint+parking
          let baselineCost = driveCostDaily
          let baselineLabel = 'driving'
          if (commuteMode === 'rideshare') { baselineCost = rideshareDaily; baselineLabel = 'rideshare' }
          else if (commuteMode === 'carpool') { baselineCost = carpoolDaily; baselineLabel = 'carpool' }
          else if (commuteMode === 'transit') { baselineCost = transitMonthly / 22; baselineLabel = 'transit' }
          else if (commuteMode === 'bus') { baselineCost = busMonthly / 22; baselineLabel = 'bus' }
          else if (commuteMode === 'commuter_rail') { baselineCost = railZone / 22; baselineLabel = 'commuter rail' }
          else if (commuteMode === 'bike' || commuteMode === 'walk') { baselineCost = 0; baselineLabel = commuteMode }

          // Build candidates
          type Candidate = { mode: string; label: string; mins: number; cost: number; reasons: string[] }
          const candidates: Candidate[] = [
            { mode: 'drive', label: 'Drive', mins: driveMins, cost: driveCostDaily,
              reasons: [`${driveMins} min each way`, `~$${Math.round(driveCostDaily)}/day including gas, maintenance, and parking`, 'Door-to-door flexibility'] }
          ]
          if (d < 2) candidates.push({ mode: 'walk', label: 'Walk', mins: Math.round((d / 3.5) * 60), cost: 0,
            reasons: [`${Math.round((d / 3.5) * 60)} min vs. ${driveMins} min driving`, `Free vs. ~$${Math.round(baselineCost)}/day ${baselineLabel}`, 'Zero cost, built-in exercise'] })
          if (d < 8) candidates.push({ mode: 'bike', label: 'Bike', mins: Math.round((d / 11) * 60), cost: 0,
            reasons: [`${Math.round((d / 11) * 60)} min vs. ${driveMins} min driving`, `Free vs. ~$${Math.round(baselineCost)}/day ${baselineLabel} — saves ~$${Math.round(baselineCost * 260)}/year`, 'Built-in exercise, no parking needed'] })
          if (d >= 4 && d < 12) candidates.push({ mode: 'ebike', label: 'E-bike', mins: Math.round((d / 15) * 60), cost: 0,
            reasons: [`${Math.round((d / 15) * 60)} min vs. ${driveMins} min driving`, `Free vs. ~$${Math.round(baselineCost)}/day ${baselineLabel}`, 'Arrive without sweating'] })
          candidates.push({ mode: 'transit', label: 'MBTA Transit', mins: Math.round(d * 4), cost: 4.8,
            reasons: [`${Math.round(d * 4)} min vs. ${driveMins} min driving`, `$4.80/day vs. ~$${Math.round(baselineCost)}/day ${baselineLabel}`, 'Read or work during your commute'] })

          // Sort: cheapest first, then fastest
          candidates.sort((a, b) => (a.cost - b.cost) || (a.mins - b.mins))
          const winner = candidates[0]
          const runnerUp = candidates.length > 1 ? candidates[1] : null

          const modes = winner.mode === 'drive' ? [] : [winner.mode] as ('walk' | 'bike' | 'ebike' | 'transit')[]

          setRecommendation({
            primary: { modes, label: winner.label, reasons: winner.reasons, time_estimate_minutes: winner.mins, cost_estimate_daily: winner.cost, google_maps_url: '' },
            secondary: runnerUp ? { modes: runnerUp.mode === 'drive' ? [] as unknown as ('walk' | 'bike' | 'ebike' | 'transit' | 'bus')[] : [runnerUp.mode as 'walk' | 'bike' | 'ebike' | 'transit'], label: runnerUp.label, time_estimate_minutes: runnerUp.mins } : null,
            map_data: { bluebikes_origin: [], bluebikes_dest: [], mbta_stops: [], bike_infra_quality: 'unknown' },
            content: { guide: null, event: null },
            comparisons: candidates.map(c => ({ mode: c.mode as 'walk' | 'bike' | 'ebike' | 'transit' | 'bus' | 'drive', label: c.label, time_minutes: c.mins, daily_cost: c.cost, annual_cost: Math.round(c.cost * 260), pros: c.reasons })),
            drive_comparison: { time_minutes: driveMins, daily_cost: driveCostDaily, annual_cost: Math.round(driveCostDaily * 260) },
            distance_miles: d,
            distance_category: category,
          })
          const recMode = modes[0] || candidates[0]?.mode || null
          setSelectedMode(recMode)
        } finally {
          setRecLoading(false)
        }
      }
      return
    }

    setRecLoading(true)
    setRecError(null)
    setOutsideMA(false)

    try {
      const params = new URLSearchParams({
        origin_lat: String(homePlaceData.lat),
        origin_lng: String(homePlaceData.lng),
        dest_lat: String(workPlaceData.lat),
        dest_lng: String(workPlaceData.lng),
      })
      if (barrier) params.set('barrier', barrier)
      if (commuteMode === 'rideshare') {
        params.set('commute_mode', 'rideshare')
        params.set('commute_daily_cost', String(rideshareDaily))
      } else if (commuteMode === 'carpool') {
        params.set('commute_mode', 'carpool')
        params.set('commute_daily_cost', String(carpoolDaily))
      }

      const res = await fetch(`/api/commute/recommend?${params}`)
      const data = await res.json()

      if (data.error === 'outside_ma') {
        setOutsideMA(true)
        setRecommendation(null)
        return
      }

      setRecommendation(data)
      const recMode = data.primary?.modes?.[0] || data.comparisons?.[0]?.mode || null
      setSelectedMode(recMode)
      // Sync altMode to recommended mode for savings calculation
      if (recMode === 'walk') setAltMode('walk')
      else if (recMode === 'bike') setAltMode('bike')
      else if (recMode === 'ebike') setAltMode('ebike')
      else if (recMode === 'transit' || recMode === 'bus') setAltMode('mbta')
      else if (recMode === 'commuter_rail') setAltMode('commuter_rail')
    } catch {
      setRecError('Unable to load recommendation. Please try again.')
    } finally {
      setRecLoading(false)
    }
  }, [homePlaceData, workPlaceData, distance, commuteMode, rideshareDaily, carpoolDaily])

  // Handle barrier selection — always show GettingStarted, don't re-fetch entire recommendation
  // Handle "See my options" — transition to Step 3 and fetch recommendation
  const handleSeeOptions = () => {
    setStep(3)
    setSelectedBarriers([])
    fetchRecommendation()
    // Scroll to top of results
    setTimeout(() => {
      recommendRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  // Refresh live data
  const handleRefresh = () => {
    fetchRecommendation()
  }

  // Sync altMode when user selects a mode in the comparison table
  useEffect(() => {
    if (!selectedMode) return
    if (selectedMode === 'walk') setAltMode('walk')
    else if (selectedMode === 'bike') setAltMode('bike')
    else if (selectedMode === 'ebike') setAltMode('ebike')
    else if (selectedMode === 'transit' || selectedMode === 'bus') setAltMode('mbta')
    else if (selectedMode === 'commuter_rail') setAltMode('commuter_rail')
  }, [selectedMode])

  const handleModeSelect = (mode: string) => {
    setSelectedMode(mode)
    setSelectedBarriers([])
  }

  // Calculate results
  const calc = useCallback(() => {
    if (distance <= 0) return null
    const v = VEHICLES[vehicle]
    const mode = MODES[altMode]
    const sd = driveDays
    const milesRound = distance * 2
    const annualMiles = milesRound * sd * WEEKS
    const isRideshare = commuteMode === 'rideshare'

    // Baseline cost — what the user spends on their current commute
    let baselineAnnualCost = 0
    let baselineLabel = 'driving'

    if (commuteMode === 'rideshare') {
      baselineAnnualCost = rideshareDaily * sd * WEEKS
      baselineLabel = 'rideshare'
    } else if (commuteMode === 'carpool') {
      baselineAnnualCost = carpoolDaily * sd * WEEKS
      baselineLabel = 'carpool'
    } else if (commuteMode === 'drive') {
      if (v.isEV) {
        baselineAnnualCost = milesRound * v.costPerMile! * sd * WEEKS
      } else {
        baselineAnnualCost = milesRound * (gasPrice / v.mpg) * sd * WEEKS
      }
      baselineAnnualCost += milesRound * VEHICLES[vehicle].maint * sd * WEEKS
      if (parkMode !== 'free') baselineAnnualCost += parkingCost * sd * WEEKS
      baselineLabel = 'driving'
    } else if (commuteMode === 'transit') {
      baselineAnnualCost = transitMonthly * 12
      baselineLabel = 'transit'
    } else if (commuteMode === 'bus') {
      baselineAnnualCost = busMonthly * 12
      baselineLabel = 'bus'
    } else if (commuteMode === 'commuter_rail') {
      baselineAnnualCost = railZone * 12
      baselineLabel = 'commuter rail'
    } else {
      baselineAnnualCost = 0
      baselineLabel = commuteMode
    }

    // Money — keep legacy vars for backward compat in display
    let fuelSavings = 0
    let maintSavings = 0
    let rideshareSavings = 0
    let fuelLabel = '⛽ Fuel savings'

    if (isRideshare) {
      rideshareSavings = rideshareDaily * sd * WEEKS
    } else if (commuteMode === 'drive') {
      if (v.isEV) {
        fuelSavings = annualMiles * v.costPerMile!
        fuelLabel = '⚡ Electricity savings'
        maintSavings = annualMiles * v.maint
      } else {
        fuelSavings = annualMiles * (gasPrice / v.mpg)
        maintSavings = annualMiles * v.maint
      }
    }

    let parkingSavings = 0
    if (parkMode !== 'free' && (commuteMode === 'drive' || commuteMode === 'carpool')) {
      parkingSavings = parkingCost * sd * WEEKS
    }

    let transitCost = 0
    let transitLabel = ''
    if (altMode === 'mbta') {
      const single = MBTA_SUBWAY_SINGLE
      const monthly = MBTA_SUBWAY_MONTHLY
      const monthlyTrips = sd * 2 * (WEEKS / 12)
      const perRideAnnual = single * 2 * sd * WEEKS
      const passAnnual = monthly * 12
      if (monthlyTrips > (monthly / single)) { transitCost = passAnnual; transitLabel = 'Monthly LinkPass' }
      else { transitCost = perRideAnnual; transitLabel = 'Per-ride fares' }
      // Employer subsidy
      if (hasEmployerSubsidy && employerSubsidy > 0) {
        const subsidyAnnual = employerSubsidy * 12
        transitCost = Math.max(0, transitCost - subsidyAnnual)
      }
    } else if (altMode === 'commuter_rail') {
      transitCost = railZone * 12
      if (hasEmployerSubsidy && employerSubsidy > 0) {
        const subsidyAnnual = employerSubsidy * 12
        transitCost = Math.max(0, transitCost - subsidyAnnual)
      }
      transitLabel = 'Monthly pass'
    }

    const altAnnualCost = transitCost  // for transit modes, or 0 for active modes
    const net = baselineAnnualCost - altAnnualCost

    // Time — use real routing when available, fall back to speed estimates
    const googleMode = MODE_TO_GOOGLE[altMode]
    const hasRealRoute = routeData?.routes?.DRIVE && routeData?.routes?.[googleMode]
    let driveMins: number
    let altMins: number | null = null
    let timeNote: string
    let isRealRouting = false

    if (hasRealRoute) {
      driveMins = routeData.routes.DRIVE!.durationMins
      altMins = routeData.routes[googleMode]!.durationMins
      isRealRouting = true
      const diff = driveMins - altMins
      if (altMode === 'ebike') {
        timeNote = 'Powered by Google Maps. E-bike times may be faster than shown.'
      } else if (diff > 3) {
        timeNote = 'Powered by Google Maps with rush hour traffic.'
      } else if (diff < -3) {
        timeNote = 'Powered by Google Maps. Transit times vary by departure.'
      } else {
        timeNote = 'Powered by Google Maps. Travel times are similar for this route.'
      }
    } else {
      driveMins = Math.round((distance / DRIVE_MPH) * 60)
      if (mode.mph) {
        altMins = Math.round((distance / mode.mph) * 60)
        const diff = driveMins - altMins
        if (diff > 3) timeNote = 'Based on typical speeds — enter addresses above for real routing.'
        else if (diff < -3) timeNote = 'Based on typical speeds — actual transit time varies.'
        else timeNote = 'Travel times are similar based on typical speeds.'
      } else {
        timeNote = 'Enter addresses above for real door-to-door routing via Google Maps.'
      }
    }

    // Health
    const isActive = ['walk', 'bike', 'ebike'].includes(altMode)
    let activeMins = 0, weeklyCals = 0, gymEquiv = '0'
    if (isActive && mode.mph) {
      const minsPerTrip = Math.round((distance / mode.mph) * 60)
      activeMins = minsPerTrip * 2 * sd
      const weightKg = BODY_WEIGHT_LBS / 2.205
      weeklyCals = Math.round(mode.met * weightKg * (activeMins / 60))
      gymEquiv = (activeMins / 45).toFixed(1)
    }

    // CO2
    const co2 = annualMiles * (v.isEV ? CO2_PER_MILE * 0.35 : CO2_PER_MILE) // EVs still offset grid emissions partially

    return {
      net, fuelSavings, maintSavings, parkingSavings, transitCost, transitLabel,
      fuelLabel, rideshareSavings, isRideshare,
      baselineAnnualCost, baselineLabel,
      driveMins, altMins, timeNote, isRealRouting, mode,
      isActive, activeMins, weeklyCals, gymEquiv,
      annualMiles, co2,
    }
  }, [distance, driveDays, vehicle, gasPrice, parkMode, parkingCost, altMode, railZone, commuteMode, rideshareDaily, carpoolDaily, transitMonthly, busMonthly, mbtaType, hasEmployerSubsidy, employerSubsidy, routeData])

  const r = calc()

  // Get Google Maps route time for the recommended mode
  const getRouteTimeForMode = useCallback(() => {
    if (!routeData || !recommendation) return null
    const recMode = recommendation.primary.modes[0]
    const googleKey = recMode === 'walk' ? 'WALK'
      : (recMode === 'bike' || recMode === 'ebike') ? 'BICYCLE'
      : 'TRANSIT'
    return routeData.routes[googleKey]?.durationMins ?? null
  }, [routeData, recommendation])

  return (
    <>
      <Nav />
      <main className="bg-[#191A2E]" style={{ paddingTop: '60px' }}>

        {/* Hero — compact */}
        <div className="mx-auto max-w-[640px] px-8 pb-8 pt-12 text-center">
          <h1 className="mb-3 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.15] tracking-tighter text-white">
            Find your <em className="not-italic text-[#BAF14D]">best commute</em>
          </h1>
          <p className="text-[1rem] leading-relaxed text-white/70">
            Tell us where you&apos;re going and we&apos;ll recommend the fastest, cheapest way to get there.
          </p>
        </div>

        {/* Step indicator */}
        <div className="mx-auto mb-6 flex max-w-[480px] items-center justify-center gap-2 px-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => s < step && setStep(s)}
                disabled={s > step}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  s === step ? 'bg-[#BAF14D] text-[#191A2E]'
                  : s < step ? 'bg-[#BAF14D]/20 text-[#BAF14D] hover:bg-[#BAF14D]/30'
                  : 'bg-white/[0.08] text-white/30'
                }`}
              >
                {s < step ? '✓' : s}
              </button>
              {s < 3 && <div className={`h-px w-12 ${s < step ? 'bg-[#BAF14D]/30' : 'bg-white/[0.08]'}`} />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Where's your commute? ── */}
        {step === 1 && (
          <div className="mx-auto max-w-[520px] px-8">
            <div className="overflow-hidden rounded-[20px] border border-white/[0.12] bg-[#242538] p-8">
              <div className="mb-6 font-display text-[1.125rem] font-bold text-white">Where&apos;s your commute?</div>

              <div className="mb-5 space-y-3">
                <AddressAutocomplete
                  value={homeAddress}
                  onChange={(val) => { setHomeAddress(val); if (!val) setHomePlaceData(null) }}
                  onPlaceSelected={setHomePlaceData}
                  label="Home address"
                  variant="dark"
                  placeholder="Where do you live?"
                />
                <AddressAutocomplete
                  value={workAddress}
                  onChange={(val) => { setWorkAddress(val); if (!val) setWorkPlaceData(null) }}
                  onPlaceSelected={setWorkPlaceData}
                  label="Work address"
                  variant="dark"
                  placeholder="Where do you work?"
                />
              </div>

              <Field label="Or enter distance manually">
                <div className="flex items-center gap-3">
                  <NumInput value={distance} onChange={setDistance} min={0.5} max={60} step={0.5} />
                  <span className="text-[0.8rem] text-white">miles each way</span>
                </div>
                {homePlaceData && workPlaceData && (
                  <Hint>Distance auto-set from addresses — adjust to override</Hint>
                )}
              </Field>

              <button
                onClick={() => setStep(2)}
                disabled={!homePlaceData && !workPlaceData && distance <= 0}
                className="mt-4 w-full rounded-xl bg-[#BAF14D] py-3 text-[0.9375rem] font-bold text-[#191A2E] transition-opacity hover:opacity-90 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: How do you get there now? ── */}
        {step === 2 && (
          <div className="mx-auto max-w-[520px] px-8">
            <div className="overflow-hidden rounded-[20px] border border-white/[0.12] bg-[#242538] p-8">
              <div className="mb-6 font-display text-[1.125rem] font-bold text-white">How do you get there now?</div>

              <div className="mb-5 grid grid-cols-2 gap-2">
                {([
                  { value: 'drive', label: 'Drive' },
                  { value: 'carpool', label: 'Carpool' },
                  { value: 'rideshare', label: 'Rideshare' },
                  { value: 'bike', label: 'Bike' },
                  { value: 'transit', label: 'Transit' },
                  { value: 'bus', label: 'Bus' },
                  { value: 'commuter_rail', label: 'Commuter Rail' },
                  { value: 'walk', label: 'Walk' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setCommuteMode(opt.value)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-[0.8125rem] font-semibold transition-colors ${
                      commuteMode === opt.value
                        ? 'border-[#BAF14D] bg-[#BAF14D]/[0.12] text-[#BAF14D]'
                        : 'border-white/[0.12] text-white hover:border-white/[0.25]'
                    }`}
                  >
                    <ModeIcon mode={opt.value} size={20} />
                    {opt.label}
                  </button>
                ))}
              </div>

              <Field label="Days in the office per week">
                <div className="mb-2.5 font-display text-base font-bold text-[#BAF14D]">
                  {driveDays} day{driveDays > 1 ? 's' : ''}/week
                </div>
                <RangeInput value={driveDays} onChange={setDriveDays} min={1} max={5} labels={['1','2','3','4','5']} />
              </Field>

              {commuteMode === 'drive' && (
                <Field label="Vehicle type">
                  <Select value={vehicle} onChange={setVehicle} options={[
                    { value: 'small_sedan', label: 'Small sedan (Civic, Corolla)' },
                    { value: 'medium_sedan', label: 'Medium sedan (Camry, Accord)' },
                    { value: 'compact_suv', label: 'Compact SUV (RAV4, CR-V)' },
                    { value: 'medium_suv', label: 'Medium SUV (Explorer, Highlander)' },
                    { value: 'pickup', label: 'Pickup truck (F-150, Silverado)' },
                    { value: 'ev', label: 'Electric vehicle (Tesla, Leaf, etc.)' },
                  ]} />
                </Field>
              )}

              {commuteMode === 'drive' && vehicle !== 'ev' && (
                <Field label="Gas price">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-bold text-[#BAF14D]">$</span>
                    <NumInput value={gasPrice} onChange={setGasPrice} min={2} max={8} step={0.01} width="88px" fontSize="1rem" />
                    <span className="text-[0.8rem] text-white">per gallon</span>
                  </div>
                  <Hint>Current MA average — updated regularly</Hint>
                </Field>
              )}

              {commuteMode === 'drive' && vehicle === 'ev' && (
                <Field label="Electricity cost">
                  <div className="text-sm text-white">$0.048/mile based on MA residential rates</div>
                </Field>
              )}

              {commuteMode === 'carpool' && (
                <Field label="Average daily carpool cost">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-bold text-[#BAF14D]">$</span>
                    <NumInput value={carpoolDaily} onChange={setCarpoolDaily} min={1} max={100} step={1} width="88px" fontSize="1rem" />
                    <span className="text-[0.8rem] text-white">per day (your share)</span>
                  </div>
                </Field>
              )}

              {commuteMode === 'rideshare' && (
                <Field label="Average daily rideshare cost">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-bold text-[#BAF14D]">$</span>
                    <NumInput value={rideshareDaily} onChange={setRideshareDaily} min={5} max={200} step={1} width="88px" fontSize="1rem" />
                    <span className="text-[0.8rem] text-white">per day (round trip)</span>
                  </div>
                </Field>
              )}

              {(commuteMode === 'bike' || commuteMode === 'walk') && (
                <div className="mt-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-[0.8125rem] text-white/70">
                  No commute costs to track — we&apos;ll show you how your current commute compares.
                </div>
              )}

              {commuteMode === 'transit' && (
                <Field label="Monthly transit pass">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-bold text-[#BAF14D]">$</span>
                    <NumInput value={transitMonthly} onChange={setTransitMonthly} min={0} max={300} step={1} width="88px" fontSize="1rem" />
                    <span className="text-[0.8rem] text-white">per month (LinkPass $90)</span>
                  </div>
                </Field>
              )}

              {commuteMode === 'bus' && (
                <Field label="Monthly bus pass">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-bold text-[#BAF14D]">$</span>
                    <NumInput value={busMonthly} onChange={setBusMonthly} min={0} max={200} step={1} width="88px" fontSize="1rem" />
                    <span className="text-[0.8rem] text-white">per month (MBTA bus pass $55)</span>
                  </div>
                </Field>
              )}

              {commuteMode === 'commuter_rail' && (
                <Field label="Monthly commuter rail pass">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-bold text-[#BAF14D]">$</span>
                    <NumInput value={railZone} onChange={setRailZone} min={90} max={450} step={5} width="88px" fontSize="1rem" />
                    <span className="text-[0.8rem] text-white">per month</span>
                  </div>
                </Field>
              )}

              {(commuteMode === 'drive' || commuteMode === 'carpool') && (
                <Field label="Parking">
                  <RadioPills
                    name="parking"
                    value={parkMode}
                    onChange={setParkMode}
                    options={[
                      { value: 'free', label: 'Free / employer pays' },
                      { value: 'subsidized', label: 'I pay something' },
                      { value: 'full', label: 'Full cost' },
                    ]}
                  />
                  {parkMode !== 'free' && (
                    <div className="mt-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-lg font-bold text-[#BAF14D]">$</span>
                        <NumInput value={parkingCost} onChange={setParkingCost} min={0} max={80} step={1} width="78px" fontSize="1rem" />
                        <span className="text-[0.8rem] text-white">per day</span>
                      </div>
                      {parkMode === 'full' && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[0.63rem] text-white">Area medians:</span>
                          {PARKING_ANCHORS.map(a => (
                            <button key={a.val} onClick={() => setParkingCost(a.val)}
                              className="rounded-md border border-white/[0.12] bg-white/[0.06] px-2 py-1 text-[0.65rem] font-semibold text-white transition-colors hover:bg-white/10 hover:text-white">
                              {a.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Field>
              )}

              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-white/[0.12] px-6 py-3 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-white/[0.05]"
                >
                  Back
                </button>
                <button
                  onClick={handleSeeOptions}
                  className="flex-1 rounded-xl bg-[#BAF14D] py-3 text-[0.9375rem] font-bold text-[#191A2E] transition-opacity hover:opacity-90"
                >
                  See my options
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Results ── */}
        {step === 3 && (
          <div ref={recommendRef} className="mx-auto max-w-[640px] px-8">
            {/* Loading */}
            {recLoading && !recommendation && (
              <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-7 text-center">
                <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-[#BAF14D]" />
                <p className="text-sm text-white/60">Analyzing your commute...</p>
              </div>
            )}

            {outsideMA && (
              <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-7">
                <p className="text-[0.9375rem] text-white">
                  Our recommendation engine is optimized for Massachusetts commutes. For other locations, try{' '}
                  <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" className="text-[#BAF14D] underline">Google Maps</a>{' '}
                  or a local transit app.
                </p>
                <button onClick={() => setStep(1)} className="mt-4 text-sm font-semibold text-[#BAF14D]">← Start over</button>
              </div>
            )}

            {recError && (
              <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-7">
                <p className="text-[0.9375rem] text-white/70">{recError}</p>
                <button onClick={handleSeeOptions} className="mt-3 text-sm font-semibold text-[#BAF14D]">Try again</button>
              </div>
            )}

            {recommendation && (() => {
              // Build Google Routes times map (used by both card and table)
              const googleTimes: Record<string, number> = {}
              if (routeData?.routes) {
                if (routeData.routes.DRIVE) googleTimes.drive = routeData.routes.DRIVE.durationMins + 5 // +5 min parking
                if (routeData.routes.BICYCLE) { googleTimes.bike = routeData.routes.BICYCLE.durationMins; googleTimes.ebike = Math.round(routeData.routes.BICYCLE.durationMins * 0.75) }
                if (routeData.routes.WALK) googleTimes.walk = routeData.routes.WALK.durationMins
                if (routeData.routes.TRANSIT) googleTimes.transit = routeData.routes.TRANSIT.durationMins
              }
              const hasGoogleTimes = Object.keys(googleTimes).length > 0

              // Override generic "MBTA Transit" label with actual route from Google
              const transitData = routeData?.routes?.TRANSIT
              const transitSteps = transitData?.transitSteps
              let displayPrimary = recommendation.primary
              let displaySecondary = recommendation.secondary
              if (transitSteps && transitSteps.length > 0) {
                function formatStep(step: TransitStep) {
                  const vt = step.vehicleType
                  const vType = vt === 'BUS' ? 'Bus' : vt === 'COMMUTER_RAIL' ? 'Commuter Rail' : ''
                  const name = step.lineShortName || step.lineName
                  return vType ? `${vType} ${name}` : name
                }
                const mainStep = transitSteps[0]
                let transitLabel: string
                if (transitSteps.length === 1) {
                  transitLabel = `${formatStep(mainStep)} from ${mainStep.departureStop}`
                } else {
                  transitLabel = transitSteps.map(formatStep).join(' → ')
                }

                // Override primary if it's the transit recommendation
                if (recommendation.primary.label === 'MBTA Transit' || recommendation.primary.modes.includes('transit')) {
                  displayPrimary = { ...recommendation.primary, label: transitLabel }
                }
                // Override secondary if it's transit
                if (recommendation.secondary?.label === 'MBTA Transit') {
                  displaySecondary = { ...recommendation.secondary, label: transitLabel }
                }
              }

              return (
              <div className="animate-in space-y-5">
                {/* Recommendation */}
                <RecommendationCard
                  primary={displayPrimary}
                  secondary={displaySecondary}
                  distanceMiles={recommendation.distance_miles}
                  distanceCategory={recommendation.distance_category}
                  onRefresh={handleRefresh}
                  loading={recLoading}
                  routeTimeMinutes={getRouteTimeForMode()}
                  routeTimes={hasGoogleTimes ? googleTimes : undefined}
                />

                {/* Mode comparison table — override transit label with Google data */}
                {recommendation.comparisons && recommendation.comparisons.length > 1 && (() => {
                  let comps = recommendation.comparisons
                  if (transitSteps && transitSteps.length > 0) {
                    const tLabel = transitSteps.map(s => {
                      const vt = s.vehicleType === 'BUS' ? 'Bus' : ''
                      const name = s.lineShortName || s.lineName
                      return vt ? `${vt} ${name}` : name
                    }).join(' → ')
                    comps = comps.map(c => c.mode === 'transit' ? { ...c, label: tLabel || c.label } : c)
                  }
                  return (
                    <ModeComparisonTable
                      comparisons={comps}
                      winnerMode={comps[0]?.mode}
                      selectedMode={selectedMode}
                      onSelectMode={handleModeSelect}
                      routeTimes={hasGoogleTimes ? googleTimes : undefined}
                      originLat={homePlaceData?.lat}
                      originLng={homePlaceData?.lng}
                      destLat={workPlaceData?.lat}
                      destLng={workPlaceData?.lng}
                    />
                  )
                })()}

                {!homePlaceData && (
                  <p className="text-center text-[0.8125rem] text-white/40">
                    Enter your home and work addresses in Step 1 for live transit and Bluebikes availability.
                  </p>
                )}

                {/* Map */}
                {homePlaceData && workPlaceData && (
                  <CommuteMap
                    originLat={homePlaceData.lat}
                    originLng={homePlaceData.lng}
                    destLat={workPlaceData.lat}
                    destLng={workPlaceData.lng}
                    bluebikesOrigin={recommendation.map_data.bluebikes_origin}
                    bluebikesDestStations={recommendation.map_data.bluebikes_dest}
                    mbtaStops={recommendation.map_data.mbta_stops}
                    recommendedModes={recommendation.primary.modes}
                    onRefresh={handleRefresh}
                  />
                )}

                {/* Savings breakdown */}
                {r && (
                  <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-7">
                    <div className="mb-4 font-display text-[0.9375rem] font-bold text-white">
                      {r.baselineAnnualCost === 0 ? 'Annual commute cost comparison' : 'Estimated annual savings'}
                    </div>

                    <div className={`mb-4 rounded-[14px] border px-6 py-4 text-center ${
                      r.baselineAnnualCost === 0
                        ? 'border-white/[0.12] bg-white/[0.04]'
                        : 'border-[rgba(186,241,77,0.2)] bg-[rgba(186,241,77,0.08)]'
                    }`}>
                      <div className={`font-display text-[2.25rem] font-extrabold leading-none tracking-tighter ${
                        r.baselineAnnualCost === 0 ? 'text-white' : 'text-[#BAF14D]'
                      }`}>
                        {fmt(r.net)}
                      </div>
                      <div className="mt-1 text-[0.75rem] text-[rgba(186,241,77,0.5)]">
                        {r.baselineAnnualCost === 0
                          ? `switching from ${r.baselineLabel} would cost this per year`
                          : r.net >= 0 ? `per year vs. ${r.baselineLabel}` : `transit cost exceeds ${r.baselineLabel} savings at this distance`}
                      </div>
                    </div>

                    <div className="mb-4 flex flex-col gap-2">
                      {r.baselineAnnualCost > 0 && (
                        <ResultRow label={`Current ${r.baselineLabel} cost`} value={fmt(r.baselineAnnualCost)} type="neu" />
                      )}
                      {r.isRideshare ? (
                        <ResultRow label="Rideshare savings" value={`+${fmt(r.rideshareSavings)}`} type="pos" />
                      ) : commuteMode === 'drive' ? (
                        <>
                          <ResultRow label={r.fuelLabel} value={`+${fmt(r.fuelSavings)}`} type="pos" />
                          <ResultRow label="Maintenance savings" value={`+${fmt(r.maintSavings)}`} type="pos" />
                          {parkMode !== 'free' && (
                            <ResultRow label="Parking savings" value={`+${fmt(r.parkingSavings)}`} type="pos" />
                          )}
                        </>
                      ) : null}
                      {!r.isActive && r.transitCost > 0 && (
                        <ResultRow label={r.transitLabel} value={`-${fmt(r.transitCost)}`} type="neg" />
                      )}
                    </div>

                    {/* Time comparison */}
                    <div className="mb-4 grid grid-cols-2 gap-2">
                      <div className="rounded-[9px] border border-white/[0.07] bg-white/[0.04] px-2 py-2.5 text-center">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/60">Driving</div>
                        <div className="font-display text-lg font-bold text-white">
                          {routeLoading ? '…' : `${r.isRealRouting ? '' : '~'}${r.driveMins} min`}
                        </div>
                      </div>
                      <div className="rounded-[9px] border border-white/[0.07] bg-white/[0.04] px-2 py-2.5 text-center">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/60">{r.mode.label}</div>
                        <div className="font-display text-lg font-bold text-white">
                          {routeLoading ? '…' : r.altMins !== null ? `${r.isRealRouting ? '' : '~'}${r.altMins} min` : 'varies'}
                        </div>
                      </div>
                    </div>

                    {/* Health */}
                    {r.isActive && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-[9px] bg-white/[0.04] px-2 py-2 text-center">
                          <div className="font-display text-base font-bold text-[#EDB93C]">{r.activeMins}</div>
                          <div className="mt-0.5 text-[9px] leading-snug text-white/60">active min/week</div>
                        </div>
                        <div className="rounded-[9px] bg-white/[0.04] px-2 py-2 text-center">
                          <div className="font-display text-base font-bold text-[#EDB93C]">{r.weeklyCals.toLocaleString()}</div>
                          <div className="mt-0.5 text-[9px] leading-snug text-white/60">cal/week</div>
                        </div>
                        <div className="rounded-[9px] bg-white/[0.04] px-2 py-2 text-center">
                          <div className="font-display text-base font-bold text-[#EDB93C]">{fmtCO2(r.co2)}</div>
                          <div className="mt-0.5 text-[9px] leading-snug text-white/60">CO₂ saved/yr</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Barrier selector (multi-select) */}
                <BarrierSelector
                  modes={selectedMode && selectedMode !== 'drive'
                    ? [selectedMode as Mode]
                    : recommendation.primary.modes}
                  selected={selectedBarriers}
                  onSelect={setSelectedBarriers}
                />

                {/* Guides — appears after barrier selection */}
                {selectedBarriers.length > 0 && (
                  <GettingStarted
                    modes={selectedMode && selectedMode !== 'drive'
                      ? [selectedMode as Mode]
                      : recommendation.primary.modes}
                    barriers={selectedBarriers}
                    event={recommendation.content.event}
                  />
                )}

                {/* Start earning CTA */}
                <div className="rounded-2xl border border-[rgba(186,241,77,0.18)] bg-[linear-gradient(135deg,rgba(41,102,229,0.15),rgba(186,241,77,0.08))] px-7 py-6">
                  <div className="mb-1 font-display text-[1.0625rem] font-extrabold tracking-tight text-white">Start earning</div>
                  <div className="mb-3.5 text-[0.8rem] leading-relaxed text-white">
                    Every active trip earns you points toward rewards from local businesses.
                  </div>
                  <a href="/shift" className="inline-block rounded-lg bg-[#BAF14D] px-4 py-2 text-[0.8125rem] font-bold text-[#191A2E] transition-opacity hover:opacity-85">
                    Download the app &rarr;
                  </a>
                </div>

                {/* Edit inputs */}
                <button
                  onClick={() => setStep(1)}
                  className="w-full rounded-xl border border-white/[0.08] py-3 text-[0.8125rem] font-semibold text-white/50 transition-colors hover:border-white/[0.15] hover:text-white/70"
                >
                  ← Edit your commute details
                </button>
              </div>
              )})()}
          </div>
        )}

        {/* Methodology */}
        <div className="mx-auto mt-8 max-w-[860px] px-8">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-5 py-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white">How this is calculated</div>
            <div className="text-[0.77rem] leading-[1.65] text-white">
              Door-to-door travel times are powered by Google Maps with rush hour traffic data (Monday 8:30 AM departure). When addresses are entered, all mode comparisons use real routing — including driving time with parking. Fuel savings use your vehicle&apos;s EPA combined MPG estimate and the current Massachusetts average gas price. Maintenance savings apply the AAA variable rate per mile (~10–11¢/mile by vehicle type). <strong className="font-semibold text-white">Fixed costs like insurance, depreciation, and registration are excluded</strong> — those don&apos;t change based on how many days you drive. MBTA fares from{' '}
              <a href="https://www.mbta.com/fares" target="_blank" rel="noopener noreferrer" className="text-white underline">mbta.com/fares</a>; the advisor compares monthly pass vs. per-ride cost and uses whichever is cheaper. Health estimates use MET values from the American College of Sports Medicine. Gas prices, MBTA fares, and parking costs are updated regularly from public sources.
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mx-auto max-w-[780px] px-8 pb-24 pt-14">
          <h2 className="mb-6 font-display text-[1.375rem] font-bold tracking-tight text-white">
            Common questions about active commuting in Massachusetts
          </h2>
          {FAQ.map((item, i) => (
            <div key={i} className="border-t border-white/[0.07] py-6 last:border-b">
              <div className="mb-2.5 font-display font-semibold text-white">{item.q}</div>
              <div className="text-[0.9rem] leading-[1.75] text-white" dangerouslySetInnerHTML={{ __html: item.a }} />
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </>
  )
}

/* ── Reusable sub-components ── */

function Field({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={last ? '' : 'mb-6'}>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white">{label}</label>
      {children}
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-[0.7rem] leading-snug text-white">{children}</div>
}

function NumInput({ value, onChange, min, max, step, width, fontSize }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step: number; width?: string; fontSize?: string
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      min={min} max={max} step={step}
      className="rounded-[10px] border-[1.5px] border-white/[0.12] bg-white/[0.06] px-3 py-2.5 text-center font-display font-bold text-white transition-colors focus:border-[#BAF14D] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
      style={{ width: width || '100px', fontSize: fontSize || '1.25rem' }}
    />
  )
}

function RangeInput({ value, onChange, min, max, labels }: {
  value: number; onChange: (v: number) => void; min: number; max: number; labels: string[]
}) {
  return (
    <div>
      <input
        type="range" min={min} max={max} step={1} value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        className="w-full cursor-pointer appearance-none rounded-full bg-white/10 outline-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-[#191A2E] [&::-webkit-slider-thumb]:bg-[#BAF14D] [&::-webkit-slider-thumb]:shadow-[0_0_0_1.5px_#BAF14D]"
        style={{ height: '6px' }}
      />
      <div className="mt-1 flex justify-between">
        {labels.map(l => <span key={l} className="text-[10px] text-white">{l}</span>)}
      </div>
    </div>
  )
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full cursor-pointer appearance-none rounded-[10px] border-[1.5px] border-white/[0.12] bg-white/[0.06] bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2012%208%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20stroke%3D%22%238A8DA8%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_0.875rem_center] bg-no-repeat px-3.5 py-2.5 text-sm text-white transition-colors focus:border-[#BAF14D] focus:outline-none"
    >
      {options.map(o => <option key={o.value} value={o.value} className="bg-[#242538] text-white">{o.label}</option>)}
    </select>
  )
}

function RadioPills({ name, value, onChange, options }: {
  name: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <label key={o.value} className={`cursor-pointer whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-1.5 text-xs font-semibold transition-all ${
          value === o.value
            ? 'border-[#BAF14D] bg-[#BAF14D] text-[#191A2E]'
            : 'border-white/[0.12] text-white hover:border-white/25'
        }`}>
          <input type="radio" name={name} value={o.value} checked={value === o.value}
            onChange={() => onChange(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  )
}

function ResultRow({ label, value, type }: { label: string; value: string; type: 'pos' | 'neg' | 'neu' }) {
  const color = type === 'pos' ? 'text-[#BAF14D]' : type === 'neg' ? 'text-[#FF6B6B]' : 'text-white'
  return (
    <div className="flex items-center justify-between rounded-[9px] border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5">
      <span className="text-[0.8rem] text-white">{label}</span>
      <span className={`font-display text-[0.9rem] font-bold transition-all duration-300 ${color}`}>{value}</span>
    </div>
  )
}
