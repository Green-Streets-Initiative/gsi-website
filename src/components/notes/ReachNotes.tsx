'use client'

import { useMemo } from 'react'
import { decodePolyline } from '@/lib/geo/polyline'
import type { SiteLocale } from '@/lib/site-i18n'
import type { LatLng } from '@/lib/route-notes'
import type { ReachRow, ReachSegment } from '@/components/nearby/types'
import { useNearbyLocale } from '@/components/nearby/NearbyI18n'
import { SpotCautionsList, walkLegs } from '@/components/spot/useSpotCautions'
import RouteNotes from './RouteNotes'
import { useNotesSwitch } from './useNotesSwitch'

/*
 * Route notes on Nearby's trips (surface nearby_reach): the bike route's
 * box with "Add a note", and on a transit trip the walks' box, which
 * carries Report a spot's reports ("From people who walk here") in place of
 * "Reported on this walk" while the route_notes switch is on.
 */

function siteLocaleOf(l: string): SiteLocale {
  return l === 'es' || l === 'pt-BR' || l === 'zh-Hans' ? l : 'en'
}

/** The bike line Nearby draws for this trip: the calm route, or the quicker one when picked. */
function bikeLine(row: ReachRow, alt: boolean): LatLng[] {
  const encoded = alt && row.bike_alt?.polyline ? row.bike_alt.polyline : row.bike_polyline
  if (encoded) return decodePolyline(encoded).map(([lat, lng]) => ({ lat, lng }))
  const comfort = alt ? row.bike_alt?.comfort : row.bike_comfort
  return (comfort?.segments ?? []).flatMap((s) => decodePolyline(s.polyline).map(([lat, lng]) => ({ lat, lng })))
}

export function ReachBikeNotes({ row, alt }: { row: ReachRow; alt: boolean }) {
  const locale = siteLocaleOf(useNearbyLocale())
  const points = useMemo(() => bikeLine(row, alt && !!row.bike_alt), [row, alt])
  if (points.length < 2) return null
  return <RouteNotes points={points} mode="bike" surface="nearby_reach" locale={locale} />
}

/** The walks of a transit trip: the notes box while the switch is on, else Report a spot's list. */
export function ReachWalkNotes({ segments }: { segments: ReachSegment[] | null | undefined }) {
  const on = useNotesSwitch()
  const locale = siteLocaleOf(useNearbyLocale())
  const legs = useMemo(() => walkLegs(segments), [segments])
  if (!on) return <SpotCautionsList segments={segments} />
  return <RouteNotes legs={legs} mode="walk" surface="nearby_walk" locale={locale} />
}
