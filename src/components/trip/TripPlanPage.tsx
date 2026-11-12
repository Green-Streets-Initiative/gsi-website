'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import QRCode from 'qrcode'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import ModeIcon from '@/components/commute/ModeIcon'
import StaticMapSvg from '@/components/nearby/StaticMapSvg'
import NearbyLanguagePill from '@/components/nearby/NearbyLanguagePill'
import { NearbyI18nProvider } from '@/components/nearby/NearbyI18n'
import { NearbyToneProvider } from '@/components/nearby/NearbyTone'
import { V2Trip, protectedShare } from '@/components/nearby/ReachSection'
import { NEARBY_COMFORT_COLORS } from '@/components/nearby/BikeComfortBlock'
import { useIsDesktop } from '@/components/nearby/useIsDesktop'
import type { ReachRow } from '@/components/nearby/types'
import { resolveNearbyLocale, type NearbyLocale } from '@/lib/nearby/i18n'
import { parseTripDest } from '@/lib/nearby/share'
import { defaultRouteMode, hasBikeRoute, hasTransitRoute } from '@/lib/nearby/reach-ui'
import { directionsUrl } from '@/lib/nearby/transit-ui'
import { decodePolyline } from '@/lib/geo/polyline'
import type { PrintLine } from '@/lib/nearby/static-map'
import { tripT } from '@/lib/trip/strings'
import { transitFare, weeklyDrive, weeklyTransit, weeklyUsd } from '@/lib/trip/weekly'
import TripWhy from './TripWhy'
import FirstTry from './FirstTry'
import { novelty, saveTripPlan, useMyWays } from './useMyWays'

/**
 * Plan a trip (Keith 2026-11-12, product review of Plan a route and Around
 * You). The nav's "Plan a trip" used to land on the neighborhood snapshot,
 * which asked for your "new address" and drew a map of what's near it. This
 * page does the one job the label promises: From, To, and every way to make
 * the trip side by side, with walking and driving included.
 *
 * Shift's part is the comparison and the calm bike route (comfort-scored,
 * share on protected lanes), then "Get directions" hands off to a maps app
 * carrying that route. The trip itself is the same answer /nearby and the
 * app use (/api/nearby/trip), asked for with &depart=now&ways=all.
 *
 * Privacy: the start never goes in the page link; only the destination (a
 * public place) and the way do, so a link sent to a phone plans from there.
 *
 * The Next rows (Keith 2026-11-12): help for a first try only when the way is
 * new for that person (FirstTry), "Do this often?" as a weekly cost on the
 * same rows, and, for a signed-in Shift member, each plan saved (Shift 01758)
 * so we can see whether a trip that way follows within 14 days.
 */

type Way = 'walk' | 'bike' | 'transit'
type Leave = 'now' | 'am'
type Place = { lat: number; lng: number; name: string }

/** The trip answer plus the two extra ways the planner asks for. */
type TripAnswer = ReachRow & {
  walk?: { minutes: number; miles: number; encodedPolyline: string | null } | null
  drive?: { minutes: number; miles: number } | null
  depart_at?: string | null
}

const WALK_FIRST_MAX_MIN = 15
const ROUTE_BLUE = '#185FA5'
const WALK_GRAY = '#5F5E5A'

function bestWay(row: TripAnswer, prefer?: Way): Way {
  if (prefer === 'walk' && row.walk) return 'walk'
  if (prefer === 'bike' && hasBikeRoute(row)) return 'bike'
  if (prefer === 'transit' && hasTransitRoute(row)) return 'transit'
  // A short walk is the answer; past that, the quicker of bike and transit
  if (row.walk && row.walk.minutes <= WALK_FIRST_MAX_MIN) return 'walk'
  if (!hasBikeRoute(row) && !hasTransitRoute(row) && row.walk) return 'walk'
  return defaultRouteMode(row)
}

function readWay(v: string | null): Way | undefined {
  return v === 'walk' || v === 'bike' || v === 'transit' ? v : undefined
}

export default function TripPlanPage() {
  const searchParams = useSearchParams()
  const langParam = searchParams.get('lang')
  const [browserLang, setBrowserLang] = useState<string | null>(null)
  useEffect(() => { setBrowserLang(typeof navigator !== 'undefined' ? navigator.language : null) }, [])
  const [chosenLocale, setChosenLocale] = useState<NearbyLocale | null>(null)
  const locale = chosenLocale ?? resolveNearbyLocale(langParam, browserLang)

  return (
    <NearbyToneProvider tone="light">
      <NearbyI18nProvider locale={locale} setLocale={setChosenLocale}>
        <TripPlanner locale={locale} />
      </NearbyI18nProvider>
    </NearbyToneProvider>
  )
}

