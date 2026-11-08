'use client'

import { bikeShareBenefitLine } from '@/lib/employer/bike-share'
import { Fragment, useEffect, useRef, type ReactNode } from 'react'
import { ArrowSquareOut } from '@phosphor-icons/react'
import { PanelPhoto } from '@/components/nearby/DetailPanel'
import { SHUTTLE_COLOR } from '@/lib/nearby/shuttle-agencies'
import { COMFORT_COLORS, COMFORT_LABELS, comfortGroup, comfortLabel, comfortPieces, concernAdvice, concernTitle, formatStretchMiles, legPhotoSpec, newLaneNotes, type CalmRoute } from './calm-route'
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
import { SITE_LOCALE_TAG, translator, withLang, type SiteLocale, type T } from '@/lib/site-i18n'
import { advisorStrings } from '@/lib/site-strings/advisor'

type AdvisorT = T<keyof typeof advisorStrings.en & string>
const tFor = (locale: SiteLocale): AdvisorT => translator(advisorStrings, locale)

/**
 * A translated sentence with React pieces in its slots ("Leave by {time}"
 * with the time in bold): the template is split on the slots left after
 * t() filled the plain ones, so each language keeps its own word order.
 */
function rich(template: string, nodes: Record<string, ReactNode>): ReactNode {
  const parts = template.split(/\{(\w+)\}/)
  return parts.map((part, i) => (i % 2 === 1 ? <Fragment key={i}>{part in nodes ? nodes[part] : `{${part}}`}</Fragment> : part))
}

/** "Route 85", "SL1", "Red Line": a leg's name without the leading "the" (legRideName's rules). */
function rideName(leg: TransitLeg, t: AdvisorT): string {
  const name = leg.route_name.trim()
  if (/^\d+$/.test(name)) return t('drawer.route_n', { n: name })
  return legRideName(leg).replace(/^the /, '')
}

/** The three comfort words a stretch chip shows (comfortGroup). */
const GROUP_KEY = { path: 'drawer.group_path', calm: 'drawer.group_calm', busy: 'drawer.group_busy' } as const

/** "Your employer" or the company. */
const who = (companyName: string | null, t: AdvisorT) => companyName ?? t('drawer.your_employer')

/** The employer's transit benefit: its own label as written, else a plain line. */
function subsidyLine(benefits: EmployerBenefits, companyName: string | null, t: AdvisorT): string | null {
  return benefits.transit_subsidy_monthly && benefits.transit_subsidy_monthly > 0
    ? benefits.transit_subsidy_label || t('drawer.subsidy', { company: who(companyName, t), amount: `$${benefits.transit_subsidy_monthly}` })
    : null
}

/** "the office" when the office's label is a street address or "Work". */
const officeWord = (officeName: string, t: AdvisorT) => (officeName === 'Work' || /^\d/.test(officeName) ? t('drawer.the_office') : officeName)

