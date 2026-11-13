'use client'

import { useMemo } from 'react'
import { decodePolyline } from '@/lib/geo/polyline'
import type { ReachRow } from './types'
import type { BikeCorridor } from '@/lib/nearby/corridors'
import { useNearbyLocale } from './NearbyI18n'
import PathConditionsAlong, { PathLines, siteLocaleOf, usePathsAlong } from '@/components/trails/PathConditionsAlong'

/*
 * Path conditions on Nearby (Shift 01784): on a bike trip, how the trails
 * and protected lanes it uses are today; on a bike route's detail, how that
 * route is today. Nothing when there's nothing fresh to say.
 */

/** The bike line Nearby draws for this trip: the calm route, or the quicker one when picked. */
function bikeLine(row: ReachRow, alt: boolean): { lat: number; lng: number }[] {
  const encoded = alt && row.bike_alt?.polyline ? row.bike_alt.polyline : row.bike_polyline
  if (encoded) return decodePolyline(encoded).map(([lat, lng]) => ({ lat, lng }))
  const comfort = alt ? row.bike_alt?.comfort : row.bike_comfort
  return (comfort?.segments ?? []).flatMap((s) => decodePolyline(s.polyline).map(([lat, lng]) => ({ lat, lng })))
}

export function ReachBikePaths({ row, alt }: { row: ReachRow; alt: boolean }) {
  const locale = siteLocaleOf(useNearbyLocale())
  const points = useMemo(() => bikeLine(row, alt && !!row.bike_alt), [row, alt])
  if (points.length < 2) return null
  return <PathConditionsAlong points={points} locale={locale} />
}

/** The tapped bike route: its own pieces, unordered, so matched by nearness (25 m, three points or more). */
export function CorridorPaths({ corridor }: { corridor: BikeCorridor }) {
  const locale = siteLocaleOf(useNearbyLocale())
  const points = useMemo(() => {
    const out: { lat: number; lng: number }[] = []
    for (const f of corridor.geojson.features) {
      const g = f.geometry
      const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []
      for (const l of lines) for (const c of l) out.push({ lat: c[1], lng: c[0] })
    }
    return out
  }, [corridor])
  const rows = usePathsAlong(points, 25).filter((p) => p.near_points >= 3)
  if (rows.length === 0) return null
  return (
    <div className="mt-2">
      <PathLines rows={rows} locale={locale} />
    </div>
  )
}
