import 'server-only'
import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Roams that tour a whole trail (roam_trails.is_tour), mapped to that trail's
 * id. A tour roam's web page forwards to /trails/<trail> (Keith 2026-10-19:
 * "trail-tour roams become sections of their trail page"; 2026-11-04: all 16),
 * so every link the site writes goes straight to the trail page instead.
 * Only trails with a published page count. Empty when the call fails, so a
 * database hiccup leaves roam pages where they are.
 */
export const getTourTrails = cache(async (): Promise<Map<string, string>> => {
  const supabase = createServerSupabaseClient()
  const [tourRes, trailRes] = await Promise.all([
    supabase.from('roam_trails').select('roam_id, trail_id, sort').eq('is_tour', true).limit(200),
    supabase.from('trails').select('id').eq('status', 'approved').eq('active', true).limit(500),
  ])
  if (tourRes.error || trailRes.error || !tourRes.data || !trailRes.data) return new Map()
  const live = new Set((trailRes.data as Array<{ id: string }>).map((t) => t.id))
  const rows = (tourRes.data as Array<{ roam_id: string; trail_id: string; sort: number | null }>)
    .filter((r) => live.has(r.trail_id))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
  const map = new Map<string, string>()
  for (const r of rows) if (!map.has(r.roam_id)) map.set(r.roam_id, r.trail_id)
  return map
})

/** Where the site links a roam: its trail page when it tours one, else its roam page. */
export function roamHref(roamId: string, tours: Map<string, string>): string {
  const trail = tours.get(roamId)
  return trail ? `/trails/${trail}` : `/shift/roams/${encodeURIComponent(roamId)}`
}
