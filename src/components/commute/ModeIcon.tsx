'use client'

import { Bicycle, Bus, Car, CircleIcon, Compass, PersonSimpleWalk, Taxi, Train, TrainRegional, UsersThree, Van, type Icon } from '@phosphor-icons/react'
import type { Mode } from '@/lib/types/commute'

type IconMode = Mode | 'drive' | 'carpool' | 'rideshare' | 'commuter_rail' | 'shuttle' | 'new'

const ICONS: Record<IconMode, Icon> = {
  drive: Car,
  carpool: UsersThree,
  rideshare: Taxi,
  walk: PersonSimpleWalk,
  bike: Bicycle,
  ebike: Bicycle,
  transit: Train,
  bus: Bus,
  commuter_rail: TrainRegional,
  shuttle: Van,
  new: Compass,
}

/**
 * The shared mode glyph, from Phosphor at the house weight: regular at
 * 15dp and up, bold at 14dp and below (reference_icon_weight_system).
 * Never fill: a filled Bicycle plugs both wheels into discs and reads as
 * two dots.
 */
export default function ModeIcon({ mode, size = 28, className = '' }: { mode: IconMode | string; size?: number; className?: string }) {
  const weight = size <= 14 ? 'bold' : 'regular'
  // Two-leg ways in: the first leg's glyph, then the train, composed at the
  // same weight (Car+Train for park-and-ride, Bicycle+Train for bike-to-train).
  if (mode === 'park_ride' || mode === 'bike_ride') {
    const First = mode === 'park_ride' ? Car : Bicycle
    const part = Math.round(size * 0.72)
    return (
      <span className={`inline-flex shrink-0 items-end ${className}`} style={{ width: size, height: size }} aria-hidden>
        <First size={part} weight={weight} className="shrink-0 self-start" />
        <Train size={part} weight={weight} className="-ml-[0.2em] shrink-0" />
      </span>
    )
  }
  const I = ICONS[mode as IconMode] ?? CircleIcon
  return <I size={size} weight={weight} className={`inline-block shrink-0 ${className}`} aria-hidden />
}
