'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Bike, Bus, CheckCircle2, ChevronLeft, Clock, Compass, Flag, Footprints, LockOpen, MapPin, Pencil, Repeat, Signpost, TrainFront, Trees, type LucideIcon } from 'lucide-react'
import {
  ArrowBendUpLeft, ArrowsLeftRight, Barricade, Bus as BusGlyph, Car as CarGlyph, ChatText, CreditCard, LockKey, MapPinLine,
  Moon as MoonGlyph, Mountains, Octagon as OctagonGlyph, Path, PersonSimpleWalk, Prohibit, SignIn, SignOut, Signpost as SignpostGlyph,
  Square, Stairs, TrafficSignal, Train, Warning, type Icon as PhosphorIcon, type IconWeight,
} from '@phosphor-icons/react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import RouteMap from '@/components/organizers/RouteMap'
import RideStreets from '@/components/rides/RideStreets'
import { comfortPieces, type CalmOption, type CalmSegment } from '@/components/commute/calm-route'
import { comfortColor } from '@/lib/comfort-colors'
import { WAY_ICON } from '@/components/together/bits'
import { Button, Field, Input, Notice, Spinner, cx } from '@/components/organizers/ui'
import { SITE_LOCALE_TAG, type SiteLocale, type T } from '@/lib/site-i18n'
import type { PlanKey } from '@/lib/site-strings/together-plan'
import { fetchNearbyTransit, isRegionalStopId } from '@/lib/nearby/live-data'
import { bikeShareDocksNear, getBikeShareSystems } from '@/lib/nearby/bike-share-systems'
import { myRequests, track, type Match, type PartnerDay, type PartnerTime } from '@/lib/together'
import {
  MAX_NOTES, SKILLS, WORRIES, bikePassLeft, designRoute, lineKey, planAnchors, saveRidePlanRoute, setLessonPlanEnd, setRidePlanBike, setRidePlanWorriesOther,
  shareRidePlan, sharedWays, type LatLng, type Place, type Result, type RidePlan, type RidePlanView, type Spot, type TransitTrip, type TripWay,
} from '@/lib/together-plan'

/**
 * The two turns of a first trip plan that ask for answers, on the web
 * (parity gap-together-web-carpool-scope): the newcomer says where to start
 * (the app's LearnerShare in app/(details)/ride-plan.tsx) and the guide plans
 * the route (the app's GuidePlan). The same questions in the same order, the
 * same RPCs, and the website's own pieces for places and routes: the place
 * search (AddressAutocomplete), nearby stations and bike-share docks
 * (lib/nearby), the route planner and spots (the Shift assistant's
 * ride-plan tools, through /api/together/plan-route), the route map in
 * comfort colours (RouteMap, comfort-colors.ts) and the street-by-street
 * photos (RideStreets).
 */

const SECONDARY_LINK = 'min-h-[44px] text-left text-[15px] font-semibold text-(--ev-accent) underline underline-offset-2'
const pl = (t: T<PlanKey>, base: string, count: number, vars: Record<string, string | number> = {}) =>
  t(`${base}_${count === 1 ? 'one' : 'other'}` as PlanKey, { count, ...vars })
const k = (key: string) => key as PlanKey

/** Step n of total, Back, the question, and the one action at the bottom. */
function Step({ n, total, onBack, title, intro, children, action, t }: {
  /** Leave out for a step before the numbered ones (the lesson's place pick). */
  n?: number
  total?: number
  onBack?: () => void
  title: string
  intro?: string | null
  children: ReactNode
  action?: ReactNode
  t: T<PlanKey>
}) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex min-h-[44px] items-center gap-3">
        {onBack ? (
          <button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-semibold text-(--ev-ink-80)">
            <ChevronLeft className="h-4 w-4" aria-hidden /> {t('step.back')}
          </button>
        ) : null}
        {n != null && total ? (
          <>
            <span className="text-[14px] font-semibold text-(--ev-ink-80)">{t('step.of', { n, total })}</span>
            <span className="flex flex-1 gap-1" aria-hidden>
              {Array.from({ length: total }, (_, i) => (
                <span key={i} className={cx('h-1 flex-1 rounded-full', i < n ? 'bg-(--ev-accent)' : 'bg-(--ev-line-strong)')} />
              ))}
            </span>
          </>
        ) : null}
      </div>
      <h2 className="font-display text-[22px] font-extrabold leading-tight">{title}</h2>
      {intro ? <p className="text-[16px] text-(--ev-ink-85)">{intro}</p> : null}
      {children}
      {action ? <div className="flex flex-wrap items-center gap-3">{action}</div> : null}
    </div>
  )
}

/** A one-tap answer (the app's tiles): a full-width radio row with an icon. */
function Tile({ on, onClick, Icon, label, sub }: { on: boolean; onClick: () => void; Icon: LucideIcon; label: string; sub?: string | null }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cx(
        'flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
        on ? 'border-(--ev-accent-fill) bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'border-(--ev-line-strong) bg-white hover:bg-(--ev-panel)',
      )}
    >
      <Icon className={cx('h-6 w-6 shrink-0', on ? '' : 'text-(--ev-accent)')} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold">{label}</span>
        {sub ? <span className={cx('block text-[14px]', on ? '' : 'text-(--ev-ink-80)')}>{sub}</span> : null}
      </span>
      {on ? <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden /> : null}
    </button>
  )
}

function ChipToggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-[15px] font-semibold transition',
        on ? 'border-(--ev-accent-fill) bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'border-(--ev-line-strong) bg-white text-(--ev-ink-85) hover:bg-(--ev-panel)',
      )}
    >
      {children}
    </button>
  )
}

const SKILL_ICON: Record<string, LucideIcon> = {
  paths_only: Trees, streets_nervous: Signpost, streets_ok: Bike,
  walk_short: Footprints, walk_not_far: Footprints, walk_plenty: Footprints,
  transit_new: TrainFront, transit_not_this: Bus, transit_changes: Repeat,
}

export type Choice = Place & { walkMin?: number; miles?: number; icon?: 'dock' | 'station' }
const DOCK_METERS = 805 // half a mile, the app's DOCK_MILES
const walkMin = (miles: number) => Math.max(1, Math.round((miles / 3) * 60))
const same = (a: LatLng | null, b: LatLng) => !!a && Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lng - b.lng) < 1e-5

/**
 * A public spot near home or work, never the place itself (the app's
 * PlacePick): the nearest three stations as one-tap choices (rail first,
 * within 0.8 mi), or the bike-share docks on the bike share, and the
 * website's place search for any other public place. Also where a walk pair
 * meets (WalkMeetSpot) and a carpool's pickup (PickupCard).
 */
