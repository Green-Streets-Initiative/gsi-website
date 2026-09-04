'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, ArrowRight, Binoculars, CheckCircle, Clock, Eye, Flag,
  MapPin, Microphone, PersonSimpleWalk, X,
} from '@phosphor-icons/react'
import {
  DEFAULT_FORM,
  type FormData, type ProblemPin, type RadioValue, type WalkAge, type BikeAge, type Recommendation,
} from '@/components/volunteer-route/formModel'
import { RadioGroup, ConditionalNote, ScoreSlider, FreeTextField } from '@/components/volunteer-route/inputs'
import PhotoField from '@/components/volunteer-route/PhotoField'
import VolunteerRouteMap from '@/components/volunteer-route/VolunteerRouteMap'
import CorridorObservationSheet from '@/components/volunteer-route/CorridorObservationSheet'
import DetailedChecklist from '@/components/volunteer-route/DetailedChecklist'
import BlockStrip from '@/components/walk-audit/BlockStrip'
import { buildClientBlocks, haversineMeters } from '@/components/walk-audit/blocks'
import { useDictation } from '@/components/walk-audit/useDictation'
import { loadDraft, clearDraft, useDraftSaver, type DraftPhoto } from '@/components/volunteer-route/useDraft'

interface Props {
  assignmentId: string
  token: string
  corridorId: string
  corridorName: string
  distanceMiles: number
  walkMinutes: number
  bikeMinutes: number
  schoolName: string
  schoolCity: string
  walkUrl: string
  bikeUrl: string
  routeCoordinates: [number, number][]
  pointsOfInterest: { description: string }[]
  siblingCorridors: { assignmentId: string; token: string; corridorName: string; isCurrent: boolean }[]
}

// Observation-first corridor review. The walker gets a short briefing, then a
// walk view (route map, block-by-block progress, "Flag this spot"), then a
// two-minute wrap-up that carries the few answers the route pipeline actually
// uses. The full question checklist is an optional extra. Everything saves
// to the phone as they go and submits as one corridor assessment.

type View = 'briefing' | 'walk' | 'capture' | 'wrapup' | 'checklist' | 'done'

// Draft `step` ↔ view. 'capture' is never persisted.
const VIEW_STEP: Record<Exclude<View, 'capture' | 'done'>, number> = {
  briefing: 0, walk: 1, wrapup: 2, checklist: 3,
}
const STEP_VIEW: View[] = ['briefing', 'walk', 'wrapup', 'checklist']

const LENSES = [
  { key: 'crossings', name: 'Crossings', prompt: 'Could a 7-year-old cross here? Markings, signal time, sightlines, a crossing guard.' },
  { key: 'sidewalks', name: 'Sidewalks', prompt: 'Continuous, wide enough for a parent and child, clear, in decent shape?' },
  { key: 'traffic', name: 'Traffic', prompt: 'Speeds and driver behavior at school time — yielding, rolling stops, phones.' },
  { key: 'biking', name: 'Biking', prompt: 'Any lane or protection? Would a child ride here with an adult?' },
]

