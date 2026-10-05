'use client'

import type { EmployerGroup, EmployerBenefits, RecommendationResponse } from '@/lib/types/commute'
import { PRICES } from '@/lib/facts/prices'

/*
 * The one-page commute plan a person can save as a PDF from the employer
 * Commute Advisor results (Keith 2026-09-30). Hidden on screen; the print
 * rules below show only this block and hide the nav, the on-screen results
 * and the footer. Street-sign look: Overpass headline on a forest panel,
 * Trebuchet body, cream page, navy text.
 *
 * Privacy: the start is shown as street and town only (the house number is
 * stripped), and nothing here is sent anywhere; it is rendered from the
 * results already in the browser.
 */

type TransitStep = {
  lineName: string
  lineShortName: string
  vehicleType: string
  numStops: number
  departureStop: string
  arrivalStop: string
}
type RouteResult = { durationMins: number; distanceMiles: number; transitSteps?: TransitStep[] } | null
type RouteResponse = { routes: Record<string, RouteResult>; cached: boolean }

interface Props {
  group: EmployerGroup
  benefits: EmployerBenefits
  recommendation: RecommendationResponse
  routeData: RouteResponse | null
  homeAddress: string
  workAddress: string
  /** The office's name when the employer has several. */
  locationName?: string | null
  /** Days a week the person commutes; drives the yearly CO2 figure. */
  driveDays: number
  joinLink: string | null
}

const WORKDAYS_PER_MONTH = 20
const WEEKS = 52
/** kg CO2 per mile, EPA GHG Emission Factors Hub 2025 Table 10: a gas car
 *  driven alone (0.297 per vehicle-mile) and what each other way emits per
 *  passenger-mile. Matches employer_trip_co2_avoided_kg on the Impact page. */
const DRIVE_ALONE_KG_PER_MILE = 0.297
const MODE_KG_PER_MILE: Record<string, number> = {
  bus: 0.066,
  transit: 0.093,
  commuter_rail: 0.133,
  ferry: 0.133,
  carpool: 0.297 / 2,
  rideshare: 0.297,
  walk: 0,
  bike: 0,
  ebike: 0,
  escooter: 0,
}
/** Yearly kg CO2 saved by taking `mode` instead of driving alone, floored at 0. */
function co2SavedPerYear(mode: string, annualMiles: number): number {
  const used = MODE_KG_PER_MILE[mode] ?? DRIVE_ALONE_KG_PER_MILE
  return Math.max(0, DRIVE_ALONE_KG_PER_MILE - used) * annualMiles
}
/** A pre-tax transit benefit is worth the tax it saves, about 30%. Same rule as the on-screen savings. */
const PRE_TAX_VALUE_SHARE = 0.3

const MODE_NAMES: Record<string, string> = {
  walk: 'Walking',
  bike: 'Biking',
  ebike: 'E-bike',
  transit: 'Bus or train',
  bus: 'Bus',
  drive: 'Driving alone',
}

const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString()}`
const fmtCO2 = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg`)

