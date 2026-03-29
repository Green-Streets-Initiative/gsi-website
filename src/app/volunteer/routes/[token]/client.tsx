'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

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
  pointsOfInterest: { description: string }[]
  siblingCorridors: { assignmentId: string; token: string; corridorName: string; isCurrent: boolean }[]
}

type RadioValue = 'yes' | 'no' | 'na' | 'some' | null
type BikeInfra = 'protected' | 'painted' | 'none' | null
type BikeSuitability = 'yes' | 'caution' | 'no' | null
type BikeRating = 'confident' | 'adult' | 'not_recommended' | null
type TrafficVolume = 'low' | 'moderate' | 'high' | null
type FeltSafe = 'yes' | 'concerns' | 'no' | null
type Lighting = 'yes' | 'partial' | 'no' | null
type WalkAge = 'k2_adult' | '35_buddy' | '6_independent' | null
type BikeAge = 'not_recommended' | '35_adult' | '6_buddy' | '6_independent' | null
type Recommendation = 'yes' | 'caveats' | 'no' | null

interface FormData {
  // Section 1: Sidewalks
  sidewalk_width: RadioValue
  sidewalk_continuous: RadioValue
  sidewalk_continuous_note: string
  sidewalk_clear: RadioValue
  sidewalk_clear_note: string
  sidewalk_buffer: RadioValue
  sidewalk_parking: RadioValue
  sidewalk_condition: RadioValue
  sidewalk_condition_note: string
  // Section 2: Crosswalks
  crosswalk_marked: RadioValue
  crosswalk_signals: RadioValue
  crosswalk_time: RadioValue
  crosswalk_visibility: RadioValue
  crosswalk_visibility_note: string
  // Section 3: Traffic
  traffic_drivers_respect: RadioValue
  traffic_drivers_note: string
  traffic_speed: RadioValue
  traffic_volume: TrafficVolume
  // Section 4: Bike Infrastructure
  bike_protected: BikeInfra
  bike_low_speed: BikeSuitability
  bike_hazards: string[]
  bike_overall_rating: BikeRating
  // Section 5: Surroundings
  felt_safe: FeltSafe
  lighting: Lighting
  litter_free: RadioValue
  shade: RadioValue
  // Section 6: Overall
  walk_score: number
  bike_score: number
  walk_age: WalkAge
  bike_age: BikeAge
  seasonal_notes: string
  specific_hazards: string
  recommendation: Recommendation
  additional_notes: string
}

const DEFAULT_FORM: FormData = {
  sidewalk_width: null, sidewalk_continuous: null, sidewalk_continuous_note: '',
  sidewalk_clear: null, sidewalk_clear_note: '', sidewalk_buffer: null,
  sidewalk_parking: null, sidewalk_condition: null, sidewalk_condition_note: '',
  crosswalk_marked: null, crosswalk_signals: null, crosswalk_time: null,
  crosswalk_visibility: null, crosswalk_visibility_note: '',
  traffic_drivers_respect: null, traffic_drivers_note: '', traffic_speed: null,
  traffic_volume: null,
  bike_protected: null, bike_low_speed: null, bike_hazards: [], bike_overall_rating: null,
  felt_safe: null, lighting: null, litter_free: null, shade: null,
  walk_score: 5, bike_score: 5, walk_age: null, bike_age: null,
  seasonal_notes: '', specific_hazards: '', recommendation: null, additional_notes: '',
}

// ─── Radio/checkbox components ───────────────────────────────────────

function RadioGroup({ label, value, options, onChange }: {
  label: string
  value: string | null
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-[#191A2E] mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              value === opt.value
                ? 'border-[#2966E5] bg-[#2966E5]/10 text-[#2966E5] font-medium'
                : 'border-gray-200 bg-white text-[#6B7280] hover:border-gray-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ConditionalNote({ show, value, onChange, placeholder }: {
  show: boolean
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  if (!show) return null
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? 'Describe...'}
      rows={2}
      className="mt-1 mb-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#2966E5] focus:outline-none"
    />
  )
}

