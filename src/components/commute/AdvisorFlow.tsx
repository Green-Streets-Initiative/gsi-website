'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import posthog from 'posthog-js'
import { ArrowSquareOut, Check, Copy, FilePdf, MapPin } from '@phosphor-icons/react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import ArriveBy from '@/components/commute/ArriveBy'
import MotivationChips from '@/components/commute/MotivationChips'
import AdjustCosts from '@/components/commute/AdjustCosts'
import PlanGrid, { PlanGridSkeleton, type PlanGridRow } from '@/components/commute/PlanGrid'
import { BikeDrawer, ComboDrawer, DriveDrawer, EmployerShuttleDrawer, ShuttleDrawer, TransitDrawer, WalkDrawer } from '@/components/commute/PlanDrawer'
import AdvisorMap, { asLiveDock, corridorForRow } from '@/components/commute/AdvisorMap'
import NearbySheet from '@/components/nearby/NearbySheet'
import { DetailContent } from '@/components/nearby/DetailPanel'
import type { FitPadding } from '@/components/nearby/NearbyMap'
import type { SheetSnap } from '@/lib/wayfinding/types'
import { useIsWide } from '@/components/commute/useIsWide'
import LoadingMessages from '@/components/commute/LoadingMessages'
import CommutePlanPrint from '@/components/commute/CommutePlanPrint'
import TagAlong from '@/components/commute/TagAlong'
import { STAGE_ICONS } from '@/components/commute/StageStrip'
import { fetchCalmRoute, type CalmRoute } from '@/components/commute/calm-route'
import { QUESTION_STAGE, contentModeFor, contentModeWord, groupGuides, guideHref } from '@/components/commute/guide-topics'
import { eventKindLine, eventModeForRow, eventWhenLine, eventWhereLine, walkRideDayWhen } from '@/components/commute/event-card'
import {
  directionsUrl,
  employerListsShuttle,
  fetchLegLive,
  fetchOfficeBikeParking,
  fetchShuttleLines,
  fillLeaveBy,
  isPublicShuttle,
  type LegLive,
  type ShuttleLine,
} from '@/components/commute/plan-data'
import { stagesFor } from '@/components/commute/trip-stages'
import { WORKDAYS, formatClock, headlineFor, isComboKey, modeName, modeOrderFor } from '@/lib/employer/commute-costs'
import { employerNearbyUrl, locationAsOffice } from '@/lib/employer/office-links'
import { eventPath } from '@/lib/events-url'
import type {
  AdvisorResult,
  BikeParkingSpot,
  CurrentCommuteMode,
  EmployerBenefits,
  EmployerGroup,
  Motivation,
  TryItCard,
  Vehicle,
} from '@/lib/types/commute'

/*
 * Commute Advisor v2: the one flow both pages share (contracts, section 4).
 *  1. Home address (and the work address or the office picker), arrive by,
 *     and the costs collapsed under them (the car, parking, days a week).
 *  2. The plan: a headline, then a decision grid (one row per way in, the
 *     same columns for every row: leave by, door to door, a day, emissions
 *     shifted) with the six-stage strip inside the open row's drawer and
 *     ONE drawer for the tapped row; eligible shuttles as their own rows;
 *     the map beside the grid on wide screens; one row of next steps.
 *     Nothing stacks below that (feedback_no_totem_pole_pages). "What
 *     matters most" lives on the plan ("Put first:"), where its effect is
 *     visible. The old step 2 ("How do you get there today?") only painted
 *     a badge and was cut on Keith's call (journey pass, 2026-10-15); the
 *     commuteMode state stays so saved sessions still restore.
 *
 * Every number comes from the AdvisorResult the recommend route built with
 * src/lib/employer/commute-costs.ts. The page computes nothing of its own
 * except the leave-by fallback (arrive-by minus minutes) until the engine
 * routes by arrival time. Live departures, the calm bike route, shuttles
 * and bike parking load after the plan and never block it.
 */

export interface AdvisorLocation {
  id: string
  name: string | null
  address: string
  lat: number
  lng: number
  /** "HH:MM" the office usually starts; the plan's default arrive-by. */
  typical_start_time?: string | null
}

type PlaceData = { placeId: string; lat: number; lng: number }

export interface AdvisorFlowProps {
  variant: 'public' | 'employer'
  group?: EmployerGroup | null
  benefits?: EmployerBenefits
  locations?: AdvisorLocation[]
  /** From ?location=<id>: a per-location link opens at that location. */
  initialLocationId?: string | null
  isDemo?: boolean
  /** Portal preview of unsaved benefits: nothing is logged. */
  isDraft?: boolean
  /** Properties on every advisor_* event (variant, employer slug). */
  trackProps?: Record<string, unknown>
  /** Keep the inputs and the plan across reloads (the public page; also how /nearby hands a trip over). */
  persistSession?: boolean
  /** Rendered under the addresses on step 1 (the employer's benefits list). */
  step1Extra?: ReactNode
  /** Anything after the plan (the HR contact line). */
  afterPlan?: ReactNode
  companyName?: string | null
  /** The host page hears each step change, so its hero can get out of the plan's way on step 3. */
  onStepChange?: (step: number) => void
}

const SESSION_KEY = 'commute-advisor-state'
/** Two steps: the addresses (with costs collapsed under them), then the plan. */
export const PLAN_STEP = 2
const DEFAULT_ARRIVE_BY = '09:00'
const JOIN_MODES: { value: CurrentCommuteMode; label: string }[] = [
  { value: 'new', label: "I'm new here, just compare" },
  { value: 'drive', label: 'Drive' },
  { value: 'carpool', label: 'Carpool' },
  { value: 'rideshare', label: 'Rideshare' },
  { value: 'transit', label: 'Bus or train' },
  { value: 'bike', label: 'Bike' },
  { value: 'walk', label: 'Walk' },
]
const PUBLIC_GROUP: EmployerGroup = {
  id: 'public', name: 'Green Streets Initiative', slug: 'commute-advisor', logo_url: null, tier: 'basic', employer_benefits: {},
}

const clockRe = /^([01]\d|2[0-3]):[0-5]\d$/
const asClock = (v: unknown): string | null => (typeof v === 'string' && clockRe.test(v.slice(0, 5)) ? v.slice(0, 5) : null)

/** The parking figure an employer's benefits imply, per day. Never a guess: 0 when nothing is known. */
function parkingFromBenefits(b: EmployerBenefits): { perDay: number; hint: string | null } {
  if (b.free_parking) return { perDay: 0, hint: 'Free parking at the office.' }
  if (b.parking_cost_monthly && b.parking_cost_monthly > 0) {
    return { perDay: Math.round(b.parking_cost_monthly / (WORKDAYS / 12)), hint: `From a monthly parking cost of $${b.parking_cost_monthly}.` }
  }
  return { perDay: 0, hint: null }
}

type Session = {
  homeAddress?: string
  homePlaceData?: PlaceData | null
  workAddress?: string
  workPlaceData?: PlaceData | null
  step?: number
  arriveBy?: string
  motivation?: Motivation | null
  vehicle?: Vehicle
  parkingPerDay?: number
  daysPerWeek?: number
  commuteMode?: CurrentCommuteMode
  result?: AdvisorResult | null
}

/**
 * A plan survives leaving the page (Keith 2026-10-15: "when I clicked Back,
 * I had to start over"). The tab's sessionStorage carries it across
 * navigation inside the tab (and is how /nearby hands a trip over);
 * localStorage keeps it for a week, so coming back tomorrow lands on the
 * same plan. The employer page stores under its own key, so two employers
 * in one browser never see each other's plan. Nothing leaves the browser.
 */
