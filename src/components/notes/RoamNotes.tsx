'use client'

import { useMemo } from 'react'
import type { SiteLocale } from '@/lib/site-i18n'
import RouteNotes from './RouteNotes'

/*
 * Route notes under a Roam's map (/shift/roams/<id>): "From people who bike
 * here" on a bike Roam, "From people who walk here" on a walking one. Read
 * and "Still true?" only: report-route-issue takes notes from the website
 * on advisor_bike, nearby_reach, nearby_corridor and web_street, not yet
 * from a Roam page. Nothing while the switch is off or there are no notes.
 */
export default function RoamNotes({
  routeCoordinates,
  mode,
  locale = 'en',
}: {
  /** GeoJSON-order [lng, lat], in the order the Roam goes. */
  routeCoordinates: [number, number][] | null
  mode: string
  locale?: SiteLocale
}) {
  const points = useMemo(() => (routeCoordinates ?? []).map(([lng, lat]) => ({ lat, lng })), [routeCoordinates])
  if (points.length < 2 || (mode !== 'bike' && mode !== 'walk')) return null
  return <RouteNotes points={points} mode={mode} surface="web_roam" canAdd={false} locale={locale} tone="light" className="!mt-0" />
}
