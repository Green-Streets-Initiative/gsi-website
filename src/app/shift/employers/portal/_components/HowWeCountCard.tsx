// No 'use client': HOW_WE_COUNT is also printed by the report page on the
// server. The card itself only renders Card.
import { Card, CardHead, CardBody } from '@/components/employer/Card'

export type HowWeCountItem = { title: string; body: string }

/** The EPA factors the database uses (Emission Factors Hub 2025, Table 10). */
export const EPA_FACTOR_LINE =
  "Emission factors from the EPA's 2025 Emission Factors Hub (Table 10), in kg of CO₂e per mile. Car driven alone: 0.297 for gas, 0.191 for a hybrid, 0.120 for an electric car, by the car each person told Shift they drive. Per rider: bus 0.066, subway and light rail 0.093, commuter rail and ferry 0.133."

/** The method behind the plain kg figure, when the database sends only that one. */
export const LEGACY_CO2_LINE =
  'CO₂ avoided is every mile not driven × 0.404 kg, the fleet-average figure for a gasoline car.'

/** Definitions in plain words, in the order the page shows its numbers. */
export const HOW_WE_COUNT: HowWeCountItem[] = [
  {
    title: 'What counts',
    body: "Trips recorded by the Shift app and confirmed by the employee, for people who have joined your workplace in the app. Nothing is estimated for employees who aren't on Shift, so these numbers describe your team on Shift, not the whole company.",
  },
  {
    title: 'Shift Rate',
    body: 'The share of recorded trips made by walking, biking, scooter or transit instead of driving. A carpool counts as a shared car trip: it lowers emissions but is not an active trip.',
  },
  {
    title: 'Drive-alone share',
    body: 'The share of recorded trips that were driving alone. Commuter programs such as MassDEP Rideshare and Best Workplaces for Commuters track this number, so it is here in the same terms.',
  },
  {
    title: 'Participation',
    body: 'Employees who have joined your workplace on Shift, divided by the headcount you gave on the Setup page. No headcount, no percentage.',
  },
  {
    title: 'Emissions shifted',
    body: "The share of your team's recorded miles made without driving alone, weighted by what each trip would have emitted: emissions avoided divided by emissions avoided plus emissions still produced. Ground trips only; Shift doesn't track flights. It is the same framing employees see in the app, and it appears once there are enough recorded trips to be meaningful.",
  },
  {
    title: 'CO₂e avoided',
    body: "For each active trip, the emissions of driving that distance alone minus the emissions of the way the person actually went. Walking, biking and scooters count as zero. For a bus or train trip we subtract that vehicle's emissions per rider over the same miles, and a carpool counts as half a car. Added up over the period, in kilograms (tonnes from 1,000 kg). It is an avoided-emissions figure: report it alongside your Scope 3 employee-commuting inventory, not inside it.",
  },
  {
    title: 'Compared with the period before',
    body: 'The same length of time immediately before this period, counted the same way.',
  },
  {
    title: 'Compared to other workplaces',
    body: 'Medians across the other workplaces on Shift with five or more members and at least one recorded trip in the same period. Your percentile is the share of those workplaces you are above. No names or ranks are shared in either direction.',
  },
]

/**
 * How every number on the Impact page is counted, in plain words, with the
 * emission factors and their source; `legacy` describes the plain 0.404 kg
 * method when that is the figure on the page.
 */
export default function HowWeCountCard({ legacy = false }: { legacy?: boolean }) {
  return (
    <Card id="how-we-count">
      <CardHead title="How we count" sub="What each figure means and where the factors come from" />
      <CardBody>
        <dl className="grid gap-4 sm:grid-cols-2">
          {HOW_WE_COUNT.map((item) => (
            <div key={item.title}>
              <dt className="text-[13.5px] font-bold text-ink">{item.title}</dt>
              <dd className="mt-1 text-[13px] leading-[1.55] text-ink-muted">{item.body}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 border-t border-line pt-4 text-[12.5px] leading-[1.55] text-ink-tertiary">
          {legacy ? LEGACY_CO2_LINE : EPA_FACTOR_LINE}
        </p>
      </CardBody>
    </Card>
  )
}
