'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Bike, CalendarDays, Check, Footprints, ImagePlus, MapPin, MessageSquareText, Trash2 } from 'lucide-react'
import { comfortableShare } from '@/components/commute/calm-route'
import { scheduleText } from '@/lib/rides/public'
import { routeMiles } from '@/lib/organizers/route-geo'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { errorText, getRideFundFor, getSeriesDestination, saveRide, saveRideDestination, setEndShop, setRepliesToOrganizer, uploadFlyer, type FeedTarget, type RideFundHere } from '@/lib/organizers/api'
import { takePrefill } from '@/lib/organizers/first-ride'
import { decodePlan, draftOf, routePayload } from '@/lib/organizers/saved-route'
import { DAY_LABELS, TAG_OPTIONS, WEEK_OPTIONS, dateLabel, paceOptionsFor, todayKey, travelMph, type Activity } from '@/lib/organizers/ride-words'
import { biweeklyStarts, scheduleDates } from '@/lib/organizers/schedule'
import type { Frequency, Pace, RideRow, RouteDraft } from '@/lib/organizers/types'
import { ROUTE_IMPORT_KEY, openAssistant } from './AssistantPanel'
import { useConsole } from './ConsoleContext'
import EndShopCard from './EndShopCard'
import GoingToEvent from './GoingToEvent'
import OrgPicker from './OrgPicker'
import RouteMap from './RouteMap'
import RouteSection from './RouteSection'
import { Button, Card, Field, Input, Notice, Select, SectionTitle, Textarea, Toggle, cx } from './ui'

interface Form {
  name: string
  description: string
  flyer_url: string | null
  schedule: 'one_time' | 'recurring'
  ride_date: string
  frequency: Frequency
  days: number[]
  week_of_month: number
  season_start: string
  season_end: string
  start_time: string
  end_time: string
  meetup_name: string
  meetup_address: string
  meetup_lat: number | null
  meetup_lng: number | null
  route: RouteDraft | null
  route_google_maps_url: string
  /** A bike ride or a group walk (Shift 01660). */
  activity: Activity
  pace: Pace | ''
  no_drop: boolean
  tags: string[]
  registration_url: string
  contact_url: string
  /** Update emails carry Reply-To with the organizer's address (Shift 01598); saved on its own. */
  replies_to_organizer: boolean
  live_sharing: 'off' | 'members' | 'link'
  visibility: 'public' | 'invite'
  event_organizer_id: string
  organizer_name: string
  organizer_url: string
  /** Where the ride ends, for the Ride Fund's $5; saved on its own (set_ride_end_shop). */
  end_location_id: string | null
}

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '')

function blank(): Form {
  return {
    name: '', description: '', flyer_url: null,
    schedule: 'recurring', ride_date: '', frequency: 'weekly', days: [6], week_of_month: 1,
    season_start: '', season_end: '', start_time: '10:00', end_time: '',
    meetup_name: '', meetup_address: '', meetup_lat: null, meetup_lng: null,
    route: null, route_google_maps_url: '',
    activity: 'bike', pace: '', no_drop: false, tags: [],
    registration_url: '', contact_url: '', replies_to_organizer: false, live_sharing: 'members',
    visibility: 'public', event_organizer_id: '', organizer_name: '', organizer_url: '',
    end_location_id: null,
  }
}

function fromRow(r: RideRow): Form {
  return {
    name: r.name, description: r.description ?? '', flyer_url: r.flyer_url,
    schedule: r.ride_date ? 'one_time' : 'recurring', ride_date: r.ride_date ?? '',
    frequency: r.frequency, days: r.days ?? [], week_of_month: r.week_of_month ?? 1,
    season_start: r.season_start ?? '', season_end: r.season_end ?? '',
    start_time: hhmm(r.start_time), end_time: hhmm(r.end_time),
    meetup_name: r.meetup_name ?? '', meetup_address: r.meetup_address ?? '',
    meetup_lat: r.meetup_lat, meetup_lng: r.meetup_lng,
    route: draftOf(r),
    route_google_maps_url: r.route_google_maps_url ?? '',
    activity: r.activity === 'walk' ? 'walk' : 'bike',
    pace: r.pace ?? '', no_drop: !!r.no_drop, tags: r.tags ?? [],
    registration_url: r.registration_url ?? '', contact_url: r.contact_url ?? '',
    replies_to_organizer: !!r.replies_to_organizer,
    live_sharing: r.live_sharing ?? 'off',
    visibility: r.visibility === 'invite' ? 'invite' : 'public',
    event_organizer_id: r.event_organizer_id ?? '',
    organizer_name: r.organizer_name ?? '', organizer_url: r.organizer_url ?? '',
    end_location_id: r.end_location_id ?? null,
  }
}

function toPayload(f: Form): Record<string, unknown> {
  return {
    name: f.name, description: f.description, flyer_url: f.flyer_url,
    schedule: f.schedule, ride_date: f.ride_date || null, frequency: f.frequency,
    days: f.frequency === 'daily' ? [] : f.days, week_of_month: f.frequency === 'monthly' ? f.week_of_month : null,
    season_start: f.season_start || null, season_end: f.season_end || null,
    start_time: f.start_time, end_time: f.end_time || null,
    meetup_name: f.meetup_name, meetup_address: f.meetup_address, meetup_lat: f.meetup_lat, meetup_lng: f.meetup_lng,
    ...routePayload(f.route, f.route_google_maps_url),
    activity: f.activity, pace: f.pace || null, no_drop: f.no_drop, tags: f.tags,
    registration_url: f.registration_url, contact_url: f.contact_url, live_sharing: f.live_sharing,
    visibility: f.visibility, event_organizer_id: f.event_organizer_id || null,
    organizer_name: f.organizer_name, organizer_url: f.organizer_url,
  }
}

/**
 * The form's six parts, one at a time (Keith 2026-11-06: no totem-pole
 * pages). A new ride walks through them as steps, like the employer
 * challenge builder; an existing ride opens them as tabs. Only the first
 * three are needed; the rest are optional and say so.
 */
