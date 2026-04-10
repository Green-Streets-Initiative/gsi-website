'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import RecommendationCard from '@/components/commute/RecommendationCard'
import CommuteMap from '@/components/commute/CommuteMap'
import BarrierSelector from '@/components/commute/BarrierSelector'
import GettingStarted from '@/components/commute/GettingStarted'
import EmployerBenefits from '@/components/commute/EmployerBenefits'
import EmployerSavingsComparison from '@/components/commute/EmployerSavingsComparison'
import ModeComparisonTable from '@/components/commute/ModeComparisonTable'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import type { EmployerGroup, RecommendationResponse, BarrierCode } from '@/lib/types/commute'

type PlaceData = { placeId: string; lat: number; lng: number }
type RouteResult = { durationMins: number; distanceMiles: number } | null
type RouteResponse = { routes: Record<string, RouteResult>; cached: boolean }

const MODE_TO_GOOGLE: Record<string, string> = {
  bike: 'BICYCLE', ebike: 'BICYCLE', walk: 'WALK',
  mbta: 'TRANSIT', commuter_rail: 'TRANSIT',
}

const VEHICLES: Record<string, { mpg: number; maint: number; isEV?: boolean; costPerMile?: number }> = {
  small_sedan: { mpg: 32, maint: 0.102 }, medium_sedan: { mpg: 28, maint: 0.109 },
  compact_suv: { mpg: 27, maint: 0.104 }, medium_suv: { mpg: 24, maint: 0.110 },
  pickup: { mpg: 20, maint: 0.114 }, ev: { mpg: 0, maint: 0.06, isEV: true, costPerMile: 0.048 },
}

const MODES: Record<string, { met: number; mph: number | null; label: string; healthNote: string }> = {
  walk: { met: 4.0, mph: 3.5, label: 'Walking', healthNote: 'each way on foot' },
  bike: { met: 8.0, mph: 11, label: 'Cycling', healthNote: 'each way by bike' },
  ebike: { met: 4.5, mph: 15, label: 'E-bike', healthNote: 'each way by e-bike' },
  mbta: { met: 0, mph: null, label: 'MBTA', healthNote: '' },
  commuter_rail: { met: 0, mph: null, label: 'Commuter rail', healthNote: '' },
}

const DRIVE_MPH = 14
const MBTA_SUBWAY_SINGLE = 2.40
const MBTA_SUBWAY_MONTHLY = 90
const WEEKS = 52
const CO2_PER_MILE = 0.404
const BODY_WEIGHT_LBS = 165

const fmt = (n: number) => n < 0 ? `-$${Math.abs(Math.round(n)).toLocaleString()}` : `$${Math.round(n).toLocaleString()}`
const fmtCO2 = (kg: number) => kg >= 1000 ? `${(kg / 1000).toFixed(2)} tons` : `${Math.round(kg)} kg`

const PARKING_ANCHORS = [
  { label: 'Downtown Boston $32', val: 32 }, { label: 'Back Bay $26', val: 26 },
  { label: 'Kendall $22', val: 22 }, { label: 'Somerville $14', val: 14 },
]

interface Props {
  group: EmployerGroup
  isDemo?: boolean
}