function TripPlanner({ locale }: { locale: NearbyLocale }) {
  const tt = useCallback((k: string, v?: Record<string, string | number>) => tripT(locale, k, v), [locale])
  // useIsDesktop guesses on the server and reads the window on the client's
  // first render; both renders treat it as a phone until mounted, so a narrow
  // window hydrates without a mismatch
  const wide = useIsDesktop()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const isDesktop = mounted && wide

  const [from, setFrom] = useState<Place | null>(null)
  const [fromText, setFromText] = useState('')
  const [to, setTo] = useState<Place | null>(null)
  const [toText, setToText] = useState('')
  const [leave, setLeave] = useState<Leave>('now')
  // A link names the destination (and maybe the way and departure). Read
  // once after the page loads, so the server's render and the browser's
  // first render agree and the fields fill in at every width.
  const [linkedTo, setLinkedTo] = useState<boolean | null>(null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState(false)

  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'outside'>('idle')
  const [attempt, setAttempt] = useState(0)
  const [row, setRow] = useState<TripAnswer | null>(null)
  const [way, setWay] = useState<Way | null>(null)
  const [bikeAlt, setBikeAlt] = useState(false)
  // Phones: once a trip is planned the form folds to one line, so the answer
  // is on the first screen; "Change" opens it again
  const [editing, setEditing] = useState(true)
  const preferWay = useRef<Way | undefined>(undefined)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const dest = parseTripDest(p)
    if (dest) {
      setTo({ lat: dest.lat, lng: dest.lng, name: dest.name })
      setToText(dest.name)
    }
    preferWay.current = readWay(p.get('way')) ?? dest?.mode
    if (p.get('leave') === 'am') setLeave('am')
    setLinkedTo(!!dest)
  }, [])
  // The way they picked, kept when only the departure changes
  const pickedWay = useRef<{ toKey: string; way: Way } | null>(null)
  const [weekly, setWeekly] = useState(false)
  const me = useMyWays()
  // One id per plan, so a new way or Get directions updates the same row
  const [planId, setPlanId] = useState<string | null>(null)

  const locate = useCallback((auto = false) => {
    if (!navigator.geolocation) { setGeoError(true); return }
    setLocating(true)
    setGeoError(false)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false)
        const name = tripT(locale, 'trip.my_location')
        setFrom({ lat: pos.coords.latitude, lng: pos.coords.longitude, name })
        setFromText(name)
        posthog.capture('trip_location_used', { auto })
      },
      () => { setLocating(false); if (!auto) setGeoError(true) },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60_000 },
    )
  }, [locale])

  // Permission already given (a returning visitor): start from here without
  // a tap. Never prompts; a first visit taps "Use my location" itself.
  useEffect(() => {
    let cancelled = false
    navigator.permissions?.query({ name: 'geolocation' as PermissionName })
      .then(p => { if (!cancelled && p.state === 'granted') locate(true) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [locate])

  // Plan whenever both ends and the departure are set
  useEffect(() => {
    if (!from || !to) return
    let cancelled = false
    setStatus('loading')
    const url = `/api/nearby/trip?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`
      + `&name=${encodeURIComponent(to.name)}&ways=all${leave === 'now' ? '&depart=now' : ''}`
    fetch(url)
      .then(async res => {
        if (res.status === 400) throw new Error('outside')
        if (!res.ok) throw new Error(`trip ${res.status}`)
        const { row } = await res.json()
        if (!row) throw new Error('empty')
        return row as TripAnswer
      })
      .then(next => {
        if (cancelled) return
        setRow(next)
        setBikeAlt(false)
        setPlanId(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null)
        const toKey = `${to.lat},${to.lng}`
        const kept = pickedWay.current?.toKey === toKey ? pickedWay.current.way : undefined
        const w = bestWay(next, preferWay.current ?? kept)
        preferWay.current = undefined
        setWay(w)
        setStatus('idle')
        setEditing(false)
        posthog.capture('trip_planned', {
          walk: next.walk?.minutes ?? null,
          bike: hasBikeRoute(next) ? next.bike_minutes : null,
          transit: next.transit_minutes ?? null,
          drive: next.drive?.minutes ?? null,
          leave,
          first_way: w,
        })
        // The link names the destination and the way, never the start
        const p = new URLSearchParams(window.location.search)
        p.set('to', `${to.lat.toFixed(5)},${to.lng.toFixed(5)}`)
        p.set('toName', to.name)
        p.set('way', w)
        if (leave === 'am') p.set('leave', 'am'); else p.delete('leave')
        p.delete('toMode')
        p.delete('plan')
        window.history.replaceState({}, '', `${window.location.pathname}?${p}`)
      })
      .catch(err => {
        if (cancelled) return
        setStatus(err instanceof Error && err.message === 'outside' ? 'outside' : 'error')
      })
    return () => { cancelled = true }
  }, [from, to, leave, attempt])

  const pickWay = useCallback((w: Way) => {
    setWay(w)
    if (to) pickedWay.current = { toKey: `${to.lat},${to.lng}`, way: w }
    posthog.capture('trip_way_selected', { way: w })
    const p = new URLSearchParams(window.location.search)
    p.set('way', w)
    window.history.replaceState({}, '', `${window.location.pathname}?${p}`)
  }, [to])

  // A signed-in member's plan is saved (and kept up to date with the way)
  const savePlan = useCallback((directions = false) => {
    if (!me.signedIn || !planId || !row || !way || !from || !to) return
    saveTripPlan({
      id: planId,
      from,
      to,
      way,
      newWay: me.ways ? !me.ways.includes(way) : null,
      ways: {
        walk: row.walk?.minutes ?? null,
        bike: hasBikeRoute(row) ? row.bike_minutes : null,
        transit: hasTransitRoute(row) ? row.transit_minutes : null,
        drive: row.drive?.minutes ?? null,
      },
      directions,
    })
  }, [me.signedIn, me.ways, planId, row, way, from, to])
  useEffect(() => { savePlan() }, [savePlan])

  const fmt = useCallback((minutes: number) => {
    if (minutes < 60) return tt('trip.min', { minutes })
    return tt('trip.hr_min', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
  }, [tt])

  const map = row && from && to && way ? (
    <TripMap row={row} way={way} bikeAlt={bikeAlt} from={from} to={to} title={tt('trip.map_title')} tall={isDesktop} />
  ) : null

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-20 pt-8 sm:px-6 lg:pt-12">
      <div className="lg:grid lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:gap-8">
        <div>
          {/* The language switch sits beside the title only, so the subtitle
              gets the full width (it wrapped to four lines on phones) */}
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-display text-[clamp(1.9rem,4vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-(--nb-ink)">
              {tt('trip.title')}
            </h1>
            <NearbyLanguagePill className="mt-1 shrink-0" />
          </div>
          <p className="mt-2 text-[16px] leading-snug text-(--nb-ink-80)">{tt('trip.subtitle')}</p>

          {/* From / To / when (folded to one line on phones once planned) */}
          {!isDesktop && !editing && row && from && to ? (
            <div className="mt-5 flex items-center gap-3 rounded-[18px] border border-(--nb-line-mid) bg-(--nb-card) px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold text-(--nb-ink)">{from.name} → {to.name}</div>
                <div className="text-[14px] text-(--nb-ink-80)">{tt(leave === 'now' ? 'trip.leaving_now' : 'trip.leaving_am')}</div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="shrink-0 rounded-full border border-(--nb-line-mid) px-3.5 py-1.5 text-[15px] font-semibold text-(--nb-ink) hover:bg-(--nb-panel)"
              >
                {tt('trip.change')}
              </button>
            </div>
          ) : (
          <div className="mt-6 rounded-[18px] border border-(--nb-line-mid) bg-(--nb-card) p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <label className="text-[14px] font-bold text-(--nb-ink)">{tt('trip.from')}</label>
              <button
                type="button"
                onClick={() => locate(false)}
                disabled={locating}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[14px] font-semibold text-(--nb-accent) hover:bg-(--nb-panel) disabled:opacity-60"
              >
                <svg className="h-4 w-4" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M229.33,98.21,53.41,33l-.16-.05A16,16,0,0,0,32.9,53.25a1,1,0,0,0,.05.16L98.21,229.33A15.77,15.77,0,0,0,113.28,240h.3a15.77,15.77,0,0,0,15-11.29l23.56-76.56,76.56-23.56a16,16,0,0,0,.62-30.38ZM224,113.3l-76.56,23.56a16,16,0,0,0-10.58,10.58L113.3,224h0l-.06-.17L48,48l175.82,65.22.16.06Z"/></svg>
                {locating ? tt('trip.locating') : tt('trip.use_location')}
              </button>
            </div>
            <div className="mt-1.5">
              <AddressAutocomplete
                value={fromText}
                onChange={a => { setFromText(a); if (from) setFrom(null) }}
                onPlaceSelected={p => {
                  const name = p.address.split(',')[0]?.trim() || p.address
                  setFrom({ lat: p.lat, lng: p.lng, name })
                }}
                label={null}
                variant="light"
                placeholder={tt('trip.from_placeholder')}
                includeAreas
              />
            </div>
            {geoError && <p className="mt-2 text-[14px] leading-snug text-(--nb-ink-80)">{tt('trip.geo_error')}</p>}

            <label className="mt-4 block text-[14px] font-bold text-(--nb-ink)">{tt('trip.to')}</label>
            <div className="mt-1.5">
              <AddressAutocomplete
                value={toText}
                onChange={a => { setToText(a); if (to) setTo(null) }}
                onPlaceSelected={p => {
                  const name = p.address.split(',')[0]?.trim() || p.address
                  setTo({ lat: p.lat, lng: p.lng, name })
                  setToText(name)
                }}
                label={null}
                variant="light"
                placeholder={tt('trip.to_placeholder')}
                includeAreas
                autoFocus={linkedTo === false}
              />
            </div>

            <div role="radiogroup" aria-label={tt('trip.leave_now')} className="mt-4 flex gap-1 rounded-xl bg-(--nb-panel) p-1">
              {(['now', 'am'] as const).map(l => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={leave === l}
                  onClick={() => { if (leave !== l) { setLeave(l); posthog.capture('trip_leave_changed', { leave: l }) } }}
                  className={`flex-1 rounded-lg px-2 py-2 text-[15px] font-semibold transition-colors ${
                    leave === l ? 'bg-(--nb-card) text-(--nb-ink) shadow-sm' : 'text-(--nb-ink-80) hover:text-(--nb-ink)'
                  }`}
                >
                  {tt(l === 'now' ? 'trip.leave_now' : 'trip.leave_am')}
                </button>
              ))}
            </div>
          </div>
          )}

          {status === 'loading' && (
            <p className="mt-4 flex items-center gap-2 text-[15px] text-(--nb-ink-80)" role="status">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-(--nb-line-mid) border-t-(--nb-accent)" aria-hidden="true" />
              {tt('trip.planning')}
            </p>
          )}
          {status === 'error' && (
            <div className="mt-4 flex items-center gap-3" role="alert">
              <p className="text-[15px] text-(--nb-ink-80)">{tt('trip.error')}</p>
              <button
                type="button"
                onClick={() => setAttempt(a => a + 1)}
                className="shrink-0 rounded-full border border-(--nb-line-mid) px-3.5 py-1.5 text-[15px] font-semibold text-(--nb-ink) hover:bg-(--nb-panel)"
              >
                {tt('trip.retry')}
              </button>
            </div>
          )}
          {status === 'outside' && <p className="mt-4 text-[15px] text-(--nb-ink-80)" role="alert">{tt('trip.outside')}</p>}

          {/* The answer */}
          {row && way && from && to && (
            <div className={`mt-5 rounded-[18px] border border-(--nb-line-mid) bg-(--nb-card) p-4 sm:p-5 ${status === 'loading' ? 'opacity-60' : ''}`}>
              {(isDesktop || editing) && (
                <>
                  <div className="text-[15px] font-semibold text-(--nb-ink)">
                    {from.name} → {to.name}
                  </div>
                  <div className="text-[14px] text-(--nb-ink-80)">{tt(leave === 'now' ? 'trip.leaving_now' : 'trip.leaving_am')}</div>
                </>
              )}

              <TripWays row={row} way={way} onPick={pickWay} fmt={fmt} tt={tt} weekly={weekly} />
              <button
                type="button"
                onClick={() => { setWeekly(w => !w); if (!weekly) posthog.capture('trip_weekly_cost_shown', { way }) }}
                aria-pressed={weekly}
                className="mt-2 px-3 text-[15px] font-semibold text-(--nb-accent) hover:opacity-80"
              >
                {tt(weekly ? 'trip.weekly_hide' : 'trip.weekly_show')}
                {weekly && <span className="font-normal text-(--nb-ink-80)"> · {tt('trip.weekly_basis')}</span>}
              </button>

              {!isDesktop && map && <div className="mt-4 overflow-hidden rounded-xl">{map}</div>}

              <div className="mt-4">
                {way === 'walk' ? (
                  <TripActions row={row} way={way} bikeAlt={false} from={from} tt={tt} onDirections={() => savePlan(true)} />
                ) : (
                  <V2Trip
                    row={row}
                    mode={way}
                    onMode={m => pickWay(m)}
                    center={from}
                    bikeAlt={bikeAlt}
                    onPickRoute={alt => { setBikeAlt(alt); posthog.capture('trip_bike_route_picked', { faster: alt }) }}
                    avoidFor={() => undefined}
                    hideSwitch
                    actions={
                      <>
                        <TripActions row={row} way={way} bikeAlt={bikeAlt} from={from} tt={tt} onDirections={() => savePlan(true)} />
                        {/* Right under the main button: help for a first try */}
                        <FirstTry
                          way={way}
                          novelty={novelty(me, way)}
                          tryNew={me.tryNew}
                          hasBus={row.steps.some(s => s.routeType === 3)}
                          tt={tt}
                        />
                      </>
                    }
                  />
                )}
              </div>
            </div>
          )}

          {!row && status !== 'loading' && <TripWhy tt={tt} />}

          <p className="mt-6 text-[15px]">
            <Link href="/nearby" className="font-semibold text-(--nb-accent) hover:opacity-80">{tt('trip.near_you')} →</Link>
          </p>
        </div>

        {/* Desktop: the map beside the answer (on phones it sits in the card) */}
        <div className="hidden lg:block">
          <div className="sticky top-[84px] overflow-hidden rounded-[18px] border border-(--nb-line-mid) bg-(--nb-panel)">
            {isDesktop && map ? map : isDesktop ? <AreaMap to={to} title={tt('trip.map_title')} /> : <div className="h-[min(640px,calc(100vh-120px))]" aria-hidden="true" />}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Every way to make the trip, one row each. Drive is a reference row. */
function TripWays({ row, way, onPick, fmt, tt, weekly }: {
  row: TripAnswer
  way: Way
  onPick: (w: Way) => void
  fmt: (minutes: number) => string
  tt: (k: string, v?: Record<string, string | number>) => string
  /** "Do this often?": each row says what a week of it costs instead */
  weekly: boolean
}) {
  const transitWeek = weeklyTransit(transitFare(row.steps))
  const week: Record<Way | 'drive', string | null> = {
    walk: tt('trip.weekly', { cost: '$0' }),
    bike: tt('trip.weekly_bike'),
    transit: hasTransitRoute(row)
      ? tt(transitWeek.monthPass ? 'trip.weekly_month_pass' : transitWeek.pass ? 'trip.weekly_pass' : transitWeek.from ? 'trip.weekly_from' : 'trip.weekly', { cost: weeklyUsd(transitWeek.cost) })
      : null,
    drive: row.drive ? tt('trip.weekly_drive', { cost: weeklyUsd(weeklyDrive(row.drive.miles)) }) : null,
  }
  const share = protectedShare(row.bike_comfort)
  const transitSub = !hasTransitRoute(row) || row.transit_minutes === null
    ? tt('trip.sub_no_transit')
    : row.steps.length > 0
      ? row.steps.slice(0, 2).map(s =>
          s.shuttle ? s.label
          : s.routeType === 3 ? tt('trip.bus_n', { n: s.label })
          : (s.routeType === 0 || s.routeType === 1) && !/line/i.test(s.label) ? tt('trip.line_n', { n: s.label.replace(/^Green-/, 'Green ') })
          : s.label).join(' → ')
        + (row.steps.length > 2 ? ' …' : '')
      : null
  const items: { key: Way | 'drive'; label: string; minutes: number | null; approx?: boolean; sub: string | null; mode: string }[] = [
    { key: 'walk', mode: 'walk', label: tt('trip.way_walk'), minutes: row.walk?.minutes ?? null, sub: row.walk ? tt('trip.sub_miles', { miles: row.walk.miles.toFixed(1) }) : null },
    {
      key: 'bike', mode: 'bike',
      label: row.bike_alt || (share ?? 0) > 0 ? tt('trip.way_bike') : tt('trip.way_bike_plain'),
      minutes: hasBikeRoute(row) ? row.bike_minutes : null,
      approx: row.bike_is_estimate,
      sub: share !== null && share > 0 ? tt('trip.sub_protected', { pct: Math.round(share * 100) }) : null,
    },
    { key: 'transit', mode: 'transit', label: tt('trip.way_transit'), minutes: hasTransitRoute(row) ? row.transit_minutes : null, sub: transitSub },
    { key: 'drive', mode: 'drive', label: tt('trip.way_drive'), minutes: row.drive?.minutes ?? null, sub: tt('trip.sub_drive') },
  ]

  return (
    <ul className="mt-3 space-y-1.5 first:mt-0">
      {items.filter(i => i.minutes !== null || i.key === 'transit').map(i => {
        if (weekly && week[i.key]) i = { ...i, sub: week[i.key] }
        const selectable = i.key !== 'drive' && i.minutes !== null
        const selected = selectable && i.key === way
        const body = (
          <>
            <ModeIcon mode={i.mode} size={22} className={i.key === 'drive' ? 'text-(--nb-ink-80)' : 'text-(--nb-ink)'} />
            <span className="min-w-0 flex-1">
              <span className={`block text-[16px] font-semibold leading-tight ${i.key === 'drive' ? 'text-(--nb-ink-80)' : 'text-(--nb-ink)'}`}>{i.label}</span>
              {i.sub && <span className="mt-0.5 block text-[14px] leading-snug text-(--nb-ink-80)">{i.sub}</span>}
            </span>
            {i.minutes !== null && (
              <span className={`shrink-0 text-[16px] font-bold tabular-nums ${i.key === 'drive' ? 'text-(--nb-ink-80)' : 'text-(--nb-ink)'}`}>
                {i.approx ? '~' : ''}{fmt(i.minutes)}
              </span>
            )}
          </>
        )
        return (
          <li key={i.key}>
            {selectable ? (
              <button
                type="button"
                onClick={() => onPick(i.key as Way)}
                aria-pressed={selected}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  selected ? 'border-(--nb-accent-line) bg-(--nb-accent-tint)' : 'border-transparent hover:bg-(--nb-panel)'
                }`}
              >
                {body}
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Get directions (main), and on a computer, Send to my phone. */
function TripActions({ row, way, bikeAlt, from, tt, onDirections }: {
  row: TripAnswer
  way: Way
  bikeAlt: boolean
  from: Place
  tt: (k: string, v?: Record<string, string | number>) => string
  onDirections: () => void
}) {
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // A phone is already in hand: only a computer gets "Send to my phone"
  const [finePointer, setFinePointer] = useState(false)
  useEffect(() => { setFinePointer(window.matchMedia('(hover: hover) and (pointer: fine)').matches) }, [])

  const route = way === 'bike' ? (bikeAlt ? row.bike_alt?.polyline : row.bike_polyline) ?? null : null
  const href = directionsUrl(row.lat, row.lng, {
    mode: way === 'walk' ? 'walking' : way === 'bike' ? 'bicycling' : 'transit',
    origin: { lat: from.lat, lng: from.lng },
    route,
  })

  const shareUrl = typeof window === 'undefined' ? '' : window.location.href

  useEffect(() => {
    if (!phoneOpen || !shareUrl) return
    QRCode.toDataURL(shareUrl, { margin: 1, width: 360, color: { dark: '#191A2E', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null))
  }, [phoneOpen, shareUrl])

  return (
    <div className="mt-4">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => { posthog.capture('trip_directions_clicked', { way, calm_route: !!route && !bikeAlt }); onDirections() }}
        className="block rounded-xl bg-(--nb-accent-fill) px-4 py-3 text-center text-[16px] font-bold text-(--nb-on-accent-fill) transition-opacity hover:opacity-90"
      >
        {tt('trip.get_directions')}
      </a>
      {finePointer && (
        <button
          type="button"
          onClick={() => { setPhoneOpen(o => !o); if (!phoneOpen) posthog.capture('trip_send_to_phone_opened', { way }) }}
          aria-expanded={phoneOpen}
          className="mt-2 block w-full rounded-xl border border-(--nb-line-mid) px-4 py-3 text-center text-[16px] font-semibold text-(--nb-ink) transition-colors hover:bg-(--nb-panel)"
        >
          {tt('trip.send_phone')}
        </button>
      )}
      {finePointer && phoneOpen && (
        <div className="mt-3 flex items-center gap-4 rounded-xl bg-(--nb-panel) p-3">
          {qr
            ? <img src={qr} alt="" width={120} height={120} className="h-[120px] w-[120px] shrink-0 rounded-lg" />
            : <div className="h-[120px] w-[120px] shrink-0 rounded-lg bg-(--nb-card)" aria-hidden="true" />}
          <div className="min-w-0">
            <p className="text-[15px] leading-snug text-(--nb-ink)">{tt('trip.scan')}</p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(shareUrl).then(() => {
                  setCopied(true)
                  posthog.capture('trip_link_copied', { way })
                  window.setTimeout(() => setCopied(false), 2000)
                })
              }}
              className="mt-2 text-[15px] font-semibold text-(--nb-accent) hover:opacity-80"
            >
              {copied ? tt('trip.copied') : tt('trip.copy_link')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Before a trip is planned: the area it will be in (the destination when a
 *  link named one, else Greater Boston), so the page opens on a real map. */
function AreaMap({ to, title }: { to: Place | null; title: string }) {
  const c = to ?? { lat: 42.3601, lng: -71.0789 }
  const span = to ? 0.02 : 0.06
  return (
    <StaticMapSvg
      center={c}
      lines={[]}
      markers={[]}
      endPoint={to ? { lat: to.lat, lng: to.lng } : undefined}
      fitPoints={[{ lat: c.lat - span, lng: c.lng - span }, { lat: c.lat + span, lng: c.lng + span }]}
      width={520}
      height={560}
      maxHalf={{ lat: 1, lng: 1 }}
      minZoom={11}
      title={title}
      className="block h-[min(640px,calc(100vh-120px))] w-full"
    />
  )
}

/** The chosen way drawn on a map: bike in comfort colors, transit in its
 *  line colors with the walks dashed, a walk in blue. */
function TripMap({ row, way, bikeAlt, from, to, title, tall }: {
  row: TripAnswer
  way: Way
  bikeAlt: boolean
  from: Place
  to: Place
  title: string
  tall: boolean
}) {
  const lines = useMemo<PrintLine[]>(() => {
    const coords = (enc: string): [number, number][] => decodePolyline(enc).map(([lat, lng]) => [lng, lat])
    if (way === 'bike') {
      const comfort = bikeAlt ? row.bike_alt?.comfort : row.bike_comfort
      const segs = comfort?.segments.filter(s => s.polyline) ?? []
      if (segs.length) return segs.map(s => ({ coords: coords(s.polyline), color: NEARBY_COMFORT_COLORS[s.rating] }))
      const enc = bikeAlt ? row.bike_alt?.polyline : row.bike_polyline
      return enc ? [{ coords: coords(enc), color: ROUTE_BLUE }] : []
    }
    if (way === 'transit') {
      return (row.transit_segments ?? []).filter(s => s.polyline).map(s => ({
        coords: coords(s.polyline),
        color: s.mode === 'walk' ? WALK_GRAY : s.color,
        dashed: s.mode === 'walk',
      }))
    }
    return row.walk?.encodedPolyline ? [{ coords: coords(row.walk.encodedPolyline), color: ROUTE_BLUE }] : []
  }, [row, way, bikeAlt])

  const fitPoints = useMemo(() => {
    const pts = lines.flatMap(l => l.coords.map(([lng, lat]) => ({ lat, lng })))
    return [...pts, { lat: to.lat, lng: to.lng }]
  }, [lines, to])

  return (
    <StaticMapSvg
      center={{ lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 }}
      lines={lines}
      markers={[{ kind: 'home', lat: from.lat, lng: from.lng }]}
      homeColor={ROUTE_BLUE}
      endPoint={{ lat: to.lat, lng: to.lng }}
      fitPoints={fitPoints}
      width={tall ? 520 : 400}
      height={tall ? 560 : 250}
      maxHalf={{ lat: 1, lng: 1 }}
      minZoom={9}
      lineWidth={5}
      title={title}
      className={tall ? 'block h-[min(640px,calc(100vh-120px))] w-full' : 'block h-[240px] w-full sm:h-[300px]'}
    />
  )
}
