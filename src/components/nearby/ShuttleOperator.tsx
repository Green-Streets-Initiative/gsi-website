'use client'

import { type StationGroup, shuttleAgencyForStation, isShuttleStation } from './useNearbyModel'
import { useNearbyT } from './NearbyI18n'

/**
 * The two lines every campus / TMA shuttle stop needs and no MBTA stop does:
 * WHO runs it and WHO may board.
 *
 * A shuttle stop is drawn like a bus stop and named like one ("Market Basket
 * Somerville"), so without this a rider can't tell that the indigo pin is an
 * MIT shuttle they may need an MIT ID to use. The policy itself lives in
 * lib/nearby/shuttle-agencies.ts, verified per operator.
 */
export function ShuttleOperatorLines({
  station,
  variant = 'compact',
  className = '',
}: {
  station: StationGroup
  /** 'compact' = one line for a list card; 'detail' = two, with room to
   *  spell out what kind of service this is. */
  variant?: 'compact' | 'detail'
  className?: string
}) {
  const tr = useNearbyT()
  const agency = isShuttleStation(station) ? shuttleAgencyForStation(station) : null
  if (!agency) return null
  const accessKey =
    agency.access === 'public' ? 'shuttle.access_public'
    : agency.access === 'id' ? 'shuttle.access_id'
    : 'shuttle.access_unstated'
  const access = tr(accessKey, { operator: agency.idName })
  if (variant === 'detail') {
    return (
      <span className={`block text-[0.78rem] leading-snug ${className}`}>
        <span className="block text-white/80">
          {tr('detail.shuttle_operator', { operator: agency.name })}
        </span>
        <span className="block text-white/75">{access}</span>
      </span>
    )
  }
  return (
    <span className={`block text-[0.78rem] leading-snug text-white/80 ${className}`}>
      {agency.name}
      <span className="text-white/75"> · {access}</span>
    </span>
  )
}