export default function EmployerCommuteAdvisor({ group, isDemo }: Props) {
  const benefits = group.employer_benefits
  const isPremium = group.tier === 'premium'

  // Inputs
  const [distance, setDistance] = useState(7)
  const [driveDays, setDriveDays] = useState(5)
  const [shiftDays, setShiftDays] = useState(3)
  const [vehicle, setVehicle] = useState('medium_sedan')
  const [gasPrice, setGasPrice] = useState(3.59)
  const [parkMode, setParkMode] = useState(benefits.free_parking ? 'free' : 'full')
  const [parkingCost, setParkingCost] = useState(15)
  const [commuteMode, setCommuteMode] = useState('drive')
  const [rideshareDaily, setRideshareDaily] = useState(30)
  const [altMode, setAltMode] = useState('bike')
  const [step, setStep] = useState(1)

  // Routing
  const [homeAddress, setHomeAddress] = useState('')
  const [workAddress, setWorkAddress] = useState(benefits.destination_address || '')
  const [homePlaceData, setHomePlaceData] = useState<PlaceData | null>(null)
  const [workPlaceData, setWorkPlaceData] = useState<PlaceData | null>(
    benefits.destination_lat && benefits.destination_lng
      ? { placeId: '', lat: benefits.destination_lat, lng: benefits.destination_lng }
      : null
  )
  const [routeData, setRouteData] = useState<RouteResponse | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const routeAbortRef = useRef<AbortController | null>(null)

  // Recommendation
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null)
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)
  const [selectedBarrier, setSelectedBarrier] = useState<BarrierCode | null>(null)
  const [outsideMA, setOutsideMA] = useState(false)
  const recommendRef = useRef<HTMLDivElement>(null)

  // Fetch routing
  useEffect(() => {
    if (!homePlaceData || !workPlaceData) { setRouteData(null); return }
    const googleMode = MODE_TO_GOOGLE[altMode]
    if (!googleMode) return
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
            modes: ['DRIVE', googleMode],
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
  }, [homePlaceData, workPlaceData, altMode])

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
      const res = await fetch(`/api/commute/recommend?${params}`)
      const data = await res.json()
      if (data.error === 'outside_ma') { setOutsideMA(true); setRecommendation(null); return }
      setRecommendation(data)
      const recMode = data.primary?.modes?.[0]
      if (recMode === 'walk') setAltMode('walk')
      else if (recMode === 'bike') setAltMode('bike')
      else if (recMode === 'ebike') setAltMode('ebike')
      else if (recMode === 'transit' || recMode === 'bus') setAltMode('mbta')
    } catch { setRecError('Unable to load recommendation.') } finally { setRecLoading(false) }
  }, [homePlaceData, workPlaceData])

  const handleSeeOptions = () => {
    setStep(3); setSelectedBarrier(null); fetchRecommendation()
    setTimeout(() => recommendRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }
  const handleBarrierSelect = (b: BarrierCode) => setSelectedBarrier(b)
  const handleRefresh = () => fetchRecommendation(selectedBarrier)

  useEffect(() => { if (shiftDays > driveDays) setShiftDays(driveDays) }, [driveDays, shiftDays])

  // Calculate savings — with and without employer benefits
  const calcSavings = useCallback((applyBenefits: boolean) => {
    if (distance <= 0) return null
    const v = VEHICLES[vehicle]
    const mode = MODES[altMode]
    const sd = Math.min(shiftDays, driveDays)
    const milesRound = distance * 2
    const annualMiles = milesRound * sd * WEEKS
    const isRideshare = commuteMode === 'rideshare'

    let fuelSavings = 0, maintSavings = 0, rideshareSavings = 0, fuelLabel = 'Fuel savings'
    if (isRideshare) { rideshareSavings = rideshareDaily * sd * WEEKS }
    else if (v.isEV) { fuelSavings = annualMiles * v.costPerMile!; fuelLabel = 'Electricity savings'; maintSavings = annualMiles * v.maint }
    else { fuelSavings = annualMiles * (gasPrice / v.mpg); maintSavings = annualMiles * v.maint }

    let parkingSavings = 0
    if (parkMode !== 'free' && !isRideshare) parkingSavings = parkingCost * sd * WEEKS

    let transitCost = 0, transitLabel = ''
    if (altMode === 'mbta') {
      const monthlyPass = MBTA_SUBWAY_MONTHLY
      const perRideAnnual = MBTA_SUBWAY_SINGLE * 2 * sd * WEEKS
      const passAnnual = monthlyPass * 12
      if (perRideAnnual > passAnnual) { transitCost = passAnnual; transitLabel = 'Monthly LinkPass' }
      else { transitCost = perRideAnnual; transitLabel = 'Per-ride fares' }
      // Apply employer transit subsidy
      if (applyBenefits && benefits.transit_subsidy_monthly && benefits.transit_subsidy_monthly > 0) {
        transitCost = Math.max(0, transitCost - benefits.transit_subsidy_monthly * 12)
      }
    }

    const grossSavings = isRideshare ? rideshareSavings : (fuelSavings + maintSavings + parkingSavings)
    const net = grossSavings - transitCost
    const isActive = ['walk', 'bike', 'ebike'].includes(altMode)
    let activeMins = 0, weeklyCals = 0
    if (isActive && mode.mph) {
      activeMins = Math.round((distance / mode.mph) * 60) * 2 * sd
      weeklyCals = Math.round(mode.met * (BODY_WEIGHT_LBS / 2.205) * (activeMins / 60))
    }
    const co2 = annualMiles * (v.isEV ? CO2_PER_MILE * 0.35 : CO2_PER_MILE)

    return { net, fuelSavings, maintSavings, parkingSavings, transitCost, transitLabel, fuelLabel, rideshareSavings, isRideshare, isActive, activeMins, weeklyCals, annualMiles, co2,
      driveMins: Math.round((distance / DRIVE_MPH) * 60),
      altMins: mode.mph ? Math.round((distance / mode.mph) * 60) : null,
      mode, isRealRouting: false, timeNote: '', gymEquiv: isActive && mode.mph ? ((activeMins / 45).toFixed(1)) : '0' }
  }, [distance, driveDays, shiftDays, vehicle, gasPrice, parkMode, parkingCost, altMode, commuteMode, rideshareDaily, benefits])

  const withBenefits = calcSavings(true)
  const withoutBenefits = calcSavings(false)
  const effectiveShift = Math.min(shiftDays, driveDays)

  const getRouteTimeForMode = useCallback(() => {
    if (!routeData || !recommendation) return null
    const recMode = recommendation.primary.modes[0]
    const googleKey = recMode === 'walk' ? 'WALK' : (recMode === 'bike' || recMode === 'ebike') ? 'BICYCLE' : 'TRANSIT'
    return routeData.routes[googleKey]?.durationMins ?? null
  }, [routeData, recommendation])

  // Employer-specific barrier override
  const getBarrierOverride = (barrier: BarrierCode): string | null => {
    if (barrier === 'logistics' && benefits.showers) {
      return `${group.name} has showers${benefits.shower_details ? ` (${benefits.shower_details})` : ''} and ${benefits.bike_parking ? 'secure bike storage' : 'bike facilities'} at the office. No need to worry about arriving sweaty.`
    }
    if (barrier === 'safety' && benefits.bike_parking) {
      return `Secure bike parking${benefits.bike_parking_details ? ` at ${benefits.bike_parking_details}` : ''} means your bike is safe while you're at work.`
    }
    if (barrier === 'time' && benefits.shuttle_routes && benefits.shuttle_routes.length > 0) {
      const shuttle = benefits.shuttle_routes[0]
      return `${group.name} runs a free shuttle from ${shuttle.from_stop}. ${shuttle.schedule}`
    }
    return null
  }

  return (
    <>
      <Nav />
      <main className="bg-[#191A2E]" style={{ paddingTop: '60px' }}>
        {/* Demo banner */}
        {isDemo && (
          <div className="bg-[#BAF14D] px-6 py-2.5 text-center">
            <span className="text-[0.8125rem] font-semibold text-[#191A2E]">
              This is a personalized preview for {group.name}
            </span>
            <span className="mx-2 text-[#191A2E]/40">·</span>
            <Link href="/contact?inquiry=employer" className="text-[0.8125rem] font-semibold text-[#191A2E] underline">
              Contact us to get started
            </Link>
          </div>
        )}

        {/* Co-branded header */}
        <div className="mx-auto max-w-[640px] px-8 pb-6 pt-10 text-center">
          <div className="mb-4 flex items-center justify-center gap-6">
            <span className="text-[0.9rem] tracking-[0.3px]" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
              <span className="font-bold text-[#52B788]">Green Streets</span>{' '}
              <span className="font-normal text-white/60">Initiative</span>
            </span>
            {group.logo_url ? (
              <img src={group.logo_url} alt={group.name} className="h-9 w-auto object-contain" />
            ) : (
              <span className="font-display text-[1rem] font-bold text-white">{group.name}</span>
            )}
          </div>
          <h1 className="mb-2 font-display text-[clamp(1.5rem,3vw,2.25rem)] font-extrabold leading-[1.15] tracking-tighter text-white">
            Find your <em className="not-italic text-[#BAF14D]">best commute</em>
          </h1>
          <p className="text-[0.9375rem] text-white/60">
            Commute Advisor for {group.name} employees
          </p>
        </div>

        {/* Step indicator */}
        <div className="mx-auto mb-6 flex max-w-[480px] items-center justify-center gap-2 px-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <button onClick={() => s < step && setStep(s)} disabled={s > step}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  s === step ? 'bg-[#BAF14D] text-[#191A2E]'
                  : s < step ? 'bg-[#BAF14D]/20 text-[#BAF14D] hover:bg-[#BAF14D]/30'
                  : 'bg-white/[0.08] text-white/30'
                }`}>{s < step ? '✓' : s}</button>
              {s < 3 && <div className={`h-px w-12 ${s < step ? 'bg-[#BAF14D]/30' : 'bg-white/[0.08]'}`} />}
            </div>
          ))}
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="mx-auto max-w-[520px] px-8">
            <div className="overflow-hidden rounded-[20px] border border-white/[0.12] bg-[#242538] p-8">
              <div className="mb-6 font-display text-[1.125rem] font-bold text-white">Where&apos;s your commute?</div>
              <div className="mb-5 space-y-3">
                <AddressAutocomplete value={homeAddress}
                  onChange={(val) => { setHomeAddress(val); if (!val) setHomePlaceData(null) }}
                  onPlaceSelected={setHomePlaceData} label="Home address" variant="dark" placeholder="Where do you live?" />
                <AddressAutocomplete value={workAddress}
                  onChange={(val) => { setWorkAddress(val); if (!val) setWorkPlaceData(null) }}
                  onPlaceSelected={setWorkPlaceData}
                  label={benefits.destination_address ? 'Your workplace' : 'Work address'}
                  variant="dark" placeholder="Where do you work?" />
              </div>

              {/* Employer benefits checklist */}
              {!isDemo && <EmployerBenefits companyName={group.name} benefits={benefits} />}

              <button onClick={() => setStep(2)} disabled={!homePlaceData}
                className="mt-6 w-full rounded-xl bg-[#BAF14D] py-3 text-[0.9375rem] font-bold text-[#191A2E] transition-opacity hover:opacity-90 disabled:opacity-30">
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div className="mx-auto max-w-[520px] px-8">
            <div className="overflow-hidden rounded-[20px] border border-white/[0.12] bg-[#242538] p-8">
              <div className="mb-6 font-display text-[1.125rem] font-bold text-white">How do you get there now?</div>
              <Field label="Current commute mode">
                <RadioPills name="commute-mode" value={commuteMode} onChange={setCommuteMode}
                  options={[{ value: 'drive', label: 'Drive' }, { value: 'rideshare', label: 'Rideshare' }]} />
                {commuteMode === 'rideshare' && (
                  <div className="mt-3.5 flex items-center gap-2">
                    <span className="font-display text-lg font-bold text-[#BAF14D]">$</span>
                    <NumInput value={rideshareDaily} onChange={setRideshareDaily} min={5} max={200} step={1} width="88px" />
                    <span className="text-[0.8rem] text-white">per day (round trip)</span>
                  </div>
                )}
              </Field>
              <Field label="Days per week">
                <div className="mb-2 font-display text-base font-bold text-[#BAF14D]">{driveDays} day{driveDays > 1 ? 's' : ''}/week</div>
                <RangeInput value={driveDays} onChange={setDriveDays} min={1} max={5} labels={['1','2','3','4','5']} />
              </Field>
              <Field label="Days you'd go active instead">
                <div className="mb-2 font-display text-base font-bold text-[#BAF14D]">{effectiveShift} day{effectiveShift > 1 ? 's' : ''}/week</div>
                <RangeInput value={effectiveShift} onChange={setShiftDays} min={1} max={5} labels={['1','2','3','4','5']} />
              </Field>
              {commuteMode === 'drive' && (
                <>
                  <Field label="Vehicle type">
                    <Select value={vehicle} onChange={setVehicle} options={[
                      { value: 'small_sedan', label: 'Small sedan' }, { value: 'medium_sedan', label: 'Medium sedan' },
                      { value: 'compact_suv', label: 'Compact SUV' }, { value: 'medium_suv', label: 'Medium SUV' },
                      { value: 'pickup', label: 'Pickup truck' }, { value: 'ev', label: 'Electric vehicle' },
                    ]} />
                  </Field>
                  {vehicle !== 'ev' && (
                    <Field label="Gas price">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-lg font-bold text-[#BAF14D]">$</span>
                        <NumInput value={gasPrice} onChange={setGasPrice} min={2} max={8} step={0.01} width="88px" />
                        <span className="text-[0.8rem] text-white">per gallon</span>
                      </div>
                    </Field>
                  )}
                  <Field label="Parking">
                    <RadioPills name="parking" value={parkMode} onChange={setParkMode}
                      options={[
                        { value: 'free', label: benefits.free_parking ? 'Free (employer)' : 'Free' },
                        { value: 'subsidized', label: 'I pay something' },
                        { value: 'full', label: 'Full cost' },
                      ]} />
                    {parkMode !== 'free' && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="font-display text-lg font-bold text-[#BAF14D]">$</span>
                        <NumInput value={parkingCost} onChange={setParkingCost} min={0} max={80} step={1} width="78px" />
                        <span className="text-[0.8rem] text-white">per day</span>
                      </div>
                    )}
                    {parkMode === 'full' && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {PARKING_ANCHORS.map(a => (
                          <button key={a.val} onClick={() => setParkingCost(a.val)}
                            className="rounded-md border border-white/[0.12] bg-white/[0.06] px-2 py-1 text-[0.65rem] font-semibold text-white transition-colors hover:bg-white/10">
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </Field>
                </>
              )}
              <div className="mt-4 flex gap-3">
                <button onClick={() => setStep(1)}
                  className="rounded-xl border border-white/[0.12] px-6 py-3 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-white/[0.05]">
                  Back
                </button>
                <button onClick={handleSeeOptions}
                  className="flex-1 rounded-xl bg-[#BAF14D] py-3 text-[0.9375rem] font-bold text-[#191A2E] transition-opacity hover:opacity-90">
                  See my options
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div ref={recommendRef} className="mx-auto max-w-[640px] px-8">
            {recLoading && !recommendation && (
              <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-7 text-center">
                <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-[#BAF14D]" />
                <p className="text-sm text-white/60">Analyzing your commute...</p>
              </div>
            )}
            {outsideMA && (
              <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-7">
                <p className="text-[0.9375rem] text-white">Our recommendation engine is optimized for Massachusetts commutes.</p>
                <button onClick={() => setStep(1)} className="mt-4 text-sm font-semibold text-[#BAF14D]">← Start over</button>
              </div>
            )}
            {recError && (
              <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-7">
                <p className="text-[0.9375rem] text-white/70">{recError}</p>
                <button onClick={handleSeeOptions} className="mt-3 text-sm font-semibold text-[#BAF14D]">Try again</button>
              </div>
            )}

            {recommendation && (
              <div className="animate-in space-y-5">
                <RecommendationCard
                  primary={recommendation.primary} secondary={recommendation.secondary}
                  distanceMiles={recommendation.distance_miles} distanceCategory={recommendation.distance_category}
                  onRefresh={handleRefresh} loading={recLoading} routeTimeMinutes={getRouteTimeForMode()}
                  routeTimes={routeData?.routes ? Object.fromEntries(
                    [['drive', routeData.routes.DRIVE ? routeData.routes.DRIVE.durationMins + 5 : undefined],
                     ['bike', routeData.routes.BICYCLE?.durationMins],
                     ['ebike', routeData.routes.BICYCLE ? Math.round(routeData.routes.BICYCLE.durationMins * 0.75) : undefined],
                     ['walk', routeData.routes.WALK?.durationMins],
                     ['transit', routeData.routes.TRANSIT?.durationMins]]
                    .filter(([, v]) => v !== undefined)
                  ) : undefined} />

                {/* Mode comparison table */}
                {recommendation.comparisons && recommendation.comparisons.length > 1 && (
                  <ModeComparisonTable
                    comparisons={recommendation.comparisons}
                    winnerMode={recommendation.comparisons[0]?.mode || ''}
                    routeTimes={routeData?.routes ? Object.fromEntries(
                      [['drive', routeData.routes.DRIVE ? routeData.routes.DRIVE.durationMins + 5 : undefined],
                       ['bike', routeData.routes.BICYCLE?.durationMins],
                       ['ebike', routeData.routes.BICYCLE ? Math.round(routeData.routes.BICYCLE.durationMins * 0.75) : undefined],
                       ['walk', routeData.routes.WALK?.durationMins],
                       ['transit', routeData.routes.TRANSIT?.durationMins]]
                      .filter(([, v]) => v !== undefined)
                    ) : undefined}
                  />
                )}

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
                  <EmployerSavingsComparison
                    withBenefits={withBenefits} withoutBenefits={withoutBenefits}
                    companyName={group.name} showComparison={isPremium} />
                )}

                {/* Health + environment */}
                {withBenefits?.isActive && (
                  <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-6">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-[9px] bg-white/[0.04] px-2 py-2 text-center">
                        <div className="font-display text-base font-bold text-[#EDB93C]">{withBenefits.activeMins}</div>
                        <div className="mt-0.5 text-[9px] leading-snug text-white/60">active min/week</div>
                      </div>
                      <div className="rounded-[9px] bg-white/[0.04] px-2 py-2 text-center">
                        <div className="font-display text-base font-bold text-[#EDB93C]">{withBenefits.weeklyCals.toLocaleString()}</div>
                        <div className="mt-0.5 text-[9px] leading-snug text-white/60">cal/week</div>
                      </div>
                      <div className="rounded-[9px] bg-white/[0.04] px-2 py-2 text-center">
                        <div className="font-display text-base font-bold text-[#EDB93C]">{fmtCO2(withBenefits.co2)}</div>
                        <div className="mt-0.5 text-[9px] leading-snug text-white/60">CO₂ saved/yr</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Barrier selector with employer overrides */}
                <BarrierSelector
                  modes={recommendation.primary.modes} selected={selectedBarrier}
                  onSelect={handleBarrierSelect} />

                {selectedBarrier && (
                  <>
                    {/* Employer-specific barrier response */}
                    {getBarrierOverride(selectedBarrier) && (
                      <div className="rounded-2xl border border-[rgba(186,241,77,0.15)] bg-[rgba(186,241,77,0.06)] p-6">
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#BAF14D]/60">
                          Good news from {group.name}
                        </div>
                        <p className="text-[0.9375rem] leading-relaxed text-white">
                          {getBarrierOverride(selectedBarrier)}
                        </p>
                      </div>
                    )}
                    <GettingStarted modes={recommendation.primary.modes} barrier={selectedBarrier}
                      event={recommendation.content.event} />
                  </>
                )}

                {/* Shift CTA */}
                <div className="rounded-2xl border border-[rgba(186,241,77,0.18)] bg-[linear-gradient(135deg,rgba(41,102,229,0.15),rgba(186,241,77,0.08))] px-7 py-6">
                  <div className="mb-1 font-display text-[1.0625rem] font-extrabold tracking-tight text-white">Start earning</div>
                  <div className="mb-3.5 text-[0.8rem] leading-relaxed text-white">
                    Track your commute with Shift — {group.name} employees who use Shift can join the company challenge and compete with teammates.
                  </div>
                  <a href="/shift" className="inline-block rounded-lg bg-[#BAF14D] px-4 py-2 text-[0.8125rem] font-bold text-[#191A2E] transition-opacity hover:opacity-85">
                    Download the app &rarr;
                  </a>
                </div>

                {/* HR contact */}
                {benefits.hr_contact_name && benefits.hr_contact_email && (
                  <div className="text-center text-[0.8125rem] text-white/40">
                    Questions about your commute benefits? Contact {benefits.hr_contact_name} at{' '}
                    <a href={`mailto:${benefits.hr_contact_email}`} className="text-[#BAF14D] underline">{benefits.hr_contact_email}</a>
                  </div>
                )}

                <button onClick={() => setStep(1)}
                  className="w-full rounded-xl border border-white/[0.08] py-3 text-[0.8125rem] font-semibold text-white/50 transition-colors hover:border-white/[0.15] hover:text-white/70">
                  ← Edit your commute details
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer spacer */}
        <div className="h-16" />
      </main>
      <Footer />
    </>
  )
}

/* ── Sub-components ── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white">{label}</label>
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
      className="rounded-[10px] border-[1.5px] border-white/[0.12] bg-white/[0.06] px-3 py-2.5 text-center font-display font-bold text-white transition-colors focus:border-[#BAF14D] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
      style={{ width: width || '100px', fontSize: '1rem' }} />
  )
}

function RangeInput({ value, onChange, min, max, labels }: {
  value: number; onChange: (v: number) => void; min: number; max: number; labels: string[]
}) {
  return (
    <div>
      <input type="range" min={min} max={max} step={1} value={value} onChange={e => onChange(parseInt(e.target.value))}
        className="w-full cursor-pointer appearance-none rounded-full bg-white/10 outline-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-[#191A2E] [&::-webkit-slider-thumb]:bg-[#BAF14D] [&::-webkit-slider-thumb]:shadow-[0_0_0_1.5px_#BAF14D]"
        style={{ height: '6px' }} />
      <div className="mt-1 flex justify-between">{labels.map(l => <span key={l} className="text-[10px] text-white">{l}</span>)}</div>
    </div>
  )
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full cursor-pointer appearance-none rounded-[10px] border-[1.5px] border-white/[0.12] bg-white/[0.06] bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2012%208%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20stroke%3D%22%238A8DA8%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_0.875rem_center] bg-no-repeat px-3.5 py-2.5 text-sm text-white transition-colors focus:border-[#BAF14D] focus:outline-none">
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
          value === o.value ? 'border-[#BAF14D] bg-[#BAF14D] text-[#191A2E]' : 'border-white/[0.12] text-white hover:border-white/25'
        }`}>
          <input type="radio" name={name} value={o.value} checked={value === o.value}
            onChange={() => onChange(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  )
}
