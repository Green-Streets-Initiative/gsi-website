'use client'

import type { EmployerGroup, EmployerBenefits, AdvisorResult, Motivation } from '@/lib/types/commute'
import { PRICES } from '@/lib/facts/prices'
import { bikeShareBenefitLine } from '@/lib/employer/bike-share'
import {
  WORKDAYS,
  fmtMoney,
  formatClock,
  formatCo2Share,
  formatEventDate,
  headlineFor,
  modeName,
  modeOrderFor,
} from '@/lib/employer/commute-costs'

/*
 * The one-page commute plan a person can save as a PDF from the employer
 * Commute Advisor results (Keith 2026-09-30; v2 2026-10-05). Hidden on
 * screen; the print rules below show only this block and hide the nav, the
 * on-screen results and the footer. Street-sign look: Overpass headline on
 * a forest panel, Trebuchet body, cream page, navy text.
 *
 * Every number comes from the AdvisorResult the route built with
 * src/lib/employer/commute-costs.ts, so the page, the table and the PDF
 * agree. Emissions appear only as the share shifted, nothing under 10%;
 * no kg, no tons, no contrast with driving alone.
 *
 * Privacy: the start is shown as street and town only (the house number is
 * stripped), and nothing here is sent anywhere; it is rendered from the
 * results already in the browser.
 */

interface Props {
  group: EmployerGroup
  benefits: EmployerBenefits
  recommendation: AdvisorResult
  homeAddress: string
  workAddress: string
  /** The office's name when the employer has several. */
  locationName?: string | null
  /** Days a week the person commutes. */
  driveDays: number
  joinLink: string | null
  /** The "what matters most" chip, if one is on; orders the rows and frames the headline. */
  motivation?: Motivation | null
}

/** A pre-tax transit benefit is worth the tax it saves, about 30%. Same rule as the on-screen savings. */
const PRE_TAX_VALUE_SHARE = 0.3
const WORKDAYS_PER_MONTH = WORKDAYS / 12

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

