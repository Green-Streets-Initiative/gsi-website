'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  modeBadgeStyle,
  modeLineColor,
  reviewBasisLine,
  routeCardMapsUrl,
  routeLetter,
  routeWalkedLine,
  type PublishedRouteCard,
} from '@/lib/shift/routeDisplay'
import SchoolRoutesMap from './SchoolRoutesMap'
import ReportSpotSheet from '@/components/spot/ReportSpotSheet'
import { useSpotSwitch } from '@/components/spot/useSpotSwitch'

/** An admin's unpublished draft (route_map_previews): the routes to draw and
 *  the PDF link that draws the same draft. */
export interface RoutesPreview {
  routes: PublishedRouteCard[]
  pdfUrl: string
}

interface Props {
  schoolId: string
  schoolName: string
  preview?: RoutesPreview
}

// The family-facing Safe Routes section: one map of every published route
// plus a card per route. Reads the family-safe published_route_cards view —
// internal scores and notes are not in the payload at all. With `preview`,
// draws the admin's draft instead (same family-safe fields).
export default function SchoolRoutesSection({ schoolId, schoolName, preview }: Props) {
  const [fetched, setFetched] = useState<PublishedRouteCard[]>([])
  const routes = preview?.routes ?? fetched
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Report a spot (behind the report_a_spot switch): closes the parity gap
  // gap-safe-routes-no-report. Starts on the picked route, else the school.
  const spotOn = useSpotSwitch()
  const [spotAt, setSpotAt] = useState<{ lat: number; lng: number; label: string | null } | null>(null)

  useEffect(() => {
    if (preview) return
    supabase
      .from('published_route_cards')
      .select('*')
      .eq('school_id', schoolId)
      .order('sort_order')
      .then(({ data }) => setFetched((data ?? []) as PublishedRouteCard[]))
  }, [schoolId, preview])

  if (routes.length === 0) return null

  const publishedAt = routes[0]?.published_at
  const stale =
    publishedAt && Date.now() - new Date(publishedAt).getTime() > 365 * 24 * 60 * 60 * 1000

  const openSpot = () => {
    const picked = routes.find((r) => r.id === selectedId)?.waypoints ?? []
    if (picked.length > 0) {
      const mid = picked[Math.floor(picked.length / 2)]
      setSpotAt({ lat: mid.lat, lng: mid.lng, label: null })
      return
    }
    // Every route ends at the school.
    const first = routes[0]?.waypoints ?? []
    const school = first[first.length - 1]
    if (school) setSpotAt({ lat: school.lat, lng: school.lng, label: schoolName })
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="font-display text-lg font-bold text-[#191A2E]">Safe Routes to School</h2>
        {publishedAt && (
          <p className="mt-1 text-sm text-[#6B7280]">
            Routes checked{' '}
            {new Date(publishedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
            })}
          </p>
        )}
        <p className="mx-auto mt-2 max-w-prose text-sm text-[#4A4D68]">
          {reviewBasisLine(routes[0]?.review_basis)}
        </p>
      </div>

      {stale && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-3 text-center">
          <p className="text-sm text-amber-700">
            These routes were last assessed over a year ago. Conditions may have changed.
          </p>
        </div>
      )}

      <SchoolRoutesMap
        routes={routes}
        schoolName={schoolName}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {routes.map((route, i) => {
        const badge = modeBadgeStyle(route.recommended_modes)
        const showCycling =
          route.recommended_modes === 'walk_and_bike' ||
          route.recommended_modes === 'bike_with_caution'
        const isSelected = selectedId === route.id
        const walkUrl = routeCardMapsUrl(route, 'walking')
        const bikeUrl = routeCardMapsUrl(route, 'bicycling')
        const walkedLine = routeWalkedLine(route.volunteer_submitted_at)

        return (
          <div
            key={route.id}
            onClick={() => setSelectedId(isSelected ? null : route.id)}
            className={`overflow-hidden rounded-xl bg-white shadow-sm transition cursor-pointer ${
              isSelected ? 'ring-2 ring-[#2966E5]' : 'hover:shadow'
            }`}
          >
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="flex items-center gap-2 font-display text-base font-bold text-[#191A2E]">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: modeLineColor(route.recommended_modes) }}
                  >
                    {routeLetter(i)}
                  </span>
                  {route.name}
                </h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.bg} ${badge.text}`}
                >
                  {badge.label}
                </span>
              </div>

              <div className="flex gap-4 text-sm text-[#6B7280] mb-3">
                <span>{route.distance_miles} mi</span>
                <span>{route.estimated_walk_minutes} min walk</span>
                {route.estimated_bike_minutes > 0 && (
                  <span>{route.estimated_bike_minutes} min bike</span>
                )}
              </div>

              {route.mode_rationale && (
                <p className="text-sm text-[#4A4D68] mb-3">{route.mode_rationale}</p>
              )}

              {route.family_description && (
                <p className="text-sm text-[#6B7280] mb-3">{route.family_description}</p>
              )}

              {walkedLine && <p className="text-xs text-[#6B7280] mb-3">{walkedLine}</p>}

              <div className="flex flex-wrap gap-2">
                {walkUrl && (
                  <a
                    href={walkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#2966E5] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2966E5]/90"
                  >
                    Open in Google Maps (Walking)
                  </a>
                )}
                {showCycling && bikeUrl && (
                  <a
                    href={bikeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#2966E5] px-4 py-2 text-sm font-semibold text-[#2966E5] transition hover:bg-[#2966E5]/5"
                  >
                    Open in Google Maps (Cycling)
                  </a>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <div className="text-center">
        <a
          href={
            preview?.pdfUrl ??
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-asset?asset_type=route_map&school_id=${schoolId}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#2966E5] transition hover:text-[#2966E5]/80"
        >
          Download Route Map PDF
        </a>
      </div>

      {spotOn && !preview && (
        <div className="text-center">
          <button
            type="button"
            onClick={openSpot}
            aria-haspopup="dialog"
            className="inline-flex min-h-[44px] cursor-pointer items-center text-[0.9375rem] font-semibold text-[#4A4D68] underline decoration-[rgba(74,77,104,0.45)] underline-offset-[3px] transition-colors hover:text-[#191A2E] focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F]"
          >
            Report a spot on these routes
          </button>
          <ReportSpotSheet
            surface="school_routes"
            open={!!spotAt}
            spot={spotAt ?? { lat: 0, lng: 0 }}
            label={spotAt?.label ?? null}
            onClose={() => setSpotAt(null)}
          />
        </div>
      )}
    </div>
  )
}
