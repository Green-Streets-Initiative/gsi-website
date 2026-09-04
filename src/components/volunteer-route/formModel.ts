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

/** A problem flagged at a specific spot on the route (walk-audit borrowing:
 *  every finding should carry a location). */
export interface ProblemPin {
  lat: number
  lng: number
  note: string
  category: string | null
  /** Observation-first capture (v3): a spot can be something that works well,
   *  not only a problem. Older pins have no valence and read as problems. */
  valence?: 'good' | 'problem'
  /** 1 (minor) … 5 (impassable); problems only. */
  severity?: number | null
  /** Photo taken at this spot (uploaded to route-assessment-photos). */
  photo?: { url: string; path?: string } | null
  created_at?: string
}

/** A quick "how was this block?" check-in while walking (v3). */
export interface BlockCheck {
  block_index: number
  verdict: 'fine' | 'soso' | 'rough'
  created_at: string
}

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
  curb_ramps: RadioValue
  tactile_strips: RadioValue
  // Section 2: Crosswalks
  crosswalk_marked: RadioValue
  crosswalk_signals: RadioValue
  crosswalk_time: RadioValue
  crosswalk_visibility: RadioValue
  crosswalk_visibility_note: string
  crossing_guards_present: RadioValue
  crossing_guard_locations: string
  crossing_too_far: RadioValue
  signal_crossing_seconds: string
  signal_wait_seconds: string
  // Section 3: Traffic
  traffic_drivers_respect: RadioValue
  traffic_drivers_note: string
  traffic_speed: RadioValue
  traffic_volume: TrafficVolume
  driver_behaviors: string[]
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
  safe_from_crime: FeltSafe
  safe_at_dusk: RadioValue
  welcoming_all: FeltSafe
  // Section 6: Overall
  walk_score: number
  bike_score: number
  walk_age: WalkAge
  bike_age: BikeAge
  seasonal_notes: string
  specific_hazards: string
  recommendation: Recommendation
  additional_notes: string
  // Location-pinned findings (any step)
  problem_pins: ProblemPin[]
  // Observation-first walk (v3)
  block_checks: BlockCheck[]
  /** Which capture flow produced this submission ('observation_v3' = the
   *  walk → flag spots → wrap-up flow; absent = the original checklist). */
  capture_mode: string | null
  /** Set when the volunteer also filled in the optional detailed checklist. */
  detailed_checklist_completed: boolean
}

export const DEFAULT_FORM: FormData = {
  sidewalk_width: null, sidewalk_continuous: null, sidewalk_continuous_note: '',
  sidewalk_clear: null, sidewalk_clear_note: '', sidewalk_buffer: null,
  sidewalk_parking: null, sidewalk_condition: null, sidewalk_condition_note: '',
  curb_ramps: null, tactile_strips: null,
  crosswalk_marked: null, crosswalk_signals: null, crosswalk_time: null,
  crosswalk_visibility: null, crosswalk_visibility_note: '',
  crossing_guards_present: null, crossing_guard_locations: '',
  crossing_too_far: null, signal_crossing_seconds: '', signal_wait_seconds: '',
  traffic_drivers_respect: null, traffic_drivers_note: '', traffic_speed: null,
  traffic_volume: null, driver_behaviors: [],
  bike_protected: null, bike_low_speed: null, bike_hazards: [], bike_overall_rating: null,
  felt_safe: null, lighting: null, litter_free: null, shade: null,
  safe_from_crime: null, safe_at_dusk: null, welcoming_all: null,
  walk_score: 5, bike_score: 5, walk_age: null, bike_age: null,
  seasonal_notes: '', specific_hazards: '', recommendation: null, additional_notes: '',
  problem_pins: [],
  block_checks: [],
  capture_mode: null,
  detailed_checklist_completed: false,
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
      { key: 'curb_ramps', label: 'Curb ramps at crossings' },
      { key: 'tactile_strips', label: 'Tactile warning strips' },
    ],
  },
  {
    id: 'crosswalks',
    title: 'Crosswalks',
    questions: [
      { key: 'crosswalk_marked', label: 'Marked crosswalks at major intersections' },
      { key: 'crosswalk_signals', label: 'Crossing signals where needed' },
      { key: 'crosswalk_time', label: 'Signals give enough time' },
      { key: 'crossing_too_far', label: 'Safe crossing within easy reach' },
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
      { key: 'driver_behaviors', label: 'Risky driver behaviors observed' },
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
      { key: 'safe_from_crime', label: 'Free of crime/harassment concerns' },
      { key: 'safe_at_dusk', label: 'Would feel safe at dusk' },
      { key: 'welcoming_all', label: 'Welcoming for all families' },
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
