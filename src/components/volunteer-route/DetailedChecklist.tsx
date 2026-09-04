'use client'

import {
  SECTIONS,
  type FormData, type RadioValue, type BikeInfra, type BikeSuitability, type BikeRating,
  type TrafficVolume, type FeltSafe, type Lighting,
} from './formModel'
import { RadioGroup, ConditionalNote, NumberField } from './inputs'

// The full SRTS-style question checklist, kept as an OPTIONAL extra behind
// the observation-first walk. The FormData keys it writes are the original
// ones — the review UI and submit RPC read them unchanged.

interface Props {
  form: FormData
  set: <K extends keyof FormData>(key: K, value: FormData[K]) => void
}

const YN = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]
const YNN = [...YN, { value: 'na', label: 'N/A' }]
const YNS = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'some', label: 'Some only' }]

export default function DetailedChecklist({ form, set }: Props) {
  function section(id: string) {
    switch (id) {
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
      default:
        return null
    }
  }

  // "overall" lives in the wrap-up; every other section is offered here.
  const sections = SECTIONS.filter((s) => s.id !== 'overall')

  return (
    <div className="space-y-5">
      {sections.map((s) => (
        <div key={s.id} className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-[#191A2E]">{s.title}</h3>
          {section(s.id)}
        </div>
      ))}
    </div>
  )
}
