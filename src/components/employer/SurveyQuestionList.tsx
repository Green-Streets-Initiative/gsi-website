// No 'use client': printed by the survey report page on the server and
// usable anywhere a text-only copy of the survey is needed.
import {
  CAR_FOR_BUSINESS,
  DAY_MODE_OPTIONS,
  END_TIME,
  INCENTIVES,
  INCENTIVE_RATINGS,
  INTERESTS,
  MILES_ONE_WAY,
  MINUTES_ONE_WAY,
  PARKING_FULL,
  PARKING_PART,
  SCREENING,
  START_TIME,
  TRANSIT_ROUTES,
  WHY_DRIVE,
  WHY_SHIFT,
  type Choice,
} from '@/lib/employer/survey-instrument'

type Q = { q: string; options?: readonly Choice[] | string[]; note?: string }

/** The survey, question by question, in the order staff see it. */
export function surveyQuestions(company: string): { section: string; items: Q[] }[] {
  const list = (c: readonly Choice[]) => c.map((o) => o.label)
  return [
    {
      section: '1. About your work week',
      items: SCREENING.map((s) => ({ q: s.label, options: ['Yes', 'No'] })),
    },
    {
      section: '2. How you got to work each day (Monday to Friday of survey week)',
      items: [
        { q: 'One answer per day', options: DAY_MODE_OPTIONS.map((o) => o.label), note: 'Carpool or vanpool asks how many people were in the vehicle, including you. A day with two parts asks which part covered the most distance.' },
      ],
    },
    {
      section: '3. About your commute (optional)',
      items: [
        { q: 'Where do you work? Your department', note: 'The sites and departments the employer listed.' },
        { q: 'Home ZIP code' },
        { q: 'When do you usually start work?', options: list(START_TIME) },
        { q: 'When do you usually finish?', options: list(END_TIME) },
        { q: 'How long does it take you to get to work, one way?', options: list(MINUTES_ONE_WAY) },
        { q: 'How far is it from home to work, one way?', options: list(MILES_ONE_WAY) },
        { q: 'Which transit did you use? Bus route numbers', options: list(TRANSIT_ROUTES) },
        { q: 'How often do you drive your own car for your job during the workday?', options: list(CAR_FOR_BUSINESS) },
        { q: 'When you drive the whole way, where do you park?', options: list(PARKING_FULL) },
        { q: 'When you drive part of the way, where do you park?', options: list(PARKING_PART) },
      ],
    },
    {
      section: '4. Why (optional, mark all that apply)',
      items: [
        { q: 'When you walk, bike, take transit or carpool, why?', options: list(WHY_SHIFT) },
        { q: 'When you drive alone, why?', options: list(WHY_DRIVE) },
      ],
    },
    {
      section: '5. What would change how you get to work? (optional)',
      items: [{ q: `For each: ${INCENTIVE_RATINGS.map((r) => r.label).join(' / ')}`, options: list(INCENTIVES) }],
    },
    {
      section: '6. In your words (optional)',
      items: [
        { q: 'Which of these would you like to try?', options: list(INTERESTS) },
        { q: 'What would make you switch from driving alone to another way?' },
        { q: 'What would make public transit work better for you?' },
        { q: `What could ${company} do to make carpooling, vanpooling, biking or walking easier?` },
      ],
    },
  ]
}

/** The questions as a printable list (the MassDEP sample copy; the preview fallback). */
export default function SurveyQuestionList({ company }: { company: string }) {
  return (
    <div className="grid gap-5">
      {surveyQuestions(company).map((s) => (
        <section key={s.section} className="report-section">
          <h3 className="text-[15px] font-bold">{s.section}</h3>
          <ol className="mt-2 grid gap-2.5">
            {s.items.map((it) => (
              <li key={it.q} className="text-[14px] leading-[1.5]">
                <div className="font-semibold">{it.q}</div>
                {it.options && <div className="text-ink-soft">{it.options.join(' · ')}</div>}
                {it.note && <div className="text-ink-soft">{it.note}</div>}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
