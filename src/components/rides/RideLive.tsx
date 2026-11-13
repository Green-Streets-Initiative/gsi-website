'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { ArrowLeft, Navigation, Route as RouteIcon } from 'lucide-react'
import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase'
import { clock, dateLong, type PublicRide, type RideDate } from '@/lib/rides/public'
import { guardSignSvg } from '@/lib/rides/guard-sign'
import { catchTheGroup, easternStart, type LatLng } from '@/lib/rides/catch-group'
import { EventsToneProvider, toneClass } from '@/components/events/EventsTone'
import '@/components/events/events-tone.css'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { ridesStrings } from '@/lib/site-strings/rides'

const RouteMap = dynamic(() => import('@/components/organizers/RouteMap'), { ssr: false })

/**
 * Where the group is, for anyone following without the app (Shift 01747):
 * family, someone running late, someone joining partway. The leader's phone
 * shares the position (Shift's app); this page reads it every 15 seconds
 * through get_ride_live_web and says how far the group is from what's next.
 * "Meet them along the way" (Keith 2026-11-13) finds a place on the route the
 * person can reach before the group, from where they are and the ride's pace.
 */

type LiveState = 'live' | 'stale' | 'waiting' | 'later' | 'finished' | 'silent' | 'off' | 'hidden' | 'canceled' | 'members_only' | 'no_date'
interface Live {
  state: LiveState
  lat: number | null
  lng: number | null
  trail: { lat: number; lng: number }[]
  age_seconds: number | null
  pace_mph: number | null
  my_stop: string | null
}

const POLL_MS = 15000
const R = 6371000

function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** How far along the route (miles) the point is, and how far off it (meters), by nearest vertex. */
function along(route: { lat: number; lng: number }[], p: { lat: number; lng: number }): { mi: number; off: number } | null {
  if (route.length < 2) return null
  let cum = 0
  let best = { mi: 0, off: Infinity }
  for (let i = 0; i < route.length; i++) {
    if (i > 0) cum += meters(route[i - 1], route[i])
    const d = meters(route[i], p)
    if (d < best.off) best = { mi: cum / 1609.344, off: d }
  }
  return best
}

/** "HH:MM" in Boston for an instant, for clock(). */
const bostonHm = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' })

