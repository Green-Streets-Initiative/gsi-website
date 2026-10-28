'use client'

import { bikeShareBenefitLine } from '@/lib/employer/bike-share'
import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowSquareOut } from '@phosphor-icons/react'
import { PanelPhoto } from '@/components/nearby/DetailPanel'
import { SHUTTLE_COLOR } from '@/lib/nearby/shuttle-agencies'
import { COMFORT_COLORS, COMFORT_LABELS, comfortGroup, comfortPieces, concernAdvice, concernTitle, formatStretchMiles, legPhotoSpec, newLaneNotes, type CalmRoute } from './calm-route'
import {
  bikeParkingPhrase,
  headwayPhrase,
  lineColorFor,
  liveDeparturesUrl,
  mergeRacks,
  legRideName,
  shuttleAccessNote,
  transitItinerary,
  type LatLng,
  type LegLive,
  type ShuttleLine,
} from './plan-data'
import { BIKE_LOCK_MINUTES, formatClock } from '@/lib/employer/commute-costs'
import type { AdvisorCombo, AdvisorResult, AdvisorShuttleTransfer, BikeParkingSpot, EmployerBenefits, ShuttleRoute, TransitLeg } from '@/lib/types/commute'

/*
 * The one drawer that opens under a plan row. Each way in has its own
 * body, built from the same pieces: the trip as steps (tap one and the map
 * lights that stretch; a bike stretch also shows the Street View preview
 * Nearby uses), a line or two of fact, and the actions. No calories, no
 * raw CO2, nothing "vs driving". Text stays at reading size (Keith
 * 2026-10-21: no walls of tiny text); the steps carry the trip, so no
 * sentence repeats them.
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
        className="inline-block h-3 w-3 shrink-0 rounded-[3px]"
        style={dashed ? { border: `2px dashed ${color}` } : { backgroundColor: color }}
      />
      <span className="min-w-0 truncate font-semibold text-[#191A2E]">{label}</span>
      {detail && <span className="shrink-0 text-[#4A4D68]">{detail}</span>}
    </>
  )
  const cls = `inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.9375rem] leading-tight ${
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

export interface StepRow {
  id: string
  /** The map stretch this step lights; null for one the map does not draw (a transfer walk). */
  mapKey: string | null
  color: string
  dashed?: boolean
  minutes: number | null
  /** "about" before the minutes: an estimate from distance, not a timetable. */
  about?: boolean
  /** "Walk", "Route 85", "Red Line", "Drive". */
  what: string
  /** Where the step ends. */
  to: string
}

/**
 * The trip as a column of steps, like a transit app's itinerary: a
 * coloured rail (dashed for a walk), the minutes, what and to where. One
 * glance gives the whole trip; tapping a step lights it on the map.
 */
