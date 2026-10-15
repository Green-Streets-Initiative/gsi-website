'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowSquareOut } from '@phosphor-icons/react'
import { PanelPhoto } from '@/components/nearby/DetailPanel'
import { SHUTTLE_COLOR } from '@/lib/nearby/shuttle-agencies'
import { COMFORT_COLORS, COMFORT_LABELS, comfortGroup, comfortPieces, concernAdvice, concernTitle, formatStretchMiles, legPhotoSpec, type CalmRoute } from './calm-route'
import {
  bikeParkingPhrase,
  headwayPhrase,
  lineColorFor,
  liveDeparturesUrl,
  mergeRacks,
  shuttleAccessNote,
  transitSentence,
  transitWalkLegs,
  type LatLng,
  type LegLive,
  type ShuttleLine,
} from './plan-data'
import { BIKE_LOCK_MINUTES, formatClock } from '@/lib/employer/commute-costs'
import type { AdvisorCombo, AdvisorResult, BikeParkingSpot, EmployerBenefits, ShuttleRoute } from '@/lib/types/commute'

/*
 * The one drawer that opens under a plan row. Each way in has its own
 * body, built from the same pieces: a line or two of fact, the legs as
 * chips (tap one and the map lights that stretch; a bike stretch also
 * shows the Street View preview Nearby uses), and the actions. No
 * calories, no raw CO2, nothing "vs driving".
 */

const WALK_COLOR = '#4C9A6A'
/** The drive leg of a park-and-ride, the same grey the map draws it in. */
const DRIVE_COLOR = '#6B6E85'
/** The bike leg of a bike-to-train (no calm-route scoring on this leg): the path green. */
const BIKE_LEG_COLOR = '#BAF14D'

/* ── Shared pieces ── */

export function LegChip({ color, label, detail, on = false, onClick, dashed = false }: {
  color: string
  label: string
  detail?: string | null
  on?: boolean
  onClick?: () => void
  dashed?: boolean
}) {
  const body = (
    <>
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
        style={dashed ? { border: `2px dashed ${color}` } : { backgroundColor: color }}
      />
      <span className="min-w-0 truncate font-semibold text-[#191A2E]">{label}</span>
      {detail && <span className="shrink-0 text-[#4A4D68]">{detail}</span>}
    </>
  )
  const cls = `inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.8rem] leading-tight ${
    on ? 'border-[#2D6A4F] bg-[#E7F0EA]' : 'border-[rgba(25,26,46,0.12)] bg-white'
  }`
  // A chip lit from the map (a stretch tapped there) may sit out of view in
  // a long drawer; bring it in. 'nearest' is a no-op for a chip the reader
  // just tapped themselves.
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (on) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [on])
  if (!onClick) return <span className={cls}>{body}</span>
  return (
    <button ref={ref} type="button" aria-pressed={on} onClick={onClick} className={`${cls} cursor-pointer transition-colors hover:border-[#2D6A4F]`}>
      {body}
    </button>
  )
}

export function DrawerActions({ children }: { children: ReactNode }) {
  return <div className="mt-2.5 flex flex-wrap gap-2">{children}</div>
}