const PLAN_KEEP_MS = 7 * 24 * 60 * 60 * 1000

function storageKey(variant: 'public' | 'employer', slug: string | null | undefined): string {
  return variant === 'employer' && slug ? `${SESSION_KEY}:${slug}` : SESSION_KEY
}

function readSession(key: string): Session | null {
  try {
    const live = sessionStorage.getItem(key)
    if (live) return JSON.parse(live) as Session
    const kept = localStorage.getItem(key)
    if (!kept) return null
    const s = JSON.parse(kept) as Session & { saved_at?: number }
    if (!s.saved_at || Date.now() - s.saved_at > PLAN_KEEP_MS) return null
    return s
  } catch {
    return null
  }
}

function writeSession(key: string, s: Session) {
  const raw = JSON.stringify({ ...s, saved_at: Date.now() })
  try { sessionStorage.setItem(key, raw) } catch { /* storage full or blocked */ }
  try { localStorage.setItem(key, raw) } catch { /* storage full or blocked */ }
}

/**
 * Put an element's top just under the site nav, instantly. The nav is
 * fixed (60px on every page that hosts the flow), so scrolling an element
 * to the viewport's top would tuck it underneath; measured, not assumed,
 * in case a host page's nav differs. 'instant', not 'auto': auto defers to
 * the site's CSS scroll-behavior (smooth), and a smooth scroll started
 * while the plan is still laying out gets cancelled or lands elsewhere.
 */
function scrollUnderNav(el: HTMLElement | null, extra = 12) {
  if (!el || typeof window === 'undefined') return
  const nav = document.querySelector('nav')
  const navH = nav && ['fixed', 'sticky'].includes(getComputedStyle(nav).position) ? nav.getBoundingClientRect().height : 0
  const top = el.getBoundingClientRect().top + window.scrollY - navH - extra
  window.scrollTo({ top: Math.max(0, top), behavior: 'instant' })
}

