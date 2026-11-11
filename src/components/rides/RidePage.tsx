'use client'

import { useEffect, useMemo, useState } from 'react'
import posthog from 'posthog-js'
import { Bike, Calendar, Check, CloudSun, Download, ExternalLink, Footprints, MapPin, Megaphone, MessageCircle, Radio, Route as RouteIcon, Share2, Users } from 'lucide-react'
import type { CalmSegment } from '@/components/commute/calm-route'
import EventMap from '@/components/events/EventMap'
import RouteMap from '@/components/organizers/RouteMap'
import { guardSignSvg } from '@/lib/rides/guard-sign'
import { buildIcs, calendarLocation, gcalUrl as eventGcalUrl } from '@/lib/event-calendar'
import { routeMiles } from '@/lib/organizers/route-geo'
import { todayKey } from '@/lib/organizers/ride-words'
import RideStoreBadges from '@/components/rides/RideStoreBadges'
import OrganizerChannels from '@/components/rides/OrganizerChannels'
import RideFacts, { rideFacts } from '@/components/rides/RideFacts'
import RidePerks from '@/components/rides/RidePerks'
import RideCoffee, { type RideCoffeeInfo } from '@/components/rides/RideCoffee'
import RideNewInfra from '@/components/rides/RideNewInfra'
import RidePhotos from '@/components/rides/RidePhotos'
import type { AlbumResponse } from '@/app/events/[id]/photos/photo-api'
import { hasNewInfra, newInfraKey, type NewInfraFor } from '@/lib/new-infra'
import { perksAlong, type BikePerk } from '@/lib/bike-perks'
import type { RideHost } from '@/lib/rides/host'
import { EventsToneProvider, toneClass } from '@/components/events/EventsTone'
import {
  FUNCTIONS_BASE,
  ago,
  clock,
  dateLong,
  dateShort,
  dateStatusLine,
  dayShort,
  everyLabel,
  scheduleText,
  type HelperJob,
  type PublicRide,
  type RideChat,
  type RideDate,
  type RideStop,
  type RsvpStatus,
} from '@/lib/rides/public'
import '@/components/events/events-tone.css'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { ridesStrings, type RideKey } from '@/lib/site-strings/rides'

const ANSWERS: { value: RsvpStatus; label: RideKey }[] = [
  { value: 'going', label: 'ans.going' },
  { value: 'maybe', label: 'ans.maybe' },
  { value: 'not_going', label: 'ans.not' },
]

const TONE_STYLE: Record<'good' | 'warn' | 'off' | 'plain', string> = {
  good: 'bg-(--ev-accent-tint-15) text-(--ev-accent)',
  warn: 'bg-[#FFF4D6] text-[#7A4B00]',
  off: 'bg-[#FBE4DF] text-(--ev-danger)',
  plain: 'bg-(--ev-panel) text-(--ev-ink-80)',
}

/** What this browser remembers so a second date is one tap. Per-viewer only. */
interface Remembered {
  first_name: string
  last_name: string
  email: string
  answers: Record<string, RsvpStatus>
  /** Where they join each ride, by ride code (a stop id; Shift 01744). */
  stops?: Record<string, string>
}
const STORE_KEY = 'shift-ride-guest'

function readRemembered(): Remembered {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return { answers: {}, first_name: '', last_name: '', email: '', ...JSON.parse(raw) }
  } catch { /* private mode */ }
  return { first_name: '', last_name: '', email: '', answers: {} }
}

function writeRemembered(r: Remembered) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(r)) } catch { /* private mode */ }
}

function directionsUrl(d: Pick<RideDate, 'meetup_lat' | 'meetup_lng'>): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${d.meetup_lat},${d.meetup_lng}`
}

/**
 * One date as a calendar entry that holds everything someone needs on the day
 * (Keith 2026-11-06): where to say you're coming, directions to the start,
 * the route's facts, who hosts it, the organizer's own sign-up, and what it
 * is. The location field carries the meeting spot; the link goes back to this
 * date on the ride page.
 */
function calendarEvent(ride: PublicRide, d: RideDate, hostName: string | null, miles: number | null, climb: number | null, locale: SiteLocale) {
  const t = translator(ridesStrings, locale)
  const walk = ride.activity === 'walk'
  // Back to this date, in the language they read it in.
  const page = `${pageUrl(ride)}?date=${d.date}${locale === 'en' ? '' : `&lang=${locale}`}`
  const where = calendarLocation(d.meetup_name, d.meetup_address)
  const facts = rideFacts(ride, miles, climb, locale)
  const factLine = [
    ...facts.stats.map((f) => (f.key === 'pace' && f.sub ? `${f.value} (${f.sub})` : f.value)),
    ...facts.policies.map((p) => p.title),
  ].join(' · ')
  const about = (d.description || ride.description || '').trim()
  const notes = [
    // "Keith A." already ends the sentence.
    (hostName ? t('cal.kind_hosted', { kind: t(walk ? 'kind.walk' : 'kind.ride'), host: hostName }) : t(walk ? 'kind.walk' : 'kind.ride'))
      .replace(/([^.。])$/, locale === 'zh-Hans' ? '$1。' : '$1.'),
    t('cal.say_coming', { url: page }),
    ride.registration_url ? t('cal.signup', { url: ride.registration_url }) : null,
    [
      where ? t('cal.meet', { where }) : null,
      d.meetup_lat != null && d.meetup_lng != null ? t('cal.directions', { url: directionsUrl(d) }) : null,
      factLine ? t(walk ? 'cal.the_walk' : 'cal.the_ride', { facts: factLine }) : null,
    ].filter(Boolean).join('\n'),
    about || null,
    t('cal.changes', { url: page }),
  ].filter(Boolean).join('\n\n')
  return {
    id: `${ride.code}-${d.date}`, slug: null, title: d.title || ride.name, body: about,
    event_date: d.date, event_time: d.start_time, event_end_time: d.end_time,
    location_name: d.meetup_name, location_address: d.meetup_address, location_lat: d.meetup_lat, location_lng: d.meetup_lng,
    organizer_name: hostName, organizer_url: null,
    // Back to this date on the ride page, where people answer.
    event_url: page, registration_url: ride.registration_url, tags: ride.tags ?? [],
    notes,
  } as unknown as Parameters<typeof buildIcs>[0]
}

/** The ride's own link, without the ?via= a promo link arrived with. */
function pageUrl(ride: PublicRide): string {
  return `https://www.gogreenstreets.org/rides/${ride.code}`
}

