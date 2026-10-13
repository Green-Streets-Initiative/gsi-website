/**
 * Every sentence the commute-survey section shows an admin, in one place so
 * the copy pass reads it as the admin does (Keith 2026-10-13): plain words,
 * terms of art glossed where they appear, no "always this, never that".
 */
import type { RuleSet } from '@/lib/employer/survey-instrument'

export type Filing = {
  id: RuleSet
  title: string
  /** When it is due, as the admin thinks of it. */
  due: string
  /** Who it applies to, one line, on the wizard card. */
  who: string
  /** What to do with the summary, on the Summaries tab. */
  whatToDo: string
}

export const FILINGS: Filing[] = [
  {
    id: 'massdep',
    title: 'MassDEP Rideshare',
    due: 'Report due December 31',
    who: 'Sites with 1,000 or more applicable commuters (250 with an air permit). At least half of them have to answer.',
    whatToDo:
      'One PDF per site, signed by a vice president or higher, emailed to MassDEP.RideshareReg@mass.gov by December 31. Because this is not MassDEP’s own form, the PDF includes a copy of the survey questions.',
  },
  {
    id: 'cambridge',
    title: 'Cambridge PTDM',
    due: 'Report due November 30 or June 30',
    who: 'Properties with a Parking and Transportation Demand Management plan. The City runs the employee survey itself in its monitoring tool (60% of employees, Monday to Sunday); this survey adds the year-round numbers and the raffle sign-up for your report.',
    whatToDo:
      'Cambridge requires its own online survey, taken in the City\u2019s Transportation Monitoring Tool, with 60% of employees answering. Use what is here for the rest of the report: list the Shift program under TDM Implementation, and paste the year-round numbers into the Annual Review. If you run a raffle, the City redirects its survey to a sign-up form; Shift can host that form.',
  },
  {
    id: 'boston',
    title: 'Boston TAPA',
    due: 'Annual report due November 30',
    who: 'Projects with a Transportation Access Plan Agreement. The survey gives the mode-share paragraph.',
    whatToDo: 'Paste the paragraph into your TAPA annual report, due November 30. The City has no template.',
  },
  {
    id: 'emissions',
    title: 'Commuting emissions',
    due: 'No filing',
    who: 'Your staff commuting emissions for a climate or ESG report, with the activity data behind the number.',
    whatToDo:
      'No deadline. Give the activity data and the CO2e figure to whoever writes your climate or ESG report (GHG Protocol Scope 3, category 7).',
  },
]

export const FILING_BY_ID: Record<RuleSet, Filing> = Object.fromEntries(FILINGS.map((f) => [f.id, f])) as Record<RuleSet, Filing>

/** Hints behind the (i) on each hero figure. */
export const SURVEY_HINTS = {
  answered: 'Everyone who finished the survey: personal links, the Shift app and the open link.',
  responseRate: 'Answers divided by the headcount you gave under Setup. This is the rate a filing reports.',
  ofList: 'People on your staff list who answered through their own link or the app.',
  headcount: 'How many people you are asking, per site. The response rate is measured against it.',
  applicable:
    'The staff MassDEP counts: 17 or more hours a week, start and end between 6 AM and 8 PM, and their own car used for work fewer than five times a month.',
  daysLeft: 'Until the last day to answer. Reminders stop then; the survey stays open until you close it.',
  onList: 'People you added under People. Each gets a personal link when the survey opens.',
  openLink: 'Answers through the open link or QR, for staff without a work email. They count in the totals and are not tied to a name.',
  surveyWeek: 'The Monday to Friday staff answer about.',
  lastDay: 'Reminders stop on this day. Answers are accepted until you close the survey.',
} as const

/** MassDEP's response bands and the summary form each allows, in one line each. */
export const MASSDEP_BANDS = [
  { at: 50, label: '50%', form: 'Floor' },
  { at: 75, label: '75%', form: 'SCD 2' },
  { at: 90, label: '90%', form: 'SCD 1' },
] as const

export const MASSDEP_GLOSS =
  'MassDEP counts applicable commuters: staff who work 17 or more hours a week, start and end between 6 AM and 8 PM, and use their own car for work fewer than five times a month. Half of them answering makes a census, a survey of everyone rather than a sample. The rate also picks MassDEP’s summary form: 90% or more allows SCD 1, the shortest; 75% to 90% SCD 2; 50% to 75% SCD 2 if you add one more trip-reduction incentive, otherwise SCD 3.'

export const CAMBRIDGE_FLOOR_LINE = 'Cambridge requires 60% of employees to answer its own online survey (City of Cambridge, October 2026); this survey does not replace it.'

/** "Allows SCD 2", "Below the 50% floor": the short form of the band for a sub line. */
export function massdepBandShort(ratePct: number): string {
  if (ratePct >= 90) return 'Allows SCD 1, the shortest form'
  if (ratePct >= 75) return 'Allows SCD 2'
  if (ratePct >= 50) return 'Allows SCD 2 with one more incentive'
  return 'Below the 50% floor'
}