export default function AdvisorFlow({
  variant,
  group = null,
  benefits = {},
  locations = [],
  initialLocationId = null,
  isDemo = false,
  isDraft = false,
  trackProps = {},
  persistSession = false,
  step1Extra,
  afterPlan,
  companyName = null,
  onStepChange,
}: AdvisorFlowProps) {
  const track = useCallback((event: string, props?: Record<string, unknown>) => {
    try { posthog.capture(event, { advisor_variant: variant, ...trackProps, ...props }) } catch { /* analytics never blocks */ }
  }, [variant, trackProps])

  /* ── Offices (employer) ── */
  const officeOptions = useMemo<AdvisorLocation[]>(() => {
    if (locations.length > 0) return locations
    if (benefits.destination_address && benefits.destination_lat != null && benefits.destination_lng != null) {
      return [{ id: 'main', name: null, address: benefits.destination_address, lat: benefits.destination_lat, lng: benefits.destination_lng, typical_start_time: null }]
    }
    return []
  }, [locations, benefits.destination_address, benefits.destination_lat, benefits.destination_lng])
  const startOffice = officeOptions.find((l) => l.id === initialLocationId) ?? officeOptions[0] ?? null

  /* ── Inputs ── */
  const [step, setStep] = useState(1)
  const [homeAddress, setHomeAddress] = useState('')
  const [homePlaceData, setHomePlaceData] = useState<PlaceData | null>(null)
  const [workAddress, setWorkAddress] = useState(startOffice?.address ?? '')
  const [workPlaceData, setWorkPlaceData] = useState<PlaceData | null>(startOffice ? { placeId: '', lat: startOffice.lat, lng: startOffice.lng } : null)
  const [locationId, setLocationId] = useState<string | null>(startOffice?.id ?? null)
  const [arriveBy, setArriveBy] = useState(asClock(startOffice?.typical_start_time) ?? DEFAULT_ARRIVE_BY)
  const arriveTouched = useRef(false)
  const [commuteMode, setCommuteMode] = useState<CurrentCommuteMode>('new')
  const [motivation, setMotivation] = useState<Motivation | null>(null)
  const [vehicle, setVehicle] = useState<Vehicle>('gas')
  const parkingDefault = useMemo(() => parkingFromBenefits(benefits), [benefits])
  const [parkingPerDay, setParkingPerDay] = useState(parkingDefault.perDay)
  const [daysPerWeek, setDaysPerWeek] = useState(5)

  /* ── The plan ── */
  const [result, setResult] = useState<AdvisorResult | null>(null)
  const [engineLeaveBy, setEngineLeaveBy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outsideArea, setOutsideArea] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  /** A leg chip tapped in the open drawer ("transit:0", "bike:2"), or a stretch tapped on the map. */
  const [highlightedLeg, setHighlightedLeg] = useState<string | null>(null)
  /** The Bluebikes dock whose card is open under the map (station_id). */
  const [selectedDock, setSelectedDock] = useState<string | null>(null)
  /* ── Phone shell: the map is the stage, the plan rides a bottom sheet (Nearby's) ── */
  const wide = useIsWide()
  const [snap, setSnap] = useState<SheetSnap>('half')
  const stageRef = useRef<HTMLDivElement>(null)
  const [stageH, setStageH] = useState(0)
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => setStageH(el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  // The stage mounts with the phone plan; re-attach when it appears.
  }, [wide, step, result])
  /** Camera fits land in the window above the half sheet. */
  const stagePadding = useMemo<FitPadding | undefined>(
    () => (stageH ? { top: 72, bottom: Math.round(stageH * 0.45) + 24, left: 32, right: 32 } : undefined),
    [stageH],
  )
  /** "Add a parking cost" on the plan sends people to step 2 with the costs open. */
  const [costsOpen, setCostsOpen] = useState(false)
  const [legsLive, setLegsLive] = useState<(LegLive | null)[]>([])
  /** Live data per transit leg of each combo row (park_ride, bike_ride), by row key. */
  const [comboLegsLive, setComboLegsLive] = useState<Record<string, (LegLive | null)[]>>({})
  const [calm, setCalm] = useState<CalmRoute | null>(null)
  const [calmLoading, setCalmLoading] = useState(false)
  const [shuttleLines, setShuttleLines] = useState<ShuttleLine[]>([])
  const [bikeParking, setBikeParking] = useState<BikeParkingSpot[]>([])
  const flowRef = useRef<HTMLDivElement>(null)
  const headlineRef = useRef<HTMLHeadingElement>(null)
  const restoredRef = useRef(false)

  /* ── Scroll: every step opens at its top, the plan at its headline ──
   * Without this the page keeps the offset it had when the button was
   * pressed, so pressing Next from the foot of step 1 lands partway down
   * step 2 ("why does it jump me to the bottom of the next screen?"), and
   * the old scrollIntoView put the plan's headline under the fixed nav.
   * The first render is left alone so the page opens on its hero. */
  const prevStepRef = useRef<number | null>(null)
  useEffect(() => {
    if (prevStepRef.current !== null && prevStepRef.current !== step) scrollUnderNav(flowRef.current)
    prevStepRef.current = step
  }, [step])
  useEffect(() => { onStepChange?.(step) }, [step, onStepChange])
  const hadPlanRef = useRef(false)
  useEffect(() => {
    const has = !!result
    if (has && !hadPlanRef.current && step === PLAN_STEP) {
      scrollUnderNav(headlineRef.current)
      // Screen readers hear the new plan; preventScroll keeps the position
      // just set. Nothing lower on the page ever takes focus on its own.
      headlineRef.current?.focus({ preventScroll: true })
    }
    hadPlanRef.current = has
  }, [result, step])

  /* ── Session: restore once, then keep in step ── */
  useEffect(() => {
    if (!persistSession || restoredRef.current) return
    restoredRef.current = true
    const s = readSession(storageKey(variant, group?.slug))
    if (!s) return
    if (typeof s.homeAddress === 'string') setHomeAddress(s.homeAddress)
    if (s.homePlaceData && typeof s.homePlaceData.lat === 'number') setHomePlaceData(s.homePlaceData)
    if (typeof s.workAddress === 'string') setWorkAddress(s.workAddress)
    if (s.workPlaceData && typeof s.workPlaceData.lat === 'number') setWorkPlaceData(s.workPlaceData)
    const clock = asClock(s.arriveBy)
    if (clock) { setArriveBy(clock); arriveTouched.current = true }
    if (s.motivation === 'time' || s.motivation === 'money' || s.motivation === 'health' || s.motivation === 'climate') setMotivation(s.motivation)
    if (s.vehicle === 'gas' || s.vehicle === 'hybrid' || s.vehicle === 'ev') setVehicle(s.vehicle)
    if (typeof s.parkingPerDay === 'number' && s.parkingPerDay >= 0) setParkingPerDay(s.parkingPerDay)
    if (typeof s.daysPerWeek === 'number' && s.daysPerWeek >= 1 && s.daysPerWeek <= 7) setDaysPerWeek(s.daysPerWeek)
    if (s.commuteMode && JOIN_MODES.some((m) => m.value === s.commuteMode)) setCommuteMode(s.commuteMode)
    if (s.result && s.result.modes && s.result.mode_order) {
      // A plan stored before the engine filled leave-by still gets one.
      const restored = fillLeaveBy(s.result, clock ?? DEFAULT_ARRIVE_BY)
      setResult(restored)
      setExpanded(restored.recommended_mode)
    }
    // Sessions saved by the three-step flow stored 3 for the plan.
    if (s.result && (s.step === 2 || s.step === 3)) setStep(PLAN_STEP)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistSession])

  useEffect(() => {
    if (!persistSession || !restoredRef.current) return
    // The first run after mount still sees the empty initial state (the
    // restore's setState calls land on the next render); an empty form must
    // never overwrite a saved plan.
    if (!result && !homePlaceData && step === 1) return
    writeSession(storageKey(variant, group?.slug), {
      homeAddress, homePlaceData, workAddress, workPlaceData, step, arriveBy, motivation, vehicle, parkingPerDay, daysPerWeek, commuteMode, result,
    } satisfies Session)
  }, [persistSession, variant, group?.slug, homeAddress, homePlaceData, workAddress, workPlaceData, step, arriveBy, motivation, vehicle, parkingPerDay, daysPerWeek, commuteMode, result])

  const pickLocation = (id: string) => {
    const l = officeOptions.find((x) => x.id === id)
    if (!l) return
    setLocationId(l.id)
    setWorkAddress(l.address)
    setWorkPlaceData({ placeId: '', lat: l.lat, lng: l.lng })
    if (!arriveTouched.current) setArriveBy(asClock(l.typical_start_time) ?? DEFAULT_ARRIVE_BY)
    track('advisor_location_selected', { location_id: l.id })
  }

  const changeArriveBy = (hhmm: string, source: 'step1' | 'plan') => {
    if (hhmm === arriveBy) return
    arriveTouched.current = true
    setArriveBy(hhmm)
    track('advisor_arrive_by_changed', { arrive_by: hhmm, source })
  }

  /* ── The main call ── */
  const run = useCallback(async (opts: { arriveBy: string; motivation: Motivation | null }) => {
    if (!homePlaceData || !workPlaceData) return
    setLoading(true)
    setError(null)
    setOutsideArea(false)
    try {
      const params = new URLSearchParams({
        origin_lat: String(homePlaceData.lat), origin_lng: String(homePlaceData.lng),
        dest_lat: String(workPlaceData.lat), dest_lng: String(workPlaceData.lng),
        arrive_by: opts.arriveBy,
        vehicle,
        days_per_week: String(daysPerWeek),
        parking_daily: String(parkingPerDay),
      })
      if (opts.motivation) params.set('motivation', opts.motivation)
      // Usage log (Shift 01048): the employer and office, never the
      // addresses. A demo and a portal draft preview send no group, so
      // nothing is written for them.
      if (variant === 'employer' && group?.slug && !isDemo && !isDraft) {
        params.set('group', group.slug)
        if (locationId && locationId !== 'main') params.set('location', locationId)
      }
      const res = await fetch(`/api/commute/recommend?${params}`)
      const data = await res.json()
      if (data.error === 'outside_ma') {
        setOutsideArea(true)
        setResult(null)
        track('advisor_results_failed', { reason: 'outside_ma' })
        return
      }
      if (!res.ok || data.error || !data.modes) {
        setError('We could not build your plan just now. Try again in a moment.')
        track('advisor_results_failed', { reason: 'error' })
        return
      }
      const raw = data as AdvisorResult
      const hadLeaveBy = Object.values(raw.modes).some((m) => !!m.leave_by)
      const plan = fillLeaveBy(raw, opts.arriveBy)
      setEngineLeaveBy(hadLeaveBy)
      setResult(plan)
      setExpanded(plan.recommended_mode)
      setHighlightedLeg(null)
      setSelectedDock(null)
      track('advisor_results_shown', {
        recommended_mode: plan.recommended_mode,
        leave_by: plan.modes[plan.recommended_mode]?.leave_by ?? null,
        arrive_by: opts.arriveBy,
        motivation: opts.motivation,
        distance_miles: plan.distance_miles,
        commute_mode: commuteMode,
        has_addresses: true,
        // The two-leg rows that earned a place (park_ride, bike_ride), if any
        combos_shown: Object.keys(plan.modes).filter(isComboKey),
      })
    } catch {
      setError('We could not build your plan just now. Try again in a moment.')
      track('advisor_results_failed', { reason: 'error' })
    } finally {
      setLoading(false)
    }
  }, [homePlaceData, workPlaceData, vehicle, daysPerWeek, parkingPerDay, variant, group?.slug, isDemo, isDraft, locationId, track, commuteMode])

  const seePlan = () => {
    track('advisor_step_completed', { step: 1, has_addresses: !!(homePlaceData && workPlaceData), arrive_by: arriveBy, motivation })
    setCostsOpen(false)
    setStep(PLAN_STEP)
    setResult(null)
    run({ arriveBy, motivation })
  }

  /* ── After the plan: departures, the calm route, shuttles, bike parking ── */
  const home = homePlaceData
  const office = workPlaceData
  useEffect(() => {
    if (!result || !home || !office) return
    const ctrl = new AbortController()
    setLegsLive(result.transit_legs.map(() => null))
    setComboLegsLive({})
    setCalm(null)
    setShuttleLines([])
    setBikeParking([])
    result.transit_legs.slice(0, 3).forEach((leg, i) => {
      fetchLegLive(leg, result.nearby.stops, ctrl.signal)
        .then((live) => { if (!ctrl.signal.aborted) setLegsLive((prev) => { const next = [...prev]; next[i] = live; return next }) })
        .catch(() => { /* optional */ })
    })
    // The combo rows' transit legs: next departures from the station and
    // the line shapes, by the same path as the transit row.
    for (const key of Object.keys(result.modes).filter(isComboKey)) {
      const combo = result.modes[key]?.combo
      if (!combo) continue
      setComboLegsLive((prev) => ({ ...prev, [key]: combo.transit_legs.map(() => null) }))
      combo.transit_legs.slice(0, 3).forEach((leg, i) => {
        fetchLegLive(leg, result.nearby.stops, ctrl.signal)
          .then((live) => {
            if (ctrl.signal.aborted) return
            setComboLegsLive((prev) => { const next = [...(prev[key] ?? combo.transit_legs.map(() => null))]; next[i] = live; return { ...prev, [key]: next } })
          })
          .catch(() => { /* optional */ })
      })
    }
    if (result.modes.bike || result.modes.ebike) {
      setCalmLoading(true)
      fetchCalmRoute(home, office, ctrl.signal)
        .then((c) => { if (!ctrl.signal.aborted) setCalm(c) })
        .catch(() => { /* optional */ })
        .finally(() => { if (!ctrl.signal.aborted) setCalmLoading(false) })
      fetchOfficeBikeParking(office)
        .then((spots) => { if (!ctrl.signal.aborted) setBikeParking(spots) })
        .catch(() => { /* optional */ })
    }
    // Only shuttles the reader may board (the public operators, plus any
    // the employer lists among its benefits) AND could ride from this
    // home: a stop within 0.6 mi of home and 0.4 mi of the office.
    const listed = benefits.shuttle_routes ?? []
    fetchShuttleLines(home, office, ctrl.signal, (line) => isPublicShuttle(line) || employerListsShuttle(line, listed))
      .then((lines) => { if (!ctrl.signal.aborted) setShuttleLines(lines) })
      .catch(() => { /* optional */ })
    return () => ctrl.abort()
  }, [result, home, office, benefits.shuttle_routes])

  /* ── Derived ── */
  const plan = result
  const order = useMemo(() => (plan ? modeOrderFor(motivation, plan.modes) : []), [plan, motivation])
  const headline = useMemo(() => {
    if (!plan) return ''
    // The route built its headline for the motivation it was sent; it is
    // reused as long as nothing changed since. The leave-by fallback and a
    // chip tapped on the plan re-run the same function the route uses.
    if (plan.motivation === motivation && engineLeaveBy && plan.headline) return plan.headline
    return headlineFor(plan, motivation)
  }, [plan, motivation, engineLeaveBy])
  const office4Links = office && workAddress ? { lat: office.lat, lng: office.lng, label: officeOptions.find((l) => l.id === locationId)?.name ?? workAddress.split(',')[0] } : null
  const nearbyUrl = plan?.nearby_url
    ?? (variant === 'employer' && group?.slug && office4Links ? employerNearbyUrl(group.slug, locationAsOffice({ address: workAddress, lat: office4Links.lat, lng: office4Links.lng })) : null)
  const employerShuttles = useMemo(() => {
    const fromPlan = plan?.nearby.shuttles ?? []
    if (fromPlan.length > 0) return fromPlan
    return (benefits.shuttle_routes ?? []).filter((r) => r.name || r.from_stop)
  }, [plan, benefits.shuttle_routes])

  const legTitle = (p: AdvisorResult) => {
    const names = p.transit_legs.map((l) => l.route_name).filter(Boolean)
    if (names.length === 0) return p.transit_summary || modeName('transit')
    return names.map((n) => (/^\d+$/.test(n) ? `${n} bus` : n)).join(', then ')
  }

  const toggleRow = (key: string) => {
    setHighlightedLeg(null)
    setSelectedDock(null)
    setExpanded((cur) => {
      const next = cur === key ? null : key
      if (next) track('advisor_plan_row_expanded', { mode: key })
      return next
    })
  }
  const tapLeg = (mode: string, leg: string) => {
    setHighlightedLeg((cur) => (cur === leg ? null : leg))
    // On a phone a stretch lit under a full sheet shows nothing; drop to half.
    setSnap('half')
    track('advisor_leg_tapped', { mode, leg })
  }
  /** A stretch tapped on the map (the Nearby pattern, the other way round):
   *  open its row if another is open, light its chip, and the bike drawer
   *  shows that stretch in Street View. */
  const tapMapLeg = (owner: string, corridorId: string) => {
    const row = rows.find((r) => corridorForRow(r.key) === corridorId)
    if (!row) return
    setSelectedDock(null)
    setExpanded((cur) => {
      if (cur !== row.key) track('advisor_plan_row_expanded', { mode: row.key, source: 'map' })
      return row.key
    })
    setHighlightedLeg(owner)
    setSnap('half')
    track('advisor_leg_tapped', { mode: row.key, leg: owner, source: 'map' })
  }
  const tapDock = (stationId: string | null) => {
    setSelectedDock(stationId)
    if (stationId) {
      setSnap('half')
      track('advisor_dock_tapped', { station_id: stationId })
    }
  }

  // The phone shell is position:fixed; the page behind must not scroll
  // (the same belt-and-suspenders /nearby uses against iOS rubber-banding).
  const phoneStage = !wide && step === PLAN_STEP && !!result
  useEffect(() => {
    if (!phoneStage) return
    const html = document.documentElement
    const prevOverflow = html.style.overflow
    const prevOverscroll = html.style.overscrollBehavior
    html.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    return () => {
      html.style.overflow = prevOverflow
      html.style.overscrollBehavior = prevOverscroll
    }
  }, [phoneStage])
  const openCosts = () => {
    setCostsOpen(true)
    setStep(1)
    track('advisor_add_parking_clicked')
  }
  /** Clear the plan and the addresses from this browser and go back to an empty step 1. */
  const startOver = () => {
    const key = storageKey(variant, group?.slug)
    try { sessionStorage.removeItem(key) } catch { /* blocked */ }
    try { localStorage.removeItem(key) } catch { /* blocked */ }
    setResult(null)
    setExpanded(null)
    setHighlightedLeg(null)
    setSelectedDock(null)
    setHomeAddress('')
    setHomePlaceData(null)
    if (variant === 'public' || officeOptions.length === 0) {
      setWorkAddress('')
      setWorkPlaceData(null)
    }
    setMotivation(null)
    setStep(1)
    track('advisor_start_over')
  }

  const printGroup = group ?? PUBLIC_GROUP
  const joinLink = group?.invite_code ? `https://shift.gogreenstreets.org/join/${group.invite_code}` : null
  const [codeCopied, setCodeCopied] = useState(false)
  const copyCode = () => {
    if (!group?.invite_code) return
    navigator.clipboard?.writeText(group.invite_code).catch(() => {})
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
    track('advisor_team_code_copied')
  }

  /* ── The grid's rows ── */
  const rows = useMemo<PlanGridRow[]>(() => {
    if (!plan || !home || !office || !office4Links) return []
    const officeLabel = office4Links.label
    const out: PlanGridRow[] = []
    for (const mode of order) {
      const m = plan.modes[mode]
      if (!m) continue
      const via = (mode === 'bike' || mode === 'ebike') && calm ? calm.calm.viaWaypoints : undefined
      // A two-leg row's directions go to the station, by car or by bike
      const href = m.combo
        ? directionsUrl(home, { lat: m.combo.station.lat, lng: m.combo.station.lng }, m.combo.first_leg.mode)
        : directionsUrl(home, office, mode, via)
      const onDirections = () => track('advisor_directions_clicked', { mode, source: 'plan_row', via_waypoints: !!via })
      const today = commuteMode !== 'new' && (commuteMode === mode || (commuteMode === 'bus' && mode === 'transit') || (commuteMode === 'commuter_rail' && mode === 'transit'))
      const lineName = mode === 'transit' ? legTitle(plan) : null
      const first = plan.transit_legs[0]
      const last = plan.transit_legs[plan.transit_legs.length - 1]
      const sub = m.combo
        ? mode === 'park_ride' ? `Park at ${m.combo.station.name}` : `Bike to ${m.combo.station.name}`
        : mode === 'transit'
        ? first && last ? `${first.departure_stop_name} → ${last.arrival_stop_name}` : plan.transit_summary
        : mode === 'bike' || mode === 'ebike'
          ? calm ? `Quieter streets, ${calm.calm.distanceMiles.toFixed(1)} mi` : m.miles != null ? `${m.miles.toFixed(1)} mi` : 'Quieter streets'
          : mode === 'drive'
            ? m.miles != null ? `${m.miles.toFixed(1)} mi by road, with parking` : 'With parking'
            : m.miles != null ? `${m.miles.toFixed(1)} mi on foot` : null
      const drawer = (mode === 'park_ride' || mode === 'bike_ride') && m.combo ? (
        <ComboDrawer plan={plan} mode={mode} legsLive={comboLegsLive[mode] ?? []} officeName={officeLabel} benefits={benefits} companyName={companyName} highlightedLeg={highlightedLeg} onLegTap={(leg) => tapLeg(mode, leg)} directionsHref={href} onDirections={onDirections} />
      ) : mode === 'transit' ? (
        <TransitDrawer plan={plan} legsLive={legsLive} home={home} office={office} officeName={officeLabel} benefits={benefits} companyName={companyName} highlightedLeg={highlightedLeg} onLegTap={(leg) => tapLeg(mode, leg)} directionsHref={href} onDirections={onDirections} />
      ) : mode === 'bike' || mode === 'ebike' ? (
        <BikeDrawer plan={plan} calm={calm} calmLoading={calmLoading} bikeParking={bikeParking} benefits={benefits} companyName={companyName} highlightedLeg={highlightedLeg} onLegTap={(leg) => tapLeg(mode, leg)} directionsHref={href} onDirections={onDirections} />
      ) : mode === 'drive' ? (
        <DriveDrawer plan={plan} benefits={benefits} onAddParking={openCosts} directionsHref={href} onDirections={onDirections} />
      ) : (
        <WalkDrawer plan={plan} benefits={benefits} directionsHref={href} onDirections={onDirections} />
      )
      out.push({
        key: mode,
        mode,
        name: mode === 'transit' ? lineName ?? modeName(mode) : modeName(mode),
        sub,
        recommended: mode === plan.recommended_mode,
        today,
        leaveBy: m.leave_by ? formatClock(m.leave_by) : null,
        leaveByTraffic: mode === 'drive' && m.leave_by_traffic ? formatClock(m.leave_by_traffic) : null,
        minutes: m.minutes,
        minutesMax: mode === 'drive' ? m.minutes_max ?? null : null,
        costPerDay: m.cost_per_day,
        emissionsPct: m.emissions_share_pct,
        stages: stagesFor(mode, plan, benefits, { calm, bikeParking, lineName, combo: m.combo ?? null }),
        drawer,
      })
    }
    // Shuttles: the employer's own, then the public operators with a stop at the office
    employerShuttles.forEach((s, i) => {
      const key = `employer-shuttle-${i}`
      out.push({
        key,
        mode: 'shuttle',
        name: s.name ? `${s.name} shuttle` : `Shuttle from ${s.from_stop}`,
        sub: s.from_stop ? `From ${s.from_stop}` : s.schedule || null,
        leaveBy: null,
        minutes: null,
        costPerDay: 0,
        emissionsPct: null,
        stages: stagesFor('shuttle', plan, benefits, { shuttle: s.from_stop ? { stopName: s.from_stop, distanceMiles: 0 } : null }),
        drawer: <EmployerShuttleDrawer route={s} companyName={companyName} />,
      })
    })
    for (const s of shuttleLines) {
      out.push({
        key: s.key,
        mode: 'shuttle',
        name: s.routeName.toLowerCase().startsWith(s.agencyLabel.toLowerCase()) ? s.routeName : `${s.agencyLabel} ${s.routeName}`.trim(),
        sub: `From ${s.homeStopName} to ${s.stopName}`,
        leaveBy: s.nextTimes.length > 0 && !s.nextDay ? s.nextTimes[0] : null,
        minutes: s.totalMinutes,
        costPerDay: s.access === 'public-fare' ? null : 0,
        costLabel: s.access === 'public-fare' ? 'Fare' : null,
        emissionsPct: null,
        stages: stagesFor('shuttle', plan, benefits, { shuttle: { stopName: s.stopName, distanceMiles: s.distanceMiles } }),
        drawer: <ShuttleDrawer line={s} officeName={officeLabel} highlightedLeg={highlightedLeg} onLegTap={(leg) => tapLeg(s.key, leg)} />,
      })
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, home, office, office4Links, order, calm, calmLoading, legsLive, comboLegsLive, bikeParking, benefits, companyName, highlightedLeg, commuteMode, employerShuttles, shuttleLines])

  /* ── The picked way in: the open row, else our pick ── */
  const pickedKey = expanded ?? plan?.recommended_mode ?? null
  const pickedMode = pickedKey?.startsWith('shuttle:') || pickedKey?.startsWith('employer-shuttle-') ? 'shuttle' : pickedKey
  // Guides exist for biking, walking and transit; with driving open (or
  // picked) the card shows the guides for our best non-driving row.
  const guideMode = useMemo(() => {
    if (!plan) return null
    const direct = contentModeFor(pickedMode)
    if (direct) return direct
    const fallback = [plan.recommended_mode, ...order].map(contentModeFor).find(Boolean)
    return fallback ?? null
  }, [plan, pickedMode, order])
  const guideGroups = useMemo(() => (plan?.guides && guideMode ? groupGuides(plan.guides, guideMode) : []), [plan?.guides, guideMode])

  /* ── "Try it with others" follows the OPEN row's way in (Keith 2026-10-06:
   * a walker or a transit rider was being shown a bike ride). The plan
   * carries the card for the recommended way in; opening a row for another
   * way in fetches that one's card once and keeps it. With driving open the
   * card follows our best other row, as the guides do. ── */
  const eventMode = useMemo(() => {
    if (!plan) return null
    return eventModeForRow(pickedMode) ?? [plan.recommended_mode, ...order].map(eventModeForRow).find(Boolean) ?? null
  }, [plan, pickedMode, order])
  const [tryIt, setTryIt] = useState<TryItCard | null>(null)
  const tryItCache = useRef<Map<string, TryItCard>>(new Map())
  useEffect(() => {
    if (!plan || !office || !eventMode || eventMode === (plan.event_mode ?? null)) { setTryIt(null); return }
    const key = `${eventMode}:${office.lat},${office.lng}`
    const hit = tryItCache.current.get(key)
    if (hit) { setTryIt(hit); return }
    setTryIt(null)
    const ctrl = new AbortController()
    fetch(`/api/commute/event?mode=${eventMode}&lat=${office.lat}&lng=${office.lng}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: TryItCard | null) => {
        if (!d || ctrl.signal.aborted) return
        const card: TryItCard = { mode: eventMode, event: d.event ?? null, walk_ride_day: d.walk_ride_day ?? null }
        tryItCache.current.set(key, card)
        setTryIt(card)
      })
      .catch(() => { /* the card falls back to the calendar line */ })
    return () => ctrl.abort()
  }, [plan, office, eventMode])
  /** What the card shows: the plan's own pick, the open row's, or nothing yet while it loads. */
  const tryItCard: TryItCard | 'loading' | null = !plan || !eventMode
    ? null
    : eventMode === (plan.event_mode ?? null)
      ? { mode: eventMode, event: plan.event, walk_ride_day: plan.walk_ride_day ?? null }
      : tryIt && tryIt.mode === eventMode ? tryIt : 'loading'
  const tagAlongLocationId = locationId && /^[0-9a-f-]{36}$/i.test(locationId) ? locationId : null

  /* ── The plan body, shared by the wide page and the phone sheet ── */
  const renderPlan = (inSheet: boolean) => {
    if (!plan || !home || !office || !office4Links) return null
    return (
      <>
              {/* Headline: the winner and the tradeoff, arrive-by, the chips */}
              <div className="mb-3">
                {/* The host page's header already names the company on the plan; this says what the block is. */}
                {!inSheet && <div className="mb-1 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[#2D6A4F]">Your plan</div>}
                <h2 ref={headlineRef} tabIndex={-1} className="text-[1.25rem] font-extrabold leading-snug tracking-tight text-[#191A2E] outline-none sm:text-[1.5rem]">{headline}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.875rem] text-[#191A2E]">
                  <ArriveBy value={arriveBy} onChange={(v) => { changeArriveBy(v, 'plan'); run({ arriveBy: v, motivation }) }} />
                  {loading && <span className="text-[#4A4D68]">Updating…</span>}
                </div>
                {/* The plan's own miles live on each row (the crow-flies figure contradicted them). */}
                <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <span className="text-[0.8125rem] font-semibold text-[#191A2E]">Put first:</span>
                  <MotivationChips value={motivation} onChange={(m) => { setMotivation(m); track('advisor_motivation_changed', { motivation: m }) }} compact />
                </div>
              </div>

              {/* The grid; on a wide screen the map beside it, on a phone the map is the stage behind this sheet */}
              {inSheet ? (
                <PlanGrid rows={rows} expanded={expanded} onToggle={toggleRow} stickyTopClass="top-0" />
              ) : (
              <div className="grid items-start gap-3.5 min-[900px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                  <PlanGrid rows={rows} expanded={expanded} onToggle={toggleRow} />
                  <div className="min-w-0 min-[900px]:sticky min-[900px]:top-[72px]">
                    <AdvisorMap
                      key={`${home.lat},${home.lng}-${office.lat},${office.lng}`}
                      home={{ lat: home.lat, lng: home.lng, label: 'Home' }}
                      office={office4Links}
                      plan={plan}
                      legs={legsLive}
                      comboLegs={comboLegsLive}
                      calm={calm}
                      bikeParking={bikeParking}
                      shuttles={shuttleLines}
                      selectedRow={expanded}
                      highlightedLeg={highlightedLeg}
                      onLegTap={tapMapLeg}
                      selectedDock={selectedDock}
                      onDockTap={tapDock}
                    />
                  </div>
                </div>
              )}

              {/* Next steps: one row of three. Keep this plan leads (it holds the
                  hand-off: Directions, the PDF, the app), then the guides, then
                  the invitation to try it with others. */}
              <div className="mt-3.5 grid gap-2.5 sm:grid-cols-3">
                <div className="min-w-0 rounded-[12px] border border-[rgba(25,26,46,0.12)] bg-white px-3.5 py-3">
                  <div className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[#4A4D68]">Keep this plan</div>
                  <div className="flex flex-wrap gap-1.5">
                    <a
                      href={plan.modes[plan.recommended_mode]?.combo
                        ? directionsUrl(home, { lat: plan.modes[plan.recommended_mode].combo!.station.lat, lng: plan.modes[plan.recommended_mode].combo!.station.lng }, plan.modes[plan.recommended_mode].combo!.first_leg.mode)
                        : directionsUrl(home, office, plan.recommended_mode, plan.recommended_mode === 'bike' && calm ? calm.calm.viaWaypoints : undefined)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => track('advisor_directions_clicked', { mode: plan.recommended_mode, source: 'links' })}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-full bg-[#191A2E] px-3 text-[0.78rem] font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      Directions <ArrowSquareOut size={13} weight="bold" aria-hidden />
                    </a>
                    <button
                      type="button"
                      onClick={() => { track('advisor_plan_printed', { primary_mode: plan.recommended_mode }); window.print() }}
                      className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-[rgba(25,26,46,0.15)] bg-white px-3 text-[0.78rem] font-semibold text-[#191A2E] transition-colors hover:border-[#2D6A4F] hover:text-[#2D6A4F]"
                    >
                      <FilePdf size={15} weight="regular" aria-hidden />
                      Save as PDF
                    </button>
                    {nearbyUrl && (
                      <a
                        href={nearbyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => track('advisor_nearby_clicked')}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-[rgba(25,26,46,0.15)] bg-white px-3 text-[0.78rem] font-semibold text-[#191A2E] transition-colors hover:border-[#2D6A4F] hover:text-[#2D6A4F]"
                      >
                        Transit, bike lanes and docks around this office <ArrowSquareOut size={13} weight="bold" aria-hidden />
                      </a>
                    )}
                  </div>
                  <p className="mt-2 text-[0.8rem] leading-snug text-[#4A4D68]">
                    {joinLink && group ? (
                      <>
                        <a href={joinLink} target="_blank" rel="noopener" onClick={() => track('advisor_app_cta_clicked', { has_invite_code: true })} className="font-semibold text-[#2D6A4F]">Join {group.name} in the Shift app</a>
                        {' '}(free) with code{' '}
                        <button type="button" onClick={copyCode} aria-label="Copy the team code" className="inline-flex items-center gap-1 rounded border border-[rgba(25,26,46,0.15)] bg-[#FAFBF8] px-1.5 py-px font-mono text-[0.78rem] font-bold tracking-wide text-[#191A2E]">
                          {group.invite_code}
                          {codeCopied ? <Check size={12} weight="bold" className="text-[#2D6A4F]" aria-hidden /> : <Copy size={12} weight="bold" aria-hidden />}
                        </button>
                        , and every walk, ride and transit trip counts for the team.
                      </>
                    ) : (
                      <>
                        <Link href="/shift" target="_blank" rel="noopener" onClick={() => track('advisor_app_cta_clicked', { has_invite_code: false })} className="font-semibold text-[#2D6A4F]">Try the plan in the Shift app</Link>
                        {' '}(free), and see every walk, ride and transit trip add up.
                      </>
                    )}
                  </p>
                </div>
                <div className="min-w-0 rounded-[12px] border border-[rgba(25,26,46,0.12)] bg-white px-3.5 py-3">
                  <div className="mb-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[#4A4D68]">
                    {guideMode ? `Guides for ${contentModeWord(guideMode)}` : 'Guides'}
                  </div>
                  {guideGroups.length > 0 ? (
                    <div className="space-y-1.5">
                      {guideGroups.map((grp) => {
                        const QuestionIcon = STAGE_ICONS[QUESTION_STAGE[grp.question]]
                        return (
                        <div key={grp.question}>
                          <div className="flex items-center gap-1 text-[0.72rem] font-semibold text-[#4A4D68]">
                            <QuestionIcon size={15} weight="regular" className="shrink-0 text-[#2D6A4F]" aria-hidden />
                            {grp.question}
                          </div>
                          <ul className="m-0 list-none p-0">
                            {grp.guides.map((g) => (
                              <li key={g.id}>
                                <Link href={guideHref(g)} target="_blank" rel="noopener" onClick={() => track('advisor_guide_clicked', { guide_id: g.id, question: grp.question })} className="text-[0.8rem] font-semibold leading-snug text-[#191A2E] hover:text-[#2D6A4F]">{g.title}</Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[0.8rem] leading-snug text-[#4A4D68]">
                      Short guides to the first week by bike, on foot and on transit.
                    </p>
                  )}
                  <Link href="/guides" target="_blank" rel="noopener" className="mt-1.5 inline-block text-[0.8rem] font-semibold text-[#2D6A4F] hover:underline">All guides</Link>
                </div>
                <div className="min-w-0 rounded-[12px] border border-[rgba(25,26,46,0.12)] bg-white px-3.5 py-3">
                  <div className="mb-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[#4A4D68]">Try it with others</div>
                  {tryItCard === 'loading' ? (
                    <p className="text-[0.8rem] leading-snug text-[#4A4D68]" aria-live="polite">Finding one near the office…</p>
                  ) : tryItCard?.event ? (
                    <>
                      {/* The plan is the work in progress; everything that leaves it opens in a new tab. */}
                      <Link href={eventPath(tryItCard.event)} target="_blank" rel="noopener" className="block text-[0.9rem] font-bold leading-snug text-[#191A2E] hover:text-[#2D6A4F]">{tryItCard.event.content_items.title}</Link>
                      {tryItCard.event.organizer_name && <p className="mt-0.5 text-[0.8rem] leading-snug text-[#4A4D68]">{tryItCard.event.organizer_name}</p>}
                      <p className="mt-1 text-[0.8rem] leading-snug text-[#191A2E]">{eventKindLine(tryItCard.event)}</p>
                      <p className="text-[0.8rem] leading-snug text-[#191A2E]">{eventWhenLine(tryItCard.event)}</p>
                      {eventWhereLine(tryItCard.event) && <p className="text-[0.8rem] leading-snug text-[#191A2E]">{eventWhereLine(tryItCard.event)}</p>}
                      {tryItCard.event.excerpt && <p className="mt-1 text-[0.8rem] leading-snug text-[#4A4D68]">{tryItCard.event.excerpt}</p>}
                      <Link href={eventPath(tryItCard.event)} target="_blank" rel="noopener" onClick={() => track('advisor_event_clicked', { event_id: tryItCard.event?.id, event_mode: tryItCard.mode })} className="mt-1 inline-block text-[0.8rem] font-semibold text-[#2D6A4F] hover:underline">Event details</Link>
                    </>
                  ) : tryItCard?.walk_ride_day ? (
                    <>
                      <Link href={tryItCard.walk_ride_day.href} target="_blank" rel="noopener" className="block text-[0.9rem] font-bold leading-snug text-[#191A2E] hover:text-[#2D6A4F]">{tryItCard.walk_ride_day.title}</Link>
                      <p className="mt-1 text-[0.8rem] leading-snug text-[#191A2E]">{walkRideDayWhen(tryItCard.walk_ride_day.date)}</p>
                      <p className="mt-1 text-[0.8rem] leading-snug text-[#4A4D68]">{tryItCard.walk_ride_day.blurb}</p>
                      <Link href={tryItCard.walk_ride_day.href} target="_blank" rel="noopener" onClick={() => track('advisor_event_clicked', { event_id: 'walk-ride-day', event_mode: tryItCard.mode })} className="mt-1 inline-block text-[0.8rem] font-semibold text-[#2D6A4F] hover:underline">About Walk/Ride Day</Link>
                    </>
                  ) : (
                    <p className="text-[0.8rem] leading-snug text-[#4A4D68]">
                      Walks, rides and transit meetups near you are on the{' '}
                      <Link href="/events" target="_blank" rel="noopener" className="font-semibold text-[#2D6A4F]">events calendar</Link>.
                    </p>
                  )}
                  <TagAlong
                    groupId={group?.id && group.id !== 'public' ? group.id : null}
                    locationId={tagAlongLocationId}
                    mode={pickedMode ?? plan.recommended_mode}
                    distanceCategory={plan.distance_category}
                    variant={variant}
                    companyName={companyName}
                    disabled={isDemo || isDraft}
                    onTrack={track}
                  />
                </div>
              </div>

              {afterPlan && <div className="mt-3">{afterPlan}</div>}

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem]">
                <button type="button" onClick={() => setStep(1)} className="font-semibold text-[#2D6A4F] hover:underline">Change addresses or costs</button>
                {/* The plan is kept in this browser for a week; on a shared computer this is the way to leave nothing behind. */}
                <button type="button" onClick={startOver} className="font-semibold text-[#4A4D68] hover:underline">Start over and forget my addresses</button>
              </div>
      </>
    )
  }

  /* ── Render ── */
  return (
    <div ref={flowRef} className="advisor-flow">
      {/* Step indicator */}
      <div className="mx-auto mb-4 flex max-w-[480px] items-center justify-center gap-2 px-4 sm:px-8">
        {[1, PLAN_STEP].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => s < step && setStep(s)}
              disabled={s > step}
              aria-label={`Step ${s}`}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                s === step ? 'bg-[#2D6A4F] text-white' : s < step ? 'bg-[#E7F0EA] text-[#2D6A4F] hover:bg-[#d5e5d9]' : 'bg-[rgba(25,26,46,0.06)] text-[#5A5C6E]'
              }`}
            >
              {s < step ? <Check size={14} weight="bold" /> : s}
            </button>
            {s < PLAN_STEP && <div className={`h-px w-12 ${s < step ? 'bg-[#2D6A4F]/30' : 'bg-[rgba(25,26,46,0.12)]'}`} />}
          </div>
        ))}
      </div>

      {/* ── Step 1 ── */}
      {step === 1 && (
        <div className="mx-auto max-w-[520px] px-4 sm:px-8">
          <div className="rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-5 shadow-[0_1px_2px_rgba(25,26,46,0.05)] sm:p-8">
            <div className="mb-6 text-[1.125rem] font-bold text-[#191A2E]">Where is your commute?</div>
            <div className="mb-5 space-y-4">
              <AddressAutocomplete
                value={homeAddress}
                onChange={(val) => { setHomeAddress(val); if (!val) setHomePlaceData(null) }}
                onPlaceSelected={(p) => setHomePlaceData({ placeId: p.placeId, lat: p.lat, lng: p.lng })}
                label="Home address"
                variant="light"
                placeholder="Where do you live?"
              />

              {variant === 'employer' && officeOptions.length > 1 && (
                <div>
                  <label htmlFor="advisor-location" className="mb-1.5 block text-[0.8125rem] font-semibold text-[#191A2E]">
                    Which {companyName ?? 'office'} location?
                  </label>
                  <select
                    id="advisor-location"
                    value={locationId ?? ''}
                    onChange={(e) => pickLocation(e.target.value)}
                    className="w-full rounded-[10px] border border-[rgba(25,26,46,0.15)] bg-white px-3.5 py-3 text-[0.9375rem] text-[#191A2E] outline-none focus:border-[#2D6A4F]"
                  >
                    {officeOptions.map((l) => (
                      <option key={l.id} value={l.id}>{l.name ? `${l.name} · ${l.address.split(',')[0]}` : l.address}</option>
                    ))}
                  </select>
                </div>
              )}

              {variant === 'employer' && officeOptions.length === 1 && (
                <div className="flex items-start gap-2.5 rounded-[10px] border border-[rgba(25,26,46,0.09)] bg-[#FAFBF8] px-3.5 py-3">
                  <MapPin size={18} weight="fill" className="mt-0.5 shrink-0 text-[#2D6A4F]" aria-hidden />
                  <div>
                    <div className="text-[0.75rem] font-semibold uppercase tracking-wider text-[#5A5C6E]">Work</div>
                    <div className="text-[0.9375rem] text-[#191A2E]">{officeOptions[0].name ? `${officeOptions[0].name}, ` : ''}{officeOptions[0].address}</div>
                  </div>
                </div>
              )}

              {(variant === 'public' || officeOptions.length === 0) && (
                <AddressAutocomplete
                  value={workAddress}
                  onChange={(val) => { setWorkAddress(val); if (!val) setWorkPlaceData(null) }}
                  onPlaceSelected={(p) => setWorkPlaceData({ placeId: p.placeId, lat: p.lat, lng: p.lng })}
                  label="Work address"
                  variant="light"
                  placeholder="Where do you work?"
                />
              )}

              <ArriveBy value={arriveBy} onChange={(v) => changeArriveBy(v, 'step1')} />

              {/* Collapsed: the car, parking and days a week, prefilled from
                  the employer's benefits. "Add a parking cost" on the plan
                  reopens it here. */}
              <AdjustCosts
                key={costsOpen ? 'open' : 'closed'}
                defaultOpen={costsOpen}
                vehicle={vehicle}
                onVehicle={setVehicle}
                parkingPerDay={parkingPerDay}
                onParkingPerDay={setParkingPerDay}
                parkingHint={parkingDefault.hint}
                daysPerWeek={daysPerWeek}
                onDaysPerWeek={setDaysPerWeek}
              />

              <p className="text-[0.75rem] leading-snug text-[#5A5C6E]">
                Addresses are only used to look up routes. They are never saved to a profile or shared.
              </p>
            </div>

            <button
              type="button"
              onClick={seePlan}
              disabled={!homePlaceData || !workPlaceData}
              className="mt-6 w-full rounded-[10px] bg-[#2D6A4F] py-3 text-[0.9375rem] font-bold text-white transition-colors hover:bg-[#1F4D3A] disabled:opacity-30"
            >
              See my plan
            </button>

            {/* The employer's benefits list reads under the button, never between the fields and it. */}
            {step1Extra}
          </div>
        </div>
      )}

      {/* ── Step 2: the plan ── */}
      {step === PLAN_STEP && (
        <div className="mx-auto max-w-[1080px] px-4 sm:px-8">
          {outsideArea && (
            <div className="mx-auto max-w-[680px] rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-6 shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
              <p className="text-[0.9375rem] text-[#191A2E]">
                The advisor covers trips in Massachusetts. For other places, try{' '}
                <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" className="text-[#2D6A4F] underline">Google Maps</a> or a local transit app.
              </p>
              <button type="button" onClick={() => setStep(1)} className="mt-4 text-sm font-semibold text-[#2D6A4F]">Change addresses</button>
            </div>
          )}

          {error && (
            <div className="mx-auto max-w-[680px] rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-6 shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
              <p className="text-[0.9375rem] text-[#191A2E]">{error}</p>
              <button type="button" onClick={() => run({ arriveBy, motivation })} className="mt-3 text-sm font-semibold text-[#2D6A4F]">Try again</button>
            </div>
          )}

          {!loading && !plan && !error && !outsideArea && (
            <div className="mx-auto max-w-[680px] rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-6 text-center shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
              <p className="text-[0.9375rem] text-[#191A2E]">Add your home and work addresses and we will build your plan.</p>
              <button type="button" onClick={() => setStep(1)} className="mt-4 text-sm font-semibold text-[#2D6A4F]">Back to step 1</button>
            </div>
          )}

          {loading && !plan && (
            <div className="space-y-3" aria-busy="true">
              <div className="h-7 w-3/4 max-w-[520px] animate-pulse rounded bg-[rgba(25,26,46,0.08)]" />
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[rgba(25,26,46,0.12)] border-t-[#2D6A4F]" />
                <LoadingMessages theme="light" />
              </div>
              <PlanGridSkeleton />
            </div>
          )}

          {wide && plan && home && office && office4Links && (
            <div className="animate-in">{renderPlan(false)}</div>
          )}
        </div>
      )}

      {/* ── Phone: the map is the stage, the plan is the sheet ── */}
      {phoneStage && plan && home && office && office4Links && (
        <div className="nearby-tone nearby-tone-light fixed inset-x-0 bottom-0 top-[60px] z-30 flex flex-col overflow-hidden bg-[#F4F8EE]">
          <div ref={stageRef} className="relative min-h-0 flex-1">
            <AdvisorMap
              key={`stage-${home.lat},${home.lng}-${office.lat},${office.lng}`}
              layout="stage"
              home={{ lat: home.lat, lng: home.lng, label: 'Home' }}
              office={office4Links}
              plan={plan}
              legs={legsLive}
              comboLegs={comboLegsLive}
              calm={calm}
              bikeParking={bikeParking}
              shuttles={shuttleLines}
              selectedRow={expanded}
              highlightedLeg={highlightedLeg}
              onLegTap={tapMapLeg}
              selectedDock={selectedDock}
              onDockTap={tapDock}
              fitPadding={stagePadding}
            />
            <NearbySheet
              snap={snap}
              onSnapChange={(next, source) => { setSnap(next); track('advisor_sheet_snap', { snap: next, source }) }}
              header={(() => {
                const pick = rows.find((r) => r.key === pickedKey) ?? rows[0]
                return (
                  <div className="px-4 pb-2.5">
                    <div className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#2D6A4F]">Your plan</div>
                    <div className="truncate text-[0.95rem] font-extrabold leading-snug text-[#191A2E]">
                      {pick ? `${pick.name}${pick.leaveBy ? `, leave by ${pick.leaveBy}` : ''}` : headline}
                    </div>
                  </div>
                )
              })()}
            >
              {/* A tapped dock's detail, as Nearby's sheet shows it, with the way back. */}
              {selectedDock && (() => {
                const liveDocks = [...plan.nearby.docks_home.slice(0, 3), ...plan.nearby.docks.slice(0, 3)].map(asLiveDock)
                if (!liveDocks.some((d) => d.station_id === selectedDock)) return null
                return (
                  <div className="mb-3 rounded-xl border border-[rgba(25,26,46,0.12)] bg-white px-3.5 py-3">
                    <button type="button" onClick={() => tapDock(null)} className="mb-1.5 text-[0.8rem] font-semibold text-[#2D6A4F]">Back to the plan</button>
                    <DetailContent
                      selection={{ type: 'dock', id: selectedDock }}
                      stationByKey={new Map()}
                      corridorById={new Map()}
                      docks={liveDocks}
                      borrowRent={[]}
                      repairPlaces={[]}
                      center={home}
                      onSelectCorridor={() => {}}
                    />
                  </div>
                )
              })()}
              {renderPlan(true)}
            </NearbySheet>
          </div>
        </div>
      )}

      {/* Print-only: the one-page plan (its own @media print rules show only this block) */}
      {step === PLAN_STEP && plan && home && office && (
        <CommutePlanPrint
          group={printGroup}
          benefits={benefits}
          recommendation={plan}
          homeAddress={homeAddress}
          workAddress={workAddress}
          locationName={officeOptions.find((l) => l.id === locationId)?.name ?? null}
          driveDays={daysPerWeek}
          joinLink={joinLink}
          motivation={motivation}
        />
      )}
    </div>
  )
}