export function ActionLink({ href, onClick, primary = false, children }: { href: string; onClick?: () => void; primary?: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3.5 text-[0.8125rem] font-bold transition-colors ${
        primary ? 'border-[#2D6A4F] bg-[#2D6A4F] text-white hover:bg-[#1F4D3A]' : 'border-[#2D6A4F] bg-white text-[#2D6A4F] hover:bg-[#E7F0EA]'
      }`}
    >
      {children}
      <ArrowSquareOut size={13} weight="bold" aria-hidden />
    </a>
  )
}

export function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[#2D6A4F] bg-white px-3.5 text-[0.8125rem] font-bold text-[#2D6A4F] transition-colors hover:bg-[#E7F0EA]"
    >
      {children}
    </button>
  )
}

const P = ({ children, muted = false }: { children: ReactNode; muted?: boolean }) => (
  <p className={`text-[0.875rem] leading-snug ${muted ? 'text-[#4A4D68]' : 'text-[#191A2E]'}`}>{children}</p>
)

/* ── Transit ── */

export function TransitDrawer({
  plan, legsLive, home, office, officeName, benefits, companyName, highlightedLeg, onLegTap, directionsHref, onDirections,
}: {
  plan: AdvisorResult
  legsLive: (LegLive | null)[]
  home: LatLng
  office: LatLng
  officeName: string
  benefits: EmployerBenefits
  companyName: string | null
  highlightedLeg: string | null
  onLegTap: (key: string) => void
  directionsHref: string
  onDirections: () => void
}) {
  const t = plan.modes.transit ?? plan.modes.bus
  const legs = plan.transit_legs
  if (legs.length === 0) {
    return (
      <>
        <P>{plan.transit_summary ? `${plan.transit_summary}.` : 'A bus or train trip; open Directions for the lines and times.'}</P>
        <DrawerActions><ActionLink href={directionsHref} onClick={onDirections} primary>Directions</ActionLink></DrawerActions>
      </>
    )
  }
  const walks = transitWalkLegs(plan, home, office, officeName)
  const toStop = walks.find((w) => w.key === 'walk:0')
  const fromStop = walks.find((w) => w.key === 'walk:1')
  const sentence = transitSentence(plan, home, office, officeName)
  const first = legs[0]
  const live0 = legsLive[0]
  const headway = headwayPhrase(live0)
  const subsidy = benefits.transit_subsidy_monthly && benefits.transit_subsidy_monthly > 0
    ? benefits.transit_subsidy_label || `${companyName ?? 'Your employer'} covers $${benefits.transit_subsidy_monthly} a month toward transit`
    : null
  const walkChip = (w: { minutes: number; placeName: string }, derived: { minutes: number; about: boolean } | null) =>
    `Walk ${derived?.about ? 'about ' : ''}${derived?.minutes ?? w.minutes} min to ${w.placeName}`

  return (
    <>
      {/* The trip as walk, ride, walk, a minute count on each (Keith 2026-10-05). */}
      {sentence && <P><b>{sentence.text}</b></P>}
      <P>
        {live0 === null ? (
          <span className="text-[#4A4D68]">Checking next departures from {first.departure_stop_name}…</span>
        ) : live0 && live0.nextMinutes.length > 0 ? (
          <>
            Next from {first.departure_stop_name}: <b>{live0.nextMinutes.map((m) => (m <= 0 ? 'now' : `${m} min`)).join(', ')}</b>
            {headway ? ` · ${headway}` : ''}
          </>
        ) : headway ? (
          <>Runs {headway}.</>
        ) : null}
        {t?.fare_per_trip != null && t.fare_per_trip > 0 && (
          <>{live0 === null || (live0 && live0.nextMinutes.length > 0) || headway ? ' · ' : ''}${t.fare_per_trip.toFixed(2)} a ride, monthly pass counted when cheaper.</>
        )}
      </P>
      {subsidy && <P>{subsidy}.</P>}
      <div className="flex flex-wrap gap-1.5">
        {toStop && (
          <LegChip color={WALK_COLOR} dashed label={walkChip(toStop, sentence?.walkTo ?? null)} on={highlightedLeg === 'walk:0'} onClick={() => onLegTap('walk:0')} />
        )}
        {legs.map((leg, i) => {
          const name = /^\d+$/.test(leg.route_name) ? `${leg.route_name} bus` : leg.route_name
          const detail = leg.minutes ? `${leg.minutes} min` : leg.num_stops ? `${leg.num_stops} stops` : null
          return (
            <LegChip
              key={`${leg.route_id ?? leg.route_name}-${i}`}
              color={legsLive[i]?.color ?? lineColorFor(leg, plan.nearby.stops)}
              label={`${name}, ${leg.departure_stop_name} to ${leg.arrival_stop_name}`}
              detail={detail}
              on={highlightedLeg === `transit:${i}`}
              onClick={() => onLegTap(`transit:${i}`)}
            />
          )
        })}
        {fromStop && (
          <LegChip color={WALK_COLOR} dashed label={walkChip(fromStop, sentence?.walkFrom ?? null)} on={highlightedLeg === 'walk:1'} onClick={() => onLegTap('walk:1')} />
        )}
      </div>
      <DrawerActions>
        <ActionLink href={directionsHref} onClick={onDirections} primary>Directions</ActionLink>
        <ActionLink href={liveDeparturesUrl(first)}>Live departures</ActionLink>
      </DrawerActions>
    </>
  )
}

/* ── Bike ── */

export function BikeDrawer({
  plan, calm, calmLoading, bikeParking, benefits, companyName, highlightedLeg, onLegTap, directionsHref, onDirections,
}: {
  plan: AdvisorResult
  calm: CalmRoute | null
  calmLoading: boolean
  bikeParking: BikeParkingSpot[]
  benefits: EmployerBenefits
  companyName: string | null
  highlightedLeg: string | null
  onLegTap: (key: string) => void
  directionsHref: string
  onDirections: () => void
}) {
  const b = plan.modes.bike ?? plan.modes.ebike
  const employerParking = benefits.bike_parking
    ? benefits.bike_parking_details ? `${companyName ?? 'Your employer'} has bike parking: ${benefits.bike_parking_details}` : `${companyName ?? 'Your employer'} has bike parking at the office`
    : null
  const rackLine = bikeParkingPhrase(mergeRacks(plan.nearby.bike_parking, bikeParking))
  const docks = plan.nearby.docks.slice(0, 2)
  const homeDock = plan.nearby.docks_home[0]
  // Every stretch in route order; the same list the map draws, so a chip
  // and its coloured run share an index.
  const stretches = calm ? comfortPieces(calm.calm) : []
  const selectedIndex = highlightedLeg?.startsWith('bike:') ? Number(highlightedLeg.slice(5)) : null
  const selectedStretch = selectedIndex != null ? stretches.find((p) => p.index === selectedIndex) : undefined
  const photo = calm && selectedStretch ? legPhotoSpec(calm.calm, selectedStretch.index) : null
  const concern = calm?.concerns[0]

  return (
    <>
      {calmLoading && !calm ? (
        <P muted>
          <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-[rgba(25,26,46,0.12)] border-t-[#2D6A4F] align-[-1px]" aria-hidden />
          Finding the calm route…
        </P>
      ) : calm ? (
        <>
          <P>
            {/* Riding time only; the row's door-to-door number adds the lock-up minute. */}
            <b>{calm.calm.durationMinutes} min</b> of riding on quieter streets
            {calm.slowerBy > 0 ? `, ${calm.slowerBy} min more than the quickest way` : ', which is also the quickest way'}.{' '}
            {calm.verdict.text}
            {concern ? ` ${concernTitle(concern)}${concernAdvice(concern) ? `: ${concernAdvice(concern)}` : '.'}` : ''}
          </P>
          {stretches.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="The route, stretch by stretch">
              {stretches.map((s) => (
                <LegChip
                  key={`${s.index}-${s.label}`}
                  color={COMFORT_COLORS[s.rating] ?? COMFORT_COLORS.shared_road}
                  dashed={s.rating === 'bike_lane'}
                  label={s.label}
                  detail={`${formatStretchMiles(s.distanceMi)} · ${comfortGroup(s.rating)}`}
                  on={selectedIndex === s.index}
                  onClick={() => onLegTap(`bike:${s.index}`)}
                />
              ))}
            </div>
          )}
          {photo && selectedStretch ? (
            <figure className="m-0 max-w-[420px]">
              <PanelPhoto spec={{ kind: 'sv', ...photo }} alt={selectedStretch.label} />
              <figcaption className="mt-1 text-[0.75rem] text-[#4A4D68]">
                {selectedStretch.label}, {formatStretchMiles(selectedStretch.distanceMi)}, {(COMFORT_LABELS[selectedStretch.rating] ?? selectedStretch.rating).toLowerCase()}. Street View.
              </figcaption>
            </figure>
          ) : stretches.length > 0 ? (
            <P muted>Tap a stretch here or on the map to see it in Street View.</P>
          ) : null}
        </>
      ) : (
        <P muted>{b?.comfort_summary || b?.detail || 'Open Directions for the route.'}</P>
      )}
      {employerParking && <P>{employerParking}.</P>}
      {rackLine && <P>{rackLine}.</P>}
      {(homeDock || docks.length > 0) && (
        <P>
          Bluebikes:{' '}
          {homeDock ? `${homeDock.num_bikes_available} bike${homeDock.num_bikes_available === 1 ? '' : 's'} at ${homeDock.name} near home` : ''}
          {homeDock && docks.length > 0 ? '; ' : ''}
          {docks.length > 0 ? `by the office, ${docks.map((d) => `${d.name} (${d.num_docks_available} open dock${d.num_docks_available === 1 ? '' : 's'})`).join(', ')}` : ''}.
          {benefits.bluebikes_subsidized ? ` ${benefits.bluebikes_subsidy_label || `${companyName ?? 'Your employer'} covers the membership.`}` : ''}
        </P>
      )}
      {benefits.showers && <P>{benefits.shower_details ? `Showers at the office: ${benefits.shower_details}.` : 'Showers at the office.'}</P>}
      <DrawerActions>
        <ActionLink href={directionsHref} onClick={onDirections} primary>{calm ? 'Directions on these streets' : 'Directions'}</ActionLink>
      </DrawerActions>
    </>
  )
}

/* ── Drive ── */

export function DriveDrawer({ plan, benefits, onAddParking, directionsHref, onDirections }: {
  plan: AdvisorResult
  benefits: EmployerBenefits
  onAddParking: () => void
  directionsHref: string
  onDirections: () => void
}) {
  const m = plan.modes.drive
  const parking = plan.costs.parking_per_day
  const fuel = plan.costs.vehicle === 'ev' ? 'charging' : 'gas'
  return (
    <>
      {m?.leave_by && (
        <P>
          Leave by <b>{formatClock(m.leave_by)}</b> on a normal morning
          {m.leave_by_traffic && m.leave_by_traffic !== m.leave_by ? <>, or <b>{formatClock(m.leave_by_traffic)}</b> to be sure in heavy traffic</> : ''}.
        </P>
      )}
      <P>
        Parking: {parking > 0 ? `$${parking} a day` : benefits.free_parking ? 'free at the office' : 'no cost entered'}.{' '}
        {m ? `$${m.cost_per_day.toFixed(2).replace(/\.00$/, '')} a day for ${fuel} and car wear${parking > 0 ? ' and parking' : ''}, at today's price.` : ''}
      </P>
      <DrawerActions>
        <ActionLink href={directionsHref} onClick={onDirections} primary>Directions</ActionLink>
        {parking <= 0 && !benefits.free_parking && <ActionButton onClick={onAddParking}>Add a parking cost</ActionButton>}
      </DrawerActions>
    </>
  )
}