/** Next departures, minutes away: "now, 6 min, 14 min". */
const minutesList = (mins: number[], t: AdvisorT) => mins.map((m) => (m <= 0 ? t('drawer.now') : t('drawer.minutes', { minutes: m }))).join(', ')

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
export function Itinerary({ steps, highlightedLeg, onLegTap, locale = 'en' }: {
  steps: StepRow[]
  highlightedLeg: string | null
  onLegTap: (key: string) => void
  locale?: SiteLocale
}) {
  const t = tFor(locale)
  return (
    <ol className="m-0 list-none overflow-hidden rounded-xl border border-[rgba(25,26,46,0.12)] bg-white p-0" aria-label={t('drawer.aria_steps')}>
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
              {st.minutes != null ? t(st.about ? 'drawer.minutes_about' : 'drawer.minutes', { minutes: st.minutes }) : '—'}
            </span>
            <span className="min-w-0 text-[0.9375rem] leading-snug text-[#191A2E]">
              <b>{st.what}</b> <span className="text-[#4A4D68]">{t('drawer.step_to')}</span> {st.to}
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
  plan, legsLive, home, office, officeName, benefits, companyName, highlightedLeg, onLegTap, directionsHref, onDirections, locale = 'en',
}: {
  locale?: SiteLocale
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
  const t = tFor(locale)
  const tm = plan.modes.transit ?? plan.modes.bus
  const legs = plan.transit_legs
  if (legs.length === 0) {
    return (
      <>
        {/* transit_summary is the engine's own text (English). */}
        <P>{plan.transit_summary ? `${plan.transit_summary}.` : t('drawer.transit_none')}</P>
        <DrawerActions><ActionLink href={directionsHref} onClick={onDirections} primary>{t('drawer.directions')}</ActionLink></DrawerActions>
      </>
    )
  }
  const first = legs[0]
  const live0 = legsLive[0]
  const headway = headwayPhrase(live0, locale)
  const subsidy = subsidyLine(benefits, companyName, t)
  const steps: StepRow[] = transitItinerary(plan, home, office, officeName, locale).map((st, i) =>
    st.kind === 'walk'
      ? { id: `w${i}`, mapKey: st.key, color: WALK_COLOR, dashed: true, minutes: st.minutes, what: t('drawer.walk'), to: st.to }
      : {
          id: `r${i}`,
          mapKey: st.key,
          color: legsLive[st.index]?.color ?? lineColorFor(st.leg, plan.nearby.stops),
          minutes: st.minutes,
          what: rideName(st.leg, t),
          to: st.to,
        },
  )
  const fare = tm?.fare_per_trip != null && tm.fare_per_trip > 0 ? t('drawer.fare_ride', { fare: `$${tm.fare_per_trip.toFixed(2)}` }) : null
  const ride = rideName(first, t)

  return (
    <>
      <Itinerary steps={steps} highlightedLeg={highlightedLeg} onLegTap={onLegTap} locale={locale} />
      <P>
        {live0 === null ? (
          <span className="text-[#4A4D68]">{t('drawer.checking_next', { ride })}</span>
        ) : live0 && live0.nextMinutes.length > 0 ? (
          <>
            {t('drawer.next_ride', { ride })} <b>{minutesList(live0.nextMinutes, t)}</b>
            {headway ? t('drawer.then_headway', { headway }) : ''}
          </>
        ) : headway ? (
          <>{t('drawer.runs', { headway })}</>
        ) : null}
        {fare && <>{live0 === null || (live0 && live0.nextMinutes.length > 0) || headway ? ' · ' : ''}{fare}</>}
      </P>
      {subsidy && <P>{t('drawer.sentence', { text: subsidy })}</P>}
      <DrawerActions>
        <ActionLink href={directionsHref} onClick={onDirections} primary>{t('drawer.directions')}</ActionLink>
        <ActionLink href={liveDeparturesUrl(first)}>{t('drawer.live_departures')}</ActionLink>
      </DrawerActions>
    </>
  )
}

/* ── Bike ── */

export function BikeDrawer({
  plan, calm, calmLoading, bikeParking, benefits, companyName, highlightedLeg, onLegTap, directionsHref, onDirections, lessonNearby = false, onLesson, locale = 'en',
}: {
  locale?: SiteLocale
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
  /** Home is near the free 1:1 street lesson (AdvisorFlow decides). */
  lessonNearby?: boolean
  onLesson?: () => void
}) {
  const t = tFor(locale)
  const b = plan.modes.bike ?? plan.modes.ebike
  const employerParking = benefits.bike_parking
    ? benefits.bike_parking_details ? t('drawer.employer_parking_details', { company: who(companyName, t), details: benefits.bike_parking_details }) : t('drawer.employer_parking', { company: who(companyName, t) })
    : null
  const rackLine = bikeParkingPhrase(mergeRacks(plan.nearby.bike_parking, bikeParking), locale)
  const docks = plan.nearby.docks.slice(0, 2)
  const homeDock = plan.nearby.docks_home[0]
  // Every stretch in route order; the same list the map draws, so a chip
  // and its coloured run share an index.
  const stretches = calm ? comfortPieces(calm.calm) : []
  const selectedIndex = highlightedLeg?.startsWith('bike:') ? Number(highlightedLeg.slice(5)) : null
  const selectedStretch = selectedIndex != null ? stretches.find((p) => p.index === selectedIndex) : undefined
  const photo = calm && selectedStretch ? legPhotoSpec(calm.calm, selectedStretch.index) : null
  const concern = calm?.concerns[0]
  const concernText = concern
    ? (() => {
        const title = concernTitle(concern, locale)
        const advice = concernAdvice(concern, undefined, locale)
        return advice ? t('drawer.concern_advice', { title, advice }) : t('drawer.concern_only', { title })
      })()
    : null
  // The employer's own bike share note as written, else a plain line.
  const bikeShareLine = locale === 'en' || benefits.bikeshare_subsidy_label?.trim()
    ? bikeShareBenefitLine(benefits, companyName)
    : t(benefits.bikeshare_subsidy_type === 'partial' ? 'drawer.bikeshare_partial' : 'drawer.bikeshare_full', {
        company: who(companyName, t),
        system: benefits.bikeshare_system?.trim() || t('drawer.bikeshare_generic'),
      })
  const homePart = homeDock
    ? t(homeDock.num_bikes_available === 1 ? 'drawer.dock_home_one' : 'drawer.dock_home', { count: homeDock.num_bikes_available, dock: homeDock.name })
    : null
  const officePart = docks.length > 0
    ? t('drawer.docks_office', { list: docks.map((d) => t(d.num_docks_available === 1 ? 'drawer.dock_open_one' : 'drawer.dock_open', { dock: d.name, count: d.num_docks_available })).join(', ') })
    : null
  // A stretch's comfort in words: the shared labels in English, else the reader's language.
  const comfortWord = (rating: string) => (locale === 'en' ? (COMFORT_LABELS[rating] ?? rating) : comfortLabel(rating, locale)).toLowerCase()

  return (
    <>
      {calmLoading && !calm ? (
        <P muted>
          <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-[rgba(25,26,46,0.12)] border-t-[#2D6A4F] align-[-1px]" aria-hidden />
          {t('drawer.finding_calm')}
        </P>
      ) : calm ? (
        <>
          <P>
            {/* Riding time only; the row's door-to-door number adds the lock-up minute. */}
            {rich(t(calm.slowerBy > 0 ? 'drawer.calm_slower' : 'drawer.calm_quickest', { slower: calm.slowerBy }), {
              minutes: <b>{t('drawer.minutes', { minutes: calm.calm.durationMinutes })}</b>,
            })}{' '}
            {calm.verdict.text}
            {concernText ? ` ${concernText}` : ''}
          </P>
          {newLaneNotes(calm.calm.flags).map((n) => (
            <P key={n}><b>{t('drawer.sentence', { text: n })}</b></P>
          ))}
          {stretches.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('drawer.aria_stretches')}>
              {stretches.map((s) => (
                <LegChip
                  key={`${s.index}-${s.label}`}
                  color={COMFORT_COLORS[s.rating] ?? COMFORT_COLORS.shared_road}
                  dashed={s.rating === 'bike_lane'}
                  label={s.label}
                  detail={`${formatStretchMiles(s.distanceMi, locale)} · ${t(GROUP_KEY[comfortGroup(s.rating)])}`}
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
                {t('drawer.photo_caption', { label: selectedStretch.label, miles: formatStretchMiles(selectedStretch.distanceMi, locale), comfort: comfortWord(selectedStretch.rating) })}
              </figcaption>
            </figure>
          ) : stretches.length > 0 ? (
            <P muted>{t('drawer.tap_stretch')}</P>
          ) : null}
        </>
      ) : (
        // The engine's comfort summary is its own text (English).
        <P muted>{b?.comfort_summary || b?.detail || t('drawer.open_directions')}</P>
      )}
      {employerParking && <P>{t('drawer.sentence', { text: employerParking })}</P>}
      {rackLine && <P>{t('drawer.sentence', { text: rackLine })}</P>}
      {(homePart || officePart) && (
        <P>
          {homePart && officePart
            ? t('drawer.bluebikes_both', { home: homePart, office: officePart })
            : homePart ? t('drawer.bluebikes_home', { home: homePart }) : t('drawer.bluebikes_office', { office: officePart })}
          {benefits.bikeshare_subsidized ? ` ${t('drawer.sentence', { text: bikeShareLine })}` : ''}
        </P>
      )}
      {benefits.showers && <P>{benefits.shower_details ? t('drawer.showers_details', { details: benefits.shower_details }) : t('drawer.showers')}</P>}
      <DrawerActions>
        <ActionLink href={directionsHref} onClick={onDirections} primary>{calm ? t('drawer.directions_streets') : t('drawer.directions')}</ActionLink>
      </DrawerActions>
      {lessonNearby && (
        <div className="mt-3 rounded-[10px] bg-[#E7F0EA] px-4 py-3">
          <P>{t('drawer.lesson')}</P>
          <DrawerActions>
            <ActionLink href={withLang('/bike-lessons?utm_source=advisor#street-lesson', locale)} onClick={onLesson}>{t('drawer.lesson_cta')}</ActionLink>
          </DrawerActions>
        </div>
      )}
    </>
  )
}

/* ── Drive ── */

export function DriveDrawer({ plan, benefits, onAddParking, onNoCar, directionsHref, onDirections, locale = 'en' }: {
  locale?: SiteLocale
  plan: AdvisorResult
  benefits: EmployerBenefits
  onAddParking: () => void
  /** "No car": take the rows that need one off the plan (product item 17). */
  onNoCar?: () => void
  directionsHref: string
  onDirections: () => void
}) {
  const t = tFor(locale)
  const m = plan.modes.drive
  const parking = plan.costs.parking_per_day
  const fuel = t(plan.costs.vehicle === 'ev' ? 'drawer.fuel_charging' : 'drawer.fuel_gas')
  const traffic = !!m?.leave_by_traffic && m.leave_by_traffic !== m.leave_by
  return (
    <>
      {m?.leave_by && (
        <P>
          {rich(t(traffic ? 'drawer.drive_leave_traffic' : 'drawer.drive_leave'), {
            time: <b>{formatClock(m.leave_by, locale)}</b>,
            traffic: traffic ? <b>{formatClock(m.leave_by_traffic, locale)}</b> : null,
          })}
        </P>
      )}
      <P>
        {t('drawer.parking_line', { what: parking > 0 ? t('drawer.parking_day', { amount: `$${parking}` }) : benefits.free_parking ? t('drawer.parking_free') : t('drawer.parking_none') })}{' '}
        {m ? t(parking > 0 ? 'drawer.drive_cost_parking' : 'drawer.drive_cost', { amount: `$${m.cost_per_day.toFixed(2).replace(/\.00$/, '')}`, fuel }) : ''}
      </P>
      <DrawerActions>
        <ActionLink href={directionsHref} onClick={onDirections} primary>{t('drawer.directions')}</ActionLink>
        {parking <= 0 && !benefits.free_parking && <ActionButton onClick={onAddParking}>{t('drawer.add_parking')}</ActionButton>}
        {onNoCar && <ActionButton onClick={onNoCar}>{t('drawer.no_car')}</ActionButton>}
      </DrawerActions>
    </>
  )
}

/* ── Walk ── */

export function WalkDrawer({ plan, benefits, directionsHref, onDirections, locale = 'en' }: {
  locale?: SiteLocale
  plan: AdvisorResult
  benefits: EmployerBenefits
  directionsHref: string
  onDirections: () => void
}) {
  const t = tFor(locale)
  const m = plan.modes.walk
  const miles = m?.miles != null ? m.miles.toFixed(1) : null
  const minutes = m?.minutes ?? null
  return (
    <>
      <P>
        {miles != null
          ? minutes != null ? t('drawer.walk_miles_minutes', { miles, minutes }) : t('drawer.walk_miles', { miles })
          : minutes != null ? t('drawer.walk_minutes', { minutes }) : t('drawer.walk_plain')}
        {benefits.showers ? ` ${benefits.shower_details ? t('drawer.showers_details', { details: benefits.shower_details }) : t('drawer.showers')}` : ''}
      </P>
      <DrawerActions><ActionLink href={directionsHref} onClick={onDirections} primary>{t('drawer.directions')}</ActionLink></DrawerActions>
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
export function ComboDrawer({ plan, mode, legsLive, officeName, benefits, companyName, highlightedLeg, onLegTap, directionsHref, onDirections, locale = 'en' }: {
  locale?: SiteLocale
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
  const t = tFor(locale)
  const m = plan.modes[mode]
  const c: AdvisorCombo | null | undefined = m?.combo
  if (!c) return <P muted>{t('drawer.open_directions')}</P>
  const station = c.station
  const first = c.transit_legs[0]
  const live0 = legsLive[0]
  const headway = headwayPhrase(live0, locale)
  const office = officeWord(officeName, t)
  const firstWord = c.kind === 'park_ride' ? t('drawer.drive') : t('drawer.bike')
  const spaces = station.lot_capacity ? station.lot_capacity.toLocaleString(SITE_LOCALE_TAG[locale]) : null
  const lotLine = c.kind === 'park_ride'
    ? station.lot_fee_per_day != null && station.lot_fee_per_day > 0
      ? t(spaces ? 'drawer.lot_fee_spaces' : 'drawer.lot_fee', {
          station: station.name,
          fee: `$${station.lot_fee_per_day}`,
          spaces,
          // The operator's own fee text, as written.
          note: station.lot_fee_text && !/^\$\d+(\.\d+)?$/.test(station.lot_fee_text) ? ` (${station.lot_fee_text})` : '',
        })
      : station.lot_fee_per_day === 0
        ? t(spaces ? 'drawer.lot_free_spaces' : 'drawer.lot_free', { station: station.name, spaces })
        : t(spaces ? 'drawer.lot_unknown_spaces' : 'drawer.lot_unknown', { station: station.name, spaces, note: station.lot_fee_text ? ` (${station.lot_fee_text})` : '' })
    : null
  const subsidy = subsidyLine(benefits, companyName, t)
  const comboSteps: StepRow[] = [
    { id: 'first', mapKey: 'first:0', color: c.kind === 'park_ride' ? DRIVE_COLOR : BIKE_LEG_COLOR, minutes: c.first_leg.minutes, what: firstWord, to: station.name },
    ...c.transit_legs.map((leg, i): StepRow => ({
      id: `r${i}`,
      mapKey: `transit:${i}`,
      color: legsLive[i]?.color ?? lineColorFor(leg, plan.nearby.stops),
      minutes: leg.minutes,
      what: rideName(leg, t),
      to: leg.arrival_stop_name,
    })),
    ...(c.walk_from_minutes != null && c.walk_from_minutes > 0
      ? [{ id: 'walk', mapKey: 'walk:1', color: WALK_COLOR, dashed: true, minutes: c.walk_from_minutes, what: t('drawer.walk'), to: office }]
      : []),
  ]
  const zone = station.zone && /^CR-zone/.test(station.zone) ? t('drawer.zone', { n: station.zone.replace('CR-zone-', '') }) : null

  return (
    <>
      <Itinerary steps={comboSteps} highlightedLeg={highlightedLeg} onLegTap={onLegTap} locale={locale} />
      <P>
        {rich(t('drawer.combo_leave', { station: station.name }), {
          leave: <b>{formatClock(c.leave_by, locale)}</b>,
          depart: <b>{formatClock(c.transit_depart_at, locale)}</b>,
        })}
        {first && (
          <>
            {' '}
            {live0 === null ? (
              <span className="text-[#4A4D68]">{t('drawer.checking_from', { stop: first.departure_stop_name })}</span>
            ) : live0 && live0.nextMinutes.length > 0 ? (
              rich(t(headway ? 'drawer.next_from_headway' : 'drawer.next_from', { stop: first.departure_stop_name, headway }), {
                times: <b>{minutesList(live0.nextMinutes, t)}</b>,
              })
            ) : headway ? (
              <>{t('drawer.runs_sentence', { headway })}</>
            ) : null}
          </>
        )}
        {c.fare_per_trip > 0 && <>{' '}{zone ? t('drawer.combo_fare_zone', { fare: `$${c.fare_per_trip.toFixed(2)}`, zone }) : t('drawer.combo_fare', { fare: `$${c.fare_per_trip.toFixed(2)}` })}</>}
      </P>
      {lotLine && <P>{lotLine}</P>}
      {c.kind === 'bike_ride' && <P>{t('drawer.bike_ride_lock')}</P>}
      {subsidy && <P>{t('drawer.sentence', { text: subsidy })}</P>}
      <DrawerActions>
        <ActionLink href={directionsHref} onClick={onDirections} primary>{t('drawer.directions_to', { station: station.name })}</ActionLink>
        {first && <ActionLink href={liveDeparturesUrl(first)}>{t('drawer.live_departures')}</ActionLink>}
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
export function ShuttleDrawer({ line, officeName, highlightedLeg, onLegTap, locale = 'en' }: {
  locale?: SiteLocale
  line: ShuttleLine
  officeName: string
  highlightedLeg: string | null
  onLegTap: (key: string) => void
}) {
  const t = tFor(locale)
  const times = line.nextTimes.slice(0, 2)
  const office = officeWord(officeName, t)
  const timesNode = <b>{times.map((time, i) => (!line.nextDay && line.nextMinutes[i] != null ? t('drawer.time_with_minutes', { time, minutes: line.nextMinutes[i] }) : time)).join(', ')}</b>
  const timesKey = line.nextDay
    ? line.headsign ? 'drawer.shuttle_first_toward' : 'drawer.shuttle_first'
    : line.headsign ? 'drawer.next_from_toward' : 'drawer.next_from'
  return (
    <>
      <Itinerary
        steps={[
          { id: 'w0', mapKey: 'walk:0', color: WALK_COLOR, dashed: true, minutes: line.walkToMinutes, what: t('drawer.walk'), to: line.homeStopName },
          { id: 'ride', mapKey: 'ride:0', color: SHUTTLE_COLOR, minutes: line.rideMinutes, about: line.rideEstimated, what: `${line.agencyLabel} ${line.routeName}`.trim(), to: line.stopName },
          { id: 'w1', mapKey: 'walk:1', color: WALK_COLOR, dashed: true, minutes: line.walkFromMinutes, what: t('drawer.walk'), to: office },
        ]}
        highlightedLeg={highlightedLeg}
        onLegTap={onLegTap}
        locale={locale}
      />
      <P>
        {times.length > 0 ? (
          rich(t(timesKey, { stop: line.homeStopName, headsign: line.headsign }), { times: timesNode })
        ) : (
          <span className="text-[#4A4D68]">{t('drawer.no_timetable')}</span>
        )}
        {' '}{shuttleAccessNote(line, locale)}
      </P>
      {line.url && (
        <DrawerActions><ActionLink href={line.url}>{t('drawer.schedule', { name: line.agencyName })}</ActionLink></DrawerActions>
      )}
    </>
  )
}

/**
 * The T plus a shuttle Google leaves out (commute-advisor-compare): each
 * walk and ride, when to leave, who may ride, and credit to the TMA or
 * campus that runs it, with its schedule.
 */
export function ShuttleTransferDrawer({ s, plan, officeName, companyName, locale = 'en' }: {
  locale?: SiteLocale
  s: AdvisorShuttleTransfer
  plan: AdvisorResult
  officeName: string
  companyName: string | null
}) {
  const t = tFor(locale)
  const office = officeWord(officeName, t)
  // The engine's legs carry route_type as a number; colors and names need only the line.
  const asLeg = (leg: AdvisorShuttleTransfer['legs'][number]): TransitLeg => ({
    route_id: null, route_name: leg.route_name, route_type: null, headsign: null,
    departure_stop_id: null, departure_stop_name: leg.departure_stop_name, arrival_stop_id: null, arrival_stop_name: leg.arrival_stop_name, minutes: leg.minutes,
  })
  const steps: StepRow[] = s.legs.flatMap((leg, i): StepRow[] => [
    ...(leg.walk_before_minutes != null && leg.walk_before_minutes > 0
      ? [{ id: `w${i}`, mapKey: null, color: WALK_COLOR, dashed: true, minutes: leg.walk_before_minutes, what: t('drawer.walk'), to: leg.departure_stop_name }]
      : []),
    {
      id: `r${i}`,
      // The map doesn't draw these legs.
      mapKey: null,
      color: leg.operator ? SHUTTLE_COLOR : lineColorFor(asLeg(leg), plan.nearby.stops),
      minutes: leg.minutes,
      about: !!leg.operator && s.ride_estimated,
      what: leg.operator ? leg.line : rideName(asLeg(leg), t),
      to: leg.arrival_stop_name,
    },
  ])
  if (s.walk_from_minutes > 0) steps.push({ id: 'wend', mapKey: null, color: WALK_COLOR, dashed: true, minutes: s.walk_from_minutes, what: t('drawer.walk'), to: office })
  const whoRides = s.eligible_because === 'public'
    ? t('drawer.who_public')
    : s.eligible_because === 'public_fare'
      ? t('drawer.who_public_fare')
      : s.eligible_because === 'school'
        ? t('drawer.who_school', { id: s.operator.id_name ?? s.operator.label })
        : s.eligible_because === 'self_reported'
          ? t('drawer.who_self')
          : t('drawer.who_employer', { company: who(companyName, t) })
  const runBy = s.operator.run_by || s.operator.name
  return (
    <>
      <Itinerary steps={steps} highlightedLeg={null} onLegTap={() => {}} locale={locale} />
      <P>
        {s.leave_by && <>{rich(t('drawer.transfer_leave'), { time: <b>{formatClock(s.leave_by, locale)}</b> })} </>}
        {s.shuttle_depart_at && <>{rich(t('drawer.transfer_shuttle_at', { stop: s.board_stop.name }), { time: <b>{formatClock(s.shuttle_depart_at, locale)}</b> })} </>}
        {whoRides} {t('drawer.transfer_tail', { name: runBy })}
      </P>
      {s.operator.url && (
        <DrawerActions><ActionLink href={s.operator.url}>{t('drawer.schedule', { name: runBy })}</ActionLink></DrawerActions>
      )}
    </>
  )
}

/** A shuttle the employer entered among its benefits. */
export function EmployerShuttleDrawer({ route, companyName, locale = 'en' }: { route: ShuttleRoute; companyName: string | null; locale?: SiteLocale }) {
  const t = tFor(locale)
  return (
    <>
      {/* The schedule and details are the employer's own words, as written. */}
      <P>
        {route.from_stop ? t('drawer.emp_shuttle_from', { company: who(companyName, t), stop: route.from_stop }) : t('drawer.emp_shuttle', { company: who(companyName, t) })}{route.schedule ? ` ${route.schedule.replace(/\.?$/, '.')}` : ''}
      </P>
      {route.details && <P muted>{route.details}</P>}
    </>
  )
}
