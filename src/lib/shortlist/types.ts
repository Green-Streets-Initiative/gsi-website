/**
 * Pilot Shortlist workspace — shared types.
 * Mirrors the school_shortlist_scored view (Shift repo migration 00867).
 */

export type ShortlistStatus = 'not_started' | 'in_progress' | 'submitted'

export interface ShortlistScoredRow {
  id: string
  school_id: string
  shared_assessment_school_id: string | null
  school_name: string
  city: string | null
  assessment_school_id: string
  assessment_id: string | null
  assessment_status: string | null

  district: string | null
  grades: string | null
  enrollment: number | null
  title_i: boolean | null
  econ_disadv_pct: number | null
  ej_block_group: boolean | null
  srts_partner: boolean | null
  sidewalk_notes: string | null
  bike_infra_notes: string | null
  research_notes: string | null

  prefill_underserved: number | null
  prefill_sidewalks: number | null
  prefill_walkshed: number | null
  prefill_srts: number | null
  prefill_grades: number | null

  override_underserved: number | null
  override_underserved_note: string | null
  override_sidewalks: number | null
  override_sidewalks_note: string | null
  override_walkshed: number | null
  override_walkshed_note: string | null
  override_srts: number | null
  override_srts_note: string | null
  override_grades: number | null
  override_grades_note: string | null

  pto_activity: string | null
  pto_score: number | null
  principal_name: string | null
  principal_email: string | null
  pe_wellness_lead: string | null
  pto_contact: string | null
  rank: number | null
  why_this_school: string | null

  volunteer_status: ShortlistStatus
  submitted_at: string | null
  submitted_by: string | null
  last_edited_by: string | null
  updated_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  admin_notes: string | null

  routes_analyzed: number | null
  routes_excluded: number | null
  ai_walk_avg: number | null
  ai_bike_avg: number | null
  min_walk: number | null
  routes_near_crashes: number | null
  routes_adjusted: number | null
  reviews_pending: number
  reviews_total: number

  score_underserved: number | null
  score_sidewalks: number | null
  score_walkshed: number | null
  score_pto: number | null
  score_srts: number | null
  score_grades: number | null
  total: number
  criteria_missing: number
}

/** Fields the volunteer may write through PATCH. */
export interface EditableFields {
  override_underserved: number | null
  override_underserved_note: string | null
  override_sidewalks: number | null
  override_sidewalks_note: string | null
  override_walkshed: number | null
  override_walkshed_note: string | null
  override_srts: number | null
  override_srts_note: string | null
  override_grades: number | null
  override_grades_note: string | null
  pto_activity: string | null
  pto_score: number | null
  principal_name: string | null
  principal_email: string | null
  pe_wellness_lead: string | null
  pto_contact: string | null
  why_this_school: string | null
}

export const EDITABLE_SCORE_KEYS = [
  'override_underserved',
  'override_sidewalks',
  'override_walkshed',
  'override_srts',
  'override_grades',
  'pto_score',
] as const

export const EDITABLE_TEXT_KEYS = [
  'override_underserved_note',
  'override_sidewalks_note',
  'override_walkshed_note',
  'override_srts_note',
  'override_grades_note',
  'pto_activity',
  'principal_name',
  'principal_email',
  'pe_wellness_lead',
  'pto_contact',
  'why_this_school',
] as const

export type CriterionKey = 'underserved' | 'sidewalks' | 'walkshed' | 'pto' | 'srts' | 'grades'

export interface CriterionMeta {
  key: CriterionKey
  label: string
  help: string
  /** Where the prefill comes from; null for PTO (volunteer-only). */
  source: 'sheet' | 'routes' | null
}

export const CRITERIA: CriterionMeta[] = [
  {
    key: 'underserved',
    label: 'Under-served',
    help: 'Title I, low-income share, Environmental Justice area. 2 = strong on all, 0 = none.',
    source: 'sheet',
  },
  {
    key: 'sidewalks',
    label: 'Sidewalks',
    help: 'From the route analysis: 2 if the average walk score is 6.5 or better, 1 if 4 or better, else 0.',
    source: 'routes',
  },
  {
    key: 'walkshed',
    label: 'Walkshed',
    help: 'From the route analysis: 2 if 5 routes were analyzed and none scores below 4 for walking, 1 if 4 or more routes, else 0.',
    source: 'routes',
  },
  {
    key: 'pto',
    label: 'PTO',
    help: 'Your call: no trace online = 0, exists but quiet = 1, visibly active = 2.',
    source: null,
  },
  {
    key: 'srts',
    label: 'SRTS',
    help: 'Safe Routes to School partner status (MassDOT list, May 2025).',
    source: 'sheet',
  },
  {
    key: 'grades',
    label: 'Grades',
    help: 'Grade span fit: 2 for K-8 / PK-8, 1 for elementary-only spans.',
    source: 'sheet',
  },
]

export interface CorridorReviewRow {
  id: string
  corridor_id: string
  reviewer_name: string
  verdict: 'agree' | 'adjust'
  suggested_walk_score: number | null
  suggested_bike_score: number | null
  note: string | null
  submitted_at: string
  status: 'pending' | 'applied' | 'declined'
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
}

export interface ShortlistCorridor {
  id: string
  name: string
  waypoints: { lat: number; lng: number }[] | null
  distance_miles: number | null
  estimated_walk_minutes: number | null
  estimated_bike_minutes: number | null
  ai_walk_score: number | null
  ai_bike_score: number | null
  ai_summary: string | null
  ai_flags: { description?: string; type?: string }[] | null
  crash_flags: { lat: number; lng: number; crashCount?: number; severity?: string; type?: string }[] | null
  final_walk_score: number | null
  final_bike_score: number | null
  score_adjustment_note: string | null
  score_adjusted_at: string | null
  excluded_at: string | null
  sort_order: number | null
  priority_rank: number | null
}

export interface CorridorImage {
  id: string
  image_url: string
  sequence_order: number
}

/**
 * Route colors — keep in sync with the dashboard
 * (Shift repo shift-school/web/src/lib/routeDisplay.ts ROUTE_COLORS) so the
 * volunteer's route 3 is Keith's route 3.
 */
export const ROUTE_COLORS = [
  '#2966E5',
  '#16A34A',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#0891B2',
  '#DB2777',
  '#65A30D',
]

export function routeColor(index: number): string {
  return ROUTE_COLORS[index % ROUTE_COLORS.length]
}

/** The score that counts today: Keith's call if he made one, else the AI's. */
export function effectiveWalk(c: ShortlistCorridor): number | null {
  return c.final_walk_score ?? c.ai_walk_score
}
export function effectiveBike(c: ShortlistCorridor): number | null {
  return c.final_bike_score ?? c.ai_bike_score
}

export function orderedCorridors<T extends { sort_order: number | null; priority_rank: number | null }>(
  cs: T[],
): T[] {
  return [...cs].sort(
    (a, b) => (a.sort_order ?? a.priority_rank ?? 0) - (b.sort_order ?? b.priority_rank ?? 0),
  )
}

export function scoreTone(score: number | null): { text: string; bg: string } {
  if (score === null) return { text: 'text-[#6B7280]', bg: 'bg-gray-100' }
  if (score >= 7) return { text: 'text-green-700', bg: 'bg-green-100' }
  if (score >= 4) return { text: 'text-amber-700', bg: 'bg-amber-100' }
  return { text: 'text-red-700', bg: 'bg-red-100' }
}

export function scoreWord(score: number | null): string {
  if (score === null) return '—'
  if (score >= 7) return 'Safe'
  if (score >= 4) return 'Use caution'
  return 'Not recommended'
}
