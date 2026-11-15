// Planned stops on a walk audit, and the yes/no questions walkers answer at
// each one. The questions are adapted from Somerville PTAC's participant
// checklist (public domain, itself adapted from AARP's walk audit worksheets),
// with three biking questions added. Every question is worded so that "Yes"
// means the street works, which lets the results page count the "No"s.

export interface AuditStop {
  id: string
  name: string
  lat: number
  lng: number
  note?: string | null
}

export interface StopActivity {
  stop_id: string | null
  kind: 'stop_check' | 'stop_discussion'
  observer_name: string | null
}

export interface StopQuestion {
  key: string
  /** Completes the section's lead: "The sidewalk…" + "is wide enough…" */
  label: string
  /** A few words for lists of what works ("curb ramps"). */
  short: string
}

export interface StopSection {
  id: string
  lead: string
  /** One or two words for the jump bar at the top of the stop's questions. */
  nav: string
  /** Lets a walker skip a section that doesn't apply at this stop. */
  skipLabel?: string
  questions: StopQuestion[]
}

export const STOP_SECTIONS: StopSection[] = [
  {
    id: 'sidewalk',
    nav: 'Sidewalk',
    lead: 'The sidewalk…',
    questions: [
      { key: 'sidewalk_buffer', label: 'is set back from traffic by a curb, grass or plantings', short: 'a buffer from traffic' },
      { key: 'sidewalk_smooth', label: 'has a smooth, even surface', short: 'a smooth surface' },
      { key: 'sidewalk_condition', label: 'is free of cracks and raised sections', short: 'sidewalk condition' },
      { key: 'sidewalk_clear', label: 'is clear of poles, hydrants, bins and overgrown plants', short: 'a clear path' },
      { key: 'sidewalk_driveways', label: 'is unbroken by driveways', short: 'few driveways' },
      { key: 'sidewalk_continuous', label: 'keeps going the whole way', short: 'a continuous sidewalk' },
      { key: 'sidewalk_width', label: 'is wide enough for two people side by side', short: 'sidewalk width' },
      { key: 'sidewalk_tactile', label: 'has bumpy warning strips where it meets the street', short: 'warning strips' },
      { key: 'sidewalk_ramps', label: 'has a curb ramp at every street it crosses', short: 'curb ramps' },
    ],
  },
  {
    id: 'street',
    nav: 'Street',
    lead: 'The street…',
    questions: [
      { key: 'street_controls', label: 'has stop signs or traffic lights drivers can clearly see', short: 'stop signs and lights' },
      { key: 'street_crosswalks', label: 'has crosswalks with clear markings', short: 'crosswalk markings' },
      { key: 'street_signage', label: 'has signs telling drivers to watch for people walking', short: 'signs for drivers' },
    ],
  },
  {
    id: 'signals',
    nav: 'Signals',
    lead: 'The walk signals…',
    skipLabel: 'No walk signals at this stop',
    questions: [
      { key: 'signal_working', label: 'are working', short: 'working signals' },
      { key: 'signal_exclusive', label: 'give people a turn to cross while turning cars wait', short: 'a turn to cross' },
      { key: 'signal_audible', label: 'make a sound for people who can’t see them', short: 'audible signals' },
      { key: 'signal_placement', label: 'are where people actually cross', short: 'signal placement' },
      { key: 'signal_time', label: 'give enough time to get across', short: 'time to cross' },
      { key: 'signal_wait', label: 'come soon enough that the wait feels fair', short: 'a short wait' },
    ],
  },
  {
    id: 'biking',
    nav: 'Biking',
    lead: 'For biking, this spot…',
    questions: [
      { key: 'bike_lane', label: 'has a bike lane separated from car traffic', short: 'a separated bike lane' },
      { key: 'bike_parking', label: 'has somewhere to lock a bike', short: 'bike parking' },
      { key: 'bike_comfort', label: 'feels safe to bike through', short: 'safe biking' },
    ],
  },
  {
    id: 'spot',
    nav: 'This spot',
    lead: 'This spot…',
    questions: [
      { key: 'spot_safe', label: 'feels safe to walk through', short: 'feeling safe' },
      { key: 'spot_direct', label: 'lets me walk straight to where I’m going', short: 'a direct path' },
      { key: 'spot_speed', label: 'has drivers keeping to the speed limit', short: 'driver speeds' },
      { key: 'spot_obey', label: 'has drivers stopping for signals and signs', short: 'drivers stopping' },
      { key: 'spot_green', label: 'has trees or plantings', short: 'trees' },
      { key: 'spot_seating', label: 'has benches or somewhere to sit', short: 'seating' },
      { key: 'spot_art', label: 'has public art', short: 'public art' },
      { key: 'spot_linger', label: 'is somewhere I’d want to spend time', short: 'a place to linger' },
    ],
  },
]

export const STOP_QUESTIONS: (StopQuestion & { lead: string; section: string })[] = STOP_SECTIONS.flatMap((s) =>
  s.questions.map((q) => ({ ...q, lead: s.lead, section: s.id })),
)

/** "The sidewalk has a curb ramp at every street it crosses" */
export function stopQuestionSentence(key: string): string {
  const q = STOP_QUESTIONS.find((x) => x.key === key)
  if (!q) return key
  return `${q.lead.replace('…', '')} ${q.label}`
}

export type StopAnswer = 'yes' | 'no'

/** What one walker's stop check stores in walk_audit_submissions.answers. */
export interface StopCheckAnswers {
  stop_id: string
  stop_name: string
  /** A random id kept on the walker's phone, so saving again replaces their earlier answers. */
  walker_key?: string
  checks: Record<string, StopAnswer>
  notes: Record<string, string>
  skipped_sections: string[]
}

export interface StopDiscussionAnswers {
  stop_id: string
  stop_name: string
  notes: string
}

export const STOP_CHECK_MINUTES = 5
export const STOP_TALK_MINUTES = 10

/**
 * How long an audit takes. With planned stops: walking time plus 15 minutes
 * a stop (5 to answer, 10 to talk), the rule PTAC used for 60 people in
 * Union Square. Without stops: the older half-mile-per-half-hour pace.
 */
export function auditMinutes(routeMiles: number, stopCount: number): number {
  if (stopCount > 0) {
    const walking = Math.round(routeMiles * 20)
    return walking + stopCount * (STOP_CHECK_MINUTES + STOP_TALK_MINUTES)
  }
  return Math.max(15, Math.round(routeMiles * 60))
}

export function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${Math.max(5, Math.round(minutes / 5) * 5)} minutes`
  const h = Math.floor(minutes / 60)
  const m = Math.round((minutes % 60) / 5) * 5
  if (m === 0) return h === 1 ? '1 hour' : `${h} hours`
  if (m === 60) return `${h + 1} hours`
  return `${h} hr ${m} min`
}

export function cleanStops(raw: unknown): AuditStop[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (s): s is AuditStop =>
      !!s && typeof s.id === 'string' && typeof s.lat === 'number' && typeof s.lng === 'number',
  )
}