type Step = 'ride' | 'when' | 'where' | 'route' | 'expect' | 'share'
const STEPS: { id: Step; label: string; walkLabel?: string; short?: string; optional?: boolean }[] = [
  { id: 'ride', label: 'The ride', walkLabel: 'The walk' },
  { id: 'when', label: 'When' },
  { id: 'where', label: 'Meeting point' },
  { id: 'route', label: 'Route', optional: true },
  { id: 'expect', label: 'What to expect', optional: true },
  { id: 'share', label: 'Sign-ups and sharing', short: 'Sharing', optional: true },
]
const stepLabel = (s: (typeof STEPS)[number], walk: boolean) => (walk && s.walkLabel ? s.walkLabel : s.label)

/** What still stands between this form and a ride, in the app's words, and the step it's on. */
function blocking(f: Form): { step: Step; text: string } | null {
  if (!f.name.trim()) return { step: 'ride', text: f.activity === 'walk' ? 'Give the walk a name' : 'Give the ride a name' }
  if (f.schedule === 'one_time' && !f.ride_date) return { step: 'when', text: 'Pick a date' }
  if (f.schedule === 'recurring' && f.frequency !== 'daily' && f.days.length === 0) return { step: 'when', text: 'Pick at least one day' }
  if (!f.start_time) return { step: 'when', text: 'Pick a start time' }
  if (f.end_time && f.end_time <= f.start_time) return { step: 'when', text: 'Set "Back by" to after the start time' }
  if (f.schedule === 'recurring' && f.season_start && f.season_end && f.season_end < f.season_start) return { step: 'when', text: 'Set the season end after its start' }
  if (f.meetup_lat == null || f.meetup_lng == null) return { step: 'where', text: 'Pick a meeting point' }
  return null
}

const LINK_OK = (v: string, mail = false) => !v.trim() || (mail ? /^(https?:\/\/|mailto:)\S+$/i : /^https?:\/\/\S+$/i).test(v.trim())

/** The first step with a link to fix. */
function linkProblem(f: Form): Step | null {
  if (!LINK_OK(f.route_google_maps_url)) return 'route'
  if (!LINK_OK(f.registration_url) || !LINK_OK(f.contact_url, true)) return 'share'
  return null
}

/**
 * Steps across the top. A new ride: numbered steps with checks for the done
 * ones, the way the challenge builder shows them; on a phone, "Step 2 of 6"
 * with a bar. An existing ride: every part is a tab, at every width.
 */
