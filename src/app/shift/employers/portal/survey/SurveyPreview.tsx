'use client'

import SurveyForm from '@/app/survey/[token]/SurveyForm'
import type { PublicSurvey } from '@/lib/employer/survey-server'

/**
 * "What staff see": the real survey form in a phone frame, driven by the
 * wizard's current choices (nothing is saved, Send is disabled). The first
 * screen changes when MassDEP is ticked and the day grid shows the chosen
 * week's dates, so the admin sees what their settings do.
 */
export default function SurveyPreview({ survey }: { survey: PublicSurvey }) {
  return (
    <div className="rounded-[26px] bg-[#191A2E] p-3 shadow-md">
      <div className="h-[560px] w-full overflow-y-auto rounded-[18px] bg-cream [scrollbar-width:thin]">
        <SurveyForm key={`${survey.rule_set}-${survey.week_start}-${survey.departments.join('|')}`} token="preview" survey={survey} recipient={null} preview />
      </div>
    </div>
  )
}
