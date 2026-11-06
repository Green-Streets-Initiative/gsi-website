'use client'

import { useEffect, useMemo, useState } from 'react'
import posthog from 'posthog-js'
import { Bike, Calendar, Check, CloudSun, Download, ExternalLink, Footprints, MapPin, Megaphone, MessageCircle, Radio, Route as RouteIcon, Share2, Users } from 'lucide-react'
import type { CalmSegment } from '@/components/commute/calm-route'
import EventMap from '@/components/events/EventMap'
import RouteMap from '@/components/organizers/RouteMap'
import { buildIcs, calendarLocation, gcalUrl as eventGcalUrl } from '@/lib/event-calendar'
import { routeMiles } from '@/lib/organizers/route-geo'
import { todayKey } from '@/lib/organizers/ride-words'
import RideStoreBadges from '@/components/rides/RideStoreBadges'
import OrganizerChannels from '@/components/rides/OrganizerChannels'
import RideFacts, { rideFacts } from '@/components/rides/RideFacts'
import RidePerks from '@/components/rides/RidePerks'
import RideCoffee, { type RideCoffeeInfo } from '@/components/rides/RideCoffee'
import RideNewInfra from '@/components/rides/RideNewInfra'
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
  type PublicRide,
  type RideChat,
  type RideDate,
  type RsvpStatus,
} from '@/lib/rides/public'
import '@/components/events/events-tone.css'