export function PlacePick({ anchor, near, value, onPick, choices, sub, t }: {
  anchor: LatLng | null
  /** Where the search ranks places from (the meeting spot for the end); the anchor when left out. */
  near?: LatLng | null
  value: Place | null
  onPick: (p: Place) => void
  choices?: Choice[]
  sub?: (c: Choice) => string | null
  t: T<PlanKey>
}) {
  const [found, setFound] = useState<Choice[] | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    if (choices || !anchor) return
    let alive = true
    fetchNearbyTransit(anchor.lat, anchor.lng)
      .then((r) => {
        if (!alive) return
        const stops = (r?.stops ?? []).filter((s) => s.distance_miles <= 0.8 && (s.agency === 'MBTA' || isRegionalStopId(s.id)))
        const rail = stops.filter((s) => s.routes.some((x) => x.route_type <= 2))
        const seen = new Set<string>()
        const out: Choice[] = []
        for (const s of [...(rail.length ? rail : stops)].sort((a, b) => a.distance_miles - b.distance_miles)) {
          if (seen.has(s.name)) continue
          seen.add(s.name)
          out.push({ lat: s.lat, lng: s.lng, label: s.name, walkMin: walkMin(s.distance_miles), icon: 'station' })
          if (out.length === 3) break
        }
        setFound(out)
      })
      .catch(() => { if (alive) setFound([]) })
    return () => { alive = false }
  }, [anchor?.lat, anchor?.lng, choices]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = choices ?? (anchor ? found : [])
  const custom = value && !(list ?? []).some((c) => same(value, c)) ? value : null
  return (
    <div className="grid grid-cols-1 gap-2" role="radiogroup">
      {list === null ? <Spinner /> : null}
      {(list ?? []).map((c) => (
        <Tile
          key={`${c.lat},${c.lng}`}
          on={same(value, c)}
          onClick={() => onPick({ lat: c.lat, lng: c.lng, label: c.label })}
          Icon={c.icon === 'dock' ? Bike : TrainFront}
          label={c.label}
          sub={sub ? sub(c) : c.walkMin ? pl(t, 'share.walk_min', c.walkMin) : null}
        />
      ))}
      {custom ? <Tile on onClick={() => {}} Icon={MapPin} label={custom.label} /> : null}
      <AddressAutocomplete
        value={q}
        onChange={setQ}
        label={t('share.search_place')}
        hideLabel
        placeholder={t('share.search_place')}
        includeAreas
        near={near ?? anchor}
        onPlaceSelected={(p) => {
          setQ('')
          onPick({ lat: p.lat, lng: p.lng, label: (p.address.split(',')[0] || p.address).trim().slice(0, 80) })
        }}
      />
    </div>
  )
}

// ── The newcomer says where to start ─────────────────────────────────────

type ShareStep = 'way' | 'skill' | 'bike' | 'worries' | 'meet' | 'end'

