'use client'

import { type StationGroup, shuttleAgencyForStation, isShuttleStation } from './useNearbyModel'
import { withUtm } from '@/lib/utm'
import { useNearbyT } from './NearbyI18n'
import type { ShuttleAccess } from '@/lib/nearby/shuttle-agencies'

/**
 * The two lines every campus / TMA shuttle stop needs and no MBTA stop does:
 * WHO runs it and WHO may board.
 *
 * A shuttle stop is drawn like a bus stop and named like one ("Market Basket
 * Somerville"), so without this a rider can't tell that the indigo pin is an
 * MIT shuttle they may need an MIT ID to use. The policy itself lives in
 * lib/nearby/shuttle-agencies.ts, verified per operator.
 */
const ACCESS_KEY: Record<ShuttleAccess, string> = {
  public: 'shuttle.access_public',
  'public-fare': 'shuttle.access_public_fare',
  id: 'shuttle.access_id',
  unstated: 'shuttle.access_unstated',
}

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
  const accessKey = ACCESS_KEY[agency.access]
  const access = tr(accessKey, { operator: agency.idName })
  if (variant === 'detail') {
    return (
      <span className={`block text-[0.78rem] leading-snug ${className}`}>
        <span className="block text-(--nb-ink-80)">{agency.name}</span>
        <span className="block text-(--nb-ink-70)">{access}</span>
        {agency.url && (
          <a
            href={withUtm(agency.url, { medium: 'nearby', campaign: 'shuttle', content: agency.prefix }) ?? agency.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block font-semibold text-(--nb-accent) underline-offset-2 hover:underline"
          >
            {tr('shuttle.operator_link')} &rarr;<span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </span>
    )
  }
  return (
    <span className={`block text-[0.78rem] leading-snug text-(--nb-ink-80) ${className}`}>
      {agency.name}
      <span className="text-(--nb-ink-70)"> · {access}</span>
    </span>
  )
}
