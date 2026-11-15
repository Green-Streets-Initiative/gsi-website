'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, ArrowRight, Binoculars, Camera, CheckCircle, Clock, Eye,
  HandHeart, MapPin, Microphone, PersonSimpleWalk, Signpost, X,
} from '@phosphor-icons/react'
import { ROLLUP_OPTIONS, moduleById } from '@/components/walk-audit/moduleModel'
import ModuleForm, { type Answers } from '@/components/walk-audit/ModuleForm'
import { RadioGroup, FreeTextField } from '@/components/volunteer-route/inputs'
import ObservationCapture, { type AuditObservation } from '@/components/walk-audit/ObservationCapture'
import VolunteerRouteMap from '@/components/volunteer-route/VolunteerRouteMap'
import BlockStrip from '@/components/walk-audit/BlockStrip'
import { useDictation } from '@/components/walk-audit/useDictation'
import type { WalkAuditMeta, BlockDef, BlockCheck } from './page'
import { haversineMeters, buildClientBlocks } from '@/components/walk-audit/blocks'
import StopCheck, { stopDraftKey } from '@/components/walk-audit/StopCheck'
import {
  auditMinutes, cleanStops, minutesLabel, STOP_CHECK_MINUTES, STOP_TALK_MINUTES,
  type StopActivity,
} from '@/components/walk-audit/stopModel'

// How close a walker has to be before the page offers the stop's questions.
const STOP_RADIUS_METERS = 45

const PURPOSE_LABELS: Record<string, string> = {
  engage: 'Community walk audit',
  designate_route: 'Route review',
  technical_evaluation: 'Technical walk audit',
  activate_leaders: 'Walk audit for local leaders',
}

const LENSES = [
  { key: 'safety', name: 'Safety', prompt: 'Do you feel safe? Crossings, speeds, sightlines, lighting.' },
  { key: 'comfort', name: 'Comfort', prompt: 'Is it pleasant? Shade, places to rest, noise, upkeep.' },
  { key: 'crossings', name: 'Getting across', prompt: 'Can you cross where you need to, with enough time?' },
  { key: 'destinations', name: 'Places to go', prompt: 'Can you actually walk to the things that matter here?' },
]

const TOP_FIX_OPTIONS = [
  'Safer crossings', 'Fix the sidewalks', 'Slower traffic', 'Better lighting',
  'A protected bike lane', 'More shade and green', 'Places to sit',
  'Clear snow and ice better', 'Something else',
]

interface Props {
  token: string
  audit: WalkAuditMeta
}

