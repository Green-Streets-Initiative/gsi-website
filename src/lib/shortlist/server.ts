import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  orderedCorridors,
  type CorridorImage,
  type CorridorReviewRow,
  type ShortlistCorridor,
  type ShortlistScoredRow,
} from './types'

const CORRIDOR_COLUMNS =
  'id, name, waypoints, distance_miles, estimated_walk_minutes, estimated_bike_minutes, ' +
  'ai_walk_score, ai_bike_score, ai_summary, ai_flags, crash_flags, ' +
  'final_walk_score, final_bike_score, score_adjustment_note, score_adjusted_at, ' +
  'excluded_at, sort_order, priority_rank'

export async function getShortlist(): Promise<ShortlistScoredRow[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('school_shortlist_scored')
    .select('*')
    .order('rank', { ascending: true, nullsFirst: false })
    .order('total', { ascending: false })
    .order('school_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as ShortlistScoredRow[]
}

export async function getShortlistRow(schoolId: string): Promise<ShortlistScoredRow | null> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('school_shortlist_scored')
    .select('*')
    .eq('school_id', schoolId)
    .maybeSingle()
  return (data as ShortlistScoredRow | null) ?? null
}

async function corridorsForAssessment(assessmentId: string): Promise<ShortlistCorridor[]> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('route_corridors')
    .select(CORRIDOR_COLUMNS)
    .eq('assessment_id', assessmentId)
  return orderedCorridors((data ?? []) as unknown as ShortlistCorridor[])
}

async function reviewsForCorridors(ids: string[]): Promise<CorridorReviewRow[]> {
  if (ids.length === 0) return []
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('route_corridor_reviews')
    .select('*')
    .in('corridor_id', ids)
    .order('submitted_at', { ascending: false })
  return (data ?? []) as CorridorReviewRow[]
}

export async function getShortlistSchool(schoolId: string): Promise<{
  row: ShortlistScoredRow
  corridors: ShortlistCorridor[]
  reviews: CorridorReviewRow[]
} | null> {
  const row = await getShortlistRow(schoolId)
  if (!row) return null
  const corridors = row.assessment_id ? await corridorsForAssessment(row.assessment_id) : []
  const reviews = await reviewsForCorridors(corridors.map((c) => c.id))
  return { row, corridors, reviews }
}

export async function getShortlistCorridor(
  schoolId: string,
  corridorId: string,
): Promise<{
  row: ShortlistScoredRow
  corridor: ShortlistCorridor
  index: number
  images: CorridorImage[]
  reviews: CorridorReviewRow[]
  /** Active routes of this school, in order, for prev/next navigation. */
  siblings: { id: string; name: string }[]
} | null> {
  const row = await getShortlistRow(schoolId)
  if (!row || !row.assessment_id) return null
  const corridors = await corridorsForAssessment(row.assessment_id)
  const corridor = corridors.find((c) => c.id === corridorId)
  if (!corridor) return null
  const active = corridors.filter((c) => !c.excluded_at)
  const index = Math.max(0, active.findIndex((c) => c.id === corridorId))

  const supabase = createServerSupabaseClient()
  const [{ data: images }, reviews] = await Promise.all([
    supabase
      .from('corridor_images')
      .select('id, image_url, sequence_order')
      .eq('corridor_id', corridorId)
      .order('sequence_order', { ascending: true }),
    reviewsForCorridors([corridorId]),
  ])
  return {
    row,
    corridor,
    index,
    images: ((images ?? []) as CorridorImage[]).filter((i) => !!i.image_url),
    reviews,
    siblings: active.map((c) => ({ id: c.id, name: c.name })),
  }
}

export async function getShortlistProgress() {
  const supabase = createServerSupabaseClient()
  const [{ data: rows }, { data: reviews }] = await Promise.all([
    supabase.from('school_shortlist').select('volunteer_status'),
    supabase.from('route_corridor_reviews').select('status, verdict'),
  ])
  const list = (rows ?? []) as { volunteer_status: string }[]
  const revs = (reviews ?? []) as { status: string; verdict: string }[]
  return {
    total: list.length,
    submitted: list.filter((r) => r.volunteer_status === 'submitted').length,
    inProgress: list.filter((r) => r.volunteer_status === 'in_progress').length,
    reviewsSubmitted: revs.length,
    reviewsPending: revs.filter((r) => r.status === 'pending' && r.verdict === 'adjust').length,
    reviewsApplied: revs.filter((r) => r.status === 'applied').length,
  }
}
