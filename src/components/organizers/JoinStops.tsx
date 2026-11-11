'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bike, Plus, TrainFront, X } from 'lucide-react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { suggestJoinStops } from '@/lib/organizers/api'
import { haversineM } from '@/lib/organizers/route-geo'
import { travelMph, type Activity } from '@/lib/organizers/ride-words'
import type { LatLng, RouteDraft, RoutePin } from '@/lib/organizers/types'
import { Button, Select, cx } from './ui'

/**
 * Where people can join along the way (Shift 01744). Someone who lives
 * halfway along the route meets the group at a stop instead of riding to the
 * start. Stops are route pins marked `join`, after the meeting point; the
 * ride page, reminders and calendar give each person their own stop and the
 * group's time there (Shift _ride_join_stops works the times out the same
 * way: distance along the route at the ride's pace, plus the wait at each
 * stop before).
 *
 * Suggestions are T stations and Bluebikes docks within a short walk of the
 * route, since those are where people arriving without a bike or by train
 * can meet the group.
 */

type Suggestion = { lat: number; lng: number; label: string; kind: 't' | 'dock'; along_m: number }

const WAITS = [0, 2, 5, 10]
/** A stop counts as on the route within this distance. */
const ON_ROUTE_M = 300

function alongOf(line: LatLng[], p: LatLng): { along_m: number; off_m: number } {
  let acc = 0
  let best = { along_m: 0, off_m: Infinity }
  for (let i = 0; i < line.length; i++) {
    if (i > 0) acc += haversineM(line[i - 1], line[i])
    const d = haversineM(line[i], p)
    if (d < best.off_m) best = { along_m: acc, off_m: d }
  }
  return best
}

function newId(): string {
  return `s${Math.random().toString(36).slice(2, 8)}`
}

function clockPlus(start: string, minutes: number): string {
  const [h, m] = start.split(':').map(Number)
  const t = (h || 0) * 60 + (m || 0) + minutes
  const hh = Math.floor(t / 60) % 24
  const mm = t % 60
  return `${hh % 12 || 12}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${hh < 12 ? 'AM' : 'PM'}`
}

/**
 * The route's pins with these join stops: the meeting point stays first (it
 * is added when the route has no pins, as an imported one doesn't), then the
 * planner's own stops, then the join stops.
 */
export function withJoinStops(route: RouteDraft, joins: RoutePin[], meetup: (LatLng & { label?: string }) | null): RouteDraft {
  const plain = route.pins.filter((p) => !p.join)
  const head = plain.length ? plain : meetup && joins.length ? [{ lat: meetup.lat, lng: meetup.lng, ...(meetup.label ? { label: meetup.label } : {}) }] : []
  return { ...route, pins: [...head, ...joins] }
}

