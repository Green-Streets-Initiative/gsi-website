'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import posthog from 'posthog-js'
import { Check, Copy, FilePdf } from '@phosphor-icons/react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import RecommendationCard from '@/components/commute/RecommendationCard'
import CommuteMap from '@/components/commute/CommuteMap'
import BarrierSelector from '@/components/commute/BarrierSelector'
import GettingStarted from '@/components/commute/GettingStarted'
import EmployerBenefits from '@/components/commute/EmployerBenefits'
import EmployerSavingsComparison from '@/components/commute/EmployerSavingsComparison'
import ModeComparisonTable from '@/components/commute/ModeComparisonTable'
import ModeIcon from '@/components/commute/ModeIcon'
import LoadingMessages from '@/components/commute/LoadingMessages'
import CommutePlanPrint from '@/components/commute/CommutePlanPrint'
import { co2Equivalency } from '@/lib/co2-equivalency'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import type { EmployerGroup, EmployerBenefits as EmployerBenefitsConfig, RecommendationResponse, BarrierCode, CurrentCommuteMode, Mode } from '@/lib/types/commute'
import { PRICES } from '@/lib/facts/prices'

type PlaceData = { placeId: string; lat: number; lng: number }
type TransitStep = { lineName: string; lineShortName: string; vehicleType: string; numStops: number; departureStop: string; arrivalStop: string }
type RouteResult = { durationMins: number; distanceMiles: number; transitSteps?: TransitStep[] } | null
type RouteResponse = { routes: Record<string, RouteResult>; cached: boolean }

const VEHICLES: Record<string, { mpg: number; maint: number; isEV?: boolean; costPerMile?: number }> = {
  small_sedan: { mpg: 32, maint: 0.102 }, medium_sedan: { mpg: 28, maint: 0.109 },
  compact_suv: { mpg: 27, maint: 0.104 }, medium_suv: { mpg: 24, maint: 0.110 },
  pickup: { mpg: 20, maint: 0.114 }, ev: { mpg: 0, maint: 0.06, isEV: true, costPerMile: 0.048 },
}

// Effort and speed constants live in src/lib/facts/prices.json ("effort"),
// shared with the public advisor so both pages agree.
const MODES: Record<string, { met: number; mph: number | null; label: string; healthNote: string }> = {
  walk: { met: PRICES.effort.walkMet, mph: PRICES.effort.walkMph, label: 'Walking', healthNote: 'each way on foot' },
  bike: { met: PRICES.effort.bikeMet, mph: PRICES.effort.bikeMph, label: 'Cycling', healthNote: 'each way by bike' },
  ebike: { met: PRICES.effort.ebikeMet, mph: PRICES.effort.ebikeMph, label: 'E-bike', healthNote: 'each way by e-bike' },
  mbta: { met: 0, mph: null, label: 'Bus or train', healthNote: '' },
  commuter_rail: { met: 0, mph: null, label: 'Commuter rail', healthNote: '' },
}

const DRIVE_MPH = PRICES.effort.driveMph
const WEEKS = 52
// A pre-tax transit benefit is money the employee sets aside before tax, so
// its value to them is the tax it saves: about 30% (federal + Massachusetts
// income tax plus payroll tax), not the face amount.
const PRE_TAX_VALUE_SHARE = 0.3
/** The join link employees open; the same code they can type into the app. */
const JOIN_BASE = 'https://shift.gogreenstreets.org/join/'
const CO2_PER_MILE = 0.404
const BODY_WEIGHT_LBS = 165

const fmt = (n: number) => n < 0 ? `-$${Math.abs(Math.round(n)).toLocaleString()}` : `$${Math.round(n).toLocaleString()}`
const fmtCO2 = (kg: number) => kg >= 1000 ? `${(kg / 1000).toFixed(2)} tons` : `${Math.round(kg)} kg`

const PARKING_ANCHORS = [
  { label: 'Downtown Boston $32', val: 32 }, { label: 'Back Bay $26', val: 26 },
  { label: 'Kendall $22', val: 22 }, { label: 'Somerville $14', val: 14 },
]

function enrichProsWithBenefits(pros: string[], b: EmployerBenefitsConfig, mode: string): string[] {
  const extra: string[] = []

  if (mode === 'bike') {
    if (b.bluebikes_subsidized) {
      extra.push(b.bluebikes_subsidy_label || 'Your employer covers Bluebikes membership')
    }
    if (b.bike_parking) {
      extra.push(b.bike_parking_details
        ? `Secure bike parking — ${b.bike_parking_details}`
        : 'Secure bike parking at your office')
    }
    if (b.showers) {
      extra.push(b.shower_details
        ? `Showers available — ${b.shower_details}`
        : 'Showers available at the office')
    }
  }

  if (mode === 'transit') {
    if (b.transit_subsidy_monthly && b.transit_subsidy_monthly > 0) {
      extra.push(b.transit_subsidy_label || `Your employer covers $${b.transit_subsidy_monthly}/mo toward transit`)
    }
  }

  if (mode === 'walk') {
    if (b.showers) {
      extra.push(b.shower_details
        ? `Showers available — ${b.shower_details}`
        : 'Showers available at the office')
    }
  }

  if (mode === 'drive') {
    if (b.free_parking) {
      extra.push('Free parking at your office')
    }
  }

  if (extra.length === 0) return pros
  return [...pros, ...extra].slice(0, 5)
}

interface Props {
  group: EmployerGroup
  isDemo?: boolean
  /** From ?location=<id>: a per-location link opens at that location. */
  initialLocationId?: string | null
}

