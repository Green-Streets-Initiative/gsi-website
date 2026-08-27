// Form model for the volunteer route walk form. The FormData shape and the
// RPC payload are load-bearing: submit_corridor_assessment stores form_data
// verbatim and the review UI reads these keys — do not rename fields.

export type RadioValue = 'yes' | 'no' | 'na' | 'some' | null
export type BikeInfra = 'protected' | 'painted' | 'none' | null
export type BikeSuitability = 'yes' | 'caution' | 'no' | null
export type BikeRating = 'confident' | 'adult' | 'not_recommended' | null
export type TrafficVolume = 'low' | 'moderate' | 'high' | null
export type FeltSafe = 'yes' | 'concerns' | 'no' | null
export type Lighting = 'yes' | 'partial' | 'no' | null
export type WalkAge = 'k2_adult' | '35_buddy' | '6_independent' | null
export type BikeAge = 'not_recommended' | '35_adult' | '6_buddy' | '6_independent' | null
export type Recommendation = 'yes' | 'caveats' | 'no' | null

export interface FormData {
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
  crossing_guards_present: RadioValue
  crossing_guard_locations: string
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

export const DEFAULT_FORM: FormData = {
  sidewalk_width: null, sidewalk_continuous: null, sidewalk_continuous_note: '',
  sidewalk_clear: null, sidewalk_clear_note: '', sidewalk_buffer: null,
  sidewalk_parking: null, sidewalk_condition: null, sidewalk_condition_note: '',
  crosswalk_marked: null, crosswalk_signals: null, crosswalk_time: null,
  crosswalk_visibility: null, crosswalk_visibility_note: '',
  crossing_guards_present: null, crossing_guard_locations: '',
  traffic_drivers_respect: null, traffic_drivers_note: '', traffic_speed: null,
  traffic_volume: null,
  bike_protected: null, bike_low_speed: null, bike_hazards: [], bike_overall_rating: null,
  felt_safe: null, lighting: null, litter_free: null, shade: null,
  walk_score: 5, bike_score: 5, walk_age: null, bike_age: null,
  seasonal_notes: '', specific_hazards: '', recommendation: null, additional_notes: '',
}

// Which answerable questions belong to each walk-form step, for progress
// counting and the review step's "unanswered" list. Free-text notes and the
// score sliders (which always hold a value) are not counted. A question may
// be conditional on another answer.
interface QuestionDef {
  key: keyof FormData
  label: string
  appliesTo?: (form: FormData) => boolean
}

export interface SectionDef {
  id: string
  title: string
  questions: QuestionDef[]
}

export const SECTIONS: SectionDef[] = [
  {
    id: 'sidewalks',
    title: 'Sidewalks',
    questions: [
      { key: 'sidewalk_width', label: 'Sidewalk wide enough for two people' },
      { key: 'sidewalk_continuous', label: 'Sidewalk continuous' },
      { key: 'sidewalk_clear', label: 'Sidewalks clear of obstructions' },
      { key: 'sidewalk_buffer', label: 'Space between sidewalk and traffic' },
      { key: 'sidewalk_parking', label: 'On-street parking buffer' },
      { key: 'sidewalk_condition', label: 'Sidewalks in good condition' },
    ],
  },
  {
    id: 'crosswalks',
    title: 'Crosswalks',
    questions: [
      { key: 'crosswalk_marked', label: 'Marked crosswalks at major intersections' },
      { key: 'crosswalk_signals', label: 'Crossing signals where needed' },
      { key: 'crosswalk_time', label: 'Signals give enough time' },
      { key: 'crosswalk_visibility', label: 'Clear view of oncoming traffic' },
      { key: 'crossing_guards_present', label: 'Crossing guards present' },
    ],
  },
  {
    id: 'traffic',
    title: 'Traffic',
    questions: [
      { key: 'traffic_drivers_respect', label: 'Drivers respect pedestrians' },
      { key: 'traffic_speed', label: 'Vehicles follow speed limits' },
      { key: 'traffic_volume', label: 'Overall traffic volume' },
    ],
  },
  {
    id: 'biking',
    title: 'Biking',
    questions: [
      { key: 'bike_protected', label: 'Bike lane or separated path' },
      {
        key: 'bike_low_speed',
        label: 'Road calm enough for a child to ride',
        appliesTo: (f) => f.bike_protected === 'none',
      },
      { key: 'bike_overall_rating', label: 'Overall biking safety' },
    ],
  },
  {
    id: 'surroundings',
    title: 'Surroundings',
    questions: [
      { key: 'felt_safe', label: 'Felt safe on this route' },
      { key: 'lighting', label: 'Street lighting' },
      { key: 'litter_free', label: 'Free of litter and debris' },
      { key: 'shade', label: 'Street trees or shade' },
    ],
  },
  {
    id: 'overall',
    title: 'Your verdict',
    questions: [
      { key: 'walk_age', label: 'Grade level for independent walking' },
      { key: 'bike_age', label: 'Grade level for independent biking' },
      { key: 'recommendation', label: 'Would you recommend this route' },
    ],
  },
]

export function isAnswered(form: FormData, key: keyof FormData): boolean {
  const v = form[key]
  if (Array.isArray(v)) return v.length > 0
  return v !== null && v !== ''
}

export function unansweredIn(form: FormData, section: SectionDef): QuestionDef[] {
  return section.questions.filter(
    (q) => (q.appliesTo ? q.appliesTo(form) : true) && !isAnswered(form, q.key),
  )
}

export function answerableCount(form: FormData, section: SectionDef): number {
  return section.questions.filter((q) => (q.appliesTo ? q.appliesTo(form) : true)).length
}