export default function VolunteerAssessmentClient(props: Props) {
  const [hydrated, setHydrated] = useState(false)
  const [restoredFrom, setRestoredFrom] = useState<string | null>(null)
  const [view, setView] = useState<View>('briefing')
  const [briefCard, setBriefCard] = useState(0)
  const [form, setForm] = useState<FormData>({ ...DEFAULT_FORM, capture_mode: 'observation_v3' })
  const [photos, setPhotos] = useState<DraftPhoto[]>([])
  const [photosBusy, setPhotosBusy] = useState(false)
  const [initialPhotos, setInitialPhotos] = useState<DraftPhoto[]>([])
  const [visitedBlocks, setVisitedBlocks] = useState<Set<number>>(new Set())
  const [checkInBlock, setCheckInBlock] = useState<number | null>(null)
  const promptedBlocks = useRef<Set<number>>(new Set())
  const watchIdRef = useRef<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { save, savedAt } = useDraftSaver(props.token)

  const notesDictation = useDictation((transcript) => {
    setForm((prev) => ({
      ...prev,
      additional_notes: prev.additional_notes ? `${prev.additional_notes} ${transcript}` : transcript,
    }))
  })

  const routePoints = useMemo(
    () => props.routeCoordinates.map(([lng, lat]) => ({ lat, lng })),
    [props.routeCoordinates],
  )
  const blocks = useMemo(() => buildClientBlocks(routePoints), [routePoints])
  const estMinutes = Math.max(15, Math.round(props.walkMinutes * 1.6))

  // ── Boot: restore draft + visited blocks (client only, avoids hydration mismatch) ──
  useEffect(() => {
    const draft = loadDraft(props.token)
    if (draft) {
      setForm({ ...draft.form, capture_mode: 'observation_v3' })
      const restoredView = STEP_VIEW[Math.min(Math.max(draft.step, 0), STEP_VIEW.length - 1)] ?? 'walk'
      // Older (checklist-era) drafts stored a section index; anything past the
      // briefing lands on the walk view.
      setView(draft.v < 3 ? (draft.step > 0 ? 'walk' : 'briefing') : restoredView)
      setInitialPhotos(draft.photos)
      setPhotos(draft.photos)
      // Only announce a restore when there was real progress to restore.
      if (draft.step > 0 || draft.form.problem_pins.length > 0 || draft.photos.length > 0) {
        setRestoredFrom(draft.savedAt)
      }
    }
    try {
      const raw = localStorage.getItem(`shift-route-blocks:${props.token}`)
      if (raw) setVisitedBlocks(new Set(JSON.parse(raw) as number[]))
    } catch { /* ignore */ }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Persist the draft on every change (debounced) ──
  useEffect(() => {
    if (!hydrated || submitted) return
    const step = view === 'capture' || view === 'done' ? VIEW_STEP.walk : VIEW_STEP[view]
    save(step, form, photos)
  }, [hydrated, submitted, view, form, photos, save])

  // ── GPS: mark blocks visited while walking, prompt a quick check-in ──
  useEffect(() => {
    if (view !== 'walk' || blocks.length === 0 || !('geolocation' in navigator)) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude }
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
              localStorage.setItem(`shift-route-blocks:${props.token}`, JSON.stringify([...next]))
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
  }, [view, blocks, props.token])

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function go(next: View) {
    setView(next)
    setSubmitError(null)
    window.scrollTo({ top: 0 })
  }

  function startOver() {
    clearDraft(props.token)
    try { localStorage.removeItem(`shift-route-blocks:${props.token}`) } catch { /* ignore */ }
    setForm({ ...DEFAULT_FORM, capture_mode: 'observation_v3' })
    setPhotos([])
    setInitialPhotos([])
    setVisitedBlocks(new Set())
    setBriefCard(0)
    setRestoredFrom(null)
    go('briefing')
  }

  function addSpot(pin: ProblemPin) {
    set('problem_pins', [...form.problem_pins, pin])
  }

  function removeSpot(index: number) {
    set('problem_pins', form.problem_pins.filter((_, i) => i !== index))
  }

  function recordBlockCheck(blockIndex: number, verdict: 'fine' | 'soso' | 'rough') {
    set('block_checks', [
      ...form.block_checks.filter((c) => c.block_index !== blockIndex),
      { block_index: blockIndex, verdict, created_at: new Date().toISOString() },
    ])
    setCheckInBlock(null)
  }

  async function handleSubmit() {
    if (!form.recommendation) {
      setSubmitError('One answer is required: would you recommend this route to families?')
      return
    }
    if (photosBusy) {
      setSubmitError('Photos are still uploading — give them a moment, or remove any that failed.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      // Spot photos ride along in p_photos too, so the review's photo strip and
      // located-photo map pins keep working without a schema change.
      const spotPhotos = form.problem_pins
        .filter((p) => p.photo?.url)
        .map((p, i) => ({
          url: p.photo!.url,
          caption: p.note || (p.valence === 'good' ? `Works well (spot ${i + 1})` : `Problem spot ${i + 1}`),
          lat: p.lat,
          lng: p.lng,
          captured_at: p.created_at,
        }))
      const otherPhotos = photos.map((p) => ({
        url: p.url,
        caption: p.caption,
        ...(p.lat != null ? { lat: p.lat, lng: p.lng, accuracy: p.accuracy, captured_at: p.captured_at } : {}),
      }))

      const { data: accepted, error: updateErr } = await supabase.rpc(
        'submit_corridor_assessment',
        {
          p_token: props.token,
          p_form_data: { ...form, capture_mode: 'observation_v3' },
          p_walk_score: form.walk_score,
          p_bike_score: form.bike_score,
          p_photos: [...spotPhotos, ...otherPhotos],
          p_notes: form.additional_notes,
        },
      )

      if (updateErr) throw updateErr
      if (!accepted) {
        setSubmitError('This link has expired or this assessment was already submitted. If that seems wrong, reply to your assignment email and we’ll send a fresh link.')
        return
      }

      clearDraft(props.token)
      try { localStorage.removeItem(`shift-route-blocks:${props.token}`) } catch { /* ignore */ }
      setSubmitted(true)
      go('done')
    } catch (err) {
      setSubmitError(`Submission failed: ${err instanceof Error ? err.message : 'Unknown error'}. Your answers are saved on this phone — try again in a minute.`)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Derived ──
  const spotPins = form.problem_pins.map((p) => ({
    ...p,
    note: p.note || (p.valence === 'good' ? 'Works well' : 'Problem'),
    color: p.valence === 'good' ? '#BAF14D' : '#D97706',
  }))
  const problemCount = form.problem_pins.filter((p) => p.valence !== 'good').length
  const goodCount = form.problem_pins.length - problemCount
  const progressPct = blocks.length > 0 ? Math.round((visitedBlocks.size / blocks.length) * 100) : 0
  const checkedBlocks = new Set(form.block_checks.map((c) => c.block_index))
  const checkInBlockDef = checkInBlock !== null ? blocks[checkInBlock] : null
  const otherCorridors = props.siblingCorridors.filter((c) => !c.isCurrent)

  const briefingCards = [
    {
      icon: <PersonSimpleWalk size={30} weight="regular" className="text-[#2966E5]" />,
      title: props.corridorName,
      body: (
        <>
          <p className="text-sm text-[#374151]">
            A candidate walking route to {props.schoolName}. You&rsquo;re checking whether we&rsquo;d hand
            this route to families — on foot, in person.
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#EBF0FD] px-3 py-1.5 text-sm font-semibold text-[#2966E5]">
            <Clock size={15} weight="bold" />
            {props.distanceMiles} mi — plan around {estMinutes} minutes
          </p>
          <p className="mt-2 text-xs text-[#6B7280]">
            Reviewing is slower than walking — you&rsquo;ll be stopping and noticing. Start at <strong>A</strong>,
            the end farthest from school, and walk toward the school the way a family would.
          </p>
          <div className="mt-3 flex gap-2">
            {props.walkUrl && (
              <a href={props.walkUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 rounded-lg bg-[#2966E5] px-3 py-2 text-center text-xs font-semibold text-white">
                Directions to A (walking)
              </a>
            )}
            {props.bikeUrl && (
              <a href={props.bikeUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 rounded-lg bg-[#52B788] px-3 py-2 text-center text-xs font-semibold text-white">
                Cycling directions
              </a>
            )}
          </div>
        </>
      ),
    },
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
            Prompts, not homework — what catches <em>your</em> eye is the data.
            {props.pointsOfInterest.length > 0 && ' We’ll also point you at a few spots our software flagged from Street View.'}
          </p>
        </>
      ),
    },
    {
      icon: <Flag size={30} weight="fill" className="text-[#D97706]" />,
      title: 'When something catches your eye, flag it',
      body: (
        <>
          <p className="text-sm text-[#374151]">
            Tap <span className="mx-0.5 inline-flex items-center gap-1 rounded-full bg-[#D97706] px-2.5 py-0.5 text-xs font-bold text-white"><Flag size={11} weight="fill" /> Flag this spot</span>,
            snap a photo, and say whether it <strong>works well</strong> or it&rsquo;s a <strong>problem</strong>. That&rsquo;s it — everything else is optional.
          </p>
          <p className="mt-2 text-sm text-[#374151]">
            Good things count. &ldquo;This crossing works&rdquo; is evidence too. Five to ten flags makes a great walk;
            then a two-minute wrap-up at the end.
          </p>
          <p className="mt-2 text-xs text-[#6B7280]">
            Everything saves on this phone as you go. Photos of streets and sidewalks, please — no people.
          </p>
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
          <span className="text-xs font-medium text-white/75">for Schools · Route review</span>
        </div>
        <h1 className="text-base font-bold text-white">{props.schoolName}</h1>
        <p className="text-xs text-white/75">{props.corridorName}{props.schoolCity ? ` · ${props.schoolCity}` : ''}</p>
      </div>
      <div className="h-[3px] bg-[#52B788]" />

      <div className="mx-auto max-w-[600px] px-4 py-5 pb-28">
        {hydrated && restoredFrom && view !== 'briefing' && view !== 'done' && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs text-[#374151]">
              Picked up where you left off ({new Date(restoredFrom).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}).
            </p>
            <button type="button" onClick={startOver} className="shrink-0 text-xs font-semibold text-[#6B7280] underline">
              Start over
            </button>
          </div>
        )}

        {/* ── Briefing ── */}
        {hydrated && view === 'briefing' && (
          <div className="pt-2">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-3">{briefingCards[briefCard].icon}</div>
              <h2 className="text-lg font-bold text-[#191A2E]">{briefingCards[briefCard].title}</h2>
              <div className="mt-2">{briefingCards[briefCard].body}</div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-1.5">
                {briefingCards.map((_, i) => (
                  <span key={i} className={`h-2 w-2 rounded-full ${i === briefCard ? 'bg-[#2966E5]' : 'bg-gray-300'}`} />
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
                    onClick={() => go('walk')}
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
        {hydrated && view === 'walk' && (
          <>
            {props.routeCoordinates.length >= 2 && (
              <div className="rounded-xl bg-white p-2 shadow-sm">
                <VolunteerRouteMap
                  routeCoordinates={props.routeCoordinates}
                  pins={spotPins}
                  heightClass="h-64"
                  endLabel="School"
                />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 text-[11px] text-[#6B7280]">
                  <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-[#3D5407]/30 bg-[#BAF14D]"></span> works well</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#D97706]"></span> problem</span>
                  <span className="ml-auto inline-flex items-center gap-1">A → School</span>
                </div>
              </div>
            )}

            {/* Directions + progress */}
            <div className="mt-3 rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-[#191A2E]">
                  {blocks.length > 0
                    ? `${visitedBlocks.size} of ${blocks.length} block${blocks.length === 1 ? '' : 's'} walked`
                    : `${props.distanceMiles} mi`}
                </span>
                {blocks.length > 0 && <span className="text-xs text-[#6B7280]">{progressPct}%</span>}
              </div>
              {blocks.length > 0 && (
                <>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-[#52B788] transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                  <BlockStrip
                    blocks={blocks}
                    visitedBlocks={visitedBlocks}
                    blockChecks={form.block_checks}
                    onTap={(i) => {
                      if (!checkedBlocks.has(i)) {
                        promptedBlocks.current.add(i)
                        setCheckInBlock(i)
                      }
                    }}
                  />
                  {progressPct >= 100 && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#3D5407]">
                      <CheckCircle size={16} weight="fill" className="text-[#52B788]" /> Whole route covered!
                    </p>
                  )}
                </>
              )}
              <div className="mt-3 flex gap-2">
                {props.walkUrl && (
                  <a href={props.walkUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-center text-xs font-semibold text-[#2966E5]">
                    Directions (walking)
                  </a>
                )}
                {props.bikeUrl && (
                  <a href={props.bikeUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-center text-xs font-semibold text-[#2966E5]">
                    Directions (cycling)
                  </a>
                )}
              </div>
            </div>

            {/* Look here: Street View flags */}
            {props.pointsOfInterest.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                  <Binoculars size={14} weight="regular" /> Look here — our software flagged these from Street View
                </p>
                <ul className="space-y-1">
                  {props.pointsOfInterest.map((p, i) => (
                    <li key={i} className="text-xs text-amber-800">• {p.description}</li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11px] text-amber-700">Street View can be months old — flag what&rsquo;s actually there.</p>
              </div>
            )}

            {/* Your flags */}
            <div className="mt-3 rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-[#374151]">
                <strong>{form.problem_pins.length}</strong> spot{form.problem_pins.length === 1 ? '' : 's'} flagged
                {form.problem_pins.length > 0 && (
                  <span className="text-[#6B7280]"> — {problemCount} problem{problemCount === 1 ? '' : 's'}, {goodCount} working well</span>
                )}
              </p>
              {form.problem_pins.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {form.problem_pins.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[#374151]">
                      <span
                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                        style={{ background: p.valence === 'good' ? '#BAF14D' : '#D97706', color: p.valence === 'good' ? '#191A2E' : '#fff' }}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1">
                        {p.note || (p.valence === 'good' ? 'Works well' : 'Problem')}
                        {p.photo?.url && <span className="ml-1 text-[#6B7280]">· photo</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSpot(i)}
                        aria-label={`Remove spot ${i + 1}`}
                        className="shrink-0 rounded p-0.5 text-[#9CA3AF] hover:text-red-600"
                      >
                        <X size={12} weight="bold" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Wrap up */}
            <button
              onClick={() => go('wrapup')}
              className="mt-3 flex w-full items-center justify-between rounded-xl bg-[#191A2E] p-4 text-left text-white shadow-sm"
            >
              <span>
                <span className="font-semibold">Done walking? Wrap up</span>
                <span className="block text-xs text-white/75">Two scores, one verdict, a couple of notes — about 2 minutes.</span>
              </span>
              <ArrowRight size={18} weight="bold" className="shrink-0 text-[#BAF14D]" />
            </button>
          </>
        )}

        {/* ── Wrap-up ── */}
        {hydrated && view === 'wrapup' && (
          <>
            <button
              onClick={() => go('walk')}
              className="mb-3 inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#191A2E]"
            >
              <ArrowLeft size={14} weight="bold" /> Back to the walk
            </button>
            <h2 className="text-lg font-bold text-[#191A2E]">Your overall take</h2>
            <p className="mb-4 mt-1 text-xs text-[#6B7280]">
              Your {form.problem_pins.length} flagged spot{form.problem_pins.length === 1 ? '' : 's'} are saved — this is the big picture.
            </p>

            <div className="rounded-xl bg-white p-4 shadow-sm">
              <ScoreSlider label="Walking this route to school, overall (1–10)" value={form.walk_score} onChange={(v) => set('walk_score', v)} />
              <ScoreSlider label="Biking this route to school, overall (1–10)" value={form.bike_score} onChange={(v) => set('bike_score', v)} />
              <RadioGroup label="Would you hand this route to families?" value={form.recommendation} options={[
                { value: 'yes', label: 'Yes — as-is' },
                { value: 'caveats', label: 'Yes, with caveats' },
                { value: 'no', label: 'No — safety concerns' },
              ]} onChange={(v) => set('recommendation', v as Recommendation)} />
            </div>

            <div className="mt-3 rounded-xl bg-white p-4 shadow-sm">
              <RadioGroup label="Youngest you'd let walk it on their own:" value={form.walk_age} options={[
                { value: 'k2_adult', label: 'K–2 only with an adult' },
                { value: '35_buddy', label: 'Grades 3–5 with a buddy' },
                { value: '6_independent', label: 'Grade 6+ alone' },
              ]} onChange={(v) => set('walk_age', v as WalkAge)} />
              <RadioGroup label="And bike it:" value={form.bike_age} options={[
                { value: 'not_recommended', label: 'Not recommended' },
                { value: '35_adult', label: 'Grades 3–5 with an adult' },
                { value: '6_buddy', label: 'Grade 6+ with a buddy' },
                { value: '6_independent', label: 'Grade 6+ alone' },
              ]} onChange={(v) => set('bike_age', v as BikeAge)} />
              <RadioGroup label="Did you see crossing guards on this route?" value={form.crossing_guards_present} options={[
                { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
              ]} onChange={(v) => set('crossing_guards_present', v as RadioValue)} />
              <ConditionalNote
                show={form.crossing_guards_present === 'yes'}
                value={form.crossing_guard_locations}
                onChange={(v) => set('crossing_guard_locations', v)}
                placeholder="Where? (e.g. Elm St at Highland Ave)"
              />
            </div>

            <div className="mt-3 rounded-xl bg-white p-4 shadow-sm">
              <FreeTextField
                label="Winter and weather"
                value={form.seasonal_notes}
                onChange={(v) => set('seasonal_notes', v)}
                placeholder="Where would plowed snow block the sidewalk? Icy stretches, puddling, dark corners at a 4pm dismissal…"
              />
              <div className="relative">
                <FreeTextField
                  label="Anything else GSI should know?"
                  value={form.additional_notes}
                  onChange={(v) => set('additional_notes', v)}
                  rows={3}
                  placeholder="Including anything about this tool that was awkward — you're testing it too."
                />
                {notesDictation.supported && (
                  <button
                    type="button"
                    onClick={notesDictation.toggle}
                    aria-label={notesDictation.listening ? 'Stop dictating' : 'Dictate'}
                    className={`absolute right-2 top-8 rounded-full p-1.5 transition ${
                      notesDictation.listening
                        ? 'animate-pulse bg-red-500 text-white'
                        : 'bg-gray-100 text-[#6B7280] hover:bg-[#2966E5]/10 hover:text-[#2966E5]'
                    }`}
                  >
                    <Microphone size={16} weight={notesDictation.listening ? 'fill' : 'regular'} />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-white p-4 shadow-sm">
              <p className="mb-2 text-sm font-medium text-[#191A2E]">Other photos (optional)</p>
              <p className="mb-2 text-xs text-[#6B7280]">Your flagged spots already carry their photos. Add anything else here.</p>
              <PhotoField
                corridorId={props.corridorId}
                initialPhotos={initialPhotos}
                onPhotosChange={setPhotos}
                onBusyChange={setPhotosBusy}
              />
            </div>

            <button
              type="button"
              onClick={() => go('checklist')}
              className="mt-3 flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white p-4 text-left"
            >
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-[#191A2E]">
                  Detailed checklist
                  {form.detailed_checklist_completed && <CheckCircle size={14} weight="fill" className="text-[#52B788]" />}
                </span>
                <span className="block text-[11px] text-[#6B7280]">Optional, about 8 minutes — sidewalks, crossings, traffic, biking, surroundings, question by question.</span>
              </span>
              <ArrowRight size={14} weight="bold" className="shrink-0 text-[#6B7280]" />
            </button>

            {submitError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-medium text-red-700">{submitError}</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || photosBusy}
              className="mt-4 w-full rounded-xl bg-[#2966E5] py-4 text-base font-bold text-white transition hover:bg-[#2966E5]/90 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : photosBusy ? 'Waiting for photos…' : 'Submit this route'}
            </button>
            <p className="mt-2 text-center text-[11px] text-[#6B7280]">
              One submission per route — you can&rsquo;t edit it afterwards. {savedAt ? `Draft saved ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` : 'Saves as you go.'}
            </p>
          </>
        )}

        {/* ── Optional detailed checklist ── */}
        {hydrated && view === 'checklist' && (
          <>
            <button
              onClick={() => go('wrapup')}
              className="mb-3 inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#191A2E]"
            >
              <ArrowLeft size={14} weight="bold" /> Back to the wrap-up
            </button>
            <h2 className="text-lg font-bold text-[#191A2E]">Detailed checklist</h2>
            <p className="mb-4 mt-1 text-xs text-[#6B7280]">Answer what you can — skip anything that doesn&rsquo;t apply. Your flags and scores are already saved.</p>
            <DetailedChecklist form={form} set={set} />
            <button
              type="button"
              onClick={() => {
                set('detailed_checklist_completed', true)
                go('wrapup')
              }}
              className="mt-4 w-full rounded-xl bg-[#2966E5] py-3.5 text-sm font-bold text-white"
            >
              Done — back to the wrap-up
            </button>
          </>
        )}

        {/* ── Done ── */}
        {view === 'done' && (
          <div className="pt-10 text-center">
            <CheckCircle size={40} weight="regular" className="mx-auto mb-4 text-green-600" />
            <h2 className="text-xl font-bold text-[#191A2E]">Route submitted — thank you!</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[#6B7280]">
              Your {form.problem_pins.length} flagged spot{form.problem_pins.length === 1 ? '' : 's'} and your verdict on {props.corridorName} go to GSI,
              alongside the crash data and Street View analysis, to decide what families at {props.schoolName} see.
            </p>
            {otherCorridors.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-sm font-medium text-[#191A2E]">You have more routes to review:</p>
                {otherCorridors.map((c) => (
                  <a
                    key={c.assignmentId}
                    href={`/volunteer/routes/${c.token}`}
                    className="mt-2 block rounded-lg bg-[#2966E5] px-4 py-2 text-center text-sm font-semibold text-white"
                  >
                    Review {c.corridorName}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Flag-a-spot button */}
      {hydrated && (view === 'walk' || view === 'wrapup') && (
        <button
          type="button"
          onClick={() => setView('capture')}
          className="fixed bottom-6 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#D97706] px-6 py-3.5 text-base font-bold text-white shadow-xl"
        >
          <Flag size={18} weight="fill" /> Flag this spot
        </button>
      )}

      {view === 'capture' && (
        <CorridorObservationSheet
          corridorId={props.corridorId}
          routeCoordinates={props.routeCoordinates}
          fallbackCenter={routePoints[0] ?? null}
          onSave={addSpot}
          onClose={() => setView('walk')}
        />
      )}

      {/* Block check-in card */}
      {checkInBlock !== null && checkInBlockDef && view === 'walk' && (
        <div className="fixed bottom-24 left-1/2 z-10 w-[340px] -translate-x-1/2 rounded-2xl bg-white p-4 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#191A2E]">Block {checkInBlock + 1}</p>
            <button
              onClick={() => setCheckInBlock(null)}
              aria-label="Dismiss"
              className="rounded-md p-1 text-[#9CA3AF] hover:text-[#191A2E]"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
          <p className="mb-2.5 text-xs text-[#6B7280]">How was this block for a kid on foot?</p>
          <div className="flex gap-2">
            <button onClick={() => recordBlockCheck(checkInBlock, 'fine')} className="flex-1 rounded-lg bg-[#52B788] py-2.5 text-sm font-bold text-white">Fine</button>
            <button onClick={() => recordBlockCheck(checkInBlock, 'soso')} className="flex-1 rounded-lg bg-[#D97706] py-2.5 text-sm font-bold text-white">So-so</button>
            <button onClick={() => recordBlockCheck(checkInBlock, 'rough')} className="flex-1 rounded-lg bg-[#DC2626] py-2.5 text-sm font-bold text-white">Rough</button>
          </div>
          <button
            onClick={() => {
              setCheckInBlock(null)
              setView('capture')
            }}
            className="mt-2 w-full rounded-lg border border-gray-200 py-2 text-xs font-semibold text-[#D97706]"
          >
            <Flag size={12} weight="fill" className="mr-1 inline" /> Flag something here instead
          </button>
        </div>
      )}

      {/* Hint for first-time flaggers */}
      {hydrated && view === 'walk' && form.problem_pins.length === 0 && checkInBlock === null && (
        <p className="fixed bottom-20 left-1/2 z-10 w-64 -translate-x-1/2 text-center text-[11px] text-[#6B7280]">
          <MapPin size={12} weight="fill" className="inline text-[#D97706]" /> See something — good or bad? Flag it and it lands on the map.
        </p>
      )}
    </main>
  )
}