export function Itinerary({ steps, highlightedLeg, onLegTap }: {
  steps: StepRow[]
  highlightedLeg: string | null
  onLegTap: (key: string) => void
}) {
  return (
    <ol className="m-0 list-none overflow-hidden rounded-xl border border-[rgba(25,26,46,0.12)] bg-white p-0" aria-label="The trip, step by step">
      {steps.map((st, i) => {
        const on = st.mapKey != null && highlightedLeg === st.mapKey
        const body = (
          <>
            <span aria-hidden className="relative flex w-3 justify-center self-stretch">
              <span
                className="absolute inset-y-0 w-[5px] rounded-full"
                style={st.dashed ? { backgroundImage: `repeating-linear-gradient(${st.color} 0 5px, transparent 5px 9px)` } : { backgroundColor: st.color }}
              />
            </span>
            <span className="w-[4.25rem] shrink-0 text-[1rem] font-extrabold tabular-nums leading-snug text-[#191A2E]">
              {st.minutes != null ? `${st.about ? '~' : ''}${st.minutes} min` : '—'}
            </span>
            <span className="min-w-0 text-[0.9375rem] leading-snug text-[#191A2E]">
              <b>{st.what}</b> <span className="text-[#4A4D68]">to</span> {st.to}
            </span>
          </>
        )
        const cls = `flex w-full items-stretch gap-3 px-3 py-2.5 text-left ${i > 0 ? 'border-t border-[rgba(25,26,46,0.08)]' : ''} ${on ? 'bg-[#E7F0EA]' : ''}`
        return (
          <li key={st.id}>
            {st.mapKey ? (
              <button type="button" aria-pressed={on} onClick={() => onLegTap(st.mapKey!)} className={`${cls} cursor-pointer transition-colors hover:bg-[#F4F8EE]`}>
                {body}
              </button>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function DrawerActions({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex flex-wrap gap-2">{children}</div>
}

export function ActionLink({ href, onClick, primary = false, children }: { href: string; onClick?: () => void; primary?: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 text-[0.9375rem] font-bold transition-colors ${
        primary ? 'border-[#2D6A4F] bg-[#2D6A4F] text-white hover:bg-[#1F4D3A]' : 'border-[#2D6A4F] bg-white text-[#2D6A4F] hover:bg-[#E7F0EA]'
      }`}
    >
      {children}
      <ArrowSquareOut size={15} weight="bold" aria-hidden />
    </a>
  )
}

export function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#2D6A4F] bg-white px-4 text-[0.9375rem] font-bold text-[#2D6A4F] transition-colors hover:bg-[#E7F0EA]"
    >
      {children}
    </button>
  )
}

const P = ({ children, muted = false }: { children: ReactNode; muted?: boolean }) => (
  <p className={`text-[0.9375rem] leading-normal ${muted ? 'text-[#4A4D68]' : 'text-[#191A2E]'}`}>{children}</p>
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
  const first = legs[0]
  const live0 = legsLive[0]
  const headway = headwayPhrase(live0)
  const subsidy = benefits.transit_subsidy_monthly && benefits.transit_subsidy_monthly > 0
    ? benefits.transit_subsidy_label || `${companyName ?? 'Your employer'} covers $${benefits.transit_subsidy_monthly} a month toward transit`
    : null
  const steps: StepRow[] = transitItinerary(plan, home, office, officeName).map((st, i) =>
    st.kind === 'walk'
      ? { id: `w${i}`, mapKey: st.key, color: WALK_COLOR, dashed: true, minutes: st.minutes, what: 'Walk', to: st.to }
      : {
          id: `r${i}`,
          mapKey: st.key,
          color: legsLive[st.index]?.color ?? lineColorFor(st.leg, plan.nearby.stops),
          minutes: st.minutes,
          what: legRideName(st.leg).replace(/^the /, ''),
          to: st.to,
        },
  )
  const fare = t?.fare_per_trip != null && t.fare_per_trip > 0 ? `$${t.fare_per_trip.toFixed(2)} a ride` : null

  return (
    <>
      <Itinerary steps={steps} highlightedLeg={highlightedLeg} onLegTap={onLegTap} />
      <P>
        {live0 === null ? (
          <span className="text-[#4A4D68]">Checking the next {legRideName(first).replace(/^the /, '')}…</span>
        ) : live0 && live0.nextMinutes.length > 0 ? (
          <>
            Next {legRideName(first).replace(/^the /, '')}: <b>{live0.nextMinutes.map((m) => (m <= 0 ? 'now' : `${m} min`)).join(', ')}</b>
            {headway ? `, then ${headway}` : ''}
          </>
        ) : headway ? (
          <>Runs {headway}</>
        ) : null}
        {fare && <>{live0 === null || (live0 && live0.nextMinutes.length > 0) || headway ? ' · ' : ''}{fare}</>}
      </P>
      {subsidy && <P>{subsidy}.</P>}
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
          {newLaneNotes(calm.calm.flags).map((n) => (
            <P key={n}><b>{n}.</b></P>
          ))}
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
              <figcaption className="mt-1 text-[0.875rem] text-[#4A4D68]">
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
          {benefits.bikeshare_subsidized ? ` ${bikeShareBenefitLine(benefits, companyName)}.` : ''}
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

export function DriveDrawer({ plan, benefits, onAddParking, onNoCar, directionsHref, onDirections }: {
  plan: AdvisorResult
  benefits: EmployerBenefits
  onAddParking: () => void
  /** "No car": take the rows that need one off the plan (product item 17). */
  onNoCar?: () => void
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
        {onNoCar && <ActionButton onClick={onNoCar}>I don't have a car</ActionButton>}
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
  const comboSteps: StepRow[] = [
    { id: 'first', mapKey: 'first:0', color: c.kind === 'park_ride' ? DRIVE_COLOR : BIKE_LEG_COLOR, minutes: c.first_leg.minutes, what: firstWord, to: station.name },
    ...c.transit_legs.map((leg, i): StepRow => ({
      id: `r${i}`,
      mapKey: `transit:${i}`,
      color: legsLive[i]?.color ?? lineColorFor(leg, plan.nearby.stops),
      minutes: leg.minutes,
      what: legRideName(leg).replace(/^the /, ''),
      to: leg.arrival_stop_name,
    })),
    ...(c.walk_from_minutes != null && c.walk_from_minutes > 0
      ? [{ id: 'walk', mapKey: 'walk:1', color: WALK_COLOR, dashed: true, minutes: c.walk_from_minutes, what: 'Walk', to: office }]
      : []),
  ]

  return (
    <>
      <Itinerary steps={comboSteps} highlightedLeg={highlightedLeg} onLegTap={onLegTap} />
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
      <Itinerary
        steps={[
          { id: 'w0', mapKey: 'walk:0', color: WALK_COLOR, dashed: true, minutes: line.walkToMinutes, what: 'Walk', to: line.homeStopName },
          { id: 'ride', mapKey: 'ride:0', color: SHUTTLE_COLOR, minutes: line.rideMinutes, about: line.rideEstimated, what: `${line.agencyLabel} ${line.routeName}`.trim(), to: line.stopName },
          { id: 'w1', mapKey: 'walk:1', color: WALK_COLOR, dashed: true, minutes: line.walkFromMinutes, what: 'Walk', to: office },
        ]}
        highlightedLeg={highlightedLeg}
        onLegTap={onLegTap}
      />
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
      {line.url && (
        <DrawerActions><ActionLink href={line.url}>{line.agencyName} schedule</ActionLink></DrawerActions>
      )}
    </>
  )
}

/**
 * The T plus a shuttle Google leaves out (commute-advisor-compare): each
 * walk and ride, when to leave, who may ride, and credit to the TMA or
 * campus that runs it, with its schedule.
 */
export function ShuttleTransferDrawer({ s, plan, officeName, companyName }: {
  s: AdvisorShuttleTransfer
  plan: AdvisorResult
  officeName: string
  companyName: string | null
}) {
  const office = officeName === 'Work' || /^\d/.test(officeName) ? 'the office' : officeName
  // The engine's legs carry route_type as a number; colors and names need only the line.
  const asLeg = (leg: AdvisorShuttleTransfer['legs'][number]): TransitLeg => ({
    route_id: null, route_name: leg.route_name, route_type: null, headsign: null,
    departure_stop_id: null, departure_stop_name: leg.departure_stop_name, arrival_stop_id: null, arrival_stop_name: leg.arrival_stop_name, minutes: leg.minutes,
  })
  const steps: StepRow[] = s.legs.flatMap((leg, i): StepRow[] => [
    ...(leg.walk_before_minutes != null && leg.walk_before_minutes > 0
      ? [{ id: `w${i}`, mapKey: null, color: WALK_COLOR, dashed: true, minutes: leg.walk_before_minutes, what: 'Walk', to: leg.departure_stop_name }]
      : []),
    {
      id: `r${i}`,
      // The map doesn't draw these legs.
      mapKey: null,
      color: leg.operator ? SHUTTLE_COLOR : lineColorFor(asLeg(leg), plan.nearby.stops),
      minutes: leg.minutes,
      about: !!leg.operator && s.ride_estimated,
      what: leg.operator ? leg.line : legRideName(asLeg(leg)).replace(/^the /, ''),
      to: leg.arrival_stop_name,
    },
  ])
  if (s.walk_from_minutes > 0) steps.push({ id: 'wend', mapKey: null, color: WALK_COLOR, dashed: true, minutes: s.walk_from_minutes, what: 'Walk', to: office })
  const who = s.eligible_because === 'public'
    ? 'Open to everyone, free.'
    : s.eligible_because === 'public_fare'
      ? 'Open to everyone; there is a fare, free at member employers.'
      : `${companyName ?? 'Your employer'} lists this shuttle among its benefits.`
  const runBy = s.operator.run_by || s.operator.name
  return (
    <>
      <Itinerary steps={steps} highlightedLeg={null} onLegTap={() => {}} />
      <P>
        {s.leave_by && <>Leave home by <b>{formatClock(s.leave_by)}</b>. </>}
        {s.shuttle_depart_at && <>The shuttle leaves {s.board_stop.name} at <b>{formatClock(s.shuttle_depart_at)}</b>. </>}
        {who} Maps apps don&rsquo;t show this shuttle; it&rsquo;s run by {runBy}.
      </P>
      {s.operator.url && (
        <DrawerActions><ActionLink href={s.operator.url}>{runBy} schedule</ActionLink></DrawerActions>
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
