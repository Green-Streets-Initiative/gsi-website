'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import AddressAutocomplete from '@/components/AddressAutocomplete'

type PlaceData = { placeId: string; lat: number; lng: number }
type RouteResult = { durationMins: number; distanceMiles: number } | null
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
const MBTA_SUBWAY_SINGLE = 2.40
const MBTA_SUBWAY_MONTHLY = 90
const MBTA_BUS_SINGLE = 1.70
const MBTA_BUS_MONTHLY = 55
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
    a: 'Daily parking rates in Greater Boston vary significantly by neighborhood. Downtown Boston and the Seaport typically run <strong>$28–$35 per day</strong>. Back Bay and the South End average $22–$28. Cambridge near Kendall Square runs $18–$25. Somerville, Medford, and inner suburban areas typically range from $10–$16. Monthly garage parking in downtown Boston averages $350–$500/month. Many employers subsidize or provide free parking — which is why this calculator asks about your actual situation rather than assuming you pay market rate.',
  },
]

/* ── Component ── */
export default function CommuteCalculator() {
  // Inputs
  const [distance, setDistance] = useState(7)
  const [driveDays, setDriveDays] = useState(5)
  const [shiftDays, setShiftDays] = useState(3)
  const [vehicle, setVehicle] = useState('medium_sedan')
  const [gasPrice, setGasPrice] = useState(3.59)
  const [parkMode, setParkMode] = useState('free')
  const [parkingCost, setParkingCost] = useState(15)
  const [commuteMode, setCommuteMode] = useState('drive')
  const [rideshareDaily, setRideshareDaily] = useState(30)
  const [altMode, setAltMode] = useState('bike')
  const [railZone, setRailZone] = useState(140)
  const [mbtaType, setMbtaType] = useState('subway')
  const [hasEmployerSubsidy, setHasEmployerSubsidy] = useState(false)
  const [employerSubsidy, setEmployerSubsidy] = useState(0)
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)

  // Routing state
  const [homeAddress, setHomeAddress] = useState('')
  const [workAddress, setWorkAddress] = useState('')
  const [homePlaceData, setHomePlaceData] = useState<PlaceData | null>(null)
  const [workPlaceData, setWorkPlaceData] = useState<PlaceData | null>(null)
  const [routeData, setRouteData] = useState<RouteResponse | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState(false)
  const routeAbortRef = useRef<AbortController | null>(null)

  // Fetch routing when both addresses and alt mode are set
  useEffect(() => {
    if (!homePlaceData || !workPlaceData) {
      setRouteData(null)
      return
    }

    const googleMode = MODE_TO_GOOGLE[altMode]
    if (!googleMode) return

    // Abort previous request
    routeAbortRef.current?.abort()
    const controller = new AbortController()
    routeAbortRef.current = controller

    const timer = setTimeout(async () => {
      setRouteLoading(true)
      setRouteError(false)
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
  }, [homePlaceData, workPlaceData, altMode])

  // Cap shift days to drive days
  useEffect(() => {
    if (shiftDays > driveDays) setShiftDays(driveDays)
  }, [driveDays, shiftDays])

  // Calculate results
  const calc = useCallback(() => {
    if (distance <= 0) return null
    const v = VEHICLES[vehicle]
    const mode = MODES[altMode]
    const sd = Math.min(shiftDays, driveDays)
    const milesRound = distance * 2
    const annualMiles = milesRound * sd * WEEKS
    const isRideshare = commuteMode === 'rideshare'

    // Money
    let fuelSavings = 0
    let maintSavings = 0
    let rideshareSavings = 0
    let fuelLabel = '⛽ Fuel savings'

    if (isRideshare) {
      rideshareSavings = rideshareDaily * sd * WEEKS
    } else if (v.isEV) {
      fuelSavings = annualMiles * v.costPerMile!
      fuelLabel = '⚡ Electricity savings'
      maintSavings = annualMiles * v.maint
    } else {
      fuelSavings = annualMiles * (gasPrice / v.mpg)
      maintSavings = annualMiles * v.maint
    }

    let parkingSavings = 0
    if (parkMode !== 'free' && !isRideshare) {
      parkingSavings = parkingCost * sd * WEEKS
    }

    let transitCost = 0
    let transitLabel = ''
    if (altMode === 'mbta') {
      const single = mbtaType === 'bus' ? MBTA_BUS_SINGLE : MBTA_SUBWAY_SINGLE
      const monthly = mbtaType === 'bus' ? MBTA_BUS_MONTHLY : MBTA_SUBWAY_MONTHLY
      const monthlyTrips = sd * 2 * (WEEKS / 12)
      const perRideAnnual = single * 2 * sd * WEEKS
      const passAnnual = monthly * 12
      if (monthlyTrips > (monthly / single)) { transitCost = passAnnual; transitLabel = mbtaType === 'bus' ? 'Monthly bus pass' : 'Monthly LinkPass' }
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

    const grossSavings = isRideshare ? rideshareSavings : (fuelSavings + maintSavings + parkingSavings)
    const net = grossSavings - transitCost

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
      driveMins, altMins, timeNote, isRealRouting, mode,
      isActive, activeMins, weeklyCals, gymEquiv,
      annualMiles, co2,
    }
  }, [distance, driveDays, shiftDays, vehicle, gasPrice, parkMode, parkingCost, altMode, railZone, commuteMode, rideshareDaily, mbtaType, hasEmployerSubsidy, employerSubsidy, routeData])

  const r = calc()
  const effectiveShift = Math.min(shiftDays, driveDays)

  return (
    <>
      <Nav />
      <main className="bg-[#191A2E]" style={{ paddingTop: '60px' }}>

        {/* Hero */}
        <div className="mx-auto max-w-[780px] px-8 pt-16">
          <div className="mb-5 text-[11px] font-semibold uppercase tracking-widest text-white/45">
            <Link href="/" className="text-[#BAF14D] no-underline hover:underline">Home</Link>
            {' / '}Commute Calculator
          </div>
          <h1 className="mb-5 font-display text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.1] tracking-tighter text-white">
            What if your commute <em className="not-italic text-[#BAF14D]">worked for you</em>?
          </h1>
          <p className="mb-8 max-w-[640px] text-[1.0625rem] leading-[1.7] text-white/70">
            Most people haven&apos;t done the math on their commute. Not just what it costs — but what it could look like if there were a better way. This calculator shows you the money you&apos;d keep, the time you&apos;d reclaim, and the health benefits you&apos;d gain by going active, even a few days a week.
          </p>
          <div className="flex flex-wrap gap-8">
            <div>
              <div className="font-display text-[2rem] font-extrabold leading-none tracking-tighter text-[#BAF14D]">$11,577</div>
              <div className="mt-1 text-[0.78rem] leading-snug text-white/45">Average annual cost to own and drive a new car (AAA 2025)</div>
            </div>
            <div>
              <div className="font-display text-[2rem] font-extrabold leading-none tracking-tighter text-[#BAF14D]">$3.59</div>
              <div className="mt-1 text-[0.78rem] leading-snug text-white/45">Current Massachusetts average gas price per gallon (AAA, March 2026)</div>
            </div>
            <div>
              <div className="font-display text-[2rem] font-extrabold leading-none tracking-tighter text-[#BAF14D]">$90</div>
              <div className="mt-1 text-[0.78rem] leading-snug text-white/45">Monthly MBTA LinkPass — unlimited subway and bus</div>
            </div>
          </div>
        </div>

        <hr className="mx-auto my-10 max-w-[780px] border-white/[0.07]" />

        {/* Calculator */}
        <div className="mx-auto max-w-[1000px] px-8">
          <div className="mb-5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Commute calculator</div>
          <div className="overflow-hidden rounded-[20px] border border-white/[0.12] bg-[#242538]">
            <div className="grid gap-0 md:grid-cols-2">

              {/* ── INPUTS ── */}
              <div className="border-b border-white/[0.07] p-9 md:border-b-0 md:border-r">
                <div className="mb-7 font-display text-[0.9375rem] font-bold text-white">Your commute today</div>

                {/* Addresses for real routing */}
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

                {/* Distance */}
                <Field label="One-way distance">
                  <div className="flex items-center gap-3">
                    <NumInput value={distance} onChange={setDistance} min={0.5} max={60} step={0.5} />
                    <span className="text-[0.8rem] text-white/45">miles each way</span>
                  </div>
                  <Hint>{homePlaceData && workPlaceData ? 'Distance auto-set from routing — adjust to override' : 'Enter addresses above for real routing, or set distance manually'}</Hint>
                </Field>

                {/* Commute mode */}
                <Field label="How you currently commute">
                  <RadioPills
                    name="commute-mode"
                    value={commuteMode}
                    onChange={setCommuteMode}
                    options={[
                      { value: 'drive', label: 'Drive' },
                      { value: 'rideshare', label: 'Rideshare (Uber/Lyft)' },
                    ]}
                  />
                  {commuteMode === 'rideshare' && (
                    <div className="mt-3.5">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Average daily rideshare cost</label>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-lg font-bold text-[#BAF14D]">$</span>
                        <NumInput value={rideshareDaily} onChange={setRideshareDaily} min={5} max={200} step={1} width="88px" fontSize="1rem" />
                        <span className="text-[0.8rem] text-white/45">per day (round trip)</span>
                      </div>
                      <div className="mt-1 text-[0.65rem] text-white/25">Average Uber/Lyft cost for your commute, both ways</div>
                    </div>
                  )}
                </Field>

                {/* Drive days */}
                <Field label={commuteMode === 'rideshare' ? 'Days per week you currently rideshare' : 'Days per week you currently drive'}>
                  <div className="mb-2.5 font-display text-base font-bold text-[#BAF14D]">
                    {driveDays} day{driveDays > 1 ? 's' : ''}/week
                  </div>
                  <RangeInput value={driveDays} onChange={setDriveDays} min={1} max={5} labels={['1','2','3','4','5']} />
                </Field>

                {/* Shift days */}
                <Field label="Active commute days per week">
                  <div className="mb-2.5 font-display text-base font-bold text-[#BAF14D]">
                    {effectiveShift} day{effectiveShift > 1 ? 's' : ''}/week
                  </div>
                  <RangeInput value={effectiveShift} onChange={setShiftDays} min={1} max={5} labels={['1','2','3','4','5']} />
                  <Hint>
                    {effectiveShift === driveDays
                      ? `You'd go fully active — ${driveDays} day${driveDays > 1 ? 's' : ''} a week`
                      : `You'd still drive ${driveDays - effectiveShift} day${driveDays - effectiveShift > 1 ? 's' : ''} a week`}
                  </Hint>
                </Field>

                {/* Vehicle — hidden for rideshare */}
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

                {/* Gas price — hidden for rideshare and EV */}
                {commuteMode === 'drive' && vehicle !== 'ev' && (
                  <Field label="Gas price">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg font-bold text-[#BAF14D]">$</span>
                      <NumInput value={gasPrice} onChange={setGasPrice} min={2} max={8} step={0.01} width="88px" fontSize="1rem" />
                      <span className="text-[0.8rem] text-white/45">per gallon</span>
                    </div>
                    <div className="mt-1 text-[0.65rem] text-white/25">MA average as of March 2026 — adjust for your local price</div>
                  </Field>
                )}

                {/* EV note */}
                {commuteMode === 'drive' && vehicle === 'ev' && (
                  <Field label="Electricity cost">
                    <div className="text-sm text-white/50">$0.048/mile based on Massachusetts residential electricity rates</div>
                    <div className="mt-1 text-[0.65rem] text-white/25">Using average MA rate of ~$0.28/kWh and ~3.5 mi/kWh efficiency</div>
                  </Field>
                )}

                {/* Parking — hidden for rideshare */}
                {commuteMode === 'drive' && <Field label="Your parking situation">
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
                        <span className="text-[0.8rem] text-white/45">per day</span>
                      </div>
                      {parkMode === 'full' && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[0.63rem] text-white/20">Area medians:</span>
                          {PARKING_ANCHORS.map(a => (
                            <button key={a.val} onClick={() => setParkingCost(a.val)}
                              className="rounded-md border border-white/[0.12] bg-white/[0.06] px-2 py-1 text-[0.65rem] font-semibold text-white/40 transition-colors hover:bg-white/10 hover:text-white/80">
                              {a.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Field>}

                {/* Alt mode */}
                <Field label="How you'd get there instead" last>
                  <RadioPills
                    name="alt-mode"
                    value={altMode}
                    onChange={setAltMode}
                    options={[
                      { value: 'bike', label: 'Bike' },
                      { value: 'ebike', label: 'E-bike / scooter' },
                      { value: 'walk', label: 'Walk' },
                      { value: 'mbta', label: 'MBTA' },
                      { value: 'commuter_rail', label: 'Commuter rail' },
                    ]}
                  />
                  {altMode === 'mbta' && (
                    <div className="mt-3.5 flex flex-col gap-3.5">
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Service type</label>
                        <RadioPills
                          name="mbta-type"
                          value={mbtaType}
                          onChange={setMbtaType}
                          options={[
                            { value: 'subway', label: 'Subway + bus (LinkPass $90/mo)' },
                            { value: 'bus', label: 'Local bus only ($55/mo)' },
                          ]}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Does your employer subsidize your pass?</label>
                        <RadioPills
                          name="employer-subsidy"
                          value={hasEmployerSubsidy ? 'yes' : 'no'}
                          onChange={v => setHasEmployerSubsidy(v === 'yes')}
                          options={[
                            { value: 'no', label: 'No' },
                            { value: 'yes', label: 'Yes' },
                          ]}
                        />
                        {hasEmployerSubsidy && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="font-display text-lg font-bold text-[#BAF14D]">$</span>
                            <NumInput value={employerSubsidy} onChange={setEmployerSubsidy} min={0} max={300} step={5} width="88px" fontSize="1rem" />
                            <span className="text-[0.8rem] text-white/45">per month</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {altMode === 'commuter_rail' && (
                    <div className="mt-3.5 flex flex-col gap-3.5">
                      <Select value={String(railZone)} onChange={v => setRailZone(Number(v))} options={[
                        { value: '90', label: 'Zone 1A — $90/mo' },
                        { value: '140', label: 'Zone 2–3 — $140/mo' },
                        { value: '185', label: 'Zone 4–5 — $185/mo' },
                        { value: '243', label: 'Zone 6–7 — $243/mo' },
                        { value: '329', label: 'Zone 8–10 — $329/mo' },
                      ]} />
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">Does your employer subsidize your pass?</label>
                        <RadioPills
                          name="employer-subsidy-rail"
                          value={hasEmployerSubsidy ? 'yes' : 'no'}
                          onChange={v => setHasEmployerSubsidy(v === 'yes')}
                          options={[
                            { value: 'no', label: 'No' },
                            { value: 'yes', label: 'Yes' },
                          ]}
                        />
                        {hasEmployerSubsidy && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="font-display text-lg font-bold text-[#BAF14D]">$</span>
                            <NumInput value={employerSubsidy} onChange={setEmployerSubsidy} min={0} max={300} step={5} width="88px" fontSize="1rem" />
                            <span className="text-[0.8rem] text-white/45">per month</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Field>
              </div>

              {/* ── RESULTS ── */}
              <div className="flex flex-col gap-4 p-9">
                <div className="mb-3 font-display text-[0.9375rem] font-bold text-white">What you&apos;d gain</div>

                {r && (
                  <>
                    {/* Money hero */}
                    <div className="rounded-[14px] border border-[rgba(186,241,77,0.2)] bg-[rgba(186,241,77,0.08)] px-6 py-5 text-center">
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[rgba(186,241,77,0.55)]">Annual savings</div>
                      <div className="font-display text-[2.75rem] font-extrabold leading-none tracking-tighter text-[#BAF14D] transition-all duration-300">
                        {fmt(r.net)}
                      </div>
                      <div className="mt-1 text-[0.78rem] text-[rgba(186,241,77,0.45)]">
                        {r.net >= 0 ? 'staying in your pocket every year' : 'transit cost is higher than your fuel savings at this distance'}
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="flex flex-col gap-2">
                      {r.isRideshare ? (
                        <ResultRow label="🚗 Rideshare savings" value={`+${fmt(r.rideshareSavings)}`} type="pos" />
                      ) : (
                        <>
                          <ResultRow label={r.fuelLabel} value={`+${fmt(r.fuelSavings)}`} type="pos" />
                          <ResultRow label="🔧 Maintenance savings" value={`+${fmt(r.maintSavings)}`} type="pos" />
                          {parkMode !== 'free' && (
                            <ResultRow label="🅿️ Parking savings" value={`+${fmt(r.parkingSavings)}`} type="pos" />
                          )}
                        </>
                      )}
                      {!r.isActive && r.transitCost > 0 && (
                        <ResultRow label={`🚇 ${r.transitLabel}`} value={`-${fmt(r.transitCost)}`} type="neg" />
                      )}
                    </div>

                    {/* Time panel */}
                    <div className="rounded-[14px] border border-[rgba(41,102,229,0.25)] bg-[rgba(41,102,229,0.08)] px-6 py-5">
                      <div className="mb-3.5 flex items-center justify-between">
                        <div className="font-display text-sm font-bold text-white">Time comparison</div>
                        {r.isRealRouting ? (
                          <div className="rounded border border-[rgba(186,241,77,0.25)] bg-[rgba(186,241,77,0.1)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[rgba(186,241,77,0.7)]">
                            Google Maps
                          </div>
                        ) : routeLoading ? (
                          <div className="rounded border border-[rgba(41,102,229,0.25)] bg-[rgba(41,102,229,0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[rgba(41,102,229,0.7)]">
                            Loading routes…
                          </div>
                        ) : routeError ? (
                          <div className="rounded border border-[rgba(255,140,53,0.25)] bg-[rgba(255,140,53,0.1)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[rgba(255,140,53,0.7)]">
                            Estimated
                          </div>
                        ) : (
                          <div className="rounded border border-[rgba(41,102,229,0.25)] bg-[rgba(41,102,229,0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[rgba(41,102,229,0.7)]">
                            Enter addresses for routing
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-[9px] border border-white/[0.07] bg-white/[0.04] px-2 py-2.5 text-center">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/45">Driving</div>
                          <div className="font-display text-xl font-bold text-white">
                            {routeLoading ? '…' : `${r.isRealRouting ? '' : '~'}${r.driveMins} min`}
                          </div>
                          <div className="mt-0.5 text-[10px] text-white/30">{r.isRealRouting ? 'each way, rush hour' : 'each way, in traffic'}</div>
                        </div>
                        <div className="rounded-[9px] border border-white/[0.07] bg-white/[0.04] px-2 py-2.5 text-center">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/45">{r.mode.label}</div>
                          <div className="font-display text-xl font-bold text-white">
                            {routeLoading ? '…' : r.altMins !== null ? `${r.isRealRouting ? '' : '~'}${r.altMins} min` : 'varies'}
                          </div>
                          <div className="mt-0.5 text-[10px] text-white/30">{r.mode.healthNote || 'each way'}</div>
                        </div>
                      </div>
                      <div className="mt-2.5 text-center text-[0.72rem] text-[rgba(41,102,229,0.6)]">
                        {r.timeNote}
                      </div>
                    </div>

                    {/* Health panel */}
                    {r.isActive && (
                      <div className="rounded-[14px] border border-[rgba(237,185,60,0.2)] bg-[rgba(237,185,60,0.08)] px-6 py-5">
                        <div className="mb-3.5 font-display text-sm font-bold text-white">Health benefits</div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-[9px] bg-white/[0.04] px-2 py-2 text-center">
                            <div className="font-display text-lg font-bold text-[#EDB93C]">{r.activeMins}</div>
                            <div className="mt-0.5 text-[10px] leading-snug text-white/35">active minutes per week</div>
                          </div>
                          <div className="rounded-[9px] bg-white/[0.04] px-2 py-2 text-center">
                            <div className="font-display text-lg font-bold text-[#EDB93C]">{r.weeklyCals.toLocaleString()}</div>
                            <div className="mt-0.5 text-[10px] leading-snug text-white/35">calories burned per week</div>
                          </div>
                          <div className="rounded-[9px] bg-white/[0.04] px-2 py-2 text-center">
                            <div className="font-display text-lg font-bold text-[#EDB93C]">{r.gymEquiv}×</div>
                            <div className="mt-0.5 text-[10px] leading-snug text-white/35">gym sessions/week equivalent</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick facts */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-[10px] border border-white/[0.07] bg-white/[0.04] px-4 py-3">
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/45">Miles active per year</div>
                        <div className="font-display text-lg font-bold text-white">{Math.round(r.annualMiles).toLocaleString()}</div>
                        <div className="mt-0.5 text-[10px] text-white/25">under your own power</div>
                      </div>
                      <div className="rounded-[10px] border border-white/[0.07] bg-white/[0.04] px-4 py-3">
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/45">CO₂ avoided</div>
                        <div className="font-display text-lg font-bold text-white">{fmtCO2(r.co2)}</div>
                        <div className="mt-0.5 text-[10px] text-white/25">per year</div>
                      </div>
                    </div>

                    {/* Waitlist CTA */}
                    <div className="mt-auto rounded-[14px] border border-[rgba(186,241,77,0.18)] bg-[linear-gradient(135deg,rgba(41,102,229,0.15),rgba(186,241,77,0.08))] px-6 py-5">
                      <div className="mb-1 font-display text-[1.0625rem] font-extrabold tracking-tight text-white">Ready to try it?</div>
                      <div className="mb-3.5 text-[0.8rem] leading-relaxed text-white/50">
                        Shift helps you build the habit — log your first active trip, track your progress, and see your real savings add up over time.
                      </div>
                      {!waitlistSubmitted ? (
                        <form onSubmit={e => { e.preventDefault(); if (waitlistEmail) setWaitlistSubmitted(true) }}
                          className="flex items-center gap-2">
                          <input
                            type="email"
                            placeholder="Your email address"
                            value={waitlistEmail}
                            onChange={e => setWaitlistEmail(e.target.value)}
                            required
                            className="min-w-0 flex-1 rounded-lg border-[1.5px] border-white/[0.12] bg-white/[0.06] px-3 py-2 text-sm text-white placeholder-white/40 outline-none transition-colors focus:border-[#BAF14D]"
                          />
                          <button type="submit" className="shrink-0 rounded-lg bg-[#BAF14D] px-4 py-2 text-[0.8125rem] font-bold text-[#191A2E] transition-opacity hover:opacity-85">
                            Join the waitlist
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-[rgba(186,241,77,0.2)] bg-[rgba(186,241,77,0.08)] px-4 py-2.5">
                          <span className="text-sm font-semibold text-[#BAF14D]">&#10003;</span>
                          <span className="text-sm text-white/70">You&apos;re on the list — we&apos;ll be in touch.</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Methodology */}
        <div className="mx-auto mt-8 max-w-[860px] px-8">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-5 py-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/25">How this is calculated</div>
            <div className="text-[0.77rem] leading-[1.65] text-white/30">
              Fuel savings use your vehicle&apos;s EPA combined MPG estimate and the current Massachusetts average gas price from AAA. Maintenance savings apply the AAA 2025 variable rate per mile (~10–11¢/mile by vehicle type), covering oil changes, tire wear, and related repairs — costs that genuinely decrease when you drive less. <strong className="font-semibold text-white/50">Fixed costs like insurance, depreciation, registration, and finance charges are excluded</strong> — those don&apos;t change based on how many days you drive, so including them would overstate your actual savings. MBTA fares are current as of March 2026 from{' '}
              <a href="https://www.mbta.com/fares" target="_blank" rel="noopener noreferrer" className="text-white/40 underline">mbta.com/fares</a>; the calculator automatically compares monthly pass vs. per-ride cost and uses whichever is cheaper for your frequency. Health estimates use MET values from the American College of Sports Medicine: cycling at a moderate pace (~12 mph) is approximately 8 METs; brisk walking is approximately 4 METs. Boston-area parking medians from SpotAngels (February 2026). Time estimates are speed-based approximations — real door-to-door routing via Google Maps is coming soon.
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
              <div className="text-[0.9rem] leading-[1.75] text-white/60" dangerouslySetInnerHTML={{ __html: item.a }} />
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
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">{label}</label>
      {children}
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-[0.7rem] leading-snug text-white/30">{children}</div>
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
        {labels.map(l => <span key={l} className="text-[10px] text-white/25">{l}</span>)}
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
            : 'border-white/[0.12] text-white/50 hover:border-white/25'
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
  const color = type === 'pos' ? 'text-[#BAF14D]' : type === 'neg' ? 'text-[#FF6B6B]' : 'text-white/70'
  return (
    <div className="flex items-center justify-between rounded-[9px] border border-white/[0.07] bg-white/[0.04] px-3.5 py-2.5">
      <span className="text-[0.8rem] text-white/50">{label}</span>
      <span className={`font-display text-[0.9rem] font-bold transition-all duration-300 ${color}`}>{value}</span>
    </div>
  )
}
