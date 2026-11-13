'use client'

import { useMemo } from 'react'
import type { SiteLocale } from '@/lib/site-i18n'
import RouteNotes from './RouteNotes'

/*
 * Route notes under a Roam's map (/shift/roams/<id>): "From people who bike
 * here" on a bike Roam, "From people who walk here" on a walking one, with
 * "Still true?", and "Add a note" on a bike Roam (surface web_roam, Shift
 * 01789), in the direction the Roam goes. Nothing while the route_notes
 * switch is off.
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
  return <RouteNotes points={points} mode={mode} surface="web_roam" locale={locale} tone="light" className="!mt-0" />
}
