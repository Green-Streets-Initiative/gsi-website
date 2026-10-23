'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Route as RouteIcon, Trash2, Undo2, Upload, X } from 'lucide-react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { errorText, importRideWithGps, planRoute, scoreRoute, type PlannedRoute } from '@/lib/organizers/api'
import { comfortRatingOf, routeFromPlan } from '@/lib/organizers/route-plan'
import { elevationOf, haversineM, parseGpx, simplify, toWaypoints } from '@/lib/organizers/route-geo'
import type { LatLng, RouteDraft } from '@/lib/organizers/types'
import RouteMap, { type MapFocus } from './RouteMap'
import RouteReview, { readRoute } from './RouteReview'
import { Button, Field, Input, Notice, cx } from './ui'

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
  { key: 'draw', label: 'Plan with stops' },
  { key: 'rwgps', label: 'Ride with GPS link' },
  { key: 'gpx', label: 'GPX file' },
]

export default function RouteSection({ route, onRoute, meetup, pace, onMeetAtStart, initialPlan, initialImport }: {
  route: RouteDraft | null
  /** Stops and per-leg choices from the assistant's plan_route, planned on arrival. */
  initialPlan?: { stops: (LatLng & { label?: string })[]; chosen: number[] } | null
  /** A route brought to the assistant: a GPX file's line, or a Ride with GPS link. */
  initialImport?: { kind: 'gpx'; route: { name: string | null; waypoints: LatLng[]; elevation: RouteDraft['elevation'] } } | { kind: 'rwgps'; url: string } | null
  onRoute: (r: RouteDraft | null) => void
  meetup: (LatLng & { label?: string }) | null
  pace: string | null
  /** Move the meeting point to where an imported route begins. */
  onMeetAtStart?: (p: LatLng) => void
}) {
  const [mode, setMode] = useState<Mode>('draw')
  const [stops, setStops] = useState<(LatLng & { label?: string })[]>([])
  const [stopQuery, setStopQuery] = useState('')
  const [focus, setFocus] = useState<MapFocus>(null)
  const [plan, setPlan] = useState<PlannedRoute | null>(null)
  const [chosen, setChosen] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [link, setLink] = useState('')
  const [fitKey, setFitKey] = useState(0)
  const [scoring, setScoring] = useState<'idle' | 'busy' | 'failed'>('idle')
  const fileRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  // A route brought to the assistant, loaded and scored on arrival.
  const tookImport = useRef(false)
  useEffect(() => {
    if (!initialImport || tookImport.current) return
    tookImport.current = true
    if (initialImport.kind === 'gpx') {
      setMode('gpx')
      void takeImported({
        waypoints: initialImport.route.waypoints, pins: [], flags: [], comfortSegments: null, comfortRating: null, comfortSummary: null,
        elevation: initialImport.route.elevation ?? null, source: 'gpx', sourceName: initialImport.route.name ?? 'a GPX file',
      })
    } else {
      setMode('rwgps')
      setLink(initialImport.url)
      void importLink(initialImport.url)
    }
    setTimeout(() => boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialImport])

  // The assistant's plan: its stops, re-planned with the options it picked.
  const tookPlan = useRef(false)
  useEffect(() => {
    if (!initialPlan || !meetup || tookPlan.current) return
    tookPlan.current = true
    setMode('draw')
    setStops(initialPlan.stops)
    void findRoutes({ pins: [meetup, ...initialPlan.stops], chosen: initialPlan.chosen })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlan, meetup])

  // A new meeting point brings the map to it.
  const meetKey = meetup ? `${meetup.lat.toFixed(5)},${meetup.lng.toFixed(5)}` : ''

  // The planner's pins: the meeting point first, then the stops clicked in.
  const pins = useMemo(() => [...(meetup ? [meetup] : []), ...stops], [meetup, stops])

  const reading = useMemo(() => readRoute(route), [route])

  // Bike lanes around the meeting point (Nearby's feed), so organizers can
  // see the lanes they want to use while they plan.
  const [lanes, setLanes] = useState<GeoJSON.FeatureCollection | null>(null)
  const [showLanes, setShowLanes] = useState(true)
  const laneKey = meetup ? `${meetup.lat.toFixed(2)},${meetup.lng.toFixed(2)}` : ''
  useEffect(() => {
    if (!laneKey) return
    let live = true
    const [lat, lng] = laneKey.split(',')
    fetch(`/api/bike-network?lat=${lat}&lng=${lng}&radius=2.5`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { geojson?: GeoJSON.FeatureCollection } | null) => { if (live && d?.geojson) setLanes(d.geojson) })
      .catch(() => {})
    return () => { live = false }
  }, [laneKey])
  // An imported route that begins somewhere else than the meeting point.
  const startGapMi = route && route.waypoints.length && meetup ? haversineM(meetup, route.waypoints[0]) / 1609.344 : 0

  async function findRoutes(over?: { pins: (LatLng & { label?: string })[]; chosen: number[] }) {
    const use = over?.pins ?? pins
    if (use.length < 2) return
    setBusy(true)
    setErr(null)
    try {
      const p = await planRoute(use, pace)
      if (!p.legs?.length || p.legs.some((l) => !l.options?.length)) throw new Error("We couldn't find a route between those points. Try moving a stop onto a street.")
      const pick = p.legs.map((l, i) => Math.min(over?.chosen[i] ?? 0, l.options.length - 1))
      setPlan(p)
      setChosen(pick)
      setFocus(null)
      onRoute(routeFromPlan(p, pick, use))
      setFitKey((k) => k + 1)
      if (over) setTimeout(() => boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
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
    setFocus(null)
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
      onRoute({
        ...draft,
        flags: s.flags ?? [],
        comfortSegments: segs,
        comfortRating: s.comfort_rating ?? comfortRatingOf(segs),
        comfortSummary: s.comfort_summary ?? null,
        elevation: draft.elevation ?? s.elevation ?? null,
      })
      setScoring('idle')
    } catch {
      setScoring('failed')
    }
  }

  async function importLink(url?: string) {
    setBusy(true)
    setErr(null)
    try {
      const r = await importRideWithGps((url ?? link).trim())
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
    setFocus(null)
  }

  const pickOnMap = mode === 'draw' && !!meetup
  const drawnLine = route?.waypoints ?? []

  return (
    <div ref={boxRef} className="scroll-mt-24">
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
        <div className="mb-3 space-y-3">
          {!meetup ? (
            <Notice tone="info">Set the meeting point above first. The route starts there.</Notice>
          ) : (
            <>
              <p className="text-[14px] leading-snug text-(--ev-ink-80)">
                Add the places you want to pass, in order: a café, a park, a new bike lane. Search by name or click the map.
                The planner picks the calmest streets between them.
              </p>
              <AddressAutocomplete
                value={stopQuery}
                onChange={setStopQuery}
                onPlaceSelected={(p) => {
                  setStops((s) => [...s, { lat: p.lat, lng: p.lng, label: p.address.split(',')[0] }])
                  setStopQuery('')
                }}
                label="Add a stop"
                hideLabel
                includeAreas
                placeholder="Add a stop: Diesel Cafe, Mystic River path…"
              />
              {stops.length > 0 && (
                <ol className="flex flex-wrap gap-1.5" aria-label="Stops in order">
                  {stops.map((st, i) => {
                    const home = i === stops.length - 1 && Math.abs(st.lat - meetup.lat) < 1e-5 && Math.abs(st.lng - meetup.lng) < 1e-5
                    return (
                      <li key={i} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-(--ev-line-strong) bg-white pl-1.5 pr-1 text-[14px] font-semibold text-(--ev-ink)">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2966E5] text-[12px] text-white">{i + 1}</span>
                        {home ? 'Back to the start' : st.label || `Stop ${i + 1}`}
                        <button type="button" aria-label={`Remove stop ${i + 1}`} onClick={() => setStops((s) => s.filter((_, j) => j !== i))}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-(--ev-ink-75) hover:bg-(--ev-panel)">
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    )
                  })}
                </ol>
              )}
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
            </>
          )}
        </div>
      )}

      {busy && mode === 'draw' && (
        <p className="mb-3 text-[14px] text-(--ev-ink-80)" role="status">Checking every street between your stops. This takes up to half a minute.</p>
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

      <label className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-(--ev-ink-85)">
        <input type="checkbox" checked={showLanes} onChange={(e) => setShowLanes(e.target.checked)} className="h-4 w-4 accent-(--ev-accent-fill)" />
        Show bike lanes and paths
        <span className="flex items-center gap-1 font-normal text-(--ev-ink-75)" aria-hidden>
          <span className="ml-1 inline-block h-1 w-4 rounded bg-[#2E8B57] opacity-70" /> path
          <span className="ml-1 inline-block h-1 w-4 rounded bg-[#0E9F8E] opacity-70" /> protected
          <span className="ml-1 inline-block h-0 w-4 border-t-2 border-dashed border-[#2966E5] opacity-70" /> painted
        </span>
      </label>
      <RouteMap
        line={drawnLine}
        lanes={showLanes ? lanes : null}
        pieces={reading?.mapPieces}
        spots={reading?.mapSpots}
        focus={focus}
        onPieceClick={(index) => setFocus({ kind: 'piece', index })}
        onSpotClick={(n) => setFocus({ kind: 'spot', n })}
        stops={mode === 'draw' ? stops : []}
        meetup={meetup}
        pick={pickOnMap}
        onPick={(p) => setStops((s) => [...s, p])}
        fitKey={`${fitKey}|${meetKey}|${stops.length}|${route?.source === 'saved' ? route.waypoints.length : ''}`}
        label={pickOnMap ? 'Route map. Click to add a stop.' : 'Route map'}
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
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] text-(--ev-ink-75)">
              {route.source === 'ridewithgps' && <>From Ride with GPS{route.sourceName ? `: ${route.sourceName}` : ''}</>}
              {route.source === 'gpx' && <>From {route.sourceName ?? 'a GPX file'}</>}
            </p>
            <Button size="sm" variant="ghost" onClick={clearRoute}><Trash2 className="h-4 w-4" aria-hidden />Remove route</Button>
          </div>
          {startGapMi > 0.3 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-(--ev-ink-85)">
              <span>This route starts {startGapMi < 10 ? startGapMi.toFixed(1) : Math.round(startGapMi)} miles from your meeting point.</span>
              {onMeetAtStart && <Button size="sm" onClick={() => onMeetAtStart(route.waypoints[0])}>Meet where the route starts</Button>}
            </div>
          )}
          {scoring === 'busy' && <p className="mt-2 text-[14px] text-(--ev-ink-75)" role="status">Checking the streets on this route…</p>}
          {scoring === 'failed' && route.source !== 'drawn' && (
            <p className="mt-2 text-[14px] text-(--ev-ink-75)">We couldn&rsquo;t score this route&rsquo;s streets just now. You can save it as it is.</p>
          )}
          {reading && <RouteReview route={route} reading={reading} pace={pace} focus={focus} onFocus={setFocus} />}
        </div>
      )}
    </div>
  )
}
