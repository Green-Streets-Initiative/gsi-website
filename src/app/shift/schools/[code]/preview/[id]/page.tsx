import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { PublishedRouteCard } from '@/lib/shift/routeDisplay'
import SchoolPortalClient from '../../client'
import { getSchoolInfo } from '../../school-info'

// An admin's preview of a Safe Routes map before it is published (Keith
// 2026-11-06: "I need to preview everything carefully before anything is
// publicly accessible"). The admin's Preview button saves the ticked routes
// and the "how checked" answer in route_map_previews (Shift 01665) and opens
// this page. It draws the family page from those draft routes, with the same
// family-safe fields as published_route_cards; nothing goes public until
// Keith publishes. The id is a random uuid; the link stops working after 7 days.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Preview — Shift for Schools',
  robots: { index: false, follow: false },
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now()
}

export default async function SchoolRoutesPreviewPage({
  params,
}: {
  params: Promise<{ code: string; id: string }>
}) {
  const { code, id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound()

  const info = await getSchoolInfo(code)
  if (!info) return notFound()

  const supabase = createServerSupabaseClient()
  const { data: pv } = await supabase
    .from('route_map_previews')
    .select('school_id, corridor_ids, review_basis, expires_at')
    .eq('id', id)
    .maybeSingle()
  if (!pv || pv.school_id !== info.schoolId || isExpired(pv.expires_at)) {
    return notFound()
  }

  const { data: rows } = await supabase
    .from('route_corridors')
    .select(
      'id, name, waypoints, distance_miles, estimated_walk_minutes, estimated_bike_minutes, recommended_modes, mode_rationale, family_description, google_maps_url_walk, google_maps_url_bike, sort_order, priority_rank, volunteer_submitted_at, comfort',
    )
    .in('id', pv.corridor_ids)
    .is('excluded_at', null)

  const now = new Date().toISOString()
  const routes: PublishedRouteCard[] = (rows ?? [])
    .map((r) => ({
      id: r.id,
      school_id: info.schoolId,
      published_at: now,
      name: r.name,
      waypoints: r.waypoints ?? [],
      distance_miles: r.distance_miles,
      estimated_walk_minutes: r.estimated_walk_minutes,
      estimated_bike_minutes: r.estimated_bike_minutes,
      recommended_modes: r.recommended_modes,
      mode_rationale: r.mode_rationale,
      family_description: r.family_description,
      google_maps_url_walk: r.google_maps_url_walk,
      google_maps_url_bike: r.google_maps_url_bike,
      sort_order: r.sort_order ?? r.priority_rank,
      review_basis: pv.review_basis,
      volunteer_submitted_at: r.volunteer_submitted_at,
      // Same slim pieces as published_route_cards (01776).
      comfort_segments: Array.isArray(r.comfort?.comfort_segments)
        ? r.comfort.comfort_segments.map((s: { rating: string; distance_mi: number }) => ({
            rating: s.rating,
            distance_mi: s.distance_mi,
          }))
        : null,
    }))
    .sort((a, b) => a.sort_order - b.sort_order)

  const pdfUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-asset?asset_type=route_map&preview=${id}`

  return <SchoolPortalClient {...info} preview={{ routes, pdfUrl }} />
}
