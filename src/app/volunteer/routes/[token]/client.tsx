'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CheckCircle, Camera, ArrowLeft, ArrowRight, MapPin, MapTrifold, PencilSimple } from '@phosphor-icons/react'
import {
  DEFAULT_FORM, SECTIONS, unansweredIn, answerableCount,
  type FormData, type RadioValue, type BikeInfra, type BikeSuitability, type BikeRating,
  type TrafficVolume, type FeltSafe, type Lighting, type WalkAge, type BikeAge, type Recommendation,
} from '@/components/volunteer-route/formModel'
import { RadioGroup, ConditionalNote, ScoreSlider, FreeTextField, NumberField } from '@/components/volunteer-route/inputs'
import PhotoField from '@/components/volunteer-route/PhotoField'
import VolunteerRouteMap from '@/components/volunteer-route/VolunteerRouteMap'
import ProblemPinSheet from '@/components/volunteer-route/ProblemPinSheet'
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

// Steps: 0 = route overview, 1..6 = the six checklist sections,
// 7 = photos & notes, 8 = review & submit.
const STEP_COUNT = 9
const PHOTOS_STEP = 7
const REVIEW_STEP = 8

function stepTitle(step: number): string {
  if (step === 0) return 'Your route'
  if (step === PHOTOS_STEP) return 'Photos & notes'
  if (step === REVIEW_STEP) return 'Review & submit'
  return SECTIONS[step - 1].title
}