export function LearnerShare({ view, matchId, userId, name, t, onShared, onProblem }: {
  view: RidePlanView
  matchId: string
  userId: string | null
  name: string
  t: T<PlanKey>
  onShared: () => void
  onProblem: (r: Result) => void
}) {
  const ways = sharedWays(view)
  // Ask which way only when the two of them share more than one.
  const pickWay = ways.length > 1
  const [step, setStep] = useState(0)
  const [way, setWay] = useState<TripWay>(view.plan?.way ?? ways[0] ?? 'bike')
  const [wayChosen, setWayChosen] = useState(!!view.plan?.way)
  // A lesson (no account): stops near where the learner asked for the lesson; the end is a search.
  const lesson = view.lesson ?? null
  const [home, setHome] = useState<LatLng | null>(lesson?.anchor ?? null)
  const [work, setWork] = useState<LatLng | null>(null)
  const [skill, setSkill] = useState<string | null>(view.plan?.skill ?? null)
  const [worries, setWorries] = useState<string[]>(view.plan?.worries ?? [])
  // A lesson's learner can say what else, in their own words (01892).
  const [otherOn, setOtherOn] = useState(!!view.plan?.worries_other)
  const [other, setOther] = useState(view.plan?.worries_other ?? '')
  const [meet, setMeet] = useState<Place | null>(null)
  const [end, setEnd] = useState<Place | null>(null)
  // A lesson's learner may leave the place to the instructor (01891).
  const [noEnd, setNoEnd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [need, setNeed] = useState(false)
  // Bike-share stations near both ends: then ask which bike, and offer the stations (01680).
  const [docks, setDocks] = useState<{ home: Choice[]; work: Choice[]; system: string; systemName: string } | null>(null)
  const [bike, setBike] = useState<'own' | 'share' | null>(view.plan?.bike ?? null)
  const [passFree, setPassFree] = useState(false)

  const askBike = way === 'bike' && !!docks
  const share = askBike && bike === 'share'
  const names: ShareStep[] = [...(pickWay ? ['way' as const] : []), 'skill', ...(askBike ? ['bike' as const] : []), 'worries', 'meet', 'end']
  const total = names.length
  const current = names[Math.min(step, total - 1)]
  const currentRef = useRef<ShareStep>(current)
  useEffect(() => { currentRef.current = current })

  // Anchor on the trip they asked for help with; Home and Work otherwise.
  useEffect(() => {
    if (!userId || lesson) return
    let alive = true
    myRequests()
      .then((rs) => rs.find((r) => r.kind === 'newcomer' && r.status !== 'closed') ?? null)
      .catch(() => null)
      .then((req) => planAnchors(userId, req))
      .then(({ home: h, work: w }) => { if (alive) { setHome(h); setWork(w) } })
      .catch(() => {})
    return () => { alive = false }
  }, [userId, lesson])

  useEffect(() => {
    if (!home || !work) return
    let alive = true
    Promise.all([bikeShareDocksNear(home.lat, home.lng, DOCK_METERS), bikeShareDocksNear(work.lat, work.lng, DOCK_METERS)])
      .then(([h, w]) => {
        // Stations that arrive late never add a step behind someone already past the first question.
        if (!alive || (currentRef.current !== 'way' && currentRef.current !== 'skill')) return
        const system = h[0]?.system_id
        const near = (list: typeof h): Choice[] => list
          .filter((s) => s.distance_meters <= DOCK_METERS && s.system_id === system)
          .slice(0, 3)
          .map((s) => ({ lat: s.lat, lng: s.lng, label: s.name, walkMin: walkMin(s.distance_meters / 1609.34), icon: 'dock' as const }))
        const hn = near(h)
        const wn = near(w)
        if (system && hn.length && wn.length) setDocks({ home: hn, work: wn, system, systemName: h[0].system_name ?? t('share.bike_share') })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [home?.lat, home?.lng, work?.lat, work?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  // "Your first Day Pass is on us" on the bike-share choice, while a pass is left.
  useEffect(() => {
    if (!docks) return
    let alive = true
    bikePassLeft(matchId, docks.system).then((v) => { if (alive) setPassFree(v) }).catch(() => {})
    return () => { alive = false }
  }, [docks?.system, matchId]) // eslint-disable-line react-hooks/exhaustive-deps

  const advance = (to: number) => window.setTimeout(() => setStep(to), 200)
  const back = step > 0 ? () => setStep(step - 1) : undefined
  const intro = t(askBike ? 'share.share_intro_few' : pickWay ? 'share.share_intro_five' : 'share.share_intro', { name })

  async function send() {
    if (!meet || (!end && !(lesson && noEnd))) { setNeed(true); return }
    setBusy(true)
    const r = await shareRidePlan(matchId, { way, skill, worries, meet, end: noEnd ? null : end })
    if (r.ok) {
      const nextBike = askBike ? bike : null
      if (nextBike !== (view.plan?.bike ?? null) || nextBike === 'share') {
        await setRidePlanBike(matchId, nextBike, nextBike === 'share' ? docks!.system : null).catch(() => null)
      }
      if (lesson) await setRidePlanWorriesOther(matchId, otherOn ? other : null).catch(() => null)
    }
    setBusy(false)
    if (!r.ok) return onProblem(r)
    track('together_plan_shared', { way, skill, worries: worries.length, bike: askBike ? bike : null, no_end: noEnd })
    onShared()
  }

  if (current === 'way') {
    return (
      <Step n={1} total={total} title={t('share.way_q')} intro={intro} t={t}>
        <div className="grid grid-cols-1 gap-2" role="radiogroup">
          {ways.map((w) => (
            <Tile
              key={w}
              on={wayChosen && way === w}
              Icon={WAY_ICON[w]}
              label={t(k(`share.way_${w}`))}
              onClick={() => {
                if (w !== way) { setSkill(null); setWorries([]) }
                setWay(w)
                setWayChosen(true)
                advance(1)
              }}
            />
          ))}
        </div>
      </Step>
    )
  }
  if (current === 'skill') {
    return (
      <Step n={step + 1} total={total} onBack={back} title={t(k(way === 'bike' ? 'share.skill_q' : `share.skill_q_${way}`))} intro={pickWay ? null : intro} t={t}>
        <div className="grid grid-cols-1 gap-2" role="radiogroup">
          {SKILLS[way].map((s) => (
            <Tile key={s} on={skill === s} Icon={SKILL_ICON[s] ?? MapPin} label={t(k(`share.skill_${s}`))} onClick={() => { setSkill(s); advance(step + 1) }} />
          ))}
        </div>
      </Step>
    )
  }
  if (current === 'bike' && docks) {
    return (
      <Step n={step + 1} total={total} onBack={back} title={t('share.bike_q')} t={t}>
        <div className="grid grid-cols-1 gap-2" role="radiogroup">
          {(['own', 'share'] as const).map((b) => (
            <Tile
              key={b}
              on={bike === b}
              Icon={b === 'own' ? Bike : LockOpen}
              label={b === 'own' ? t('share.bike_own') : docks.systemName}
              sub={b === 'share' ? (passFree ? t('share.bike_share_free') : pl(t, 'share.bike_share_near', docks.home[0].walkMin ?? 1)) : null}
              onClick={() => {
                // Stations and other places don't carry over between the two.
                if (b !== bike) { setMeet(null); setEnd(null) }
                if (b === 'share') setWorries((w) => w.filter((x) => x !== 'locking'))
                setBike(b)
                advance(step + 1)
              }}
            />
          ))}
        </div>
      </Step>
    )
  }
  if (current === 'worries') {
    const options = share ? WORRIES[way].filter((w) => w !== 'locking') : WORRIES[way]
    return (
      <Step
        n={step + 1}
        total={total}
        onBack={back}
        title={t('share.worries_q')}
        t={t}
        action={<Button variant="primary" onClick={() => setStep(step + 1)}>{t(worries.length || (otherOn && other.trim()) ? 'share.next' : 'share.skip')}</Button>}
      >
        <p className="text-[15px] text-(--ev-ink-80)">{t('share.pick_any')}</p>
        <div className="flex flex-wrap gap-2">
          {options.map((w) => (
            <ChipToggle key={w} on={worries.includes(w)} onClick={() => setWorries((list) => (list.includes(w) ? list.filter((x) => x !== w) : [...list, w]))}>
              {t(k(`share.worry_${w}`))}
            </ChipToggle>
          ))}
          {lesson ? <ChipToggle on={otherOn} onClick={() => setOtherOn((v) => !v)}>{t('share.worry_other')}</ChipToggle> : null}
        </div>
        {lesson && otherOn ? (
          <Input
            value={other}
            onChange={(e) => setOther(e.target.value)}
            maxLength={120}
            placeholder={t('share.worry_other_placeholder')}
            aria-label={t('share.worry_other_placeholder')}
            autoFocus
          />
        ) : null}
      </Step>
    )
  }
  const hintWay = way === 'transit' ? '_transit' : ''
  if (current === 'meet') {
    return (
      <Step
        n={step + 1}
        total={total}
        onBack={back}
        title={t('share.meet_q')}
        t={t}
        action={<Button variant="primary" disabled={!meet} onClick={() => setStep(step + 1)}>{t('share.next')}</Button>}
      >
        <p className="text-[15px] text-(--ev-ink-80)">{share ? t('share.meet_hint_share', { system: docks!.systemName }) : t(k(`share.meet_hint${hintWay}`))}</p>
        <PlacePick key="meet" anchor={home} value={meet} onPick={setMeet} choices={share ? docks!.home : undefined} t={t} />
      </Step>
    )
  }
  return (
    <Step
      n={total}
      total={total}
      onBack={back}
      title={t(lesson ? 'lesson.end_q' : way === 'bike' ? 'share.end_q' : 'share.end_q_trip')}
      t={t}
      action={<Button variant="primary" busy={busy} disabled={!end && !(lesson && noEnd)} onClick={() => void send()}>{t('share.share_send', { name })}</Button>}
    >
      <p className="text-[15px] text-(--ev-ink-80)">{share ? t('share.end_hint_share', { system: docks!.systemName }) : lesson ? t('lesson.end_hint', { name }) : t(k(`share.end_hint${hintWay}`))}</p>
      <PlacePick key="end" anchor={work} near={work ?? meet} value={noEnd ? null : end} onPick={(p) => { setEnd(p); setNoEnd(false) }} choices={share ? docks!.work : undefined} t={t} />
      {lesson ? <Tile on={noEnd} Icon={Compass} label={t('lesson.no_end')} sub={t('lesson.no_end_sub', { name })} onClick={() => { setNoEnd(true); setNeed(false) }} /> : null}
      {need ? <p className="text-[15px] font-semibold">{t('share.need_spots')}</p> : null}
    </Step>
  )
}

// ── The guide plans the route ────────────────────────────────────────────

/** The app's spot icons (components/partners/ride-plan/SpotIcon.tsx), so a spot looks the same in the app, here and on the map. */
const SPOT_GLYPH: Record<string, [PhosphorIcon, IconWeight]> = {
  signal: [TrafficSignal, 'bold'], stop: [OctagonGlyph, 'fill'], bike_box: [Square, 'bold'], door_zone: [CarGlyph, 'fill'],
  tracks: [Train, 'bold'], bus_stop: [BusGlyph, 'fill'], left_turn: [ArrowBendUpLeft, 'bold'], lock_up: [LockKey, 'fill'],
  steep: [Mountains, 'fill'], wrong_way: [Prohibit, 'bold'], crossing: [Warning, 'fill'], walk_signal: [PersonSimpleWalk, 'bold'],
  crossing_open: [Warning, 'fill'], path: [Path, 'bold'], steps: [Stairs, 'bold'], no_sidewalk: [Barricade, 'fill'], dark: [MoonGlyph, 'fill'],
  entrance: [SignIn, 'bold'], pay: [CreditCard, 'fill'], platform: [SignpostGlyph, 'fill'], transfer: [ArrowsLeftRight, 'bold'],
  your_stop: [MapPinLine, 'fill'], bus_board: [BusGlyph, 'fill'], exit: [SignOut, 'bold'],
}
export function SpotIcon({ kind, className }: { kind: string; className?: string }) {
  const [Glyph, weight] = SPOT_GLYPH[kind] ?? [ChatText, 'fill' as IconWeight]
  return <Glyph className={className} weight={weight} aria-hidden />
}
/**
 * A spot's Street View photo, as the rider comes up to it: taken about 35 m
 * back along the route, facing the spot (/api/nearby/corridor-photo, the same
 * source as the street photos). At the very start of the route there is no
 * "back", so it stands at the spot and faces along the route.
 */
type LL = { lat: number; lng: number }
const metres = (a: LL, b: LL) => {
  const k = Math.PI / 180
  const x = (b.lng - a.lng) * k * Math.cos(((a.lat + b.lat) / 2) * k)
  return Math.hypot(x, (b.lat - a.lat) * k) * 6371000
}
const bearing = (a: LL, b: LL) => {
  const k = Math.PI / 180
  const dLng = (b.lng - a.lng) * k
  const y = Math.sin(dLng) * Math.cos(b.lat * k)
  const x = Math.cos(a.lat * k) * Math.sin(b.lat * k) - Math.sin(a.lat * k) * Math.cos(b.lat * k) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}
export function spotPhotoUrl(spot: LL, line: LL[] | undefined): string {
  let view: LL & { heading?: number } = { lat: spot.lat, lng: spot.lng }
  if (line && line.length > 1) {
    let i = 0
    line.forEach((p, n) => { if (metres(p, spot) < metres(line[i], spot)) i = n })
    let j = i
    let back = 0
    while (j > 0 && back < 35) { back += metres(line[j - 1], line[j]); j-- }
    if (back >= 15) view = { lat: line[j].lat, lng: line[j].lng, heading: bearing(line[j], spot) }
    else {
      let k = i
      while (k < line.length - 1 && metres(line[i], line[k]) < 20) k++
      if (k > i) view = { ...view, heading: bearing(line[i], line[k]) }
    }
  }
  const q = new URLSearchParams({ lat: view.lat.toFixed(5), lng: view.lng.toFixed(5) })
  if (view.heading !== undefined) q.set('heading', String(Math.round(view.heading)))
  return `/api/nearby/corridor-photo?${q}`
}

/**
 * A spot's photo in a list: a thumbnail with the spot's icon (or number) on
 * its corner; tapping it opens it full width under the row. With no Street
 * View there, just the icon, as before.
 */
export function SpotThumb({ spot, line, alt, badge, open, onToggle, iconClass }: {
  spot: Spot
  line: LL[] | undefined
  alt: string
  /** The number from the map, on the corner (the learner's list). */
  badge?: number
  open: boolean
  onToggle: () => void
  /** The icon circle's colours when there is no photo. */
  iconClass: string
}) {
  const [failed, setFailed] = useState(false)
  const num = badge != null ? (
    <span aria-hidden className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#9A5B00] px-1 text-[12px] font-extrabold leading-none text-white">{badge}</span>
  ) : null
  if (failed) {
    return (
      <span className={cx('relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full', iconClass)}>
        <SpotIcon kind={spot.kind} className="h-5 w-5" />
        {num}
      </span>
    )
  }
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} aria-label={alt}
      className={cx('relative h-12 w-[72px] shrink-0 rounded-lg bg-(--ev-panel) p-0', open && 'ring-2 ring-[#191A2E] ring-offset-1')}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={spotPhotoUrl(spot, line)} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full rounded-lg object-cover" />
      <span aria-hidden className="absolute -bottom-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-white text-(--ev-ink-85) shadow-sm">
        <SpotIcon kind={spot.kind} className="h-3.5 w-3.5" />
      </span>
      {num}
    </button>
  )
}

/** The open photo, full width under its row, with the Street View credit. */
export function SpotPhotoBig({ spot, line, alt, credit }: { spot: Spot; line: LL[] | undefined; alt: string; credit: string }) {
  return (
    <figure className="m-0 grid grid-cols-1 gap-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={spotPhotoUrl(spot, line)} alt={alt} className="aspect-[16/9] w-full rounded-lg object-cover" />
      <figcaption className="text-[13px] text-(--ev-ink-75)">{credit}</figcaption>
    </figure>
  )
}
const stopName = (n: string | null | undefined) => (n ?? '').replace(/\s+@\s+/g, ' & ')

/** What a spot says in the guide's list (the app's spotWords, title and the line under it). */
export function spotWords(t: T<PlanKey>, s: Spot, trip: TransitTrip | null | undefined): { title: string; sub: string | null } {
  const streets = s.streets.length ? s.streets.join(' & ') : null
  const leg = s.leg != null ? trip?.legs[s.leg] : undefined
  const line = leg ? leg.line ?? leg.short ?? '' : ''
  const toward = leg?.headsign ? `${line} · ${leg.headsign}` : line || null
  switch (s.kind) {
    case 'entrance': return { title: t('spot.entrance'), sub: stopName(s.title ?? leg?.board?.name) || null }
    case 'pay': return { title: t('spot.pay'), sub: trip?.fare ?? null }
    case 'platform': return { title: t('spot.platform'), sub: toward }
    case 'bus_board': return { title: t('spot.bus_board'), sub: toward }
    case 'transfer': return { title: t('spot.transfer_at', { stop: stopName(s.title ?? leg?.board?.name) }), sub: toward }
    case 'your_stop': return { title: t('spot.your_stop_at', { stop: stopName(s.title ?? leg?.alight?.name) }), sub: null }
    case 'exit': return { title: t('spot.exit'), sub: stopName(s.title) || null }
    default: return { title: t(k(`spot.${s.kind}`)), sub: streets }
  }
}

const ORDER: PartnerDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const TIME_ORDER: PartnerTime[] = ['morning', 'midday', 'evening']
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** The lesson's free-time cells ('sat-am', 'wed-eve') to a start: morning 10:00, afternoon 2:00, evening 5:30. */
const CELL_DAY: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
const CELL_TIME: Record<string, string> = { am: '10:00', pm: '14:00', eve: '17:30' }
const SLOT_ORDER = ['am', 'pm', 'eve']

/** The next time the learner said they're free, two days out or later (a day's notice for both), within two weeks. */
function nextFreeTime(cells: string[], from: Date): { day: string; time: string } | null {
  const ok = cells.map((c) => c.split('-')).filter(([d, s]) => d in CELL_DAY && s in CELL_TIME)
  if (!ok.length) return null
  for (let i = 2; i <= 15; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
    const slots = ok.filter(([cd]) => CELL_DAY[cd] === d.getDay()).map(([, s]) => s)
    const slot = SLOT_ORDER.find((s) => slots.includes(s))
    if (slot) return { day: ymd(d), time: CELL_TIME[slot] }
  }
  return null
}

/** A start time from the newcomer's usual time of day: morning 8:00, midday 12:00, evening 17:30, weekends 10:00 (usualStart). */
function usualStart(days: PartnerDay[], times: PartnerTime[]): string | null {
  const first = TIME_ORDER.find((x) => times.includes(x))
  const weekendOnly = days.length > 0 && days.every((d) => d === 'sat' || d === 'sun')
  if (!first && !weekendOnly) return null
  return first === 'evening' ? '17:30' : first === 'midday' ? '12:00' : weekendOnly ? '10:00' : '08:00'
}

/** "Clara usually goes on weekdays, in the morning." (usualLine). */
function usualLine(t: T<PlanKey>, name: string, days: PartnerDay[], times: PartnerTime[]): string | null {
  const set = new Set(days)
  let dayWords: string | null = null
  if (set.size && set.size < 7) {
    if (set.size === 5 && ORDER.slice(0, 5).every((d) => set.has(d))) dayWords = t('share.usual_weekdays')
    else if (set.size === 2 && set.has('sat') && set.has('sun')) dayWords = t('share.usual_weekends')
    else dayWords = t('share.usual_on_days', { days: ORDER.filter((d) => set.has(d)).map((d) => t(k(`day.${d}`))).join(', ') })
  }
  const list = TIME_ORDER.filter((x) => times.includes(x))
  const timeWords = list.length && list.length < 3 ? list.map((x) => t(k(`share.usual_time_${x}`))).join(` ${t('share.usual_or')} `) : null
  if (dayWords && timeWords) return t('share.usually_days_times', { name, days: dayWords, times: timeWords })
  if (dayWords) return t('share.usually_days', { name, days: dayWords })
  if (timeWords) return t('share.usually_times', { name, times: timeWords })
  return null
}

type Route = NonNullable<RidePlan['route']>
type Trip = TransitTrip & { key: string; route: Route; spots: Spot[] }
const GOALS = ['calmest', 'flattest', 'shortest'] as const

/**
 * What the newcomer answered, for the guide, in sentences about them ("Robin
 * can ride on streets, but gets nervous there."), never the answer buttons'
 * own words (Keith 2026-11-23: "shorthand that you understand but the reader
 * won't").
 */
export function LearnerSaid({ plan, name, systemName, t }: { plan: RidePlan; name: string; systemName?: string | null; t: T<PlanKey> }) {
  const way = plan.way ?? 'bike'
  return (
    <div className="grid grid-cols-1 gap-2 rounded-xl bg-(--ev-panel) p-4">
      <p className="text-[14px] font-bold text-(--ev-ink-80)">{t('share.told_heading', { name })}</p>
      {plan.skill ? <p className="text-[16px] font-semibold">{t(k(`share.told_${plan.skill}`), { name })}</p> : null}
      {way === 'bike' && plan.bike === 'share' ? (
        <p className="flex items-center gap-2 text-[15px]"><LockOpen className="h-4 w-4 shrink-0 text-(--ev-accent)" aria-hidden />{t('share.told_share', { name, system: systemName ?? t('share.bike_share') })}</p>
      ) : null}
      {plan.worries?.length || plan.worries_other ? (
        <>
          <p className="text-[16px]">{t('share.told_worries', { name })}</p>
          <div className="flex flex-wrap gap-2">
            {(plan.worries ?? []).map((w) => (
              <span key={w} className="inline-flex min-h-[32px] items-center rounded-full border border-(--ev-line-strong) bg-white px-3 text-[14px] font-semibold">{t(k(`share.worry_${w}`))}</span>
            ))}
            {plan.worries_other ? (
              <span className="inline-flex min-h-[32px] items-center rounded-full border border-(--ev-line-strong) bg-white px-3 py-1 text-[14px] font-semibold">{plan.worries_other}</span>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}

/**
 * A lesson's learner had no place in mind (01891): the instructor picks where
 * the lesson goes first, from rail stations 0.3 to 2 miles from the meeting
 * spot or the place search, then plans the route as usual.
 */
export function LessonEndPick({ plan, matchId, name, t, onSet, onProblem }: {
  plan: RidePlan
  matchId: string
  name: string
  t: T<PlanKey>
  onSet: () => void
  onProblem: (r: Result) => void
}) {
  const meet = plan.meet_lat != null && plan.meet_lng != null ? { lat: plan.meet_lat, lng: plan.meet_lng } : null
  const meetLabel = plan.meet_label ?? ''
  const [choices, setChoices] = useState<Choice[] | null>(null)
  const [end, setEnd] = useState<Place | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!meet) return
    let alive = true
    fetchNearbyTransit(meet.lat, meet.lng)
      .then((r) => {
        if (!alive) return
        const seen = new Set<string>([meetLabel])
        const out: Choice[] = []
        const rail = (r?.stops ?? [])
          .filter((s) => s.distance_miles >= 0.3 && s.distance_miles <= 2 && s.routes.some((x) => x.route_type <= 2))
          .sort((a, b) => a.distance_miles - b.distance_miles)
        for (const s of rail) {
          if (seen.has(s.name)) continue
          seen.add(s.name)
          out.push({ lat: s.lat, lng: s.lng, label: s.name, icon: 'station', miles: Math.round(s.distance_miles * 10) / 10 })
          if (out.length === 3) break
        }
        setChoices(out)
      })
      .catch(() => { if (alive) setChoices([]) })
    return () => { alive = false }
  }, [meet?.lat, meet?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!end) return
    setBusy(true)
    const r = await setLessonPlanEnd(matchId, end)
    setBusy(false)
    if (!r.ok) return onProblem(r)
    track('together_lesson_end_picked', {})
    onSet()
  }

  return (
    <Step
      title={t('lesson.pick_end_title')}
      t={t}
      action={<Button variant="primary" busy={busy} disabled={!end} onClick={() => void save()}>{t('share.next')}</Button>}
    >
      <LearnerSaid plan={plan} name={name} t={t} />
      <p className="text-[16px]">{t('lesson.pick_end_hint', { name, meet: meetLabel })}</p>
      {choices === null ? <Spinner /> : null}
      {choices !== null ? (
        <PlacePick anchor={meet} value={end} onPick={setEnd} choices={choices} t={t} sub={(c) => (c.miles ? t('lesson.miles', { n: String(c.miles), meet: meetLabel }) : null)} />
      ) : null}
    </Step>
  )
}

export function GuidePlan({ plan, match, matchId, lesson = false, free, name, locale, t, onSent, onProblem }: {
  plan: RidePlan
  match: Match | null
  /** A free street lesson's plan: titled as the lesson. */
  lesson?: boolean
  /** A lesson learner's free times ('sat-am', 'wed-eve'), to fill in the day and time (01893). */
  free?: string[]
  matchId: string
  name: string
  locale: SiteLocale
  t: T<PlanKey>
  onSent: () => void
  onProblem: (r: Result) => void
}) {
  const meet = { lat: plan.meet_lat!, lng: plan.meet_lng! }
  const end = { lat: plan.end_lat!, lng: plan.end_lng! }
  const way: TripWay = plan.way ?? 'bike'
  const transit = way === 'transit'
  const [step, setStep] = useState(0)
  const [route, setRoute] = useState<Route | null>(plan.route as Route | null)
  const [spots, setSpots] = useState<Spot[]>(plan.spots ?? [])
  const [primary, setPrimary] = useState<Set<string>>(() => new Set((plan.spots ?? []).filter((s) => s.on).map((s) => s.id)))
  const [goal, setGoal] = useState<(typeof GOALS)[number]>('calmest')
  const [finding, setFinding] = useState(transit || !plan.route)
  const [noRoute, setNoRoute] = useState(false)
  const [incomplete, setIncomplete] = useState(false)
  const [trips, setTrips] = useState<Trip[] | null>(null)
  const [showMore, setShowMore] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  // The spot whose Street View photo is open full width.
  const [photoOpen, setPhotoOpen] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  // A route and time the assistant put on the plan, not sent yet (01611): the plan opens on them.
  const draftAt = plan.status === 'learner_shared' && plan.route && plan.ride_at ? new Date(plan.ride_at) : null
  const theirDays = match?.other.days ?? []
  const theirTimes = match?.other.time_of_day ?? []
  const usual = usualLine(t, name, theirDays, theirTimes)
  // A lesson opens on the next time the learner said they're free (Keith 2026-11-23: "Next, Next, Send").
  const [freeNext] = useState(() => (lesson && !draftAt ? nextFreeTime(free ?? [], new Date()) : null))
  const [day, setDay] = useState(() => (draftAt && draftAt.getTime() > Date.now() ? ymd(draftAt) : freeNext?.day ?? ''))
  const [time, setTime] = useState(() => (draftAt ? `${pad(draftAt.getHours())}:${pad(draftAt.getMinutes())}` : freeNext?.time ?? usualStart(theirDays, theirTimes) ?? '08:00'))
  // The chosen trip at the day and time picked, kept with what it was found for.
  const [timedFor, setTimedFor] = useState<{ stamp: string; trip: Trip | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [need, setNeed] = useState<PlanKey | null>(null)
  const [today] = useState(() => new Date())
  const [systemName, setSystemName] = useState<string | null>(null)
  // A stop on the way (the app's route planner pins; Nearby's "Go through a place"): meet → stop → end.
  const [through, setThrough] = useState<Place | null>(() => {
    const pins = plan.route?.pins
    const mid = pins && pins.length > 2 ? pins[1] : null
    return mid ? { lat: mid.lat, lng: mid.lng, label: mid.label ?? t('step.map_spot') } : null
  })
  const [stopOpen, setStopOpen] = useState(false)
  const [stopQuery, setStopQuery] = useState('')
  // The street lit on the map and showing in the street-by-street photos.
  const [street, setStreet] = useState<number | null>(null)
  // Bike routes in comfort colours, street by street (the app's comfortOf: bike only, it's the bike's scale).
  const calmOption = useMemo(() => (way === 'bike' && route?.waypoints && route.waypoints.length > 1 && route.comfortSegments?.length
    ? ({ waypoints: route.waypoints, comfort_segments: route.comfortSegments as CalmSegment[], comfort_rating: route.comfortRating ?? 'mixed', summary: '' } as unknown as CalmOption)
    : null), [way, route])
  const rawPieces = useMemo(() => (calmOption ? comfortPieces(calmOption, locale) : []), [calmOption, locale])
  const mapPieces = useMemo(() => (rawPieces.length ? rawPieces.map((p) => ({ coords: p.coords, color: comfortColor(p.rating, true), index: p.index })) : undefined), [rawPieces])
  useEffect(() => {
    if (way !== 'bike' || plan.bike !== 'share') return
    let alive = true
    getBikeShareSystems().then((list) => { if (alive) setSystemName(list.find((x) => x.id === plan.bike_system)?.name ?? null) }).catch(() => {})
    return () => { alive = false }
  }, [way, plan.bike, plan.bike_system])

  async function design(g: (typeof GOALS)[number], via: Place | null = through) {
    setFinding(true)
    setNoRoute(false)
    setStreet(null)
    const r = await designRoute(matchId, { goal: g, through: via })
    setFinding(false)
    if (!r.ok) { setNoRoute(true); return }
    if (r.way === 'transit') {
      setTrips(r.trips as Trip[])
      return
    }
    setRoute(r.route as Route)
    setSpots(r.spots)
    setPrimary(new Set(r.spots.filter((s) => s.on).map((s) => s.id)))
    setShowMore(false)
    setIncomplete(!r.complete)
    track('together_plan_route_designed', { way, goal: g })
  }

  // The route arrives on its own (the app opens the route planner): calmest first.
  useEffect(() => {
    if (!transit && route) return
    const h = window.setTimeout(() => void design(goal), 0)
    return () => window.clearTimeout(h)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function chooseStop(p: Place) {
    setStopOpen(false)
    setStopQuery('')
    setThrough(p)
    track('together_plan_stop_added', { way })
    void design(goal, p)
  }

  function pickTrip(trip: Trip) {
    setRoute(trip.route)
    setSpots(trip.spots)
    setPrimary(new Set(trip.spots.map((s) => s.id)))
    track('together_plan_trip_picked', { changes: trip.changes, minutes: trip.minutes })
  }

  const whenAt = () => {
    if (!day || !time) return null
    const [y, m, d] = day.split('-').map(Number)
    const [hh, mm] = time.split(':').map(Number)
    return new Date(y, m - 1, d, hh, mm)
  }

  // Transit: the chosen trip again at the day and time picked, for its real departure.
  const stamp = `${day} ${time} ${route?.transit ? lineKey(route.transit) : ''}`
  const timed = timedFor?.stamp === stamp ? timedFor.trip : null
  useEffect(() => {
    const at = whenAt()
    const trip = route?.transit
    if (!transit || !at || !trip) return
    let live = true
    const h = window.setTimeout(() => {
      designRoute(matchId, { departAt: at }).then((r) => {
        if (live && r.ok && r.way === 'transit') setTimedFor({ stamp, trip: (r.trips as Trip[]).find((x) => x.key === lineKey(trip)) ?? null })
      })
    }, 600)
    return () => { live = false; window.clearTimeout(h) }
  }, [transit, day, time, route?.transit]) // eslint-disable-line react-hooks/exhaustive-deps

  const notes = spots.filter((s) => s.note).length
  // Every spot on the route: traffic lights, stop signs and left turns start off, under "More spots", for the guide to turn on.
  const pickable = spots.filter((s) => s.kind !== 'lock_up')
  const first = pickable.filter((s) => primary.has(s.id))
  const more = pickable.filter((s) => !primary.has(s.id))

  function saveNote(id: string) {
    const text = noteDraft.trim().slice(0, 80)
    const sel = spots.find((s) => s.id === id)
    if (!sel || (text && !sel.note && notes >= MAX_NOTES)) return
    setSpots((all) => all.map((s) => (s.id === id ? { ...s, note: text || null, on: text ? true : s.on } : s)))
    setEditing(null)
    setNoteDraft('')
  }

  async function send() {
    setNeed(null)
    let r = route
    let sending = spots
    if (!r) return setNeed('share.need_route')
    const at = whenAt()
    if (!at || at.getTime() < Date.now()) return setNeed('share.need_day')
    if (transit && timed) {
      // The same lines at the picked time: keep the guide's choices and notes on each stop.
      r = timed.route
      const before = new Map(spots.map((x) => [`${x.kind}:${x.title ?? ''}`, x]))
      sending = timed.spots.map((x) => {
        const was = before.get(`${x.kind}:${x.title ?? ''}`)
        return was ? { ...x, on: was.on, note: was.note ?? null } : x
      })
    }
    setBusy(true)
    const res = await saveRidePlanRoute(matchId, r, sending, at)
    setBusy(false)
    if (!res.ok) {
      if (res.reason === 'needs_time') return setNeed('share.need_day')
      return onProblem(res)
    }
    track('together_plan_sent', { way, spots_on: sending.filter((s) => s.on).length, notes })
    onSent()
  }

  const back = step > 0 ? () => setStep(step - 1) : undefined

  if (step === 0) {
    const line = route?.waypoints && route.waypoints.length > 1 ? route.waypoints : undefined
    return (
      <Step
        n={1}
        total={3}
        title={t(transit ? 'share.trip_q' : 'share.route_q')}
        t={t}
        action={<Button variant="primary" disabled={!route || finding} onClick={() => setStep(1)}>{t('share.next')}</Button>}
      >
        {draftAt ? (
          <p className="flex items-start gap-2 rounded-xl bg-(--ev-panel) p-4 text-[15px]">
            <Clock className="mt-1 h-4 w-4 shrink-0 text-(--ev-accent)" aria-hidden />
            {t('share.draft_banner', { when: draftAt.toLocaleString(SITE_LOCALE_TAG[locale], { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), name })}
          </p>
        ) : null}
        <LearnerSaid plan={plan} name={name} systemName={systemName} t={t} />
        <div className="grid grid-cols-1 gap-2 text-[16px]">
          <p className="flex items-center gap-2"><MapPin className="h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden />{plan.meet_label}</p>
          <p className="flex items-center gap-2"><Flag className="h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden />{plan.end_label}</p>
        </div>

        {transit ? (
          trips === null && finding ? <Spinner label={t('share.finding_trips')} />
          : noRoute || (trips && !trips.length) ? <Notice tone="off">{t('share.no_trips')}</Notice>
          : (
            <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label={t('share.pick_trip')}>
              <p className="text-[15px] text-(--ev-ink-80)">{t('share.pick_trip')}</p>
              {[...(trips ?? []), ...(route?.transit && !(trips ?? []).some((x) => x.key === lineKey(route.transit!)) ? [{ ...route.transit, key: lineKey(route.transit), route, spots } as Trip] : [])].map((trip) => {
                const on = !!route?.transit && lineKey(route.transit) === trip.key
                return (
                  <button
                    key={trip.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pickTrip(trip)}
                    className={cx('grid w-full grid-cols-1 gap-2 rounded-xl border p-4 text-left', on ? 'border-(--ev-accent) bg-(--ev-panel) ring-2 ring-(--ev-accent)' : 'border-(--ev-line-strong) bg-white hover:bg-(--ev-panel)')}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      {trip.legs.filter((l) => l.kind === 'transit').map((l, i) => (
                        <span key={i} className="inline-flex min-w-[36px] justify-center rounded-md px-2 py-1 text-[14px] font-bold" style={{ background: l.color ?? '#191A2E', color: l.textColor ?? '#ffffff' }}>
                          {l.short ?? l.line ?? ''}
                        </span>
                      ))}
                      {on ? <CheckCircle2 className="ml-auto h-5 w-5 text-(--ev-accent)" aria-hidden /> : null}
                    </span>
                    <span className="text-[15px] font-semibold">
                      {pl(t, 'share.trip_minutes', trip.minutes)} · {trip.changes ? pl(t, 'share.trip_changes', trip.changes) : t('share.trip_no_change')} · {pl(t, 'share.trip_walk', Math.round(trip.walkMinutes))}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        ) : (
          <>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {GOALS.map((g) => (
                <ChipToggle key={g} on={goal === g} onClick={() => { if (g !== goal && !finding) { setGoal(g); void design(g) } }}>{t(k(`step.goal_${g}`))}</ChipToggle>
              ))}
            </div>
            {finding ? <Spinner label={t('step.finding_route')} />
              : noRoute ? (
                <Notice tone="off">
                  {t('step.no_route')}{' '}
                  <button type="button" className="font-semibold underline" onClick={() => void design(goal)}>{t('share.try_again')}</button>
                </Notice>
              ) : route ? (
                <>
                  <div className="overflow-hidden rounded-xl border border-(--ev-line)">
                    <div className="h-[260px] sm:h-[340px]">
                      <RouteMap
                        line={line ?? [meet, end]}
                        pieces={mapPieces}
                        focus={street != null ? { kind: 'piece', index: street } : null}
                        onPieceClick={(i) => setStreet((cur) => (cur === i ? null : i))}
                        stops={through ? [through] : []}
                        meetup={meet}
                        meetupLabel={plan.meet_label ?? undefined}
                        end={{ ...end, label: plan.end_label ?? undefined }}
                        pick={stopOpen}
                        onPick={(p) => chooseStop({ ...p, label: t('step.map_spot') })}
                        fitKey={`${line?.length ?? 0}-${through?.lat ?? ''}`}
                        className="h-full w-full"
                        label={t('plan.map_title', { from: plan.meet_label ?? '', to: plan.end_label ?? '' })}
                      />
                    </div>
                    {calmOption && rawPieces.length ? (
                      <div className="border-t border-(--ev-line)">
                        <RideStreets option={calmOption} pieces={rawPieces} selected={street} onSelect={setStreet} locale={locale} />
                      </div>
                    ) : null}
                  </div>
                  {route.distanceMiles ? (
                    <p className="text-[16px] font-semibold">{t('step.route_line', { miles: Math.round(route.distanceMiles * 10) / 10, minutes: Math.round(route.minutes ?? (route.distanceMiles / (way === 'walk' ? 3 : 10)) * 60) })}</p>
                  ) : null}
                </>
              ) : null}
            {through ? (
              <p className="flex flex-wrap items-center gap-2 text-[15px]">
                <MapPin className="h-4 w-4 shrink-0 text-(--ev-accent)" aria-hidden />
                <span className="font-semibold">{t('step.stop_via', { place: through.label })}</span>
                <button type="button" className={SECONDARY_LINK} disabled={finding} onClick={() => { setThrough(null); void design(goal, null) }}>{t('step.remove_stop')}</button>
              </p>
            ) : stopOpen ? (
              <div className="grid grid-cols-1 gap-2 rounded-xl bg-(--ev-panel) p-4">
                <AddressAutocomplete
                  value={stopQuery}
                  onChange={setStopQuery}
                  label={t('step.stop_search')}
                  placeholder={t('step.stop_search')}
                  includeAreas
                  onPlaceSelected={(p) => chooseStop({ lat: p.lat, lng: p.lng, label: (p.address.split(',')[0] || p.address).trim().slice(0, 60) })}
                />
                <p className="text-[14px] text-(--ev-ink-80)">{t('step.stop_tap')}</p>
                <div><Button variant="ghost" onClick={() => setStopOpen(false)}>{t('plan.cancel')}</Button></div>
              </div>
            ) : route && !finding ? (
              <button type="button" className={SECONDARY_LINK} onClick={() => setStopOpen(true)}>{t('step.add_stop')}</button>
            ) : null}
          </>
        )}
      </Step>
    )
  }

  if (step === 1) {
    const row = (s: Spot) => {
      const words = spotWords(t, s, route?.transit)
      return (
        <li key={s.id} className="grid grid-cols-1 gap-2 border-b border-(--ev-line) py-3 last:border-b-0">
          <div className="flex items-center gap-3">
            {transit ? (
              <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', s.on ? 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'bg-(--ev-panel) text-(--ev-ink-80)')}>
                <SpotIcon kind={s.kind} className="h-5 w-5" />
              </span>
            ) : (
              <SpotThumb spot={s} line={route?.waypoints} alt={t('spot.photo_alt', { what: words.title })}
                open={photoOpen === s.id} onToggle={() => setPhotoOpen(photoOpen === s.id ? null : s.id)}
                iconClass={s.on ? 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'bg-(--ev-panel) text-(--ev-ink-80)'} />
            )}
            <button
              type="button"
              role="switch"
              aria-checked={s.on}
              onClick={() => setSpots((all) => all.map((x) => (x.id === s.id ? { ...x, on: !x.on } : x)))}
              className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className={cx('block text-[16px] font-bold', !s.on && 'text-(--ev-ink-80)')}>{words.title}</span>
                {words.sub ? <span className="block truncate text-[14px] text-(--ev-ink-80)">{words.sub}</span> : null}
                {s.note ? <span className="block text-[15px] italic">“{s.note}”</span> : null}
              </span>
              <span aria-hidden className={cx('relative h-6 w-10 shrink-0 rounded-full transition', s.on ? 'bg-(--ev-accent-fill)' : 'bg-(--ev-line-strong)')}>
                <span className={cx('absolute top-1 h-4 w-4 rounded-full bg-white transition', s.on ? 'left-5' : 'left-1')} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setEditing(editing === s.id ? null : s.id); setNoteDraft(s.note ?? '') }}
              aria-label={t('share.add_note')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-(--ev-ink-80) hover:bg-(--ev-panel)"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {photoOpen === s.id && !transit ? <SpotPhotoBig spot={s} line={route?.waypoints} alt={t('spot.photo_alt', { what: words.title })} credit={t('spot.photo_credit')} /> : null}
          {editing === s.id ? (
            <div className="grid grid-cols-1 gap-2 rounded-xl bg-(--ev-panel) p-3">
              <Input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} maxLength={80} placeholder={t('share.note_placeholder')} aria-label={t('share.add_note')} autoFocus />
              {!s.note && notes >= MAX_NOTES ? <p className="text-[14px] text-(--ev-ink-80)">{t('share.notes_full', { max: MAX_NOTES })}</p> : null}
              <div><Button size="sm" onClick={() => saveNote(s.id)}>{t('share.save_note')}</Button></div>
            </div>
          ) : null}
        </li>
      )
    }
    return (
      <Step
        n={2}
        total={3}
        onBack={back}
        title={t('share.spots_q', { name })}
        t={t}
        action={<Button variant="primary" onClick={() => setStep(2)}>{t('share.next')}</Button>}
      >
        {incomplete ? <p className="text-[15px] text-(--ev-ink-80)">{t('share.spots_incomplete')}</p> : null}
        {pickable.length ? (
          <>
            <p className="text-[15px] text-(--ev-ink-80)">{t(lesson ? 'lesson.spots_hint' : 'share.spots_hint', { max: MAX_NOTES, name })}</p>
            <ul className="grid grid-cols-1">
              {first.map(row)}
              {showMore ? more.map(row) : null}
            </ul>
            {more.length ? (
              <button type="button" className={SECONDARY_LINK} onClick={() => setShowMore((v) => !v)}>
                {showMore ? t('share.fewer_spots') : t('share.more_spots', { count: more.length })}
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-[15px] text-(--ev-ink-80)">{t('step.spots_none')}</p>
        )}
      </Step>
    )
  }

  const last = new Date(today.getTime() + 59 * 24 * 3600_000)
  const departs = transit && timed ? timed.legs.find((l) => l.kind === 'transit') : null
  return (
    <Step
      n={3}
      total={3}
      onBack={back}
      title={t('share.when_q')}
      t={t}
      action={<Button variant="primary" busy={busy} disabled={!day || !time} onClick={() => void send()}>{t('share.send_plan', { name })}</Button>}
    >
      {usual ? <p className="text-[15px] text-(--ev-ink-80)">{usual}</p> : null}
      {freeNext && day === freeNext.day && time === freeNext.time ? <p className="text-[15px] text-(--ev-ink-80)">{t('lesson.free_then', { name })}</p> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('plan.move_day')} htmlFor="plan-guide-day">
          <Input id="plan-guide-day" type="date" required min={ymd(today)} max={ymd(last)} value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <Field label={t('plan.move_time')} htmlFor="plan-guide-time">
          <Input id="plan-guide-time" type="time" required step={900} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      {departs?.departAt ? (
        <p className="flex items-start gap-2 rounded-xl bg-(--ev-panel) p-4 text-[15px]">
          <Clock className="mt-1 h-4 w-4 shrink-0 text-(--ev-accent)" aria-hidden />
          {t('share.transit_departs', {
            time: new Date(departs.departAt).toLocaleTimeString(SITE_LOCALE_TAG[locale], { hour: 'numeric', minute: '2-digit' }),
            line: departs.short ?? departs.line ?? '',
            stop: departs.board?.name ?? '',
          })}
        </p>
      ) : null}
      {need ? <p className="text-[15px] font-semibold">{t(need)}</p> : null}
    </Step>
  )
}
