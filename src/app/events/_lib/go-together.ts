import type { SupabaseClient } from '@supabase/supabase-js'
import { NO_GO_TOGETHER, type GoTogetherData, type GoTogetherGroup } from '@/lib/go-together'

type Row = Omit<GoTogetherGroup, 'slug' | 'ride_code'> & { ride_series_id: string | null }

/**
 * The event page's Go Together data: the same database function the Shift
 * app's event page reads (get_event_go_together, Shift 01460), plus each
 * listing's readable address and, for a Shift ride, its RSVP page. Fails soft
 * to nothing: a missing link must never break an event page.
 */
export async function loadGoTogether(supabase: SupabaseClient, contentId: string): Promise<GoTogetherData> {
  const { data, error } = await supabase.rpc('get_event_go_together', { p_content_id: contentId })
  if (error || !data) return NO_GO_TOGETHER
  const raw = data as { feeds: { id: string; title: string; event_date: string } | null; feeders: Row[] | null }
  const feeders = raw.feeders ?? []
  const ids = [...feeders.map((f) => f.id), ...(raw.feeds ? [raw.feeds.id] : [])]
  const seriesIds = [...new Set(feeders.map((f) => f.ride_series_id).filter((s): s is string => !!s))]
  if (ids.length === 0) return NO_GO_TOGETHER

  const [slugs, rides] = await Promise.all([
    supabase.from('content_items').select('id, slug').in('id', ids),
    seriesIds.length
      ? supabase.from('ride_series').select('id, invite_code, kind, status').in('id', seriesIds)
      : Promise.resolve({ data: [] as { id: string; invite_code: string | null; kind: string; status: string }[] }),
  ])
  const slugOf = new Map((slugs.data ?? []).map((r) => [r.id as string, (r.slug as string | null) ?? null]))
  const codeOf = new Map(
    (rides.data ?? [])
      .filter((r) => r.kind === 'group_ride' && r.status === 'active' && r.invite_code)
      .map((r) => [r.id as string, r.invite_code as string]),
  )

  return {
    feeds: raw.feeds ? { ...raw.feeds, slug: slugOf.get(raw.feeds.id) ?? null } : null,
    groups: feeders.map(({ ride_series_id, ...f }) => ({
      ...f,
      slug: slugOf.get(f.id) ?? null,
      ride_code: ride_series_id ? codeOf.get(ride_series_id) ?? null : null,
    })),
  }
}