function StepNav({ step, onStep, editing, walk, done }: { step: Step; onStep: (s: Step) => void; editing: boolean; walk: boolean; done: (s: Step) => boolean }) {
  const index = STEPS.findIndex((s) => s.id === step)
  if (editing) {
    return (
      <nav aria-label="Parts of the ride" className="mb-5">
        {/* Phones: all six parts as a 3 × 2 grid, none hidden off the edge. */}
        <ul className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-nowrap sm:gap-1 sm:overflow-x-auto sm:border-b sm:border-(--ev-line-mid) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STEPS.map((s) => {
            const on = s.id === step
            return (
              <li key={s.id}>
                <button type="button" onClick={() => onStep(s.id)} aria-current={on ? 'step' : undefined}
                  className={cx('flex min-h-[44px] w-full items-center justify-center rounded-[10px] border px-1 text-center text-[14px] font-semibold leading-tight sm:inline-flex sm:w-auto sm:whitespace-nowrap',
                    'sm:-mb-px sm:min-h-0 sm:rounded-none sm:border-0 sm:border-b-2 sm:bg-transparent sm:px-3 sm:py-2.5 sm:text-[15px]',
                    on
                      ? 'border-(--ev-accent-fill) bg-(--ev-accent-fill) text-(--ev-on-accent-fill) sm:border-(--ev-ink) sm:text-(--ev-ink)'
                      : 'border-(--ev-line-strong) bg-white text-(--ev-ink-85) hover:text-(--ev-ink) sm:border-transparent sm:text-(--ev-ink-75)')}>
                  <span className="sm:hidden">{s.short ?? stepLabel(s, walk)}</span>
                  <span className="hidden sm:inline">{stepLabel(s, walk)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    )
  }
  return (
    <nav aria-label="Steps" className="mb-5">
      <div className="sm:hidden">
        <p className="text-[15px] font-semibold text-(--ev-ink-85)">
          Step {index + 1} of {STEPS.length}{STEPS[index].optional ? ' · optional' : ''}
        </p>
        <div className="mt-2 grid grid-cols-6 gap-1" aria-hidden>
          {STEPS.map((s, i) => <span key={s.id} className={cx('h-1.5 rounded-full', i <= index ? 'bg-(--ev-ink)' : 'bg-(--ev-line-mid)')} />)}
        </div>
      </div>
      <ol className="hidden flex-wrap gap-x-5 gap-y-2 sm:flex">
        {STEPS.map((s, i) => {
          const here = s.id === step
          const reachable = i < index || done(s.id)
          return (
            <li key={s.id}>
              <button type="button" onClick={() => (reachable ? onStep(s.id) : undefined)} aria-current={here ? 'step' : undefined}
                disabled={!reachable && !here}
                className={cx('flex items-center gap-2 text-[14px] font-semibold disabled:cursor-default',
                  here ? 'text-(--ev-ink)' : reachable ? 'text-(--ev-ink-80) hover:text-(--ev-ink)' : 'text-(--ev-ink-75)')}>
                <span className={cx('grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold',
                  here ? 'bg-(--ev-ink) text-white' : i < index ? 'bg-(--ev-accent-tint-15) text-(--ev-ink)' : 'bg-(--ev-panel) text-(--ev-ink-75)')}>
                  {i < index ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> : i + 1}
                </span>
                {stepLabel(s, walk)}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** How the ride will read on its page, as the organizer fills it in (the challenge builder's live preview). */
function PreviewRow({ icon: Icon, children, empty }: { icon: typeof CalendarDays; children: ReactNode; empty?: boolean }) {
  return (
    <p className={cx('flex items-start gap-2.5 text-[15px]', empty ? 'text-(--ev-ink-75)' : 'font-semibold text-(--ev-ink)')}>
      <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-(--ev-ink-75)" aria-hidden />{children}
    </p>
  )
}

function Preview({ f, route, hostName }: { f: Form; route: RouteDraft | null; hostName: string | null }) {
  const walk = f.activity === 'walk'
  const sched = f.schedule === 'one_time'
    ? (f.ride_date ? scheduleText({ ride_date: f.ride_date, frequency: null, days: null, week_of_month: null, start_time: f.start_time || null }) : null)
    : (f.frequency === 'daily' || f.days.length
      ? scheduleText({ ride_date: null, frequency: f.frequency, days: f.days, week_of_month: f.week_of_month, start_time: f.start_time || null })
      : null)
  const miles = route && route.waypoints.length >= 2 ? routeMiles(route.waypoints) : null
  const calm = route?.comfortSegments?.length ? Math.round(comfortableShare(route.comfortSegments) * 100) : null
  const mph = travelMph(f.pace || null, f.activity)
  const pace = paceOptionsFor(f.activity).find((p) => p.key === f.pace)
  const initials = (hostName ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
  return (
    <aside className="hidden lg:block lg:sticky lg:top-[84px] lg:self-start" aria-label="Preview">
      <p className="mb-2 text-[14px] font-semibold text-(--ev-ink-75)">On your {walk ? 'walk' : 'ride'} page</p>
      <div className="overflow-hidden rounded-2xl border border-(--ev-line-mid) bg-white shadow-sm">
        <div className="bg-(--ev-panel) px-4 pb-4 pt-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-(--ev-ink) text-[13px] font-bold text-white">{initials || (walk ? <Footprints className="h-4 w-4" aria-hidden /> : <Bike className="h-4 w-4" aria-hidden />)}</span>
            <span className="text-[14px] font-semibold text-(--ev-ink-80)">{walk ? 'Group walk' : 'Group ride'}{hostName ? ` · ${hostName}` : ''}</span>
          </div>
          <p className={cx('mt-3 font-display text-[22px] font-extrabold leading-tight', f.name.trim() ? 'text-(--ev-ink)' : 'text-(--ev-ink-75)')}>
            {f.name.trim() || (walk ? 'Your walk’s name' : 'Your ride’s name')}
          </p>
        </div>
        <div className="grid gap-2.5 px-4 py-4">
          <PreviewRow icon={CalendarDays} empty={!sched}>{sched ?? 'When it happens'}</PreviewRow>
          <PreviewRow icon={MapPin} empty={!f.meetup_name && !f.meetup_address}>{f.meetup_name || f.meetup_address || 'Where people meet'}</PreviewRow>
        </div>
        <dl className="grid grid-cols-3 border-t border-(--ev-line)">
          {([
            ['Distance', miles ? `${miles.toFixed(1)} mi` : '–'],
            ['Calm streets', calm != null ? `${calm}%` : '–'],
            [walk ? 'Walking' : 'Pace', walk ? (miles ? `${Math.round((miles / 3) * 60)} min` : pace?.label ?? '–') : pace ? pace.mph : '–'],
          ] as const).map(([k, v], i) => (
            <div key={k} className={cx('px-3 py-3', i > 0 && 'border-l border-(--ev-line)')}>
              <dt className="text-[14px] font-semibold text-(--ev-ink-75)">{k}</dt>
              <dd className="font-display text-[18px] font-extrabold leading-tight text-(--ev-ink)">{v}</dd>
            </div>
          ))}
        </dl>
        {!walk && mph && miles && (
          <p className="border-t border-(--ev-line) px-4 py-2.5 text-[14px] text-(--ev-ink-80)">About {Math.round((miles / mph) * 60)} min of riding, plus stops</p>
        )}
      </div>
      <p className="mt-2 text-[14px] text-(--ev-ink-75)">
        {f.visibility === 'invite' ? 'Invite only: people need your link or code.' : 'Public: on the events calendar and in the Shift app.'}
      </p>
    </aside>
  )
}

export default function RideEditor({ ride, onSaved }: { ride: RideRow | null; onSaved?: () => Promise<void> }) {
  const router = useRouter()
  const { me, assistant } = useConsole()
  const draftKey = `shift-organizer-draft:${ride?.id ?? 'new'}`
  const initial = useMemo(() => (ride ? fromRow(ride) : blank()), [ride])
  const [f, setF] = useState<Form>(initial)
  const walk = f.activity === 'walk'
  const noun = walk ? 'walk' : 'ride'
  const [dirty, setDirty] = useState(false)
  const [restored, setRestored] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [tried, setTried] = useState(false)
  const [flyerBusy, setFlyerBusy] = useState(false)
  const [meetupFit, setMeetupFit] = useState(0)
  // The event, game or concert this ride goes to (Go Together, Shift 01460
  // and 01691). Saved on its own after the ride, as in the app, so a link
  // that fails never loses the ride.
  const [feedsTo, setFeedsToRaw] = useState<FeedTarget | null>(null)
  const feedsSaved = useRef<FeedTarget | null>(null)
  const setFeedsTo = (v: FeedTarget | null) => { setFeedsToRaw(v); setDirty(true) }
  useEffect(() => {
    if (!ride) return
    let live = true
    getSeriesDestination(ride.id).then((t) => {
      if (!live) return
      feedsSaved.current = t
      setFeedsToRaw(t)
    }, () => {})
    return () => { live = false }
  }, [ride?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // One part of the form at a time: steps for a new ride, tabs for an existing one.
  const [step, setStepRaw] = useState<Step>('ride')
  const setStep = useCallback((s: Step) => {
    setStepRaw(s)
    // The top of the new part, not wherever the last one was scrolled to.
    if (typeof window !== 'undefined' && window.scrollY > 200) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
  // A link to one part (the assistant's #sec-route) opens it.
  useEffect(() => {
    const h = window.location.hash.replace('#sec-', '')
    if (STEPS.some((s) => s.id === h)) setStepRaw(h as Step)
  }, [])
  // The season start before "Which week is first?" changed it, so its two
  // choices stay put after a pick (undefined until a pick).
  const [weekBase, setWeekBase] = useState<string | null | undefined>(undefined)
  const restoredOnce = useRef(false)
  // Arrived from a personal console link (FirstRide): ?first=1, and
  // ?from=calendar when the form is filled in from their calendar listing.
  const [first, setFirst] = useState(false)
  const [fromCalendar, setFromCalendar] = useState(false)

  // Unsaved work survives a closed tab or a lost sign-in.
  useEffect(() => {
    if (restoredOnce.current) return
    restoredOnce.current = true
    if (!ride) {
      const params = new URLSearchParams(window.location.search)
      const calendar = params.get('from') === 'calendar'
      if (calendar || params.get('first')) {
        setFirst(true)
        const url = new URL(window.location.href)
        url.searchParams.delete('from')
        url.searchParams.delete('first')
        window.history.replaceState({}, '', url.pathname + url.search + url.hash)
      }
      const prefill = calendar ? takePrefill() : null
      if (prefill) {
        setF({ ...blank(), ...prefill } as Form)
        setDirty(true)
        setFromCalendar(true)
        return
      }
    }
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const saved = JSON.parse(raw) as { form: Form; at: number }
      if (Date.now() - saved.at > 14 * 864e5) { localStorage.removeItem(draftKey); return }
      setF({ ...blank(), ...saved.form })
      setDirty(true)
      setRestored(true)
    } catch { /* storage unavailable */ }
  }, [draftKey, ride])

  // A route the assistant planned arrives as ?plan= (its stops in order, the
  // option picked for each leg and the pace): the route section re-plans it
  // (legs are cached, so it's quick) and opens on its street-by-street review.
  const [planned, setPlanned] = useState<{ stops: { lat: number; lng: number; label?: string }[]; chosen: number[] } | null>(null)
  const [plannedMoved, setPlannedMoved] = useState(false)
  // A route the organizer brought to the assistant: a GPX file it kept in
  // this browser (?import=<id>), or a Ride with GPS link (?rwgps=<url>).
  const [imported, setImported] = useState<{ kind: 'gpx'; route: { name: string | null; waypoints: { lat: number; lng: number }[]; elevation: RouteDraft['elevation'] } } | { kind: 'rwgps'; url: string } | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('import')
    const rw = params.get('rwgps')
    if (id && /^[a-z0-9]{6,24}$/.test(id)) {
      try {
        const raw = localStorage.getItem(ROUTE_IMPORT_KEY(id))
        if (raw) setImported({ kind: 'gpx', route: JSON.parse(raw) })
      } catch { /* storage unavailable: nothing to load */ }
    } else if (rw && /^https:\/\/(www\.)?ridewithgps\.com\//.test(rw)) {
      setImported({ kind: 'rwgps', url: rw })
    }
    if (id || rw) {
      setDirty(true)
      setStepRaw('route')
      const url = new URL(window.location.href)
      url.searchParams.delete('import')
      url.searchParams.delete('rwgps')
      window.history.replaceState({}, '', url.pathname + url.search + url.hash)
    }
  }, [])
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('plan')
    if (!raw) return
    try {
      const j = decodePlan(raw)
      if (!j) return
      const [lat, lng, label] = j.p[0]
      setF((prev) => {
        const moved = prev.meetup_lat == null || Math.abs(prev.meetup_lat - lat) > 0.0005 || Math.abs((prev.meetup_lng ?? 0) - lng) > 0.0005
        if (moved && prev.meetup_lat != null) setPlannedMoved(true)
        return {
          ...prev,
          ...(moved ? { meetup_lat: lat, meetup_lng: lng, meetup_name: label || prev.meetup_name, meetup_address: moved ? '' : prev.meetup_address } : {}),
          pace: prev.pace || (j.pace as Pace | null) || prev.pace,
          // A walk the assistant planned makes this a walk.
          ...(j.walk ? { activity: 'walk' as const } : {}),
        }
      })
      setPlanned({ stops: j.p.slice(1).map(([la, ln, lb]) => ({ lat: la, lng: ln, ...(lb ? { label: lb } : {}) })), chosen: Array.isArray(j.c) ? j.c : [] })
      setDirty(true)
      setStepRaw('route')
      const url = new URL(window.location.href)
      url.searchParams.delete('plan')
      window.history.replaceState({}, '', url.pathname + url.search + url.hash)
    } catch { /* a link that doesn't decode is ignored */ }
  }, [])

  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify({ form: f, at: Date.now() })) } catch { /* full or blocked */ }
    }, 500)
    return () => clearTimeout(t)
  }, [f, dirty, draftKey])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = useCallback(<K extends keyof Form>(k: K, v: Form[K]) => {
    setF((prev) => ({ ...prev, [k]: v }))
    setDirty(true)
  }, [])

  const discardDraft = () => {
    try { localStorage.removeItem(draftKey) } catch { /* ignore */ }
    setF(initial)
    setDirty(false)
    setRestored(false)
    setFromCalendar(false)
  }

  const orgs = me?.orgs ?? []
  const pickOrg = (picked: { id: string; name: string; url: string | null } | null) => {
    const org = picked ? orgs.find((o) => o.id === picked.id) : undefined
    setF((prev) => ({
      ...prev,
      event_organizer_id: picked?.id ?? '',
      organizer_name: picked ? picked.name : prev.organizer_name,
      organizer_url: picked ? (picked.url ?? '') : prev.organizer_url,
      // A new ride takes the organization's usual ride style, as the calendar does.
      ...(org && !ride ? {
        tags: Array.from(new Set([...prev.tags, ...org.ride_tags])),
        no_drop: prev.no_drop || org.rides_no_drop,
      } : {}),
    }))
    setDirty(true)
  }

  const block = blocking(f)
  const reason = block?.text ?? null
  const linkStep = linkProblem(f)

  async function save() {
    setTried(true)
    if (block || linkStep) {
      // Open the part that needs fixing.
      setStep(block?.step ?? linkStep!)
      setErr(reason ?? 'Links start with https://')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const res = await saveRide(ride?.id ?? null, toPayload(f))
      if ((f.end_location_id ?? null) !== (ride?.end_location_id ?? null)) {
        try {
          await setEndShop(res.id, f.end_location_id)
        } catch (e) {
          // A new ride exists now, so carry on; its stop can be set on its edit page.
          if (ride) {
            setErr(errorText(e, "The ride saved, but the stop at the end didn't. Try again."))
            setSaving(false)
            return
          }
        }
      }
      if ((feedsTo?.id ?? null) !== (feedsSaved.current?.id ?? null)) {
        try {
          await saveRideDestination(res.id, feedsTo, feedsSaved.current)
          feedsSaved.current = feedsTo
        } catch (e) {
          if (ride) {
            setErr(errorText(e, feedsTo ? `The ride saved, but it couldn't be linked to ${feedsTo.title}. Try again.` : "The ride saved, but the event link didn't come off. Try again."))
            setSaving(false)
            return
          }
        }
      }
      if (f.replies_to_organizer !== !!ride?.replies_to_organizer) {
        // A ride that saved without its replies setting still saved; say so.
        try { await setRepliesToOrganizer(res.id, f.replies_to_organizer) } catch (e) {
          if (ride) {
            setErr(errorText(e, "The ride saved, but the replies setting didn't. Try again."))
            setSaving(false)
            return
          }
        }
      }
      try { localStorage.removeItem(draftKey) } catch { /* ignore */ }
      setDirty(false)
      await onSaved?.().catch(() => {})
      router.push(`/organizers/rides/${res.id}?${res.created ? 'created' : 'saved'}=1`)
    } catch (e) {
      setErr(errorText(e, "We couldn't save the ride. Your changes are kept here; try again."))
      setSaving(false)
    }
  }

  async function onFlyer(file: File) {
    setFlyerBusy(true)
    setErr(null)
    try { set('flyer_url', await uploadFlyer(file)) } catch (e) { setErr(errorText(e)) } finally { setFlyerBusy(false) }
  }

  const meetup = f.meetup_lat != null && f.meetup_lng != null ? { lat: f.meetup_lat, lng: f.meetup_lng, label: f.meetup_name || undefined } : null
  // Where the ride ends: the route's last point, else the meeting point (a loop).
  const lastPoint = f.route && f.route.waypoints.length >= 2 ? f.route.waypoints[f.route.waypoints.length - 1] : null
  const rideEnd = lastPoint ? { lat: lastPoint.lat, lng: lastPoint.lng } : meetup ? { lat: meetup.lat, lng: meetup.lng } : null
  // A Ride Fund season covering the meeting point (Shift 01596) opens "The stop at the end".
  const fundKey = meetup ? `${meetup.lat.toFixed(2)},${meetup.lng.toFixed(2)}` : ''
  const [fundAt, setFundAt] = useState<{ key: string; fund: RideFundHere | null } | null>(null)
  const fund = fundKey && fundAt?.key === fundKey ? fundAt.fund : null
  useEffect(() => {
    if (!meetup) return
    let live = true
    getRideFundFor(meetup.lat, meetup.lng).then((r) => { if (live) setFundAt({ key: fundKey, fund: r ?? null }) }, () => {})
    return () => { live = false }
  }, [fundKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const showCoffee = !!fund || !!f.end_location_id
  const toggleDay = (d: number) => set('days', f.frequency === 'monthly' ? [d] : f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort())
  const weekdays = f.days.length === 5 && [1, 2, 3, 4, 5].every((d) => f.days.includes(d))

  // The first dates this schedule makes, by the server's own rules
  // (lib/organizers/schedule.ts), so nobody saves a ride to find its first
  // date isn't the one they meant.
  const today = todayKey()
  const sched = {
    ride_date: null, frequency: f.frequency, days: f.frequency === 'daily' ? [] : f.days,
    week_of_month: f.frequency === 'monthly' ? f.week_of_month : null,
    season_start: f.season_start || null, season_end: f.season_end || null,
    skip_dates: ride?.skip_dates ?? [], break_until: ride?.break_until ?? null, created_at: ride?.created_at ?? null,
  }
  const recurringReady = f.schedule === 'recurring' && (f.frequency === 'daily' || f.days.length > 0)
  const firstDates = recurringReady ? scheduleDates(sched, today, { limit: 4 }) : []
  // Every other week: which of the next two ride days comes first. The
  // server counts the weeks from the season start, so a pick sets it.
  const starts = recurringReady ? biweeklyStarts(weekBase === undefined ? sched : { ...sched, season_start: weekBase }, today) : null
  const pickWeek = (d: string) => {
    if (firstDates[0] === d) return
    if (weekBase === undefined) setWeekBase(f.season_start || null)
    set('season_start', d)
  }

  // The ride's next date, for "Going to an event?": the date itself, or the schedule's first.
  const nextDate = f.schedule === 'one_time' ? (f.ride_date && f.ride_date >= today ? f.ride_date : null) : (firstDates[0] ?? null)

  const stepIndex = STEPS.findIndex((s) => s.id === step)
  const last = stepIndex === STEPS.length - 1
  /** A step counts as done when nothing it asks for is missing. */
  const stepDone = (s: Step) => {
    if (block && STEPS.findIndex((x) => x.id === block.step) <= STEPS.findIndex((x) => x.id === s)) return false
    return true
  }
  // Continue checks only what this step asks for, so nobody is stopped by a later one.
  const next = () => {
    setTried(true)
    if (block && block.step === step) { setErr(block.text); return }
    if (linkStep === step) { setErr('Links start with https://'); return }
    setErr(null)
    setTried(false)
    setStep(STEPS[stepIndex + 1].id)
  }
  const hostPreview = f.event_organizer_id ? (f.organizer_name || null) : (me?.first_name ?? null)

  return (
    <div className="pb-28">
      <Link href={ride ? `/organizers/rides/${ride.id}` : '/organizers'} className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-(--ev-ink-80) hover:text-(--ev-ink)">
        <ArrowLeft className="h-4 w-4" aria-hidden />{ride ? ride.name : 'Your rides'}
      </Link>
      <h1 className="font-display text-[clamp(28px,3.6vw,38px)] font-extrabold leading-tight">{ride ? (walk ? 'Edit walk' : 'Edit ride') : first ? 'Make your first ride' : walk ? 'New walk' : 'New ride'}</h1>
      <p className="mt-1 max-w-2xl text-[15px] leading-snug text-(--ev-ink-80)">
        {ride
          ? 'Changes show on the ride page and in the app right away. To change one date only, open that date from Dates & updates.'
          : `A ${noun} you set up here shows up in the Shift app too, with a page you can share anywhere.`}
      </p>

      {!ride && assistant && (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-(--ev-accent-line-30) bg-white px-4 py-3 sm:flex-row sm:items-center">
          <p className="flex min-w-0 flex-1 items-start gap-2 text-[15px] text-(--ev-ink-85)"><MessageSquareText className="mt-0.5 h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden />Rather talk it through? The assistant asks a few questions and sets it up with you.</p>
          <Button size="sm" onClick={() => openAssistant('Plan a new ride with me')}>Plan it with the assistant</Button>
        </div>
      )}

      {fromCalendar && (
        <div className="mt-4">
          <Notice tone="good">
            Filled in from your listing on the GSI calendar. Check each part, then save.{' '}
            <button type="button" className="font-semibold underline" onClick={discardDraft}>Start from scratch instead</button>
          </Notice>
        </div>
      )}

      {restored && (
        <div className="mt-4">
          <Notice tone="info">
            We kept the changes you hadn&rsquo;t saved.{' '}
            <button type="button" className="font-semibold underline" onClick={discardDraft}>Start over instead</button>
          </Notice>
        </div>
      )}

      <div className="mt-6">
      <StepNav step={step} onStep={setStep} editing={!!ride} walk={walk} done={(s) => stepDone(s)} />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
      <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
        {step === 'ride' && (
        <Card id="sec-ride">
          <SectionTitle hint={ride ? undefined : `What it is and who it's from. Only the name is needed.`}>{walk ? 'The walk' : 'The ride'}</SectionTitle>
          <div className="grid gap-4">
            <Field label="Bike ride or walk">
              <div className="flex flex-wrap gap-2">
                <Toggle on={f.activity === 'bike'} onClick={() => set('activity', 'bike')}>Bike ride</Toggle>
                <Toggle on={f.activity === 'walk'} onClick={() => {
                  // Walks have no "fast" pace; brisk is the closest.
                  setF((prev) => ({ ...prev, activity: 'walk', pace: prev.pace === 'fast' ? 'brisk' : prev.pace }))
                  setDirty(true)
                }}>Walk</Toggle>
              </div>
            </Field>
            <Field label="Name" htmlFor="ride-name" error={tried && !f.name.trim() ? `Give the ${noun} a name` : null}>
              <Input id="ride-name" value={f.name} maxLength={120} onChange={(e) => set('name', e.target.value)} placeholder={walk ? 'Saturday Morning Walk' : 'Saturday Coffee Ride'} />
            </Field>
            <OrgPicker value={f.event_organizer_id} onPick={pickOrg} />
            <Field label="Description" htmlFor="ride-desc" optional hint="What it's like, where it goes, what to bring.">
              <Textarea id="ride-desc" value={f.description} maxLength={4000} onChange={(e) => set('description', e.target.value)} rows={5}
                placeholder={walk
                  ? 'An easy loop along the river with a coffee stop halfway. Comfortable shoes, and a layer after October.'
                  : 'An easy loop along the river with a coffee stop halfway. Bring lights after October.'} />
            </Field>
            <Field label="Flyer" optional hint="Shows on your ride page and in the app.">
              {f.flyer_url ? (
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.flyer_url} alt="Ride flyer" className="h-28 w-28 rounded-lg border border-(--ev-line-mid) object-cover" />
                  <Button size="sm" variant="ghost" onClick={() => set('flyer_url', null)}><Trash2 className="h-4 w-4" aria-hidden />Remove</Button>
                </div>
              ) : (
                <>
                  <input id="flyer" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) void onFlyer(file); e.target.value = '' }} />
                  <label htmlFor="flyer" className={cx('inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)', flyerBusy && 'pointer-events-none opacity-60')}>
                    <ImagePlus className="h-4 w-4" aria-hidden />{flyerBusy ? 'Uploading…' : 'Add a flyer'}
                  </label>
                </>
              )}
            </Field>
          </div>
        </Card>
        )}

        {step === 'when' && (
        <Card id="sec-when">
          <SectionTitle>When</SectionTitle>
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Schedule">
              <Toggle on={f.schedule === 'recurring'} onClick={() => set('schedule', 'recurring')}>Repeats</Toggle>
              <Toggle on={f.schedule === 'one_time'} onClick={() => set('schedule', 'one_time')}>One date</Toggle>
            </div>

            {f.schedule === 'one_time' ? (
              <Field label="Date" htmlFor="ride-date" error={tried && !f.ride_date ? 'Pick a date' : null}>
                <Input id="ride-date" type="date" value={f.ride_date} onChange={(e) => set('ride_date', e.target.value)} className="max-w-[220px]" />
              </Field>
            ) : (
              <>
                <Field label="How often" htmlFor="ride-freq">
                  <Select id="ride-freq" value={f.frequency} className="max-w-[260px]"
                    onChange={(e) => {
                      const v = e.target.value as Frequency
                      setF((p) => ({ ...p, frequency: v, days: v === 'monthly' ? p.days.slice(0, 1) : p.days }))
                      setDirty(true)
                    }}>
                    <option value="weekly">Every week</option>
                    <option value="biweekly">Every two weeks</option>
                    <option value="monthly">Once a month</option>
                    <option value="daily">Every day</option>
                  </Select>
                </Field>
                {f.frequency === 'monthly' && (
                  <Field label="Which week">
                    <div className="flex flex-wrap gap-2">
                      {WEEK_OPTIONS.map((w) => <Toggle key={w.key} on={f.week_of_month === w.key} onClick={() => set('week_of_month', w.key)}>{w.label}</Toggle>)}
                    </div>
                  </Field>
                )}
                {f.frequency !== 'daily' && (
                  <Field label={f.frequency === 'monthly' ? 'Day' : 'Days'} error={tried && f.days.length === 0 ? 'Pick at least one day' : null}>
                    <div className="flex flex-wrap gap-2">
                      {DAY_LABELS.map((d) => (
                        <Toggle key={d.key} on={f.days.includes(d.key)} onClick={() => toggleDay(d.key)} aria-label={d.long}>{d.short}</Toggle>
                      ))}
                      {f.frequency !== 'monthly' && (
                        <Button size="sm" variant="ghost" onClick={() => set('days', weekdays ? [] : [1, 2, 3, 4, 5])}>{weekdays ? 'Clear' : 'Weekdays'}</Button>
                      )}
                    </div>
                  </Field>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Season starts" htmlFor="season-start" optional hint="Leave empty to start now.">
                    <Input id="season-start" type="date" value={f.season_start} onChange={(e) => { setWeekBase(undefined); set('season_start', e.target.value) }} />
                  </Field>
                  <Field label="Season ends" htmlFor="season-end" optional hint="Leave empty to keep going.">
                    <Input id="season-end" type="date" value={f.season_end} onChange={(e) => set('season_end', e.target.value)} />
                  </Field>
                </div>
                {starts && (
                  <Field label="Which week is first?">
                    <div className="flex flex-wrap gap-2" role="group" aria-label="First week">
                      {starts.map((d) => (
                        <Toggle key={d} on={firstDates[0] === d} onClick={() => pickWeek(d)}>{dateLabel(d)}</Toggle>
                      ))}
                    </div>
                  </Field>
                )}
                {recurringReady && (
                  <div aria-live="polite">
                    <p className="text-[15px] font-semibold text-(--ev-ink-85)">First dates</p>
                    {firstDates.length > 0 ? (
                      <ul className="mt-1.5 flex flex-wrap gap-2">
                        {firstDates.map((d) => (
                          <li key={d} className="rounded-full border border-(--ev-line-mid) bg-(--ev-panel-faint) px-3 py-1 text-[14px] font-semibold text-(--ev-ink)">{dateLabel(d)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-0.5 text-[14px] text-(--ev-ink-75)">No dates in the next year. Check the season dates.</p>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts at" htmlFor="start-time">
                <Input id="start-time" type="time" value={f.start_time} onChange={(e) => set('start_time', e.target.value)} />
              </Field>
              <Field label="Back by" htmlFor="end-time" optional>
                <Input id="end-time" type="time" value={f.end_time} onChange={(e) => set('end_time', e.target.value)} />
              </Field>
            </div>
          </div>
        </Card>
        )}

        {step === 'where' && (
        <Card id="sec-where">
          <SectionTitle hint="Where people gather before you set off.">Meeting point</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="grid content-start gap-4">
              <Field label="Search for the place" error={tried && !meetup ? 'Pick a meeting point' : null}>
                <AddressAutocomplete
                  value={f.meetup_address}
                  onChange={(v) => set('meetup_address', v)}
                  onPlaceSelected={(p) => {
                    setF((prev) => ({
                      ...prev,
                      meetup_address: p.address,
                      meetup_lat: p.lat,
                      meetup_lng: p.lng,
                      meetup_name: prev.meetup_name || p.address.split(',')[0],
                    }))
                    setDirty(true)
                    setMeetupFit((k) => k + 1)
                  }}
                  label="Search for the place"
                  hideLabel
                  placeholder="Davis Square, or a street address"
                />
              </Field>
              <Field label="What to call it" htmlFor="meetup-name" hint="The spot people look for when they arrive.">
                <Input id="meetup-name" value={f.meetup_name} onChange={(e) => set('meetup_name', e.target.value)} placeholder="The bike racks by the Davis T entrance" />
              </Field>
              {meetup && <p className="text-[14px] text-(--ev-ink-75)">Tap or click the map to move the pin to the exact spot.</p>}
            </div>
            <RouteMap
              line={[]}
              stops={[]}
              meetup={meetup}
              pick
              onPick={(p) => { setF((prev) => ({ ...prev, meetup_lat: p.lat, meetup_lng: p.lng })); setDirty(true) }}
              fitKey={meetupFit}
              className="h-[260px] w-full overflow-hidden rounded-xl border border-(--ev-line-mid)"
              label="Meeting point map. Tap or click to place the pin."
            />
          </div>
        </Card>
        )}

        {/* Kept mounted while hidden: the planner's choices and stops survive a look at another step. */}
        <div hidden={step !== 'route'} className="grid grid-cols-[minmax(0,1fr)] gap-5">
        <Card id="sec-route">
          <SectionTitle hint={`Optional. With a route, people see how far, how hilly and how comfortable the ${noun} is before they come.`}>Route</SectionTitle>
          {plannedMoved && (
            <div className="mb-3"><Notice tone="info">The assistant&rsquo;s route starts somewhere else, so the meeting point moved there. Change it under Meeting point if that&rsquo;s not right.</Notice></div>
          )}
          <RouteSection route={f.route} onRoute={(r) => set('route', r)} meetup={meetup} pace={f.pace || null} activity={f.activity} initialPlan={planned} initialImport={imported}
            onMeetAtStart={(p) => {
              setF((prev) => ({ ...prev, meetup_lat: p.lat, meetup_lng: p.lng, meetup_address: '', meetup_name: prev.meetup_name ? '' : prev.meetup_name }))
              setDirty(true)
              setMeetupFit((k) => k + 1)
            }} />
          <div className="mt-4">
            <Field label="Link to the route elsewhere" htmlFor="route-link" optional hint="Strava, Komoot or Google Maps, shown as a link."
              error={!LINK_OK(f.route_google_maps_url) ? 'Links start with https://' : null}>
              <Input id="route-link" value={f.route_google_maps_url} onChange={(e) => set('route_google_maps_url', e.target.value)} placeholder="https://www.strava.com/routes/…" inputMode="url" />
            </Field>
          </div>
          {/* Live location sits with the route, on by default (Keith 2026-11-07:
              high value to ride leaders, and it was off and hidden). Same as the app. */}
          <div className="mt-5 rounded-xl border border-(--ev-line-mid) bg-(--ev-panel) p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={f.live_sharing !== 'off'}
                onChange={(e) => set('live_sharing', e.target.checked ? 'members' : 'off')}
                className="mt-1 h-5 w-5 accent-(--ev-accent-fill)" />
              <span>
                <span className="block text-[15px] font-semibold text-(--ev-ink)">Share where the group is on {noun} day</span>
                <span className="block text-[14px] text-(--ev-ink-75)">Anyone running late can find the group on the map.</span>
              </span>
            </label>
            {f.live_sharing !== 'off' && (
              <div className="mt-3 pl-8">
                <Field label="Who sees it" htmlFor="live">
                  <Select id="live" value={f.live_sharing} onChange={(e) => set('live_sharing', e.target.value as Form['live_sharing'])} className="max-w-[320px]">
                    <option value="members">People on this {noun}</option>
                    <option value="link">Anyone with the {noun} link</option>
                  </Select>
                </Field>
              </div>
            )}
          </div>
        </Card>

        {showCoffee && <EndShopCard at={rideEnd} value={f.end_location_id} onChange={(id) => set('end_location_id', id)} fund={fund} />}

        <GoingToEvent value={feedsTo} onChange={setFeedsTo} date={nextDate} at={rideEnd} seriesId={ride?.id ?? null} walk={walk} recurring={f.schedule === 'recurring'} />
        </div>

        {step === 'expect' && (
        <Card id="sec-expect">
          <SectionTitle hint={ride ? undefined : 'Optional. Helps people pick a ride that suits them.'}>What to expect</SectionTitle>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
            <Field label="Pace" hint={f.activity === 'walk' ? 'How quickly the group walks.' : 'The average speed the group holds while riding.'}>
              <div className="flex flex-wrap gap-2">
                <Toggle on={f.pace === ''} onClick={() => set('pace', '')}>Not stated</Toggle>
                {paceOptionsFor(f.activity).map((p) => (
                  <Toggle key={p.key} on={f.pace === p.key} onClick={() => set('pace', p.key)} className="py-1.5">
                    <span className="block leading-tight">{p.label}</span>
                    <span className="block text-[13px] font-medium leading-tight opacity-80">{p.mph}</span>
                  </Toggle>
                ))}
              </div>
            </Field>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={f.no_drop} onChange={(e) => set('no_drop', e.target.checked)} className="mt-1 h-5 w-5 accent-(--ev-accent-fill)" />
              <span>
                <span className="block text-[15px] font-semibold text-(--ev-ink)">Nobody gets dropped</span>
                <span className="block text-[14px] text-(--ev-ink-75)">The group waits or regroups so slower people stay with it.</span>
              </span>
            </label>
            <Field label="Tags" optional>
              <div className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map((t) => (
                  <Toggle key={t.key} on={f.tags.includes(t.key)} onClick={() => set('tags', f.tags.includes(t.key) ? f.tags.filter((x) => x !== t.key) : [...f.tags, t.key])}>{t.label}</Toggle>
                ))}
              </div>
            </Field>
          </div>
        </Card>
        )}

        {step === 'share' && (
        <Card id="sec-signup">
          <SectionTitle hint={ride ? undefined : `Optional. A new ${noun} is public unless you say otherwise.`}>Sign-ups and sharing</SectionTitle>
          <div className="grid gap-5">
            <Field label="Visibility">
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ['public', 'Public', 'On the Green Streets events calendar and in the app, straight away.'],
                  ['invite', 'Invite only', `Only people with your ${noun} link or code can find it.`],
                ] as const).map(([v, label, hint]) => (
                  <button key={v} type="button" aria-pressed={f.visibility === v} onClick={() => set('visibility', v)}
                    className={cx('rounded-xl border p-3 text-left transition', f.visibility === v ? 'border-(--ev-accent-fill) bg-(--ev-panel) ring-1 ring-(--ev-accent-fill)' : 'border-(--ev-line-strong) bg-white hover:bg-(--ev-panel-faint)')}>
                    <span className="block text-[15px] font-semibold text-(--ev-ink)">{label}</span>
                    <span className="mt-0.5 block text-[14px] leading-snug text-(--ev-ink-75)">{hint}</span>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Sign-up or waiver link" htmlFor="reg" optional hint="Do people also need to sign up or sign a waiver on your own site? Paste that page. For a regular ride, use one page that covers every date."
              error={!LINK_OK(f.registration_url) ? 'Links start with https://' : null}>
              <Input id="reg" value={f.registration_url} onChange={(e) => set('registration_url', e.target.value)} placeholder="https://…" inputMode="url" />
            </Field>
            <Field label="Your group chat" htmlFor="contact" optional hint="A WhatsApp, Signal, GroupMe or Discord invite link, or an email link. Only people you share it with, and anyone who came to one of your rides, get it."
              error={!LINK_OK(f.contact_url, true) ? 'Start with https:// or mailto:' : null}>
              <Input id="contact" value={f.contact_url} onChange={(e) => set('contact_url', e.target.value)} placeholder="https://chat.whatsapp.com/…" inputMode="url" />
            </Field>
            {/^https:\/\//i.test(f.contact_url.trim()) && (
              // Shift 01686: people hold their own Shift link to the chat, so a new link reaches everyone at once.
              <p className="-mt-2 text-[14px] text-(--ev-ink-75)">
                Getting spam requests? Reset the invite link in your chat app, then paste the new one here. Everyone you&rsquo;ve shared it with gets the new one.
              </p>
            )}
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={f.replies_to_organizer} onChange={(e) => set('replies_to_organizer', e.target.checked)} className="mt-1 h-5 w-5 accent-(--ev-accent-fill)" />
              <span>
                <span className="block text-[15px] font-semibold text-(--ev-ink)">Replies to my update emails come to me</span>
                <span className="block text-[14px] text-(--ev-ink-75)">People can answer an update by replying to its email. They&rsquo;ll see your sign-in email address.</span>
              </span>
            </label>
          </div>
        </Card>
        )}
      </div>
      <Preview f={f} route={f.route} hostName={hostPreview} />
      </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-(--ev-line) bg-(--ev-bar) backdrop-blur">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <p className={cx('mr-auto text-[14px]', err ? 'font-semibold text-(--ev-danger)' : 'text-(--ev-ink-75)')} role={err ? 'alert' : undefined}>
            {err ?? (reason ? `Still needed: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}` : dirty ? 'Unsaved changes' : ride ? 'No changes yet' : '')}
          </p>
          {ride ? (<>
            <Link href={`/organizers/rides/${ride.id}`} className="inline-flex min-h-[44px] items-center rounded-[10px] px-4 text-[15px] font-semibold text-(--ev-ink-85) hover:bg-(--ev-panel)">
              Cancel
            </Link>
            <Button variant="primary" onClick={() => void save()} busy={saving} disabled={!dirty}>Save changes</Button>
          </>) : (<>
            {stepIndex > 0 ? (
              <Button variant="ghost" onClick={() => setStep(STEPS[stepIndex - 1].id)}><ArrowLeft className="h-4 w-4" aria-hidden />Back</Button>
            ) : (
              <Link href="/organizers" className="inline-flex min-h-[44px] items-center rounded-[10px] px-4 text-[15px] font-semibold text-(--ev-ink-85) hover:bg-(--ev-panel)">Cancel</Link>
            )}
            {/* The rest is optional: once the needed parts are in, it can be made now. */}
            {!last && !block && stepIndex >= 2 && (
              <Button onClick={() => void save()} busy={saving}>{walk ? 'Create walk now' : 'Create ride now'}</Button>
            )}
            {last ? (
              <Button variant="primary" onClick={() => void save()} busy={saving}>{walk ? 'Create walk' : 'Create ride'}</Button>
            ) : (
              <Button variant="primary" onClick={next}>
                Next: {stepLabel(STEPS[stepIndex + 1], walk).toLowerCase()}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </>)}
        </div>
      </div>
    </div>
  )
}