function ScoreSlider({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-[#191A2E]">{label}</span>
        <span className="text-lg font-bold text-[#2966E5]">{value}</span>
      </div>
      <input
        type="range" min={1} max={10} step={1} value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-[#2966E5]"
      />
      <div className="flex justify-between text-[10px] text-[#6B7280]">
        <span>1 (Poor)</span><span>10 (Excellent)</span>
      </div>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-[#191A2E] rounded-lg px-4 py-2.5 mb-4 mt-6">
      <h3 className="text-sm font-bold text-white">{title}</h3>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────

export default function VolunteerAssessmentClient(props: Props) {
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const [photos, setPhotos] = useState<{ file: File; caption: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (!form.recommendation) {
      alert('Please complete the Overall Assessment section before submitting.')
      return
    }

    setSubmitting(true)
    try {
      // Upload photos
      const uploadedPhotos: { url: string; caption: string }[] = []
      for (const photo of photos) {
        const path = `${props.corridorId}/${Date.now()}-${photo.file.name}`
        const { error } = await supabase.storage
          .from('route-assessment-photos')
          .upload(path, photo.file, { contentType: photo.file.type })
        if (!error) {
          const { data } = supabase.storage.from('route-assessment-photos').getPublicUrl(path)
          uploadedPhotos.push({ url: data.publicUrl, caption: photo.caption })
        }
      }

      // Update assignment
      const { error: updateErr } = await supabase
        .from('corridor_assignments')
        .update({
          form_data: form,
          walk_score: form.walk_score,
          bike_score: form.bike_score,
          photos: uploadedPhotos,
          notes: form.additional_notes,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', props.assignmentId)

      if (updateErr) throw updateErr

      setSubmitted(true)
    } catch (err: any) {
      alert(`Submission failed: ${err?.message ?? 'Unknown error'}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#F4F8EE] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-[#191A2E]">Assessment Submitted!</h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            Thank you for assessing {props.corridorName}. Your observations will help create safe routes
            for families at {props.schoolName}.
          </p>
          {props.siblingCorridors.filter((c) => !c.isCurrent).length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-[#191A2E] mb-2">You have more corridors to assess:</p>
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

  return (
    <main className="min-h-screen bg-[#F4F8EE]">
      {/* Header */}
      <div className="bg-[#191A2E] px-4 py-5 text-center">
        <p className="text-sm font-medium text-white/50">Shift for Schools</p>
        <h1 className="mt-1 text-lg font-bold text-white">{props.schoolName}</h1>
        <p className="text-xs text-white/40">{props.schoolCity}</p>
      </div>
      <div className="h-[3px] bg-[#52B788]" />

      <div className="mx-auto max-w-[600px] px-4 py-6">
        {/* Corridor info */}
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

        {/* Points of interest */}
        {props.pointsOfInterest.length > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-4">
            <p className="text-xs font-semibold text-amber-800 mb-2">
              Points of interest along this corridor — please pay particular attention:
            </p>
            <ul className="space-y-1">
              {props.pointsOfInterest.map((p, i) => (
                <li key={i} className="text-xs text-amber-700">• {p.description}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Photo guidance */}
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 mb-4">
          <p className="text-xs font-semibold text-blue-800">📷 Photo Guidance</p>
          <p className="text-xs text-blue-700 mt-1">
            Please take photos to document specific conditions — particularly hazards, missing sidewalks,
            unsafe crossings, or inadequate bike infrastructure. Each photo should capture a specific
            condition worth flagging.
          </p>
        </div>

        {/* ── FORM ── */}
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>

          <SectionHeader title="Section 1: Sidewalks" />
          <RadioGroup label="Is the sidewalk wide enough for two people side by side?" value={form.sidewalk_width} options={[...YN, { value: 'na', label: 'No sidewalk' }]} onChange={(v) => set('sidewalk_width', v as RadioValue)} />
          <RadioGroup label="Is the sidewalk continuous — no missing sections?" value={form.sidewalk_continuous} options={YN} onChange={(v) => set('sidewalk_continuous', v as RadioValue)} />
          <ConditionalNote show={form.sidewalk_continuous === 'no'} value={form.sidewalk_continuous_note} onChange={(v) => set('sidewalk_continuous_note', v)} placeholder="Where does it break?" />
          <RadioGroup label="Are sidewalks clear of obstructions?" value={form.sidewalk_clear} options={YN} onChange={(v) => set('sidewalk_clear', v as RadioValue)} />
          <ConditionalNote show={form.sidewalk_clear === 'no'} value={form.sidewalk_clear_note} onChange={(v) => set('sidewalk_clear_note', v)} placeholder="Describe obstructions..." />
          <RadioGroup label="Adequate space between sidewalk and traffic?" value={form.sidewalk_buffer} options={YN} onChange={(v) => set('sidewalk_buffer', v as RadioValue)} />
          <RadioGroup label="On-street parking buffering pedestrians?" value={form.sidewalk_parking} options={YNN} onChange={(v) => set('sidewalk_parking', v as RadioValue)} />
          <RadioGroup label="Sidewalks in good condition?" value={form.sidewalk_condition} options={YN} onChange={(v) => set('sidewalk_condition', v as RadioValue)} />
          <ConditionalNote show={form.sidewalk_condition === 'no'} value={form.sidewalk_condition_note} onChange={(v) => set('sidewalk_condition_note', v)} />

          <SectionHeader title="Section 2: Crosswalks" />
          <RadioGroup label="Clearly marked crosswalks at major intersections?" value={form.crosswalk_marked} options={YNS} onChange={(v) => set('crosswalk_marked', v as RadioValue)} />
          <RadioGroup label="Crossing signals present where needed?" value={form.crosswalk_signals} options={YNS} onChange={(v) => set('crosswalk_signals', v as RadioValue)} />
          <RadioGroup label="Crossing signals give enough time?" value={form.crosswalk_time} options={[...YN, { value: 'na', label: 'No signals' }]} onChange={(v) => set('crosswalk_time', v as RadioValue)} />
          <RadioGroup label="Can you see oncoming traffic clearly before crossing?" value={form.crosswalk_visibility} options={YN} onChange={(v) => set('crosswalk_visibility', v as RadioValue)} />
          <ConditionalNote show={form.crosswalk_visibility === 'no'} value={form.crosswalk_visibility_note} onChange={(v) => set('crosswalk_visibility_note', v)} placeholder="Describe obstruction..." />

          <SectionHeader title="Section 3: Traffic Conditions" />
          <RadioGroup label="Do drivers respect pedestrians — yielding, not blocking?" value={form.traffic_drivers_respect} options={YN} onChange={(v) => set('traffic_drivers_respect', v as RadioValue)} />
          <ConditionalNote show={form.traffic_drivers_respect === 'no'} value={form.traffic_drivers_note} onChange={(v) => set('traffic_drivers_note', v)} />
          <RadioGroup label="Do vehicles follow posted speed limits?" value={form.traffic_speed} options={YN} onChange={(v) => set('traffic_speed', v as RadioValue)} />
          <RadioGroup label="Overall traffic volume:" value={form.traffic_volume} options={[
            { value: 'low', label: 'Low — comfortable' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'high', label: 'High — heavy traffic' },
          ]} onChange={(v) => set('traffic_volume', v as TrafficVolume)} />

          <SectionHeader title="Section 4: Bike Infrastructure" />
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

          <SectionHeader title="Section 5: Overall Surroundings" />
          <RadioGroup label="Did you feel safe walking or biking this route?" value={form.felt_safe} options={[
            { value: 'yes', label: 'Yes' },
            { value: 'concerns', label: 'Yes, with concerns' },
            { value: 'no', label: 'No' },
          ]} onChange={(v) => set('felt_safe', v as FeltSafe)} />
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

          <SectionHeader title="Section 6: Overall Assessment" />
          <ScoreSlider label="Overall walking safety (1-10)" value={form.walk_score} onChange={(v) => set('walk_score', v)} />
          <ScoreSlider label="Overall biking safety (1-10)" value={form.bike_score} onChange={(v) => set('bike_score', v)} />
          <RadioGroup label="Recommended age for independent walking:" value={form.walk_age} options={[
            { value: 'k2_adult', label: 'K-2 with adult' },
            { value: '35_buddy', label: '3-5 with buddy' },
            { value: '6_independent', label: 'Grade 6+ independently' },
          ]} onChange={(v) => set('walk_age', v as WalkAge)} />
          <RadioGroup label="Recommended age for independent biking:" value={form.bike_age} options={[
            { value: 'not_recommended', label: 'Not recommended' },
            { value: '35_adult', label: '3-5 with adult' },
            { value: '6_buddy', label: '6+ with buddy' },
            { value: '6_independent', label: '6+ independently' },
          ]} onChange={(v) => set('bike_age', v as BikeAge)} />

          <div className="mb-4">
            <p className="text-sm font-medium text-[#191A2E] mb-1">Seasonal notes</p>
            <textarea value={form.seasonal_notes} onChange={(e) => set('seasonal_notes', e.target.value)}
              placeholder="e.g., flooding risk, poor lighting in winter, icy sections..."
              rows={2} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#2966E5] focus:outline-none" />
          </div>

          <div className="mb-4">
            <p className="text-sm font-medium text-[#191A2E] mb-1">Specific hazards not covered above</p>
            <textarea value={form.specific_hazards} onChange={(e) => set('specific_hazards', e.target.value)}
              rows={2} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#2966E5] focus:outline-none" />
          </div>

          <RadioGroup label="Would you recommend this route to families?" value={form.recommendation} options={[
            { value: 'yes', label: 'Yes — as-is' },
            { value: 'caveats', label: 'Yes, with caveats' },
            { value: 'no', label: 'No — safety concerns' },
          ]} onChange={(v) => set('recommendation', v as Recommendation)} />

          {/* Photo uploads */}
          <div className="mb-6">
            <p className="text-sm font-medium text-[#191A2E] mb-2">Photos (up to 8)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                const newPhotos = files.slice(0, 8 - photos.length).map((f) => ({ file: f, caption: '' }))
                setPhotos((prev) => [...prev, ...newPhotos].slice(0, 8))
              }}
            />
            <button type="button" onClick={() => fileInputRef.current?.click()}
              disabled={photos.length >= 8}
              className="rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-[#6B7280] w-full hover:border-[#2966E5] hover:text-[#2966E5] disabled:opacity-50">
              📷 Add Photos ({photos.length}/8)
            </button>
            {photos.map((p, i) => (
              <div key={i} className="mt-2 flex items-start gap-2">
                <img src={URL.createObjectURL(p.file)} alt="" className="h-16 w-16 rounded-lg object-cover" />
                <div className="flex-1">
                  <input
                    value={p.caption}
                    onChange={(e) => {
                      const updated = [...photos]
                      updated[i] = { ...updated[i], caption: e.target.value }
                      setPhotos(updated)
                    }}
                    placeholder="Caption: what condition does this show?"
                    className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#2966E5] focus:outline-none"
                  />
                </div>
                <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                  className="text-xs text-red-500 hover:text-red-700">Remove</button>
              </div>
            ))}
          </div>

          <div className="mb-6">
            <p className="text-sm font-medium text-[#191A2E] mb-1">Additional notes</p>
            <textarea value={form.additional_notes} onChange={(e) => set('additional_notes', e.target.value)}
              rows={3} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#2966E5] focus:outline-none" />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#2966E5] py-4 text-base font-bold text-white transition hover:bg-[#2966E5]/90 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Assessment'}
          </button>

          <p className="mt-3 text-center text-xs text-[#6B7280]">
            Shift for Schools by Green Streets Initiative
          </p>
        </form>
      </div>
    </main>
  )
}