export default function EmployerCommuteAdvisor({ group, isDemo, initialLocationId }: Props) {
  const benefits = group.employer_benefits
  const locations = group.locations ?? []
  const multiSite = locations.length > 1
  const startLocation = multiSite
    ? locations.find((l) => l.id === initialLocationId) ?? locations[0]
    : null
  const isPremium = group.tier === 'premium'

  const track = useCallback((event: string, props?: Record<string, unknown>) => {
    posthog.capture(event, { advisor_variant: 'employer', employer_slug: group.slug, is_demo: !!isDemo, ...props })
  }, [group.slug, isDemo])

  // Inputs
  const [distance, setDistance] = useState(0)
  const [driveDays, setDriveDays] = useState(5)
  const [vehicle, setVehicle] = useState('medium_sedan')
  const [gasPrice, setGasPrice] = useState(PRICES.driving.gasPerGallonMa)
  // Live prices from /api/pricing (pricing_data), defaults from prices.json.
  const [livePrices, setLivePrices] = useState({
    subwaySingle: PRICES.mbta.subwaySingle,
    subwayMonthly: PRICES.mbta.linkPassMonthly,
    busMonthly: PRICES.mbta.busPassMonthly,
    bluebikesAnnual: PRICES.bluebikes.annual,
  })
  const [codeCopied, setCodeCopied] = useState(false)
  const [parkMode, setParkMode] = useState(benefits.free_parking ? 'free' : 'full')
  const [parkingCost, setParkingCost] = useState(15)
  const [commuteMode, setCommuteMode] = useState<CurrentCommuteMode>('drive')
  const [rideshareDaily, setRideshareDaily] = useState(30)
  const [carpoolDaily, setCarpoolDaily] = useState(20)
  const [transitMonthly, setTransitMonthly] = useState(90)
  const [busMonthly, setBusMonthly] = useState(55)
  const [railMonthly, setRailMonthly] = useState(140)
  const [selectedMode, setSelectedMode] = useState<string | null>(null)
  const [altMode, setAltMode] = useState('bike')
  const [step, setStep] = useState(1)

  // Routing
  const [homeAddress, setHomeAddress] = useState('')
  const [workAddress, setWorkAddress] = useState(startLocation?.address ?? benefits.destination_address ?? '')
  const [homePlaceData, setHomePlaceData] = useState<PlaceData | null>(null)
  const [workPlaceData, setWorkPlaceData] = useState<PlaceData | null>(
    startLocation
      ? { placeId: '', lat: startLocation.lat, lng: startLocation.lng }
      : benefits.destination_lat && benefits.destination_lng
        ? { placeId: '', lat: benefits.destination_lat, lng: benefits.destination_lng }
        : null
  )
  const [locationId, setLocationId] = useState<string | null>(startLocation?.id ?? null)
  const pickLocation = (id: string) => {
    const l = locations.find((x) => x.id === id)
    if (!l) return
    setLocationId(l.id)
    setWorkAddress(l.address)
    setWorkPlaceData({ placeId: '', lat: l.lat, lng: l.lng })
    track('advisor_location_selected', { location_id: l.id })
  }
  const [routeData, setRouteData] = useState<RouteResponse | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const routeAbortRef = useRef<AbortController | null>(null)

  // Recommendation
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null)
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)
  const [selectedBarriers, setSelectedBarriers] = useState<BarrierCode[]>([])
  const [outsideMA, setOutsideMA] = useState(false)
  const recommendRef = useRef<HTMLDivElement>(null)

  // Live prices on mount, like the public advisor. A failed fetch keeps
  // the prices.json defaults.
  useEffect(() => {
    let cancelled = false
    fetch('/api/pricing')
      .then((r) => r.json())
      .then((p: Record<string, number>) => {
        if (cancelled) return
        if (p.gas_price_ma) setGasPrice(p.gas_price_ma)
        setLivePrices((prev) => ({
          subwaySingle: p.mbta_subway_single || prev.subwaySingle,
          subwayMonthly: p.mbta_subway_monthly || prev.subwayMonthly,
          busMonthly: p.mbta_bus_monthly || prev.busMonthly,
          bluebikesAnnual: p.bluebikes_annual || prev.bluebikesAnnual,
        }))
      })
      .catch(() => { /* keep defaults */ })
    return () => { cancelled = true }
  }, [])

  // Fetch routing
  useEffect(() => {
    if (!homePlaceData || !workPlaceData) { setRouteData(null); return }
    routeAbortRef.current?.abort()
    const controller = new AbortController()
    routeAbortRef.current = controller
    const timer = setTimeout(async () => {
      setRouteLoading(true)
      try {
        const res = await fetch('/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: { lat: homePlaceData.lat, lng: homePlaceData.lng },
            destination: { lat: workPlaceData.lat, lng: workPlaceData.lng },
            modes: ['DRIVE', 'TRANSIT', 'BICYCLE', 'WALK'],
          }),
          signal: controller.signal,
        })
        if (res.ok) {
          const data: RouteResponse = await res.json()
          setRouteData(data)
          if (data.routes.DRIVE) setDistance(Math.round(data.routes.DRIVE.distanceMiles * 2) / 2)
        }
      } catch { /* ignore */ } finally { setRouteLoading(false) }
    }, 500)
    return () => { clearTimeout(timer); controller.abort() }
  }, [homePlaceData, workPlaceData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch recommendation
  const fetchRecommendation = useCallback(async (barrier?: BarrierCode | null) => {
    if (!homePlaceData || !workPlaceData) return
    setRecLoading(true); setRecError(null); setOutsideMA(false)
    try {
      const params = new URLSearchParams({
        origin_lat: String(homePlaceData.lat), origin_lng: String(homePlaceData.lng),
        dest_lat: String(workPlaceData.lat), dest_lng: String(workPlaceData.lng),
      })
      if (barrier) params.set('barrier', barrier)
      // Usage log (Shift 01048): which employer and office, never the addresses.
      if (!isDemo && group.slug) {
        params.set('group', group.slug)
        if (locationId) params.set('location', locationId)
      }
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
        setOutsideMA(true); setRecommendation(null)
        track('advisor_results_failed', { reason: 'outside_ma' })
        return
      }
      setRecommendation(data)
      setSelectedMode(data.primary?.modes?.[0] || data.comparisons?.[0]?.mode || null)
      track('advisor_results_shown', {
        recommended_mode: data.primary?.modes?.[0] ?? 'drive',
        distance_miles: data.distance_miles,
        has_addresses: true,
      })
      const recMode = data.primary?.modes?.[0]
      if (recMode === 'walk') setAltMode('walk')
      else if (recMode === 'bike') setAltMode('bike')
      else if (recMode === 'ebike') setAltMode('ebike')
      else if (recMode === 'transit' || recMode === 'bus') setAltMode('mbta')
      else if (recMode === 'commuter_rail') setAltMode('commuter_rail')
    } catch {
      setRecError('Unable to load recommendation.')
      track('advisor_results_failed', { reason: 'error' })
    } finally { setRecLoading(false) }
  }, [homePlaceData, workPlaceData, commuteMode, rideshareDaily, carpoolDaily, track, isDemo, group.slug, locationId])

  const handleSeeOptions = () => {
    track('advisor_step_completed', { step: 2, commute_mode: commuteMode })
    setStep(3); setSelectedBarriers([]); fetchRecommendation()
    setTimeout(() => recommendRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }
  const handleRefresh = () => fetchRecommendation()

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
    track('advisor_mode_selected', { mode })
  }

  // Calculate savings — with and without employer benefits
  const calcSavings = useCallback((applyBenefits: boolean) => {
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
      baselineAnnualCost = railMonthly * 12
      baselineLabel = 'commuter rail'
    } else {
      baselineAnnualCost = 0
      baselineLabel = commuteMode
    }

    // Baseline breakdown — what the user stops spending on their current commute
    const baselineItems: Array<{ label: string; value: number }> = []
    if (commuteMode === 'rideshare') {
      baselineItems.push({ label: 'Rideshare savings', value: rideshareDaily * sd * WEEKS })
    } else if (commuteMode === 'carpool') {
      baselineItems.push({ label: 'Carpool savings', value: carpoolDaily * sd * WEEKS })
    } else if (commuteMode === 'drive') {
      if (v.isEV) {
        baselineItems.push({ label: 'Electricity savings', value: annualMiles * v.costPerMile! })
      } else {
        baselineItems.push({ label: 'Fuel savings', value: annualMiles * (gasPrice / v.mpg) })
      }
      baselineItems.push({ label: 'Maintenance', value: annualMiles * v.maint })
      if (parkMode !== 'free') baselineItems.push({ label: 'Parking', value: parkingCost * sd * WEEKS })
    } else if (commuteMode === 'transit') {
      baselineItems.push({ label: 'Transit pass', value: transitMonthly * 12 })
    } else if (commuteMode === 'bus') {
      baselineItems.push({ label: 'Bus pass', value: busMonthly * 12 })
    } else if (commuteMode === 'commuter_rail') {
      baselineItems.push({ label: 'Rail pass', value: railMonthly * 12 })
    }

    // Alternative-mode costs — what the recommended mode costs. A pre-tax
    // transit benefit is worth the tax it saves (PRE_TAX_VALUE_SHARE), an
    // employer-paid one its full amount.
    const monthlySubsidy = benefits.transit_subsidy_monthly && benefits.transit_subsidy_monthly > 0 ? benefits.transit_subsidy_monthly : 0
    const subsidyValue = monthlySubsidy * 12 * (benefits.transit_subsidy_type === 'pre_tax' ? PRE_TAX_VALUE_SHARE : 1)
    const altCostItems: Array<{ label: string; value: number }> = []
    let altAnnualCost = 0
    if (altMode === 'mbta') {
      const perRideAnnual = livePrices.subwaySingle * 2 * sd * WEEKS
      const passAnnual = livePrices.subwayMonthly * 12
      let cost: number, label: string
      if (perRideAnnual > passAnnual) { cost = passAnnual; label = 'Monthly LinkPass' }
      else { cost = perRideAnnual; label = 'Per-ride fares' }
      if (applyBenefits && subsidyValue > 0) {
        cost = Math.max(0, cost - subsidyValue)
      }
      altAnnualCost = cost
      altCostItems.push({ label, value: cost })
    } else if (altMode === 'commuter_rail') {
      let cost = railMonthly * 12
      if (applyBenefits && subsidyValue > 0) {
        cost = Math.max(0, cost - subsidyValue)
      }
      altAnnualCost = cost
      altCostItems.push({ label: 'Monthly pass', value: cost })
    } else if ((altMode === 'bike' || altMode === 'ebike') && benefits.bluebikes_subsidized) {
      let cost = livePrices.bluebikesAnnual
      if (applyBenefits) cost = 0
      altAnnualCost = cost
      altCostItems.push({ label: 'Bluebikes membership', value: cost })
    }

    const net = baselineAnnualCost - altAnnualCost
    const isActive = ['walk', 'bike', 'ebike'].includes(altMode)
    let activeMins = 0, weeklyCals = 0
    if (isActive && mode.mph) {
      activeMins = Math.round((distance / mode.mph) * 60) * 2 * sd
      weeklyCals = Math.round(mode.met * (BODY_WEIGHT_LBS / 2.205) * (activeMins / 60))
    }
    const co2 = annualMiles * (v.isEV ? CO2_PER_MILE * 0.35 : CO2_PER_MILE)

    return { net, baselineItems, altCostItems, isActive, activeMins, weeklyCals, annualMiles, co2,
      baselineAnnualCost, baselineLabel,
      driveMins: Math.round((distance / DRIVE_MPH) * 60),
      altMins: mode.mph ? Math.round((distance / mode.mph) * 60) : null,
      mode, isRealRouting: false, timeNote: '', gymEquiv: isActive && mode.mph ? ((activeMins / 45).toFixed(1)) : '0' }
  }, [distance, driveDays, vehicle, gasPrice, parkMode, parkingCost, altMode, commuteMode, rideshareDaily, carpoolDaily, transitMonthly, busMonthly, railMonthly, benefits, livePrices])

  const withBenefits = calcSavings(true)
  const withoutBenefits = calcSavings(false)

  const getRouteTimeForMode = useCallback(() => {
    if (!routeData || !recommendation) return null
    const recMode = recommendation.primary.modes[0]
    const googleKey = recMode === 'walk' ? 'WALK' : (recMode === 'bike' || recMode === 'ebike') ? 'BICYCLE' : 'TRANSIT'
    return routeData.routes[googleKey]?.durationMins ?? null
  }, [routeData, recommendation])

  // Employer-specific barrier override
  const getBarrierOverride = (barrier: BarrierCode): string | null => {
    if (barrier === 'sweating' && benefits.showers) {
      return `${group.name} has showers${benefits.shower_details ? ` (${benefits.shower_details})` : ''} at the office. No need to worry about arriving sweaty.`
    }
    if (barrier === 'bike_parking' && benefits.bike_parking) {
      return `Secure bike parking${benefits.bike_parking_details ? ` at ${benefits.bike_parking_details}` : ''} means your bike is safe while you're at work.`
    }
    if (barrier === 'safety') {
      return `Start on a Bluebikes e-bike${benefits.bluebikes_subsidized ? `, which ${group.name} covers` : ''}: the motor keeps you at traffic speed, and the Shift app's ride planner picks quieter streets and separated lanes.`
    }
    const shuttles = (benefits.shuttle_routes ?? []).filter((r) => r.name || r.from_stop)
    if (barrier === 'time' && shuttles.length > 0) {
      return shuttles
        .map((r) => `${group.name} runs a free shuttle from ${r.from_stop || r.name}.${r.schedule ? ` ${r.schedule}` : ''}`)
        .join(' ')
    }
    if (barrier === 'planning' && shuttles.length > 0) {
      return shuttles
        .map((r) => `${group.name} has a free shuttle from ${r.from_stop || r.name} — ${r.details || 'no reservation needed'}.`)
        .join(' ')
    }
    return null
  }

  return (
    <div className="advisor-root">
      <Nav />
      <main className="bg-[#F4F6F1]" style={{ paddingTop: '60px' }}>
        {/* Demo banner */}
        {isDemo && (
          <div className="bg-[#2D6A4F] px-6 py-2.5 text-center">
            <span className="text-[0.8125rem] font-semibold text-white">
              This is a personalized preview for {group.name}
            </span>
            <span className="mx-2 text-white/70">·</span>
            <Link href="/contact?inquiry=employer" className="text-[0.8125rem] font-semibold text-white underline">
              Contact us to get started
            </Link>
          </div>
        )}

        {/* Co-branded header */}
        <div className="mx-auto max-w-[640px] px-4 pb-6 pt-10 text-center sm:px-8">
          <div className="mb-5">
            {group.logo_url ? (
              <img src={group.logo_url} alt={group.name} className="mx-auto h-14 w-auto object-contain" />
            ) : (
              <div className="text-[1.5rem] font-bold text-[#191A2E]">{group.name}</div>
            )}
            <div className="mt-2 text-[0.75rem] tracking-[0.3px] text-[#8A8B9A]">
              powered by <span className="font-semibold text-[#2D6A4F]">Green Streets</span> Initiative
            </div>
          </div>
          <h1 className="mb-2 text-[clamp(1.5rem,3vw,2.25rem)] font-extrabold leading-[1.15] tracking-tighter text-[#191A2E]">
            Find your <em className="not-italic text-[#2D6A4F]">best commute</em>
          </h1>
          <p className="text-[0.9375rem] text-[#5A5C6E]">
            Commute Advisor for {group.name} employees
          </p>
        </div>

        {/* Step indicator */}
        <div className="mx-auto mb-6 flex max-w-[480px] items-center justify-center gap-2 px-4 sm:px-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <button onClick={() => s < step && setStep(s)} disabled={s > step}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  s === step ? 'bg-[#2D6A4F] text-white'
                  : s < step ? 'bg-[#E7F0EA] text-[#2D6A4F] hover:bg-[#d5e5d9]'
                  : 'bg-[rgba(25,26,46,0.06)] text-[#8A8B9A]'
                }`}>{s < step ? <Check size={14} weight="bold" /> : s}</button>
              {s < 3 && <div className={`h-px w-12 ${s < step ? 'bg-[#2D6A4F]/30' : 'bg-[rgba(25,26,46,0.06)]'}`} />}
            </div>
          ))}
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="mx-auto max-w-[520px] px-4 sm:px-8">
            <div className="overflow-hidden rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-5 shadow-[0_1px_2px_rgba(25,26,46,0.05)] sm:p-8">
              <div className="mb-6 text-[1.125rem] font-bold text-[#191A2E]">Where&apos;s your commute?</div>
              <div className="mb-5 space-y-3">
                <AddressAutocomplete value={homeAddress}
                  onChange={(val) => { setHomeAddress(val); if (!val) setHomePlaceData(null) }}
                  onPlaceSelected={setHomePlaceData} label="Home address" variant="light" placeholder="Where do you live?" />
                {multiSite && (
                  <div>
                    <label htmlFor="advisor-location" className="mb-1.5 block text-[0.8125rem] font-semibold text-[#191A2E]">
                      Which {group.name} location?
                    </label>
                    <select
                      id="advisor-location"
                      value={locationId ?? ''}
                      onChange={(e) => pickLocation(e.target.value)}
                      className="w-full rounded-[10px] border border-[rgba(25,26,46,0.15)] bg-white px-3.5 py-3 text-[0.9375rem] text-[#191A2E] outline-none focus:border-[#2D6A4F]"
                    >
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name ? `${l.name} · ${l.address.split(',')[0]}` : l.address}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <AddressAutocomplete value={workAddress}
                  onChange={(val) => { setWorkAddress(val); if (!val) setWorkPlaceData(null) }}
                  onPlaceSelected={setWorkPlaceData}
                  label={benefits.destination_address ? 'Your workplace' : 'Work address'}
                  variant="light" placeholder="Where do you work?" />
                <p className="text-[0.75rem] leading-snug text-[#5A5C6E]">
                  Addresses are only used to look up routes — never saved to a profile or shared.
                </p>
              </div>

              {/* Employer benefits checklist */}
              {!isDemo && <EmployerBenefits companyName={group.name} benefits={benefits} />}

              <button
                onClick={() => {
                  track('advisor_step_completed', { step: 1, has_addresses: !!(homePlaceData && workPlaceData) })
                  setStep(2)
                }}
                disabled={!homePlaceData || !workPlaceData}
                className="mt-6 w-full rounded-[10px] bg-[#2D6A4F] py-3 text-[0.9375rem] font-bold text-white transition-colors hover:bg-[#1F4D3A] disabled:opacity-30">
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div className="mx-auto max-w-[520px] px-4 sm:px-8">
            <div className="overflow-hidden rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-5 shadow-[0_1px_2px_rgba(25,26,46,0.05)] sm:p-8">
              <div className="mb-6 text-[1.125rem] font-bold text-[#191A2E]">How do you get there now?</div>

              <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {([
                  { value: 'drive', label: 'Drive' },
                  { value: 'carpool', label: 'Carpool' },
                  { value: 'rideshare', label: 'Rideshare' },
                  { value: 'bike', label: 'Bike' },
                  { value: 'transit', label: 'Transit' },
                  { value: 'bus', label: 'Bus' },
                  { value: 'commuter_rail', label: 'Commuter Rail' },
                  { value: 'walk', label: 'Walk' },
                  { value: 'new', label: "I'm new here — still figuring it out" },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setCommuteMode(opt.value)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-[0.8125rem] font-semibold transition-colors ${
                      opt.value === 'new' ? 'sm:col-span-2' : ''
                    } ${
                      commuteMode === opt.value
                        ? 'border-[#2D6A4F] bg-[#E7F0EA] text-[#2D6A4F]'
                        : 'border-[rgba(25,26,46,0.09)] text-[#191A2E] hover:border-[rgba(25,26,46,0.18)]'
                    }`}
                  >
                    <ModeIcon mode={opt.value} size={20} />
                    {opt.label}
                  </button>
                ))}
              </div>

              <Field label={commuteMode === 'new' ? "Days you'll commute per week" : 'Days in the office per week'}>
                <div className="mb-2.5 text-base font-bold text-[#2D6A4F]">
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
                    <span className="text-lg font-bold text-[#2D6A4F]">$</span>
                    <NumInput value={gasPrice} onChange={setGasPrice} min={2} max={8} step={0.01} width="88px" />
                    <span className="text-[0.8rem] text-[#191A2E]">per gallon</span>
                  </div>
                </Field>
              )}

              {commuteMode === 'carpool' && (
                <Field label="Average daily carpool cost">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-[#2D6A4F]">$</span>
                    <NumInput value={carpoolDaily} onChange={setCarpoolDaily} min={1} max={100} step={1} width="88px" />
                    <span className="text-[0.8rem] text-[#191A2E]">per day (your share)</span>
                  </div>
                </Field>
              )}

              {commuteMode === 'rideshare' && (
                <Field label="Average daily rideshare cost">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-[#2D6A4F]">$</span>
                    <NumInput value={rideshareDaily} onChange={setRideshareDaily} min={5} max={200} step={1} width="88px" />
                    <span className="text-[0.8rem] text-[#191A2E]">per day (round trip)</span>
                  </div>
                </Field>
              )}

              {(commuteMode === 'bike' || commuteMode === 'walk') && (
                <div className="mt-1 rounded-xl border border-[rgba(25,26,46,0.06)] bg-[#FAFBF8] px-5 py-3 text-[0.8125rem] text-[#5A5C6E]">
                  No commute costs to track — we&apos;ll show you how your current commute compares.
                </div>
              )}

              {commuteMode === 'new' && (
                <div className="mt-1 rounded-xl border border-[rgba(25,26,46,0.06)] bg-[#FAFBF8] px-5 py-3 text-[0.8125rem] text-[#5A5C6E]">
                  Just moved or starting fresh? We&apos;ll show what each option would cost — no current commute needed.
                </div>
              )}

              {commuteMode === 'transit' && (
                <Field label="Monthly transit pass">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-[#2D6A4F]">$</span>
                    <NumInput value={transitMonthly} onChange={setTransitMonthly} min={0} max={300} step={1} width="88px" />
                    <span className="text-[0.8rem] text-[#191A2E]">{`per month (LinkPass $${PRICES.mbta.linkPassMonthly})`}</span>
                  </div>
                </Field>
              )}

              {commuteMode === 'bus' && (
                <Field label="Monthly bus pass">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-[#2D6A4F]">$</span>
                    <NumInput value={busMonthly} onChange={setBusMonthly} min={0} max={200} step={1} width="88px" />
                    <span className="text-[0.8rem] text-[#191A2E]">per month (MBTA bus pass $55)</span>
                  </div>
                </Field>
              )}

              {commuteMode === 'commuter_rail' && (
                <Field label="Monthly commuter rail pass">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-[#2D6A4F]">$</span>
                    <NumInput value={railMonthly} onChange={setRailMonthly} min={90} max={450} step={5} width="88px" />
                    <span className="text-[0.8rem] text-[#191A2E]">per month</span>
                  </div>
                </Field>
              )}

              {(commuteMode === 'drive' || commuteMode === 'carpool') && (
                <Field label="Parking">
                  <RadioPills name="parking"
                    value={parkMode === 'subsidized' ? 'paid' : parkMode === 'full' ? 'paid' : parkMode}
                    onChange={(v: string) => setParkMode(v === 'paid' ? 'full' : v)}
                    options={[
                      { value: 'free', label: benefits.free_parking ? 'Free (employer)' : 'Free / employer pays' },
                      { value: 'paid', label: 'I pay for parking' },
                    ]} />
                  {parkMode !== 'free' && (
                    <div className="mt-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-[#2D6A4F]">$</span>
                        <NumInput value={parkingCost} onChange={setParkingCost} min={0} max={80} step={1} width="78px" />
                        <span className="text-[0.8rem] text-[#191A2E]">per day</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {PARKING_ANCHORS.map(a => (
                          <button key={a.val} onClick={() => setParkingCost(a.val)}
                            className="rounded-md border border-[rgba(25,26,46,0.09)] bg-[#FAFBF8] px-2 py-1 text-[0.65rem] font-semibold text-[#191A2E] transition-colors hover:bg-[rgba(25,26,46,0.06)]">
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </Field>
              )}
              <div className="mt-4 flex gap-3">
                <button onClick={() => setStep(1)}
                  className="rounded-[10px] border border-[rgba(25,26,46,0.09)] bg-white px-6 py-3 text-[0.9375rem] font-semibold text-[#191A2E] transition-colors hover:bg-[#FAFBF8]">
                  Back
                </button>
                <button onClick={handleSeeOptions}
                  className="flex-1 rounded-[10px] bg-[#2D6A4F] py-3 text-[0.9375rem] font-bold text-white transition-colors hover:bg-[#1F4D3A]">
                  See my options
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div ref={recommendRef} className="mx-auto max-w-[640px] px-4 sm:px-8">
            {recLoading && !recommendation && (
              <div className="rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-7 text-center shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
                <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[rgba(25,26,46,0.12)] border-t-[#2D6A4F]" />
                <LoadingMessages theme="light" />
              </div>
            )}

            {/* Missing-input fallback */}
            {!recLoading && !recommendation && !recError && !outsideMA && (
              <div className="rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-7 text-center shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
                <p className="text-[0.9375rem] text-[#191A2E]">
                  We need one more detail — add your home and work addresses and we&apos;ll compare your options.
                </p>
                <button onClick={() => setStep(1)} className="mt-4 text-sm font-semibold text-[#2D6A4F]">
                  &larr; Back to Step 1
                </button>
              </div>
            )}
            {outsideMA && (
              <div className="rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-7 shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
                <p className="text-[0.9375rem] text-[#191A2E]">Our recommendation engine is optimized for Massachusetts commutes.</p>
                <button onClick={() => setStep(1)} className="mt-4 text-sm font-semibold text-[#2D6A4F]">&larr; Start over</button>
              </div>
            )}
            {recError && (
              <div className="rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-7 shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
                <p className="text-[0.9375rem] text-[#5A5C6E]">{recError}</p>
                <button onClick={handleSeeOptions} className="mt-3 text-sm font-semibold text-[#2D6A4F]">Try again</button>
              </div>
            )}

            {recommendation && (() => {
              // Build Google Routes times + transit label override
              const googleTimes: Record<string, number> = {}
              if (routeData?.routes) {
                if (routeData.routes.DRIVE) googleTimes.drive = routeData.routes.DRIVE.durationMins + 5
                if (routeData.routes.BICYCLE) { googleTimes.bike = routeData.routes.BICYCLE.durationMins; googleTimes.ebike = Math.round(routeData.routes.BICYCLE.durationMins * 0.75) }
                if (routeData.routes.WALK) googleTimes.walk = routeData.routes.WALK.durationMins
                if (routeData.routes.TRANSIT) googleTimes.transit = routeData.routes.TRANSIT.durationMins
              }
              const hasGoogleTimes = Object.keys(googleTimes).length > 0
              const transitSteps = routeData?.routes?.TRANSIT?.transitSteps

              // Override generic transit label with Google route data as fallback
              // (edge function provides specific labels when available)
              let displayPrimary = recommendation.primary
              const displaySecondary = recommendation.secondary
              if (transitSteps && transitSteps.length > 0) {
                function formatStep(step: TransitStep) {
                  const vType = step.vehicleType === 'BUS' ? 'Bus' : step.vehicleType === 'COMMUTER_RAIL' ? 'Commuter Rail' : ''
                  const name = step.lineShortName || step.lineName
                  return vType ? `${vType} ${name}` : name
                }
                const mainStep = transitSteps[0]
                const transitLabel = transitSteps.length === 1
                  ? `${formatStep(mainStep)} from ${mainStep.departureStop}`
                  : transitSteps.map(formatStep).join(' → ')
                if (recommendation.primary.label === 'MBTA Transit') {
                  displayPrimary = { ...recommendation.primary, label: transitLabel }
                }
              }
              // No route detail to name the line: plain words, not agency jargon.
              if (displayPrimary.label === 'MBTA Transit') {
                displayPrimary = { ...displayPrimary, label: 'Bus or train' }
              }

              return (
              <div className="animate-in space-y-5">
                {/* One-page plan to keep: the print layout lives in CommutePlanPrint */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgba(25,26,46,0.09)] bg-white px-4 py-3">
                  <p className="text-[0.875rem] leading-snug text-[#3D3F52]">
                    <span className="font-semibold text-[#191A2E]">Keep this plan.</span> One page with your route, times and costs, to print or save.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      // Analytics is never a reason not to print.
                      try { track('advisor_plan_printed', { primary_mode: recommendation.primary.modes[0] ?? 'drive' }) } catch { /* blocked or not yet loaded */ }
                      window.print()
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#191A2E] px-3.5 py-2 text-[0.8125rem] font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    <FilePdf size={16} weight="bold" aria-hidden />
                    Save as PDF
                  </button>
                </div>
                {(() => {
                  const recMode = displayPrimary.modes[0]
                  const benefitReason = (() => {
                    if ((recMode === 'bike' || recMode === 'ebike') && benefits.bluebikes_subsidized)
                      return benefits.bluebikes_subsidy_label || 'Your employer covers Bluebikes membership'
                    if (recMode === 'transit' && benefits.transit_subsidy_monthly && benefits.transit_subsidy_monthly > 0)
                      return benefits.transit_subsidy_label || `Your employer covers $${benefits.transit_subsidy_monthly}/mo toward transit`
                    if (recMode === 'walk' && benefits.showers)
                      return 'Showers available at the office for when you arrive'
                    return null
                  })()
                  const enrichedPrimary = benefitReason
                    ? { ...displayPrimary, reasons: [...displayPrimary.reasons, benefitReason] }
                    : displayPrimary
                  return (
                    <RecommendationCard
                      primary={enrichedPrimary} secondary={displaySecondary}
                      distanceMiles={recommendation.distance_miles} distanceCategory={recommendation.distance_category}
                      onRefresh={handleRefresh} loading={recLoading} routeTimeMinutes={getRouteTimeForMode()}
                      routeTimes={hasGoogleTimes ? googleTimes : undefined}
                      trackProps={{ advisor_variant: 'employer', employer_slug: group.slug }} />
                  )
                })()}

                {/* Mode comparison table */}
                {recommendation.comparisons && recommendation.comparisons.length > 1 && (() => {
                  let comps = recommendation.comparisons
                  if (transitSteps && transitSteps.length > 0) {
                    const tLabel = transitSteps.map(s => {
                      const vt = s.vehicleType === 'BUS' ? 'Bus' : ''
                      const name = s.lineShortName || s.lineName
                      return vt ? `${vt} ${name}` : name
                    }).join(' → ')
                    comps = comps.map(c => c.mode === 'transit' && c.label === 'MBTA Transit' ? { ...c, label: tLabel } : c)
                  }
                  comps = comps.map(c => c.label === 'MBTA Transit' ? { ...c, label: 'Bus or train' } : c)
                  comps = comps.map(c => ({
                    ...c,
                    pros: enrichProsWithBenefits(c.pros, benefits, c.mode),
                  }))
                  return (
                    <ModeComparisonTable
                      comparisons={comps}
                      winnerMode={comps[0]?.mode || ''}
                      selectedMode={selectedMode}
                      onSelectMode={handleModeSelect}
                      routeTimes={hasGoogleTimes ? googleTimes : undefined}
                      originLat={homePlaceData?.lat}
                      originLng={homePlaceData?.lng}
                      destLat={workPlaceData?.lat}
                      destLng={workPlaceData?.lng}
                      bikeComfort={recommendation.bike_comfort}
                      trackProps={{ advisor_variant: 'employer', employer_slug: group.slug }}
                    />
                  )
                })()}

                {homePlaceData && workPlaceData && (
                  <CommuteMap
                    originLat={homePlaceData.lat} originLng={homePlaceData.lng}
                    destLat={workPlaceData.lat} destLng={workPlaceData.lng}
                    bluebikesOrigin={recommendation.map_data.bluebikes_origin}
                    bluebikesDestStations={recommendation.map_data.bluebikes_dest}
                    mbtaStops={recommendation.map_data.mbta_stops}
                    recommendedModes={recommendation.primary.modes} />
                )}

                {/* Savings comparison — employer-specific */}
                {withBenefits && withoutBenefits && (
                  <div>
                    <EmployerSavingsComparison
                      withBenefits={withBenefits} withoutBenefits={withoutBenefits}
                      companyName={group.name} showComparison={isPremium}
                      costOnly={commuteMode === 'new'} />
                    {benefits.transit_subsidy_type === 'pre_tax' && (benefits.transit_subsidy_monthly ?? 0) > 0 && (altMode === 'mbta' || altMode === 'commuter_rail') && (
                      <p className="mt-2 px-1 text-[0.75rem] leading-snug text-[#5A5C6E]">
                        Pre-tax transit benefit counted as the tax it saves, about 30% of the amount set aside (federal and Massachusetts income tax plus payroll tax).
                      </p>
                    )}
                  </div>
                )}

                {/* Health + environment */}
                {withBenefits?.isActive && (
                  <div className="rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-6 shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-[9px] bg-[#FAFBF8] px-2 py-2 text-center">
                        <div className="text-base font-bold text-[#C97A2E]">{withBenefits.activeMins}</div>
                        <div className="mt-0.5 text-[11px] leading-snug text-[#5A5C6E]">active min/week</div>
                      </div>
                      <div className="rounded-[9px] bg-[#FAFBF8] px-2 py-2 text-center">
                        <div className="text-base font-bold text-[#C97A2E]">{withBenefits.weeklyCals.toLocaleString()}</div>
                        <div className="mt-0.5 text-[11px] leading-snug text-[#5A5C6E]">cal/week</div>
                      </div>
                      <div className="rounded-[9px] bg-[#FAFBF8] px-2 py-2 text-center">
                        <div className="text-base font-bold text-[#C97A2E]">{fmtCO2(withBenefits.co2)}</div>
                        <div className="mt-0.5 text-[11px] leading-snug text-[#5A5C6E]">CO₂ saved/yr</div>
                      </div>
                    </div>
                    <div className="mt-2 text-center text-[0.75rem] text-[#5A5C6E]">
                      {co2Equivalency(withBenefits.co2)}
                    </div>
                  </div>
                )}

                {/* Barrier selector with employer overrides */}
                <BarrierSelector
                  modes={selectedMode && selectedMode !== 'drive'
                    ? [selectedMode as Mode]
                    : recommendation.primary.modes}
                  selected={selectedBarriers}
                  onSelect={setSelectedBarriers} />

                {selectedBarriers.length > 0 && (
                  <>
                    {/* Employer-specific barrier responses */}
                    {selectedBarriers.filter(b => b !== 'habit').map(b => {
                      const override = getBarrierOverride(b)
                      if (!override) return null
                      return (
                        <div key={b} className="rounded-[14px] border border-[rgba(45,106,79,0.12)] bg-[#E7F0EA] p-6">
                          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#2D6A4F]">
                            Good news from {group.name}
                          </div>
                          <p className="text-[0.9375rem] leading-relaxed text-[#191A2E]">{override}</p>
                        </div>
                      )
                    })}
                    <GettingStarted
                      modes={selectedMode && selectedMode !== 'drive'
                        ? [selectedMode as Mode]
                        : recommendation.primary.modes}
                      barriers={selectedBarriers}
                      event={recommendation.content.event} />
                  </>
                )}

                {/* Shift CTA: the join link puts them straight onto the company team */}
                <div className="rounded-[14px] border border-[rgba(45,106,79,0.12)] bg-[linear-gradient(135deg,rgba(45,106,79,0.06),rgba(45,106,79,0.03))] px-5 py-6 sm:px-7">
                  <div className="mb-1 text-[1.0625rem] font-extrabold tracking-tight text-[#191A2E]">Get the app</div>
                  <div className="mb-3.5 text-[0.8rem] leading-relaxed text-[#5A5C6E]">
                    Track your commute with Shift — {group.name} employees who use Shift can join the company challenge and compete with teammates.
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={group.invite_code ? `${JOIN_BASE}${group.invite_code}` : '/shift'}
                      onClick={() => track('advisor_app_cta_clicked', { has_invite_code: !!group.invite_code })}
                      className="inline-block rounded-lg bg-[#2D6A4F] px-4 py-2 text-[0.8125rem] font-bold text-white transition-colors hover:bg-[#1F4D3A]">
                      {group.invite_code ? `Join ${group.name} on Shift` : 'Download the app'} &rarr;
                    </a>
                    {group.invite_code && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(group.invite_code!).catch(() => {})
                          setCodeCopied(true)
                          setTimeout(() => setCodeCopied(false), 2000)
                          track('advisor_team_code_copied')
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(25,26,46,0.09)] bg-white px-3 py-2 text-[0.8125rem] font-semibold text-[#191A2E] transition-colors hover:border-[rgba(25,26,46,0.18)]"
                        aria-label="Copy the team code"
                      >
                        <span className="text-[#5A5C6E]">Team code:</span>
                        <span className="font-mono font-bold tracking-wide">{group.invite_code}</span>
                        {codeCopied ? <Check size={14} weight="bold" className="text-[#2D6A4F]" /> : <Copy size={14} />}
                      </button>
                    )}
                  </div>
                  {group.invite_code && (
                    <div className="mt-2.5 text-[0.75rem] leading-snug text-[#5A5C6E]">
                      Already have the app? On the Community tab, tap Enter invite code and type it in.
                    </div>
                  )}
                </div>

                {/* HR contact */}
                {benefits.hr_contact_name && benefits.hr_contact_email && (
                  <div className="text-center text-[0.8125rem] text-[#5A5C6E]">
                    Questions about your commute benefits? Contact {benefits.hr_contact_name} at{' '}
                    <a href={`mailto:${benefits.hr_contact_email}`} className="text-[#2D6A4F] underline">{benefits.hr_contact_email}</a>
                  </div>
                )}

                <button onClick={() => setStep(1)}
                  className="w-full rounded-[10px] border border-[rgba(25,26,46,0.06)] bg-white py-3 text-[0.8125rem] font-semibold text-[#5A5C6E] transition-colors hover:border-[rgba(25,26,46,0.12)] hover:text-[#191A2E]">
                  &larr; Edit your commute details
                </button>
              </div>
              )})()}
          </div>
        )}

        {/* Footer spacer */}
        <div className="h-16" />
      </main>
      <Footer />
      {/* Print-only: the one-page commute plan (hidden on screen, shown by its own @media print rules) */}
      {step === 3 && recommendation && homePlaceData && workPlaceData && (
        <CommutePlanPrint
          group={group}
          benefits={benefits}
          recommendation={recommendation}
          routeData={routeData}
          homeAddress={homeAddress}
          workAddress={workAddress}
          locationName={locations.find((l) => l.id === locationId)?.name ?? null}
          driveDays={driveDays}
          joinLink={group.invite_code ? `${JOIN_BASE}${group.invite_code}` : null}
        />
      )}
    </div>
  )
}

/* ── Sub-components ── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#5A5C6E]">{label}</label>
      {children}
    </div>
  )
}

function NumInput({ value, onChange, min, max, step, width }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step: number; width?: string
}) {
  return (
    <input type="number" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)}
      min={min} max={max} step={step}
      className="rounded-[10px] border-[1.5px] border-[rgba(25,26,46,0.09)] bg-white px-3 py-2.5 text-center font-bold text-[#191A2E] transition-colors focus:border-[#2D6A4F] focus:ring-1 focus:ring-[#2D6A4F]/20 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
      style={{ width: width || '100px', fontSize: '1rem' }} />
  )
}

function RangeInput({ value, onChange, min, max, labels }: {
  value: number; onChange: (v: number) => void; min: number; max: number; labels: string[]
}) {
  return (
    <div>
      <input type="range" min={min} max={max} step={1} value={value} onChange={e => onChange(parseInt(e.target.value))}
        className="w-full cursor-pointer appearance-none rounded-full bg-[rgba(25,26,46,0.09)] outline-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#2D6A4F] [&::-webkit-slider-thumb]:shadow-[0_0_0_1.5px_#2D6A4F]"
        style={{ height: '6px' }} />
      <div className="mt-1 flex justify-between">{labels.map(l => <span key={l} className="text-[10px] text-[#5A5C6E]">{l}</span>)}</div>
    </div>
  )
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full cursor-pointer appearance-none rounded-[10px] border-[1.5px] border-[rgba(25,26,46,0.09)] bg-white bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2012%208%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20stroke%3D%22%238A8DA8%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_0.875rem_center] bg-no-repeat px-3.5 py-2.5 text-sm text-[#191A2E] transition-colors focus:border-[#2D6A4F] focus:ring-1 focus:ring-[#2D6A4F]/20 focus:outline-none">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
          value === o.value ? 'border-[#2D6A4F] bg-[#2D6A4F] text-white' : 'border-[rgba(25,26,46,0.09)] text-[#191A2E] hover:border-[rgba(25,26,46,0.18)]'
        }`}>
          <input type="radio" name={name} value={o.value} checked={value === o.value}
            onChange={() => onChange(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  )
}