/* ── Walk ── */

export function WalkDrawer({ plan, benefits, directionsHref, onDirections }: {
  plan: AdvisorResult
  benefits: EmployerBenefits
  directionsHref: string
  onDirections: () => void
}) {
  const m = plan.modes.walk
  return (
    <>
      <P>
        {m?.miles != null ? `${m.miles.toFixed(1)} miles on foot each way` : 'On foot each way'}
        {m?.minutes != null ? `, about ${m.minutes} minutes` : ''}.
        {benefits.showers ? ` Showers at the office${benefits.shower_details ? `: ${benefits.shower_details}` : ''}.` : ''}
      </P>
      <DrawerActions><ActionLink href={directionsHref} onClick={onDirections} primary>Directions</ActionLink></DrawerActions>
    </>
  )
}

/* ── Park-and-ride, bike-to-train ── */

/**
 * A two-leg way in: the car or bike to the station, then the train. The
 * legs as chips (the first leg, each transit leg with next departures from
 * the station via the same predictions path the transit row uses, the walk
 * from the last stop), the lot as a fact, Directions to the station.
 */
export function ComboDrawer({ plan, mode, legsLive, officeName, benefits, companyName, highlightedLeg, onLegTap, directionsHref, onDirections }: {
  plan: AdvisorResult
  mode: 'park_ride' | 'bike_ride'
  /** Live data per transit leg of this combo (null while loading). */
  legsLive: (LegLive | null)[]
  officeName: string
  benefits: EmployerBenefits
  companyName: string | null
  highlightedLeg: string | null
  onLegTap: (key: string) => void
  directionsHref: string
  onDirections: () => void
}) {
  const m = plan.modes[mode]
  const c: AdvisorCombo | null | undefined = m?.combo
  if (!c) return <P muted>Open Directions for the route.</P>
  const station = c.station
  const first = c.transit_legs[0]
  const live0 = legsLive[0]
  const headway = headwayPhrase(live0)
  const office = officeName === 'Work' || /^\d/.test(officeName) ? 'the office' : officeName
  const firstWord = c.kind === 'park_ride' ? 'Drive' : 'Bike'
  const lotLine = c.kind === 'park_ride'
    ? station.lot_fee_per_day != null && station.lot_fee_per_day > 0
      ? `The lot at ${station.name} is $${station.lot_fee_per_day} a day${station.lot_capacity ? `, ${station.lot_capacity.toLocaleString('en-US')} spaces` : ''}${station.lot_fee_text && !/^\$\d+(\.\d+)?$/.test(station.lot_fee_text) ? ` (${station.lot_fee_text})` : ''}.`
      : station.lot_fee_per_day === 0
        ? `The lot at ${station.name} is free${station.lot_capacity ? `, ${station.lot_capacity.toLocaleString('en-US')} spaces` : ''}.`
        : `The lot at ${station.name}${station.lot_capacity ? ` has ${station.lot_capacity.toLocaleString('en-US')} spaces` : ''}; the rate is not listed${station.lot_fee_text ? ` (${station.lot_fee_text})` : ''}.`
    : null
  const subsidy = benefits.transit_subsidy_monthly && benefits.transit_subsidy_monthly > 0
    ? benefits.transit_subsidy_label || `${companyName ?? 'Your employer'} covers $${benefits.transit_subsidy_monthly} a month toward transit`
    : null

  return (
    <>
      <P><b>{c.summary.replace(/\.?$/, '.')}</b></P>
      <P>
        Leave home by <b>{formatClock(c.leave_by)}</b>, be at {station.name} by <b>{formatClock(c.transit_depart_at)}</b>.
        {first && (
          <>
            {' '}
            {live0 === null ? (
              <span className="text-[#4A4D68]">Checking next departures from {first.departure_stop_name}…</span>
            ) : live0 && live0.nextMinutes.length > 0 ? (
              <>
                Next from {first.departure_stop_name}: <b>{live0.nextMinutes.map((n) => (n <= 0 ? 'now' : `${n} min`)).join(', ')}</b>
                {headway ? ` · ${headway}` : ''}.
              </>
            ) : headway ? (
              <>Runs {headway}.</>
            ) : null}
          </>
        )}
        {c.fare_per_trip > 0 && <> ${c.fare_per_trip.toFixed(2)} a ride{station.zone && /^CR-zone/.test(station.zone) ? ` (${station.zone.replace('CR-zone-', 'Zone ')})` : ''}.</>}
      </P>
      {lotLine && <P>{lotLine}</P>}
      {c.kind === 'bike_ride' && <P>Lock up at the station rack; the bike stays there for the day.</P>}
      {subsidy && <P>{subsidy}.</P>}
      <div className="flex flex-wrap gap-1.5">
        <LegChip
          color={c.kind === 'park_ride' ? DRIVE_COLOR : BIKE_LEG_COLOR}
          label={`${firstWord} ${c.first_leg.minutes} min to ${station.name}`}
          detail={`${c.first_leg.miles.toFixed(1)} mi`}
          on={highlightedLeg === 'first:0'}
          onClick={() => onLegTap('first:0')}
        />
        {c.transit_legs.map((leg, i) => {
          const name = /^\d+$/.test(leg.route_name) ? `${leg.route_name} bus` : leg.route_name
          const detail = leg.minutes ? `${leg.minutes} min` : leg.num_stops ? `${leg.num_stops} stops` : null
          return (
            <LegChip
              key={`${leg.route_id ?? leg.route_name}-${i}`}
              color={legsLive[i]?.color ?? lineColorFor(leg, plan.nearby.stops)}
              label={`${name}, ${leg.departure_stop_name} to ${leg.arrival_stop_name}`}
              detail={detail}
              on={highlightedLeg === `transit:${i}`}
              onClick={() => onLegTap(`transit:${i}`)}
            />
          )
        })}
        {c.walk_from_minutes != null && c.walk_from_minutes > 0 && (
          <LegChip color={WALK_COLOR} dashed label={`Walk ${c.walk_from_minutes} min to ${office}`} on={highlightedLeg === 'walk:1'} onClick={() => onLegTap('walk:1')} />
        )}
      </div>
      <DrawerActions>
        <ActionLink href={directionsHref} onClick={onDirections} primary>Directions to {station.name}</ActionLink>
        {first && <ActionLink href={liveDeparturesUrl(first)}>Live departures</ActionLink>}
      </DrawerActions>
    </>
  )
}