export default function RideLive({ ride, date, token, pieces = null, autoCatch = false, locale = 'en' }: {
  ride: PublicRide
  date: RideDate | null
  token: string | null
  /** The route's streets in order (the ride's comfort_segments), to name a meeting spot. */
  pieces?: { label: string; distance_mi: number }[] | null
  /** Opened from "Running late?": look for a meeting spot straight away. */
  autoCatch?: boolean
  locale?: SiteLocale
}) {
  const t = translator(ridesStrings, locale)
  const [live, setLive] = useState<Live | null>(null)
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const fetchedAt = useRef(Date.now())
  const walk = ride.activity === 'walk'

  // Poll while the page is on screen; a hidden tab stops asking.
  useEffect(() => {
    if (!date) return
    let stop = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      if (document.visibilityState === 'visible') {
        const { data, error } = await supabase.rpc('get_ride_live_web', { p_code: ride.code, p_date: date.date, p_token: token })
        if (stop) return
        if (error || !data) setFailed(true)
        else { setFailed(false); setLive(data as Live); fetchedAt.current = Date.now() }
      }
      timer = setTimeout(tick, POLL_MS)
    }
    void tick()
    const onVis = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); void tick() } }
    document.addEventListener('visibilitychange', onVis)
    return () => { stop = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVis) }
  }, [ride.code, date, token])
  useEffect(() => { posthog.capture('ride_live_web_view', { code: ride.code, with_token: !!token }) }, [ride.code, token])
  // The "updated N sec ago" ticks between polls.
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(i) }, [])

  const route = useMemo(() => {
    const own = date?.own_route ? date.route : null
    return ((own ? own.route_waypoints : ride.route_waypoints) ?? []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
  }, [ride, date])
  const stops = useMemo(() => (date?.stops ?? []).filter((s) => s.lat != null && s.lng != null), [date])
  const crossings = useMemo(() => (date?.help?.crossings ?? []).filter((c) => c.lat != null && c.lng != null), [date])
  const meetup = date?.meetup_lat != null && date?.meetup_lng != null ? { lat: date.meetup_lat, lng: date.meetup_lng } : null

  const ageS = live?.age_seconds != null ? live.age_seconds + Math.round((now - fetchedAt.current) / 1000) : null
  const agoText = ageS == null ? '' : ageS < 20 ? t('live.just_now') : ageS < 90 ? t('live.sec_ago', { n: Math.round(ageS / 5) * 5 }) : t('live.min_ago', { n: Math.round(ageS / 60) })
  const pos = live && live.lat != null && live.lng != null && (live.state === 'live' || live.state === 'stale') ? { lat: live.lat, lng: live.lng } : null
  const group = useMemo(() => pos
    ? { lat: pos.lat, lng: pos.lng, trail: live?.trail ?? [], fresh: live?.state === 'live', walk, label: t('live.group_label', { ago: agoText }) }
    : null, [pos?.lat, pos?.lng, live?.state]) // eslint-disable-line react-hooks/exhaustive-deps
  const mapGuards = useMemo(() => crossings.map((c) => ({ lat: c.lat, lng: c.lng, guarded: c.guarded, label: c.label })), [crossings])
  const mapStops = useMemo(() => stops.slice(1).map((s) => ({ lat: s.lat!, lng: s.lng!, label: s.label })), [stops])

  // What's ahead of the group, by distance along the route.
  const at = pos ? along(route, pos) : null
  const onRoute = !!at && at.off < 400
  const pace = live?.pace_mph || (walk ? 3 : 10)
  const away = (mi: number) => {
    const ahead = mi - (at?.mi ?? 0)
    if (ahead < 0.05) return null
    return { mi: Math.round(ahead * 10) / 10, min: Math.max(1, Math.round((ahead / pace) * 60)) }
  }
  const items = [
    ...stops.slice(1).map((s) => ({ key: `s-${s.id}`, id: s.id, label: s.label, mi: s.miles ?? null, kind: 'stop' as const, guarded: false })),
    ...crossings.map((c) => ({ key: `c-${c.id}`, id: c.id, label: c.label, mi: c.miles ?? null, kind: 'crossing' as const, guarded: c.guarded })),
  ].filter((x) => x.mi != null).sort((a, b) => a.mi! - b.mi!)
  const next = onRoute ? items.find((x) => away(x.mi!)) ?? null : null
  const mine = live?.my_stop && live.my_stop !== 'start' ? stops.find((s) => s.id === live.my_stop) ?? null : null
  const mineAway = mine && onRoute && mine.miles != null ? away(mine.miles) : null
  const awayText = (a: { mi: number; min: number } | null) => a ? `${t('live.away_mi', { mi: a.mi })} · ${t('live.away_min', { min: a.min })}` : t('live.passed')

  const state: LiveState | null = !date ? 'no_date' : live?.state ?? null
  const status = (() => {
    switch (state) {
      case 'live': return { tone: 'good', text: `${t('live.on_move')} · ${t('live.updated', { ago: agoText })}` }
      case 'stale': return { tone: 'warn', text: t('live.stale', { ago: agoText }) }
      case 'waiting': return { tone: 'plain', text: t('live.waiting') }
      case 'later': return { tone: 'plain', text: date?.start_time ? t('live.later', { time: clock(date.start_time, locale), date: dateLong(date.date, locale) }) : t('live.later_notime', { date: date ? dateLong(date.date, locale) : '' }) }
      case 'finished': return { tone: 'plain', text: t('live.finished') }
      case 'silent': return { tone: 'warn', text: t('live.silent') }
      case 'hidden': return { tone: 'plain', text: t('live.hidden') }
      case 'canceled': return { tone: 'warn', text: t('live.canceled') }
      case 'off': return { tone: 'plain', text: t('live.off') }
      case 'members_only': return { tone: 'plain', text: t('live.members_only') }
      case 'no_date': return { tone: 'plain', text: t('live.no_date') }
      default: return null
    }
  })()
  const TONE: Record<string, string> = {
    good: 'bg-[#E6F4EA] text-[#1D5B33]',
    warn: 'bg-[#FFF4D6] text-[#7A4B00]',
    plain: 'bg-(--ev-panel) text-(--ev-ink)',
  }
  // Meet them along the way: works from the plan before or without live sharing.
  const [me, setMe] = useState<LatLng | null>(null)
  const [catchBusy, setCatchBusy] = useState(false)
  const [catchErr, setCatchErr] = useState(false)
  const canCatch = route.length >= 2 && !!state && !['finished', 'canceled', 'members_only', 'no_date'].includes(state)
  const tick30 = Math.floor(now / 30000)
  const spot = useMemo(() => {
    if (!me || !canCatch || !date) return null
    return catchTheGroup({
      route,
      pieces: date.own_route ? null : pieces,
      startLabel: date.meetup_name || ride.meetup_name,
      corners: crossings.map((c) => ({ lat: c.lat!, lng: c.lng!, label: c.label })),
      live: pos ? { ...pos, at: fetchedAt.current - (live?.age_seconds ?? 0) * 1000 } : null,
      startsAt: easternStart(date.date, date.start_time),
      paceMph: pace,
      walk,
      me,
      now: Date.now(),
    })
  }, [me, canCatch, tick30, pos?.lat, pos?.lng, route, pieces, crossings, date, pace]) // eslint-disable-line react-hooks/exhaustive-deps
  const findMe = () => {
    if (!('geolocation' in navigator)) { setCatchErr(true); return }
    setCatchBusy(true)
    setCatchErr(false)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCatchBusy(false)
        setMe({ lat: p.coords.latitude, lng: p.coords.longitude })
        posthog.capture('ride_catch_group', { code: ride.code, surface: 'web', live: !!pos, auto: autoCatch })
      },
      () => { setCatchBusy(false); setCatchErr(true) },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }
  // On a phone the card sits under the map: bring it into view once found.
  const spotCard = useRef<HTMLDivElement>(null)
  const hasSpot = !!spot
  useEffect(() => { if (hasSpot) spotCard.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [hasSpot, me])
  const autoDone = useRef(false)
  useEffect(() => {
    if (!autoCatch || !canCatch || autoDone.current) return
    autoDone.current = true
    findMe()
  }, [autoCatch, canCatch]) // eslint-disable-line react-hooks/exhaustive-deps
  const meet = useMemo(() => spot ? { lat: spot.lat, lng: spot.lng, label: t('live.catch_pin') } : null, [spot?.lat, spot?.lng]) // eslint-disable-line react-hooks/exhaustive-deps
  const meDot = useMemo(() => me ? { ...me, label: t('live.you') } : null, [me]) // eslint-disable-line react-hooks/exhaustive-deps
  const spotTitle = spot
    ? !spot.onStreet ? t('live.catch_title_place', { place: spot.label })
      : spot.label ? t('live.catch_title_street', { street: spot.label })
        : t('live.catch_title_route')
    : ''
  const spotDirections = spot ? `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}&travelmode=${walk ? 'walking' : 'bicycling'}` : null

  const ridePage = withLang(`/rides/${ride.code}${date ? `?date=${date.date}` : ''}`, locale)
  const directions = pos ? `https://www.google.com/maps/dir/?api=1&destination=${pos.lat},${pos.lng}&travelmode=${walk ? 'walking' : 'bicycling'}` : null

  return (
    <EventsToneProvider tone="light">
    <div className={`min-h-[70vh] bg-(--ev-bg) ${toneClass('light')}`}>
    <div className="mx-auto w-full max-w-[880px] px-4 pb-12 pt-6 sm:px-6">
      <a href={ridePage} className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold text-(--ev-ink-75) hover:text-(--ev-ink)">
        <ArrowLeft size={16} aria-hidden /> {t('live.back')}
      </a>
      <h1 className="mt-1 font-display text-[clamp(30px,4.4vw,44px)] font-extrabold leading-[1.05] tracking-tight text-(--ev-ink)">{t('live.title')}</h1>
      <p className="mt-1 text-[16px] text-(--ev-ink-75)">
        {ride.name}{date ? ` · ${dateLong(date.date, locale)}${date.start_time ? ` · ${clock(date.start_time, locale)}` : ''}` : ''}
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) shadow-(--ev-shadow)">
        {status && (
          <div className={`flex items-center gap-2.5 px-4 py-3 text-[15px] font-semibold ${TONE[status.tone]}`} aria-live="polite">
            {state === 'live' && (
              <span className="relative flex h-3 w-3 shrink-0" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2E9F4F] opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[#2E9F4F]" />
              </span>
            )}
            <span>{status.text}</span>
          </div>
        )}
        {failed && <p className="px-4 py-2 text-[14px] text-(--ev-ink-75)">{t('live.error')}</p>}
        {state === 'members_only' ? (
          <div className="p-4">
            <p className="text-[15px] text-(--ev-ink-85)">{t('live.members_only_how')}</p>
            <a href={ridePage} className="mt-3 inline-flex min-h-[44px] items-center rounded-[10px] bg-(--ev-ink) px-4 py-2 text-[15px] font-semibold text-white">{t('live.say_going')}</a>
          </div>
        ) : (route.length >= 2 || meetup) && (
          <div className="h-[56vh] min-h-[320px] sm:h-[480px]">
            <RouteMap line={route} stops={mapStops} guards={mapGuards} meetup={meetup} group={group} meet={meet} me={meDot} pick={false}
              fitKey={meet ? `${meet.lat},${meet.lng}` : 0} className="h-full w-full" label={t('route_map', { name: ride.name })} />
          </div>
        )}

        {(mine || next || directions || canCatch) && (
          <div className="space-y-3 border-t border-(--ev-line) p-4">
            {spot && (
              <div ref={spotCard} className="flex scroll-mb-24 items-start gap-3" aria-live="polite">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-white bg-[#2966E5] text-white shadow" aria-hidden><RouteIcon size={16} /></span>
                <span className="min-w-0 flex-1">
                  {!spot.catchable && <span className="block text-[15px] text-(--ev-ink-85)">{t('live.catch_end')}</span>}
                  <span className="block text-[17px] font-bold leading-snug text-(--ev-ink)">{spotTitle}</span>
                  <span className="block text-[15px] font-semibold text-(--ev-ink)">{t('live.catch_group_at', { time: clock(bostonHm(spot.groupAt), locale) })}</span>
                  <span className="block text-[15px] text-(--ev-ink-85)">{t(walk ? 'live.catch_trip_walk' : 'live.catch_trip_bike', { mi: spot.travelMi, min: spot.travelMin })}</span>
                  {spot.basis === 'plan' && <span className="mt-1 block text-[14px] text-(--ev-ink-75)">{t('live.catch_from_plan')}</span>}
                </span>
              </div>
            )}
            {catchErr && <p className="text-[15px] text-(--ev-ink-85)" role="alert">{t('live.catch_no_location')}</p>}
            {mine && (
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-(--ev-ink-75)">{t('live.your_stop')}</span>
                  <span className="block text-[17px] font-bold text-(--ev-ink)">{mine.label}</span>
                </span>
                {onRoute && <span className="text-[16px] font-semibold text-(--ev-ink) sm:shrink-0 sm:text-right">{awayText(mineAway)}</span>}
              </div>
            )}
            {next && next.id !== mine?.id && (
              <div className="flex items-start gap-3">
                {next.kind === 'crossing'
                  ? <span className="inline-flex shrink-0" aria-hidden dangerouslySetInnerHTML={{ __html: guardSignSvg(next.guarded, 24) }} />
                  : <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-white bg-[#2966E5] text-[12px] font-bold text-white shadow" aria-hidden>{stops.findIndex((s) => s.id === next.id)}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-(--ev-ink-75)">{t('live.next')} · {t(next.kind === 'crossing' ? 'live.kind_crossing' : 'live.kind_stop')}</span>
                  <span className="block text-[16px] font-semibold leading-snug text-(--ev-ink)">{next.label}</span>
                  <span className="block text-[15px] text-(--ev-ink-85)">{awayText(away(next.mi!))}</span>
                </span>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {spotDirections ? (
                <a href={spotDirections} target="_blank" rel="noopener noreferrer"
                  onClick={() => posthog.capture('ride_catch_group_directions', { code: ride.code, surface: 'web', basis: spot?.basis })}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[12px] bg-(--ev-ink) px-4 py-3 text-[16px] font-semibold text-white sm:w-auto">
                  <Navigation size={17} aria-hidden /> {t('live.catch_directions')}
                </a>
              ) : directions && (
                <a href={directions} target="_blank" rel="noopener noreferrer"
                  onClick={() => posthog.capture('ride_live_web_directions', { code: ride.code })}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[12px] bg-(--ev-ink) px-4 py-3 text-[16px] font-semibold text-white sm:w-auto">
                  <Navigation size={17} aria-hidden /> {t('live.directions')}
                </a>
              )}
              {canCatch && !spot && (
                <button type="button" onClick={findMe} disabled={catchBusy}
                  className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[12px] px-4 py-3 text-[16px] font-semibold sm:w-auto ${directions ? 'border-2 border-(--ev-ink) text-(--ev-ink)' : 'bg-(--ev-ink) text-white'} disabled:opacity-70`}>
                  <RouteIcon size={17} aria-hidden /> {catchBusy ? t('live.catch_looking') : t('live.catch_button')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {(state === 'live' || state === 'stale' || state === 'waiting') && (
        <p className="mt-3 text-[14px] text-(--ev-ink-75)">{t('live.refresh_note')}</p>
      )}
    </div>
    </div>
    </EventsToneProvider>
  )
}
