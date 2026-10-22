'use client'

import { useMemo, useRef, useState } from 'react'
import { Route as RouteIcon, Trash2, Undo2, Upload } from 'lucide-react'
import { errorText, importRideWithGps, planRoute, scoreRoute, type PlannedRoute } from '@/lib/organizers/api'
import { COMFORT_LABELS, comfortBreakdown, concernCount, routeFromPlan } from '@/lib/organizers/route-plan'
import { elevationOf, parseGpx, routeMiles, simplify, toWaypoints } from '@/lib/organizers/route-geo'
import type { LatLng, RouteDraft } from '@/lib/organizers/types'
import RouteMap from './RouteMap'
import { Badge, Button, Field, Input, Notice, cx } from './ui'

type Mode = 'draw' | 'rwgps' | 'gpx'

/** "Start to stop 1", "Stop 1 to stop 2", "Stop 3 back to the start". */
function legLabel(i: number, legs: number, pins: LatLng[]): string {
  if (legs === 1) return 'Choose a way:'
  const from = i === 0 ? 'Start' : `Stop ${i}`
  const last = pins[pins.length - 1]
  const loop = i === legs - 1 && !!last && Math.abs(last.lat - pins[0].lat) < 1e-5 && Math.abs(last.lng - pins[0].lng) < 1e-5
  return `${from} ${loop ? 'back to the start' : `to stop ${i + 1}`}:`
}

const MODES: { key: Mode; label: string }[] = [
  { key: 'draw', label: 'Draw on the map' },
  { key: 'rwgps', label: 'Ride with GPS link' },
  { key: 'gpx', label: 'GPX file' },
]

