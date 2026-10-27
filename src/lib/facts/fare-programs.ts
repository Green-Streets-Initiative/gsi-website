import { PRICES, usd } from './prices'

/**
 * MBTA and Bluebikes fare programs: who qualifies, what it gives, how to
 * apply. Checked on each program's own page 2026-10-27 (mbta.com/fares/reduced,
 * /fares/2026-fall-fare-pilots, /fares/reduced/income-eligible,
 * /pass-program/semester, /fares/commuter-rail-summer-promotions) and in the
 * 2026-10-05 sweep (Shift docs/programs/product/research/
 * 2026-10-05-help-getting-around-providers.md). Prices come from prices.json,
 * so the monthly freshness check keeps them current. `until` drops a program
 * the day it ends. The assistant reads these (get_fare_help) and links each
 * by id, so it never writes an address itself.
 */
export type FareProgram = {
  id: string
  name: string
  who: string
  gives: string
  apply: string
  url: string
  /** First day it no longer applies (YYYY-MM-DD). */
  until?: string
}

const m = PRICES.mbta
const bb = PRICES.bluebikes
const reduced = `${usd(m.reducedSubway)} subway, ${usd(m.reducedBus)} bus, ${usd(m.reducedLinkPass)} monthly LinkPass, $10 7-day LinkPass, and reduced Commuter Rail and ferry`

const PROGRAMS: FareProgram[] = [
  {
    id: 'car_free_seniors',
    name: 'Car-Free Seniors',
    who: 'Massachusetts residents 75 and over who no longer drive and hold an RMV-issued Mass ID (an ID card, not a license)',
    gives: 'Free MBTA bus, subway, Commuter Rail and ferry',
    apply: 'Online through the MBTA, or in person at the Charlie Service Center, 296 Washington St, Boston (temporary card the same day). No Mass ID yet: it costs $25 at an RMV appointment and needs no valid license. Someone 75+ without one can get a Senior CharlieCard meanwhile.',
    url: 'https://www.mbta.com/fares/2026-fall-fare-pilots',
  },
  {
    id: 'senior',
    name: 'Senior CharlieCard',
    who: 'Age 65 and over',
    gives: `About half off: ${reduced}`,
    apply: 'Online in MyCharlie (7 to 10 business days), or in person at the Charlie Service Center with a photo ID. Phone 617-222-3200.',
    url: 'https://www.mbta.com/fares/reduced/senior-charliecard',
  },
  {
    id: 'tap',
    name: 'Transportation Access Pass (TAP)',
    who: 'People with a disability, or anyone with a Medicare card',
    gives: `About half off: ${reduced}`,
    apply: 'Online in MyCharlie, or at the Charlie Service Center with a photo ID and proof (a Medicare card, a disability placard, a form from a health care provider, or a RIDE ID).',
    url: 'https://www.mbta.com/fares/reduced/transportation-access-pass',
  },
  {
    id: 'blind_access',
    name: 'Blind Access CharlieCard',
    who: 'People who are legally blind',
    gives: 'Free MBTA bus, subway, Commuter Rail and ferry; one guide rides free too',
    apply: 'Online in MyCharlie, or at the Charlie Service Center (temporary card the same day). Bring proof such as a Massachusetts Commission for the Blind ID.',
    url: 'https://www.mbta.com/fares/reduced/blind-access-charliecard',
  },
  {
    id: 'income_eligible',
    name: 'Income-Eligible Reduced Fare',
    who: 'Massachusetts residents 18 to 64 enrolled in SNAP, MassHealth (Standard, CarePlus, Family Assistance or Limited), TAFDC, EAEDC or MASSGrant',
    gives: `About half off: ${reduced}`,
    apply: 'Online in MyCharlie (often approved right away), at the Charlie Service Center, or with one-on-one help at a partner site such as ABCD or a community action agency. Bring a photo ID and proof of the benefit. Phone 617-222-3200. Renew every year.',
    url: 'https://www.mbta.com/fares/reduced/income-eligible',
  },
  {
    id: 'college_semester',
    name: 'Semester pass through your college',
    who: 'College and grad students at schools in the MBTA Semester Pass program (each school decides who qualifies)',
    gives: '11% off monthly or semester MBTA passes',
    apply: "Through the school's transportation or student services office, before the semester starts.",
    url: 'https://www.mbta.com/pass-program/semester',
  },
  {
    id: 'school_student',
    name: 'Student CharlieCard (S-Card or M7)',
    who: 'Middle and high school students at schools in the MBTA Student Pass program',
    gives: 'Reduced or free school-year travel, depending on the card',
    apply: 'Through the school.',
    url: 'https://www.mbta.com/fares/reduced/student-charliecards',
  },
  {
    id: 'kids_free',
    name: 'Children 11 and under',
    who: 'Children 11 and under',
    gives: 'Free on the MBTA; nothing to apply for',
    apply: 'Nothing to do. Groups of 10 or more children register the trip with the field trip form.',
    url: 'https://www.mbta.com/fares/reduced',
  },
  {
    id: 'commuter_rail_half',
    name: 'Half-price monthly Commuter Rail passes',
    who: 'Anyone buying a monthly Commuter Rail or ferry pass (Zones 1 to 10), full or reduced fare',
    gives: "50% off the monthly pass, plus a $1 weekend companion fare for pass holders",
    apply: 'Automatic when buying the monthly pass (mTicket, ticket machines or windows, MyCharlie autopay).',
    url: 'https://www.mbta.com/fares/commuter-rail-summer-promotions',
    until: '2026-12-01',
  },
  {
    id: 'bluebikes_income',
    name: 'Bluebikes Income-Eligible membership',
    who: 'Age 16 and over on SNAP, WIC, MassHealth, Section 8, public housing, SSI/SSDI, LIHEAP, a Pell grant or similar, or with proof of income',
    gives: `Unlimited 60-minute rides on classic bikes for ${usd(bb.incomeEligibleMonthly)} a month or $50 a year ($5 a year for Boston residents); e-bikes ${usd(bb.ebikePerMinIncomeEligible)} a minute`,
    apply: 'Online, or with help at a city enrollment center (Boston, Cambridge, Somerville, Brookline, Watertown).',
    url: 'https://www.bluebikes.com/pricing/income-eligible-program/guided-registration',
  },
]

const lastMonth = new Date(new Date(`${m.transferPilotEnds}T12:00:00Z`).getTime() - 864e5).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** True for everyone, said alongside the programs. */
export const ALWAYS = `Everyone: unlimited bus, subway and ferry transfers within 2 hours for one fare (a pilot through ${lastMonth}; pay the same way each time). Full fares are ${usd(m.subwaySingle)} subway and ${usd(m.busSingle)} bus. Buses run by the regional transit authorities outside the MBTA are free.`

/** The programs still running on this day (Boston date, YYYY-MM-DD). */
export function farePrograms(today: string): FareProgram[] {
  return PROGRAMS.filter((p) => !p.until || today < p.until)
}

export function fareProgram(id: string, today: string): FareProgram | undefined {
  return farePrograms(today).find((p) => p.id === id)
}