function downloadIcs(ev: Parameters<typeof buildIcs>[0], name: string, date: string) {
  const blob = new Blob([buildIcs(ev)], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${name.replace(/[^\w-]+/g, '-').slice(0, 40)}-${date}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const xmlText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The route as drawn on the map, as a GPX track a bike computer or a ride app can load. */
function downloadGpx(ride: PublicRide, line: { lat: number; lng: number }[], date: string | null) {
  const name = xmlText(ride.name)
  const pts = line.map((p) => `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"/>`).join('')
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Shift by Green Streets Initiative" xmlns="http://www.topografix.com/GPX/1/1">`
    + `<metadata><name>${name}</name><link href="${pageUrl(ride)}"/></metadata><trk><name>${name}</name><trkseg>${pts}</trkseg></trk></gpx>\n`
  const blob = new Blob([gpx], { type: 'application/gpx+xml' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${ride.name.replace(/[^\w-]+/g, '-').slice(0, 40)}${date ? `-${date}` : ''}.gpx`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** The ride as someone joining at a stop sees it: their stop is their meeting point, at the group's time there. */
function atStop(d: RideDate, stop: RideStop | null): RideDate {
  if (!stop || stop.id === 'start' || stop.lat == null || stop.lng == null) return d
  return { ...d, meetup_name: stop.label, meetup_address: null, meetup_lat: stop.lat, meetup_lng: stop.lng, start_time: stop.time ? `${stop.time}:00` : d.start_time }
}

/** A stop's number on the map (the start is the meeting pin), as a small badge beside its name. */
function StopBadge({ n }: { n: number }) {
  if (n === 0) {
    return <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#191A2E] text-white"><MapPin size={13} /></span>
  }
  return <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-white bg-[#2966E5] text-[12px] font-bold text-white shadow-[0_1px_4px_rgba(0,0,0,.3)]">{n}</span>
}

const JOBS: HelperJob[] = ['front', 'sweep', 'corner']

/** What ride-guest-rsvp hands back after a Going, for the one-tap "Can you help?" (Shift 01745). */
interface AfterHelp {
  open: Record<HelperJob, number>
  walk: boolean
  pick: { m: string; o: string; k: string }
}

/** A crossing guard's stop paddle, as on the map: red once someone has the crossing. */
function GuardSign({ guarded, size = 24 }: { guarded: boolean; size?: number }) {
  return <span className="inline-flex shrink-0" aria-hidden dangerouslySetInnerHTML={{ __html: guardSignSvg(guarded, size) }} />
}

export default function RidePage({ ride, host = null, hostPerson = null, ascentFt = null, comfort = null, initialDate = null, perks = [], newInfra = [], coffee = null, photos = null, locale = 'en' }: {
  ride: PublicRide; host?: RideHost | null; ascentFt?: number | null
  /** The page's language (?lang= from the app, else the browser's). */
  locale?: SiteLocale
  /** The ride's own route, street by street, for the calm-streets bar. */
  comfort?: CalmSegment[] | null
  /** Who hosts it when there's no verified organization: the organizer's profile name (hostLabel). */
  hostPerson?: string | null
  /** A date the visitor came for (?date=YYYY-MM-DD from a calendar listing). */
  initialDate?: string | null
  /** Bicycle Benefits members by any of the ride's meeting spots or routes. */
  perks?: BikePerk[]
  /** What's new on each of its routes, or by each meeting spot (newInfraForPlaces). */
  newInfra?: NewInfraFor[]
  /** Where it ends and who buys the coffee there (get_ride_coffee). */
  coffee?: RideCoffeeInfo | null
  /** The newest date's shared photos, when the server hands them over (the event_photos switch). */
  photos?: { album: AlbumResponse; href: string; albumRef: { ride: string; date: string }; preview: string } | null
}) {
  const t = translator(ridesStrings, locale)
  const hostHref = host?.href ?? null
  // The organization only once verified (Shift 01563, rideExtras); a typed-in
  // name could be anyone's, so it isn't shown, as on the events calendar.
  // Without one, the organizer by their profile name, so the page always says who hosts it.
  const hostName = host?.name ?? hostPerson ?? null
  const open = ride.occurrences.filter((d) => d.status === 'scheduled')
  // A link to one date opens that date; if it isn't open, say so and pick
  // nothing rather than quietly answering for another date.
  const linkedMissing = !!initialDate && !ride.occurrences.some((d) => d.date === initialDate)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialDate ? (ride.occurrences.find((d) => d.date === initialDate)?.id ?? null) : (open[0]?.id ?? ride.occurrences[0]?.id ?? null))
  const selected = ride.occurrences.find((d) => d.id === selectedId) ?? null
  const [counts, setCounts] = useState<Record<string, { going: number; maybe: number }>>(() =>
    Object.fromEntries(ride.occurrences.map((d) => [d.id, { going: d.going, maybe: d.maybe }])),
  )

  const [me, setMe] = useState<Remembered>({ first_name: '', last_name: '', email: '', answers: {} })
  useEffect(() => setMe(readRemembered()), [])

  const [choice, setChoice] = useState<RsvpStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // `emailed` is the server's word on whether a confirmation went out (null
  // when it doesn't say), so the page never claims an email nobody sent.
  const [done, setDone] = useState<{ status: RsvpStatus; first: string; emailed: boolean | null; every: string | null; chat: RideChat | null; chatWaiting: boolean; stop: RideStop | null; job: HelperJob | null; jobTaken: boolean; help: AfterHelp | null; spot: { label: string; time: string | null } | null } | null>(null)
  // The one-tap "Can you help?" after Going (Shift 01745): saving, and a job taken first.
  const [helpBusy, setHelpBusy] = useState<HelperJob | null>(null)
  const [helpTaken, setHelpTaken] = useState(false)
  // "Count me in every Saturday" (Shift 01598): Going on every date of a
  // repeating ride, including dates that open later.
  const [every, setEvery] = useState(false)
  const [copied, setCopied] = useState(false)
  // Where they'll join (Shift 01744), asked with Going or Maybe.
  const [stopPick, setStopPick] = useState('start')

  // The forecast for the chosen date, once it's within the weather service's week.
  const [forecast, setForecast] = useState<{ id: string; line: string } | null>(null)
  useEffect(() => {
    if (!selected || selected.status !== 'scheduled' || selected.meetup_lat == null || selected.meetup_lng == null || !selected.start_time) return
    const days = (new Date(`${selected.date}T12:00:00Z`).getTime() - Date.now()) / 864e5
    if (days < -1 || days > 6.5) return
    let live = true
    const q = new URLSearchParams({ lat: String(selected.meetup_lat), lng: String(selected.meetup_lng), date: selected.date, start: selected.start_time })
    fetch(`/api/rides/forecast?${q}`).then((r) => r.json()).then((d: { line?: string | null }) => {
      if (live && d.line) setForecast({ id: selected.id, line: d.line })
    }).catch(() => {})
    return () => { live = false }
  }, [selected])

  const myAnswer = selected ? me.answers[selected.id] : undefined
  const ended = ride.status === 'archived'
  const walk = ride.activity === 'walk'
  const noun = walk ? 'walk' : 'ride'
  const nk = <K extends string>(base: K) => `${base}.${noun}` as RideKey
  // A break ends on its own when its date comes: the banner goes with it.
  const paused = ride.status === 'paused' || (!!ride.break_until && ride.break_until > todayKey())

  // The chosen date's join stops, in route order; the first is the start.
  const stops = useMemo(() => (selected?.stops ?? []).filter((s) => s.lat != null && s.lng != null), [selected])
  const hasStops = stops.length > 1
  const mapStops = useMemo(() => stops.slice(1).map((s) => ({ lat: s.lat!, lng: s.lng!, label: s.label })), [stops])
  // Busy crossings with a crossing guard, or needing one (Shift 01745): on the map and under it.
  // The crossing this visitor just took reads as guarded straight away.
  const [tookCrossing, setTookCrossing] = useState<string | null>(null)
  const crossings = useMemo(() => (selected?.help?.crossings ?? []).filter((c) => c.lat != null && c.lng != null)
    .map((c) => (c.label === tookCrossing ? { ...c, guarded: true } : c)), [selected, tookCrossing])
  const mapGuards = useMemo(() => crossings.map((c) => ({ lat: c.lat, lng: c.lng, guarded: c.guarded, label: `${c.label}: ${c.guarded ? t('crossings.guarded') : t('crossings.needed')}` })), [crossings]) // eslint-disable-line react-hooks/exhaustive-deps
  // "Start · 10 AM" or "about 10:15 AM · 2.5 mi in".
  const stopWhen = (s: RideStop, i: number) => i === 0
    ? [t('stops.start'), s.time ? clock(`${s.time}:00`, locale) : null].filter(Boolean).join(' · ')
    : [s.time ? t('stops.about', { time: clock(`${s.time}:00`, locale) }) : null, s.miles != null ? t('stops.miles_in', { mi: s.miles }) : null].filter(Boolean).join(' · ')
  // Where this browser said it joins this ride, if that stop is on this date.
  const rememberedStop = stops.find((s) => s.id === me.stops?.[ride.code]) ?? null

  // A new date resets the form to that date's own answer.
  useEffect(() => { setDone(null); setError(null); setChoice(null); setEvery(false); setHelpTaken(false); setTookCrossing(null) }, [selectedId])
  useEffect(() => { setStopPick(rememberedStop?.id ?? 'start') }, [selectedId, rememberedStop?.id])

  const share = async () => {
    // The ride's own link: a promo link's ?via= stays with the first visitor.
    const url = pageUrl(ride)
    posthog.capture('ride_page_share', { code: ride.code })
    if (navigator.share) {
      try { await navigator.share({ title: ride.name, url }) } catch { /* cancelled */ }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2400)
    } catch {
      window.prompt(t('copy_prompt'), url)
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selected || !choice) return
    const form = new FormData(e.currentTarget)
    const first_name = String(form.get('first_name') ?? '').trim()
    const last_name = String(form.get('last_name') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/ride-guest-rsvp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code: ride.code,
          occurrence_id: selected.id,
          status: choice,
          first_name,
          last_name,
          email,
          website: String(form.get('website') ?? ''),
          // The Promote tab's short link they came in on, if any.
          via: new URLSearchParams(window.location.search).get('via') ?? undefined,
          every: choice === 'going' && every && !!everyText,
          // Where they'll join (Shift 01744).
          stop: hasStops && choice !== 'not_going' ? stopPick : undefined,
          // Came from the organizer's "Can you help?" post: ask them too (Shift 01745).
          offer_help: new URLSearchParams(window.location.search).get('help') === '1' || undefined,
          // The confirmation email follows the page language (translation plan, batch 7).
          locale,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // The server's message is English; other languages get the plain retry line.
        setError(locale === 'en' && data.error ? data.error : t('error'))
        return
      }
      const answers = { ...me.answers, [selected.id]: choice }
      // Every date: the open dates they haven't answered read as Going here too.
      if (data.every_date) for (const d of open) if (!answers[d.id]) answers[d.id] = 'going'
      const pickedStop = hasStops && choice !== 'not_going' ? (data.stop ?? stopPick) : null
      const next: Remembered = { first_name, last_name, email, answers, stops: { ...(me.stops ?? {}), ...(pickedStop ? { [ride.code]: pickedStop } : {}) } }
      writeRemembered(next)
      setMe(next)
      if (typeof data.going === 'number') {
        setCounts((c) => ({ ...c, [selected.id]: { going: data.going, maybe: data.maybe ?? 0 } }))
      }
      setDone({
        status: choice, first: data.first_name ?? first_name, emailed: typeof data.emailed === 'boolean' ? data.emailed : null,
        every: data.every_date && choice === 'going' && every ? (data.every ?? everyText) : null,
        chat: data.chat?.url ? data.chat : null,
        // The ride has a group chat and the organizer lets people in one by one (Shift 01679).
        chatWaiting: !data.chat?.url && data.chat_waiting === true,
        stop: pickedStop && pickedStop !== 'start' ? (stops.find((s) => s.id === pickedStop) ?? null) : null,
        job: data.job ?? null,
        jobTaken: data.job_taken === true,
        // Asked only of people who've ridden before, go every date or lead (Shift 01745).
        help: data.help?.pick ? data.help : null,
        spot: null,
      })
      setHelpTaken(false)
      setChoice(null)
      posthog.capture('ride_rsvp_submitted', { code: ride.code, status: choice, surface: 'web', every: choice === 'going' && every, stop: pickedStop && pickedStop !== 'start' ? 'along' : hasStops ? 'start' : null, job: data.job ?? null })
    } catch {
      setError(t('error'))
    } finally {
      setBusy(false)
    }
  }

  // "Can you help?" after Going: one tap takes the job (Shift 01745).
  async function takeJob(j: HelperJob) {
    if (!done?.help || helpBusy) return
    setHelpBusy(j)
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/ride-guest-rsvp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'help', pick: done.help.pick, job: j }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(t('error')); return }
      setHelpTaken(data.job_taken === true)
      setTookCrossing(data.job === 'corner' ? (data.spot?.label ?? null) : null)
      setDone((d) => d && ({
        ...d,
        job: data.job ?? null,
        spot: data.spot ?? null,
        help: d.help && data.open ? { ...d.help, open: data.open } : d.help,
      }))
      posthog.capture('ride_helper_offered', { code: ride.code, job: j, taken: data.job_taken === true, surface: 'web' })
    } catch {
      setError(t('error'))
    } finally {
      setHelpBusy(null)
    }
  }

  // A notice the organizer has since undone (a date brought back, a break
  // ended early) would tell visitors the opposite of what's true: leave it out.
  const current = useMemo(() => ride.updates.filter((u) =>
    !(u.kind === 'canceled' && ride.occurrences.some((d) => d.id === u.occurrence_id && d.status === 'scheduled'))
    && !(u.kind === 'break' && !paused)), [ride.updates, ride.occurrences, paused])
  const updates = useMemo(() => current.slice(0, 6), [current])
  const latestFor = (occId: string) => current.find((u) => u.occurrence_id === occId)
  // A repeating ride reads as its pattern up top. The chosen date itself, with
  // its own time and meeting spot, lives once, in the card under the title,
  // so the date isn't said three times before the Going button.
  const repeats = !ride.ride_date && ((ride.days ?? []).length > 0 || ride.frequency === 'daily')
  const headerSchedule = repeats ? scheduleText(ride, locale) : null
  // Offered with Going when there's more than one date to say yes to.
  const everyText = repeats && open.length > 1 ? everyLabel(ride, locale) : null
  const pastOneOff = !!ride.ride_date && ride.ride_date < todayKey()
  // Most groups ride somewhere new each time (Shift 01432): the chosen date's
  // own route, name, description and flyer, else the ride's.
  const own = selected?.own_route && selected.route ? selected.route : null
  const route = ((own ? own.route_waypoints : ride.route_waypoints) ?? []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
  const miles = route.length >= 2 ? routeMiles(route) : null
  const climb = own ? (typeof own.route_elevation?.ascent_ft === 'number' ? Math.round(own.route_elevation.ascent_ft) : null) : ascentFt
  // The chosen date as a calendar entry (calendarEvent): offered before and after answering.
  // From their own stop, at the group's time there, once they've picked one.
  const myStop = done?.stop ?? (done ? null : rememberedStop)
  const calEv = selected ? calendarEvent(ride, atStop(selected, myStop), hostName, miles, climb, locale) : null
  const routeLink = own ? own.route_google_maps_url : ride.route_google_maps_url
  const dateTitle = selected?.title ?? null
  const about = selected?.description || ride.description
  const flyer = selected?.flyer_url || ride.flyer_url
  // Where to meet: the chosen date's spot, else the ride's own (a ride between
  // seasons still shows its route and meeting point).
  const place: Pick<RideDate, 'meetup_lat' | 'meetup_lng' | 'meetup_name' | 'meetup_address'> | null =
    selected ?? ride.occurrences[0] ?? (ride.meetup_lat != null && ride.meetup_lng != null
      ? { meetup_lat: ride.meetup_lat, meetup_lng: ride.meetup_lng, meetup_name: ride.meetup_name, meetup_address: ride.meetup_address }
      : null)
  const hasMap = place?.meetup_lat != null && place?.meetup_lng != null
  // The ones within a block of this date's meeting spot or route.
  const perkStops = perksAlong(perks, route, hasMap ? { lat: place!.meetup_lat!, lng: place!.meetup_lng! } : null)
  // New this season on this date's route, else by its meeting spot.
  const newKey = newInfraKey(route, hasMap ? { lat: place!.meetup_lat!, lng: place!.meetup_lng! } : null)
  const newHere = newInfra.find((n) => n.key === newKey)?.info

  const updatesCount = updates.length
  const alongAny = !!coffee?.shop || hasNewInfra(newHere) || (!walk && perkStops.length > 0) || route.length >= 2 || !!(routeLink && /^https?:\/\//.test(routeLink))
  const hostAny = !!hostName
  const aboutAny = !!about || !!flyer || !!ride.registration_url
  const TABS = ([
    aboutAny ? { id: 'about', label: t(nk('tab.about')) } : null,
    { id: 'updates', label: t('tab.updates'), count: updatesCount },
    alongAny ? { id: 'along', label: route.length < 2 ? t('tab.near_start') : t(nk('tab.along')) } : null,
    hostAny ? { id: 'host', label: t('tab.host') } : null,
  ].filter(Boolean)) as { id: TabId; label: string; count?: number }[]
  // A fresh update (the last three days) opens first; otherwise what it's about.
  const freshUpdate = updates[0] && Date.now() - new Date(updates[0].created_at).getTime() < 3 * 864e5
  const [tab, setTab] = useState<TabId>(freshUpdate || !aboutAny ? 'updates' : 'about')
  const shownTab = TABS.some((t) => t.id === tab) ? tab : TABS[0].id
  // The calm-streets bar is the ride's own route's; a date with its own route has none yet.
  const comfortHere = own ? null : comfort

  return (
    <EventsToneProvider tone="light">
    <div className={`min-h-screen bg-(--ev-bg) px-4 pb-24 pt-6 sm:px-8 sm:pt-10 ${toneClass('light')}`}>
      <div className="mx-auto max-w-[1100px]">
        {/* ---- Header: who hosts it, with a face, then the name and when/where ---- */}
        <div className="flex items-center gap-3">
          <HostFace name={hostName} logo={host?.logo_url ?? null} walk={walk} />
          <p className="min-w-0 text-[15px] leading-snug text-(--ev-ink-80)">
            <span className="block font-semibold text-(--ev-accent)">{t(walk ? 'kind.walk' : 'kind.ride')}</span>
            {hostName && (
              <span className="block">
                {t('hosted_by')}{' '}
                {hostHref
                  ? <a href={hostHref} className="font-semibold text-(--ev-ink) hover:underline">{hostName}</a>
                  : <span className="font-semibold text-(--ev-ink)">{hostName}</span>}
              </span>
            )}
          </p>
        </div>
        <h1 className="mt-3 font-display text-[clamp(30px,4.4vw,48px)] font-extrabold leading-[1.05] tracking-tight text-(--ev-ink)">
          {ride.name}
        </h1>
        {/* The pattern for a repeating ride; the date itself, the place and the facts each show once, below. */}
        <ul className="mt-3 flex flex-wrap gap-2 empty:hidden">
          {headerSchedule && (
            <li className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-white px-3.5 text-[15px] font-semibold text-(--ev-ink) shadow-[inset_0_0_0_1px_var(--ev-line-mid)]">
              <Calendar size={16} className="text-(--ev-ink-75)" aria-hidden />{headerSchedule}
            </li>
          )}
        </ul>

        {(ended || paused) && (
          <div className={`mt-6 rounded-2xl px-5 py-4 ${ended ? TONE_STYLE.off : TONE_STYLE.warn}`}>
            <p className="text-[15px] font-semibold">
              {ended ? t(nk('ended')) : ride.break_until ? t('break_until', { date: dateLong(ride.break_until, locale) }) : t('break')}
            </p>
            {ride.stopped_note && <p className="mt-1 text-[14px]">&ldquo;{ride.stopped_note}&rdquo;</p>}
          </div>
        )}

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
          {/* ---- RSVP card: right under the title on phones, so the date,
               where to meet and Going / Maybe / Can't go are the first
               screen; the right column on desktop ---- */}
          <aside id="going" className="scroll-mt-24 lg:col-start-2 lg:row-start-1">
            <div className="rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-5 shadow-(--ev-shadow) lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-contain">
              {ride.occurrences.length === 0 ? (
                <div>
                  <p className="text-[16px] font-bold text-(--ev-ink)">
                    {ended ? t('no_more_dates') : pastOneOff ? t(nk('happened')) : paused && ride.break_until ? t('back_on', { date: dateLong(ride.break_until, locale) }) : t('no_dates_yet')}
                  </p>
                  <p className="mt-1 text-[15px] text-(--ev-ink-80)">
                    {ended || pastOneOff
                      ? <>{t('see_else')} <a href={hostHref ?? withLang(walk ? '/events?type=walking_tour' : '/events?type=group_ride', locale)} className="font-semibold text-(--ev-accent) hover:underline">{hostHref && hostName ? t(walk ? 'more_walks_from' : 'more_rides_from', { host: hostName }) : t(walk ? 'walks_on_cal' : 'rides_on_cal')}</a>{locale === 'zh-Hans' ? '。' : '.'}</>
                      : paused ? t('after_break') : t('check_back')}
                  </p>
                </div>
              ) : (
                <>
                  {linkedMissing && !selectedId && (
                    <p className="mb-3 text-[15px] text-(--ev-ink-85)">{t('not_open', { date: dateLong(initialDate!, locale) })}</p>
                  )}
                  {ride.occurrences.length > 1 && (<>
                  <p className="text-[14px] font-semibold text-(--ev-ink-75)">{t('pick_date')}</p>
                  <div className="-mx-1 mt-2 mb-6 flex gap-2 overflow-x-auto px-1 pb-2" role="group" aria-label={t('dates_aria')}>
                    {ride.occurrences.map((d) => {
                      const active = d.id === selectedId
                      const answered = me.answers[d.id]
                      return (
                        <button
                          key={d.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelectedId(d.id)}
                          className={`flex min-w-[76px] shrink-0 flex-col items-center rounded-xl border px-3 py-2 transition-colors ${
                            active ? 'border-(--ev-ink) bg-(--ev-ink) text-white' : 'border-(--ev-line-mid) text-(--ev-ink) hover:border-(--ev-line-stronger)'
                          } ${d.status === 'canceled' ? 'opacity-70' : ''}`}
                        >
                          <span className={`text-[13px] font-semibold ${active ? 'text-white/85' : 'text-(--ev-ink-75)'}`}>{dayShort(d.date, locale)}</span>
                          <span className="text-[15px] font-bold">{dateShort(d.date, locale)}</span>
                          <span className={`mt-0.5 text-[13px] ${active ? 'text-white/85' : 'text-(--ev-ink-75)'}`}>
                            {d.status === 'canceled' ? t('chip.off') : answered === 'going' ? t('chip.in') : answered === 'maybe' ? t('chip.maybe') : (counts[d.id]?.going ?? 0) > 0 ? t('chip.going', { n: counts[d.id].going }) : clock(d.start_time, locale) || t('chip.open')}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  </>)}

                  {selected && (
                    <>
                      {(() => {
                        const s = dateStatusLine(ride, selected, locale)
                        const latest = latestFor(selected.id)
                        // "Scheduled" says nothing the date line doesn't; any other state shows.
                        // The note is clamped so the RSVP stays on a phone's first screen; the
                        // full text is under "Latest from the organizer".
                        if (s.tone === 'plain' && !latest?.note) return null
                        return (
                          <div className={`mb-3 rounded-xl px-3 py-2 ${TONE_STYLE[s.tone]}`}>
                            {s.tone !== 'plain' && (
                              <p className="flex items-center gap-2 text-[14px] font-semibold">
                                {s.tone === 'good' && selected.live ? <Radio size={15} /> : s.tone === 'good' ? <Check size={15} /> : null}
                                {s.text}
                              </p>
                            )}
                            {/* The group is sharing where it is (Shift 01747): follow it without the app. */}
                            {selected.live && ride.live_sharing !== 'link' && (
                              <p className="mt-1 text-[14px] font-medium">{t('live.from_email')}</p>
                            )}
                            {selected.live && ride.live_sharing === 'link' && (
                              <a href={withLang(`/rides/${ride.code}/live?date=${selected.date}`, locale)}
                                className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] bg-(--ev-ink) px-4 py-2 text-[15px] font-semibold text-white">
                                <Radio size={15} aria-hidden /> {t('live.see')}
                              </a>
                            )}
                            {latest?.note && (
                              <p className={`${s.tone !== 'plain' ? 'mt-1 ' : ''}line-clamp-2 text-[14px] font-medium`}>&ldquo;{latest.note}&rdquo; <span className="opacity-80">· {ago(latest.created_at, Date.now(), locale)}</span></p>
                            )}
                          </div>
                        )
                      })()}

                      {/* The chosen date's own name (Shift 01432), for someone who came from that date's listing. */}
                      {dateTitle && <p className="text-[17px] font-bold leading-snug text-(--ev-ink)">{dateTitle}</p>}
                      <div className={`${dateTitle ? 'mt-2' : ''} space-y-2 text-[15px] text-(--ev-ink-85)`}>
                        <p className="flex gap-2 font-semibold text-(--ev-ink)">
                          <Calendar size={17} className="mt-0.5 shrink-0 text-(--ev-ink-60)" />
                          <span>{dateLong(selected.date, locale)}{selected.start_time ? ` · ${selected.end_time ? t('time_range', { start: clock(selected.start_time, locale), end: clock(selected.end_time, locale) }) : clock(selected.start_time, locale)}` : ''}</span>
                        </p>
                        {(selected.meetup_name || selected.meetup_address) && (
                          <p className="flex gap-2"><MapPin size={17} className="mt-0.5 shrink-0 text-(--ev-ink-60)" />{selected.meetup_name || selected.meetup_address}</p>
                        )}
                        {forecast?.id === selected.id && (
                          <p className="flex gap-2"><CloudSun size={17} className="mt-0.5 shrink-0 text-(--ev-ink-60)" />{forecast.line}</p>
                        )}
                        <p className="flex gap-2">
                          <Users size={17} className="mt-0.5 shrink-0 text-(--ev-ink-60)" />
                          {(counts[selected.id]?.going ?? 0) === 0 && (counts[selected.id]?.maybe ?? 0) === 0
                            ? t('be_first')
                            : (counts[selected.id]?.maybe ?? 0) > 0
                              ? t('counts_maybe', { going: counts[selected.id]?.going ?? 0, maybe: counts[selected.id].maybe })
                              : t('counts', { going: counts[selected.id]?.going ?? 0 })}
                        </p>
                        {/* Save it before answering too (Keith 2026-11-06); after answering, the buttons sit with the confirmation. */}
                        {calEv && selected.status === 'scheduled' && !ended && !done && (
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Download size={17} className="shrink-0 text-(--ev-ink-60)" />
                            <span>{t('add_cal')}</span>
                            <a href={eventGcalUrl(calEv)} target="_blank" rel="noopener noreferrer"
                              onClick={() => posthog.capture('ride_calendar_saved', { code: ride.code, app: 'google', answered: false })}
                              className="font-semibold text-(--ev-accent) hover:underline">Google</a>
                            <span aria-hidden className="text-(--ev-ink-60)">·</span>
                            <button type="button"
                              onClick={() => { posthog.capture('ride_calendar_saved', { code: ride.code, app: 'ics', answered: false }); downloadIcs(calEv, ride.name, selected.date) }}
                              className="font-semibold text-(--ev-accent) hover:underline">{t('apple_outlook')}</button>
                          </p>
                        )}
                      </div>


                      {selected.status === 'scheduled' && !ended && (
                        <div className="mt-5 border-t border-(--ev-line) pt-5">
                          {done ? (
                            <div aria-live="polite">
                              <p className="text-[17px] font-bold text-(--ev-ink)">
                                {done.every ? t('done.every', { every: done.every, first: done.first }) : done.status === 'going' ? t('done.going', { first: done.first }) : done.status === 'maybe' ? t('done.maybe', { first: done.first }) : t('done.not', { first: done.first })}
                              </p>
                              {done.status !== 'not_going' && (
                                <p className="mt-1 text-[15px] text-(--ev-ink-80)">
                                  {done.emailed ? <>{t('done.emailed')} </> : null}
                                  {done.every ? t('done.every_body') : done.status === 'maybe' ? t('done.maybe_body') : t('done.going_body')}
                                </p>
                              )}
                              {(done.stop || done.job) && done.status !== 'not_going' && (
                                <div className="mt-3 space-y-1 rounded-[10px] bg-(--ev-panel) px-3 py-2.5 text-[15px] text-(--ev-ink-85)">
                                  {done.stop && <p>{done.stop.time ? t('done.stop', { stop: done.stop.label, time: clock(`${done.stop.time}:00`, locale) }) : t('done.stop_notime', { stop: done.stop.label })}</p>}
                                  {done.job && (
                                    <p className="flex items-start gap-2 font-semibold text-(--ev-ink)">
                                      {done.job === 'corner' && <GuardSign guarded size={20} />}
                                      <span>{t(`done.job.${done.job}` as RideKey)}</span>
                                    </p>
                                  )}
                                  {done.job === 'corner' && done.spot && (
                                    <p>{done.spot.time ? t('done.spot', { place: done.spot.label, time: clock(`${done.spot.time}:00`, locale) }) : t('done.spot_notime', { place: done.spot.label })}</p>
                                  )}
                                </div>
                              )}
                              {/* One tap to help, for people who've ridden before, go every date or lead (Shift 01745). */}
                              {done.status === 'going' && !done.job && done.help && (() => {
                                const offered = JOBS.filter((j) => j !== 'front' && (done.help!.open[j] ?? 0) > 0)
                                if (!offered.length) return helpTaken ? <p className="mt-3 text-[15px] text-(--ev-ink-80)">{t('done.job_taken')}</p> : null
                                const next = crossings.find((c) => !c.guarded)
                                return (
                                  <div className="mt-3 rounded-[10px] border border-(--ev-line-strong) bg-white p-3">
                                    <p className="text-[15px] font-bold text-(--ev-ink)">{t('help.ask')}</p>
                                    <p className="text-[14px] text-(--ev-ink-75)">{helpTaken ? t('help.taken') : t('help.ask_sub')}</p>
                                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                      {offered.map((j) => (
                                        <button key={j} type="button" onClick={() => takeJob(j)} disabled={helpBusy !== null}
                                          className="flex min-h-[52px] items-center gap-3 rounded-[10px] border border-(--ev-line-strong) bg-white px-3 py-2 text-left hover:bg-(--ev-panel) disabled:opacity-60">
                                          {j === 'corner' ? <GuardSign guarded={false} size={22} /> : <Users size={20} className="shrink-0 text-(--ev-ink)" aria-hidden />}
                                          <span className="min-w-0 flex-1">
                                            <span className="block text-[15px] font-semibold text-(--ev-ink)">{helpBusy === j ? t('saving') : t(`help.${j}` as RideKey)}</span>
                                            <span className="block text-[14px] text-(--ev-ink-75)">
                                              {j === 'sweep' ? t(walk ? 'help.sweep_sub.walk' : 'help.sweep_sub.ride')
                                                : next ? (next.time ? t('help.corner_at', { place: next.label, time: clock(`${next.time}:00`, locale) }) : t('help.corner_at_notime', { place: next.label }))
                                                : t('help.corner_sub')}
                                            </span>
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })()}
                              {done.chat && done.status !== 'not_going' && (
                                <a href={done.chat.url} target="_blank" rel="noopener noreferrer"
                                  onClick={() => posthog.capture('ride_chat_opened', { code: ride.code, surface: 'web' })}
                                  className="mt-3 flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] bg-(--ev-accent-fill) px-4 text-[15px] font-bold text-(--ev-on-accent-fill) hover:opacity-90">
                                  <MessageCircle size={17} /> {done.chat.label}
                                </a>
                              )}
                              {!done.chat && done.chatWaiting && done.status !== 'not_going' && (
                                <p className="mt-3 flex items-start gap-2 rounded-[10px] bg-(--ev-panel) px-3 py-2.5 text-[15px] text-(--ev-ink-85)">
                                  <MessageCircle size={17} className="mt-0.5 shrink-0" aria-hidden />
                                  <span>{t('chat_waiting')}</span>
                                </p>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2">
                                {done.status !== 'not_going' && (
                                  <>
                                    <a href={eventGcalUrl(calEv!)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) px-4 py-2 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                                      <Calendar size={14} /> {t('google_cal')}
                                    </a>
                                    <button type="button" onClick={() => downloadIcs(calEv!, ride.name, selected.date)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) px-4 py-2 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                                      <Download size={14} /> {t('apple_outlook')}
                                    </button>
                                  </>
                                )}
                                <button onClick={() => setDone(null)} className="rounded-[10px] px-3 py-2 text-[14px] font-semibold text-(--ev-accent) hover:underline">
                                  {t('change_answer')}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-[15px] font-bold text-(--ev-ink)">
                                {myAnswer === 'going' ? t('ask.going') : myAnswer === 'maybe' ? t('ask.maybe') : myAnswer === 'not_going' ? t('ask.not') : t('ask.coming')}
                              </p>
                              <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('answer_aria')}>
                                {ANSWERS.map((a) => {
                                  const on = choice ? choice === a.value : myAnswer === a.value
                                  return (
                                    <button
                                      key={a.value}
                                      type="button"
                                      role="radio"
                                      aria-checked={on}
                                      onClick={() => setChoice(a.value)}
                                      className={`min-h-[44px] rounded-[10px] border text-[14px] font-bold transition-colors ${
                                        on ? 'border-(--ev-accent-fill) bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'border-(--ev-line-strong) text-(--ev-ink) hover:bg-(--ev-panel)'
                                      }`}
                                    >
                                      {t(a.label)}
                                    </button>
                                  )
                                })}
                              </div>

                              {choice && (
                                <form onSubmit={submit} className="mt-4 space-y-3">
                                  <div className="grid grid-cols-2 gap-2">
                                    <label className="block">
                                      <span className="text-[14px] font-semibold text-(--ev-ink-80)">{t('first_name')}</span>
                                      <input name="first_name" required maxLength={40} defaultValue={me.first_name} autoComplete="given-name" className="mt-1 w-full rounded-[10px] border border-(--ev-line-strong) bg-white px-3 py-2.5 text-[15px] text-(--ev-ink) placeholder:text-(--ev-ink-60)" />
                                    </label>
                                    <label className="block">
                                      <span className="text-[14px] font-semibold text-(--ev-ink-80)">{t('last_name')} <span className="font-normal text-(--ev-ink-75)">{t('optional')}</span></span>
                                      <input name="last_name" maxLength={40} defaultValue={me.last_name} autoComplete="family-name" className="mt-1 w-full rounded-[10px] border border-(--ev-line-strong) bg-white px-3 py-2.5 text-[15px] text-(--ev-ink)" />
                                    </label>
                                  </div>
                                  <label className="block">
                                    <span className="text-[14px] font-semibold text-(--ev-ink-80)">{t('email')}</span>
                                    <input name="email" type="email" required defaultValue={me.email} autoComplete="email" inputMode="email" placeholder={t('email_ph')} className="mt-1 w-full rounded-[10px] border border-(--ev-line-strong) bg-white px-3 py-2.5 text-[15px] text-(--ev-ink) placeholder:text-(--ev-ink-60)" />
                                  </label>
                                  {hasStops && choice !== 'not_going' && (
                                    <label className="block">
                                      <span className="text-[14px] font-semibold text-(--ev-ink-80)">{t('where_join')}</span>
                                      <select name="join_stop" value={stopPick} onChange={(e) => setStopPick(e.target.value)}
                                        className="mt-1 min-h-[44px] w-full rounded-[10px] border border-(--ev-line-strong) bg-white px-3 py-2.5 text-[15px] text-(--ev-ink)">
                                        {stops.map((s, i) => (
                                          <option key={s.id} value={s.id}>{`${s.label} · ${stopWhen(s, i)}`}</option>
                                        ))}
                                      </select>
                                    </label>
                                  )}
                                  {choice === 'going' && everyText && (
                                    <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-[10px] border border-(--ev-line-strong) bg-white px-3 py-2.5">
                                      <input type="checkbox" checked={every} onChange={(e) => setEvery(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-(--ev-accent-fill)" />
                                      <span>
                                        <span className="block text-[15px] font-semibold text-(--ev-ink)">{t('count_me_in', { every: everyText })}</span>
                                        <span className="block text-[14px] text-(--ev-ink-75)">{t('count_me_in_sub')}</span>
                                      </span>
                                    </label>
                                  )}
                                  {/* People never see this; scripts fill it in. */}
                                  <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-px w-px opacity-0" />
                                  <p className="text-[14px] leading-snug text-(--ev-ink-75)">
                                    {choice === 'not_going' ? t('fine.not') : choice === 'maybe' ? t(nk('fine.maybe')) : t(nk('fine.going'))}
                                  </p>
                                  {error && <p role="alert" className="text-[14px] font-semibold text-(--ev-danger)">{error}</p>}
                                  <button type="submit" disabled={busy} className="min-h-[46px] w-full rounded-[10px] bg-(--ev-accent-fill) text-[15px] font-bold text-(--ev-on-accent-fill) transition-opacity hover:opacity-90 disabled:opacity-60">
                                    {busy ? t('saving') : choice === 'going' ? (every && everyText ? t('btn.every', { every: everyText }) : t('btn.going')) : choice === 'maybe' ? t('btn.maybe') : t('btn.not')}
                                  </button>
                                </form>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              <div className="mt-5 flex items-center gap-2 border-t border-(--ev-line) pt-4">
                <button onClick={share} className="inline-flex items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) px-4 py-2 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                  <Share2 size={14} /> {copied ? t('link_copied') : t(nk('share'))}
                </button>
              </div>
            </div>
          </aside>

          <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-6 lg:col-start-1 lg:row-start-1">
          {/* ---- The route or meeting point: the page's picture ---- */}
          {hasMap && place && (
            <div className="overflow-hidden rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) shadow-(--ev-shadow)">
              <div className={route.length >= 2 ? 'h-[300px] sm:h-[360px]' : 'h-56 sm:h-64'}>
                {route.length >= 2 ? (
                  <RouteMap line={route} stops={mapStops} guards={mapGuards} meetup={{ lat: place.meetup_lat!, lng: place.meetup_lng! }} pick={false}
                    className="h-full w-full" label={t('route_map', { name: ride.name })} />
                ) : (
                  <EventMap lat={place.meetup_lat!} lng={place.meetup_lng!} label={place.meetup_name ?? undefined} />
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--ev-line) p-4">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-(--ev-ink)">{t('meet_at', { place: place.meetup_name || t('the_start') })}</p>
                  {place.meetup_address && <p className="mt-0.5 text-[14px] text-(--ev-ink-75)">{place.meetup_address}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* Nearby plans the trip there by bike, the T or Bluebikes, from where they are. */}
                  <a href={withLang(`/nearby?to=${place.meetup_lat},${place.meetup_lng}&toName=${encodeURIComponent(place.meetup_name || ride.name)}&toMode=bike`, locale)}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 py-2 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                    <Bike size={15} /> {t('get_there')}
                  </a>
                  <a href={directionsUrl(place)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 py-2 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                    <MapPin size={15} /> {t('directions')}
                  </a>
                </div>
              </div>
              {/* Where people join along the way, with the group's time at each (Shift 01744). */}
              {hasStops && (
                <div className="border-t border-(--ev-line) p-4">
                  <p className="text-[15px] font-semibold text-(--ev-ink)">{t('stops.title')}</p>
                  <ol className="mt-2 space-y-2">
                    {stops.map((s, i) => (
                      <li key={s.id} className="flex items-center gap-3">
                        <StopBadge n={i} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold leading-snug text-(--ev-ink)">{s.label}</span>
                          <span className="block text-[14px] text-(--ev-ink-75)">{stopWhen(s, i)}</span>
                        </span>
                        {i > 0 && (
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`} target="_blank" rel="noopener noreferrer"
                            aria-label={`${t('directions')}: ${s.label}`}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-(--ev-line-strong) bg-white text-(--ev-ink) hover:bg-(--ev-panel)">
                            <MapPin size={15} />
                          </a>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {/* Crossing guards at the route's busy crossings, with the group's time at each (Shift 01745). */}
              {crossings.length > 0 && (
                <div className="border-t border-(--ev-line) p-4">
                  <p className="text-[15px] font-semibold text-(--ev-ink)">{t('crossings.title')}</p>
                  <p className="text-[14px] text-(--ev-ink-75)">{t('crossings.sub')}</p>
                  <ol className="mt-2 space-y-2">
                    {crossings.map((c) => (
                      <li key={c.id} className="flex items-center gap-3">
                        <GuardSign guarded={c.guarded} size={24} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold leading-snug text-(--ev-ink)">{c.label}</span>
                          <span className="block text-[14px] text-(--ev-ink-75)">
                            {[c.time ? t('stops.about', { time: clock(`${c.time}:00`, locale) }) : null, c.guarded ? t('crossings.guarded') : t('crossings.needed')].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* What it's like (distance, pace, hills, calm streets, level, policies). */}
          <RideFacts ride={ride} miles={miles} ascentFt={climb} comfort={comfortHere} className="" locale={locale} />

          {/* What it looked like last time: that date's photos, and adding yours for a week after. */}
          {photos && <RidePhotos album={photos.album} href={photos.href} albumRef={photos.albumRef} preview={photos.preview} locale={locale} />}

          {/* ---- The rest, by tab, so nothing waits at the bottom of a long scroll ---- */}
          <section aria-label={t(nk('more_about'))}>
            <div role="tablist" aria-label={t(nk('tab.about'))}
              className="flex gap-1 overflow-x-auto border-b border-(--ev-line-mid) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map((t) => {
                const on = t.id === shownTab
                return (
                  <button key={t.id} type="button" role="tab" id={`ride-tab-${t.id}`} aria-selected={on} aria-controls={`ride-panel-${t.id}`}
                    onClick={() => setTab(t.id)}
                    className={`-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3 text-[15px] font-semibold ${
                      on ? 'border-(--ev-ink) text-(--ev-ink)' : 'border-transparent text-(--ev-ink-75) hover:text-(--ev-ink)'}`}>
                    {t.label}
                    {typeof t.count === 'number' && t.count > 0 && (
                      <span className={`rounded-full px-2 py-px text-[13px] font-bold ${on ? 'bg-(--ev-ink) text-white' : 'bg-(--ev-panel) text-(--ev-ink-80)'}`}>{t.count}</span>
                    )}
                  </button>
                )
              })}
            </div>

            <div role="tabpanel" id={`ride-panel-${shownTab}`} aria-labelledby={`ride-tab-${shownTab}`} className="pt-5">
              {shownTab === 'about' && (
                <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0 space-y-4">
                    {about && <p className="whitespace-pre-line text-[16px] leading-relaxed text-(--ev-ink-85)">{about}</p>}
                    {ride.registration_url && (
                      <a href={ride.registration_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-2xl border border-(--ev-line-mid) bg-white p-4 hover:bg-(--ev-panel-faint)">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--ev-accent-tint-15) text-(--ev-accent)"><ExternalLink size={18} aria-hidden /></span>
                        <span className="min-w-0">
                          <span className="block text-[15px] font-bold text-(--ev-ink)">{t('register_title')}</span>
                          <span className="block text-[14px] text-(--ev-ink-80)">{t('register_body')}</span>
                        </span>
                      </a>
                    )}
                  </div>
                  {flyer && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={flyer} alt={t('flyer_alt', { name: dateTitle ?? ride.name })} className="max-h-[320px] w-full rounded-2xl border border-(--ev-line) object-cover sm:w-[240px]" />
                  )}
                </div>
              )}

              {shownTab === 'updates' && (
                updates.length === 0 ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-(--ev-line) bg-(--ev-card) p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--ev-panel) text-(--ev-ink-75)"><Megaphone size={18} aria-hidden /></span>
                    <p className="text-[15px] text-(--ev-ink-80)">{t('no_updates')}</p>
                  </div>
                ) : (
                  <ol className="space-y-3">
                    {updates.map((u) => (
                      <li key={u.id} className="flex gap-3 rounded-2xl border border-(--ev-line) bg-(--ev-card) px-4 py-3">
                        <HostFace name={hostName} logo={host?.logo_url ?? null} walk={walk} small />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-[15px] font-semibold text-(--ev-ink)">{u.title}</p>
                            <time dateTime={u.created_at} className="shrink-0 text-[14px] text-(--ev-ink-75)">{ago(u.created_at, Date.now(), locale)}</time>
                          </div>
                          {u.body && <p className="mt-0.5 text-[15px] text-(--ev-ink-80)">{u.body}</p>}
                          {u.note && <p className="mt-1.5 border-l-2 border-(--ev-accent-line) pl-3 text-[15px] text-(--ev-ink-85)">&ldquo;{u.note}&rdquo;</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                )
              )}

              {shownTab === 'along' && (
                <div className="space-y-5">
                  {((routeLink && /^https?:\/\//.test(routeLink)) || route.length >= 2) && (
                    <div className="flex flex-wrap gap-2">
                      {routeLink && /^https?:\/\//.test(routeLink) && (
                        <a href={routeLink} target="_blank" rel="noopener noreferrer"
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                          <RouteIcon size={16} /> {t('full_route')} <ExternalLink size={14} />
                        </a>
                      )}
                      {route.length >= 2 && (
                        <button type="button" onClick={() => downloadGpx(ride, route, selected?.date ?? null)}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                          <Download size={16} /> {t(walk ? 'gpx.walk' : 'gpx.ride')}
                        </button>
                      )}
                    </div>
                  )}
                  {coffee?.shop && <RideCoffee info={coffee} locale={locale} />}
                  {hasNewInfra(newHere) && <RideNewInfra info={newHere} onRoute={route.length >= 2} locale={locale} />}
                  {/* Bicycle Benefits perks need a helmet sticker: rides only. */}
                  {!walk && perkStops.length > 0 && <RidePerks stops={perkStops} code={ride.code} locale={locale} />}
                </div>
              )}

              {shownTab === 'host' && hostName && (
                <div className="rounded-2xl border border-(--ev-line) bg-(--ev-card) p-5">
                  <div className="flex items-center gap-4">
                    <HostFace name={hostName} logo={host?.logo_url ?? null} walk={walk} large />
                    <div className="min-w-0">
                      <p className="font-display text-[22px] font-extrabold leading-tight text-(--ev-ink)">{hostName}</p>
                      <p className="mt-0.5 text-[15px] text-(--ev-ink-80)">{host ? t(nk('hosts')) : t(nk('organizes'))}</p>
                    </div>
                  </div>
                  {(host ? Object.keys(host.social_links).length > 0 || host.url : ride.organizer_url) && (
                    <div className="mt-4">
                      <p className="text-[15px] font-semibold text-(--ev-ink)">{t(nk('follow'))}</p>
                      <OrganizerChannels className="mt-2" links={host?.social_links ?? {}} website={host ? host.url : ride.organizer_url} locale={locale} />
                    </div>
                  )}
                  {hostHref && (
                    <a href={hostHref} className="mt-4 inline-flex min-h-[44px] items-center rounded-[10px] bg-(--ev-accent-fill) px-4 text-[15px] font-semibold text-(--ev-on-accent-fill) hover:opacity-90">
                      {t(nk('more_from_them'))}
                    </a>
                  )}
                </div>
              )}
            </div>
          </section>

          <div className="flex flex-col gap-4 rounded-2xl bg-[#191A2E] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-display text-[19px] font-extrabold">{t(nk('along_title'))}</p>
              <p className="mt-1 text-[15px] text-white/80">
                {t(nk('along_body'))}
              </p>
            </div>
            <RideStoreBadges code={ride.code} className="shrink-0" placement="ride_page" height={40} locale={locale} />
          </div>
          </div>
        </div>
      </div>
    </div>
    </EventsToneProvider>
  )
}

type TabId = 'about' | 'updates' | 'along' | 'host'

/**
 * The host's face (Keith 2026-11-06: the page needs one): a verified
 * organization's logo, else the organizer's initials ("Keith A." is KA) on
 * the brand's navy, else a bike or walker for a private profile.
 */
function HostFace({ name, logo, walk, small = false, large = false }: { name: string | null; logo: string | null; walk: boolean; small?: boolean; large?: boolean }) {
  const box = small ? 'h-9 w-9 text-[13px]' : large ? 'h-16 w-16 text-[22px]' : 'h-14 w-14 text-[19px]'
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt="" className={`${box} shrink-0 rounded-full border border-(--ev-line-mid) bg-white object-contain p-1`} />
    )
  }
  const person = name && !/^a /.test(name) ? name : null
  const initials = person ? person.split(/\s+/).map((w) => w.replace(/[^A-Za-z]/g, '')).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') : ''
  return (
    <span aria-hidden className={`${box} grid shrink-0 place-items-center rounded-full bg-[#191A2E] font-display font-extrabold text-[#BAF14D]`}>
      {initials || (walk ? <Footprints size={small ? 16 : 24} /> : <Bike size={small ? 16 : 24} />)}
    </span>
  )
}