/* ── Shuttles ── */

/**
 * A shuttle the operator publishes, as a way in from this home: the walk
 * to its stop, the ride (timetable minutes when the operator lists both
 * stops, else about N min from the distance), the walk to the door, and
 * the next two departures from the HOME stop.
 */
export function ShuttleDrawer({ line, officeName, highlightedLeg, onLegTap }: {
  line: ShuttleLine
  officeName: string
  highlightedLeg: string | null
  onLegTap: (key: string) => void
}) {
  const times = line.nextTimes.slice(0, 2)
  const office = officeName === 'Work' || /^\d/.test(officeName) ? 'the office' : officeName
  return (
    <>
      <P>
        <b>
          Walk {line.walkToMinutes} min to {line.homeStopName}, {line.rideEstimated ? 'about ' : ''}{line.rideMinutes} min on the {line.agencyLabel} {line.routeName} to {line.stopName}, walk {line.walkFromMinutes} min to {office}.
        </b>
      </P>
      <P>
        {times.length > 0 ? (
          <>
            {line.nextDay ? `First from ${line.homeStopName} next service day: ` : `Next from ${line.homeStopName}: `}
            <b>{times.map((t, i) => (!line.nextDay && line.nextMinutes[i] != null ? `${t} (${line.nextMinutes[i]} min)` : t)).join(', ')}</b>
            {line.headsign ? ` toward ${line.headsign}` : ''}.
          </>
        ) : (
          <span className="text-[#4A4D68]">The operator publishes no timetable we can show here.</span>
        )}
        {' '}{shuttleAccessNote(line)}
      </P>
      <div className="flex flex-wrap gap-1.5">
        <LegChip color={WALK_COLOR} dashed label={`Walk ${line.walkToMinutes} min to ${line.homeStopName}`} on={highlightedLeg === 'walk:0'} onClick={() => onLegTap('walk:0')} />
        <LegChip color={SHUTTLE_COLOR} label={`${line.agencyLabel} ${line.routeName}, ${line.homeStopName} to ${line.stopName}`} detail={`${line.rideEstimated ? '~' : ''}${line.rideMinutes} min`} on={highlightedLeg === 'ride:0'} onClick={() => onLegTap('ride:0')} />
        <LegChip color={WALK_COLOR} dashed label={`Walk ${line.walkFromMinutes} min to ${office}`} on={highlightedLeg === 'walk:1'} onClick={() => onLegTap('walk:1')} />
      </div>
      {line.url && (
        <DrawerActions><ActionLink href={line.url}>{line.agencyName} schedule</ActionLink></DrawerActions>
      )}
    </>
  )
}

/** A shuttle the employer entered among its benefits. */
export function EmployerShuttleDrawer({ route, companyName }: { route: ShuttleRoute; companyName: string | null }) {
  return (
    <>
      <P>
        {companyName ?? 'Your employer'} runs this shuttle{route.from_stop ? ` from ${route.from_stop}` : ''}.{route.schedule ? ` ${route.schedule.replace(/\.?$/, '.')}` : ''}
      </P>
      {route.details && <P muted>{route.details}</P>}
    </>
  )
}