export default function VolunteerAssessmentClient(props: Props) {
  const [hydrated, setHydrated] = useState(false)
  const [restoredFrom, setRestoredFrom] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const [photos, setPhotos] = useState<DraftPhoto[]>([])
  const [photosBusy, setPhotosBusy] = useState(false)
  const [initialPhotos, setInitialPhotos] = useState<DraftPhoto[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pinSheetOpen, setPinSheetOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { save, savedAt } = useDraftSaver(props.token)

  // Restore any saved draft once, on the client only (avoids hydration mismatch).
  useEffect(() => {
    const draft = loadDraft(props.token)
    if (draft) {
      setForm(draft.form)
      setStep(Math.min(draft.step, REVIEW_STEP))
      setInitialPhotos(draft.photos)
      setPhotos(draft.photos)
      setRestoredFrom(draft.savedAt)
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist the draft on every change (debounced).
  useEffect(() => {
    if (!hydrated || submitted) return
    save(step, form, photos)
  }, [hydrated, submitted, step, form, photos, save])

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function goTo(next: number) {
    setStep(Math.max(0, Math.min(REVIEW_STEP, next)))
    setSubmitError(null)
    window.scrollTo({ top: 0 })
  }

  function startOver() {
    clearDraft(props.token)
    setForm(DEFAULT_FORM)
    setPhotos([])
    setInitialPhotos([])
    setStep(0)
    setRestoredFrom(null)
  }

  async function handleSubmit() {
    if (!form.recommendation) {
      setSubmitError('Please answer "Would you recommend this route to families?" before submitting.')
      return
    }
    if (photosBusy) {
      setSubmitError('Photos are still uploading — give them a moment, or remove any that failed.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const { data: accepted, error: updateErr } = await supabase.rpc(
        'submit_corridor_assessment',
        {
          p_token: props.token,
          p_form_data: form,
          p_walk_score: form.walk_score,
          p_bike_score: form.bike_score,
          p_photos: photos.map((p) => ({
            url: p.url,
            caption: p.caption,
            ...(p.lat != null ? { lat: p.lat, lng: p.lng, accuracy: p.accuracy, captured_at: p.captured_at } : {}),
          })),
          p_notes: form.additional_notes,
        }
      )

      if (updateErr) throw updateErr
      if (!accepted) {
        setSubmitError('This link has expired or this assessment was already submitted. If that seems wrong, reply to your assignment email and we’ll send a fresh link.')
        return
      }

      clearDraft(props.token)
      setSubmitted(true)
    } catch (err) {
      setSubmitError(`Submission failed: ${err instanceof Error ? err.message : 'Unknown error'}. Your answers are saved on this phone — try again in a minute.`)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#F4F8EE] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mb-4"><CheckCircle size={40} weight="regular" className="mx-auto text-green-600" /></div>
          <h1 className="text-xl font-bold text-[#191A2E]">Assessment Submitted!</h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            Thank you for assessing {props.corridorName}. Your observations will help create safe routes
            for families at {props.schoolName}.
          </p>
          {props.siblingCorridors.filter((c) => !c.isCurrent).length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-[#191A2E] mb-2">You have more routes to assess:</p>
              {props.siblingCorridors.filter((c) => !c.isCurrent).map((c) => (
                <a
                  key={c.assignmentId}
                  href={`/volunteer/routes/${c.token}`}
                  className="block mt-2 rounded-lg bg-[#2966E5] px-4 py-2 text-sm font-semibold text-white text-center"
                >
                  Assess {c.corridorName}
                </a>
              ))}
            </div>
          )}
        </div>
      </main>
    )
  }

  const YN = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]
  const YNN = [...YN, { value: 'na', label: 'N/A' }]
  const YNS = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'some', label: 'Some only' }]

  function renderChecklistSection(sectionIndex: number) {
    switch (SECTIONS[sectionIndex].id) {
      case 'sidewalks':
        return (
          <>
            <RadioGroup label="Is the sidewalk wide enough for two people side by side?" value={form.sidewalk_width} options={[...YN, { value: 'na', label: 'No sidewalk' }]} onChange={(v) => set('sidewalk_width', v as RadioValue)} />
            <RadioGroup label="Is the sidewalk continuous — no missing sections?" value={form.sidewalk_continuous} options={YN} onChange={(v) => set('sidewalk_continuous', v as RadioValue)} />
            <ConditionalNote show={form.sidewalk_continuous === 'no'} value={form.sidewalk_continuous_note} onChange={(v) => set('sidewalk_continuous_note', v)} placeholder="Where does it break?" />
            <RadioGroup label="Are sidewalks clear of obstructions?" value={form.sidewalk_clear} options={YN} onChange={(v) => set('sidewalk_clear', v as RadioValue)} />
            <ConditionalNote show={form.sidewalk_clear === 'no'} value={form.sidewalk_clear_note} onChange={(v) => set('sidewalk_clear_note', v)} placeholder="Describe obstructions..." />
            <RadioGroup label="Adequate space between sidewalk and traffic?" value={form.sidewalk_buffer} options={YN} onChange={(v) => set('sidewalk_buffer', v as RadioValue)} />
            <RadioGroup label="On-street parking buffering pedestrians?" value={form.sidewalk_parking} options={YNN} onChange={(v) => set('sidewalk_parking', v as RadioValue)} />
            <RadioGroup label="Sidewalks in good condition?" value={form.sidewalk_condition} options={YN} onChange={(v) => set('sidewalk_condition', v as RadioValue)} />
            <ConditionalNote show={form.sidewalk_condition === 'no'} value={form.sidewalk_condition_note} onChange={(v) => set('sidewalk_condition_note', v)} />
            <RadioGroup label="Curb ramps where the sidewalk meets a crossing (for strollers, wheelchairs, carts)?" value={form.curb_ramps} options={YNS} onChange={(v) => set('curb_ramps', v as RadioValue)} />
            <RadioGroup label="Bumpy yellow warning strips at curb ramps (so someone with low vision knows the street is starting)?" value={form.tactile_strips} options={YNS} onChange={(v) => set('tactile_strips', v as RadioValue)} />
          </>
        )
      case 'crosswalks':
        return (
          <>
            <RadioGroup label="Clearly marked crosswalks at major intersections?" value={form.crosswalk_marked} options={YNS} onChange={(v) => set('crosswalk_marked', v as RadioValue)} />
            <RadioGroup label="Crossing signals present where needed?" value={form.crosswalk_signals} options={YNS} onChange={(v) => set('crosswalk_signals', v as RadioValue)} />
            <RadioGroup label="Crossing signals give enough time?" value={form.crosswalk_time} options={[...YN, { value: 'na', label: 'No signals' }]} onChange={(v) => set('crosswalk_time', v as RadioValue)} />
            {(form.crosswalk_signals === 'yes' || form.crosswalk_signals === 'some') && (
              <div className="mb-2 rounded-xl bg-white p-3">
                <p className="mb-2 text-xs text-[#6B7280]">
                  If you can, time one signal — these two numbers are what traffic engineers act on.
                </p>
                <NumberField label="About how many seconds does the walk signal give to cross?" value={form.signal_crossing_seconds} onChange={(v) => set('signal_crossing_seconds', v)} unit="seconds" />
                <NumberField label="About how many seconds did you wait for the walk signal?" value={form.signal_wait_seconds} onChange={(v) => set('signal_wait_seconds', v)} unit="seconds" />
              </div>
            )}
            <RadioGroup label="Do people have to walk too far out of their way to find a safe place to cross?" value={form.crossing_too_far} options={YN} onChange={(v) => set('crossing_too_far', v as RadioValue)} />
            <RadioGroup label="Can you see oncoming traffic clearly before crossing?" value={form.crosswalk_visibility} options={YN} onChange={(v) => set('crosswalk_visibility', v as RadioValue)} />
            <ConditionalNote show={form.crosswalk_visibility === 'no'} value={form.crosswalk_visibility_note} onChange={(v) => set('crosswalk_visibility_note', v)} placeholder="Describe obstruction..." />
            <RadioGroup label="Are crossing guards present along this route?" value={form.crossing_guards_present} options={YN} onChange={(v) => set('crossing_guards_present', v as RadioValue)} />
            <ConditionalNote show={form.crossing_guards_present === 'yes'} value={form.crossing_guard_locations} onChange={(v) => set('crossing_guard_locations', v)} placeholder="Where are crossing guards stationed? (e.g., intersection of Elm St and Highland Ave)" />
          </>
        )
      case 'traffic':
        return (
          <>
            <RadioGroup label="Do drivers respect pedestrians — yielding, not blocking?" value={form.traffic_drivers_respect} options={YN} onChange={(v) => set('traffic_drivers_respect', v as RadioValue)} />
            <ConditionalNote show={form.traffic_drivers_respect === 'no'} value={form.traffic_drivers_note} onChange={(v) => set('traffic_drivers_note', v)} />
            <RadioGroup label="Do vehicles follow posted speed limits?" value={form.traffic_speed} options={YN} onChange={(v) => set('traffic_speed', v as RadioValue)} />
            <RadioGroup label="Overall traffic volume:" value={form.traffic_volume} options={[
              { value: 'low', label: 'Low — comfortable' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'high', label: 'High — heavy traffic' },
            ]} onChange={(v) => set('traffic_volume', v as TrafficVolume)} />
            <div className="mb-4">
              <p className="text-sm font-medium text-[#191A2E] mb-2">Risky driver behaviors you saw (check all that apply):</p>
              {['Rolling through stop signs', 'Not yielding when turning', 'Stopping in the crosswalk', 'Backing out of driveways without looking', 'Looking at phones', 'Sudden or unexpected maneuvers', 'None observed'].map((h) => (
                <label key={h} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={form.driver_behaviors.includes(h)}
                    onChange={(e) => {
                      set('driver_behaviors', e.target.checked
                        ? [...form.driver_behaviors, h]
                        : form.driver_behaviors.filter((x) => x !== h))
                    }}
                    className="rounded border-gray-300 text-[#2966E5]"
                  />
                  <span className="text-sm text-[#374151]">{h}</span>
                </label>
              ))}
            </div>
          </>
        )
      case 'biking':
        return (
          <>
            <RadioGroup label="Protected bike lane or separated path?" value={form.bike_protected} options={[
              { value: 'protected', label: 'Protected/separated' },
              { value: 'painted', label: 'Painted lane only' },
              { value: 'none', label: 'No infrastructure' },
            ]} onChange={(v) => set('bike_protected', v as BikeInfra)} />
            {form.bike_protected === 'none' && (
              <RadioGroup label="Road low-speed/low-volume enough for a child to ride?" value={form.bike_low_speed} options={[
                { value: 'yes', label: 'Yes' },
                { value: 'caution', label: 'With caution' },
                { value: 'no', label: 'No' },
              ]} onChange={(v) => set('bike_low_speed', v as BikeSuitability)} />
            )}
            <div className="mb-4">
              <p className="text-sm font-medium text-[#191A2E] mb-2">Bike-specific hazards (check all that apply):</p>
              {['Storm drain grates', 'Rail/trolley tracks', 'Gravel or debris', 'Narrow lanes, no shoulder', 'None observed'].map((h) => (
                <label key={h} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={form.bike_hazards.includes(h)}
                    onChange={(e) => {
                      set('bike_hazards', e.target.checked
                        ? [...form.bike_hazards, h]
                        : form.bike_hazards.filter((x) => x !== h))
                    }}
                    className="rounded border-gray-300 text-[#2966E5]"
                  />
                  <span className="text-sm text-[#374151]">{h}</span>
                </label>
              ))}
            </div>
            <RadioGroup label="Overall biking safety:" value={form.bike_overall_rating} options={[
              { value: 'confident', label: 'Suitable for confident child cyclists' },
              { value: 'adult', label: 'Suitable with adult' },
              { value: 'not_recommended', label: 'Not recommended' },
            ]} onChange={(v) => set('bike_overall_rating', v as BikeRating)} />
          </>
        )
      case 'surroundings':
        return (
          <>
            <RadioGroup label="Did you feel safe walking or biking this route?" value={form.felt_safe} options={[
              { value: 'yes', label: 'Yes' },
              { value: 'concerns', label: 'Yes, with concerns' },
              { value: 'no', label: 'No' },
            ]} onChange={(v) => set('felt_safe', v as FeltSafe)} />
            <RadioGroup label="Any spots with crime or harassment concerns (separate from traffic)?" value={form.safe_from_crime} options={[
              { value: 'yes', label: 'No concerns' },
              { value: 'concerns', label: 'Some concerns' },
              { value: 'no', label: 'Serious concerns' },
            ]} onChange={(v) => set('safe_from_crime', v as FeltSafe)} />
            <RadioGroup label="Would this route feel safe at dusk? (Winter dismissals happen in low light.)" value={form.safe_at_dusk} options={YN} onChange={(v) => set('safe_at_dusk', v as RadioValue)} />
            <RadioGroup label="Does the route feel welcoming for families of all ages, abilities, and backgrounds?" value={form.welcoming_all} options={[
              { value: 'yes', label: 'Yes' },
              { value: 'concerns', label: 'Mostly' },
              { value: 'no', label: 'No' },
            ]} onChange={(v) => set('welcoming_all', v as FeltSafe)} />
            <RadioGroup label="Adequate street lighting?" value={form.lighting} options={[
              { value: 'yes', label: 'Yes' },
              { value: 'partial', label: 'Partially' },
              { value: 'no', label: 'No' },
            ]} onChange={(v) => set('lighting', v as Lighting)} />
            <RadioGroup label="Streets free of litter and debris?" value={form.litter_free} options={YN} onChange={(v) => set('litter_free', v as RadioValue)} />
            <RadioGroup label="Street trees or shade?" value={form.shade} options={[
              { value: 'yes', label: 'Yes' },
              { value: 'some', label: 'Some' },
              { value: 'no', label: 'No' },
            ]} onChange={(v) => set('shade', v as RadioValue)} />
          </>
        )
      case 'overall':
        return (
          <>
            <ScoreSlider label="Overall walking safety (1-10)" value={form.walk_score} onChange={(v) => set('walk_score', v)} />
            <ScoreSlider label="Overall biking safety (1-10)" value={form.bike_score} onChange={(v) => set('bike_score', v)} />
            <RadioGroup label="Recommended grade level for independent walking:" value={form.walk_age} options={[
              { value: 'k2_adult', label: 'Grades K-2 with adult' },
              { value: '35_buddy', label: 'Grades 3-5 with buddy' },
              { value: '6_independent', label: 'Grade 6+ independently' },
            ]} onChange={(v) => set('walk_age', v as WalkAge)} />
            <RadioGroup label="Recommended grade level for independent biking:" value={form.bike_age} options={[
              { value: 'not_recommended', label: 'Not recommended' },
              { value: '35_adult', label: 'Grades 3-5 with adult' },
              { value: '6_buddy', label: 'Grade 6+ with buddy' },
              { value: '6_independent', label: 'Grade 6+ independently' },
            ]} onChange={(v) => set('bike_age', v as BikeAge)} />
            <FreeTextField label="Seasonal notes" value={form.seasonal_notes} onChange={(v) => set('seasonal_notes', v)}
              placeholder="e.g., flooding risk, icy stretches, spots where plowed snow blocks the sidewalk, who shovels here (city vs. homeowners), dark corners in winter..." />
            <FreeTextField label="Specific hazards not covered above" value={form.specific_hazards} onChange={(v) => set('specific_hazards', v)} />
            <RadioGroup label="Would you recommend this route to families?" value={form.recommendation} options={[
              { value: 'yes', label: 'Yes — as-is' },
              { value: 'caveats', label: 'Yes, with caveats' },
              { value: 'no', label: 'No — safety concerns' },
            ]} onChange={(v) => set('recommendation', v as Recommendation)} />
          </>
        )
    }
  }

  function renderStep() {
    if (step === 0) {
      return (
        <>
          <div className="rounded-xl bg-white p-4 shadow-sm mb-4">
            <h2 className="font-bold text-[#191A2E]">{props.corridorName}</h2>
            <p className="text-xs text-[#6B7280] mt-1">
              {props.distanceMiles} mi · ~{props.walkMinutes} min walk · ~{props.bikeMinutes} min bike
            </p>
            <div className="flex gap-2 mt-3">
              {props.walkUrl && (
                <a href={props.walkUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 rounded-lg bg-[#2966E5] px-3 py-2 text-center text-xs font-semibold text-white">
                  Open Walking Route
                </a>
              )}
              {props.bikeUrl && (
                <a href={props.bikeUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 rounded-lg bg-[#52B788] px-3 py-2 text-center text-xs font-semibold text-white">
                  Open Cycling Route
                </a>
              )}
            </div>
          </div>

          {props.routeCoordinates.length >= 2 && (
            <div className="rounded-xl bg-white p-2 shadow-sm mb-4">
              <VolunteerRouteMap routeCoordinates={props.routeCoordinates} pins={form.problem_pins} endLabel="School" />
              <p className="mt-1.5 px-2 pb-1 text-[11px] text-[#6B7280] inline-flex items-center gap-1">
                <MapTrifold size={13} weight="regular" /> The route you&apos;re assessing — A is the start, B is the school.
              </p>
            </div>
          )}

          {props.pointsOfInterest.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-4">
              <p className="text-xs font-semibold text-amber-800 mb-2">
                Points of interest along this route — please pay particular attention:
              </p>
              <ul className="space-y-1">
                {props.pointsOfInterest.map((p, i) => (
                  <li key={i} className="text-xs text-amber-700">• {p.description}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 mb-4">
            <p className="text-xs font-semibold text-blue-800 flex items-center gap-1"><Camera size={14} weight="regular" /> Photo Guidance</p>
            <p className="text-xs text-blue-700 mt-1">
              Please take photos to document specific conditions — particularly hazards, missing sidewalks,
              unsafe crossings, or inadequate bike infrastructure. Each photo should capture a specific
              condition worth flagging.
            </p>
          </div>

          <p className="text-xs text-[#6B7280] mb-4">
            The form has {SECTIONS.length} short sections plus photos. Your answers save on this phone
            as you go — if the page reloads mid-walk, you&apos;ll pick up where you left off.
          </p>
        </>
      )
    }

    if (step >= 1 && step <= SECTIONS.length) {
      return <div ref={scrollRef}>{renderChecklistSection(step - 1)}</div>
    }

    if (step === PHOTOS_STEP) {
      return (
        <>
          <PhotoField
            corridorId={props.corridorId}
            initialPhotos={initialPhotos}
            onPhotosChange={setPhotos}
            onBusyChange={setPhotosBusy}
          />
          <FreeTextField label="Additional notes" value={form.additional_notes} onChange={(v) => set('additional_notes', v)} rows={3} />
        </>
      )
    }

    // Review & submit
    const sectionSummaries = SECTIONS.map((s, i) => {
      const missing = unansweredIn(form, s)
      return { section: s, stepIndex: i + 1, missing, total: answerableCount(form, s) }
    })
    const totalMissing = sectionSummaries.reduce((n, s) => n + s.missing.length, 0)

    return (
      <>
        <div className="rounded-xl bg-white p-4 shadow-sm mb-4">
          {sectionSummaries.map(({ section, stepIndex, missing, total }) => (
            <div key={section.id} className="flex items-center justify-between border-b border-gray-100 py-2.5 last:border-0">
              <div>
                <p className="text-sm font-medium text-[#191A2E]">{section.title}</p>
                <p className={`text-xs ${missing.length === 0 ? 'text-green-700' : 'text-amber-700'}`}>
                  {missing.length === 0
                    ? `All ${total} answered`
                    : `${total - missing.length} of ${total} answered`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => goTo(stepIndex)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-[#2966E5]"
              >
                <PencilSimple size={13} weight="regular" /> Edit
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between border-b border-gray-100 py-2.5">
            <div>
              <p className="text-sm font-medium text-[#191A2E]">Photos</p>
              <p className="text-xs text-[#6B7280]">
                {photos.length === 0 ? 'None added' : `${photos.length} uploaded`}
                {photosBusy ? ' · still uploading…' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => goTo(PHOTOS_STEP)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-[#2966E5]"
            >
              <PencilSimple size={13} weight="regular" /> Edit
            </button>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-sm font-medium text-[#191A2E]">Flagged spots</p>
              <p className="text-xs text-[#6B7280]">
                {form.problem_pins.length === 0
                  ? 'None flagged — that’s fine if nothing stood out'
                  : `${form.problem_pins.length} pinned on the map`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPinSheetOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-[#2966E5]"
            >
              <PencilSimple size={13} weight="regular" /> Edit
            </button>
          </div>
        </div>

        {totalMissing > 0 && (
          <p className="text-xs text-amber-700 mb-4">
            {totalMissing} question{totalMissing === 1 ? '' : 's'}{' '}left blank — that&apos;s OK if they
            didn&apos;t apply, but please double-check before submitting.
          </p>
        )}

        {submitError && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 mb-4">
            <p className="text-xs font-medium text-red-700">{submitError}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || photosBusy}
          className="w-full rounded-xl bg-[#2966E5] py-4 text-base font-bold text-white transition hover:bg-[#2966E5]/90 disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : photosBusy ? 'Waiting for photos…' : 'Submit Assessment'}
        </button>
      </>
    )
  }

  return (
    <main className="min-h-screen bg-[#F4F8EE]">
      {/* Header */}
      <div className="bg-[#191A2E] px-4 py-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="font-display text-xl font-extrabold text-white">Shift</span>
          <span className="inline-flex items-center gap-[3px] relative" style={{ top: '-1px' }}>
            <svg viewBox="0 0 9 15" width="11" height="17" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,0 L9,7.5 L0,15 L0,11 L5.5,7.5 L0,4Z" fill="#BAF14D" />
            </svg>
            <svg viewBox="0 0 9 15" width="11" height="17" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,0 L9,7.5 L0,15 L0,11 L5.5,7.5 L0,4Z" fill="#2966E5" />
            </svg>
          </span>
          <span className="text-xs font-medium text-white/50">for Schools</span>
        </div>
        <h1 className="text-lg font-bold text-white">{props.schoolName}</h1>
        <p className="text-xs text-white/75">{props.schoolCity}</p>
        <p className="mt-2 text-[10px] text-white/75">
          by <span className="font-bold">Green Streets</span> Initiative
        </p>
      </div>
      <div className="h-[3px] bg-[#52B788]" />

      {/* Sticky progress header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-[#F4F8EE]/95 backdrop-blur px-4 py-2.5">
        <div className="mx-auto max-w-[600px]">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-[#191A2E]">{stepTitle(step)}</p>
            <p className="text-xs text-[#6B7280]">Step {step + 1} of {STEP_COUNT}</p>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-[#2966E5] transition-all"
              style={{ width: `${((step + 1) / STEP_COUNT) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[600px] px-4 py-5 pb-28">
        {restoredFrom && step > 0 && (
          <div className="rounded-xl bg-white border border-gray-200 p-3 mb-4 flex items-center justify-between gap-3">
            <p className="text-xs text-[#374151]">
              Picked up where you left off ({new Date(restoredFrom).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}).
            </p>
            <button type="button" onClick={startOver} className="shrink-0 text-xs font-semibold text-[#6B7280] underline">
              Start over
            </button>
          </div>
        )}

        {hydrated ? renderStep() : null}
      </div>

      {/* Flag-a-spot floating button */}
      {hydrated && (
        <button
          type="button"
          onClick={() => setPinSheetOpen(true)}
          className="fixed bottom-20 right-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-[#D97706] px-4 py-2.5 text-sm font-bold text-white shadow-lg"
        >
          <MapPin size={16} weight="fill" />
          Flag spot{form.problem_pins.length > 0 ? ` (${form.problem_pins.length})` : ''}
        </button>
      )}

      {pinSheetOpen && (
        <ProblemPinSheet
          routeCoordinates={props.routeCoordinates}
          pins={form.problem_pins}
          onChange={(pins) => set('problem_pins', pins)}
          onClose={() => setPinSheetOpen(false)}
        />
      )}

      {/* Sticky footer nav */}
      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-[600px] items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-[#374151] disabled:opacity-40"
          >
            <ArrowLeft size={15} weight="bold" /> Back
          </button>
          <p className="text-[10px] text-[#6B7280]">
            {savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Saves as you go'}
          </p>
          {step < REVIEW_STEP ? (
            <button
              type="button"
              onClick={() => goTo(step + 1)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2966E5] px-5 py-2.5 text-sm font-bold text-white"
            >
              {step === 0 ? 'Start' : 'Continue'} <ArrowRight size={15} weight="bold" />
            </button>
          ) : (
            <span className="w-[92px]" />
          )}
        </div>
      </div>
    </main>
  )
}