/** "123A Main St, Somerville, MA 02143, USA" becomes "Main St, Somerville". */
export function streetAndTown(address: string): string {
  const parts = address
    .replace(/^\s*\d+[A-Za-z]?(?:-\d+)?\s+/, '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.slice(0, 2).join(', ')
}

function firstTwoParts(address: string): string {
  return address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(', ')
}

function formatStep(step: TransitStep): string {
  const vType = step.vehicleType === 'BUS' ? 'Bus' : step.vehicleType === 'COMMUTER_RAIL' ? 'Commuter Rail' : ''
  const name = step.lineShortName || step.lineName
  return vType ? `${vType} ${name}` : name
}

function clip(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40))}...`
}

export default function CommutePlanPrint({
  group,
  benefits,
  recommendation,
  routeData,
  homeAddress,
  workAddress,
  locationName,
  driveDays,
  joinLink,
}: Props) {
  // Times from Google routing when we have them, the same override the screen uses.
  const googleTimes: Record<string, number> = {}
  if (routeData?.routes) {
    if (routeData.routes.DRIVE) googleTimes.drive = routeData.routes.DRIVE.durationMins + 5
    if (routeData.routes.BICYCLE) {
      googleTimes.bike = routeData.routes.BICYCLE.durationMins
      googleTimes.ebike = Math.round(routeData.routes.BICYCLE.durationMins * 0.75)
    }
    if (routeData.routes.WALK) googleTimes.walk = routeData.routes.WALK.durationMins
    if (routeData.routes.TRANSIT) googleTimes.transit = routeData.routes.TRANSIT.durationMins
  }
  const transitSteps = routeData?.routes?.TRANSIT?.transitSteps
  const transitLabel =
    transitSteps && transitSteps.length > 0
      ? transitSteps.length === 1
        ? `${formatStep(transitSteps[0])} from ${transitSteps[0].departureStop}`
        : transitSteps.map(formatStep).join(' to ')
      : null

  const primaryMode = recommendation.primary.modes[0] ?? 'drive'
  const primaryLabel =
    recommendation.primary.label === 'MBTA Transit'
      ? (transitLabel ?? 'Bus or train')
      : recommendation.primary.label
  const primaryTime = googleTimes[primaryMode] ?? recommendation.primary.time_estimate_minutes

  // Yearly miles the trip replaces, for the CO2 column.
  const annualMiles = recommendation.distance_miles * 2 * driveDays * WEEKS
  const co2PerYear = co2SavedPerYear(primaryMode, annualMiles)

  // Monthly cost with this employer's benefits applied.
  const subsidyMonthly =
    benefits.transit_subsidy_monthly && benefits.transit_subsidy_monthly > 0
      ? benefits.transit_subsidy_monthly * (benefits.transit_subsidy_type === 'pre_tax' ? PRE_TAX_VALUE_SHARE : 1)
      : 0
  function monthlyWithBenefits(mode: string, dailyCost: number): number {
    let monthly = dailyCost * WORKDAYS_PER_MONTH
    if ((mode === 'transit' || mode === 'bus') && subsidyMonthly > 0) monthly = Math.max(0, monthly - subsidyMonthly)
    if ((mode === 'bike' || mode === 'ebike') && benefits.bluebikes_subsidized) monthly = 0
    return monthly
  }

  const options = recommendation.comparisons.slice(0, 5).map((c) => ({
    mode: c.mode,
    label: c.mode === 'transit' && c.label === 'MBTA Transit' ? (transitLabel ?? 'Bus or train') : (MODE_NAMES[c.mode] ?? c.label),
    minutes: googleTimes[c.mode] ?? c.time_minutes,
    monthly: monthlyWithBenefits(c.mode, c.daily_cost),
    co2: c.mode === 'drive' ? null : co2SavedPerYear(c.mode, annualMiles),
  }))
  const primaryOption = options.find((o) => o.mode === primaryMode)
  const primaryMonthly = primaryOption ? primaryOption.monthly : recommendation.primary.cost_estimate_daily * WORKDAYS_PER_MONTH

  // The employer's perks, the same list the results page shows.
  const perks: string[] = []
  if (benefits.transit_subsidy_monthly && benefits.transit_subsidy_monthly > 0) {
    perks.push(benefits.transit_subsidy_label || `$${benefits.transit_subsidy_monthly} a month toward transit`)
  }
  if (benefits.bluebikes_subsidized) perks.push(benefits.bluebikes_subsidy_label || 'Bluebikes membership covered')
  if (benefits.bike_parking) perks.push(benefits.bike_parking_details ? `Bike parking: ${benefits.bike_parking_details}` : 'Bike parking at the office')
  if (benefits.showers) perks.push(benefits.shower_details ? `Showers: ${benefits.shower_details}` : 'Showers at the office')
  for (const r of benefits.shuttle_routes ?? []) {
    if (r.name || r.from_stop) perks.push(`Free shuttle from ${r.from_stop || r.name}${r.schedule ? `, ${r.schedule}` : ''}`)
  }
  if (benefits.other_benefits?.trim()) perks.push(benefits.other_benefits.trim())

  // First week: three concrete steps. The mode step first, then the guide
  // and event the advisor already fetched for this mode, then the team.
  const steps: string[] = []
  const eachWay = primaryTime ? ` It takes about ${primaryTime} minutes each way.` : ''
  if (primaryMode === 'transit' || primaryMode === 'bus') {
    steps.push(`Try it once on a day with no early meetings: ${primaryLabel}.${eachWay}`)
    steps.push(
      `Set up a CharlieCard or the MBTA Go app before the first trip. A monthly LinkPass is $${PRICES.mbta.linkPassMonthly}${
        subsidyMonthly > 0 ? `, before the ${group.name} transit benefit` : ''
      }.`,
    )
  } else if (primaryMode === 'bike' || primaryMode === 'ebike') {
    const station = recommendation.map_data.bluebikes_origin[0]
    if (station) {
      steps.push(`Your nearest Bluebikes station is ${station.name}, ${station.distance_miles.toFixed(1)} miles from home. Try a ride there first.`)
    } else {
      steps.push('Check the bike before the first ride: tires, brakes, lights and a lock.')
    }
    steps.push(`Ride the route once on a quiet day.${eachWay}`)
  } else if (primaryMode === 'walk') {
    steps.push(`Walk it once at the weekend to learn the way.${eachWay}`)
    steps.push('Keep a pair of comfortable shoes at your desk for the way home.')
  } else {
    steps.push(`Pick one day this week to try ${options.find((o) => o.mode !== 'drive')?.label.toLowerCase() ?? 'another way in'}.`)
  }
  const guide = recommendation.content.guide
  if (guide) steps.push(`Read the guide "${guide.title}": ${clip(guide.summary, 120)}`)
  const event = recommendation.content.event
  if (event) {
    const when = new Date(event.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    steps.push(`Try it with others on ${when}: ${event.content_items.title}${event.location_name ? `, ${event.location_name}` : ''}.`)
  }
  if (group.invite_code) {
    steps.push(`Join ${group.name} on Shift with team code ${group.invite_code} so every trip counts toward the team challenge.`)
  }
  const firstWeek = steps.slice(0, 3)

  const preparedOn = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const start = streetAndTown(homeAddress)
  const office = locationName ? `${locationName}, ${firstTwoParts(workAddress)}` : firstTwoParts(workAddress)

  return (
    <div className="commute-plan-print hidden" aria-hidden="true">
      <style>{`
        @media print {
          @page { size: letter; margin: 0.4in 0.5in; }
          body * { visibility: hidden; }
          .commute-plan-print, .commute-plan-print * { visibility: visible; }
          .commute-plan-print { display: block !important; position: absolute; left: 0; top: 0; width: 100%; }
          .advisor-root > :not(.commute-plan-print) { display: none !important; }
          [data-nextjs-toast], nextjs-portal { display: none !important; }
          .commute-plan-print .plan-section { break-inside: avoid; }
        }
        .commute-plan-print { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      <article className="mx-auto max-w-[8.5in] bg-[#F4F8EE] px-2 py-2 text-[#191A2E]" style={{ fontFamily: 'var(--font-gsi)' }}>
        {/* Header: employer and the plan's name */}
        <header className="plan-section mb-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {group.logo_url ? (
              <div className="flex h-[44px] items-center rounded-lg bg-white px-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={group.logo_url} alt={group.name} className="h-[28px] w-auto max-w-[150px] object-contain" />
              </div>
            ) : (
              <span className="text-[17px] font-bold">{group.name}</span>
            )}
            <span className="text-[13px] text-[#4A4D68]">Commute plan · prepared with Shift</span>
          </div>
          <p className="text-[15px] leading-none">
            <span className="font-bold">Green Streets</span> Initiative
          </p>
        </header>

        {/* From and to */}
        <section className="plan-section mb-3 grid grid-cols-2 gap-4 rounded-[14px] border border-[rgba(25,26,46,0.12)] bg-white px-5 py-3.5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#4A4D68]">Start</p>
            <p className="mt-0.5 text-[14px] font-semibold">{start || 'Home'}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#4A4D68]">Office</p>
            <p className="mt-0.5 text-[14px] font-semibold">{office || group.name}</p>
          </div>
        </section>

        {/* The recommendation */}
        <section className="plan-section mb-3 rounded-[18px] bg-[#2D6A4F] px-6 pb-5 pt-5 text-white">
          <p className="text-[13px] font-semibold text-white">The recommended way to get there</p>
          <h1 className="mt-1 font-headline text-[32px] font-extrabold leading-[1.05] tracking-[-0.01em] text-white">
            {primaryLabel}
          </h1>
          <p className="mt-2.5 text-[15px] leading-[1.45] text-white">
            About {primaryTime} minutes each way · {primaryMonthly === 0 ? 'Free' : `${fmtMoney(primaryMonthly)} a month`} with your{' '}
            {group.name} benefits · {fmtCO2(co2PerYear)} CO₂ a year less than driving alone
          </p>
          <p className="mt-1.5 text-[12.5px] text-white">
            {recommendation.distance_miles.toFixed(1)} miles each way, {driveDays} days a week.
          </p>
        </section>

        {/* Options table */}
        <section className="plan-section mb-3 rounded-[14px] border border-[rgba(25,26,46,0.12)] bg-white px-5 py-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#4A4D68]">Your best options</p>
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[11.5px] font-semibold text-[#4A4D68]">
                <th className="pb-1.5 font-semibold">How</th>
                <th className="pb-1.5 text-right font-semibold">Each way</th>
                <th className="pb-1.5 text-right font-semibold">A month, with benefits</th>
                <th className="pb-1.5 text-right font-semibold">CO₂ a year vs driving alone</th>
              </tr>
            </thead>
            <tbody>
              {options.map((o) => (
                <tr key={o.mode} className={`border-t border-[rgba(25,26,46,0.1)] ${o.mode === primaryMode ? 'font-bold' : ''}`}>
                  <td className="py-1.5 pr-3">
                    {o.label}
                    {o.mode === primaryMode && <span className="ml-2 rounded-full bg-[#E7F0EA] px-2 py-0.5 text-[10px] font-bold uppercase text-[#2D6A4F]">Best</span>}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right">{o.minutes} min</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right">{o.monthly === 0 ? 'Free' : fmtMoney(o.monthly)}</td>
                  <td className="whitespace-nowrap py-1.5 text-right">{o.co2 == null ? 'baseline' : `${fmtCO2(o.co2)} less`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="mb-3 grid grid-cols-2 gap-3">
          {/* Perks */}
          <section className="plan-section rounded-[14px] border border-[rgba(25,26,46,0.12)] bg-white px-5 py-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#4A4D68]">What {group.name} offers</p>
            {perks.length > 0 ? (
              <ul className="grid gap-1.5 text-[13px] leading-[1.4]">
                {perks.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2D6A4F]" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-[#4A4D68]">Ask HR what commute benefits apply to you.</p>
            )}
          </section>

          {/* First week */}
          <section className="plan-section rounded-[14px] border border-[rgba(45,106,79,0.25)] bg-[#E7F0EA] px-5 py-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#2D6A4F]">Your first week</p>
            <ol className="grid gap-2 text-[13px] leading-[1.4]">
              {firstWeek.map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2D6A4F] text-[11px] font-bold text-white">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Team and HR */}
        <section className="plan-section mb-3 grid grid-cols-2 gap-4 rounded-[14px] border border-[rgba(25,26,46,0.12)] bg-white px-5 py-3.5 text-[13px]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#4A4D68]">Join {group.name} on Shift</p>
            {group.invite_code && joinLink ? (
              <>
                <p className="mt-0.5">
                  Team code <span className="font-mono font-bold tracking-wide">{group.invite_code}</span>
                </p>
                <p className="text-[#4A4D68]">{joinLink.replace(/^https?:\/\//, '')}</p>
              </>
            ) : (
              <p className="mt-0.5 text-[#4A4D68]">Download Shift at gogreenstreets.org/shift</p>
            )}
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#4A4D68]">Questions about benefits</p>
            {benefits.hr_contact_name || benefits.hr_contact_email ? (
              <p className="mt-0.5">
                {benefits.hr_contact_name}
                {benefits.hr_contact_name && benefits.hr_contact_email ? ' · ' : ''}
                {benefits.hr_contact_email}
              </p>
            ) : (
              <p className="mt-0.5 text-[#4A4D68]">Ask your HR team.</p>
            )}
          </div>
        </section>

        <footer className="text-[11.5px] text-[#4A4D68]">
          Green Streets Initiative · gogreenstreets.org · prepared {preparedOn}. Times and costs are estimates;
          CO₂ is what you save against driving the same miles alone, net of the bus or train you take, using EPA 2025 factors.
        </footer>
      </article>
    </div>
  )
}