export default function WalkAuditClient({ token, audit }: Props) {
  type View = 'briefing' | 'walk' | 'capture' | 'wrapup' | 'module' | 'done' | 'stop'
  const [view, setView] = useState<View>('briefing')
  const [briefCard, setBriefCard] = useState(0)
  const [observer, setObserver] = useState('')
  const [observations, setObservations] = useState<AuditObservation[]>(
    (audit.observations ?? []) as AuditObservation[],
  )
  const [blockChecks, setBlockChecks] = useState<BlockCheck[]>(audit.block_checks ?? [])
  const [visitedBlocks, setVisitedBlocks] = useState<Set<number>>(new Set())
  const [wrapDone, setWrapDone] = useState(false)

  // Planned stops
  const stops = useMemo(() => cleanStops(audit.stops), [audit.stops])
  const hasStops = stops.length > 0
  const [stopActivity, setStopActivity] = useState<StopActivity[]>(audit.stop_activity ?? [])
  const [doneStops, setDoneStops] = useState<Set<string>>(new Set())
  const [activeStop, setActiveStop] = useState<number | null>(null)
  const [nearStop, setNearStop] = useState<number | null>(null)
  const promptedStops = useRef<Set<string>>(new Set())
  // Where 'Photo of this spot' returns to (the map, or the stop it was opened from).
  const [captureReturn, setCaptureReturn] = useState<'walk' | 'stop'>('walk')

  // Block check-in prompt
  const [checkInBlock, setCheckInBlock] = useState<number | null>(null)
  const promptedBlocks = useRef<Set<number>>(new Set())

  // Wrap-up state
  const [verdicts, setVerdicts] = useState<Record<string, string | null>>({})
  const [topFix, setTopFix] = useState<string | null>(null)
  const [topFixNote, setTopFixNote] = useState('')
  const [connectedWith, setConnectedWith] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Extras
  const [moduleId, setModuleId] = useState<string | null>(null)
  const [moduleAnswers, setModuleAnswers] = useState<Answers>({})
  const [moduleNotes, setModuleNotes] = useState('')
  const [moduleRollup, setModuleRollup] = useState<string | null>(null)
  const [doneModules, setDoneModules] = useState<string[]>([])

  const watchIdRef = useRef<number | null>(null)

  const connectedDictation = useDictation((transcript) => {
    setConnectedWith((prev) => (prev ? `${prev} ${transcript}` : transcript))
  })

  const routePoints: { lat: number; lng: number }[] =
    audit.area_type === 'route' && Array.isArray(audit.area)
      ? audit.area.filter((p) => typeof p?.lat === 'number' && typeof p?.lng === 'number')
      : []
  const routeCoordinates: [number, number][] = routePoints.map((p) => [p.lng, p.lat])
  const locationCenter =
    audit.area_type === 'location' && !Array.isArray(audit.area) ? audit.area : null

  const blocks = useMemo<BlockDef[]>(
    () => (audit.blocks && audit.blocks.length > 0 ? audit.blocks : buildClientBlocks(routePoints)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [audit.blocks, audit.area],
  )
  const routeMiles = useMemo(() => {
    let m = 0
    for (let i = 0; i < routePoints.length - 1; i++) m += haversineMeters(routePoints[i], routePoints[i + 1])
    return m / 1609.34
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audit.area])
  const estMinutes = auditMinutes(routeMiles, stops.length)

  const enabledExtras = (audit.enabled_modules ?? [])
    .map((id) => moduleById(id))
    .filter((m): m is NonNullable<typeof m> => !!m)

  const hazardPins = useMemo(() => {
    const clusters = audit.hazards?.crash_clusters ?? []
    return clusters.slice(0, 12).map((c) => ({
      lat: c.lat,
      lng: c.lng,
      note: `${c.crashCount ?? 1} reported crash${(c.crashCount ?? 1) === 1 ? '' : 'es'} near here — worth a close look`,
      category: null,
      color: '#DC2626',
    }))
  }, [audit.hazards])

  const observationPins = useMemo(
    () => [
      ...hazardPins,
      ...observations.map((o) => ({
        lat: o.lat,
        lng: o.lng,
        note: [o.note || (o.valence === 'good' ? 'Works well' : 'Problem'), o.observer_name ? `— ${o.observer_name}` : '']
          .filter(Boolean)
          .join(' '),
        category: o.category,
        color: o.valence === 'good' ? '#BAF14D' : '#D97706',
      })),
    ],
    [observations, hazardPins],
  )

  // ── Boot: restore name, briefed flag, visited blocks ──
  useEffect(() => {
    try {
      setObserver(localStorage.getItem('shift-walk-audit-observer') ?? '')
      if (localStorage.getItem(`shift-walk-audit-briefed:${token}`)) setView('walk')
      const raw = localStorage.getItem(`shift-walk-audit-blocks:${token}`)
      if (raw) setVisitedBlocks(new Set(JSON.parse(raw) as number[]))
      if (localStorage.getItem(`shift-walk-audit-wrapped:${token}`)) setWrapDone(true)
      const done = new Set<string>()
      for (const st of stops) {
        const draft = localStorage.getItem(stopDraftKey(token, st.id))
        if (draft && (JSON.parse(draft) as { checked?: boolean }).checked) done.add(st.id)
      }
      setDoneStops(done)
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── GPS: mark blocks visited while walking, prompt check-in ──
  useEffect(() => {
    if (view !== 'walk' || (blocks.length === 0 && !hasStops) || !('geolocation' in navigator)) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        if (hasStops) {
          // An event with planned stops pauses only at the stops.
          const at = stops.findIndex(
            (st) => !promptedStops.current.has(st.id) && haversineMeters(here, st) < STOP_RADIUS_METERS,
          )
          if (at >= 0) {
            promptedStops.current.add(stops[at].id)
            setNearStop(at)
          }
          return
        }
        setVisitedBlocks((prev) => {
          let changed = false
          const next = new Set(prev)
          let newlyVisited: number | null = null
          blocks.forEach((b, i) => {
            if (!next.has(i) && haversineMeters(here, b.mid) < 75) {
              next.add(i)
              changed = true
              newlyVisited = i
            }
          })
          if (changed) {
            try {
              localStorage.setItem(`shift-walk-audit-blocks:${token}`, JSON.stringify([...next]))
            } catch { /* ignore */ }
          }
          if (newlyVisited !== null && !promptedBlocks.current.has(newlyVisited)) {
            promptedBlocks.current.add(newlyVisited)
            setCheckInBlock(newlyVisited)
          }
          return changed ? next : prev
        })
      },
      () => { /* no location — progress stays manual */ },
      { enableHighAccuracy: true, maximumAge: 10000 },
    )
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [view, blocks, token, hasStops, stops])

  // ── Shared map: refresh observations + block checks while walking ──
  useEffect(() => {
    if (view !== 'walk') return
    const interval = setInterval(async () => {
      const { data } = await supabase.rpc('get_walk_audit', { p_token: token })
      if (data?.observations) setObservations(data.observations as AuditObservation[])
      if (data?.block_checks) setBlockChecks(data.block_checks as BlockCheck[])
      if (data?.stop_activity) setStopActivity(data.stop_activity as StopActivity[])
    }, 45000)
    return () => clearInterval(interval)
  }, [view, token])

  function markBriefed() {
    try {
      localStorage.setItem(`shift-walk-audit-briefed:${token}`, '1')
    } catch { /* ignore */ }
    setView('walk')
  }

  function openStop(index: number) {
    setNearStop(null)
    setActiveStop(index)
    setView('stop')
    window.scrollTo({ top: 0 })
  }

  function saveObserver(name: string) {
    setObserver(name)
    try {
      if (name.trim()) localStorage.setItem('shift-walk-audit-observer', name.trim())
    } catch { /* ignore */ }
  }

  async function submitBlockCheck(blockIndex: number, verdict: 'fine' | 'soso' | 'rough') {
    const block = blocks[blockIndex]
    setBlockChecks((prev) => [...prev, {
      block_index: blockIndex,
      block_name: block?.name ?? null,
      observer_name: observer.trim() || null,
      verdict,
      created_at: new Date().toISOString(),
    }])
    setCheckInBlock(null)
    await supabase.rpc('submit_walk_audit_block_check', {
      p_token: token,
      p_block_index: blockIndex,
      p_block_name: block?.name ?? null,
      p_observer: observer,
      p_verdict: verdict,
    })
  }

  async function submitWrapUp() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { data: accepted, error } = await supabase.rpc('submit_walk_audit', {
        p_token: token,
        p_module: 'wrap_up',
        p_observer: observer,
        p_answers: {
          verdicts,
          top_fix: topFix,
          top_fix_note: topFixNote || null,
          connected_with: connectedWith || null,
        },
        p_pins: [],
        p_photos: [],
      })
      if (error) throw error
      if (!accepted) {
        setSubmitError('This audit link is no longer active — check with your organizer.')
        return
      }
      try {
        localStorage.setItem(`shift-walk-audit-wrapped:${token}`, '1')
      } catch { /* ignore */ }
      setWrapDone(true)
      setView('done')
      window.scrollTo({ top: 0 })
    } catch (err) {
      setSubmitError(`Couldn't submit: ${err instanceof Error ? err.message : 'network error'}. Try again in a moment.`)
    } finally {
      setSubmitting(false)
    }
  }

  async function submitModule() {
    if (!moduleId) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { data: accepted, error } = await supabase.rpc('submit_walk_audit', {
        p_token: token,
        p_module: moduleId,
        p_observer: observer,
        p_answers: { ...moduleAnswers, notes: moduleNotes, rollup: moduleRollup },
        p_pins: [],
        p_photos: [],
      })
      if (error) throw error
      if (!accepted) {
        setSubmitError('This audit link is no longer active — check with your organizer.')
        return
      }
      setDoneModules((prev) => [...prev, moduleId])
      setModuleId(null)
      setModuleAnswers({})
      setModuleNotes('')
      setModuleRollup(null)
      setView('walk')
      window.scrollTo({ top: 0 })
    } catch (err) {
      setSubmitError(`Couldn't submit: ${err instanceof Error ? err.message : 'network error'}.`)
    } finally {
      setSubmitting(false)
    }
  }

  const myCount = observations.filter((o) => o.observer_name && o.observer_name === observer.trim()).length
  const problemCount = observations.filter((o) => o.valence === 'problem').length
  const goodCount = observations.length - problemCount
  const progressPct = blocks.length > 0 ? Math.round((visitedBlocks.size / blocks.length) * 100) : 0
  const myChecks = new Set(blockChecks.filter((c) => c.observer_name === observer.trim() || (!c.observer_name && !observer.trim())).map((c) => c.block_index))

  const activeModule = moduleId ? moduleById(moduleId) : undefined
  const checkInBlockDef = checkInBlock !== null ? blocks[checkInBlock] : null

  const briefingCards = [
    {
      icon: <PersonSimpleWalk size={30} weight="regular" className="text-[#2966E5]" />,
      title: audit.title,
      body: (
        <>
          <p className="text-sm text-[#374151]">
            {PURPOSE_LABELS[audit.purpose] ?? 'Walk audit'}
            {audit.org_name ? ` with ${audit.org_name}` : ''}
            {audit.area_label ? ` — ${audit.area_label}` : ''}.
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#EBF0FD] px-3 py-1.5 text-sm font-semibold text-[#2966E5]">
            <Clock size={15} weight="bold" />
            {routeMiles > 0
              ? hasStops
                ? `${routeMiles.toFixed(1)} miles and ${stops.length} stop${stops.length === 1 ? '' : 's'}: plan about ${minutesLabel(estMinutes)}`
                : `About ${routeMiles.toFixed(1)} miles — plan around ${estMinutes} minutes`
              : 'One spot — plan 20–30 minutes of watching'}
          </p>
          <p className="mt-2 text-xs text-[#6B7280]">
            Auditing is slower than walking — you&apos;ll be stopping, noticing, and talking. That&apos;s the point.
          </p>
        </>
      ),
    },
    ...(hasStops
      ? [{
          icon: <Signpost size={30} weight="regular" className="text-[#2966E5]" />,
          title: `You'll pause at ${stops.length} stop${stops.length === 1 ? '' : 's'}`,
          body: (
            <>
              <VolunteerRouteMap
                routeCoordinates={routeCoordinates}
                heightClass="h-40"
                stops={stops.map((st) => ({ lat: st.lat, lng: st.lng, name: st.name }))}
              />
              <ol className="mt-3 space-y-1.5">
                {stops.map((st, i) => (
                  <li key={st.id} className="flex items-center gap-2.5 rounded-lg bg-[#F4F8EE] p-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#191A2E] text-xs font-extrabold text-white">{i + 1}</span>
                    <span className="text-[15px] font-semibold text-[#191A2E]">{st.name}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[15px] text-[#374151]">
                At each one you answer yes-or-no questions on your phone for about {STOP_CHECK_MINUTES} minutes,
                then the group talks it over for about {STOP_TALK_MINUTES}.
              </p>
            </>
          ),
        }]
      : []),
    {
      icon: <Eye size={30} weight="regular" className="text-[#2966E5]" />,
      title: 'Four things to notice',
      body: (
        <>
          <div className="mt-1 space-y-2">
            {LENSES.map((l) => (
              <div key={l.key} className="rounded-lg bg-white p-2.5">
                <p className="text-sm font-bold text-[#191A2E]">{l.name}</p>
                <p className="text-xs text-[#6B7280]">{l.prompt}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#6B7280]">
            These are prompts, not homework — you don&apos;t need to comment on everything. What
            catches <em>your</em> eye is the data.
          </p>
        </>
      ),
    },
    {
      icon: <Camera size={30} weight="fill" className="text-[#D97706]" />,
      title: 'When something catches your eye, take a photo',
      body: (
        <>
          <p className="text-sm text-[#374151]">
            Tap <span className="mx-0.5 inline-flex items-center gap-1 rounded-full bg-[#D97706] px-2.5 py-0.5 text-xs font-bold text-white"><Camera size={12} weight="fill" /> Photo of this spot</span>{' '}
            and say whether it <strong>works well</strong> or it&apos;s a <strong>problem</strong>. That&apos;s it — everything else is optional.
          </p>
          <p className="mt-2 text-sm text-[#374151]">
            Good things count! &quot;This crossing works&quot; is evidence too. Five to ten photos make a
            great walk.
          </p>
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium text-[#191A2E]">Your name (so the group knows who saw what)</p>
            <input
              value={observer}
              onChange={(e) => saveObserver(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#2966E5] focus:outline-none"
            />
          </div>
        </>
      ),
    },
  ]

  return (
    <main className="min-h-screen bg-[#F4F8EE]">
      {/* Header */}
      <div className="bg-[#191A2E] px-4 py-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-1.5">
          <span className="font-display text-xl font-extrabold text-white">Shift</span>
          <span className="inline-flex items-center gap-[3px] relative" style={{ top: '-1px' }}>
            <svg viewBox="0 0 9 15" width="11" height="17" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,0 L9,7.5 L0,15 L0,11 L5.5,7.5 L0,4Z" fill="#BAF14D" />
            </svg>
            <svg viewBox="0 0 9 15" width="11" height="17" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,0 L9,7.5 L0,15 L0,11 L5.5,7.5 L0,4Z" fill="#2966E5" />
            </svg>
          </span>
          <span className="text-xs font-medium text-white/75">Walk Audit</span>
        </div>
        <h1 className="text-base font-bold text-white">{audit.title}</h1>
      </div>
      <div className="h-[3px] bg-[#52B788]" />

      <div className="mx-auto max-w-[600px] px-4 py-5 pb-28">
        {/* ── Briefing ── */}
        {view === 'briefing' && (
          <div className="pt-2">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-3">{briefingCards[briefCard].icon}</div>
              <h2 className="text-lg font-bold text-[#191A2E]">{briefingCards[briefCard].title}</h2>
              <div className="mt-2">{briefingCards[briefCard].body}</div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-1.5">
                {briefingCards.map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-2 rounded-full ${i === briefCard ? 'bg-[#2966E5]' : 'bg-gray-300'}`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {briefCard > 0 && (
                  <button
                    onClick={() => setBriefCard(briefCard - 1)}
                    className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#374151]"
                  >
                    <ArrowLeft size={14} weight="bold" /> Back
                  </button>
                )}
                {briefCard < briefingCards.length - 1 ? (
                  <button
                    onClick={() => setBriefCard(briefCard + 1)}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#2966E5] px-5 py-2.5 text-sm font-bold text-white"
                  >
                    Next <ArrowRight size={14} weight="bold" />
                  </button>
                ) : (
                  <button
                    onClick={markBriefed}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#2966E5] px-5 py-2.5 text-sm font-bold text-white"
                  >
                    Start walking <ArrowRight size={14} weight="bold" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Walk view ── */}
        {view === 'walk' && (
          <>
            <div className="rounded-xl bg-white p-2 shadow-sm">
              <VolunteerRouteMap
                routeCoordinates={routeCoordinates}
                center={locationCenter}
                pins={observationPins}
                heightClass="h-64"
                stops={stops.map((st) => ({ lat: st.lat, lng: st.lng, name: st.name, done: doneStops.has(st.id) }))}
                onStopClick={openStop}
              />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 text-[11px] text-[#6B7280]">
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#BAF14D] border border-[#3D5407]/30"></span> works well</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#D97706]"></span> problem</span>
                {hasStops && (
                  <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[3px] bg-[#191A2E]"></span> stop</span>
                )}
                {hazardPins.length > 0 && (
                  <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]"></span> reported crashes</span>
                )}
              </div>
            </div>

            {/* Planned stops */}
            {hasStops && (
              <div className="mt-3 overflow-hidden rounded-xl bg-white shadow-sm">
                <div className="flex items-center justify-between px-4 pt-4 text-sm">
                  <span className="font-semibold text-[#191A2E]">
                    {doneStops.size} of {stops.length} stop{stops.length === 1 ? '' : 's'} done
                  </span>
                  <span className="text-[13px] text-[#4B5563]">about {minutesLabel(estMinutes)} in all</span>
                </div>
                <div className="mt-2 divide-y divide-gray-100">
                  {stops.map((st, i) => {
                    const done = doneStops.has(st.id)
                    const answered = stopActivity.filter((a) => a.stop_id === st.id && a.kind === 'stop_check').length
                    const isNext = !done && stops.findIndex((x) => !doneStops.has(x.id)) === i
                    return (
                      <button
                        key={st.id}
                        onClick={() => openStop(i)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold text-white ${done ? 'bg-[#52B788]' : 'bg-[#191A2E]'}`}>
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-[#191A2E]">{st.name}</span>
                          {answered > 0 && (
                            <span className="block text-[13px] text-[#4B5563]">
                              {answered} {answered === 1 ? 'person has' : 'people have'} answered
                            </span>
                          )}
                        </span>
                        {done ? (
                          <CheckCircle size={20} weight="fill" className="shrink-0 text-[#52B788]" />
                        ) : isNext ? (
                          <span className="shrink-0 rounded-full bg-[#2966E5] px-3.5 py-2 text-sm font-bold text-white">Start</span>
                        ) : (
                          <ArrowRight size={16} weight="bold" className="shrink-0 text-[#6B7280]" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Block strip */}
            {!hasStops && blocks.length > 0 && (
              <div className="mt-3 rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-[#191A2E]">
                    {visitedBlocks.size} of {blocks.length} block{blocks.length === 1 ? '' : 's'} walked
                  </span>
                  <span className="text-xs text-[#6B7280]">{progressPct}%</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-[#52B788] transition-all" style={{ width: `${progressPct}%` }} />
                </div>
                <BlockStrip
                  blocks={blocks}
                  visitedBlocks={visitedBlocks}
                  blockChecks={blockChecks}
                  onTap={(i) => {
                    if (!myChecks.has(i)) {
                      promptedBlocks.current.add(i)
                      setCheckInBlock(i)
                    }
                  }}
                />
                {blocks.length > 0 && progressPct >= 100 && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#3D5407]">
                    <CheckCircle size={16} weight="fill" className="text-[#52B788]" /> Whole route covered!
                  </p>
                )}
              </div>
            )}

            {/* Collective stats */}
            <div className="mt-3 rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-[#374151]">
                Together: <strong>{observations.length}</strong> observation{observations.length === 1 ? '' : 's'}
                {observations.length > 0 && (
                  <span className="text-[#6B7280]"> — {problemCount} problem{problemCount === 1 ? '' : 's'}, {goodCount} working well</span>
                )}
                {myCount > 0 && <span className="text-[#6B7280]"> · {myCount} yours</span>}
              </p>
            </div>

            {/* Wrap up + extras */}
            <div className="mt-3 space-y-2">
              <button
                onClick={() => setView('wrapup')}
                className={`flex w-full items-center justify-between rounded-xl p-4 text-left shadow-sm transition ${
                  wrapDone ? 'bg-white' : 'bg-[#191A2E] text-white'
                }`}
              >
                <span>
                  <span className={`font-semibold ${wrapDone ? 'text-[#191A2E]' : 'text-white'}`}>
                    {wrapDone ? 'Wrap-up submitted — thank you!' : 'Done walking? Wrap up'}
                  </span>
                  <span className={`block text-xs ${wrapDone ? 'text-[#6B7280]' : 'text-white/75'}`}>
                    {wrapDone ? 'You can still add photos.' : 'Four quick verdicts and a top fix — about 2 minutes.'}
                  </span>
                </span>
                {wrapDone ? (
                  <CheckCircle size={20} weight="fill" className="shrink-0 text-[#52B788]" />
                ) : (
                  <ArrowRight size={18} weight="bold" className="shrink-0 text-[#BAF14D]" />
                )}
              </button>

              {enabledExtras.length > 0 && (
                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                    <Binoculars size={14} weight="regular" /> Extra forms from the organizer
                  </p>
                  <div className="space-y-1.5">
                    {enabledExtras.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setModuleId(m.id)
                          setView('module')
                          window.scrollTo({ top: 0 })
                        }}
                        className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 text-left"
                      >
                        <span>
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-[#191A2E]">
                            {m.name}
                            {doneModules.includes(m.id) && (
                              <CheckCircle size={14} weight="fill" className="text-[#52B788]" />
                            )}
                          </span>
                          <span className="block text-[11px] text-[#6B7280]">{m.tagline}</span>
                        </span>
                        <ArrowRight size={14} weight="bold" className="shrink-0 text-[#6B7280]" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Wrap-up ── */}
        {view === 'wrapup' && (
          <>
            <button
              onClick={() => setView('walk')}
              className="mb-3 inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#191A2E]"
            >
              <ArrowLeft size={14} weight="bold" /> Back to the walk
            </button>
            <h2 className="text-lg font-bold text-[#191A2E]">Your overall take</h2>
            <p className="mb-4 mt-1 text-xs text-[#6B7280]">About two minutes. Your photos are already saved — this is the big picture.</p>

            {LENSES.map((l) => (
              <RadioGroup
                key={l.key}
                label={`${l.name} along this ${audit.area_type === 'route' ? 'route' : 'area'}:`}
                value={verdicts[l.key] ?? null}
                options={ROLLUP_OPTIONS}
                onChange={(v) => setVerdicts((prev) => ({ ...prev, [l.key]: v }))}
              />
            ))}

            <RadioGroup
              label="If one thing got fixed first, it should be:"
              value={topFix}
              options={TOP_FIX_OPTIONS.map((o) => ({ value: o, label: o }))}
              onChange={(v) => setTopFix(v)}
            />
            {topFix === 'Something else' && (
              <FreeTextField label="What would it be?" value={topFixNote} onChange={setTopFixNote} />
            )}

            <div className="relative mb-4">
              <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-[#191A2E]">
                <HandHeart size={15} weight="regular" className="text-[#52B788]" /> Who did you connect with on this walk?
              </p>
              <div className="relative">
                <input
                  value={connectedWith}
                  onChange={(e) => setConnectedWith(e.target.value)}
                  placeholder="Neighbors, a shop owner, a councilor… (optional)"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm focus:border-[#2966E5] focus:outline-none"
                />
                {connectedDictation.supported && (
                  <button
                    onClick={connectedDictation.toggle}
                    aria-label={connectedDictation.listening ? 'Stop dictating' : 'Dictate'}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 transition ${
                      connectedDictation.listening
                        ? 'animate-pulse bg-red-500 text-white'
                        : 'bg-gray-100 text-[#6B7280] hover:bg-[#2966E5]/10 hover:text-[#2966E5]'
                    }`}
                  >
                    <Microphone size={16} weight={connectedDictation.listening ? 'fill' : 'regular'} />
                  </button>
                )}
              </div>
            </div>

            <div className="mb-4">
              <p className="mb-1 text-sm font-medium text-[#191A2E]">Your name (optional)</p>
              <input
                value={observer}
                onChange={(e) => saveObserver(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#2966E5] focus:outline-none"
              />
            </div>

            {submitError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-medium text-red-700">{submitError}</p>
              </div>
            )}

            <button
              onClick={submitWrapUp}
              disabled={submitting}
              className="w-full rounded-xl bg-[#2966E5] py-4 text-base font-bold text-white disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit wrap-up'}
            </button>
          </>
        )}

        {/* ── Extra module ── */}
        {view === 'module' && activeModule && (
          <>
            <button
              onClick={() => setView('walk')}
              className="mb-3 inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#191A2E]"
            >
              <ArrowLeft size={14} weight="bold" /> Back to the walk
            </button>
            <h2 className="text-lg font-bold text-[#191A2E]">{activeModule.name}</h2>
            <p className="mb-4 mt-1 text-xs text-[#6B7280]">Answer what you can — skip anything that doesn&apos;t apply.</p>
            <ModuleForm
              module={activeModule}
              answers={moduleAnswers}
              onChange={(key, value) => setModuleAnswers((prev) => ({ ...prev, [key]: value }))}
            />
            <FreeTextField label="Anything else?" value={moduleNotes} onChange={setModuleNotes} />
            <RadioGroup
              label="Overall, this area is…"
              value={moduleRollup}
              options={ROLLUP_OPTIONS}
              onChange={(v) => setModuleRollup(v)}
            />
            {submitError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-medium text-red-700">{submitError}</p>
              </div>
            )}
            <button
              onClick={submitModule}
              disabled={submitting}
              className="w-full rounded-xl bg-[#2966E5] py-4 text-base font-bold text-white disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </>
        )}

        {/* ── A planned stop ── */}
        {view === 'stop' && activeStop !== null && stops[activeStop] && (
          <StopCheck
            key={stops[activeStop].id}
            token={token}
            auditId={audit.id}
            stop={stops[activeStop]}
            index={activeStop}
            total={stops.length}
            observer={observer}
            activity={stopActivity.filter((a) => a.stop_id === stops[activeStop].id)}
            nextStop={stops[activeStop + 1] ?? null}
            onChecked={(id) => {
              setDoneStops((prev) => new Set(prev).add(id))
              setStopActivity((prev) => [...prev, { stop_id: id, kind: 'stop_check', observer_name: observer.trim() || null }])
            }}
            onNotesSaved={(id) =>
              setStopActivity((prev) => [...prev, { stop_id: id, kind: 'stop_discussion', observer_name: observer.trim() || null }])
            }
            onBack={() => setView('walk')}
            onFlag={() => {
              setCaptureReturn('stop')
              setView('capture')
            }}
            onNext={() => {
              setView('walk')
              window.scrollTo({ top: 0 })
            }}
          />
        )}

        {/* ── Done ── */}
        {view === 'done' && (
          <div className="pt-10 text-center">
            <CheckCircle size={40} weight="regular" className="mx-auto mb-4 text-green-600" />
            <h2 className="text-xl font-bold text-[#191A2E]">That&apos;s a wrap — thank you!</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[#6B7280]">
              Your observations and verdicts go straight to the organizer
              {audit.org_name ? ` at ${audit.org_name}` : ''}. Together the group flagged{' '}
              {observations.length} spot{observations.length === 1 ? '' : 's'} today.
            </p>
            <button
              onClick={() => setView('walk')}
              className="mt-6 rounded-xl bg-[#2966E5] px-6 py-3 text-sm font-bold text-white"
            >
              Back to the map
            </button>
          </div>
        )}
      </div>

      {/* Flag-a-spot button */}
      {view !== 'briefing' && view !== 'capture' && view !== 'stop' && (
        <button
          onClick={() => {
            setCaptureReturn('walk')
            setView('capture')
          }}
          className="fixed bottom-6 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[#D97706] px-6 py-3.5 text-base font-bold text-white shadow-xl"
        >
          <Camera size={20} weight="fill" /> Photo of this spot
        </button>
      )}

      {view === 'capture' && (
        <ObservationCapture
          token={token}
          auditId={audit.id}
          observer={observer}
          routeCoordinates={routeCoordinates}
          fallbackCenter={locationCenter ?? routePoints[0] ?? null}
          onSaved={(obs) => setObservations((prev) => [...prev, obs])}
          onClose={() => setView(captureReturn === 'stop' && activeStop !== null ? 'stop' : 'walk')}
        />
      )}

      {/* "You're at a stop" card */}
      {nearStop !== null && stops[nearStop] && view === 'walk' && !doneStops.has(stops[nearStop].id) && (
        <div className="fixed bottom-24 left-1/2 z-10 w-[340px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-2xl bg-white p-4 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#191A2E] text-sm font-extrabold text-white">{nearStop + 1}</span>
              <div className="min-w-0">
                <p className="text-[13px] text-[#4B5563]">You&apos;re at stop {nearStop + 1}</p>
                <p className="truncate text-[15px] font-semibold text-[#191A2E]">{stops[nearStop].name}</p>
              </div>
            </div>
            <button
              onClick={() => setNearStop(null)}
              aria-label="Dismiss"
              className="rounded-md p-1 text-[#6B7280] hover:text-[#191A2E]"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
          <button
            onClick={() => openStop(nearStop)}
            className="mt-3 w-full rounded-xl bg-[#2966E5] py-3 text-sm font-bold text-white"
          >
            Start the questions
          </button>
        </div>
      )}

      {/* Block check-in card */}
      {!hasStops && checkInBlock !== null && checkInBlockDef && view === 'walk' && (
        <div className="fixed bottom-24 left-1/2 z-10 w-[340px] -translate-x-1/2 rounded-2xl bg-white p-4 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#191A2E]">
              {checkInBlockDef.name ?? `Block ${checkInBlock + 1}`}
            </p>
            <button
              onClick={() => setCheckInBlock(null)}
              aria-label="Dismiss"
              className="rounded-md p-1 text-[#9CA3AF] hover:text-[#191A2E]"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
          <p className="mb-2.5 text-xs text-[#6B7280]">How was this block?</p>
          <div className="flex gap-2">
            <button
              onClick={() => submitBlockCheck(checkInBlock, 'fine')}
              className="flex-1 rounded-lg bg-[#52B788] py-2.5 text-sm font-bold text-white"
            >
              Fine
            </button>
            <button
              onClick={() => submitBlockCheck(checkInBlock, 'soso')}
              className="flex-1 rounded-lg bg-[#D97706] py-2.5 text-sm font-bold text-white"
            >
              So-so
            </button>
            <button
              onClick={() => submitBlockCheck(checkInBlock, 'rough')}
              className="flex-1 rounded-lg bg-[#DC2626] py-2.5 text-sm font-bold text-white"
            >
              Rough
            </button>
          </div>
          <button
            onClick={() => {
              setCheckInBlock(null)
              setView('capture')
            }}
            className="mt-2 w-full rounded-lg border border-gray-200 py-2 text-xs font-semibold text-[#D97706]"
          >
            <Camera size={13} weight="fill" className="mr-1 inline" /> Take a photo here instead
          </button>
        </div>
      )}

      {/* Hint for first-time flaggers */}
      {view === 'walk' && observations.length === 0 && checkInBlock === null && nearStop === null && (
        <p className="fixed bottom-20 left-1/2 z-10 w-64 -translate-x-1/2 text-center text-[11px] text-[#6B7280]">
          <MapPin size={12} weight="fill" className="inline text-[#D97706]" /> See something, good or bad? Take a photo and it appears on everyone&apos;s map.
        </p>
      )}
    </main>
  )
}