export default function JoinStops({ route, meetup, pace, activity, startTime, onChange }: {
  route: RouteDraft
  meetup: (LatLng & { label?: string }) | null
  pace: string | null
  activity: Activity
  startTime: string
  onChange: (r: RouteDraft) => void
}) {
  const walk = activity === 'walk'
  const line = route.waypoints
  const joins = useMemo(() => route.pins.filter((p, i) => i > 0 && p.join), [route.pins])
  const mph = travelMph(pace, activity) ?? (walk ? 3 : 10)
  const [query, setQuery] = useState('')
  const [warn, setWarn] = useState<string | null>(null)
  const [suggested, setSuggested] = useState<Suggestion[] | null>(null)
  // Most rides meet at one place: this stays a link until the organizer wants
  // stops (Keith 2026-11-11: stops "are not a fixture of every ride").
  const [shown, setShown] = useState(joins.length > 0)

  // Suggestions for this line, read once per route.
  const lineKey = line.length >= 2 ? `${line.length}|${line[0].lat.toFixed(4)}|${line[line.length - 1].lng.toFixed(4)}` : ''
  useEffect(() => {
    if (!lineKey || !shown) return
    let live = true
    setSuggested(null)
    // Every few points is plenty for "within a short walk of the route".
    const step = Math.max(1, Math.floor(line.length / 400))
    suggestJoinStops(line.filter((_, i) => i % step === 0 || i === line.length - 1))
      .then((r) => { if (live) setSuggested(r.stops) }, () => { if (live) setSuggested([]) })
    return () => { live = false }
  }, [lineKey, shown]) // eslint-disable-line react-hooks/exhaustive-deps

  // The stops in route order, each with the group's time there.
  const timed = useMemo(() => {
    const placed = joins.map((p) => ({ pin: p, ...alongOf(line, p) })).sort((a, b) => a.along_m - b.along_m)
    let waits = 0
    return placed.map((x) => {
      const minutes = Math.round((x.along_m / 1609.344 / mph) * 60 + waits)
      waits += x.pin.wait_min ?? 2
      return { ...x, minutes }
    })
  }, [joins, line, mph])

  const save = (next: RoutePin[]) => onChange(withJoinStops(route, next, meetup))
  const add = (p: LatLng & { label: string }) => {
    const { off_m } = alongOf(line, p)
    if (off_m > ON_ROUTE_M) {
      setWarn(`${p.label} is ${(off_m / 1609.344).toFixed(1)} miles from the route. Pick a place on it.`)
      return
    }
    setWarn(null)
    if (joins.some((j) => haversineM(j, p) < 60)) return
    save([...joins, { lat: p.lat, lng: p.lng, label: p.label, join: true, id: newId(), wait_min: 2 }])
  }
  const update = (id: string | undefined, patch: Partial<RoutePin>) =>
    save(joins.map((j) => (j.id === id ? { ...j, ...patch } : j)))
  const remove = (id: string | undefined) => save(joins.filter((j) => j.id !== id))

  const open = (suggested ?? []).filter((s) => !joins.some((j) => haversineM(j, s) < 120))

  if (!shown) {
    return (
      <button type="button" onClick={() => setShown(true)}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] px-1 text-[15px] font-semibold text-(--ev-accent) hover:underline">
        <Plus size={16} aria-hidden /> Let people join partway
      </button>
    )
  }

  return (
    <div className="rounded-[12px] border border-(--ev-line-strong) bg-white px-4 py-4">
      <p className="text-[16px] font-bold text-(--ev-ink)">Where people can join along the way</p>
      <p className="mt-1 text-[14px] leading-snug text-(--ev-ink-80)">
        People who live along the route can meet the group at a stop. Each one gets a time on your {walk ? 'walk' : 'ride'} page,
        and everyone who picks it hears when the group is about 5 minutes away.
      </p>

      {timed.length > 0 && (
        <ol className="mt-3 space-y-2" aria-label="Join stops in route order">
          {timed.map((x, i) => (
            <li key={x.pin.id ?? i} className="rounded-[10px] border border-(--ev-line) bg-(--ev-panel-faint) px-3 py-2">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-white bg-[#2966E5] text-[12px] font-bold text-white shadow-[0_1px_4px_rgba(0,0,0,.3)]" aria-hidden>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-snug text-(--ev-ink)">{x.pin.label || `Stop ${i + 1}`}</span>
                  <span className="block text-[14px] text-(--ev-ink-75)">
                    {startTime ? `About ${clockPlus(startTime, x.minutes)}` : `About ${x.minutes} min after the start`} · {(x.along_m / 1609.344).toFixed(1)} mi in
                  </span>
                </span>
                <button type="button" onClick={() => remove(x.pin.id)} aria-label={`Remove ${x.pin.label || `stop ${i + 1}`}`}
                  className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-(--ev-ink-75) hover:bg-(--ev-panel)">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <label className="ml-9 mt-2 flex items-center gap-2 text-[14px] font-semibold text-(--ev-ink-80)">
                Group waits
                <Select value={String(x.pin.wait_min ?? 2)} onChange={(e) => update(x.pin.id, { wait_min: Number(e.target.value) })} className="!min-h-[36px] !w-auto !py-1">
                  {WAITS.map((w) => <option key={w} value={w}>{w ? `${w} min` : 'No wait'}</option>)}
                </Select>
              </label>
            </li>
          ))}
        </ol>
      )}

      {open.length > 0 && (
        <div className="mt-3">
          <p className="text-[14px] font-semibold text-(--ev-ink-80)">On your route</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {open.map((s) => (
              <button key={`${s.lat},${s.lng}`} type="button" onClick={() => add(s)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-(--ev-line-strong) bg-white px-3 py-1 text-left text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
                <Plus className="h-4 w-4" aria-hidden />
                {s.kind === 't' ? <TrainFront className="h-4 w-4 text-(--ev-ink-75)" aria-hidden /> : <Bike className="h-4 w-4 text-(--ev-ink-75)" aria-hidden />}
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {suggested === null && line.length >= 2 && <p className="mt-3 text-[14px] text-(--ev-ink-75)" role="status">Looking for T stations and Bluebikes docks on your route…</p>}

      <div className={cx('mt-3', joins.length === 0 && open.length === 0 && 'mt-4')}>
        <AddressAutocomplete
          value={query}
          onChange={setQuery}
          onPlaceSelected={(p) => { add({ lat: p.lat, lng: p.lng, label: p.address.split(',')[0] }); setQuery('') }}
          label="Add a place people can join"
          hideLabel
          includeAreas
          placeholder="Add another place on the route: a park, a corner, a café…"
        />
      </div>
      {warn && <p className="mt-2 text-[14px] font-semibold text-(--ev-danger)" role="alert">{warn}</p>}
      {joins.length > 0 && (
        <div className="mt-3">
          <Button size="sm" variant="ghost" onClick={() => save([])}>Remove all join stops</Button>
        </div>
      )}
    </div>
  )
}