function clip(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40))}...`
}

const fmtDay = (n: number) => (n <= 0 ? 'Free' : `$${n.toFixed(2).replace(/\.00$/, '')}`)

export default function CommutePlanPrint({
  group,
  benefits,
  recommendation,
  homeAddress,
  workAddress,
  locationName,
  driveDays,
  joinLink,
  motivation = null,
}: Props) {
  const { modes, transit_legs: legs, costs } = recommendation
  const primaryMode = modes[recommendation.recommended_mode] ? recommendation.recommended_mode : recommendation.mode_order[0]
  const primary = modes[primaryMode]

  // "Red Line from Davis to Park Street" for transit, the mode's name otherwise.
  const transitLabel =
    legs.length > 0
      ? legs.length === 1
        ? `${legs[0].route_name} from ${legs[0].departure_stop_name}`
        : legs.map((l) => l.route_name).filter(Boolean).join(' to ')
      : recommendation.transit_summary
  const labelFor = (mode: string) => (mode === 'transit' && transitLabel ? transitLabel : modeName(mode))

  // A day's cost with this employer's benefits applied.
  const subsidyMonthly =
    benefits.transit_subsidy_monthly && benefits.transit_subsidy_monthly > 0
      ? benefits.transit_subsidy_monthly * (benefits.transit_subsidy_type === 'pre_tax' ? PRE_TAX_VALUE_SHARE : 1)
      : 0
  function dayWithBenefits(mode: string, costPerDay: number): number {
    let day = costPerDay
    if ((mode === 'transit' || mode === 'bus') && subsidyMonthly > 0) day = Math.max(0, day - subsidyMonthly / WORKDAYS_PER_MONTH)
    if ((mode === 'bike' || mode === 'ebike') && benefits.bikeshare_subsidized) day = 0
    return Math.round(day * 100) / 100
  }

  const rows = modeOrderFor(motivation, modes).map((mode) => {
    const m = modes[mode]
    return {
      mode,
      label: labelFor(mode),
      leaveBy: m.leave_by ? formatClock(m.leave_by) : null,
      minutes: m.minutes,
      minutesMax: mode === 'drive' ? m.minutes_max ?? null : null,
      day: dayWithBenefits(mode, m.cost_per_day),
      share: formatCo2Share(m.emissions_share_pct),
    }
  })
  const primaryRow = rows.find((r) => r.mode === primaryMode)
  const headline = recommendation.headline || headlineFor(recommendation, motivation)
  const arriveBy = recommendation.arrive_by ? formatClock(recommendation.arrive_by) : null

  // The employer's perks, the same list the results page shows.
  const perks: string[] = []
  if (benefits.transit_subsidy_monthly && benefits.transit_subsidy_monthly > 0) {
    perks.push(benefits.transit_subsidy_label || `$${benefits.transit_subsidy_monthly} a month toward transit`)
  }
  if (benefits.bikeshare_subsidized) perks.push(bikeShareBenefitLine(benefits, group.name))
  if (benefits.bike_parking) perks.push(benefits.bike_parking_details ? `Bike parking: ${benefits.bike_parking_details}` : 'Bike parking at the office')
  if (benefits.showers) perks.push(benefits.shower_details ? `Showers: ${benefits.shower_details}` : 'Showers at the office')
  for (const r of benefits.shuttle_routes ?? []) {
    if (r.name || r.from_stop) perks.push(`Free shuttle from ${r.from_stop || r.name}${r.schedule ? `, ${r.schedule}` : ''}`)
  }
  if (benefits.other_benefits?.trim()) perks.push(benefits.other_benefits.trim())

  // First week: three concrete steps. The mode step first, then the guide
  // and event the advisor already fetched for this mode, then the team.
  const steps: string[] = []
  const eachWay = primary?.minutes ? ` It takes about ${primary.minutes} minutes each way.` : ''
  const leaveBy = primary?.leave_by ? ` Leave by ${formatClock(primary.leave_by)}${arriveBy ? ` to arrive by ${arriveBy}` : ''}.` : ''
  if (primaryMode === 'transit' || primaryMode === 'bus') {
    steps.push(`Try it once on a day with no early meetings: ${labelFor(primaryMode)}.${leaveBy}${eachWay}`)
    steps.push(
      `Set up a CharlieCard or the MBTA Go app before the first trip. A monthly LinkPass is $${PRICES.mbta.linkPassMonthly}${
        subsidyMonthly > 0 ? `, before the ${group.name} transit benefit` : ''
      }.`,
    )
  } else if (primaryMode === 'bike' || primaryMode === 'ebike') {
    const dock = recommendation.nearby.docks_home[0]
    if (dock) {
      steps.push(`Your nearest Bluebikes station is ${dock.name}, ${dock.distance_miles.toFixed(1)} miles from home. Try a ride there first.`)
    } else {
      steps.push('Check the bike before the first ride: tires, brakes, lights and a lock.')
    }
    steps.push(`Ride the route once on a quiet day.${leaveBy}${eachWay}`)
  } else if (primaryMode === 'walk') {
    steps.push(`Walk it once at the weekend to learn the way.${leaveBy}${eachWay}`)
    steps.push('Keep a pair of comfortable shoes at your desk for the way home.')
  } else {
    steps.push(`Pick one day this week to try ${rows.find((o) => o.mode !== 'drive')?.label.toLowerCase() ?? 'another way in'}.`)
  }
  const guide = recommendation.guide
  if (guide) steps.push(`Read the guide "${guide.title}": ${clip(guide.summary, 120)}`)
  const event = recommendation.event
  if (event) {
    steps.push(`Try it with others on ${formatEventDate(event.event_date)}: ${event.content_items.title}${event.location_name ? `, ${event.location_name}` : ''}.`)
  }
  if (group.invite_code) {
    steps.push(`Join ${group.name} on Shift with invite code ${group.invite_code} so every trip counts toward the team challenge.`)
  }
  const firstWeek = steps.slice(0, 3)

  const preparedOn = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const start = streetAndTown(homeAddress)
  const office = locationName ? `${locationName}, ${firstTwoParts(workAddress)}` : firstTwoParts(workAddress)
  const anyShare = rows.some((r) => r.share)

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

        {/* From, to and when */}
        <section className={`plan-section mb-3 grid ${arriveBy ? 'grid-cols-3' : 'grid-cols-2'} gap-4 rounded-[14px] border border-[rgba(25,26,46,0.12)] bg-white px-5 py-3.5`}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#4A4D68]">Start</p>
            <p className="mt-0.5 text-[14px] font-semibold">{start || 'Home'}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#4A4D68]">Office</p>
            <p className="mt-0.5 text-[14px] font-semibold">{office || group.name}</p>
          </div>
          {arriveBy && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#4A4D68]">Arrive by</p>
              <p className="mt-0.5 text-[14px] font-semibold">{arriveBy}</p>
            </div>
          )}
        </section>

        {/* The recommendation */}
        <section className="plan-section mb-3 rounded-[18px] bg-[#2D6A4F] px-6 pb-5 pt-5 text-white">
          <p className="text-[13px] font-semibold text-white">The recommended way to get there</p>
          <h1 className="mt-1 font-headline text-[32px] font-extrabold leading-[1.05] tracking-[-0.01em] text-white">
            {labelFor(primaryMode)}
          </h1>
          {headline && <p className="mt-2.5 text-[15px] leading-[1.45] text-white">{headline}</p>}
          <p className="mt-1.5 text-[12.5px] text-white">
            {primaryRow?.minutes != null && (
              <>About {primaryRow.minutes}{primaryRow.minutesMax != null && primaryRow.minutesMax > primaryRow.minutes ? ` to ${primaryRow.minutesMax}` : ''} minutes each way · </>
            )}
            {primaryRow ? `${fmtDay(primaryRow.day)} a day with your ${group.name} benefits · ` : ''}
            {recommendation.distance_miles.toFixed(1)} miles each way, {driveDays} days a week.
          </p>
        </section>

        {/* Options table */}
        <section className="plan-section mb-3 rounded-[14px] border border-[rgba(25,26,46,0.12)] bg-white px-5 py-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#4A4D68]">Your options{arriveBy ? `, arriving by ${arriveBy}` : ''}</p>
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[11.5px] font-semibold text-[#4A4D68]">
                <th className="pb-1.5 font-semibold">How</th>
                <th className="pb-1.5 text-right font-semibold">Leave by</th>
                <th className="pb-1.5 text-right font-semibold">Each way</th>
                <th className="pb-1.5 text-right font-semibold">A day, with benefits</th>
                {anyShare && <th className="pb-1.5 text-right font-semibold">Commute emissions shifted</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.mode} className={`border-t border-[rgba(25,26,46,0.1)] ${o.mode === primaryMode ? 'font-bold' : ''}`}>
                  <td className="py-1.5 pr-3">
                    {o.label}
                    {o.mode === primaryMode && <span className="ml-2 rounded-full bg-[#E7F0EA] px-2 py-0.5 text-[10px] font-bold uppercase text-[#2D6A4F]">Best</span>}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right">{o.leaveBy ?? '—'}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right">
                    {o.minutes == null ? '—' : o.minutesMax != null && o.minutesMax > o.minutes ? `${o.minutes} to ${o.minutesMax} min` : `${o.minutes} min`}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right">{fmtDay(o.day)}</td>
                  {anyShare && (
                    <td className="whitespace-nowrap py-1.5 text-right">{o.share ? o.share.replace(/^shifts /, '') : ''}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {costs.parking_per_day > 0 && (
            <p className="mt-2 text-[11.5px] text-[#4A4D68]">Driving includes {fmtMoney(costs.parking_per_day)} a day parking.</p>
          )}
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
                  Invite code <span className="font-mono font-bold tracking-wide">{group.invite_code}</span>
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
          Green Streets Initiative · gogreenstreets.org · prepared {preparedOn}. Times and costs are estimates
          {costs.gas_price ? ` at $${costs.gas_price.toFixed(2)} a gallon` : ''}; emissions are the share of your own commute
          emissions each way shifts, using EPA 2025 factors.
        </footer>
      </article>
    </div>
  )
}
