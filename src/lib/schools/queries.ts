import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SCHOOLS } from '@/lib/semester/schools'

/**
 * School-vs-school standings for the Shift Your Semester pages.
 *
 * Same board the app shows on a school's group screen: the org leaderboard
 * RPC (Shift migration 00880) ranked over `type = 'school'` groups with
 * public standings, month to date. The RPC already applies the floor —
 * 20 trips in the window — so a three-member school at 100% can't sit on
 * top; this file only adds competition-style tie ranking, matching the town
 * directory (src/lib/towns/queries.ts).
 */

export { MIN_RANKED_SCHOOLS } from './types'
export type { SchoolStanding } from './types'
import type { SchoolStanding } from './types'

interface LeaderboardRow {
  group_id: string
  name: string
  logo_url: string | null
  shift_rate: number | string
  active_trips: number | string
  member_count: number | string
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000'

export async function getSchoolStandings(): Promise<SchoolStanding[]> {
  const supabase = createServerSupabaseClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const { data, error } = await supabase.rpc('get_employer_leaderboard', {
    p_employer_group_id: NIL_UUID,
    p_user_id: NIL_UUID,
    p_days: 30,
    p_start_at: monthStart.toISOString(),
    p_end_at: now.toISOString(),
    p_group_type: 'school',
  })
  if (error || !data) return []

  const slugByGroup = new Map(SCHOOLS.filter((s) => s.groupSlug).map((s) => [s.groupSlug as string, s.slug]))
  // The RPC returns group_id, not the group slug; resolve pages by name→slug
  // through the registry's group slug via a second lookup on `groups`.
  const { data: groups } = await supabase
    .from('groups')
    .select('id, slug')
    .in('id', (data as LeaderboardRow[]).map((r) => r.group_id))
  const groupSlugById = new Map((groups ?? []).map((g: { id: string; slug: string | null }) => [g.id, g.slug]))

  const rows = (data as LeaderboardRow[]).map((r) => ({
    group_id: r.group_id,
    name: r.name,
    logo_url: r.logo_url,
    page_slug: slugByGroup.get(groupSlugById.get(r.group_id) ?? '') ?? null,
    shift_rate: Math.round(Number(r.shift_rate) || 0),
    active_trips: Number(r.active_trips) || 0,
    member_count: Number(r.member_count) || 0,
  }))

  const sorted = [...rows].sort(
    (a, b) => b.shift_rate - a.shift_rate || b.active_trips - a.active_trips || a.name.localeCompare(b.name),
  )
  let prevRate = -1
  let prevRank = 0
  return sorted.map((r, i) => {
    const rank = r.shift_rate === prevRate ? prevRank : i + 1
    prevRate = r.shift_rate
    prevRank = rank
    return { ...r, rank }
  })
}