export default function RouteSection({ route, onRoute, meetup, pace }: {
  route: RouteDraft | null
  onRoute: (r: RouteDraft | null) => void
  meetup: (LatLng & { label?: string }) | null
  pace: string | null
}) {
  const [mode, setMode] = useState<Mode>('draw')
  const [stops, setStops] = useState<LatLng[]>([])
  const [plan, setPlan] = useState<PlannedRoute | null>(null)
  const [chosen, setChosen] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [link, setLink] = useState('')
  const [fitKey, setFitKey] = useState(0)
  const [scoring, setScoring] = useState<'idle' | 'busy' | 'failed'>('idle')
  const fileRef = useRef<HTMLInputElement>(null)

  // A new meeting point brings the map to it.
  const meetKey = meetup ? `${meetup.lat.toFixed(5)},${meetup.lng.toFixed(5)}` : ''

  // The planner's pins: the meeting point first, then the stops clicked in.
  const pins = useMemo(() => [...(meetup ? [meetup] : []), ...stops], [meetup, stops])

  const miles = route ? routeMiles(route.waypoints) : 0
  const comfort = comfortBreakdown(route?.comfortSegments)
  const concerns = concernCount(route?.flags)

  async function findRoutes() {
    if (pins.length < 2) return
    setBusy(true)
    setErr(null)
    try {
      const p = await planRoute(pins, pace)
      if (!p.legs?.length || p.legs.some((l) => !l.options?.length)) throw new Error("We couldn't find a route between those points. Try moving a stop onto a street.")
      const pick = p.legs.map(() => 0)
      setPlan(p)
      setChosen(pick)
      onRoute(routeFromPlan(p, pick, pins))
      setFitKey((k) => k + 1)
    } catch (e) {
      setErr(errorText(e, "The route planner didn't answer. Try again in a minute."))
    } finally {
      setBusy(false)
    }
  }

  function choose(leg: number, opt: number) {
    if (!plan) return
    const next = chosen.map((c, i) => (i === leg ? opt : c))
    setChosen(next)
    onRoute(routeFromPlan(plan, next, pins))
  }

  /** An imported line gets the planner's comfort score and safety check too. */
  async function takeImported(draft: RouteDraft) {
    onRoute(draft)
    setPlan(null)
    setFitKey((k) => k + 1)
    setScoring('busy')
    try {
      const s = await scoreRoute(draft.waypoints, pace)
      const segs = s.comfort_segments?.length ? s.comfort_segments : null
      const top = comfortBreakdown(segs)[0]
      onRoute({
        ...draft,
        flags: s.flags ?? [],
        comfortSegments: segs,
        comfortRating: s.comfort_rating ?? (!top ? null : top.pct >= 80 ? top.rating : 'mixed'),
        comfortSummary: s.comfort_summary ?? null,
        elevation: draft.elevation ?? s.elevation ?? null,
      })
      setScoring('idle')
    } catch {
      setScoring('failed')
    }
  }

  async function importLink() {
    setBusy(true)
    setErr(null)
    try {
      const r = await importRideWithGps(link.trim())
      void takeImported({
        waypoints: r.waypoints, pins: [], flags: [], comfortSegments: null, comfortRating: null, comfortSummary: null,
        elevation: r.elevation, source: 'ridewithgps', sourceName: r.name,
      })
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function importFile(file: File) {
    setErr(null)
    if (file.size > 15 * 1024 * 1024) { setErr('That file is over 15 MB. Export the route without extra data and try again.'); return }
    try {
      const { name, points } = parseGpx(await file.text())
      void takeImported({
        waypoints: toWaypoints(simplify(points, 1500)), pins: [], flags: [], comfortSegments: null, comfortRating: null,
        comfortSummary: null, elevation: elevationOf(points), source: 'gpx', sourceName: name ?? file.name,
      })
    } catch (e) {
      setErr(errorText(e, "That file isn't a GPX route we can read."))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function clearRoute() {
    setScoring('idle')
    onRoute(null)
    setPlan(null)
    setStops([])
  }

  const pickOnMap = mode === 'draw' && !!meetup
  const drawnLine = route?.waypoints ?? []

  return (
    <div>
      <div role="tablist" aria-label="How to add the route" className="mb-4 flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.key}
            role="tab"
            type="button"
            aria-selected={mode === m.key}
            onClick={() => { setMode(m.key); setErr(null) }}
            className={cx(
              'min-h-[38px] rounded-full px-3.5 text-[14px] font-semibold',
              mode === m.key ? 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'border border-(--ev-line-strong) bg-white text-(--ev-ink-85) hover:bg-(--ev-panel)',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'draw' && (
        <div className="mb-3 space-y-2">
          {!meetup ? (
            <Notice tone="info">Set the meeting point above first. The route starts there.</Notice>
          ) : (
            <p className="text-[14px] leading-snug text-(--ev-ink-80)">
              Click the map to add stops in order; the route starts at your meeting point. Shift finds the most comfortable
              streets between them, the same planner as the app.
            </p>
          )}
          {meetup && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setStops((s) => [...s, { lat: meetup.lat, lng: meetup.lng }])} disabled={stops.length === 0}>
                Finish back at the start
              </Button>
              <Button size="sm" onClick={() => setStops((s) => s.slice(0, -1))} disabled={stops.length === 0}>
                <Undo2 className="h-4 w-4" aria-hidden />Undo last stop
              </Button>
              <Button size="sm" variant="primary" onClick={() => void findRoutes()} disabled={pins.length < 2} busy={busy}>
                <RouteIcon className="h-4 w-4" aria-hidden />{route?.source === 'drawn' ? 'Find the route again' : 'Find the route'}
              </Button>
            </div>
          )}
        </div>
      )}

      {busy && mode === 'draw' && (
        <p className="mb-3 text-[14px] text-(--ev-ink-80)" role="status">Checking every street between your stops. This can take up to a minute.</p>
      )}

      {mode === 'rwgps' && (
        <div className="mb-3">
          <Field label="Route link" hint="A public or unlisted route on ridewithgps.com. Private routes: export a GPX file instead." htmlFor="rwgps-link">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="rwgps-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://ridewithgps.com/routes/12345678" inputMode="url" />
              <Button variant="primary" onClick={() => void importLink()} busy={busy} disabled={!link.trim()} className="shrink-0">Bring in the route</Button>
            </div>
          </Field>
        </div>
      )}

      {mode === 'gpx' && (
        <div className="mb-3">
          <p className="mb-2 text-[14px] leading-snug text-(--ev-ink-80)">
            From Strava, Komoot, Garmin or any route app: export or download the route as GPX, then add it here.
          </p>
          <input ref={fileRef} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" className="sr-only" id="gpx-file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f) }} />
          <label htmlFor="gpx-file" className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
            <Upload className="h-4 w-4" aria-hidden />Choose a GPX file
          </label>
        </div>
      )}

      {err && <div className="mb-3"><Notice tone="off">{err}</Notice></div>}

      <RouteMap
        line={drawnLine}
        stops={mode === 'draw' ? stops : []}
        meetup={meetup}
        pick={pickOnMap}
        onPick={(p) => setStops((s) => [...s, p])}
        fitKey={`${fitKey}|${meetKey}`}
        label="Route map. Click to add a stop."
      />

      {plan && plan.legs.length > 0 && plan.legs.some((l) => l.options.length > 1) && (
        <div className="mt-3 space-y-2">
          {plan.legs.map((leg, i) => leg.options.length > 1 && (
            <div key={i} className="flex flex-wrap items-center gap-1.5">
              <span className="text-[14px] font-semibold text-(--ev-ink-80)">{legLabel(i, plan.legs.length, pins)}</span>
              {leg.options.map((o, j) => (
                <button key={j} type="button" aria-pressed={chosen[i] === j} onClick={() => choose(i, j)}
                  className={cx('rounded-full border px-3 py-1 text-[14px] font-semibold',
                    chosen[i] === j ? 'border-(--ev-accent-fill) bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'border-(--ev-line-strong) bg-white text-(--ev-ink-85) hover:bg-(--ev-panel)')}>
                  {o.distanceMiles.toFixed(1)} mi{o.summary ? ` · ${o.summary}` : ''}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {route && route.waypoints.length >= 2 && (
        <div className="mt-4 rounded-xl border border-(--ev-line-mid) bg-(--ev-panel-faint) px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] font-semibold text-(--ev-ink)">
              {miles.toFixed(1)} miles
              {route.elevation ? ` · ${route.elevation.ascent_ft.toLocaleString()} ft of climbing` : ''}
              {route.source === 'ridewithgps' && <span className="font-normal text-(--ev-ink-75)"> · from Ride with GPS{route.sourceName ? `: ${route.sourceName}` : ''}</span>}
              {route.source === 'gpx' && <span className="font-normal text-(--ev-ink-75)"> · from {route.sourceName ?? 'a GPX file'}</span>}
            </p>
            <Button size="sm" variant="ghost" onClick={clearRoute}><Trash2 className="h-4 w-4" aria-hidden />Remove route</Button>
          </div>
          {comfort.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {comfort.map((c) => <Badge key={c.rating} tone={c.rating === 'shared_road' ? 'warn' : 'good'}>{c.pct}% {COMFORT_LABELS[c.rating] ?? c.rating}</Badge>)}
            </div>
          )}
          {concerns > 0 && (
            <p className="mt-2 text-[14px] text-(--ev-ink-80)">{concerns === 1 ? 'One spot' : `${concerns} spots`} on this route have a crash history or a tricky crossing. People see them on the ride page in the app.</p>
          )}
          {scoring === 'busy' && <p className="mt-2 text-[14px] text-(--ev-ink-75)" role="status">Checking the streets on this route…</p>}
          {scoring === 'failed' && route.source !== 'drawn' && (
            <p className="mt-2 text-[14px] text-(--ev-ink-75)">We couldn&rsquo;t score this route&rsquo;s streets just now. You can save it as it is.</p>
          )}
        </div>
      )}
    </div>
  )
}