const ANSWERS: { value: RsvpStatus; label: string }[] = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'not_going', label: "Can't go" },
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
function calendarEvent(ride: PublicRide, d: RideDate, hostName: string | null, miles: number | null, climb: number | null) {
  const walk = ride.activity === 'walk'
  const page = `${pageUrl(ride)}?date=${d.date}`
  const where = calendarLocation(d.meetup_name, d.meetup_address)
  const facts = rideFacts(ride, miles, climb)
  const factLine = [
    ...facts.stats.map((f) => (f.label === 'Pace' && f.sub ? `${f.value} (${f.sub})` : f.value)),
    ...facts.policies.map((p) => p.title),
  ].join(' · ')
  const about = (d.description || ride.description || '').trim()
  const notes = [
    // "Keith A." already ends the sentence.
    `${walk ? 'Group walk' : 'Group ride'}${hostName ? ` hosted by ${hostName}` : ''}`.replace(/([^.])$/, '$1.'),
    `Say you're coming, or change your answer: ${page}`,
    ride.registration_url ? `The organizer's sign-up: ${ride.registration_url}` : null,
    [
      where ? `Meet: ${where}` : null,
      d.meetup_lat != null && d.meetup_lng != null ? `Directions to the start: ${directionsUrl(d)}` : null,
      factLine ? `${walk ? 'The walk' : 'The ride'}: ${factLine}` : null,
    ].filter(Boolean).join('\n'),
    about || null,
    `If plans change, everyone who said they're coming hears right away. The latest is always on the ride page: ${page}`,
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

export default function RidePage({ ride, host = null, hostPerson = null, ascentFt = null, comfort = null, initialDate = null, perks = [], newInfra = [], coffee = null }: {
  ride: PublicRide; host?: RideHost | null; ascentFt?: number | null
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
}) {
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
  const [done, setDone] = useState<{ status: RsvpStatus; first: string; emailed: boolean | null; every: string | null; chat: RideChat | null; chatWaiting: boolean } | null>(null)
  // "Count me in every Saturday" (Shift 01598): Going on every date of a
  // repeating ride, including dates that open later.
  const [every, setEvery] = useState(false)
  const [copied, setCopied] = useState(false)

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
  // A break ends on its own when its date comes: the banner goes with it.
  const paused = ride.status === 'paused' || (!!ride.break_until && ride.break_until > todayKey())

  // A new date resets the form to that date's own answer.
  useEffect(() => { setDone(null); setError(null); setChoice(null); setEvery(false) }, [selectedId])

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
      window.prompt('Copy the ride link:', url)
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
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Try again in a minute.')
        return
      }
      const answers = { ...me.answers, [selected.id]: choice }
      // Every date: the open dates they haven't answered read as Going here too.
      if (data.every_date) for (const d of open) if (!answers[d.id]) answers[d.id] = 'going'
      const next: Remembered = { first_name, last_name, email, answers }
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
      })
      setChoice(null)
      posthog.capture('ride_rsvp_submitted', { code: ride.code, status: choice, surface: 'web', every: choice === 'going' && every })
    } catch {
      setError('Something went wrong. Try again in a minute.')
    } finally {
      setBusy(false)
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
  const headerSchedule = repeats ? scheduleText(ride) : null
  // Offered with Going when there's more than one date to say yes to.
  const everyText = repeats && open.length > 1 ? everyLabel(ride) : null
  const pastOneOff = !!ride.ride_date && ride.ride_date < todayKey()
  // Most groups ride somewhere new each time (Shift 01432): the chosen date's
  // own route, name, description and flyer, else the ride's.
  const own = selected?.own_route && selected.route ? selected.route : null
  const route = ((own ? own.route_waypoints : ride.route_waypoints) ?? []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
  const miles = route.length >= 2 ? routeMiles(route) : null
  const climb = own ? (typeof own.route_elevation?.ascent_ft === 'number' ? Math.round(own.route_elevation.ascent_ft) : null) : ascentFt
  // The chosen date as a calendar entry (calendarEvent): offered before and after answering.
  const calEv = selected ? calendarEvent(ride, selected, hostName, miles, climb) : null
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
    aboutAny ? { id: 'about', label: `About this ${noun}` } : null,
    { id: 'updates', label: 'Updates', count: updatesCount },
    alongAny ? { id: 'along', label: route.length < 2 ? 'Near the start' : walk ? 'Along the walk' : 'Along the route' } : null,
    hostAny ? { id: 'host', label: 'Host' } : null,
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
            <span className="block font-semibold text-(--ev-accent)">{walk ? 'Group walk' : 'Group ride'}</span>
            {hostName && (
              <span className="block">
                Hosted by{' '}
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
              {ended ? (walk ? 'This walk has ended' : 'This ride has ended') : `Taking a break${ride.break_until ? ` until ${dateLong(ride.break_until)}` : ''}`}
            </p>
            {ride.stopped_note && <p className="mt-1 text-[14px]">&ldquo;{ride.stopped_note}&rdquo;</p>}
          </div>
        )}

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
          {/* ---- RSVP card: right under the title on phones, so the date,
               where to meet and Going / Maybe / Can't go are the first
               screen; the right column on desktop ---- */}
          <aside className="lg:col-start-2 lg:row-start-1">
            <div className="rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-5 shadow-(--ev-shadow) lg:sticky lg:top-24">
              {ride.occurrences.length === 0 ? (
                <div>
                  <p className="text-[16px] font-bold text-(--ev-ink)">
                    {ended ? 'No more dates' : pastOneOff ? (walk ? 'This walk has happened' : 'This ride has happened') : paused && ride.break_until ? `Back on ${dateLong(ride.break_until)}` : 'No upcoming dates yet'}
                  </p>
                  <p className="mt-1 text-[15px] text-(--ev-ink-80)">
                    {ended || pastOneOff
                      ? <>See what else is on: <a href={hostHref ?? (walk ? '/events?type=walking_tour' : '/events?type=group_ride')} className="font-semibold text-(--ev-accent) hover:underline">{hostHref && hostName ? `more ${walk ? 'walks' : 'rides'} from ${hostName}` : walk ? 'walks on the calendar' : 'group rides on the calendar'}</a>.</>
                      : paused ? 'Dates open here when the break ends.' : 'Check back soon. New dates show up here.'}
                  </p>
                </div>
              ) : (
                <>
                  {linkedMissing && !selectedId && (
                    <p className="mb-3 text-[15px] text-(--ev-ink-85)">{dateLong(initialDate!)} isn&rsquo;t open yet. Pick another date below.</p>
                  )}
                  {ride.occurrences.length > 1 && (<>
                  <p className="text-[14px] font-semibold text-(--ev-ink-75)">Pick a date</p>
                  <div className="-mx-1 mt-2 mb-6 flex gap-2 overflow-x-auto px-1 pb-2" role="group" aria-label="Ride dates">
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
                          <span className={`text-[13px] font-semibold ${active ? 'text-white/85' : 'text-(--ev-ink-75)'}`}>{dayShort(d.date)}</span>
                          <span className="text-[15px] font-bold">{dateShort(d.date)}</span>
                          <span className={`mt-0.5 text-[13px] ${active ? 'text-white/85' : 'text-(--ev-ink-75)'}`}>
                            {d.status === 'canceled' ? 'Off' : answered === 'going' ? "You're in" : answered === 'maybe' ? 'Maybe' : (counts[d.id]?.going ?? 0) > 0 ? `${counts[d.id].going} going` : clock(d.start_time) || 'Open'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  </>)}

                  {selected && (
                    <>
                      {(() => {
                        const s = dateStatusLine(ride, selected)
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
                            {latest?.note && (
                              <p className={`${s.tone !== 'plain' ? 'mt-1 ' : ''}line-clamp-2 text-[14px] font-medium`}>&ldquo;{latest.note}&rdquo; <span className="opacity-80">· {ago(latest.created_at)}</span></p>
                            )}
                          </div>
                        )
                      })()}

                      {/* The chosen date's own name (Shift 01432), for someone who came from that date's listing. */}
                      {dateTitle && <p className="text-[17px] font-bold leading-snug text-(--ev-ink)">{dateTitle}</p>}
                      <div className={`${dateTitle ? 'mt-2' : ''} space-y-2 text-[15px] text-(--ev-ink-85)`}>
                        <p className="flex gap-2 font-semibold text-(--ev-ink)">
                          <Calendar size={17} className="mt-0.5 shrink-0 text-(--ev-ink-60)" />
                          <span>{dateLong(selected.date)}{selected.start_time ? ` · ${clock(selected.start_time)}${selected.end_time ? ` to ${clock(selected.end_time)}` : ''}` : ''}</span>
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
                            ? 'Be the first to say you’re going'
                            : `${counts[selected.id]?.going ?? 0} going${(counts[selected.id]?.maybe ?? 0) > 0 ? ` · ${counts[selected.id].maybe} maybe` : ''}`}
                        </p>
                        {/* Save it before answering too (Keith 2026-11-06); after answering, the buttons sit with the confirmation. */}
                        {calEv && selected.status === 'scheduled' && !ended && !done && (
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Download size={17} className="shrink-0 text-(--ev-ink-60)" />
                            <span>Add to calendar:</span>
                            <a href={eventGcalUrl(calEv)} target="_blank" rel="noopener noreferrer"
                              onClick={() => posthog.capture('ride_calendar_saved', { code: ride.code, app: 'google', answered: false })}
                              className="font-semibold text-(--ev-accent) hover:underline">Google</a>
                            <span aria-hidden className="text-(--ev-ink-60)">·</span>
                            <button type="button"
                              onClick={() => { posthog.capture('ride_calendar_saved', { code: ride.code, app: 'ics', answered: false }); downloadIcs(calEv, ride.name, selected.date) }}
                              className="font-semibold text-(--ev-accent) hover:underline">Apple or Outlook</button>
                          </p>
                        )}
                      </div>


                      {selected.status === 'scheduled' && !ended && (
                        <div className="mt-5 border-t border-(--ev-line) pt-5">
                          {done ? (
                            <div aria-live="polite">
                              <p className="text-[17px] font-bold text-(--ev-ink)">
                                {done.every ? `You're in ${done.every}, ${done.first}.` : done.status === 'going' ? `You're going, ${done.first}.` : done.status === 'maybe' ? `Saved as a maybe, ${done.first}.` : `Got it, ${done.first}. Maybe next time.`}
                              </p>
                              {done.status !== 'not_going' && (
                                <p className="mt-1 text-[15px] text-(--ev-ink-80)">
                                  {done.emailed ? <>We emailed you the details. </> : null}
                                  {done.every
                                    ? <>You&rsquo;ll hear from us the evening before each one. Can&rsquo;t make one? Pick that date and say Can&rsquo;t go.</>
                                    : done.status === 'maybe'
                                    ? <>We&rsquo;ll let you know if anything changes.</>
                                    : <>You&rsquo;ll hear from us the evening before, and right away if the plan changes.</>}
                                </p>
                              )}
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
                                  <span>The organizer lets people into the group chat. Once they do, the link shows here and in your ride emails.</span>
                                </p>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2">
                                {done.status !== 'not_going' && (
                                  <>
                                    <a href={eventGcalUrl(calEv!)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) px-4 py-2 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                                      <Calendar size={14} /> Google Calendar
                                    </a>
                                    <button type="button" onClick={() => downloadIcs(calEv!, ride.name, selected.date)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) px-4 py-2 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                                      <Download size={14} /> Apple or Outlook
                                    </button>
                                  </>
                                )}
                                <button onClick={() => setDone(null)} className="rounded-[10px] px-3 py-2 text-[14px] font-semibold text-(--ev-accent) hover:underline">
                                  Change answer
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-[15px] font-bold text-(--ev-ink)">
                                {myAnswer === 'going' ? 'You’re going. Change your answer?' : myAnswer === 'maybe' ? 'You’re a maybe. Change your answer?' : myAnswer === 'not_going' ? 'You can’t make it. Change your answer?' : 'Are you coming?'}
                              </p>
                              <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Your answer">
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
                                      {a.label}
                                    </button>
                                  )
                                })}
                              </div>

                              {choice && (
                                <form onSubmit={submit} className="mt-4 space-y-3">
                                  <div className="grid grid-cols-2 gap-2">
                                    <label className="block">
                                      <span className="text-[14px] font-semibold text-(--ev-ink-80)">First name</span>
                                      <input name="first_name" required maxLength={40} defaultValue={me.first_name} autoComplete="given-name" className="mt-1 w-full rounded-[10px] border border-(--ev-line-strong) bg-white px-3 py-2.5 text-[15px] text-(--ev-ink) placeholder:text-(--ev-ink-60)" />
                                    </label>
                                    <label className="block">
                                      <span className="text-[14px] font-semibold text-(--ev-ink-80)">Last name <span className="font-normal text-(--ev-ink-75)">(optional)</span></span>
                                      <input name="last_name" maxLength={40} defaultValue={me.last_name} autoComplete="family-name" className="mt-1 w-full rounded-[10px] border border-(--ev-line-strong) bg-white px-3 py-2.5 text-[15px] text-(--ev-ink)" />
                                    </label>
                                  </div>
                                  <label className="block">
                                    <span className="text-[14px] font-semibold text-(--ev-ink-80)">Email</span>
                                    <input name="email" type="email" required defaultValue={me.email} autoComplete="email" inputMode="email" placeholder="you@example.com" className="mt-1 w-full rounded-[10px] border border-(--ev-line-strong) bg-white px-3 py-2.5 text-[15px] text-(--ev-ink) placeholder:text-(--ev-ink-60)" />
                                  </label>
                                  {choice === 'going' && everyText && (
                                    <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-[10px] border border-(--ev-line-strong) bg-white px-3 py-2.5">
                                      <input type="checkbox" checked={every} onChange={(e) => setEvery(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-(--ev-accent-fill)" />
                                      <span>
                                        <span className="block text-[15px] font-semibold text-(--ev-ink)">Count me in {everyText}</span>
                                        <span className="block text-[14px] text-(--ev-ink-75)">You&rsquo;ll be on the list for each date. Say Can&rsquo;t go on any one.</span>
                                      </span>
                                    </label>
                                  )}
                                  {/* People never see this; scripts fill it in. */}
                                  <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-px w-px opacity-0" />
                                  <p className="text-[14px] leading-snug text-(--ev-ink-75)">
                                    {choice === 'not_going'
                                      ? 'We’ll let the organizer know.'
                                      : choice === 'maybe'
                                        ? `We’ll email you if the plan changes. People on this ${noun} see your first name and last initial. Your email stays private.`
                                        : `We’ll email you the evening before and if the plan changes. People on this ${noun} see your first name and last initial. Your email stays private.`}
                                  </p>
                                  {error && <p role="alert" className="text-[14px] font-semibold text-(--ev-danger)">{error}</p>}
                                  <button type="submit" disabled={busy} className="min-h-[46px] w-full rounded-[10px] bg-(--ev-accent-fill) text-[15px] font-bold text-(--ev-on-accent-fill) transition-opacity hover:opacity-90 disabled:opacity-60">
                                    {busy ? 'Saving…' : choice === 'going' ? (every && everyText ? `I'm in ${everyText}` : "I'm going") : choice === 'maybe' ? 'Save as maybe' : "I can't make it"}
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
                  <Share2 size={14} /> {copied ? 'Link copied' : `Share this ${noun}`}
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
                  <RouteMap line={route} stops={[]} meetup={{ lat: place.meetup_lat!, lng: place.meetup_lng! }} pick={false}
                    className="h-full w-full" label={`Route map for ${ride.name}`} />
                ) : (
                  <EventMap lat={place.meetup_lat!} lng={place.meetup_lng!} label={place.meetup_name ?? undefined} />
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--ev-line) p-4">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-(--ev-ink)">Meet at {place.meetup_name || 'the start'}</p>
                  {place.meetup_address && <p className="mt-0.5 text-[14px] text-(--ev-ink-75)">{place.meetup_address}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* Nearby plans the trip there by bike, the T or Bluebikes, from where they are. */}
                  <a href={`/nearby?to=${place.meetup_lat},${place.meetup_lng}&toName=${encodeURIComponent(place.meetup_name || ride.name)}&toMode=bike`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 py-2 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                    <Bike size={15} /> Get there by bike or T
                  </a>
                  <a href={directionsUrl(place)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 py-2 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                    <MapPin size={15} /> Directions
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* What it's like (distance, pace, hills, calm streets, level, policies). */}
          <RideFacts ride={ride} miles={miles} ascentFt={climb} comfort={comfortHere} className="" />

          {/* ---- The rest, by tab, so nothing waits at the bottom of a long scroll ---- */}
          <section aria-label={`More about this ${noun}`}>
            <div role="tablist" aria-label={`About this ${noun}`}
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
                          <span className="block text-[15px] font-bold text-(--ev-ink)">Also register with the organizer</span>
                          <span className="block text-[14px] text-(--ev-ink-80)">They ask everyone to sign up on their own page too.</span>
                        </span>
                      </a>
                    )}
                  </div>
                  {flyer && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={flyer} alt={`${dateTitle ?? ride.name} flyer`} className="max-h-[320px] w-full rounded-2xl border border-(--ev-line) object-cover sm:w-[240px]" />
                  )}
                </div>
              )}

              {shownTab === 'updates' && (
                updates.length === 0 ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-(--ev-line) bg-(--ev-card) p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--ev-panel) text-(--ev-ink-75)"><Megaphone size={18} aria-hidden /></span>
                    <p className="text-[15px] text-(--ev-ink-80)">Nothing new from the organizer. If plans change, it shows up here, and everyone who says they&rsquo;re coming hears right away.</p>
                  </div>
                ) : (
                  <ol className="space-y-3">
                    {updates.map((u) => (
                      <li key={u.id} className="flex gap-3 rounded-2xl border border-(--ev-line) bg-(--ev-card) px-4 py-3">
                        <HostFace name={hostName} logo={host?.logo_url ?? null} walk={walk} small />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-[15px] font-semibold text-(--ev-ink)">{u.title}</p>
                            <time dateTime={u.created_at} className="shrink-0 text-[14px] text-(--ev-ink-75)">{ago(u.created_at)}</time>
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
                          <RouteIcon size={16} /> The full route, turn by turn <ExternalLink size={14} />
                        </a>
                      )}
                      {route.length >= 2 && (
                        <button type="button" onClick={() => downloadGpx(ride, route, selected?.date ?? null)}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                          <Download size={16} /> {walk ? 'GPX for a phone or watch' : 'GPX for a bike computer'}
                        </button>
                      )}
                    </div>
                  )}
                  {coffee?.shop && <RideCoffee info={coffee} />}
                  {hasNewInfra(newHere) && <RideNewInfra info={newHere} onRoute={route.length >= 2} />}
                  {/* Bicycle Benefits perks need a helmet sticker: rides only. */}
                  {!walk && perkStops.length > 0 && <RidePerks stops={perkStops} code={ride.code} />}
                </div>
              )}

              {shownTab === 'host' && hostName && (
                <div className="rounded-2xl border border-(--ev-line) bg-(--ev-card) p-5">
                  <div className="flex items-center gap-4">
                    <HostFace name={hostName} logo={host?.logo_url ?? null} walk={walk} large />
                    <div className="min-w-0">
                      <p className="font-display text-[22px] font-extrabold leading-tight text-(--ev-ink)">{hostName}</p>
                      <p className="mt-0.5 text-[15px] text-(--ev-ink-80)">{host ? 'Hosts this group ' + noun : `Organizes this group ${noun} on Shift`}</p>
                    </div>
                  </div>
                  {(host ? Object.keys(host.social_links).length > 0 || host.url : ride.organizer_url) && (
                    <div className="mt-4">
                      <p className="text-[15px] font-semibold text-(--ev-ink)">Follow them for news between {walk ? 'walks' : 'rides'}</p>
                      <OrganizerChannels className="mt-2" links={host?.social_links ?? {}} website={host ? host.url : ride.organizer_url} />
                    </div>
                  )}
                  {hostHref && (
                    <a href={hostHref} className="mt-4 inline-flex min-h-[44px] items-center rounded-[10px] bg-(--ev-accent-fill) px-4 text-[15px] font-semibold text-(--ev-on-accent-fill) hover:opacity-90">
                      {walk ? 'More walks from them' : 'More rides from them'}
                    </a>
                  )}
                </div>
              )}
            </div>
          </section>

          <div className="flex flex-col gap-4 rounded-2xl bg-[#191A2E] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-display text-[19px] font-extrabold">{walk ? 'Walk along with Shift' : 'Ride along with Shift'}</p>
              <p className="mt-1 text-[15px] text-white/80">
                On the day, Shift shows where the group is so you can catch up, and counts your {walk ? 'walk' : 'ride'} toward local rewards.
              </p>
            </div>
            <RideStoreBadges code={ride.code} className="shrink-0" placement="ride_page" height={40} />
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
