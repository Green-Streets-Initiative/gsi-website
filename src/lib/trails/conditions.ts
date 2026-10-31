import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { TrailConditions } from '@/lib/trails/conditionText'

/**
 * Every trail's conditions in one call (get_path_conditions, Shift 01568):
 * who clears it, snow near it in the last three days, and the last day's
 * reports from people who used it. An empty map when the call fails, so a
 * page never breaks over conditions.
 */
export async function getPathConditions(): Promise<Map<string, TrailConditions>> {
  const { data, error } = await createServerSupabaseClient().rpc('get_path_conditions')
  if (error || !Array.isArray(data)) return new Map()
  return new Map((data as TrailConditions[]).map((c) => [c.trail_id, { ...c, reports: c.reports ?? [] }]))
}
